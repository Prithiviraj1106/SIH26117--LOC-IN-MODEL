import asyncio
from zipfile import ZipFile

import orchestrator
from orchestrator import flow_code_exec, flow_code_explain, flow_code_gen, flow_word_gen
from router import required_servers, route_request


class FakeManager:
    def __init__(self, results=None):
        self.results = results or {}
        self.calls = []

    async def call_tool(self, name, args):
        self.calls.append((name, args))
        result = self.results.get(name, "")
        return result(args) if callable(result) else result


def _valid_artifact(tmp_path, extension=".docx"):
    path = tmp_path / f"generated{extension}"
    with ZipFile(path, "w") as archive:
        archive.writestr("content.xml", "valid")
    return str(path)


def test_multiplication_tables_request_variants_match_deterministic_generation():
    assert orchestrator._is_multiplication_tables_request(
        "Create a Word document containing multiplication tables from 1 to 10."
    )
    assert orchestrator._is_multiplication_tables_request(
        "Create a Word document containing multiplication tables 1 to 10."
    )
    assert orchestrator._is_multiplication_tables_request(
        "Create a Word document containing multiplication tables 1 through 10."
    )
    assert not orchestrator._is_multiplication_tables_request("Create a Word document about Docker.")


def test_word_summary_routes_only_to_docgen():
    route = route_request("Create a Word document using this summary", True, ".xlsx")
    assert route["task_type"] == "word_gen"
    assert required_servers(route) == ["docgen"]


def test_prime_numbers_in_doc_routes_to_word_generation():
    route = route_request("can you give all prime numbers from 1 to 200 in doc")
    assert route["task_type"] == "word_gen"
    assert required_servers(route) == ["docgen"]


def test_unrelated_chat_with_document_phrase_does_not_route_to_word_generation():
    route = route_request("What is in a document?")
    assert route["task_type"] == "chat"


def test_scanned_pdf_to_word_loads_reader_and_docgen():
    route = route_request("Convert this scanned PDF into a Word document", True, ".pdf")
    assert route["task_type"] == "word_gen"
    assert required_servers(route) == ["vision", "docgen"]


def test_document_file_request_routes_to_word_generation():
    route = route_request("create the content as a document file", True, ".pdf")
    assert route["task_type"] == "word_gen"


def test_word_file_and_conversion_wording_routes_to_word_generation():
    for message in (
        "Give me a downloadable Word file",
        "Give me a downloadable Word document",
        "Create a downloadable Word file",
        "Create a downloadable Word document",
        "Give me a Word file",
        "Give me a Word document",
        "Create a Word file",
        "Create a Word document",
        "Convert this PDF to Word",
        "Convert this PDF to a Word file",
        "Convert this PDF to a Word document",
        "Convert the PDF into a Word file",
        "Convert the PDF into a Word document",
    ):
        route = route_request(message, True, ".pdf")
        assert route["task_type"] == "word_gen", message


def test_word_questions_and_other_routes_remain_unchanged():
    assert route_request("Hello, what can you do?")["task_type"] == "chat"
    assert route_request("What is a Word document?")["task_type"] == "chat"
    assert route_request("Write a Python program to calculate factorial")["task_type"] == "code_gen"
    assert route_request("Generate Excel")["task_type"] == "xlsx"
    assert route_request("Summarize the PDF", True, ".pdf")["task_type"] == "vision_only"
    assert route_request("Extract all text", True, ".pdf")["task_type"] == "vision_ocr"


def test_ordinary_document_question_does_not_route_to_word_generation():
    route = route_request("What does this document say?", True, ".pdf")
    assert route["task_type"] != "word_gen"


def test_summary_only_request_stays_on_vision_workflow():
    route = route_request("summarize the PDF", True, ".pdf")
    assert route["task_type"] == "vision_only"


def test_summary_document_requests_route_to_word_generation():
    for message in (
        "summarize the PDF and make it a document",
        "summarize the PDF file and then make it as a document",
        "summarize this PDF and create a Word document",
        "summarize the PDF and save the summary as a Word document",
        "create a document from the summary",
    ):
        route = route_request(message, True, ".pdf")
        assert route["task_type"] == "word_gen", message


def test_excel_summary_is_not_xlsx_generation():
    route = route_request("Summarize the Excel file only", True, ".xlsx")
    assert route["task_type"] == "vision_only"


def test_word_flow_passes_latest_assistant_summary_and_validates_artifact(tmp_path):
    artifact = _valid_artifact(tmp_path)
    manager = FakeManager({"generate_docx": artifact})
    history = [
        {"role": "user", "content": "Summarize this Excel file"},
        {"role": "assistant", "content": "SUMMARY: totals are 42"},
    ]

    result = asyncio.run(flow_word_gen("Create a Word document using this summary", None, manager, history))

    assert result == f"Word document generated and saved: {artifact}"
    assert manager.calls == [("generate_docx", {"title": "Summary", "content": "SUMMARY: totals are 42"})]


def test_word_flow_converts_scanned_pdf_content(tmp_path):
    artifact = _valid_artifact(tmp_path)
    manager = FakeManager({"extract_from_document": "OCR SUMMARY", "generate_docx": artifact})

    result = asyncio.run(flow_word_gen(
        "Convert this scanned PDF into a Word document",
        str(tmp_path / "scan.pdf"),
        manager,
    ))

    assert result.endswith(artifact)
    assert manager.calls[0] == ("extract_from_document", {"file_path": str(tmp_path / "scan.pdf")})
    assert manager.calls[1][0] == "generate_docx"
    assert manager.calls[1][1]["content"]["blocks"] == [{"type": "heading", "text": "OCR SUMMARY"}]


def test_word_flow_rejects_missing_content():
    manager = FakeManager()
    result = asyncio.run(flow_word_gen("Generate a Word report from the summary", None, manager, []))
    assert result.startswith("Error: no valid document content")
    assert manager.calls == []


def test_code_generation_does_not_execute(monkeypatch):
    async def fake_chat(*args, **kwargs):
        return "print(42)"

    monkeypatch.setattr(orchestrator, "chat_llm", fake_chat)
    monkeypatch.setattr(orchestrator, "make_llm", lambda *_args: object())
    manager = FakeManager()

    result = asyncio.run(flow_code_gen("Generate Python code from this summary", manager, []))

    assert result == "print(42)"
    assert manager.calls == []


def test_code_explanation_does_not_execute(monkeypatch):
    async def fake_chat(*args, **kwargs):
        return "This loops over the rows."

    monkeypatch.setattr(orchestrator, "chat_llm", fake_chat)
    monkeypatch.setattr(orchestrator, "make_llm", lambda *_args: object())
    manager = FakeManager()

    result = asyncio.run(flow_code_explain("Explain how to implement this in Python", manager, []))

    assert result == "This loops over the rows."
    assert manager.calls == []


def test_code_execution_requires_code_and_preserves_approval():
    missing_code_manager = FakeManager()
    missing = asyncio.run(flow_code_exec("Execute this Python code", missing_code_manager))
    assert missing.startswith("Error: no executable Python code")
    assert missing_code_manager.calls == []

    approval_manager = FakeManager({"run_code_sandboxed": "Approval required: Tool 'run_code_sandboxed' requires user approval."})
    blocked = asyncio.run(flow_code_exec("Execute this Python code:\nprint(42)", approval_manager))
    assert blocked.startswith("Approval required:")
    assert approval_manager.calls == [("run_code_sandboxed", {"code": "print(42)"})]


def test_sandbox_rejects_os_process_launches():
    from code_exec_mcp_server import run_code_sandboxed

    assert run_code_sandboxed("import os\nos.system('echo blocked')").startswith("Error:")