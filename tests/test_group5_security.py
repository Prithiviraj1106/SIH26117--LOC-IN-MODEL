import asyncio
import sqlite3
from pathlib import Path

import pytest
from fastapi import HTTPException

import api_server
import rag_mcp_server
from api_server import ApprovalRequest, ChatRequest, SessionRequest
from chat_memory import ChatStore
from security import validate_upload


@pytest.fixture
def isolated_api(tmp_path, monkeypatch):
    store = ChatStore(tmp_path / "chat.db")
    monkeypatch.setattr(api_server, "chat_store", store)
    api_server.SESSIONS.clear()
    api_server.FILES_BY_ID.clear()
    api_server.GENERATED_FILE_OWNERS.clear()
    user_a = api_server.create_session(SessionRequest(employee_name="A"))
    user_b = api_server.create_session(SessionRequest(employee_name="B"))
    return store, user_a.session_id, user_b.session_id


def test_chat_crud_is_owner_scoped(isolated_api):
    store, owner_a, owner_b = isolated_api
    chat_id = store.create_chat("A chat", owner_a)
    store.add_message(chat_id, "user", "private A content", owner_a)

    assert api_server.list_chats(owner_a)["chats"][0]["chat_id"] == chat_id
    assert api_server.list_chats(owner_b)["chats"] == []
    assert api_server.get_chat(chat_id, owner_a)["messages"][0]["content"] == "private A content"
    with pytest.raises(HTTPException) as error:
        api_server.get_chat(chat_id, owner_b)
    assert error.value.status_code == 404
    with pytest.raises(HTTPException):
        api_server.rename_chat(chat_id, api_server.ChatRenameRequest(title="stolen"), owner_b)
    with pytest.raises(HTTPException):
        api_server.delete_chat(chat_id, owner_b)
    assert api_server.get_chat(chat_id, owner_a)["chat"]["title"] == "A chat"


def test_unknown_and_mismatched_sessions_are_rejected(isolated_api):
    _store, owner_a, owner_b = isolated_api
    with pytest.raises(HTTPException) as error:
        api_server.list_chats("unknown")
    assert error.value.status_code == 401
    with pytest.raises(HTTPException) as error:
        asyncio.run(api_server.chat_with_backend(
            ChatRequest(message="hello", session_id=owner_a), owner_b
        ))
    assert error.value.status_code == 403


def test_file_owner_is_checked_before_processing(isolated_api, tmp_path):
    store, owner_a, owner_b = isolated_api
    chat_b = store.create_chat("B chat", owner_b)
    file_path = tmp_path / "owner_a.txt"
    file_path.write_text("private file A", encoding="utf-8")
    api_server.FILES_BY_ID["file-a"] = {"path": str(file_path), "owner_id": owner_a}

    with pytest.raises(HTTPException) as error:
        asyncio.run(api_server.chat_with_backend(
            ChatRequest(message="summarize this", session_id=owner_b, chat_id=chat_b, file_id="file-a"),
            owner_b,
        ))
    assert error.value.status_code == 404


def test_selected_document_mode_uses_owned_file_for_generic_question(isolated_api, tmp_path, monkeypatch):
    store, owner_a, _owner_b = isolated_api
    chat_id = store.create_chat("Certificate", owner_a)
    file_path = tmp_path / "certificate.pdf"
    file_path.write_bytes(b"local test document")
    api_server.FILES_BY_ID["file-a"] = {"path": str(file_path), "owner_id": owner_a}
    captured = {}

    class FakeManager:
        task_state = None

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

    async def fake_handle_message(*args, **kwargs):
        captured["file_path"] = kwargs.get("file_path")
        return "certificate response"

    monkeypatch.setattr(api_server, "MCPManager", lambda **_kwargs: FakeManager())
    monkeypatch.setattr(api_server, "handle_message", fake_handle_message)
    result = asyncio.run(api_server.chat_with_backend(
        ChatRequest(
            message="What is the expiry date?",
            session_id=owner_a,
            chat_id=chat_id,
            file_id="file-a",
            active_mode="document",
        ),
        owner_a,
    ))

    assert result["response"] == "certificate response"
    assert captured["file_path"] == str(file_path.resolve())


def test_memories_are_owner_scoped(tmp_path):
    store = ChatStore(tmp_path / "memory.db")
    memory_a = store.add_memory("secret pump A", owner_id="A")
    store.add_memory("secret valve B", owner_id="B")
    assert [item["id"] for item in store.list_memories("A")] == [memory_a]
    assert store.recall_relevant_memories("pump", owner_id="B") == []
    store.delete_memory(memory_a, owner_id="B")
    assert store.list_memories("A")[0]["id"] == memory_a


def test_legacy_database_migrates_without_dropping_data(tmp_path):
    database = tmp_path / "legacy.db"
    with sqlite3.connect(database) as connection:
        connection.executescript(
            "CREATE TABLE conversations (chat_id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);"
            "CREATE TABLE memories (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL, category TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL);"
        )
        connection.execute("INSERT INTO conversations VALUES ('legacy-chat', 'Legacy', 'now', 'now')")
        connection.execute("INSERT INTO memories VALUES (1, 'legacy fact', 'general', 'auto', 'now')")
    store = ChatStore(database)
    assert store.list_chats("legacy")[0]["chat_id"] == "legacy-chat"
    assert store.list_memories("legacy")[0]["content"] == "legacy fact"


def test_rag_filters_uploaded_documents_by_owner(monkeypatch):
    class FakeCollection:
        def query(self, **_kwargs):
            return {
                "documents": [["A private", "B private", "System SOP"]],
                "metadatas": [[
                    {"source_file": "a.txt", "file_hash": "a", "owner_id": "A", "document_type": "UPLOAD"},
                    {"source_file": "b.txt", "file_hash": "b", "owner_id": "B", "document_type": "UPLOAD"},
                    {"source_file": "sop.txt", "file_hash": "s", "document_type": "SOP"},
                ]],
            }

    monkeypatch.setattr(rag_mcp_server, "collection", FakeCollection())
    result = rag_mcp_server.search_sops("private", top_k=3, owner_id="B")
    assert "B private" in result
    assert "System SOP" in result
    assert "A private" not in result
    ownerless_result = rag_mcp_server.search_sops("private", top_k=3)
    assert "A private" not in ownerless_result
    assert "B private" not in ownerless_result


def test_approval_and_generated_files_are_owner_scoped(isolated_api, tmp_path):
    _store, owner_a, owner_b = isolated_api
    with pytest.raises(HTTPException) as error:
        api_server.approve_action(ApprovalRequest(session_id=owner_a, tool="generate_docx"), owner_b)
    assert error.value.status_code == 403

    artifact = tmp_path / "a.docx"
    artifact.write_bytes(b"private artifact")
    api_server.GENERATED_FILE_OWNERS[artifact.name] = owner_a
    original_dir = api_server.GENERATED_DIR
    api_server.GENERATED_DIR = tmp_path
    try:
        assert api_server.list_generated_files(owner_a)["files"][0]["filename"] == "a.docx"
        assert api_server.list_generated_files(owner_b)["files"] == []
        with pytest.raises(HTTPException) as error:
            api_server.get_generated_file("a.docx", owner_b)
        assert error.value.status_code == 404
    finally:
        api_server.GENERATED_DIR = original_dir


def test_path_validation_rejects_outside_upload_root(tmp_path):
    upload_root = tmp_path / "project" / "uploads"
    outside = tmp_path / "outside.txt"
    outside.write_text("private", encoding="utf-8")
    assert validate_upload(str(outside), upload_root, {".txt"}) is None
    assert validate_upload(str(outside.parent / ".." / outside.name), upload_root, {".txt"}) is None