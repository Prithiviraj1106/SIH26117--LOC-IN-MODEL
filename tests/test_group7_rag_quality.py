import asyncio

import numpy as np

import orchestrator
import rag_mcp_server as rag
from embedding import LocalEmbeddingFunction


class FakeCollection:
    def __init__(self, documents, metadatas, distances=None):
        self.documents = documents
        self.metadatas = metadatas
        self.distances = distances or [0.1] * len(documents)
        self.kwargs = None

    def query(self, **kwargs):
        self.kwargs = kwargs
        return {
            "documents": [self.documents],
            "metadatas": [self.metadatas],
            "distances": [self.distances],
        }


def test_local_embedding_is_deterministic_and_offline():
    embedder = LocalEmbeddingFunction()
    first = np.asarray(embedder(["safety inspection required"]))
    second = np.asarray(embedder(["safety inspection required"]))
    assert first.shape == (1, 384)
    assert np.array_equal(first, second)


def test_hybrid_reranking_prioritizes_lexical_evidence_and_traces_source(monkeypatch):
    collection = FakeCollection(
        [
            "Maintenance activities must be recorded in the maintenance register.",
            "Safety inspection must be completed before equipment operation.",
            "Employees submit leave requests through the approved process.",
        ],
        [
            {"source_file": "maintenance.txt", "document_type": "SOP", "chunk_number": 1},
            {"source_file": "safety.txt", "document_type": "SOP", "chunk_number": 2},
            {"source_file": "leave.txt", "document_type": "SOP", "chunk_number": 1},
        ],
        [0.05, 0.4, 0.2],
    )
    monkeypatch.setattr(rag, "collection", collection)

    result = rag.search_sops("What must be recorded after maintenance?", top_k=1, owner_id="user-a")

    assert "maintenance.txt" in result
    assert "Safety inspection" not in result
    assert "chunk=1" in result
    assert collection.kwargs["include"] == ["documents", "metadatas", "distances"]


def test_rag_filters_private_documents_and_ownerless_search_fails_closed(monkeypatch):
    collection = FakeCollection(
        ["PRIVATE A ALPHA", "PRIVATE B BRAVO", "System safety SOP"],
        [
            {"source_file": "a.txt", "owner_id": "A", "document_type": "UPLOAD"},
            {"source_file": "b.txt", "owner_id": "B", "document_type": "UPLOAD"},
            {"source_file": "sop.txt", "document_type": "SOP"},
        ],
    )
    monkeypatch.setattr(rag, "collection", collection)

    user_a = rag.search_sops("private", owner_id="A")
    user_b = rag.search_sops("private", owner_id="B")
    ownerless = rag.search_sops("private")

    assert "PRIVATE A ALPHA" in user_a and "PRIVATE B BRAVO" not in user_a
    assert "PRIVATE B BRAVO" in user_b and "PRIVATE A ALPHA" not in user_b
    assert "PRIVATE A ALPHA" not in ownerless and "PRIVATE B BRAVO" not in ownerless


def test_no_authorized_evidence_returns_explicit_empty_result(monkeypatch):
    collection = FakeCollection(
        ["PRIVATE A ALPHA"],
        [{"source_file": "a.txt", "owner_id": "A", "document_type": "UPLOAD"}],
    )
    monkeypatch.setattr(rag, "collection", collection)
    assert rag.search_sops("unrelated", owner_id="B") == "No matching evidence found in the requested document."


def test_unrelated_query_abstains_when_no_terms_match(monkeypatch):
    collection = FakeCollection(
        ["Safety inspection before equipment operation."],
        [{"source_file": "safety.txt", "document_type": "SOP"}],
    )
    monkeypatch.setattr(rag, "collection", collection)
    assert rag.search_sops("space travel policy", owner_id=None) == "No matching evidence found in the requested document."


def test_legacy_null_metadata_is_safe_for_system_search(monkeypatch):
    collection = FakeCollection(["Legacy indexed SOP"], [None])
    monkeypatch.setattr(rag, "collection", collection)
    assert "Legacy indexed SOP" in rag.search_sops("indexed", owner_id=None)


def test_grounding_prompt_requires_evidence_and_abstention(monkeypatch):
    captured = {}

    def fake_agent(model, tools, system_prompt):
        captured["prompt"] = system_prompt
        return object()

    monkeypatch.setattr(orchestrator, "create_agent", fake_agent)
    orchestrator.build_agent(object(), [])
    assert "answer only from that evidence" in captured["prompt"]
    assert "documents do not contain the answer" in captured["prompt"]
    assert "untrusted data" in captured["prompt"]


def test_document_answer_does_not_append_all_old_chat_history(monkeypatch):
    captured = {}

    async def fake_chat(_llm, messages):
        captured["messages"] = messages
        return "grounded answer"

    monkeypatch.setattr(orchestrator, "chat_llm", fake_chat)
    monkeypatch.setattr(orchestrator, "make_llm", lambda *_args: object())

    class Manager:
        async def call_tool(self, name, args):
            return "CURRENT DOCUMENT EVIDENCE"

    result = asyncio.run(orchestrator.flow_vision_only(
        "Summarize this",
        "report.pdf",
        Manager(),
        [
            {"role": "user", "content": "old unrelated private message"},
            {"role": "assistant", "content": "previous assistant answer"},
        ],
    ))

    assert result == "grounded answer"
    assert len(captured["messages"]) == 1
    assert "old unrelated private message" not in str(captured["messages"])
    assert "previous assistant answer" not in str(captured["messages"])