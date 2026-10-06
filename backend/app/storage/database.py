"""
Database Connection and Session Manager.
Supports both SQLAlchemy 2.0 engine / session and native SQLite standard library connection.
Enables WAL mode and foreign key enforcement.
"""

import os
import sqlite3
import threading
from pathlib import Path
from contextlib import contextmanager
from typing import Generator, Optional

from app.config import DATABASE_URL, DATA_DIR

DB_PATH: Path = DATA_DIR / "memovault.db"
_lock = threading.Lock()


def get_sqlite_connection() -> sqlite3.Connection:
    """
    Returns a configured sqlite3 connection with WAL mode, foreign keys,
    and dictionary-like Row factory.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn


@contextmanager
def get_db_cursor() -> Generator[sqlite3.Cursor, None, None]:
    """Context manager for thread-safe SQLite cursor with transaction commit/rollback."""
    with _lock:
        conn = get_sqlite_connection()
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
