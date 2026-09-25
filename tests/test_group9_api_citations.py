import asyncio

import pytest
from fastapi.testclient import TestClient

import api_server
import orchestrator
from orchestrator import RagAnswer, _validated_rag_answer


def test_unknown_citations_are_removed_and_retrieved_sources_are_structured():
    result = _validated_rag_answer(
        "Supported [source=known.txt chunk=1] Unsupported [source=secret.txt chunk=9]",
        "[source=known.txt chunk=1]\nKnown authorized evidence.",
    )
    assert str(result) == "Supported [source=known.txt chunk=1] Unsupported"
    assert len(result.citations) == 1
    assert result.citations[0].source_label == "known.txt"
    assert result.citations[0].chunk_number == 1
    assert result.citations[0].evidence_excerpt == "Known authorized evidence."


def test_empty_rag_answer_has_empty_citations():
    async def run():
        class Manager:
            async def call_tool(self, name, args):
                return "No matching evidence found in the requested document."

        return await orchestrator.flow_rag_search("unsupported", Manager(), "user-a")

    result = asyncio.run(run())
    assert isinstance(result, RagAnswer)
    assert result.citations == ()


def test_authenticated_fastapi_system_rag_response_contains_structured_citations():
    api_server.SESSIONS.clear()
    client = TestClient(api_server.app)
    session_response = client.post(
        "/api/session",
        json={"employee_name": "Group 9 Synthetic User", "employee_email": "user9@local"},
    )
    assert session_response.status_code == 200
    session_id = session_response.json()["session_id"]
    headers = {"X-Session-ID": session_id}

    chat_response = client.post(
        "/api/chat",
        headers=headers,
        json={
            "message": "When is safety inspection required?",
            "session_id": session_id,
        },
    )

    assert chat_response.status_code == 200, chat_response.text
    payload = chat_response.json()
    assert payload["status"] == "completed"
    assert payload["task"] == "rag_search"
    assert isinstance(payload["citations"], list)
    assert payload["citations"]
    for citation in payload["citations"]:
        assert citation["source_label"]
        assert "\\" not in citation["source_label"]
        assert "/" not in citation["source_label"]
        assert "session" not in citation["source_label"].lower()


def test_fastapi_rejects_missing_or_mismatched_session():
    client = TestClient(api_server.app)
    missing = client.post("/api/chat", json={"message": "When is safety inspection required?"})
    assert missing.status_code == 422

    api_server.SESSIONS.clear()
    session_id = client.post("/api/session", json={"employee_name": "A"}).json()["session_id"]
    mismatch = client.post(
        "/api/chat",
        headers={"X-Session-ID": session_id},
        json={"message": "When is safety inspection required?", "session_id": "other"},
    )
    assert mismatch.status_code == 403


def test_fastapi_rejects_cross_user_file_reuse():
    api_server.SESSIONS.clear()
    client = TestClient(api_server.app)
    session_a = client.post("/api/session", json={"employee_name": "A"}).json()["session_id"]
    session_b = client.post("/api/session", json={"employee_name": "B"}).json()["session_id"]
    upload = client.post(
        "/api/upload",
        headers={"X-Session-ID": session_a},
        files={"file": ("private_group9.txt", b"PRIVATE GROUP9 EVIDENCE", "text/plain")},
    )
    assert upload.status_code == 200, upload.text
    file_id = upload.json()["file_id"]

    chat = client.post(
        "/api/chat",
        headers={"X-Session-ID": session_b},
        json={
            "message": "Summarize this uploaded file",
            "session_id": session_b,
            "file_id": file_id,
        },
    )
    assert chat.status_code == 404
    assert "PRIVATE GROUP9 EVIDENCE" not in chat.text