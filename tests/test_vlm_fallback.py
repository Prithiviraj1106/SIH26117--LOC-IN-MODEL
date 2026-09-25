import types

import vision_mcp_server as vision


def test_vlm_model_candidates_prefer_smallest_working_model():
    candidates = vision.vlm_model_candidates("qwen2.5vl:7b")
    assert candidates[0] == "qwen2.5vl:7b"
    assert "qwen2.5vl:3b" in candidates


def test_vlm_cuda_error_triggers_fallback(monkeypatch):
    calls = []

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def chat(self, model, messages, options=None):
            calls.append(model)
            if model == "qwen2.5vl:7b":
                raise RuntimeError("CUDA error: shared object initialization failed")
            return {"message": {"content": "fallback ok"}}

    monkeypatch.setattr(vision, "OLLAMA_AVAILABLE", True)
    monkeypatch.setattr(vision, "_render_pdf_pages", lambda *args, **kwargs: [b"img"])
    monkeypatch.setattr(vision.ollama, "Client", FakeClient)

    result = vision._vlm_extract("demo.pdf")
    assert result == "fallback ok"
    assert calls == ["qwen2.5vl:7b", "qwen2.5vl:3b"]
