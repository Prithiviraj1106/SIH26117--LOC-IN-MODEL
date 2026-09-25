from orchestrator import decide_execution
from router import route_request


def test_python_followup_ignores_stale_excel_context():
    route = route_request("Give me Python code for this", has_file=True, file_type=".xlsx")
    assert route["task_type"] == "code_gen"
    decision = decide_execution("Give me Python code for this", "/tmp/example.xlsx")
    assert decision["workflow"] == "code_gen"


def test_simple_chat_starts_no_mcp_servers():
    route = route_request("hi")
    assert route["task_type"] == "chat"
    assert route["needs_tools"] is False
    from router import required_servers
    assert required_servers(route) == []


def test_generic_question_uses_current_attached_file_context():
    route = route_request("What is the expiry date?", has_file=True, file_type=".pdf")
    assert route["task_type"] == "vision_ocr"
    assert route["needs_vision"] is True


def test_code_request_remains_code_generation_with_attachment():
    route = route_request("Give me code for hello world", has_file=True, file_type=".pdf")
    assert route["task_type"] == "code_gen"


def test_word_followup_ignores_stale_excel_context():
    route = route_request("Create a Word document using this summary", has_file=True, file_type=".xlsx")
    assert route["task_type"] == "word_gen"
    decision = decide_execution("Create a Word document using this summary", "/tmp/example.xlsx")
    assert decision["workflow"] == "word_gen"


def test_new_chat_without_file_uses_current_request_only():
    route = route_request("Write a program to parse a CSV file", has_file=False)
    assert route["task_type"] == "code_gen"


def test_word_generation_requests_are_not_extraction():
    route = route_request("Create a Word document using this summary", has_file=True, file_type=".xlsx")
    assert route["task_type"] == "word_gen"
    decision = decide_execution("Create a Word document using this summary", "/tmp/example.xlsx")
    assert decision["workflow"] == "word_gen"


def test_python_generation_is_separate_from_execution():
    route = route_request("Give me Python code for this", has_file=True, file_type=".xlsx")
    assert route["task_type"] == "code_gen"
    decision = decide_execution("Execute this Python code", "/tmp/example.xlsx")
    assert decision["workflow"] == "code_exec"
