"""
SQLAlchemy 2.0 Database Models for AI MemoVault.
Tables:
  - users
  - memories
  - attachments
  - tags
  - memory_tags
  - collections
  - reminders
  - activity_log
  - refresh_tokens
  - share_links
"""

from datetime import datetime
import json
from typing import Optional, Any

try:
    from sqlalchemy import (
        Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey, Table, Index
    )
    from sqlalchemy.orm import declarative_base, relationship

    Base = declarative_base()
    HAVE_SQLALCHEMY = True
except ImportError:
    Base = object  # type: ignore
    HAVE_SQLALCHEMY = False


if HAVE_SQLALCHEMY:
    # Association table for Memory <-> Tag many-to-many
    memory_tags = Table(
        "memory_tags",
        Base.metadata,
        Column("memory_id", String(36), ForeignKey("memories.id", ondelete="CASCADE"), primary_key=True),
        Column("tag_id", String(36), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )

    class UserDB(Base):
        __tablename__ = "users"

        id = Column(String(36), primary_key=True)
        username = Column(String(50), unique=True, nullable=False, index=True)
        display_name = Column(String(100), nullable=True)
        avatar_url = Column(String(500), nullable=True)
        password_hash = Column(Text, nullable=False)
        salt = Column(Text, nullable=False)
        master_key_salt = Column(Text, nullable=True)
        failed_login_attempts = Column(Integer, default=0)
        lockout_until = Column(DateTime, nullable=True)
        two_factor_secret = Column(String(100), nullable=True)
        two_factor_enabled = Column(Boolean, default=False)
        two_factor_backup_codes = Column(Text, default="[]")  # JSON encoded list
        settings = Column(Text, default="{}")                 # JSON encoded dict
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

        # Relationships
        memories = relationship("MemoryDB", back_populates="owner", cascade="all, delete-orphan")
        tags = relationship("TagDB", back_populates="owner", cascade="all, delete-orphan")
        collections = relationship("CollectionDB", back_populates="owner", cascade="all, delete-orphan")
        activity_logs = relationship("ActivityLogDB", back_populates="user", cascade="all, delete-orphan")

    class CollectionDB(Base):
        __tablename__ = "collections"

        id = Column(String(36), primary_key=True)
        owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
        name = Column(String(100), nullable=False)
        description = Column(Text, nullable=True)
        cover_image_url = Column(Text, nullable=True)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

        owner = relationship("UserDB", back_populates="collections")
        memories = relationship("MemoryDB", back_populates="collection")

    class MemoryDB(Base):
        __tablename__ = "memories"

        id = Column(String(36), primary_key=True)
        owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
        title = Column(String(200), nullable=False)
        description_encrypted = Column(Text, nullable=False)
        category = Column(String(50), nullable=False, index=True)
        memory_date = Column(String(10), nullable=False, index=True)  # ISO yyyy-MM-dd
        mood = Column(String(20), default="neutral")  # happy, proud, calm, sad, excited, neutral
        location_name = Column(String(200), nullable=True)
        latitude = Column(Float, nullable=True)
        longitude = Column(Float, nullable=True)
        people = Column(Text, default="[]")           # JSON encoded list
        collection_id = Column(String(36), ForeignKey("collections.id", ondelete="SET NULL"), nullable=True)
        is_favorite = Column(Boolean, default=False)
        is_pinned = Column(Boolean, default=False)
        is_archived = Column(Boolean, default=False)
        deleted_at = Column(DateTime, nullable=True, index=True)  # Soft delete
        keywords = Column(Text, default="[]")         # JSON list
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

        owner = relationship("UserDB", back_populates="memories")
        collection = relationship("CollectionDB", back_populates="memories")
        attachments = relationship("AttachmentDB", back_populates="memory", cascade="all, delete-orphan")
        tags = relationship("TagDB", secondary=memory_tags, back_populates="memories")
        reminders = relationship("ReminderDB", back_populates="memory", cascade="all, delete-orphan")

    class TagDB(Base):
        __tablename__ = "tags"

        id = Column(String(36), primary_key=True)
        owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
        name = Column(String(50), nullable=False)
        color = Column(String(20), default="#06b6d4")
        created_at = Column(DateTime, default=datetime.utcnow)

        owner = relationship("UserDB", back_populates="tags")
        memories = relationship("MemoryDB", secondary=memory_tags, back_populates="tags")

        __table_args__ = (Index("idx_owner_tag_name", "owner_id", "name", unique=True),)

    class AttachmentDB(Base):
        __tablename__ = "attachments"

        id = Column(String(36), primary_key=True)
        memory_id = Column(String(36), ForeignKey("memories.id", ondelete="CASCADE"), nullable=False, index=True)
        owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
        original_filename = Column(String(255), nullable=False)
        stored_filename = Column(String(255), nullable=False)
        mime_type = Column(String(100), nullable=False)
        file_size = Column(Integer, nullable=False)
        thumbnail_filename = Column(String(255), nullable=True)
        web_filename = Column(String(255), nullable=True)
        exif_date = Column(String(30), nullable=True)
        is_encrypted = Column(Boolean, default=True)
        created_at = Column(DateTime, default=datetime.utcnow)

        memory = relationship("MemoryDB", back_populates="attachments")

    class ReminderDB(Base):
        __tablename__ = "reminders"

        id = Column(String(36), primary_key=True)
        memory_id = Column(String(36), ForeignKey("memories.id", ondelete="CASCADE"), nullable=False, index=True)
        owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
        due_at = Column(DateTime, nullable=False, index=True)
        repeat_interval = Column(String(20), default="none")  # none, weekly, yearly
        is_completed = Column(Boolean, default=False)
        notification_sent = Column(Boolean, default=False)
        created_at = Column(DateTime, default=datetime.utcnow)

        memory = relationship("MemoryDB", back_populates="reminders")

    class ActivityLogDB(Base):
        __tablename__ = "activity_log"

        id = Column(String(36), primary_key=True)
        user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
        action = Column(String(50), nullable=False)
        entity_type = Column(String(50), nullable=False)
        entity_id = Column(String(50), nullable=True)
        ip_address = Column(String(50), nullable=True)
        user_agent = Column(String(255), nullable=True)
        created_at = Column(DateTime, default=datetime.utcnow, index=True)

        user = relationship("UserDB", back_populates="activity_logs")

    class RefreshTokenDB(Base):
        __tablename__ = "refresh_tokens"

        id = Column(String(36), primary_key=True)
        user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
        token_hash = Column(String(128), nullable=False, index=True)
        expires_at = Column(DateTime, nullable=False)
        revoked = Column(Boolean, default=False)
        created_at = Column(DateTime, default=datetime.utcnow)

    class ShareLinkDB(Base):
        __tablename__ = "share_links"

        id = Column(String(36), primary_key=True)
        token = Column(String(64), unique=True, nullable=False, index=True)
        owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
        entity_type = Column(String(20), nullable=False)  # "memory" or "collection"
        entity_id = Column(String(36), nullable=False)
        password_hash = Column(String(128), nullable=True)
        expires_at = Column(DateTime, nullable=True)
        is_active = Column(Boolean, default=True)
        view_count = Column(Integer, default=0)
        created_at = Column(DateTime, default=datetime.utcnow)
