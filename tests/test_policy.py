import os

from policy import check_tool_policy


def test_sensitive_tool_requires_approval_by_default(monkeypatch):
    monkeypatch.delenv("MRPL_LOCAL_DEMO_MODE", raising=False)
    decision = check_tool_policy("send_email")
    assert decision.action == "REQUIRE_APPROVAL"


def test_sensitive_tool_remains_gated_in_local_demo_mode(monkeypatch):
    monkeypatch.setenv("MRPL_LOCAL_DEMO_MODE", "true")
    decision = check_tool_policy("send_email")
    assert decision.action == "REQUIRE_APPROVAL"


def test_sensitive_tool_is_allowed_when_explicitly_approved(monkeypatch):
    monkeypatch.delenv("MRPL_LOCAL_DEMO_MODE", raising=False)
    decision = check_tool_policy("send_email", {"send_email"})
    assert decision.action == "ALLOW"
