"""
File Storage layer: Sole module responsible for file persistence in AI MemoVault.
Persists Users and Memories in pipe-delimited text files (.csv).
Implements thread safety with threading.Lock and atomic temp-file replace.
"""

import logging
import os
import tempfile
import threading
from pathlib import Path
from typing import Optional

from app.config import DATA_DIR, USERS_FILE, MEMORIES_FILE
from app.models.user import User
from app.models.memory import Memory

logger = logging.getLogger("memovault.storage")


class FileStorage:
    """
    Handles read/write operations for users.csv and memories.csv.
    Strict pipe escaping: '|' is replaced with '&pipe;' on write, restored on read.
    Newlines are replaced with single spaces.
    Corrupt lines are skipped with warnings and never crash the server.
    """

    def __init__(
        self,
        users_file: Path = USERS_FILE,
        memories_file: Path = MEMORIES_FILE,
    ) -> None:
        self.users_file: Path = users_file
        self.memories_file: Path = memories_file
        self._lock: threading.Lock = threading.Lock()
        self.warnings: list[str] = []
        self._ensure_files()

    def _ensure_files(self) -> None:
        """Ensures data directory and data files exist; creates them if missing."""
        self.users_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.users_file.exists():
            self.users_file.touch()
        if not self.memories_file.exists():
            self.memories_file.touch()

    @staticmethod
    def _escape(text: str) -> str:
        """Replaces pipe characters and flattens newlines to a single space."""
        if not text:
            return ""
        flattened = text.replace("\r\n", " ").replace("\r", " ").replace("\n", " ")
        return flattened.replace("|", "&pipe;")

    @staticmethod
    def _unescape(text: str) -> str:
        """Restores escaped pipe characters."""
        if not text:
            return ""
        return text.replace("&pipe;", "|")

    # ==========================
    # USER STORAGE
    # ==========================

    def load_users(self) -> list[User]:
        """Loads users from users.csv. Skips corrupt lines with warning."""
        users: list[User] = []
        if not self.users_file.exists():
            return users

        with open(self.users_file, "r", encoding="utf-8") as f:
            for line_no, raw_line in enumerate(f, start=1):
                line = raw_line.rstrip("\r\n")
                if not line.strip():
                    continue
                try:
                    parts = line.split("|")
                    if len(parts) < 4:
                        msg = f"Corrupt user record at line {line_no}: expected 4 fields, found {len(parts)}"
                        logger.warning(msg)
                        self.warnings.append(msg)
                        continue
                    user_id, username, password_hash, salt = parts[0], parts[1], parts[2], parts[3]
                    users.append(
                        User(
                            user_id=self._unescape(user_id),
                            username=self._unescape(username),
                            password_hash_base64=password_hash,
                            salt_base64=salt,
                        )
                    )
                except Exception as e:
                    msg = f"Failed to parse user line {line_no}: {str(e)}"
                    logger.warning(msg)
                    self.warnings.append(msg)
                    continue
        return users

    def save_user(self, user: User) -> None:
        """Appends a new user line to users.csv under thread lock."""
        line = f"{self._escape(user.user_id)}|{self._escape(user.username)}|{user.password_hash_base64}|{user.salt_base64}\n"
        with self._lock:
            with open(self.users_file, "a", encoding="utf-8") as f:
                f.write(line)

    def get_next_user_id(self) -> str:
        """Generates next sequential user ID (e.g. U001, U002)."""
        users = self.load_users()
        max_num = 0
        for u in users:
            if u.user_id.startswith("U"):
                try:
                    num = int(u.user_id[1:])
                    if num > max_num:
                        max_num = num
                except ValueError:
                    pass
        return f"U{max_num + 1:03d}"

    # ==========================
    # MEMORY STORAGE
    # ==========================

    def load_memories(self) -> list[Memory]:
        """
        Loads memories from memories.csv.
        Returns parsed list sorted with newest-first ordering.
        Skips corrupt lines with warning.
        """
        memories: list[Memory] = []
        if not self.memories_file.exists():
            return memories

        with open(self.memories_file, "r", encoding="utf-8") as f:
            for line_no, raw_line in enumerate(f, start=1):
                line = raw_line.rstrip("\r\n")
                if not line.strip():
                    continue
                try:
                    parts = line.split("|", 6)
                    if len(parts) < 7:
                        msg = f"Corrupt memory record at line {line_no}: expected 7 fields, found {len(parts)}"
                        logger.warning(msg)
                        self.warnings.append(msg)
                        continue
                    memory_id = self._unescape(parts[0])
                    owner_id = self._unescape(parts[1])
                    title = self._unescape(parts[2])
                    category = parts[3].upper()
                    date_val = parts[4]
                    description = self._unescape(parts[5])
                    kw_str = parts[6]
                    keywords = [k.strip() for k in kw_str.split(",") if k.strip()] if kw_str else []

                    memories.append(
                        Memory(
                            memory_id=memory_id,
                            owner_id=owner_id,
                            title=title,
                            category=category,
                            date=date_val,
                            description=description,
                            keywords=keywords,
                        )
                    )
                except Exception as e:
                    msg = f"Failed to parse memory line {line_no}: {str(e)}"
                    logger.warning(msg)
                    self.warnings.append(msg)
                    continue

        memories.sort()
        return memories

    def append_memory(self, memory: Memory) -> None:
        """Appends a new memory to memories.csv under thread lock."""
        kw_str = ",".join(memory.keywords)
        line = (
            f"{self._escape(memory.memory_id)}|"
            f"{self._escape(memory.owner_id)}|"
            f"{self._escape(memory.title)}|"
            f"{memory.category}|"
            f"{memory.date}|"
            f"{self._escape(memory.description)}|"
            f"{kw_str}\n"
        )
        with self._lock:
            with open(self.memories_file, "a", encoding="utf-8") as f:
                f.write(line)

    def rewrite_memories(self, memories: list[Memory]) -> None:
        """
        Rewrites memories.csv atomically via a temporary file.
        Used by update and delete operations to prevent corrupting state.
        """
        parent_dir = self.memories_file.parent
        with self._lock:
            with tempfile.NamedTemporaryFile("w", dir=parent_dir, delete=False, encoding="utf-8") as tmp:
                for m in memories:
                    kw_str = ",".join(m.keywords)
                    line = (
                        f"{self._escape(m.memory_id)}|"
                        f"{self._escape(m.owner_id)}|"
                        f"{self._escape(m.title)}|"
                        f"{m.category}|"
                        f"{m.date}|"
                        f"{self._escape(m.description)}|"
                        f"{kw_str}\n"
                    )
                    tmp.write(line)
                tmp_path = Path(tmp.name)
            os.replace(tmp_path, self.memories_file)

    def get_next_memory_id(self) -> str:
        """Generates next sequential memory ID (e.g. M001, M002, M007)."""
        memories = self.load_memories()
        max_num = 0
        for m in memories:
            if m.memory_id.startswith("M"):
                try:
                    num = int(m.memory_id[1:])
                    if num > max_num:
                        max_num = num
                except ValueError:
                    pass
        return f"M{max_num + 1:03d}"
