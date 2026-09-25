# MRPL Sovereign Workbench — Orchestrated Replacement

## Architecture

`User -> Router -> Model -> Orchestrator -> Dynamic MCP Tools -> Evidence -> Final Model`

- **Router:** assigns chat, code, vision, RAG/document, Word, Excel, PowerPoint, and email tasks.
- **Models:** configured in `models_config.json` and run through local Ollama.
- **Orchestrator:** plans one MCP action at a time, validates tool names against runtime discovery, executes the tool, and then produces the final answer.
- **Dynamic MCP:** every `*_mcp_server.py` in the project root or `mcp_servers/` is discovered automatically. There is no hard-coded server registry.
- **Chat memory:** SQLite stores chats/messages and durable memories. Local Qwen decides whether a new user message contains a persistent fact. Memories are recalled separately from document evidence.
- **RAG:** ChromaDB remains the authoritative source for indexed documents.

## Included MCP servers

- `rag_mcp_server.py` — ingest/search
- `vision_mcp_server.py` — PDF/image OCR and vision extraction
- `docgen_mcp_server.py` — Word read/generate
- `xlsx_mcp_server.py` — Excel read/generate
- `pptx_mcp_server.py` — PowerPoint read/generate
- `code_exec_mcp_server.py` — sandboxed code execution
- `email_mcp_server.py` — local/SMTP email

## Run

```text
pip install -r requirements.txt
ollama serve
streamlit run app.py --server.address 0.0.0.0 --server.port 8501
```

Make sure the configured local models exist in Ollama. The application is designed for local/on-prem operation; Gmail SMTP is an explicit optional exception in the existing UI.

## Important

This replacement intentionally excludes old `.venv`, `.git`, caches, test logs, old SQLite databases, old Chroma databases, uploads, and generated artifacts. Existing data should be backed up before replacement if it must be preserved.
