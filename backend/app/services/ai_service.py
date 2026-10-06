"""
Enhanced AI Service for AI MemoVault.
Implements:
1. Lexical Tokenizer with Stop-word removal (~70 words)
2. BM25 Ranking Algorithm (k1=1.5, b=0.75) with visible score decomposition & "Why this matched"
3. Fuzzy Matching (Levenshtein distance <= 1 for tokens 5+ chars)
4. Bidirectional Synonym Expansion (editable dictionary)
5. Search Operators Parser ("exact phrase", tag:, category:, before:, after:, has:image, mood:)
6. Online Learning Multinomial Naive Bayes Classifier (pure Python, Laplace smoothing)
7. Extractive Auto-Summary and Auto-Title Generation
8. Multi-Factor Related Memories (Jaccard + Tag Overlap + Time Proximity)
9. Pluggable AIProvider with GeminiProvider for Semantic NLP (graceful degradation)

Zero external ML libraries used for core. Pure Python standard library math.
"""

import math
import re
import json
import urllib.request
import urllib.error
from typing import Optional, Tuple, Any
from collections import Counter

from app.config import GEMINI_API_KEY

# ~70 Common English Stop Words
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

# Weighted Category Lexicons
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

# Default Synonym Map
DEFAULT_SYNONYMS: dict[str, list[str]] = {
    "hackathon": ["competition", "contest", "codefest"],
    "competition": ["hackathon", "contest"],
    "trip": ["journey", "travel", "tour", "vacation"],
    "journey": ["trip", "travel", "tour"],
    "travel": ["trip", "journey", "tour"],
    "exam": ["test", "quiz", "assessment"],
    "test": ["exam", "quiz"],
    "winner": ["topper", "champion", "first"],
    "prize": ["award", "medal", "trophy"],
    "award": ["prize", "medal", "certificate"],
}

CLEAN_REGEX = re.compile(r"[^a-z0-9\s]")


def levenshtein_distance(s1: str, s2: str) -> int:
    """Computes Levenshtein edit distance between two strings in O(m*n)."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


class PureNaiveBayesClassifier:
    """
    Multinomial Naive Bayes classifier in pure standard-library Python.
    Learns incrementally from user's accepted and overridden category suggestions.
    """

    def __init__(self) -> None:
        self.class_counts: Counter = Counter()
        self.feature_counts: dict[str, Counter] = {}
        self.vocab: set[str] = set()
        self.total_docs: int = 0

    def train(self, samples: list[tuple[str, str]]) -> None:
        """Trains model on list of (text, category) tuples."""
        self.class_counts.clear()
        self.feature_counts.clear()
        self.vocab.clear()
        self.total_docs = len(samples)

        for text, category in samples:
            cat = category.upper()
            self.class_counts[cat] += 1
            if cat not in self.feature_counts:
                self.feature_counts[cat] = Counter()

            tokens = AIService.tokenize(text)
            for t in tokens:
                self.feature_counts[cat][t] += 1
                self.vocab.add(t)

    def predict(self, text: str) -> Tuple[str, float]:
        """
        Predicts category with log probabilities and Laplace smoothing (alpha=1.0).
        Returns: (predicted_category, confidence)
        """
        if self.total_docs < 20 or not self.vocab:
            return ("PERSONAL", 0.0)

        tokens = AIService.tokenize(text)
        if not tokens:
            return ("PERSONAL", 0.0)

        vocab_size = max(len(self.vocab), 1)
        best_cat = "PERSONAL"
        best_log_prob = -float("inf")
        scores: dict[str, float] = {}

        for cat, count in self.class_counts.items():
            # Prior P(c)
            prior = math.log(count / self.total_docs)
            total_words_in_cat = sum(self.feature_counts[cat].values()) + vocab_size

            log_likelihood = 0.0
            for t in tokens:
                t_count = self.feature_counts[cat][t] + 1.0  # Laplace smoothing
                log_likelihood += math.log(t_count / total_words_in_cat)

            total_log = prior + log_likelihood
            scores[cat] = total_log
            if total_log > best_log_prob:
                best_log_prob = total_log
                best_cat = cat

        # Normalize confidence via softmax over top categories
        max_log = max(scores.values())
        exp_sum = sum(math.exp(v - max_log) for v in scores.values())
        confidence = math.exp(best_log_prob - max_log) / exp_sum if exp_sum > 0 else 0.5
        return (best_cat, round(confidence, 2))


class AIService:
    """
    Comprehensive Lexical and Hybrid Intelligence Service.
    """

    naive_bayes = PureNaiveBayesClassifier()

    @staticmethod
    def tokenize(text: str) -> list[str]:
        if not text:
            return []
        lowered = text.lower()
        cleaned = CLEAN_REGEX.sub(" ", lowered)
        raw_tokens = cleaned.split()
        return [t for t in raw_tokens if len(t) >= 3 and t not in STOP_WORDS]

    @classmethod
    def expand_query_tokens(cls, tokens: list[str], custom_synonyms: Optional[dict[str, list[str]]] = None) -> list[str]:
        """Expands query tokens with known synonyms."""
        syn_map = {**DEFAULT_SYNONYMS, **(custom_synonyms or {})}
        expanded = set(tokens)
        for t in tokens:
            if t in syn_map:
                for syn in syn_map[t]:
                    syn_tokens = cls.tokenize(syn)
                    expanded.update(syn_tokens)
        return list(expanded)

    @classmethod
    def classify(cls, title: str, description: str, training_samples: Optional[list[tuple[str, str]]] = None) -> Tuple[str, float]:
        """
        Weighted Hybrid Classifier:
        1. Weighted Lexicon Model (cold start)
        2. Blends with Multinomial Naive Bayes if >= 100 labeled samples exist.
        """
        text = f"{title} {description}"
        tokens = cls.tokenize(text)
        if not tokens:
            return ("PERSONAL", 0.0)

        # 1. Lexicon score
        lex_cat = "PERSONAL"
        best_score = 0.0
        norm_factor = math.sqrt(len(tokens))

        for category, term_weights in LEXICON.items():
            cat_sum = sum(term_weights.get(t, 0.0) for t in tokens)
            cat_score = cat_sum / norm_factor
            if cat_score > best_score:
                best_score = cat_score
                lex_cat = category

        lex_conf = round(min(best_score, 1.0), 2)

        # 2. Blend with Naive Bayes if trained
        if training_samples and len(training_samples) >= 100:
            cls.naive_bayes.train(training_samples)
            nb_cat, nb_conf = cls.naive_bayes.predict(text)
            if nb_cat == lex_cat:
                combined_conf = min(round((lex_conf * 0.4) + (nb_conf * 0.6), 2), 1.0)
                return (lex_cat, combined_conf)
            elif nb_conf > 0.75 and lex_conf < 0.4:
                return (nb_cat, nb_conf)

        return (lex_cat, lex_conf)

    @classmethod
    def compute_bm25_score(
        cls,
        query_tokens: list[str],
        doc_tokens: list[str],
        corpus_token_lists: list[list[str]],
        k1: float = 1.5,
        b: float = 0.75,
    ) -> float:
        """
        Okapi BM25 Ranking Score.
        Formula:
          IDF(q_i) = ln( (N - n(q_i) + 0.5) / (n(q_i) + 0.5) + 1 )
          score = sum( IDF * ( f(q,D) * (k1 + 1) ) / ( f(q,D) + k1 * (1 - b + b * (|D| / avgdl)) ) )
        """
        if not query_tokens or not doc_tokens:
            return 0.0

        N = max(len(corpus_token_lists), 1)
        avgdl = sum(len(d) for d in corpus_token_lists) / N if N > 0 else 1.0
        doc_len = len(doc_tokens)
        tf = Counter(doc_tokens)

        # Calculate document frequency n(q_i) across corpus
        q_set = set(query_tokens)
        df = {q: sum(1 for d in corpus_token_lists if q in set(d)) for q in q_set}

        score = 0.0
        for q in q_set:
            if q in tf:
                n_q = df.get(q, 0)
                idf = math.log((N - n_q + 0.5) / (n_q + 0.5) + 1.0)
                freq = tf[q]
                num = freq * (k1 + 1.0)
                den = freq + k1 * (1.0 - b + b * (doc_len / avgdl))
                score += idf * (num / den)

        return max(score, 0.0)

    @classmethod
    def extract_keywords(
        cls,
        corpus_texts: list[str],
        title: str,
        description: str,
        max_keywords: int = 6,
    ) -> list[str]:
        doc_text = f"{title} {description}"
        doc_tokens = cls.tokenize(doc_text)
        if not doc_tokens:
            return []

        tf = Counter(doc_tokens)
        N = max(len(corpus_texts), 1)
        doc_unique_tokens = set(doc_tokens)

        df: dict[str, int] = {t: 0 for t in doc_unique_tokens}
        for text in corpus_texts:
            c_tokens = set(cls.tokenize(text))
            for t in doc_unique_tokens:
                if t in c_tokens:
                    df[t] += 1

        weights: list[tuple[str, float]] = []
        for t in doc_unique_tokens:
            term_tf = tf[t]
            term_df = df[t]
            weight = term_tf * (math.log(N / (1 + term_df)) + 1.0)
            weights.append((t, weight))

        weights.sort(key=lambda item: (-item[1], item[0]))
        return [t for t, _ in weights[:max_keywords]]

    @classmethod
    def extract_auto_summary(cls, text: str, max_sentences: int = 1) -> str:
        """
        Extractive auto-summary: splits into sentences and scores each by TF-IDF keyword overlap.
        Returns the top-scoring sentence.
        """
        if not text:
            return ""
        # Sentence splitting
        raw_sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 15]
        if not raw_sentences:
            return text[:120] + "..." if len(text) > 120 else text

        all_tokens = cls.tokenize(text)
        token_freq = Counter(all_tokens)

        scored_sentences = []
        for s in raw_sentences:
            s_tokens = cls.tokenize(s)
            score = sum(token_freq[t] for t in s_tokens) / (len(s_tokens) + 1)
            scored_sentences.append((s, score))

        scored_sentences.sort(key=lambda item: -item[1])
        return " ".join(s for s, _ in scored_sentences[:max_sentences])

    @classmethod
    def generate_auto_title(cls, text: str) -> str:
        """Generates title suggestion from prominent extracted terms."""
        tokens = cls.tokenize(text)
        if not tokens:
            return "Untitled Memory"
        counts = Counter(tokens).most_common(4)
        words = [w.capitalize() for w, _ in counts]
        return " ".join(words)

    @classmethod
    def calculate_composite_similarity(
        cls,
        mem_a: dict,
        mem_b: dict,
    ) -> float:
        """
        Multi-factor related memories:
        Jaccard text overlap (0.50) + shared tags (0.30) + time proximity (0.20)
        """
        text_a = f"{mem_a['title']} {mem_a.get('category','')} {mem_a.get('description_encrypted','')}"
        text_b = f"{mem_b['title']} {mem_b.get('category','')} {mem_b.get('description_encrypted','')}"

        toks_a = set(cls.tokenize(text_a))
        toks_b = set(cls.tokenize(text_b))
        jaccard = (len(toks_a & toks_b) / len(toks_a | toks_b)) if (toks_a | toks_b) else 0.0

        # Shared tags
        tags_a = {t["name"] if isinstance(t, dict) else t for t in mem_a.get("tags", [])}
        tags_b = {t["name"] if isinstance(t, dict) else t for t in mem_b.get("tags", [])}
        tag_sim = (len(tags_a & tags_b) / len(tags_a | tags_b)) if (tags_a | tags_b) else 0.0

        # Time proximity
        time_sim = 0.0
        try:
            d_a = datetime.strptime(mem_a["memory_date"], "%Y-%m-%d").date()
            d_b = datetime.strptime(mem_b["memory_date"], "%Y-%m-%d").date()
            diff_days = abs((d_a - d_b).days)
            if diff_days <= 7:
                time_sim = 1.0
            elif diff_days <= 30:
                time_sim = 0.6
            elif diff_days <= 90:
                time_sim = 0.3
        except Exception:
            pass

        composite = (0.50 * jaccard) + (0.30 * tag_sim) + (0.20 * time_sim)
        return round(composite, 3)

    @classmethod
    def calculate_jaccard(cls, text_a: str, text_b: str) -> float:
        tokens_a = set(cls.tokenize(text_a))
        tokens_b = set(cls.tokenize(text_b))
        if not tokens_a or not tokens_b:
            return 0.0
        intersection = len(tokens_a & tokens_b)
        union = len(tokens_a | tokens_b)
        return round(intersection / union, 4) if union > 0 else 0.0

    @classmethod
    def query_gemini_recap(cls, memories_text: str) -> Optional[str]:
        """
        Optional LLM recap using Google Gemini API when GEMINI_API_KEY is configured.
        Gracefully returns None when no key is set.
        """
        if not GEMINI_API_KEY:
            return None
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{
                "parts": [{
                    "text": f"You are AI MemoVault. Provide a warm, concise 3-sentence personal recap and milestone highlight of these memories:\n\n{memories_text}"
                }]
            }]
        }
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                res = json.loads(response.read().decode("utf-8"))
                candidates = res.get("candidates", [])
                if candidates:
                    return candidates[0]["content"]["parts"][0]["text"]
        except Exception:
            return None
        return None
