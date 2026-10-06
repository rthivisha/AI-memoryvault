"""
Database Storage Repository for AI MemoVault.
Follows the Repository Pattern: the only module that accesses the database.
Handles transactions, soft-deletes, multi-user isolation, and schema initialization.
"""

from datetime import datetime, timedelta
import json
import logging
import sqlite3
import uuid
from typing import Optional, Any

from app.storage.database import get_db_cursor, get_sqlite_connection

logger = logging.getLogger("memovault.db_storage")


class DBStorage:
    """
    Transactional repository for users, memories, attachments, tags,
    collections, reminders, activity logs, refresh tokens, and share links.
    """

    def __init__(self) -> None:
        self.init_db()

    def init_db(self) -> None:
        """Initializes tables and indexes in SQLite database."""
        with get_db_cursor() as cur:
            # 1. users
            cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                display_name TEXT,
                avatar_url TEXT,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                master_key_salt TEXT,
                failed_login_attempts INTEGER DEFAULT 0,
                lockout_until TEXT,
                two_factor_secret TEXT,
                two_factor_enabled INTEGER DEFAULT 0,
                two_factor_backup_codes TEXT DEFAULT '[]',
                settings TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);")

            # 2. collections
            cur.execute("""
            CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                cover_image_url TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_collections_owner ON collections(owner_id);")

            # 3. memories
            cur.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description_encrypted TEXT NOT NULL,
                category TEXT NOT NULL,
                memory_date TEXT NOT NULL,
                mood TEXT DEFAULT 'neutral',
                location_name TEXT,
                latitude REAL,
                longitude REAL,
                people TEXT DEFAULT '[]',
                collection_id TEXT,
                is_favorite INTEGER DEFAULT 0,
                is_pinned INTEGER DEFAULT 0,
                is_archived INTEGER DEFAULT 0,
                deleted_at TEXT,
                keywords TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL
            );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_memories_owner ON memories(owner_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_memories_date ON memories(memory_date);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_memories_deleted ON memories(deleted_at);")

            # 4. tags
            cur.execute("""
            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#06b6d4',
                created_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE (owner_id, name)
            );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_tags_owner ON tags(owner_id);")

            # 5. memory_tags
            cur.execute("""
            CREATE TABLE IF NOT EXISTS memory_tags (
                memory_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (memory_id, tag_id),
                FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );
            """)

            # 6. attachments
            cur.execute("""
            CREATE TABLE IF NOT EXISTS attachments (
                id TEXT PRIMARY KEY,
                memory_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                thumbnail_filename TEXT,
                web_filename TEXT,
                exif_date TEXT,
                is_encrypted INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_attachments_memory ON attachments(memory_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_attachments_owner ON attachments(owner_id);")

            # 7. reminders
            cur.execute("""
            CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY,
                memory_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                due_at TEXT NOT NULL,
                repeat_interval TEXT DEFAULT 'none',
                is_completed INTEGER DEFAULT 0,
                notification_sent INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_reminders_owner ON reminders(owner_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at);")

            # 8. activity_log
            cur.execute("""
            CREATE TABLE IF NOT EXISTS activity_log (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);")

            # 9. refresh_tokens
            cur.execute("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                revoked INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens(token_hash);")

            # 10. share_links
            cur.execute("""
            CREATE TABLE IF NOT EXISTS share_links (
                id TEXT PRIMARY KEY,
                token TEXT UNIQUE NOT NULL,
                owner_id TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                password_hash TEXT,
                expires_at TEXT,
                is_active INTEGER DEFAULT 1,
                view_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_share_token ON share_links(token);")

    # ==========================
    # USER OPERATIONS
    # ==========================

    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def get_user_by_username(self, username: str) -> Optional[dict]:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username.strip(),))
            row = cur.fetchone()
            return dict(row) if row else None

    def create_user(
        self,
        username: str,
        password_hash: str,
        salt: str,
        display_name: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> dict:
        uid = user_id or f"U{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat()
        with get_db_cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (
                    id, username, display_name, password_hash, salt, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (uid, username, display_name or username, password_hash, salt, now, now),
            )
        return self.get_user_by_id(uid)

    def update_user_password(self, user_id: str, new_password_hash: str, new_salt: str) -> None:
        now = datetime.utcnow().isoformat()
        with get_db_cursor() as cur:
            cur.execute(
                "UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?",
                (new_password_hash, new_salt, now, user_id),
            )

    def record_failed_login(self, username: str) -> int:
        """Increments failed login attempts and sets lockout if threshold is exceeded."""
        user = self.get_user_by_username(username)
        if not user:
            return 0
        attempts = (user.get("failed_login_attempts") or 0) + 1
        lockout = None
        if attempts >= 5:
            lockout = (datetime.utcnow() + timedelta(minutes=15)).isoformat()
        with get_db_cursor() as cur:
            cur.execute(
                "UPDATE users SET failed_login_attempts = ?, lockout_until = ? WHERE id = ?",
                (attempts, lockout, user["id"]),
            )
        return attempts

    def reset_failed_logins(self, user_id: str) -> None:
        with get_db_cursor() as cur:
            cur.execute(
                "UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?",
                (user_id,),
            )

    def update_user_settings(self, user_id: str, settings: dict) -> None:
        with get_db_cursor() as cur:
            cur.execute("UPDATE users SET settings = ? WHERE id = ?", (json.dumps(settings), user_id))

    def update_user_profile(self, user_id: str, display_name: Optional[str], avatar_url: Optional[str]) -> dict:
        now = datetime.utcnow().isoformat()
        with get_db_cursor() as cur:
            cur.execute(
                "UPDATE users SET display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url), updated_at = ? WHERE id = ?",
                (display_name, avatar_url, now, user_id),
            )
        return self.get_user_by_id(user_id)

    def delete_user_account(self, user_id: str) -> None:
        with get_db_cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = ?", (user_id,))

    # ==========================
    # MEMORY OPERATIONS
    # ==========================

    def create_memory(
        self,
        owner_id: str,
        title: str,
        description_encrypted: str,
        category: str,
        memory_date: str,
        mood: str = "neutral",
        location_name: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        people: Optional[list[str]] = None,
        keywords: Optional[list[str]] = None,
        collection_id: Optional[str] = None,
        is_favorite: bool = False,
        is_pinned: bool = False,
        memory_id: Optional[str] = None,
    ) -> dict:
        mid = memory_id or f"M{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat()
        with get_db_cursor() as cur:
            cur.execute(
                """
                INSERT INTO memories (
                    id, owner_id, title, description_encrypted, category, memory_date,
                    mood, location_name, latitude, longitude, people, keywords,
                    collection_id, is_favorite, is_pinned, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    mid,
                    owner_id,
                    title,
                    description_encrypted,
                    category.upper(),
                    memory_date,
                    mood,
                    location_name,
                    latitude,
                    longitude,
                    json.dumps(people or []),
                    json.dumps(keywords or []),
                    collection_id,
                    1 if is_favorite else 0,
                    1 if is_pinned else 0,
                    now,
                    now,
                ),
            )
        return self.get_memory_by_id(owner_id, mid)

    def get_memory_by_id(self, owner_id: str, memory_id: str, include_deleted: bool = False) -> Optional[dict]:
        with get_db_cursor() as cur:
            if include_deleted:
                cur.execute("SELECT * FROM memories WHERE id = ? AND owner_id = ?", (memory_id, owner_id))
            else:
                cur.execute("SELECT * FROM memories WHERE id = ? AND owner_id = ? AND deleted_at IS NULL", (memory_id, owner_id))
            row = cur.fetchone()
            if not row:
                return None
            m = dict(row)
            m["people"] = json.loads(m["people"] or "[]")
            m["keywords"] = json.loads(m["keywords"] or "[]")
            m["is_favorite"] = bool(m["is_favorite"])
            m["is_pinned"] = bool(m["is_pinned"])
            m["is_archived"] = bool(m["is_archived"])
            # fetch tags
            cur.execute("""
                SELECT t.id, t.name, t.color FROM tags t
                JOIN memory_tags mt ON t.id = mt.tag_id
                WHERE mt.memory_id = ?
            """, (memory_id,))
            m["tags"] = [dict(t) for t in cur.fetchall()]
            # fetch attachments count
            cur.execute("SELECT COUNT(*) as count FROM attachments WHERE memory_id = ?", (memory_id,))
            m["attachment_count"] = cur.fetchone()["count"]
            return m

    def list_memories(
        self,
        owner_id: str,
        category: Optional[str] = None,
        mood: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        tag: Optional[str] = None,
        collection_id: Optional[str] = None,
        is_favorite: Optional[bool] = None,
        is_archived: bool = False,
        trash_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        query = "SELECT m.* FROM memories m"
        params: list[Any] = []
        conditions: list[str] = ["m.owner_id = ?"]
        params.append(owner_id)

        if trash_only:
            conditions.append("m.deleted_at IS NOT NULL")
        else:
            conditions.append("m.deleted_at IS NULL")
            if not is_archived:
                conditions.append("m.is_archived = 0")
            else:
                conditions.append("m.is_archived = 1")

        if category:
            conditions.append("m.category = ?")
            params.append(category.upper())

        if mood:
            conditions.append("m.mood = ?")
            params.append(mood)

        if from_date:
            conditions.append("m.memory_date >= ?")
            params.append(from_date)

        if to_date:
            conditions.append("m.memory_date <= ?")
            params.append(to_date)

        if is_favorite is not None:
            conditions.append("m.is_favorite = ?")
            params.append(1 if is_favorite else 0)

        if collection_id:
            conditions.append("m.collection_id = ?")
            params.append(collection_id)

        if tag:
            query += " JOIN memory_tags mt ON m.id = mt.memory_id JOIN tags t ON mt.tag_id = t.id"
            conditions.append("t.name = ?")
            params.append(tag)

        query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY m.is_pinned DESC, m.memory_date DESC, m.id DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with get_db_cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            results = []
            for r in rows:
                m = dict(r)
                m["people"] = json.loads(m["people"] or "[]")
                m["keywords"] = json.loads(m["keywords"] or "[]")
                m["is_favorite"] = bool(m["is_favorite"])
                m["is_pinned"] = bool(m["is_pinned"])
                m["is_archived"] = bool(m["is_archived"])
                # load tags
                cur.execute("""
                    SELECT t.id, t.name, t.color FROM tags t
                    JOIN memory_tags mt ON t.id = mt.tag_id
                    WHERE mt.memory_id = ?
                """, (m["id"],))
                m["tags"] = [dict(t) for t in cur.fetchall()]
                # load attachments
                cur.execute("SELECT id, original_filename, mime_type, file_size, thumbnail_filename, web_filename FROM attachments WHERE memory_id = ?", (m["id"],))
                m["attachments"] = [dict(a) for a in cur.fetchall()]
                results.append(m)
            return results

    def update_memory(
        self,
        owner_id: str,
        memory_id: str,
        title: Optional[str] = None,
        description_encrypted: Optional[str] = None,
        category: Optional[str] = None,
        memory_date: Optional[str] = None,
        mood: Optional[str] = None,
        location_name: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        people: Optional[list[str]] = None,
        keywords: Optional[list[str]] = None,
        collection_id: Optional[str] = None,
        is_favorite: Optional[bool] = None,
        is_pinned: Optional[bool] = None,
        is_archived: Optional[bool] = None,
    ) -> Optional[dict]:
        now = datetime.utcnow().isoformat()
        fields = ["updated_at = ?"]
        params: list[Any] = [now]

        if title is not None:
            fields.append("title = ?")
            params.append(title)
        if description_encrypted is not None:
            fields.append("description_encrypted = ?")
            params.append(description_encrypted)
        if category is not None:
            fields.append("category = ?")
            params.append(category.upper())
        if memory_date is not None:
            fields.append("memory_date = ?")
            params.append(memory_date)
        if mood is not None:
            fields.append("mood = ?")
            params.append(mood)
        if location_name is not None:
            fields.append("location_name = ?")
            params.append(location_name)
        if latitude is not None:
            fields.append("latitude = ?")
            params.append(latitude)
        if longitude is not None:
            fields.append("longitude = ?")
            params.append(longitude)
        if people is not None:
            fields.append("people = ?")
            params.append(json.dumps(people))
        if keywords is not None:
            fields.append("keywords = ?")
            params.append(json.dumps(keywords))
        if collection_id is not None:
            fields.append("collection_id = ?")
            params.append(collection_id)
        if is_favorite is not None:
            fields.append("is_favorite = ?")
            params.append(1 if is_favorite else 0)
        if is_pinned is not None:
            fields.append("is_pinned = ?")
            params.append(1 if is_pinned else 0)
        if is_archived is not None:
            fields.append("is_archived = ?")
            params.append(1 if is_archived else 0)

        params.extend([memory_id, owner_id])
        with get_db_cursor() as cur:
            cur.execute(f"UPDATE memories SET {', '.join(fields)} WHERE id = ? AND owner_id = ?", params)
        return self.get_memory_by_id(owner_id, memory_id)

    def soft_delete_memory(self, owner_id: str, memory_id: str) -> bool:
        now = datetime.utcnow().isoformat()
        with get_db_cursor() as cur:
            cur.execute(
                "UPDATE memories SET deleted_at = ? WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
                (now, memory_id, owner_id),
            )
            return cur.rowcount > 0

    def restore_memory(self, owner_id: str, memory_id: str) -> bool:
        with get_db_cursor() as cur:
            cur.execute(
                "UPDATE memories SET deleted_at = NULL WHERE id = ? AND owner_id = ?",
                (memory_id, owner_id),
            )
            return cur.rowcount > 0

    def purge_memory(self, owner_id: str, memory_id: str) -> bool:
        with get_db_cursor() as cur:
            cur.execute("DELETE FROM memories WHERE id = ? AND owner_id = ?", (memory_id, owner_id))
            return cur.rowcount > 0

    def auto_purge_trash(self, days: int = 30) -> int:
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        with get_db_cursor() as cur:
            cur.execute("DELETE FROM memories WHERE deleted_at IS NOT NULL AND deleted_at <= ?", (cutoff,))
            return cur.rowcount

    # ==========================
    # TAGS OPERATIONS
    # ==========================

    def get_or_create_tag(self, owner_id: str, name: str, color: str = "#06b6d4") -> dict:
        clean_name = name.strip().lower()
        now = datetime.utcnow().isoformat()
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM tags WHERE owner_id = ? AND name = ?", (owner_id, clean_name))
            row = cur.fetchone()
            if row:
                return dict(row)
            tid = f"T{uuid.uuid4().hex[:8]}"
            cur.execute(
                "INSERT INTO tags (id, owner_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)",
                (tid, owner_id, clean_name, color, now),
            )
            return {"id": tid, "owner_id": owner_id, "name": clean_name, "color": color, "created_at": now}

    def set_memory_tags(self, owner_id: str, memory_id: str, tag_names: list[str]) -> list[dict]:
        with get_db_cursor() as cur:
            cur.execute("DELETE FROM memory_tags WHERE memory_id = ?", (memory_id,))
        assigned = []
        for name in tag_names:
            if name.strip():
                tag = self.get_or_create_tag(owner_id, name.strip())
                with get_db_cursor() as cur:
                    cur.execute(
                        "INSERT OR IGNORE INTO memory_tags (memory_id, tag_id) VALUES (?, ?)",
                        (memory_id, tag["id"]),
                    )
                assigned.append(tag)
        return assigned

    def list_tags_with_counts(self, owner_id: str) -> list[dict]:
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT t.id, t.name, t.color, COUNT(mt.memory_id) as count
                FROM tags t
                LEFT JOIN memory_tags mt ON t.id = mt.tag_id
                LEFT JOIN memories m ON mt.memory_id = m.id AND m.deleted_at IS NULL
                WHERE t.owner_id = ?
                GROUP BY t.id
                ORDER BY count DESC, t.name ASC
            """, (owner_id,))
            return [dict(r) for r in cur.fetchall()]

    def rename_tag(self, owner_id: str, tag_id: str, new_name: str) -> None:
        clean_name = new_name.strip().lower()
        with get_db_cursor() as cur:
            cur.execute("UPDATE tags SET name = ? WHERE id = ? AND owner_id = ?", (clean_name, tag_id, owner_id))

    def delete_tag(self, owner_id: str, tag_id: str) -> None:
        with get_db_cursor() as cur:
            cur.execute("DELETE FROM tags WHERE id = ? AND owner_id = ?", (tag_id, owner_id))

    # ==========================
    # ATTACHMENTS OPERATIONS
    # ==========================

    def create_attachment(
        self,
        memory_id: str,
        owner_id: str,
        original_filename: str,
        stored_filename: str,
        mime_type: str,
        file_size: int,
        thumbnail_filename: Optional[str] = None,
        web_filename: Optional[str] = None,
        exif_date: Optional[str] = None,
    ) -> dict:
        aid = f"A{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat()
        with get_db_cursor() as cur:
            cur.execute("""
                INSERT INTO attachments (
                    id, memory_id, owner_id, original_filename, stored_filename,
                    mime_type, file_size, thumbnail_filename, web_filename, exif_date, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                aid, memory_id, owner_id, original_filename, stored_filename,
                mime_type, file_size, thumbnail_filename, web_filename, exif_date, now
            ))
        return self.get_attachment_by_id(owner_id, aid)

    def get_attachment_by_id(self, owner_id: str, attachment_id: str) -> Optional[dict]:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM attachments WHERE id = ? AND owner_id = ?", (attachment_id, owner_id))
            row = cur.fetchone()
            return dict(row) if row else None

    def list_attachments_for_memory(self, owner_id: str, memory_id: str) -> list[dict]:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM attachments WHERE memory_id = ? AND owner_id = ? ORDER BY created_at ASC", (memory_id, owner_id))
            return [dict(r) for r in cur.fetchall()]

    def list_all_media_attachments(self, owner_id: str, mime_prefix: str = "image/") -> list[dict]:
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT a.*, m.title as memory_title, m.category as memory_category, m.memory_date
                FROM attachments a
                JOIN memories m ON a.memory_id = m.id
                WHERE a.owner_id = ? AND a.mime_type LIKE ? AND m.deleted_at IS NULL
                ORDER BY m.memory_date DESC, a.created_at DESC
            """, (owner_id, f"{mime_prefix}%"))
            return [dict(r) for r in cur.fetchall()]

    def delete_attachment(self, owner_id: str, attachment_id: str) -> Optional[dict]:
        att = self.get_attachment_by_id(owner_id, attachment_id)
        if not att:
            return None
        with get_db_cursor() as cur:
            cur.execute("DELETE FROM attachments WHERE id = ? AND owner_id = ?", (attachment_id, owner_id))
        return att

    # ==========================
    # COLLECTIONS OPERATIONS
    # ==========================

    def create_collection(self, owner_id: str, name: str, description: Optional[str] = None, cover_image_url: Optional[str] = None) -> dict:
        cid = f"C{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat()
        with get_db_cursor() as cur:
            cur.execute(
                "INSERT INTO collections (id, owner_id, name, description, cover_image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (cid, owner_id, name, description, cover_image_url, now, now),
            )
        return self.get_collection_by_id(owner_id, cid)

    def get_collection_by_id(self, owner_id: str, collection_id: str) -> Optional[dict]:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM collections WHERE id = ? AND owner_id = ?", (collection_id, owner_id))
            row = cur.fetchone()
            if not row:
                return None
            c = dict(row)
            cur.execute("SELECT COUNT(*) as count FROM memories WHERE collection_id = ? AND deleted_at IS NULL", (collection_id,))
            c["memory_count"] = cur.fetchone()["count"]
            return c

    def list_collections(self, owner_id: str) -> list[dict]:
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT c.*, COUNT(m.id) as memory_count
                FROM collections c
                LEFT JOIN memories m ON c.id = m.collection_id AND m.deleted_at IS NULL
                WHERE c.owner_id = ?
                GROUP BY c.id
                ORDER BY c.created_at DESC
            """, (owner_id,))
            return [dict(r) for r in cur.fetchall()]

    def delete_collection(self, owner_id: str, collection_id: str) -> None:
        with get_db_cursor() as cur:
            cur.execute("DELETE FROM collections WHERE id = ? AND owner_id = ?", (collection_id, owner_id))

    # ==========================
    # REMINDERS OPERATIONS
    # ==========================

    def create_reminder(self, owner_id: str, memory_id: str, due_at: str, repeat_interval: str = "none") -> dict:
        rid = f"R{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat()
        with get_db_cursor() as cur:
            cur.execute("""
                INSERT INTO reminders (id, memory_id, owner_id, due_at, repeat_interval, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (rid, memory_id, owner_id, due_at, repeat_interval, now))
            cur.execute("""
                SELECT r.*, m.title as memory_title, m.category as memory_category
                FROM reminders r
                JOIN memories m ON r.memory_id = m.id
                WHERE r.id = ?
            """, (rid,))
            return dict(cur.fetchone())

    def list_reminders(self, owner_id: str, include_completed: bool = False) -> list[dict]:
        with get_db_cursor() as cur:
            cond = "r.owner_id = ?"
            if not include_completed:
                cond += " AND r.is_completed = 0"
            cur.execute(f"""
                SELECT r.*, m.title as memory_title, m.category as memory_category
                FROM reminders r
                JOIN memories m ON r.memory_id = m.id
                WHERE {cond}
                ORDER BY r.due_at ASC
            """, (owner_id,))
            return [dict(r) for r in cur.fetchall()]

    def mark_reminder_completed(self, owner_id: str, reminder_id: str) -> None:
        with get_db_cursor() as cur:
            cur.execute("UPDATE reminders SET is_completed = 1 WHERE id = ? AND owner_id = ?", (reminder_id, owner_id))

    def delete_reminder(self, owner_id: str, reminder_id: str) -> None:
        with get_db_cursor() as cur:
            cur.execute("DELETE FROM reminders WHERE id = ? AND owner_id = ?", (reminder_id, owner_id))

    # ==========================
    # ACTIVITY LOG
    # ==========================

    def log_activity(
        self,
        user_id: str,
        action: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        aid = f"LOG{uuid.uuid4().hex[:10]}"
        now = datetime.utcnow().isoformat()
        try:
            with get_db_cursor() as cur:
                cur.execute("""
                    INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (aid, user_id, action, entity_type, entity_id, ip_address, user_agent, now))
        except Exception as e:
            logger.warning(f"Failed to log activity: {e}")

    def get_recent_activity(self, user_id: str, limit: int = 50) -> list[dict]:
        with get_db_cursor() as cur:
            cur.execute(
                "SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (user_id, limit),
            )
            return [dict(r) for r in cur.fetchall()]

    # ==========================
    # SHARE LINKS
    # ==========================

    def create_share_link(
        self,
        owner_id: str,
        entity_type: str,
        entity_id: str,
        password_hash: Optional[str] = None,
        expires_at: Optional[str] = None,
    ) -> dict:
        sid = f"S{uuid.uuid4().hex[:8]}"
        token = uuid.uuid4().hex
        now = datetime.utcnow().isoformat()
        with get_db_cursor() as cur:
            cur.execute("""
                INSERT INTO share_links (id, token, owner_id, entity_type, entity_id, password_hash, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (sid, token, owner_id, entity_type, entity_id, password_hash, expires_at, now))
            cur.execute("SELECT * FROM share_links WHERE id = ?", (sid,))
            return dict(cur.fetchone())

    def get_share_link_by_token(self, token: str) -> Optional[dict]:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM share_links WHERE token = ? AND is_active = 1", (token,))
            row = cur.fetchone()
            if not row:
                return None
            res = dict(row)
            if res.get("expires_at") and res["expires_at"] < datetime.utcnow().isoformat():
                return None
            return res

    def increment_share_views(self, token: str) -> None:
        with get_db_cursor() as cur:
            cur.execute("UPDATE share_links SET view_count = view_count + 1 WHERE token = ?", (token,))

    def revoke_share_link(self, owner_id: str, share_id: str) -> None:
        with get_db_cursor() as cur:
            cur.execute("UPDATE share_links SET is_active = 0 WHERE id = ? AND owner_id = ?", (share_id, owner_id))
