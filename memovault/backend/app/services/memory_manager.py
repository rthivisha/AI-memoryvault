"""
Memory Manager: Core business logic layer for AI MemoVault memory records.
Enforces strict per-user isolation, automatic AI classification fallback,
TF-IDF keyword extraction, Jaccard similarity relations, and inverted-index sync.
"""

from typing import Optional
from app.exceptions import (
    MemoryNotFoundException,
    InvalidInputException,
)
from app.models.memory import Memory, VALID_CATEGORIES
from app.storage.file_storage import FileStorage
from app.storage.inverted_index import UserInvertedIndex
from app.services.ai_service import AIService
from app.utils.validation_util import (
    validate_title,
    validate_description,
    validate_date,
    validate_category,
)


class MemoryManager:
    """
    Manages user memory records lifecycle, index synchronization,
    and user isolation boundaries.
    """

    def __init__(self, storage: FileStorage, index_manager: UserInvertedIndex) -> None:
        self.storage: FileStorage = storage
        self.index_manager: UserInvertedIndex = index_manager
        self._initialize_index()

    def _initialize_index(self) -> None:
        """Loads all stored memories and builds inverted index."""
        memories = self.storage.load_memories()
        self.index_manager.rebuild(memories)

    def _get_user_corpus_texts(self, owner_id: str) -> list[str]:
        """Returns list of searchable text for all records belonging to owner_id."""
        memories = self.storage.load_memories()
        return [
            f"{m.title} {m.description}"
            for m in memories
            if m.owner_id == owner_id
        ]

    def get_memories_for_user(
        self,
        owner_id: str,
        category: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> list[Memory]:
        """
        Retrieves all memories belonging to owner_id, sorted newest first.
        Applies optional category and date-range filters.
        """
        all_memories = self.storage.load_memories()
        user_memories = [m for m in all_memories if m.owner_id == owner_id]

        filtered = user_memories
        if category:
            cat_upper = category.strip().upper()
            filtered = [m for m in filtered if m.category == cat_upper]
        if from_date:
            filtered = [m for m in filtered if m.date >= from_date]
        if to_date:
            filtered = [m for m in filtered if m.date <= to_date]

        filtered.sort()
        return filtered

    def get_memory_by_id(self, owner_id: str, memory_id: str) -> Memory:
        """
        Retrieves memory by ID for owner_id.
        Returns identical 404 for nonexistent records or records owned by other users.
        """
        all_memories = self.storage.load_memories()
        for m in all_memories:
            if m.memory_id == memory_id and m.owner_id == owner_id:
                return m

        raise MemoryNotFoundException(f"No memory record with ID '{memory_id}' exists for the current user.")

    def create_memory(
        self,
        owner_id: str,
        title: str,
        date_str: str,
        description: str,
        category: Optional[str] = None,
    ) -> tuple[Memory, str, float]:
        """
        Creates and persists a new memory record.
        If category is omitted, uses AI Lexicon Classifier.
        Extracts TF-IDF keywords from the user's corpus.
        Returns: (memory, suggested_category, confidence)
        """
        clean_title = validate_title(title)
        clean_date = validate_date(date_str)
        clean_desc = validate_description(description)

        suggested_category, confidence = AIService.classify(clean_title, clean_desc)

        final_category = validate_category(category) if category else suggested_category

        corpus_texts = self._get_user_corpus_texts(owner_id)
        keywords = AIService.extract_keywords(corpus_texts, clean_title, clean_desc)

        memory_id = self.storage.get_next_memory_id()

        new_memory = Memory(
            memory_id=memory_id,
            owner_id=owner_id,
            title=clean_title,
            category=final_category,
            date=clean_date,
            description=clean_desc,
            keywords=keywords,
        )

        self.storage.append_memory(new_memory)
        self.index_manager.add(new_memory)

        return (new_memory, suggested_category, confidence)

    def update_memory(
        self,
        owner_id: str,
        memory_id: str,
        title: str,
        date_str: str,
        description: str,
        category: str,
    ) -> Memory:
        """
        Updates an existing memory record, refreshes TF-IDF keywords and inverted index.
        Enforces user ownership.
        """
        target = self.get_memory_by_id(owner_id, memory_id)

        clean_title = validate_title(title)
        clean_date = validate_date(date_str)
        clean_desc = validate_description(description)
        clean_cat = validate_category(category)

        target.title = clean_title
        target.date = clean_date
        target.description = clean_desc
        target.category = clean_cat

        # Refresh keywords
        corpus_texts = self._get_user_corpus_texts(owner_id)
        target.keywords = AIService.extract_keywords(corpus_texts, clean_title, clean_desc)

        all_memories = self.storage.load_memories()
        for idx, m in enumerate(all_memories):
            if m.memory_id == memory_id and m.owner_id == owner_id:
                all_memories[idx] = target
                break

        self.storage.rewrite_memories(all_memories)
        self.index_manager.update(target)

        return target

    def delete_memory(self, owner_id: str, memory_id: str, confirm: bool = False) -> None:
        """
        Deletes a memory record with explicit confirmation.
        Enforces user ownership.
        """
        if not confirm:
            raise InvalidInputException("Confirmation required before deletion.")

        self.get_memory_by_id(owner_id, memory_id)

        all_memories = self.storage.load_memories()
        remaining = [m for m in all_memories if not (m.memory_id == memory_id and m.owner_id == owner_id)]

        self.storage.rewrite_memories(remaining)
        self.index_manager.remove(owner_id, memory_id)

    def get_related_memories(self, owner_id: str, memory_id: str) -> list[tuple[Memory, float]]:
        """
        Calculates Jaccard similarity against all other memories of this user.
        Returns top 5 related records with J > 0, sorted descending.
        """
        target = self.get_memory_by_id(owner_id, memory_id)
        user_memories = self.get_memories_for_user(owner_id)

        target_text = f"{target.title} {target.category} {target.description}"
        related: list[tuple[Memory, float]] = []

        for m in user_memories:
            if m.memory_id == target.memory_id:
                continue
            other_text = f"{m.title} {m.category} {m.description}"
            sim = AIService.calculate_jaccard(target_text, other_text)
            if sim > 0:
                related.append((m, round(sim, 2)))

        related.sort(key=lambda item: (-item[1], -int(item[0].date.replace("-", ""))))
        return related[:5]

    def get_stats(self, owner_id: str) -> dict:
        """
        Calculates summary metrics: total records, per-category breakdown, and recent records.
        """
        user_memories = self.get_memories_for_user(owner_id)
        by_category = {cat: 0 for cat in sorted(VALID_CATEGORIES)}
        for m in user_memories:
            if m.category in by_category:
                by_category[m.category] += 1

        recent = [m.to_dict() for m in user_memories[:5]]
        return {
            "total": len(user_memories),
            "by_category": by_category,
            "recent": recent,
        }
