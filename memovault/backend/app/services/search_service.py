"""
Search Service for AI MemoVault.
Implements lexical relevance scoring using Candidate Generation via Inverted Index
and Weighted Formula:
  score(q, m) = 0.50*body(q, m) + 0.30*title(q, m) + 0.20*category(q, m)
"""

import time
from typing import Optional
from app.models.memory import Memory
from app.storage.inverted_index import UserInvertedIndex
from app.services.ai_service import AIService


class SearchService:
    """
    Handles lexical search and relevance scoring for user memory records.
    Filters candidate records using InvertedIndex before scoring to achieve sub-millisecond latency.
    """

    def __init__(self, index_manager: UserInvertedIndex) -> None:
        self.index_manager: UserInvertedIndex = index_manager

    def search(
        self,
        owner_id: str,
        user_memories: list[Memory],
        query: str,
        category_filter: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> tuple[list[str], list[tuple[Memory, float]], float]:
        """
        Executes weighted relevance search:
        1. Tokenize query text with stop-word removal.
        2. Lookup candidate IDs via InvertedIndex for owner_id.
        3. Score ONLY candidate records for that user.
        4. Apply optional category and date-range filters.
        5. Drop records with score <= 0.
        6. Sort descending by score (secondary: newest date first).
        Returns: (tokens, [(memory, score), ...], elapsed_ms)
        """
        start_time = time.perf_counter()

        tokens = AIService.tokenize(query)
        if not tokens:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return ([], [], elapsed_ms)

        # Candidate retrieval via inverted index
        candidate_ids = self.index_manager.lookup(owner_id, tokens)
        if not candidate_ids:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return (tokens, [], elapsed_ms)

        memory_map: dict[str, Memory] = {
            m.memory_id: m for m in user_memories if m.memory_id in candidate_ids
        }

        query_token_set = set(tokens)
        num_query_tokens = len(query_token_set)
        scored_results: list[tuple[Memory, float]] = []

        for mem_id, memory in memory_map.items():
            # Apply optional filters
            if category_filter and memory.category != category_filter.upper():
                continue
            if from_date and memory.date < from_date:
                continue
            if to_date and memory.date > to_date:
                continue

            # Tokenize fields for relevance calculation
            title_tokens = set(AIService.tokenize(memory.title))
            desc_tokens = set(AIService.tokenize(memory.description))
            cat_lower = memory.category.lower()

            # 1. body = fraction of query tokens present in description
            body_match_count = len(query_token_set & desc_tokens)
            body_score = body_match_count / num_query_tokens if num_query_tokens > 0 else 0.0

            # 2. title = fraction of query tokens present in title
            title_match_count = len(query_token_set & title_tokens)
            title_score = title_match_count / num_query_tokens if num_query_tokens > 0 else 0.0

            # 3. category = 1.0 if any query token is contained in lowercase category name, else 0.0
            cat_score = 1.0 if any(t in cat_lower for t in query_token_set) else 0.0

            # Weighted composite score
            # score(q, m) = 0.50*body(q, m) + 0.30*title(q, m) + 0.20*category(q, m)
            total_score = (0.50 * body_score) + (0.30 * title_score) + (0.20 * cat_score)
            total_score = round(total_score, 2)

            if total_score > 0.0:
                scored_results.append((memory, total_score))

        # Sort descending by score; secondary sort: newest date first, then memoryId descending
        scored_results.sort(
            key=lambda item: (-item[1], -int(item[0].date.replace("-", "")), item[0].memory_id),
            reverse=False,
        )

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return (tokens, scored_results, elapsed_ms)
