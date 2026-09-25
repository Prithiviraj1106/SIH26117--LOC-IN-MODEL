"""Small, conservative memory for successfully learned task patterns."""

import json
import re
from pathlib import Path


class WorkflowMemory:
    STOP_WORDS = {"the", "this", "that", "these", "those", "from", "with", "and", "for", "can", "you"}

    def __init__(self, path: str | Path | None = None):
        self.path = Path(path or Path(__file__).with_name("workflow_memory.json"))
        self.records = self._load()

    @staticmethod
    def _tokens(text: str) -> set[str]:
        return {
            token for token in re.findall(r"[a-z0-9]+", text.lower())
            if len(token) > 2 and token not in WorkflowMemory.STOP_WORDS
        }

    def _load(self) -> list[dict]:
        if not self.path.exists():
            return []
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []

    def match(self, request: str, threshold: float = 0.9) -> tuple[dict | None, float]:
        request_tokens = self._tokens(request)
        best, best_score = None, 0.0
        for record in self.records:
            pattern_tokens = self._tokens(record.get("task_pattern", ""))
            if not pattern_tokens:
                continue
            score = len(request_tokens & pattern_tokens) / len(request_tokens | pattern_tokens)
            if score > best_score:
                best, best_score = record, score
        return (best, best_score) if best_score >= threshold else (None, best_score)

    def save(self, task_pattern: str, workflow: list[str], confidence: float = 1.0,
             workflow_name: str | None = None) -> bool:
        if not task_pattern or not workflow or confidence < 0.9:
            return False
        self.records = [record for record in self.records if record.get("task_pattern") != task_pattern]
        record = {
            "task_pattern": task_pattern,
            "workflow": workflow,
            "confidence": confidence,
        }
        if workflow_name:
            record["workflow_name"] = workflow_name
        self.records.append(record)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.records, indent=2), encoding="utf-8")
        return True