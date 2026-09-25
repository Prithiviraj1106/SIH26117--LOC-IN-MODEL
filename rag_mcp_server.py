"""
rag_mcp_server.py — MCP server exposing RAG search over ChromaDB.

Provides one tool: search_sops(query, top_k=3) -> str.

Queries a ChromaDB collection populated by ingest_sops.py from BOTH
sample_data/sops/ and sample_data/correspondence/.

When to call: When the orchestrator needs to retrieve relevant SOP
or correspondence context for a task (e.g., drafting an approval note).
When NOT to call: Do not call directly from orchestrator.py — call
through MCPManager.call_tool(). This file runs as a standalone MCP
server process.
"""
import hashlib
import json
import re
from pathlib import Path

import chromadb
from fastmcp import FastMCP, Context
from embedding import DEFAULT_EMBEDDING_FUNCTION
from security import validate_upload

mcp = FastMCP("rag", instructions="RAG search over MRPL SOPs and correspondence")

client = chromadb.PersistentClient(path="./chroma_data")
collection = client.get_or_create_collection(
    name="sops",
    embedding_function=DEFAULT_EMBEDDING_FUNCTION,
)

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150


def _query_tokens(value: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", (value or "").lower()) if len(token) > 2}


def _file_hash(file_path: str) -> str:
    digest = hashlib.sha256()
    with open(file_path, "rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _chunks(text: str) -> list[str]:
    if not text or not text.strip():
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(text):
            break
        start = end - CHUNK_OVERLAP
    return chunks


@mcp.tool()
def ingest_document(file_path: str, text: str, owner_id: str | None = None) -> str:
    """Hash, deduplicate, chunk, and persist one extracted upload."""
    project_root = Path(__file__).resolve().parent
    upload_root = project_root / "sample_data_uploads"
    allowed = {".pdf", ".txt", ".docx", ".xlsx", ".pptx", ".png", ".jpg", ".jpeg", ".webp"}
    path = validate_upload(file_path, upload_root, allowed)
    if not path:
        # Also allow a file that is already within the project root under generated_files/
        resolved = Path(file_path).resolve() if file_path else None
        if resolved and resolved.is_file() and resolved.suffix.lower() in allowed:
            path = resolved
        else:
            return json.dumps({"success": False, "error": f"File not found: {file_path}"})
    file_hash = _file_hash(str(path))
    existing = collection.get(where={"file_hash": file_hash}, limit=1).get("ids", [])
    if existing:
        return json.dumps({"success": True, "duplicate": True, "file_hash": file_hash, "chunks": 0})
    chunks = _chunks(text)
    if not chunks:
        return json.dumps({"success": False, "error": "No readable content to index.", "file_hash": file_hash})
    ids = [f"{file_hash[:16]}_chunk_{index}" for index in range(1, len(chunks) + 1)]
    metadata = [{
        "source_file": path.name,
        "file_hash": file_hash,
        "document_type": "UPLOAD",
        "owner_id": owner_id or "legacy",
        "chunk_number": index,
        "total_chunks": len(chunks),
    } for index in range(1, len(chunks) + 1)]
    collection.add(documents=chunks, metadatas=metadata, ids=ids)
    return json.dumps({"success": True, "duplicate": False, "file_hash": file_hash, "chunks": len(chunks)})


@mcp.tool()
def search_sops(query: str, top_k: int = 3, file_hash: str | None = None, owner_id: str | None = None) -> str:
    """Search SOPs and correspondence for relevant context.
    
    Args:
        query: The search query (e.g., findings from an inspection).
        top_k: Number of results to return (default 3).
    
    Returns:
        Concatenated text of the most relevant documents.
    
    When NOT to call: If the query is less than 3 characters,
    the collection may not be populated yet — call ingest_sops.py first.
    NEVER call this for general conversation, greetings, or questions
    about how the system itself works."""
    if len(query.strip()) < 3:
        return "Query too short for meaningful search."
    where = {"file_hash": file_hash} if file_hash else None
    results = collection.query(
        query_texts=[query],
        n_results=max(top_k * 5, top_k),
        where=where,
        include=["documents", "metadatas", "distances"],
    )
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]
    if not documents:
        return "No matching evidence found in the requested document."
    query_terms = _query_tokens(query)
    candidates = []
    for index, document in enumerate(documents):
        metadata = (metadatas[index] if index < len(metadatas) else None) or {}
        document_owner = metadata.get("owner_id")
        document_type = metadata.get("document_type")
        is_system_document = document_type in {"SOP", "CORRESPONDENCE"} or (
            not document_type and not owner_id
        )
        if not is_system_document and (not owner_id or document_owner != owner_id):
            continue
        document_terms = _query_tokens(document)
        lexical_score = len(query_terms & document_terms) / max(len(query_terms), 1)
        distance = distances[index] if index < len(distances) and distances[index] is not None else 1.0
        candidates.append((lexical_score, -float(distance), document, metadata))
    if candidates and max(candidate[0] for candidate in candidates) == 0:
        return "No matching evidence found in the requested document."
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    evidence = []
    for _lexical_score, _distance, document, metadata in candidates:
        source = metadata.get("source_file", "system document")
        chunk = metadata.get("chunk_number")
        trace = f"source={source}"
        if chunk is not None:
            trace += f" chunk={chunk}"
        evidence.append(f"[{trace}]\n{document}")
        if len(evidence) >= top_k:
            break
    if not evidence:
        return "No matching evidence found in the requested document."
    return "\n\n---\n\n".join(evidence)


if __name__ == "__main__":
    import os
    os.environ["FASTMCP_TRANSPORT"] = "stdio"
    mcp.run(transport="stdio")
