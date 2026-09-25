"""
vision_mcp_server.py — MCP server exposing document extraction via OCR + VLM.

Provides one tool: extract_from_document(file_path) -> str.

Tesseract OCR first; if result is under 20 chars, falls back to the
qwen2.5vl vision model for better understanding of scanned images.

When to call: When the orchestrator needs to read a scanned document,
P&ID image, or any visual content. Used by flow_vision_only() and
flow_approval_note() in orchestrator.py.
When NOT to call: Do not call for simple text queries — use RAG
search instead. Do not call when file_path is None or empty.
"""
import os
import json
import logging
import re
import shutil
from io import BytesIO
from pathlib import Path
from fastmcp import FastMCP, Context
from security import validate_upload

mcp = FastMCP("vision", instructions="OCR and vision understanding for scanned docs and images")
logger = logging.getLogger(__name__)
VLM_TIMEOUT_SECONDS = int(os.getenv("MRPL_VLM_TIMEOUT_SECONDS", "300"))
_vlm_max_pages_setting = os.getenv("MRPL_VLM_MAX_PAGES", "3").strip().lower()
VLM_MAX_PAGES = None if _vlm_max_pages_setting == "all" else int(_vlm_max_pages_setting)
TESSERACT_CMD = os.getenv("MRPL_TESSERACT_CMD", "").strip()

try:
    import pytesseract
    from PIL import Image
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False


def _tesseract_runtime_available() -> bool:
    if not TESSERACT_AVAILABLE:
        return False
    try:
        configured = Path(TESSERACT_CMD) if TESSERACT_CMD else None
        executable = str(configured) if configured and configured.is_file() else shutil.which("tesseract")
        if not executable:
            return False
        pytesseract.pytesseract.tesseract_cmd = executable
        return True
    except OSError:
        return False

try:
    from pypdf import PdfReader
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    import pymupdf as fitz
    PDF_RENDER_AVAILABLE = True
except ImportError:
    PDF_RENDER_AVAILABLE = False

try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False


def _ocr_extract(file_path: str) -> str:
    """Extract text from an image using Tesseract OCR."""
    if not _tesseract_runtime_available():
        logger.warning("[Vision] OCR unavailable: Tesseract executable is not installed or not on PATH")
        return ""
    try:
        if file_path.lower().endswith(".pdf"):
            if not PDF_RENDER_AVAILABLE:
                logger.warning("[Vision] PDF OCR skipped: local PDF renderer unavailable")
                return ""
            images = _render_pdf_pages(file_path)
            return "\n\n".join(
                (pytesseract.image_to_string(Image.open(BytesIO(image))) or "").strip()
                for image in images
            ).strip()
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img) or ""
        return text.strip()
    except Exception:
        logger.exception("[Vision] OCR failed")
        return ""


def _render_pdf_pages(file_path: str, scale: float = 1.5) -> list[bytes]:
    """Render local PDF pages to PNG bytes for OCR/VLM fallback."""
    if not PDF_RENDER_AVAILABLE:
        return []
    try:
        document = fitz.open(file_path)
        return [page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False).tobytes("png")
                for page in document]
    except Exception:
        logger.exception("[Vision] PDF page rendering failed")
        return []


def _pdf_extract(file_path: str) -> str:
    """Extract selectable text from a PDF before attempting image OCR."""
    if not PDF_AVAILABLE or not file_path.lower().endswith(".pdf"):
        return ""
    try:
        reader = PdfReader(file_path)
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
        text = "\n\n".join(page for page in pages if page)
        logger.info("[Vision] PDF text extraction: pages=%d chars=%d", len(pages), len(text))
        return text
    except Exception:
        logger.exception("[Vision] PDF could not be opened")
        return ""


def _text_extract(file_path: str) -> str:
    """Read an uploaded plain-text document without invoking vision."""
    if not file_path.lower().endswith(".txt"):
        return ""
    try:
        return Path(file_path).read_text(encoding="utf-8", errors="replace").strip()
    except OSError:
        return ""


def _ocr_text_is_usable(text: str) -> bool:
    normalized = " ".join((text or "").split())
    if len(normalized) < 20:
        return False
    alphanumeric = len(re.findall(r"[A-Za-z0-9]", normalized))
    return alphanumeric >= 12 and alphanumeric / len(normalized) >= 0.45


def _vlm_page_images(file_path: str) -> list[bytes]:
    images = _render_pdf_pages(file_path, scale=1.0)
    return images if VLM_MAX_PAGES is None else images[:VLM_MAX_PAGES]


def vlm_model_candidates(preferred: str | None = None) -> list[str]:
    """Prefer the configured vision model, then fall back to smaller local variants.

    Some Windows/Ollama builds fail to initialize the larger qwen2.5vl 7B model with
    a CUDA/shared-library error. Retrying a smaller model keeps the OCR/VLM path usable
    without crashing document extraction.
    """
    preferred = (preferred or os.getenv("MRPL_VLM_MODEL") or "qwen2.5vl:7b").strip()
    candidates = [preferred, "qwen2.5vl:3b", "llava:7b", "moondream"]
    seen = set()
    ordered: list[str] = []
    for model_name in candidates:
        if not model_name or model_name in seen:
            continue
        seen.add(model_name)
        ordered.append(model_name)
    return ordered


def _vlm_extract(file_path: str) -> str:
    """Fallback: use the local Ollama vision model to understand the image."""
    if not OLLAMA_AVAILABLE:
        return "VLM error: the Python Ollama client is not installed."
    try:
        import base64
        if file_path.lower().endswith(".pdf"):
            # Keep the VLM request bounded on local GPUs; selectable text and
            # OCR have already been attempted before reaching this fallback.
            images = _vlm_page_images(file_path)
            if not images:
                return "VLM error: PDF page rendering is unavailable or failed."
        else:
            images = [Path(file_path).read_bytes()]
        image_payloads = [base64.b64encode(image).decode() for image in images]
        config_path = Path(__file__).with_name("models_config.json")
        with config_path.open(encoding="utf-8") as config_file:
            model_config = json.load(config_file).get("models", {}).get("vision", {})
        preferred_model = model_config.get("name", "qwen2.5vl:7b")
        client = ollama.Client(timeout=VLM_TIMEOUT_SECONDS)
        last_error = None

        for model_name in vlm_model_candidates(preferred_model):
            try:
                response = client.chat(
                    model=model_name,
                    messages=[{
                        "role": "user",
                        "content": (
                            "Transcribe only the visible text in this document/image. "
                            "Preserve page order, headings, dates, numbers, and table rows. "
                            "Do not infer, summarize, or invent text that is not visible."
                        ),
                        "images": image_payloads
                    }],
                    options={"num_ctx": int(model_config.get("num_ctx", 8192))}
                )
                return response["message"]["content"]
            except Exception as exc:  # pragma: no cover - exercised by tests via the fallback path
                last_error = exc
                message = str(exc).lower()
                if (
                    "cuda" in message
                    or "shared object initialization failed" in message
                    or "stack-based buffer" in message
                    or "llama-server process has terminated" in message
                    or "model not found" in message
                    or "not found" in message
                ):
                    logger.warning("[Vision] VLM model %s failed; trying fallback model: %s", model_name, exc)
                    continue
                if isinstance(exc, TimeoutError) or "timeout" in type(exc).__name__.lower() or "timed out" in message:
                    logger.warning("[Vision] Timeout for %s; trying fallback model", model_name)
                    continue
                raise

        if last_error is not None:
            return f"VLM error: {last_error}"
        return "VLM error: no vision model could process the document."
    except Exception as e:
        if isinstance(e, TimeoutError) or "timeout" in type(e).__name__.lower() or "timed out" in str(e).lower():
            return (
                f"VLM error: vision model timed out after {VLM_TIMEOUT_SECONDS} seconds. "
                "Try a smaller image/PDF or set MRPL_VLM_TIMEOUT_SECONDS to a higher value."
            )
        return f"VLM error: {e}"


@mcp.tool()
def extract_from_document(file_path: str) -> str:
    """Extract text/information from a scanned document or image.
    
    Args:
        file_path: Path to the image/PDF file to extract from.
    
    Returns:
        Extracted text string. If OCR returns <20 chars, falls back
        to the qwen2.5vl vision model.
    
    When NOT to call: If file_path is None, empty, or does not exist
    on disk — return an error message instead of calling.
    NEVER call this for general conversation, greetings, or questions
    about how the system itself works."""
    if not file_path:
        return "Error: document file path is empty."
    upload_root = Path(__file__).with_name("sample_data_uploads").resolve()
    allowed = {".txt", ".pdf", ".png", ".jpg", ".jpeg", ".webp"}
    safe_path = validate_upload(file_path, upload_root, allowed)
    if not safe_path:
        return f"Error: document file does not exist or is unsupported: {file_path}"
    file_path = str(safe_path)
    logger.info("[Vision] Received file: type=%s size=%d", safe_path.suffix.lower(), safe_path.stat().st_size)

    text = _text_extract(file_path)
    if file_path.lower().endswith(".txt"):
        return text or f"Could not extract content from {file_path}"

    text = _pdf_extract(file_path) or ""
    if len(text) >= 20:
        logger.info("[Vision] Final source=pdf_text chars=%d", len(text))
        return text

    text = _ocr_extract(file_path) or ""
    logger.info("[Vision] OCR result chars=%d", len(text))
    if not _ocr_text_is_usable(text):
        text = _vlm_extract(file_path)
        if not text:
            return "Error: no readable content could be extracted from the document."
        logger.info("[Vision] Final source=qwen2.5vl chars=%d", len(text))

    return text


if __name__ == "__main__":
    import os as _os
    _os.environ["FASTMCP_TRANSPORT"] = "stdio"
    mcp.run(transport="stdio")
