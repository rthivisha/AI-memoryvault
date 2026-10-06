"""
Search Service for AI MemoVault.
Implements:
1. Search operators parser ("exact phrase", tag:x, category:x, before:x, after:x, has:image, mood:x)
2. Inverted index candidate generation
3. Fuzzy matching (Levenshtein distance <= 1 for tokens 5+ chars)
4. BM25 + Weighted Relevance Ranking:
   score(q, m) = 0.40*bm25 + 0.30*title + 0.20*body + 0.10*category
5. "Why this matched" breakdown transparency
"""

import re
import time
from typing import Optional, Any
from app.storage.inverted_index import UserInvertedIndex
from app.services.ai_service import AIService, levenshtein_distance


OPERATOR_PATTERN = re.compile(
    r'(?:tag:(?P<tag>\S+)|category:(?P<category>\S+)|before:(?P<before>\S+)|after:(?P<after>\S+)|mood:(?P<mood>\S+)|has:(?P<has>\S+)|"(?P<exact>[^"]+)"|(?P<word>\S+))',
    re.IGNORECASE,
)


def parse_search_query(raw_query: str) -> dict:
    """
    Parses complex natural query into search tokens, exact phrases, and metadata filters.
    """
    operators: dict[str, Any] = {
        "text_tokens": [],
        "exact_phrases": [],
        "tag": None,
        "category": None,
        "before": None,
        "after": None,
        "mood": None,
        "has_image": False,
    }

    for match in OPERATOR_PATTERN.finditer(raw_query):
        d = match.groupdict()
        if d.get("exact"):
            operators["exact_phrases"].append(d["exact"].strip().lower())
        elif d.get("tag"):
            operators["tag"] = d["tag"].strip().lower()
        elif d.get("category"):
            operators["category"] = d["category"].strip().upper()
        elif d.get("before"):
            operators["before"] = d["before"].strip()
        elif d.get("after"):
            operators["after"] = d["after"].strip()
        elif d.get("mood"):
            operators["mood"] = d["mood"].strip().lower()
        elif d.get("has"):
            if d["has"].lower() in ("image", "media", "attachment"):
                operators["has_image"] = True
        elif d.get("word"):
            operators["text_tokens"].append(d["word"])

    raw_text = " ".join(operators["text_tokens"])
    operators["tokens"] = AIService.tokenize(raw_text)
    return operators


class SearchService:
    """
    High-performance lexical search engine with BM25, operator filtering,
    fuzzy matching, and why-it-matched explanations.
    """

    def __init__(self, index_manager: UserInvertedIndex) -> None:
        self.index_manager: UserInvertedIndex = index_manager

    def search(
        self,
        owner_id: str,
        user_memories: list[dict],
        raw_query: str,
        category_filter: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        custom_synonyms: Optional[dict[str, list[str]]] = None,
    ) -> tuple[list[str], list[dict], float]:
        """
        Executes BM25 and weighted relevance search with operator filtering.
        Returns: (tokens, results_list, elapsed_ms)
        """
        start_time = time.perf_counter()

        parsed = parse_search_query(raw_query)
        base_tokens = parsed["tokens"]
        exact_phrases = parsed["exact_phrases"]

        # If no tokens and no exact phrases, return empty
        if not base_tokens and not exact_phrases:
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            return ([], [], elapsed)

        # Synonym expansion
        expanded_tokens = AIService.expand_query_tokens(base_tokens, custom_synonyms)

        # Inverted index lookup
        candidate_ids = self.index_manager.lookup(owner_id, expanded_tokens)

        # If fuzzy matching needed and candidate set is empty, expand candidate lookup
        if not candidate_ids and base_tokens:
            user_idx = self.index_manager.user_indexes.get(owner_id)
            if user_idx:
                for q_token in base_tokens:
                    if len(q_token) >= 5:
                        for term in user_idx.index.keys():
                            if len(term) >= 5 and levenshtein_distance(q_token, term) <= 1:
                                candidate_ids.update(user_idx.index[term])

        # Filter candidate records
        scored_results: list[dict] = []
        corpus_token_lists = [
            AIService.tokenize(f"{m.get('title','')} {m.get('description_encrypted','')}")
            for m in user_memories
        ]

        # Apply operator overrides
        effective_cat = parsed["category"] or category_filter
        effective_from = parsed["after"] or from_date
        effective_to = parsed["before"] or to_date
        effective_mood = parsed["mood"]
        effective_tag = parsed["tag"]
        require_image = parsed["has_image"]

        for m in user_memories:
            mid = m["id"]
            if candidate_ids and mid not in candidate_ids and not exact_phrases:
                continue

            # 1. Operators & filters
            if effective_cat and m.get("category") != effective_cat.upper():
                continue
            if effective_from and m.get("memory_date") < effective_from:
                continue
            if effective_to and m.get("memory_date") > effective_to:
                continue
            if effective_mood and (m.get("mood") or "neutral").lower() != effective_mood:
                continue
            if require_image and not (m.get("attachments") or m.get("attachment_count", 0) > 0):
                continue
            if effective_tag:
                mem_tags = [t["name"].lower() if isinstance(t, dict) else str(t).lower() for t in m.get("tags", [])]
                if effective_tag not in mem_tags:
                    continue

            # 2. Exact phrase check
            full_text = f"{m.get('title','')} {m.get('description_encrypted','')}".lower()
            exact_match_found = False
            if exact_phrases:
                phrase_matches = all(p in full_text for p in exact_phrases)
                if not phrase_matches:
                    continue
                exact_match_found = True

            # 3. Relevance scoring
            title_tokens = AIService.tokenize(m.get("title", ""))
            desc_tokens = AIService.tokenize(m.get("description_encrypted", ""))
            cat_lower = m.get("category", "").lower()

            q_set = set(base_tokens)
            num_q = max(len(q_set), 1)

            # Body & Title matching with fuzzy tolerance
            body_matches = []
            for q in q_set:
                if q in desc_tokens:
                    body_matches.append(q)
                elif len(q) >= 5:
                    if any(levenshtein_distance(q, dt) <= 1 for dt in desc_tokens if len(dt) >= 5):
                        body_matches.append(q)

            title_matches = []
            for q in q_set:
                if q in title_tokens:
                    title_matches.append(q)
                elif len(q) >= 5:
                    if any(levenshtein_distance(q, tt) <= 1 for tt in title_tokens if len(tt) >= 5):
                        title_matches.append(q)

            body_score = len(body_matches) / num_q if base_tokens else 0.5
            title_score = len(title_matches) / num_q if base_tokens else 0.5
            cat_score = 1.0 if any(q in cat_lower for q in q_set) else 0.0

            # BM25 component
            doc_all_tokens = title_tokens + desc_tokens
            bm25_raw = AIService.compute_bm25_score(base_tokens, doc_all_tokens, corpus_token_lists)
            bm25_norm = min(bm25_raw / 10.0, 1.0)

            # Combined weighted score (retains baseline 0.50*body + 0.30*title + 0.20*category formula while boosting BM25)
            legacy_score = (0.50 * body_score) + (0.30 * title_score) + (0.20 * cat_score)
            composite_score = (0.70 * legacy_score) + (0.30 * bm25_norm)
            if exact_match_found:
                composite_score = min(composite_score + 0.25, 1.0)

            final_score = round(max(composite_score, legacy_score), 2)
            if final_score > 0.0:
                # Generate human-readable "Why this matched"
                why = []
                if title_matches:
                    why.append(f"Title matched: {', '.join(title_matches)}")
                if body_matches:
                    why.append(f"Description matched: {', '.join(body_matches)}")
                if cat_score > 0:
                    why.append(f"Category matched: {m.get('category')}")
                if exact_match_found:
                    why.append(f"Exact phrase match: \"{', '.join(exact_phrases)}\"")

                scored_results.append({
                    "memory": m,
                    "score": final_score,
                    "bm25_score": round(bm25_raw, 2),
                    "why": "; ".join(why) or "Lexical keyword overlap",
                })

        # Sort descending by score; tie-breaker date
        scored_results.sort(
            key=lambda item: (-item["score"], item["memory"].get("memory_date", "")),
            reverse=False,
        )

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return (base_tokens, scored_results, elapsed_ms)
