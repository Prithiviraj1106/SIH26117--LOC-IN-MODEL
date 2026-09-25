"""Persistent chat history backed by SQLite."""

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


DEFAULT_DB_PATH = Path(__file__).with_name("chat_memory.db")


class ChatStore:
    """Store conversations and messages; ChromaDB remains document memory."""

    def __init__(self, db_path: str | Path = DEFAULT_DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self.db_path))
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    chat_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    owner_id TEXT NOT NULL DEFAULT 'legacy',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chat_id TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(chat_id) REFERENCES conversations(chat_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL,
                    category TEXT NOT NULL DEFAULT 'general',
                    source TEXT NOT NULL DEFAULT 'auto',
                    owner_id TEXT NOT NULL DEFAULT 'legacy',
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
                CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
                CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
                """
            )
            self._add_column_if_missing(connection, "conversations", "owner_id", "TEXT NOT NULL DEFAULT 'legacy'")
            self._add_column_if_missing(connection, "memories", "owner_id", "TEXT NOT NULL DEFAULT 'legacy'")
            connection.execute("CREATE INDEX IF NOT EXISTS idx_conversations_owner_id ON conversations(owner_id)")
            connection.execute("CREATE INDEX IF NOT EXISTS idx_memories_owner_id ON memories(owner_id)")

    @staticmethod
    def _add_column_if_missing(connection: sqlite3.Connection, table: str, column: str, definition: str) -> None:
        columns = {row[1] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
        if column not in columns:
            connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat(timespec="seconds")

    @staticmethod
    def _title_from_message(content: str) -> str:
        title = " ".join((content or "").strip().split())
        return (title[:57] + "...") if len(title) > 60 else (title or "New chat")

    @staticmethod
    def _normalize_text(value: str) -> str:
        return " ".join((value or "").strip().split())

    @staticmethod
    def _tokenize(value: str) -> set[str]:
        return {token for token in re.findall(r"[a-z0-9]+", (value or "").lower()) if len(token) > 2}

    def _extract_durable_facts(self, content: str) -> list[str]:
        text = self._normalize_text(content)
        if not text:
            return []
        lowered = text.lower()
        facts = []
        phrases = [
            "i work at", "i work in", "i prefer", "my name is", "i am", "i live in",
            "my team is", "i handle", "i manage", "i am based in", "i report to",
            "i often", "i usually"
        ]
        for phrase in phrases:
            if phrase in lowered:
                facts.append(text)
                break
        if any(lowered.startswith(prefix) for prefix in ("i work", "i prefer", "my name is", "i am", "i live", "my team", "i handle", "i manage")):
            facts.append(text)
        deduped = []
        seen = set()
        for fact in facts:
            clean = self._normalize_text(fact)
            if clean and clean.lower() not in seen:
                seen.add(clean.lower())
                deduped.append(clean)
        return deduped

    def create_chat(self, title: str = "New chat", owner_id: str = "legacy") -> str:
        chat_id = str(uuid4())
        now = self._now()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO conversations(chat_id, title, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (chat_id, title or "New chat", owner_id, now, now),
            )
        return chat_id

    def list_chats(self, owner_id: str = "legacy") -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT chat_id, title, created_at, updated_at FROM conversations "
                "WHERE owner_id = ? ORDER BY updated_at DESC",
                (owner_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_messages(self, chat_id: str, owner_id: str = "legacy") -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT role, content, created_at FROM messages "
                "WHERE chat_id = ? AND EXISTS "
                "(SELECT 1 FROM conversations WHERE conversations.chat_id = messages.chat_id AND owner_id = ?) "
                "ORDER BY id ASC",
                (chat_id, owner_id),
            ).fetchall()
        return [{"role": row["role"], "content": row["content"]} for row in rows]

    def add_message(self, chat_id: str, role: str, content: str, owner_id: str = "legacy") -> None:
        if role not in {"user", "assistant", "system"}:
            raise ValueError(f"Unsupported chat role: {role}")
        now = self._now()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO messages(chat_id, role, content, created_at) "
                "SELECT ?, ?, ?, ? WHERE EXISTS "
                "(SELECT 1 FROM conversations WHERE chat_id = ? AND owner_id = ?)",
                (chat_id, role, content or "", now, chat_id, owner_id),
            )
            if connection.total_changes == 0:
                raise PermissionError("Chat is not accessible")
            if role == "user":
                current = connection.execute(
                        "SELECT title FROM conversations WHERE chat_id = ? AND owner_id = ?", (chat_id, owner_id)
                ).fetchone()
                if current and current["title"] == "New chat":
                    connection.execute(
                        "UPDATE conversations SET title = ? WHERE chat_id = ? AND owner_id = ?",
                        (self._title_from_message(content), chat_id, owner_id),
                    )
                for fact in self._extract_durable_facts(content):
                    existing = connection.execute(
                        "SELECT 1 FROM memories WHERE content = ? AND owner_id = ? LIMIT 1",
                        (fact, owner_id),
                    ).fetchone()
                    if existing is None:
                        connection.execute(
                            "INSERT INTO memories(content, category, source, owner_id, created_at) VALUES (?, ?, ?, ?, ?)",
                            (fact, "personal", "auto", owner_id, now),
                        )
            connection.execute(
                "UPDATE conversations SET updated_at = ? WHERE chat_id = ? AND owner_id = ?",
                (now, chat_id, owner_id),
            )

    def rename_chat(self, chat_id: str, title: str, owner_id: str = "legacy") -> None:
        clean_title = " ".join((title or "").strip().split()) or "New chat"
        with self._connect() as connection:
            connection.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE chat_id = ? AND owner_id = ?",
                (clean_title[:120], self._now(), chat_id, owner_id),
            )

    def delete_chat(self, chat_id: str, owner_id: str = "legacy") -> None:
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM messages WHERE chat_id = ? AND EXISTS "
                "(SELECT 1 FROM conversations WHERE conversations.chat_id = messages.chat_id AND owner_id = ?)",
                (chat_id, owner_id),
            )
            connection.execute("DELETE FROM conversations WHERE chat_id = ? AND owner_id = ?", (chat_id, owner_id))

    def list_memories(self, owner_id: str = "legacy") -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id, content, category, source, created_at FROM memories "
                "WHERE owner_id = ? ORDER BY created_at DESC",
                (owner_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def add_memory(self, content: str, category: str = "general", source: str = "auto", owner_id: str = "legacy") -> int | None:
        clean = self._normalize_text(content)
        if not clean:
            return None
        with self._connect() as connection:
            cursor = connection.execute(
                "INSERT INTO memories(content, category, source, owner_id, created_at) VALUES (?, ?, ?, ?, ?)",
                (clean, category, source, owner_id, self._now()),
            )
            return int(cursor.lastrowid)

    def delete_memory(self, memory_id: int, owner_id: str = "legacy") -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM memories WHERE id = ? AND owner_id = ?", (memory_id, owner_id))

    def recall_relevant_memories(self, query: str, limit: int = 3, owner_id: str = "legacy") -> list[dict]:
        clean_query = self._normalize_text(query)
        if not clean_query:
            return []
        query_tokens = self._tokenize(clean_query)
        if not query_tokens:
            return []
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id, content, category, source, created_at FROM memories "
                "WHERE owner_id = ? ORDER BY created_at DESC",
                (owner_id,),
            ).fetchall()
        scored = []
        for row in rows:
            content = row["content"]
            tokens = self._tokenize(content)
            overlap = len(query_tokens & tokens)
            if overlap == 0:
                continue
            score = overlap + (1 if any(token in content.lower() for token in query_tokens) else 0)
            scored.append((score, row))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [dict(row) for _, row in scored[:limit]]

    async def auto_save_if_relevant(self, messages: list[dict], llm=None, owner_id: str = "legacy") -> list[str]:
        if not messages:
            return []
        recent = [m for m in messages if m.get("role") == "user"]
        if not recent:
            return []
        candidate = self._normalize_text(recent[-1].get("content", ""))
        if len(candidate.split()) < 6:
            return []
        facts = self._extract_durable_facts(candidate)
        if llm is None:
            saved = []
            for fact in facts:
                if not any(existing["content"] == fact for existing in self.list_memories(owner_id)): 
                    self.add_memory(fact, category="personal", source="auto", owner_id=owner_id)
                    saved.append(fact)
            return saved
        prompt = (
            "Extract only durable personal/work facts from the latest user message. "
            "Ignore trivial greetings and temporary tasks. Return valid JSON: {\"facts\": [\"fact 1\", \"fact 2\"]}. "
            "If there are no durable facts, return {\"facts\": []}.\n\n"
            f"Conversation context:\n{json.dumps(messages[-6:], ensure_ascii=False)}"
        )
        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        try:
            payload = json.loads(response.content)
            facts = payload.get("facts", []) if isinstance(payload, dict) else []
        except (TypeError, json.JSONDecodeError):
            facts = []
        saved = []
        for fact in facts:
            clean = self._normalize_text(str(fact))
            if clean and not any(existing["content"] == clean for existing in self.list_memories(owner_id)):
                self.add_memory(clean, category="personal", source="auto", owner_id=owner_id)
                saved.append(clean)
        return saved

    def chat_exists(self, chat_id: str) -> bool:
        with self._connect() as connection:
            return connection.execute(
                "SELECT 1 FROM conversations WHERE chat_id = ?", (chat_id,)
            ).fetchone() is not None
