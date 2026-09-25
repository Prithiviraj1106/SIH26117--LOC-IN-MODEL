"""Deterministic, configuration-driven task routing."""

import json
import re
from pathlib import Path

CONFIG_PATH = Path(__file__).with_name("models_config.json")


def request_uses_file_context(message: str, has_file: bool = False) -> bool:
    """Return True only when the current request explicitly references the uploaded file.

    This prevents stale file content from being reused for unrelated follow-up
    requests such as code generation or general chat.
    """
    if not has_file:
        return False
    lowered = message.lower()
    if any(marker in lowered for marker in ("using this summary", "using the summary", "for this", "for the summary", "based on this summary")):
        return False
    file_intent_markers = (
        "explain this",
        "summarize this",
        "read this",
        "describe this",
        "what is this",
        "what does this say",
        "look at this",
        "review this",
        "extract this",
        "analyze this",
        "document",
        "image",
        "diagram",
        "scan",
        "pdf",
        "ocr",
        "attached",
        "excel file",
        "xlsx",
        "spreadsheet",
        "scanned pdf",
        "uploaded file",
    )
    return any(marker in lowered for marker in file_intent_markers)


def load_model_config() -> dict:
    with CONFIG_PATH.open(encoding="utf-8") as config_file:
        return json.load(config_file)


def pick_model(task_type: str) -> str:
    """Return the configured local Ollama model for a task type."""
    models = load_model_config().get("models", {})
    return models.get(task_type, models.get("chat", {})).get("name", "qwen2.5:7b")


def model_context(task_type: str) -> int:
    models = load_model_config().get("models", {})
    return int(models.get(task_type, models.get("chat", {})).get("num_ctx", 8192))


def _has_narrow_word_document_intent(message: str) -> bool:
    has_document_phrase = re.search(
        r"\b(?:in\s+(?:a\s+)?)?(?:doc(?:ument)?|word(?:\s+(?:document|file))?)\b",
        message.lower(),
    )
    has_content_request = re.search(
        r"\b(?:give|provide|create|generate|make|prepare|write|list|put|save)\b",
        message.lower(),
    )
    return bool(has_document_phrase and has_content_request)


def _has_document_conversion_intent(message: str) -> bool:
    return bool(re.search(
        r"(?:\b(?:create|make|generate)\b.*\b(?:as|into)\s+(?:a\s+)?(?:word\s+)?(?:document|file)\b|\bconvert\b.*\b(?:to|into)\s+(?:a\s+)?(?:word(?:\s+(?:document|file))?|document|file)\b)",
        message.lower(),
    ))


def has_summary_document_intent(message: str) -> bool:
    lowered = message.lower()
    if any(marker in lowered for marker in ("using this summary", "using the summary")):
        return False
    has_summary_request = bool(re.search(r"\b(?:summari[sz]e|summary)\b", lowered))
    has_document_request = bool(re.search(r"\b(?:document|word\s+document|docx)\b", lowered))
    has_document_action = bool(re.search(r"\b(?:create|make|generate|save|write|put|convert)\b", lowered))
    return has_summary_request and has_document_request and has_document_action


def ollama_host() -> str:
    return load_model_config().get("ollama_host", "localhost:11434")


def classify_task(message: str, has_file: bool = False, file_type: str | None = None) -> str:
    """Classify a request using intent phrases and attachment context."""
    msg = message.lower()
    explicit_file_context = request_uses_file_context(message, has_file=has_file) or (
        has_file and file_type not in {None, ".txt"}
    )

    # Word document generation is a concrete artifact task and must not be
    # mistaken for generic extraction or chat intent.
    if any(k in msg for k in (
        "create a word document",
        "create word document",
        "generate a word report",
        "generate word report",
        "word document using this summary",
        "downloadable word document",
        "docx containing",
        "generate a docx",
        "convert this scanned pdf into a word document",
        "convert this pdf into a word document",
        "create a docx",
        "word report from the summary",
    )) or _has_narrow_word_document_intent(message) or _has_document_conversion_intent(message) or has_summary_document_intent(message):
        return "word_gen"

    if any(k in msg for k in ("execute this python code", "run this python code", "execute the python code", "run the python code", "run code")):
        return "code_exec"
    if any(k in msg for k in ("explain how to implement this in python", "explain this in python", "python explanation", "explain python code")):
        return "code_explain"
    if any(k in msg for k in ("python code", "give me python code", "give me code", "write a python program", "write a program", "python script", "program to", "code for this", "generate python", "generate code to", "show python code")):
        return "code_gen"
    if has_file and file_type == ".txt":
        return "document_text"
    if has_file and any(k in msg for k in ("save in rag", "save it in rag", "store in rag", "store it in rag", "index this", "add to rag", "remember this")):
        return "document_rag"
    if explicit_file_context:
        if any(k in msg for k in ("explain this", "summarize", "read this", "describe this", "what is this", "what does this say", "look at this", "review this")):
            return "vision_only"
        return "vision"
    email_intent = any(k in msg for k in ("email", "e-mail", "gmail", "send mail", "send this", "send the"))
    if email_intent:
        return "email"
    if any(k in msg for k in ("search sop", "find the sop", "search our procedures", "what does our sop say", "search procedure")):
        return "rag"
    if any(term in msg for term in ("safety", "inspection", "leave policy", "procurement", "maintenance", "sop", "procedure", "policy")) and any(
        marker in msg for marker in ("what", "when", "how", "which", "requirement", "process", "policy")
    ):
        return "rag"
    if any(k in msg for k in ("execute code", "run code", "debug code")):
        return "code_exec"
    if any(k in msg for k in ("approval note", "inspection report", "maintenance report")):
        return "reasoning"
    return "chat"


def route_request(message: str, has_file: bool = False, file_type: str | None = None) -> dict:
    """Return structured routing requirements without an extra LLM call."""
    task_type = classify_task(message, has_file=has_file, file_type=file_type)
    lowered = message.lower()
    known_task = None
    explicit_file_context = request_uses_file_context(message, has_file=has_file) or (
        has_file and file_type not in {None, ".txt"}
    )

    if "approval note" in lowered or ("draft" in lowered and "report" in lowered):
        known_task = "approval_note"
    elif any(k in lowered for k in (
        "create a word document",
        "create word document",
        "generate a word report",
        "generate word report",
        "word document using this summary",
        "downloadable word document",
        "docx containing",
        "generate a docx",
        "convert this scanned pdf into a word document",
        "convert this pdf into a word document",
        "create a docx",
        "word report from the summary",
    )) or _has_narrow_word_document_intent(message) or _has_document_conversion_intent(message) or has_summary_document_intent(message):
        known_task = "word_gen"
    elif any(k in lowered for k in ("execute this python code", "run this python code", "execute the python code", "run the python code", "run code")):
        known_task = "code_exec"
    elif any(k in lowered for k in ("explain how to implement this in python", "explain this in python", "python explanation", "explain python code")):
        known_task = "code_explain"
    elif any(k in lowered for k in ("python code", "give me python code", "give me code", "write a python program", "write a program", "python script", "program to", "code for this", "generate python", "generate code to", "show python code")):
        known_task = "code_gen"
    elif any(k in lowered for k in ("email", "e-mail", "gmail", "send mail", "send this", "send the", "notify")):
        known_task = "email"
    elif explicit_file_context and any(k in lowered for k in ("explain this", "summarize", "read this", "describe this", "what is this", "what does this say", "look at this", "review this")):
        known_task = "vision_only"
    elif explicit_file_context and any(k in lowered for k in ("save in rag", "save it in rag", "store in rag", "store it in rag", "index this", "add to rag", "remember this")):
        known_task = "document_rag"
    elif "spreadsheet" in lowered or "excel" in lowered:
        known_task = "xlsx"
    elif (
        not any(word in lowered for word in ("compare", "differences", "deviations", "calculate", "unusual"))
        and (
        (any(word in lowered for word in ("create", "generate", "make", "prepare"))
         and any(word in lowered for word in ("slide", "presentation", "ppt")))
        or "slides for" in lowered
        )
    ):
        known_task = "pptx"
    elif explicit_file_context and has_file:
        known_task = "vision_ocr"
    elif any(k in lowered for k in ("search sop", "find the sop", "search our procedures", "what does our sop say", "search procedure")):
        known_task = "rag_search"
    elif any(term in lowered for term in ("safety", "inspection", "leave policy", "procurement", "maintenance", "sop", "procedure", "policy")) and any(
        marker in lowered for marker in ("what", "when", "how", "which", "requirement", "process", "policy")
    ):
        known_task = "rag_search"

    needs_rag = known_task in {"approval_note", "rag_search"} or any(k in lowered for k in ("sop", "procedure", "maintenance"))
    needs_code = known_task in {"code_exec", "code_gen", "code_explain"}
    needs_vision = (
        explicit_file_context
        and file_type != ".txt"
        and known_task in (None, "vision_ocr", "vision_only", "document_rag", "approval_note")
    ) or (
        known_task == "word_gen"
        and explicit_file_context
        and any(marker in lowered for marker in ("pdf", "scanned", "scan"))
    )
    needs_tools = known_task is not None or needs_rag
    complexity = "high" if known_task in ("approval_note", "code_exec", "word_gen", "xlsx", "pptx", "document_rag") else "low"
    if needs_vision:
        primary_model = pick_model("vision")
    elif needs_code:
        primary_model = pick_model("code")
    else:
        primary_model = pick_model("chat")
    return {
        "task_type": known_task or task_type,
        "primary_model": primary_model,
        "needs_vision": needs_vision,
        "needs_code": needs_code,
        "needs_rag": needs_rag,
        "needs_tools": needs_tools,
        "complexity": complexity,
        "file_type": file_type,
    }


def required_servers(route: dict) -> list[str]:
    """Select only MCP servers needed by the planned workflow."""
    task = route.get("task_type")
    file_type = route.get("file_type")
    if task == "word_gen":
        return ["vision", "docgen"] if route.get("needs_vision") else ["docgen"]
    if task == "chat":
        return []
    if task in {"code_gen", "code_explain"}:
        return []
    if task == "code_exec":
        return ["code_exec"]
    if file_type in {".docx", ".xlsx", ".pptx"}:
        server = {".docx": "docgen", ".xlsx": "xlsx", ".pptx": "pptx"}[file_type]
        base = [server]
        # A file attachment must include the matching reader even when the task is
        # conversational (for example: 'summarize this' on a DOCX/PPTX/XLSX).
        if task in {"vision_only", "document_rag", "vision_ocr", "document_text"}:
            base.append("vision")
        if task not in {"vision_only", "document_rag", "vision_ocr", "document_text"}:
            base.append("rag")
        return list(dict.fromkeys(base))
    mapping = {
        "approval_note": ["vision", "rag", "docgen"],
        "word_gen": ["docgen"],
        "code_gen": [],
        "code_explain": [],
        "code_exec": ["code_exec"],
        "email": ["email"],
        "xlsx": ["xlsx"],
        "pptx": ["pptx"],
        "vision_only": ["vision"],
        "vision_ocr": ["vision", "rag"],
        "document_rag": ["vision", "rag"],
        "document_text": ["vision"],
        "rag_search": ["rag"],
    }
    if task in mapping:
        return mapping[task]
    return ["rag", "vision", "docgen", "xlsx", "pptx", "code_exec", "email"]


if __name__ == "__main__":
    tests = [
        ("explain what transformers are", "chat"),
        ("write a python function to sort a list", "code"),
        ("describe this P&ID diagram", "vision"),
        ("hello there", "chat"),
    ]
    for msg, expected in tests:
        result = classify_task(msg)
        status = "OK" if result == expected else "FAIL"
        print(f"{status} {msg!r} -> {result} (expected {expected})")
