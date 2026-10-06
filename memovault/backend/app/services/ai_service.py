"""
AI Service: Hand-crafted lexical AI layer for AI MemoVault.
Implements:
1. Lexical Tokenizer with Stop-word removal (~70 words)
2. TF-IDF Keyword Extraction: w(t,d) = tf(t,d) * (ln(N / (1 + df(t))) + 1)
3. Weighted Lexicon Classifier for Category Suggestion
4. Jaccard Similarity for Related Records: J(A,B) = |A ∩ B| / |A ∪ B|

No third-party ML/NLP libraries used. All algorithms implemented using Python standard library.
"""

import math
import re
from typing import Optional
from collections import Counter

# ~70 Common English Stop Words (O(1) set lookup).
# Includes words like 'show', 'tell', 'find', 'get' to eliminate query noise.
STOP_WORDS: set[str] = {
    "the", "and", "with", "this", "that", "for", "are", "was", "were",
    "you", "your", "our", "his", "her", "its", "from", "have", "has",
    "had", "but", "not", "all", "can", "will", "would", "should", "could",
    "about", "into", "over", "than", "then", "them", "they", "their", "there",
    "here", "what", "when", "where", "which", "who", "whom", "why", "how",
    "show", "tell", "give", "find", "get", "got", "any", "some", "such",
    "only", "own", "same", "too", "very", "just", "also", "been", "being",
    "did", "does", "doing", "off", "out", "again", "once", "more", "most",
    "other", "each", "both", "few", "nor", "per", "via", "upon", "mine",
}

# Weighted Category Lexicons (term weights per category)
LEXICON: dict[str, dict[str, float]] = {
    "ACHIEVEMENT": {
        "won": 0.90, "winner": 0.90, "prize": 0.90, "award": 0.90,
        "rank": 0.90, "first": 0.90, "hackathon": 0.90, "certificate": 0.90,
        "selected": 0.90, "medal": 0.90, "topper": 0.90, "published": 0.90,
        "qualified": 0.90,
    },
    "EVENT": {
        "event": 0.80, "seminar": 0.80, "workshop": 0.80, "symposium": 0.80,
        "fest": 0.80, "conference": 0.80, "meeting": 0.80, "celebration": 0.80,
        "function": 0.80, "competition": 0.80, "club": 0.80,
    },
    "STUDY": {
        "exam": 0.80, "class": 0.80, "lecture": 0.80, "semester": 0.80,
        "subject": 0.80, "notes": 0.80, "unit": 0.80, "assignment": 0.80,
        "lab": 0.80, "syllabus": 0.80, "course": 0.80, "java": 0.80,
        "revision": 0.80,
    },
    "TRAVEL": {
        "trip": 0.85, "travel": 0.85, "visit": 0.85, "journey": 0.85,
        "tour": 0.85, "temple": 0.85, "beach": 0.85, "station": 0.85,
        "flight": 0.85, "hotel": 0.85, "holiday": 0.85,
    },
    "REMINDER": {
        "reminder": 0.85, "deadline": 0.85, "submit": 0.85, "submission": 0.85,
        "due": 0.85, "pay": 0.85, "renew": 0.85, "appointment": 0.85,
        "tomorrow": 0.85, "schedule": 0.85,
    },
    "PERSONAL": {
        "family": 0.70, "friend": 0.70, "birthday": 0.70, "home": 0.70,
        "mother": 0.70, "father": 0.70, "brother": 0.70, "sister": 0.70,
        "gift": 0.70, "dinner": 0.70,
    },
}

CLEAN_REGEX = re.compile(r"[^a-z0-9\s]")


class AIService:
    """
    Intelligent Lexical Processing Service.
    Sits beside the business layer. If disabled, degrades to plain keyword matching.
    """

    @staticmethod
    def tokenize(text: str) -> list[str]:
        """
        Tokenizes text:
        1. Lowercase
        2. Replace all characters not [a-z0-9] or whitespace with space
        3. Split on whitespace
        4. Discard tokens shorter than 3 characters or in STOP_WORDS
        """
        if not text:
            return []
        lowered = text.lower()
        cleaned = CLEAN_REGEX.sub(" ", lowered)
        raw_tokens = cleaned.split()
        return [t for t in raw_tokens if len(t) >= 3 and t not in STOP_WORDS]

    @classmethod
    def classify(cls, title: str, description: str) -> tuple[str, float]:
        """
        Weighted Lexicon Category Classifier.
        Formula:
          score(c) = ( sum_{t in tokens} weight(c, t) ) / sqrt( len(tokens) )
        Highest score category wins. Returns (category, min(bestScore, 1.0)).
        If tokens are empty or score == 0, returns ("PERSONAL", 0.0).
        """
        text = f"{title} {description}"
        tokens = cls.tokenize(text)
        if not tokens:
            return ("PERSONAL", 0.0)

        best_category = "PERSONAL"
        best_score = 0.0
        norm_factor = math.sqrt(len(tokens))

        for category, term_weights in LEXICON.items():
            category_weight_sum = sum(term_weights.get(t, 0.0) for t in tokens)
            category_score = category_weight_sum / norm_factor
            if category_score > best_score:
                best_score = category_score
                best_category = category

        if best_score <= 0.0:
            return ("PERSONAL", 0.0)

        confidence = round(min(best_score, 1.0), 2)
        return (best_category, confidence)

    @classmethod
    def extract_keywords(
        cls,
        corpus_texts: list[str],
        title: str,
        description: str,
        max_keywords: int = 6,
    ) -> list[str]:
        """
        TF-IDF Keyword Extractor.
        Formula:
          w(t, d) = tf(t, d) * ( ln( N / (1 + df(t)) ) + 1 )
        where:
          tf(t, d) = occurrences of token t in record text (title + description)
          N = number of records in user corpus (max(N, 1))
          df(t) = number of records in corpus containing token t
        Returns up to max_keywords highest-weighted terms, sorted descending.
        """
        doc_text = f"{title} {description}"
        doc_tokens = cls.tokenize(doc_text)
        if not doc_tokens:
            return []

        tf = Counter(doc_tokens)
        N = max(len(corpus_texts), 1)

        # Precompute document frequencies df(t) for tokens appearing in this document
        doc_unique_tokens = set(doc_tokens)
        df: dict[str, int] = {t: 0 for t in doc_unique_tokens}

        for text in corpus_texts:
            c_tokens = set(cls.tokenize(text))
            for t in doc_unique_tokens:
                if t in c_tokens:
                    df[t] += 1

        # Calculate TF-IDF weight for each unique token in document
        weights: list[tuple[str, float]] = []
        for t in doc_unique_tokens:
            term_tf = tf[t]
            term_df = df[t]
            weight = term_tf * (math.log(N / (1 + term_df)) + 1.0)
            weights.append((t, weight))

        # Sort descending by weight, tie-breaker alphabetical
        weights.sort(key=lambda item: (-item[1], item[0]))
        return [t for t, _ in weights[:max_keywords]]

    @classmethod
    def calculate_jaccard(cls, text_a: str, text_b: str) -> float:
        """
        Jaccard Similarity over token sets of two records.
        Formula:
          J(A, B) = |A ∩ B| / |A ∪ B|
        """
        tokens_a = set(cls.tokenize(text_a))
        tokens_b = set(cls.tokenize(text_b))
        if not tokens_a or not tokens_b:
            return 0.0

        intersection = len(tokens_a & tokens_b)
        union = len(tokens_a | tokens_b)
        if union == 0:
            return 0.0
        return round(intersection / union, 4)
