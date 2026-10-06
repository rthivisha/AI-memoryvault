"""
Migration script: Imports legacy users.csv and memories.csv into SQLite memovault.db.
Handles &pipe; unescaping and skips corrupt lines with a comprehensive warning report.
Can be executed via CLI: python3 backend/scripts/migrate_csv_to_db.py
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# Setup sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.config import USERS_FILE, MEMORIES_FILE, DATA_DIR
from app.storage.db_storage import DBStorage


def unescape_pipe(text: str) -> str:
    """Restores escaped pipe characters."""
    if not text:
        return ""
    return text.replace("&pipe;", "|")


def migrate_csv_to_db() -> dict:
    storage = DBStorage()
    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "users_imported": 0,
        "memories_imported": 0,
        "users_skipped": 0,
        "memories_skipped": 0,
        "warnings": [],
    }

    # 1. Migrate Users
    if USERS_FILE.exists():
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            for line_no, raw_line in enumerate(f, start=1):
                line = raw_line.rstrip("\r\n")
                if not line.strip():
                    continue
                parts = line.split("|")
                if len(parts) < 4:
                    warn = f"Users line {line_no} corrupt (expected 4 fields, got {len(parts)}): {line}"
                    report["warnings"].append(warn)
                    report["users_skipped"] += 1
                    continue
                user_id = unescape_pipe(parts[0])
                username = unescape_pipe(parts[1])
                password_hash = parts[2]
                salt = parts[3]

                existing = storage.get_user_by_id(user_id)
                if not existing:
                    storage.create_user(
                        username=username,
                        password_hash=password_hash,
                        salt=salt,
                        display_name=username,
                        user_id=user_id,
                    )
                    report["users_imported"] += 1
                else:
                    report["users_skipped"] += 1

    # 2. Migrate Memories
    if MEMORIES_FILE.exists():
        with open(MEMORIES_FILE, "r", encoding="utf-8") as f:
            for line_no, raw_line in enumerate(f, start=1):
                line = raw_line.rstrip("\r\n")
                if not line.strip():
                    continue
                parts = line.split("|", 6)
                if len(parts) < 7:
                    warn = f"Memories line {line_no} corrupt (expected 7 fields, got {len(parts)}): {line}"
                    report["warnings"].append(warn)
                    report["memories_skipped"] += 1
                    continue
                mem_id = unescape_pipe(parts[0])
                owner_id = unescape_pipe(parts[1])
                title = unescape_pipe(parts[2])
                category = parts[3].upper()
                memory_date = parts[4]
                description = unescape_pipe(parts[5])
                kw_str = parts[6]
                keywords = [k.strip() for k in kw_str.split(",") if k.strip()] if kw_str else []

                existing = storage.get_memory_by_id(owner_id, mem_id, include_deleted=True)
                if not existing:
                    storage.create_memory(
                        owner_id=owner_id,
                        title=title,
                        description_encrypted=description,
                        category=category,
                        memory_date=memory_date,
                        keywords=keywords,
                        memory_id=mem_id,
                    )
                    report["memories_imported"] += 1
                else:
                    report["memories_skipped"] += 1

    return report


if __name__ == "__main__":
    print("=" * 60)
    print("AI MemoVault — CSV to SQLite Database Migration")
    print("=" * 60)
    rep = migrate_csv_to_db()
    print(f"Users Imported:    {rep['users_imported']} (Skipped: {rep['users_skipped']})")
    print(f"Memories Imported: {rep['memories_imported']} (Skipped: {rep['memories_skipped']})")
    print(f"Warnings:          {len(rep['warnings'])}")
    for w in rep["warnings"]:
        print(f"  [WARN] {w}")
    print("Migration completed successfully.")
    print("=" * 60)
