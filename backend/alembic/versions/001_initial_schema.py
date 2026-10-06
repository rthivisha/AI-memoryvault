"""Initial schema with 10 tables: users, collections, memories, tags, memory_tags, attachments, reminders, activity_log, refresh_tokens, share_links.

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-05 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("username", sa.String(50), nullable=False, unique=True),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("salt", sa.Text(), nullable=False),
        sa.Column("master_key_salt", sa.Text(), nullable=True),
        sa.Column("failed_login_attempts", sa.Integer(), server_default="0"),
        sa.Column("lockout_until", sa.DateTime(), nullable=True),
        sa.Column("two_factor_secret", sa.String(100), nullable=True),
        sa.Column("two_factor_enabled", sa.Boolean(), server_default="0"),
        sa.Column("two_factor_backup_codes", sa.Text(), server_default="'[]'"),
        sa.Column("settings", sa.Text(), server_default="'{}'"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_users_username", "users", ["username"])

    # 2. collections
    op.create_table(
        "collections",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_image_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_collections_owner", "collections", ["owner_id"])

    # 3. memories
    op.create_table(
        "memories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description_encrypted", sa.Text(), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("memory_date", sa.String(10), nullable=False),
        sa.Column("mood", sa.String(20), server_default="'neutral'"),
        sa.Column("location_name", sa.String(200), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("people", sa.Text(), server_default="'[]'"),
        sa.Column("collection_id", sa.String(36), sa.ForeignKey("collections.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_favorite", sa.Boolean(), server_default="0"),
        sa.Column("is_pinned", sa.Boolean(), server_default="0"),
        sa.Column("is_archived", sa.Boolean(), server_default="0"),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("keywords", sa.Text(), server_default="'[]'"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_memories_owner", "memories", ["owner_id"])
    op.create_index("idx_memories_date", "memories", ["memory_date"])
    op.create_index("idx_memories_category", "memories", ["category"])
    op.create_index("idx_memories_deleted", "memories", ["deleted_at"])

    # 4. tags
    op.create_table(
        "tags",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("color", sa.String(20), server_default="'#06b6d4'"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("owner_id", "name", name="uq_owner_tag_name"),
    )
    op.create_index("idx_tags_owner", "tags", ["owner_id"])

    # 5. memory_tags
    op.create_table(
        "memory_tags",
        sa.Column("memory_id", sa.String(36), sa.ForeignKey("memories.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.String(36), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )

    # 6. attachments
    op.create_table(
        "attachments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("memory_id", sa.String(36), sa.ForeignKey("memories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("stored_filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("thumbnail_filename", sa.String(255), nullable=True),
        sa.Column("web_filename", sa.String(255), nullable=True),
        sa.Column("exif_date", sa.String(30), nullable=True),
        sa.Column("is_encrypted", sa.Boolean(), server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_attachments_memory", "attachments", ["memory_id"])
    op.create_index("idx_attachments_owner", "attachments", ["owner_id"])

    # 7. reminders
    op.create_table(
        "reminders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("memory_id", sa.String(36), sa.ForeignKey("memories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("due_at", sa.DateTime(), nullable=False),
        sa.Column("repeat_interval", sa.String(20), server_default="'none'"),
        sa.Column("is_completed", sa.Boolean(), server_default="0"),
        sa.Column("notification_sent", sa.Boolean(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_reminders_owner", "reminders", ["owner_id"])
    op.create_index("idx_reminders_due", "reminders", ["due_at"])

    # 8. activity_log
    op.create_table(
        "activity_log",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.String(50), nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_activity_user", "activity_log", ["user_id"])

    # 9. refresh_tokens
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked", sa.Boolean(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_refresh_token_hash", "refresh_tokens", ["token_hash"])

    # 10. share_links
    op.create_table(
        "share_links",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_type", sa.String(20), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("password_hash", sa.String(128), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="1"),
        sa.Column("view_count", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_share_token", "share_links", ["token"])


def downgrade() -> None:
    op.drop_table("share_links")
    op.drop_table("refresh_tokens")
    op.drop_table("activity_log")
    op.drop_table("reminders")
    op.drop_table("attachments")
    op.drop_table("memory_tags")
    op.drop_table("tags")
    op.drop_table("memories")
    op.drop_table("collections")
    op.drop_table("users")
