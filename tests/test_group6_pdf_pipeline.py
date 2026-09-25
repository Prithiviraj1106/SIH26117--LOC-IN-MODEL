import asyncio
from pathlib import Path

import fitz
from PIL import Image, ImageDraw

import orchestrator
import vision_mcp_server as vision
from orchestrator import flow_word_gen


class FakeManager:
    def __init__(self, results=None):
        self.results = results or {}
        self.calls = []

    async def call_tool(self, name, args):
        self.calls.append((name, args))
        return self.results.get(name, "")


def _vision_answer_test(monkeypatch, path, question, extracted):
    manager = FakeManager({"extract_from_document": extracted})
    captured = {}

    async def fake_chat(_llm, messages):
        captured["messages"] = messages
        return "The certificate expires in 2030." if "expiry" in question.lower() else "The certificate was issued by MRPL."

    monkeypatch.setattr(orchestrator, "chat_llm", fake_chat)
    monkeypatch.setattr(orchestrator, "make_llm", lambda *_args: object())
    result = asyncio.run(orchestrator.flow_vision_only(
        question,
        path,
        manager,
        conversation_history=[
            {"role": "assistant", "content": "print('Hello World')"},
        ],
    ))
    return result, manager, captured


def _text_pdf(path: Path) -> None:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), "MRPL SYNTHETIC REPORT\nDate: 2026-09-21\nTotal: 42")
    document.save(str(path))
    document.close()


def _image_pdf(path: Path) -> None:
    image = Image.new("RGB", (1000, 700), "white")
    ImageDraw.Draw(image).text((50, 50), "SCANNED REPORT\nTOTAL: 42", fill="black")
    image_path = path.with_suffix(".png")
    image.save(image_path)
    document = fitz.open()
    page = document.new_page(width=1000, height=700)
    page.insert_image(page.rect, filename=str(image_path))
    document.save(str(path))
    document.close()


def test_native_pdf_text_is_used_before_ocr_or_vlm(tmp_path, monkeypatch):
    pdf_path = tmp_path / "text.pdf"
    _text_pdf(pdf_path)
    calls = []
    monkeypatch.setattr(vision, "validate_upload", lambda *_args: pdf_path)
    monkeypatch.setattr(vision, "_ocr_extract", lambda *_args: calls.append("ocr") or "OCR")
    monkeypatch.setattr(vision, "_vlm_extract", lambda *_args: calls.append("vlm") or "VLM")

    result = vision.extract_from_document(str(pdf_path))

    assert "MRPL SYNTHETIC REPORT" in result
    assert "Total: 42" in result
    assert calls == []


def test_scanned_pdf_uses_ocr_then_vlm_only_when_ocr_is_short(tmp_path, monkeypatch):
    pdf_path = tmp_path / "scan.pdf"
    _image_pdf(pdf_path)
    calls = []
    monkeypatch.setattr(vision, "validate_upload", lambda *_args: pdf_path)
    monkeypatch.setattr(vision, "_ocr_extract", lambda *_args: calls.append("ocr") or "short")
    monkeypatch.setattr(vision, "_vlm_extract", lambda *_args: calls.append("vlm") or "TRANSCRIBED TOTAL: 42")

    result = vision.extract_from_document(str(pdf_path))

    assert result == "TRANSCRIBED TOTAL: 42"
    assert calls == ["ocr", "vlm"]


def test_noisy_ocr_triggers_vlm_fallback_even_when_long(tmp_path, monkeypatch):
    pdf_path = tmp_path / "noisy-scan.pdf"
    _image_pdf(pdf_path)
    calls = []
    monkeypatch.setattr(vision, "validate_upload", lambda *_args: pdf_path)
    monkeypatch.setattr(vision, "_ocr_extract", lambda *_args: "!!!!!! 1234567890 ######## ???????")
    monkeypatch.setattr(vision, "_vlm_extract", lambda *_args: calls.append("vlm") or "FINDING: vibration high")

    result = vision.extract_from_document(str(pdf_path))

    assert result == "FINDING: vibration high"
    assert calls == ["vlm"]


def test_ocr_runtime_availability_is_distinguished_from_python_package(monkeypatch):
    monkeypatch.setattr(vision, "TESSERACT_AVAILABLE", True)
    monkeypatch.setattr(vision, "TESSERACT_CMD", "")
    monkeypatch.setattr(vision.shutil, "which", lambda _name: None)
    assert vision._tesseract_runtime_available() is False


def test_vlm_candidates_are_vision_models_only():
    candidates = vision.vlm_model_candidates("qwen2.5vl:7b")
    assert candidates[:2] == ["qwen2.5vl:7b", "qwen2.5vl:3b"]
    assert "qwen2.5:7b" not in candidates


def test_vlm_page_limit_respects_configured_value(monkeypatch):
    rendered = [b"page-1", b"page-2", b"page-3"]
    monkeypatch.setattr(vision, "_render_pdf_pages", lambda *_args, **_kwargs: rendered)
    monkeypatch.setattr(vision, "VLM_MAX_PAGES", 2)
    assert vision._vlm_page_images("scan.pdf") == rendered[:2]
    monkeypatch.setattr(vision, "VLM_MAX_PAGES", None)
    assert vision._vlm_page_images("scan.pdf") == rendered


def test_vlm_prompt_requires_literal_transcription(monkeypatch):
    captured = {}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def chat(self, **kwargs):
            captured["content"] = kwargs["messages"][0]["content"]
            return {"message": {"content": "visible text"}}

    monkeypatch.setattr(vision, "OLLAMA_AVAILABLE", True)
    monkeypatch.setattr(vision, "ollama", type("Ollama", (), {"Client": FakeClient}))
    monkeypatch.setattr(vision, "_render_pdf_pages", lambda *_args, **_kwargs: [b"image"])
    monkeypatch.setattr(vision, "vlm_model_candidates", lambda *_args: ["qwen2.5vl:7b"])

    result = vision._vlm_extract("synthetic.pdf")

    assert result == "visible text"
    assert "Transcribe only the visible text" in captured["content"]
    assert "Do not infer" in captured["content"]


def test_corrupted_pdf_returns_empty_extraction(tmp_path):
    pdf_path = tmp_path / "corrupt.pdf"
    pdf_path.write_bytes(b"not a PDF")
    assert vision._pdf_extract(str(pdf_path)) == ""
    assert vision._ocr_extract(str(pdf_path)) == ""


def test_empty_extraction_prevents_word_generation():
    manager = FakeManager()
    result = asyncio.run(flow_word_gen(
        "Convert this scanned PDF into a Word document",
        None,
        manager,
        [],
    ))
    assert result.startswith("Error: no valid document content")
    assert manager.calls == []


def test_image_question_uses_current_question_for_answer_generation(monkeypatch):
    result, manager, captured = _vision_answer_test(
        monkeypatch,
        "certificate.png",
        "What is the expiry date on this certificate?",
        "issuer = MRPL\nexpiry = 2030",
    )

    assert result == "The certificate expires in 2030."
    assert manager.calls == [("extract_from_document", {"file_path": "certificate.png"})]
    assert "What is the expiry date on this certificate?" in captured["messages"][0]["content"]
    assert "print('Hello World')" not in captured["messages"][0]["content"]
    assert result != "issuer = MRPL\nexpiry = 2030"


def test_image_follow_up_uses_second_question_without_previous_answer(monkeypatch):
    result, _manager, captured = _vision_answer_test(
        monkeypatch,
        "certificate.png",
        "Who issued this certificate?",
        "issuer = MRPL\nexpiry = 2030",
    )

    assert result == "The certificate was issued by MRPL."
    assert "Who issued this certificate?" in captured["messages"][0]["content"]
    assert "print('Hello World')" not in captured["messages"][0]["content"]


def test_explicit_image_extraction_skips_answer_generation(monkeypatch):
    manager = FakeManager({"extract_from_document": "issuer = MRPL\nexpiry = 2030"})
    async def unexpected_chat(*_args, **_kwargs):
        raise AssertionError("answer generation should not run for explicit extraction")

    monkeypatch.setattr(orchestrator, "chat_llm", unexpected_chat)
    result = asyncio.run(orchestrator.flow_vision_only(
        "Extract all text from this image",
        "certificate.png",
        manager,
    ))

    assert result == "issuer = MRPL\nexpiry = 2030"


def test_pdf_question_uses_answer_generation(monkeypatch):
    result, manager, captured = _vision_answer_test(
        monkeypatch,
        "certificate.pdf",
        "What is the expiry date?",
        "issuer = MRPL\nexpiry = 2030",
    )

    assert result == "The certificate expires in 2030."
    assert manager.calls == [("extract_from_document", {"file_path": "certificate.pdf"})]
    assert "What is the expiry date?" in captured["messages"][0]["content"]