"""Known deterministic workflows and direct tool tasks."""

KNOWN_WORKFLOWS = {
    "chat": {"type": "direct", "tools": []},
    "vision_only": {"type": "direct", "tools": ["extract_from_document"]},
    "vision_ocr": {"type": "direct", "tools": ["extract_from_document", "ingest_document", "search_sops"]},
    "document_rag": {"type": "fixed", "tools": ["extract_from_document", "ingest_document", "search_sops"]},
    "rag_search": {"type": "direct", "tools": ["search_sops"]},
    "approval_note": {
        "type": "fixed", "tools": ["extract_from_document", "search_sops", "generate_docx"]
    },
    "word_gen": {"type": "fixed", "tools": ["generate_docx"]},
    "code_gen": {"type": "direct", "tools": []},
    "code_explain": {"type": "direct", "tools": []},
    "code_exec": {"type": "fixed", "tools": ["run_code_sandboxed"]},
    "email": {"type": "fixed", "tools": ["send_email"]},
    "xlsx": {"type": "direct", "tools": ["generate_xlsx"]},
    "pptx": {"type": "direct", "tools": ["generate_pptx"]},
}


def get_workflow(name: str) -> dict | None:
    return KNOWN_WORKFLOWS.get(name)


def execution_for(name: str) -> str | None:
    workflow = get_workflow(name)
    if not workflow:
        return None
    return "fixed_workflow" if workflow["type"] == "fixed" else "direct"