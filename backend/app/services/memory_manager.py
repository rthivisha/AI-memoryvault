"""
Memory Manager Service for AI MemoVault.
Orchestrates CRUD over DBStorage (and FileStorage compatibility), description encryption at rest,
soft delete and restore, tag synchronization, and inverted index updates.
"""

from datetime import datetime
import json
from typing import Optional, Any, Union

from app.exceptions import MemoryNotFoundException, InvalidInputException
from app.models.memory import Memory, VALID_CATEGORIES
from app.storage.db_storage import DBStorage
from app.storage.file_storage import FileStorage
from app.storage.inverted_index import UserInvertedIndex
from app.services.ai_service import AIService
from app.utils.encryption_util import encrypt_data, decrypt_data
from app.utils.validation_util import (
    validate_title,
    validate_description,
    validate_date,
    validate_category,
)


class MemoryManager:
    """
    Business service layer managing user memory lifecycles, encryption at rest,
    and search index synchronization. Supports DBStorage and FileStorage.
    """

    def __init__(
        self,
        db: Optional[Any] = None,
        index_manager: Optional[UserInvertedIndex] = None,
        storage: Optional[Any] = None,
    ) -> None:
        target = db if db is not None else storage
        self.is_file_storage = isinstance(target, FileStorage) or hasattr(target, "load_memories")
        self.db: Any = target
        self.storage: Any = target
        self.index_manager: UserInvertedIndex = index_manager or UserInvertedIndex()
        self._initialize_index()

    def _initialize_index(self) -> None:
        """Populates in-memory inverted index for all users."""
        if not self.db:
            return

        if self.is_file_storage:
            for mem in self.storage.load_memories():
                self.index_manager.add(mem)
            return

        # DBStorage mode
        with self.db.get_db_cursor() as cur:
            cur.execute("SELECT id, owner_id, title, category, description_encrypted, keywords FROM memories WHERE deleted_at IS NULL")
            rows = cur.fetchall()
            for r in rows:
                mid = r["id"]
                owner_id = r["owner_id"]
                title = r["title"]
                category = r["category"]
                desc = decrypt_data(r["description_encrypted"], owner_id)
                kws = json.loads(r["keywords"] or "[]")

                mem = Memory(
                    memory_id=mid,
                    owner_id=owner_id,
                    title=title,
                    category=category,
                    date="",
                    description=desc,
                    keywords=kws,
                )
                self.index_manager.add(mem)

    def _get_user_corpus_texts(self, owner_id: str) -> list[str]:
        if self.is_file_storage:
            mems = [m for m in self.storage.load_memories() if m.owner_id == owner_id]
            return [f"{m.title} {m.description}" for m in mems]

        memories = self.db.list_memories(owner_id, limit=2000)
        return [
            f"{m['title']} {decrypt_data(m['description_encrypted'], owner_id)}"
            for m in memories
        ]

    def get_memories_for_user(
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
    ) -> Any:
        if self.is_file_storage:
            mems = [m for m in self.storage.load_memories() if m.owner_id == owner_id]
            if category:
                mems = [m for m in mems if m.category == category]
            if from_date:
                mems = [m for m in mems if m.date >= from_date]
            if to_date:
                mems = [m for m in mems if m.date <= to_date]
            mems.sort()
            return mems

        memories = self.db.list_memories(
            owner_id=owner_id,
            category=category,
            mood=mood,
            from_date=from_date,
            to_date=to_date,
            tag=tag,
            collection_id=collection_id,
            is_favorite=is_favorite,
            is_archived=is_archived,
            trash_only=trash_only,
            limit=limit,
            offset=offset,
        )
        for m in memories:
            m["description"] = decrypt_data(m["description_encrypted"], owner_id)
        return memories

    def get_memory_by_id(self, owner_id: str, memory_id: str, include_deleted: bool = False) -> Any:
        if self.is_file_storage:
            for m in self.storage.load_memories():
                if m.memory_id == memory_id and m.owner_id == owner_id:
                    return m
            raise MemoryNotFoundException(f"No memory record with ID '{memory_id}' exists for the current user.")

        memory = self.db.get_memory_by_id(owner_id, memory_id, include_deleted=include_deleted)
        if not memory:
            raise MemoryNotFoundException(f"No memory record with ID '{memory_id}' exists for the current user.")
        memory["description"] = decrypt_data(memory["description_encrypted"], owner_id)
        return memory

    def create_memory(
        self,
        owner_id: str,
        title: str,
        date_str: str,
        description: str,
        category: Optional[str] = None,
        mood: str = "neutral",
        location_name: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        people: Optional[list[str]] = None,
        tags: Optional[list[str]] = None,
        collection_id: Optional[str] = None,
        is_favorite: bool = False,
        is_pinned: bool = False,
    ) -> Any:
        clean_title = validate_title(title)
        clean_date = validate_date(date_str)
        clean_desc = validate_description(description)

        suggested_cat, confidence = AIService.classify(clean_title, clean_desc)
        final_category = validate_category(category) if category else suggested_cat

        corpus_texts = self._get_user_corpus_texts(owner_id)
        keywords = AIService.extract_keywords(corpus_texts, clean_title, clean_desc)

        if self.is_file_storage:
            next_id = self.storage.get_next_memory_id()
            mem_entity = Memory(
                memory_id=next_id,
                owner_id=owner_id,
                title=clean_title,
                category=final_category,
                date=clean_date,
                description=clean_desc,
                keywords=keywords,
            )
            self.storage.append_memory(mem_entity)
            self.index_manager.add(mem_entity)
            return mem_entity, suggested_cat, confidence

        # Encrypt description at rest
        desc_encrypted = encrypt_data(clean_desc, owner_id)

        created = self.db.create_memory(
            owner_id=owner_id,
            title=clean_title,
            description_encrypted=desc_encrypted,
            category=final_category,
            memory_date=clean_date,
            mood=mood,
            location_name=location_name,
            latitude=latitude,
            longitude=longitude,
            people=people,
            keywords=keywords,
            collection_id=collection_id,
            is_favorite=is_favorite,
            is_pinned=is_pinned,
        )

        if tags:
            assigned_tags = self.db.set_memory_tags(owner_id, created["id"], tags)
            created["tags"] = assigned_tags

        mem_entity = Memory(
            memory_id=created["id"],
            owner_id=owner_id,
            title=clean_title,
            category=final_category,
            date=clean_date,
            description=clean_desc,
            keywords=keywords,
        )
        self.index_manager.add(mem_entity)
        self.db.log_activity(owner_id, "create", "memory", created["id"])

        created["description"] = clean_desc
        created["suggestedCategory"] = suggested_cat
        created["suggestionConfidence"] = confidence
        return created

    def update_memory(
        self,
        owner_id: str,
        memory_id: str,
        title: Optional[str] = None,
        date_str: Optional[str] = None,
        description: Optional[str] = None,
        category: Optional[str] = None,
        mood: Optional[str] = None,
        location_name: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        people: Optional[list[str]] = None,
        tags: Optional[list[str]] = None,
        collection_id: Optional[str] = None,
        is_favorite: Optional[bool] = None,
        is_pinned: Optional[bool] = None,
        is_archived: Optional[bool] = None,
    ) -> Any:
        if self.is_file_storage:
            all_mems = self.storage.load_memories()
            target_idx = -1
            for idx, m in enumerate(all_mems):
                if m.memory_id == memory_id and m.owner_id == owner_id:
                    target_idx = idx
                    break
            if target_idx == -1:
                raise MemoryNotFoundException(f"No memory record with ID '{memory_id}' exists for the current user.")

            clean_title = validate_title(title) if title is not None else all_mems[target_idx].title
            clean_date = validate_date(date_str) if date_str is not None else all_mems[target_idx].date
            clean_desc = validate_description(description) if description is not None else all_mems[target_idx].description
            clean_cat = validate_category(category) if category is not None else all_mems[target_idx].category

            corpus = self._get_user_corpus_texts(owner_id)
            keywords = AIService.extract_keywords(corpus, clean_title, clean_desc)

            updated_entity = Memory(
                memory_id=memory_id,
                owner_id=owner_id,
                title=clean_title,
                category=clean_cat,
                date=clean_date,
                description=clean_desc,
                keywords=keywords,
            )
            all_mems[target_idx] = updated_entity
            self.storage.rewrite_memories(all_mems)
            self.index_manager.update(updated_entity)
            return updated_entity

        existing = self.get_memory_by_id(owner_id, memory_id)
        clean_title = validate_title(title) if title is not None else existing["title"]
        clean_date = validate_date(date_str) if date_str is not None else existing["memory_date"]
        clean_desc = validate_description(description) if description is not None else existing["description"]
        clean_cat = validate_category(category) if category is not None else existing["category"]

        corpus = self._get_user_corpus_texts(owner_id)
        keywords = AIService.extract_keywords(corpus, clean_title, clean_desc)
        desc_enc = encrypt_data(clean_desc, owner_id)

        updated = self.db.update_memory(
            owner_id=owner_id,
            memory_id=memory_id,
            title=clean_title,
            description_encrypted=desc_enc,
            category=clean_cat,
            memory_date=clean_date,
            mood=mood,
            location_name=location_name,
            latitude=latitude,
            longitude=longitude,
            people=people,
            keywords=keywords,
            collection_id=collection_id,
            is_favorite=is_favorite,
            is_pinned=is_pinned,
            is_archived=is_archived,
        )

        if tags is not None:
            self.db.set_memory_tags(owner_id, memory_id, tags)
            updated["tags"] = self.db.get_memory_by_id(owner_id, memory_id)["tags"]

        mem_entity = Memory(
            memory_id=memory_id,
            owner_id=owner_id,
            title=clean_title,
            category=clean_cat,
            date=clean_date,
            description=clean_desc,
            keywords=keywords,
        )
        self.index_manager.update(mem_entity)
        self.db.log_activity(owner_id, "edit", "memory", memory_id)
        updated["description"] = clean_desc
        return updated

    def delete_memory(
        self,
        owner_id: str,
        memory_id: str,
        confirm: bool = False,
        purge: bool = False,
    ) -> None:
        """Deletes a memory record with confirmation check."""
        if not confirm:
            raise InvalidInputException("Confirmation required before deletion.")

        if self.is_file_storage:
            all_mems = self.storage.load_memories()
            found = False
            new_mems = []
            for m in all_mems:
                if m.memory_id == memory_id:
                    if m.owner_id != owner_id:
                        raise MemoryNotFoundException(f"No memory record with ID '{memory_id}' exists for the current user.")
                    found = True
                else:
                    new_mems.append(m)
            if not found:
                raise MemoryNotFoundException(f"No memory record with ID '{memory_id}' exists for the current user.")

            self.storage.rewrite_memories(new_mems)
            self.index_manager.remove(owner_id, memory_id)
            return

        if purge:
            self.purge_memory(owner_id, memory_id)
        else:
            self.soft_delete_memory(owner_id, memory_id)

    def soft_delete_memory(self, owner_id: str, memory_id: str) -> None:
        """Moves memory to Trash."""
        self.get_memory_by_id(owner_id, memory_id)
        self.db.soft_delete_memory(owner_id, memory_id)
        self.index_manager.remove(owner_id, memory_id)
        self.db.log_activity(owner_id, "soft_delete", "memory", memory_id)

    def restore_memory(self, owner_id: str, memory_id: str) -> dict:
        """Restores memory from Trash."""
        self.db.restore_memory(owner_id, memory_id)
        restored = self.get_memory_by_id(owner_id, memory_id)
        mem_entity = Memory(
            memory_id=memory_id,
            owner_id=owner_id,
            title=restored["title"],
            category=restored["category"],
            date=restored["memory_date"],
            description=restored["description"],
            keywords=restored.get("keywords", []),
        )
        self.index_manager.add(mem_entity)
        self.db.log_activity(owner_id, "restore", "memory", memory_id)
        return restored

    def purge_memory(self, owner_id: str, memory_id: str) -> None:
        """Permanently purges memory from database."""
        self.db.purge_memory(owner_id, memory_id)
        self.index_manager.remove(owner_id, memory_id)
        self.db.log_activity(owner_id, "purge", "memory", memory_id)

    def get_related_memories(self, owner_id: str, memory_id: str) -> list[dict]:
        target = self.get_memory_by_id(owner_id, memory_id)
        user_memories = self.get_memories_for_user(owner_id, limit=500)

        related = []
        for m in user_memories:
            m_id = m.memory_id if hasattr(m, "memory_id") else m["id"]
            if m_id == memory_id:
                continue
            sim = AIService.calculate_composite_similarity(target, m)
            if sim > 0:
                related.append({"memory": m, "score": sim})

        related.sort(key=lambda item: -item["score"])
        return related[:5]
