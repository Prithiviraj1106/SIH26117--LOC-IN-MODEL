"""Execution state and safe trace records for one user task."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from time import perf_counter
from uuid import uuid4


@dataclass
class TaskState:
    user_request: str
    task_id: str = field(default_factory=lambda: str(uuid4()))
    intent: str = "unknown"
    execution_mode: str = "direct"
    workflow_name: str | None = None
    status: str = "running"
    plan: list[str] = field(default_factory=list)
    current_step: int = 0
    tool_calls: list[dict] = field(default_factory=list)
    artifacts: list[str] = field(default_factory=list)
    evidence: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    trace: list[str] = field(default_factory=list)
    final_result: str | None = None
    started_at: float = field(default_factory=perf_counter)
    total_seconds: float | None = None

    def event(self, message: str) -> None:
        stamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
        self.trace.append(f"[{stamp}] {message}")

    def record_tool(self, name: str, status: str) -> None:
        self.tool_calls.append({"name": name, "status": status})
        self.event(f"Tool {name}: {status}")

    def fail(self, error: str) -> None:
        self.errors.append(error)
        self.status = "failed"
        self.event(f"Task failed: {error}")

    def complete(self, result: str) -> None:
        self.final_result = result
        self.status = "completed"
        self.total_seconds = perf_counter() - self.started_at
        self.event("Task completed")
        self.event(f"Total execution time: {self.total_seconds:.2f}s")

    def set_execution(self, mode: str, workflow_name: str | None = None) -> None:
        self.execution_mode = mode
        self.workflow_name = workflow_name
        label = mode.upper()
        self.event(f"Execution mode: {label}")
        if workflow_name:
            self.event(f"Workflow: {workflow_name}")