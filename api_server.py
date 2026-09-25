"""FastAPI adapter for the existing MRPL backend.

This file intentionally wraps the current backend logic instead of reimplementing
it. The source of truth remains the existing Streamlit-oriented code in:
- orchestrator.py
- router.py
- chat_memory.py
- policy.py
- task_state.py
- workflow_memory.py
- the MCP server modules
"""

from __future__ import annotations

import os
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote

from fastapi import FastAPI, File, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from chat_memory import ChatStore
from orchestrator import (
    MCPManager,
    build_memory_context,
    decide_execution,
    handle_message,
    resolve_email_recipient,
)
from router import load_model_config, request_uses_file_context, required_servers
from task_state import TaskState
from policy import SENSITIVE_TOOLS


PROJECT_ROOT = Path(__file__).resolve().parent
UPLOAD_DIR = PROJECT_ROOT / "sample_data_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
GENERATED_DIR = PROJECT_ROOT / "generated_files"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = 200 * 1024 * 1024
ALLOWED_UPLOAD_TYPES = {".txt", ".pdf", ".docx", ".xlsx", ".pptx", ".png", ".jpg", ".jpeg", ".webp"}

app = FastAPI(title="MRPL Sovereign Workbench API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
        "http://0.0.0.0:3000",
        "http://0.0.0.0:3001",
        "http://0.0.0.0:5173",
        "http://[::1]:3000",
        "http://[::1]:3001",
        "http://[::1]:5173",
        "http://10.160.90.154:3000",
        "http://10.160.90.154:3001",
    ],
    allow_origin_regex=r"https?://(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|(?:\d{1,3}\.){3}\d{1,3})(?::(?:3000|3001|5173|4173))?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_store = ChatStore()
FILES_BY_ID: dict[str, dict[str, str]] = {}
GENERATED_FILE_OWNERS: dict[str, str] = {}
SESSIONS: dict[str, dict[str, Any]] = {}


class SessionRequest(BaseModel):
    employee_name: str = Field(default="")
    employee_email: str = Field(default="")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str | None = None
    chat_id: str | None = None
    file_id: str | None = None
    active_mode: str | None = None
    sender_name: str | None = None
    sender_email: str | None = None
    memory_context: str = ""


class ChatCreateRequest(BaseModel):
    title: str | None = None


class ChatRenameRequest(BaseModel):
    title: str = Field(..., min_length=1)


class ApprovalRequest(BaseModel):
    session_id: str
    tool: str


class SessionResponse(BaseModel):
    session_id: str
    employee_name: str
    employee_email: str
    approved_actions: list[str]


class CitationResponse(BaseModel):
    source_label: str
    chunk_number: int | None = None
    page_number: int | None = None
    evidence_excerpt: str = ""


def _default_session_id() -> str:
    session_id = uuid.uuid4().hex
    SESSIONS[session_id] = {
        "employee_name": "",
        "employee_email": "",
        "approved_actions": set(),
    }
    return session_id


def _require_session(session_id: str | None) -> dict[str, Any]:
    if not session_id or session_id not in SESSIONS:
        raise HTTPException(status_code=401, detail="Valid session required")
    return SESSIONS[session_id]


def _resolve_file_path(file_id: str | None) -> str | None:
    if not file_id:
        return None
    record = FILES_BY_ID.get(file_id)
    if not record:
        return None
    stored_path = record["path"] if isinstance(record, dict) else record
    candidate = Path(stored_path).resolve()
    if not candidate.exists() or not candidate.is_file():
        return None
    return str(candidate)


def _safe_upload_name(filename: str) -> str:
    name = Path(filename).name or "upload"
    return name


def _safe_generated_filename(filename: str) -> str:
    name = unquote(filename)
    candidate = Path(name).name
    if candidate in {"", ".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid filename")
    return candidate


def _chat_messages_for(chat_id: str | None) -> list[dict[str, str]]:
    if not chat_id:
        return []
    try:
        return [{"role": msg["role"], "content": msg["content"]} for msg in chat_store.get_messages(chat_id)]
    except Exception:
        return []


def _record_generated_files(owner_id: str, started_at: float) -> list[dict[str, Any]]:
    artifacts: list[dict[str, Any]] = []
    mime_types = {
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }
    for path in GENERATED_DIR.iterdir():
        if path.is_file() and path.stat().st_mtime >= started_at:
            GENERATED_FILE_OWNERS[path.name] = owner_id
            artifacts.append({
                "filename": path.name,
                "url": f"/api/generated-files/{quote(path.name, safe='')}",
                "mime_type": mime_types.get(path.suffix.lower(), "application/octet-stream"),
                "size_bytes": path.stat().st_size,
            })
    return artifacts


@app.get("/api/health")
def api_health() -> dict[str, Any]:
    return {"status": "ok", "service": "MRPL Workbench API"}


@app.get("/api/models")
def api_models() -> dict[str, Any]:
    config = load_model_config()
    return {"models": config.get("models", {}), "ollama_host": config.get("ollama_host", "localhost:11434")}


@app.get("/api/status")
def api_status() -> dict[str, Any]:
    return {
        "status": "ok",
        "generated_files_dir": str(GENERATED_DIR),
        "upload_dir": str(UPLOAD_DIR),
        "chats": len(chat_store.list_chats()),
        "memories": len(chat_store.list_memories()),
    }


@app.post("/api/session", response_model=SessionResponse)
def create_session(payload: SessionRequest) -> SessionResponse:
    session_id = uuid.uuid4().hex
    session = {
        "employee_name": payload.employee_name.strip(),
        "employee_email": payload.employee_email.strip(),
        "approved_actions": set(),
    }
    SESSIONS[session_id] = session
    return SessionResponse(
        session_id=session_id,
        employee_name=session["employee_name"],
        employee_email=session["employee_email"],
        approved_actions=[],
    )


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), session_id: str = Header(..., alias="X-Session-ID")) -> dict[str, Any]:
    _require_session(session_id)
    if not file.filename:
        raise HTTPException(status_code=400, detail="A filename is required.")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 200 MB upload limit.")

    safe_name = _safe_upload_name(file.filename)
    file_id = uuid.uuid4().hex
    target = UPLOAD_DIR / f"{file_id}_{safe_name}"
    with target.open("wb") as handle:
        handle.write(contents)

    FILES_BY_ID[file_id] = {"path": str(target), "owner_id": session_id}

    return {
        "file_id": file_id,
        "filename": safe_name,
        "size_bytes": len(contents),
        "content_type": file.content_type or "application/octet-stream",
    }


@app.get("/api/chats")
def list_chats(session_id: str = Header(..., alias="X-Session-ID")) -> dict[str, Any]:
    _require_session(session_id)
    return {"chats": chat_store.list_chats(session_id)}


@app.post("/api/chats")
def create_chat(payload: ChatCreateRequest | None = None, session_id: str = Header(..., alias="X-Session-ID")) -> dict[str, Any]:
    _require_session(session_id)
    title = (payload.title if payload else None) or "New chat"
    chat_id = chat_store.create_chat(title, owner_id=session_id)
    return {"chat_id": chat_id, "title": title}


@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: str, session_id: str = Header(..., alias="X-Session-ID")) -> dict[str, Any]:
    _require_session(session_id)
    chat = next((item for item in chat_store.list_chats(session_id) if item["chat_id"] == chat_id), None)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {
        "chat": chat,
        "messages": chat_store.get_messages(chat_id, session_id),
    }


@app.patch("/api/chats/{chat_id}")
def rename_chat(chat_id: str, payload: ChatRenameRequest, session_id: str = Header(..., alias="X-Session-ID")) -> dict[str, Any]:
    _require_session(session_id)
    if not any(item["chat_id"] == chat_id for item in chat_store.list_chats(session_id)):
        raise HTTPException(status_code=404, detail="Chat not found")
    chat_store.rename_chat(chat_id, payload.title, session_id)
    return {"chat_id": chat_id, "title": payload.title}


@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: str, session_id: str = Header(..., alias="X-Session-ID")) -> dict[str, Any]:
    _require_session(session_id)
    if not any(item["chat_id"] == chat_id for item in chat_store.list_chats(session_id)):
        raise HTTPException(status_code=404, detail="Chat not found")
    chat_store.delete_chat(chat_id, session_id)
    return {"deleted": True, "chat_id": chat_id}


@app.get("/api/memories")
def list_memories(session_id: str = Header(..., alias="X-Session-ID")) -> dict[str, Any]:
    _require_session(session_id)
    return {"memories": chat_store.list_memories(session_id)}


@app.delete("/api/memories/{memory_id}")
def delete_memory(memory_id: int, session_id: str = Header(..., alias="X-Session-ID")) -> dict[str, Any]:
    _require_session(session_id)
    try:
        chat_store.delete_memory(memory_id, session_id)
    except Exception as exc:  # pragma: no cover - defensive API wrapper
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"deleted": True, "memory_id": memory_id}


@app.post("/api/approve")
def approve_action(payload: ApprovalRequest, session_header: str = Header(..., alias="X-Session-ID")) -> dict[str, Any]:
    if payload.tool not in SENSITIVE_TOOLS:
        raise HTTPException(status_code=400, detail=f"Tool '{payload.tool}' cannot be approved.")
    if payload.session_id != session_header:
        raise HTTPException(status_code=403, detail="Approval session mismatch")
    session = _require_session(session_header)
    session.setdefault("approved_actions", set()).add(payload.tool)
    return {
        "session_id": payload.session_id,
        "tool": payload.tool,
        "approved": True,
        "approved_actions": sorted(session["approved_actions"]),
    }


@app.get("/api/generated-files")
def list_generated_files(session_id: str = Header(..., alias="X-Session-ID")) -> dict[str, Any]:
    _require_session(session_id)
    files: list[dict[str, Any]] = []
    if GENERATED_DIR.exists():
        for path in sorted(GENERATED_DIR.iterdir()):
            if path.is_file() and GENERATED_FILE_OWNERS.get(path.name) == session_id:
                files.append({
                    "filename": path.name,
                    "size_bytes": path.stat().st_size,
                    "url": f"/api/generated-files/{quote(path.name, safe='')}",
                })
    return {"files": files}


@app.get("/api/generated-files/{filename}")
def get_generated_file(filename: str, session_id: str = Header(..., alias="X-Session-ID")) -> FileResponse:
    _require_session(session_id)
    safe_name = _safe_generated_filename(filename)
    target = (GENERATED_DIR / safe_name).resolve()
    if GENERATED_FILE_OWNERS.get(safe_name) != session_id:
        raise HTTPException(status_code=404, detail="Generated file not found")
    if not target.is_file() or GENERATED_DIR.resolve() not in target.parents and target != GENERATED_DIR.resolve():
        raise HTTPException(status_code=404, detail="Generated file not found")
    return FileResponse(str(target))


@app.post("/api/chat")
async def chat_with_backend(payload: ChatRequest, session_header: str = Header(..., alias="X-Session-ID")) -> dict[str, Any]:
    if payload.session_id and payload.session_id != session_header:
        raise HTTPException(status_code=403, detail="Session mismatch")
    session_id = session_header
    session = _require_session(session_id)

    employee_name = payload.sender_name or session.get("employee_name") or "User"
    employee_email = payload.sender_email or session.get("employee_email") or ""
    approved_actions = session.get("approved_actions", set())

    chat_id = payload.chat_id or chat_store.create_chat("New chat", owner_id=session_id)
    if not any(item["chat_id"] == chat_id for item in chat_store.list_chats(session_id)):
        raise HTTPException(status_code=404, detail="Chat not found")

    message_text = payload.message.strip()
    if not message_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    chat_store.add_message(chat_id, "user", message_text, session_id)

    file_record = FILES_BY_ID.get(payload.file_id) if payload.file_id else None
    if file_record and file_record["owner_id"] != session_id:
        raise HTTPException(status_code=404, detail="File not found")
    uses_selected_file = payload.active_mode in {"vision", "document"} and bool(payload.file_id)
    file_path = _resolve_file_path(payload.file_id) if uses_selected_file or request_uses_file_context(message_text, bool(payload.file_id)) else None
    file_name = None
    if file_path:
        file_name = Path(file_path).name

    conversation_history = [{"role": item["role"], "content": item["content"]} for item in chat_store.get_messages(chat_id, session_id)]
    memory_context = payload.memory_context or build_memory_context(message_text, chat_store, limit=3, owner_id=session_id)

    task_state = TaskState(user_request=message_text, intent="unknown")
    task_state.event(f"Intent detected: chat request")

    decision = decide_execution(message_text, file_path)
    route = decision["route"]
    task = decision["workflow"]
    selected_servers = None if decision["mode"] == "react" else required_servers(route)
    if selected_servers and task in {"vision_ocr", "vision_only"}:
        save_to_rag = any(phrase in message_text.lower() for phrase in (
            "save in rag", "save it in rag", "store in rag", "index this", "add to rag", "remember this"
        ))
        if not save_to_rag:
            selected_servers = [server for server in selected_servers if server != "rag"]
    if decision["mode"] == "direct" and task == "chat":
        task_state.set_execution(decision["mode"], task)
        task_state.event(f"Model selected: {route['primary_model']}")
    else:
        task_state.set_execution(decision["mode"], task)
        task_state.event(f"Model selected: {route['primary_model']}")

    manager = MCPManager(
        servers=selected_servers,
        approved_actions=set(approved_actions),
        task_state=task_state,
    )

    request_started = time.time()
    try:
        async def _run_once() -> str:
            async with manager:
                return await handle_message(
                    message_text,
                    manager,
                    file_path=file_path,
                    conversation_history=conversation_history,
                    sender_name=employee_name,
                    sender_email=employee_email,
                    memory_context=memory_context,
                    owner_id=session_id,
                )

        result = await _run_once()
        artifacts = _record_generated_files(session_id, request_started)
        artifact = artifacts[0] if artifacts else None
        if result.startswith("Approval required:"):
            tool_name = result.split("'", 2)[1] if "'" in result else "unknown"
            chat_store.add_message(chat_id, "assistant", result, session_id)
            session.setdefault("approved_actions", set())
            return {
                "chat_id": chat_id,
                "message": message_text,
                "requires_approval": True,
                "tool": tool_name,
                "reason": result,
                "status": "awaiting_approval",
                "artifact": None,
            }

        chat_store.add_message(chat_id, "assistant", result, session_id)
        response = {
            "chat_id": chat_id,
            "message": message_text,
            "response": result,
            "status": "completed",
            "task": task,
            "route": route,
            "file_name": file_name,
            "artifact": artifact,
            "session_id": session_id,
            "requires_approval": False,
            "citations": [
                {
                    "source_label": citation.source_label,
                    "chunk_number": citation.chunk_number,
                    "page_number": citation.page_number,
                    "evidence_excerpt": citation.evidence_excerpt,
                }
                for citation in getattr(result, "citations", ())
            ],
        }
        return response
    except Exception as exc:  # pragma: no cover - defensive API wrapper
        chat_store.add_message(chat_id, "assistant", f"Error: {type(exc).__name__}: {exc}", session_id)
        raise HTTPException(status_code=500, detail=f"Backend execution failed: {exc}") from exc


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api_server:app", host="0.0.0.0", port=8000)
