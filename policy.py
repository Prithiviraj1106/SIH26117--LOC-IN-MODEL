"""Deterministic policy checks applied before every tool call."""

from dataclasses import dataclass


SENSITIVE_TOOLS = {
    "send_email",
    "run_code_sandboxed",
    "generate_docx",
    "generate_xlsx",
    "generate_pptx",
}


@dataclass(frozen=True)
class PolicyDecision:
    action: str
    reason: str


def check_tool_policy(tool_name: str, approved_actions: set[str] | None = None) -> PolicyDecision:
    approved = approved_actions or set()
    if tool_name in SENSITIVE_TOOLS and tool_name not in approved:
        return PolicyDecision("REQUIRE_APPROVAL", f"Tool '{tool_name}' requires user approval.")
    return PolicyDecision("ALLOW", "Read-only or approved operation.")