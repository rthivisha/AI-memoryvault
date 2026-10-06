"""
In-memory Inverted Index for ultra-fast lexical candidate retrieval.
Structure: dict[str term, set[str memoryId]]
Provides O(1) term lookup with posting list unions (OR semantics).
Rebuilt on startup and maintained incrementally across creates, updates, and deletes.
"""

from typing import Optional
from app.models.memory import Memory


class InvertedIndex:
    """
    Inverted index mapping individual token terms to memory IDs.
    """

    def __init__(self) -> None:
        self.index: dict[str, set[str]] = {}

    def add(self, memory: Memory) -> None:
        """
        Tokenizes memory's searchable text (title + category + description)
        and adds its ID to the corresponding term posting sets.
        """
        from app.services.ai_service import AIService
        searchable_text = f"{memory.title} {memory.category} {memory.description}"
        tokens = AIService.tokenize(searchable_text)
        for term in set(tokens):
            if term not in self.index:
                self.index[term] = set()
            self.index[term].add(memory.memory_id)

    def remove(self, memory_id: str) -> None:
        """
        Removes memory_id from all posting sets and cleans up empty sets.
        """
        terms_to_delete: list[str] = []
        for term, postings in self.index.items():
            if memory_id in postings:
                postings.remove(memory_id)
                if not postings:
                    terms_to_delete.append(term)
        for term in terms_to_delete:
            del self.index[term]

    def lookup(self, query_tokens: list[str]) -> set[str]:
        """
        Performs UNION of posting sets for all tokens in the query (OR semantics).
        Returns a set of candidate memory IDs.
        """
        candidate_ids: set[str] = set()
        for token in query_tokens:
            if token in self.index:
                candidate_ids.update(self.index[token])
        return candidate_ids

    def rebuild(self, memories: list[Memory]) -> None:
        """Clears existing postings and rebuilds from the provided memories."""
        self.index.clear()
        for m in memories:
            self.add(m)

    def get_terms_count(self) -> int:
        return len(self.index)


class UserInvertedIndex:
    """
    Manages isolated inverted indexes per user to guarantee zero cross-tenant leakage.
    """

    def __init__(self) -> None:
        self.user_indexes: dict[str, InvertedIndex] = {}

    def _get_or_create(self, owner_id: str) -> InvertedIndex:
        if owner_id not in self.user_indexes:
            self.user_indexes[owner_id] = InvertedIndex()
        return self.user_indexes[owner_id]

    def add(self, memory: Memory) -> None:
        index = self._get_or_create(memory.owner_id)
        index.add(memory)

    def remove(self, owner_id: str, memory_id: str) -> None:
        if owner_id in self.user_indexes:
            self.user_indexes[owner_id].remove(memory_id)

    def update(self, memory: Memory) -> None:
        self.remove(memory.owner_id, memory.memory_id)
        self.add(memory)

    def lookup(self, owner_id: str, query_tokens: list[str]) -> set[str]:
        if owner_id not in self.user_indexes:
            return set()
        return self.user_indexes[owner_id].lookup(query_tokens)

    def rebuild(self, memories: list[Memory]) -> None:
        self.user_indexes.clear()
        for m in memories:
            self.add(m)
