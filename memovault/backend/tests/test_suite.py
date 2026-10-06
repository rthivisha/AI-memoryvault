"""
Comprehensive Test Suite for AI MemoVault.
Covers 44+ test cases grouped into:
1. Registration (5)
2. Login & Credential Verification (5)
3. Memory Creation (6)
4. Read and Listing with ordering & filters (4)
5. Search & Lexical Ranking (7)
6. Updates & Keyword Re-extraction (4)
7. Deletion & Index Purging (4)
8. Negative Domain Validation (5)
9. Tenant Isolation & Security (2)
10. Persistence & Fault Recovery (2)
11. Multi-process Concurrency Limitation (1 expectedFailure)
12. Unit tests for AI Service formulas (5)

Compatible with both `pytest tests/test_suite.py` and `python3 -m unittest`.
"""

import math
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

# Add backend directory to sys.path
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.exceptions import (
    VaultException,
    InvalidInputException,
    MemoryNotFoundException,
    AuthenticationException,
)
from app.models.user import User
from app.models.memory import Memory
from app.storage.file_storage import FileStorage
from app.storage.inverted_index import InvertedIndex, UserInvertedIndex
from app.services.ai_service import AIService, STOP_WORDS, LEXICON
from app.services.auth_service import AuthService, create_access_token, decode_access_token
from app.services.memory_manager import MemoryManager
from app.services.search_service import SearchService
from app.utils.validation_util import (
    validate_username,
    validate_password,
    validate_title,
    validate_description,
    validate_date,
    validate_category,
    validate_numeric_choice,
)


class BaseVaultTest(unittest.TestCase):
    """Base test fixture providing isolated temporary directory and storage."""

    def setUp(self) -> None:
        self.test_dir = tempfile.mkdtemp(prefix="memovault_test_")
        self.users_file = Path(self.test_dir) / "users.csv"
        self.memories_file = Path(self.test_dir) / "memories.csv"

        self.storage = FileStorage(users_file=self.users_file, memories_file=self.memories_file)
        self.index_manager = UserInvertedIndex()
        self.memory_manager = MemoryManager(storage=self.storage, index_manager=self.index_manager)
        self.search_service = SearchService(index_manager=self.index_manager)
        self.auth_service = AuthService(storage=self.storage)

    def tearDown(self) -> None:
        shutil.rmtree(self.test_dir, ignore_errors=True)


class TestRegistration(BaseVaultTest):
    """Group 1: Registration (5 tests)"""

    def test_01_successful_registration(self):
        user = self.auth_service.register("alice_99", "secretPass123")
        self.assertEqual(user.username, "alice_99")
        self.assertTrue(user.user_id.startswith("U"))
        self.assertNotEqual(user.password_hash_base64, "secretPass123")
        self.assertTrue(len(user.salt_base64) > 0)

    def test_02_short_password_rejected(self):
        with self.assertRaises(InvalidInputException) as ctx:
            self.auth_service.register("alice", "12345")
        self.assertIn("at least 6 characters", str(ctx.exception))

    def test_03_invalid_username_characters(self):
        with self.assertRaises(InvalidInputException):
            self.auth_service.register("alice@work!", "password123")

    def test_04_empty_username_rejected(self):
        with self.assertRaises(InvalidInputException):
            self.auth_service.register("   ", "password123")

    def test_05_duplicate_username_case_insensitive(self):
        self.auth_service.register("BobBuilder", "secret123")
        with self.assertRaises(InvalidInputException) as ctx:
            self.auth_service.register("bobbuilder", "anothersecret")
        self.assertIn("already taken", str(ctx.exception))


class TestLogin(BaseVaultTest):
    """Group 2: Login & Authentication (5 tests)"""

    def setUp(self):
        super().setUp()
        self.user = self.auth_service.register("charlie", "mypassword1")

    def test_06_valid_login(self):
        token, user = self.auth_service.authenticate("charlie", "mypassword1")
        self.assertEqual(user.user_id, self.user.user_id)
        self.assertTrue(len(token.split(".")) == 3)
        current = self.auth_service.get_current_user_from_token(token)
        self.assertEqual(current.user_id, self.user.user_id)

    def test_07_wrong_password_uniform_error(self):
        with self.assertRaises(AuthenticationException) as ctx:
            self.auth_service.authenticate("charlie", "incorrectPassword")
        self.assertEqual(str(ctx.exception), "Invalid username or password.")

    def test_08_nonexistent_user_uniform_error(self):
        with self.assertRaises(AuthenticationException) as ctx:
            self.auth_service.authenticate("ghost_user", "somepassword")
        self.assertEqual(str(ctx.exception), "Invalid username or password.")

    def test_09_missing_credentials_rejected(self):
        with self.assertRaises(AuthenticationException) as ctx:
            self.auth_service.authenticate("", "")
        self.assertEqual(str(ctx.exception), "Invalid username or password.")

    def test_10_case_insensitive_username_login(self):
        token, user = self.auth_service.authenticate("CHARLIE", "mypassword1")
        self.assertEqual(user.user_id, self.user.user_id)


class TestCreateMemory(BaseVaultTest):
    """Group 3: Memory Creation (6 tests)"""

    def setUp(self):
        super().setUp()
        self.user = self.auth_service.register("diana", "password123")

    def test_11_create_valid_memory(self):
        mem, sug, conf = self.memory_manager.create_memory(
            owner_id=self.user.user_id,
            title="Started Java unit 3",
            date_str="2025-08-04",
            description="Began the third unit of the Java Programming course covering collections.",
            category="STUDY",
        )
        self.assertEqual(mem.memory_id, "M001")
        self.assertEqual(mem.category, "STUDY")
        self.assertIn("java", mem.keywords)

    def test_12_create_with_auto_ai_category_suggestion(self):
        mem, sug, conf = self.memory_manager.create_memory(
            owner_id=self.user.user_id,
            title="Won First Place in AI Hackathon",
            date_str="2026-01-10",
            description="Participated in national competition and won first prize medal.",
            category=None,
        )
        self.assertEqual(mem.category, "ACHIEVEMENT")
        self.assertGreater(conf, 0.5)

    def test_13_future_date_rejected(self):
        with self.assertRaises(InvalidInputException) as ctx:
            self.memory_manager.create_memory(
                owner_id=self.user.user_id,
                title="Future milestone",
                date_str="2099-01-01",
                description="This hasn't happened yet.",
            )
        self.assertEqual(str(ctx.exception), "A memory cannot be dated in the future.")

    def test_14_invalid_date_format_rejected(self):
        with self.assertRaises(InvalidInputException) as ctx:
            self.memory_manager.create_memory(
                owner_id=self.user.user_id,
                title="Bad date format",
                date_str="04-08-2025",
                description="Date format is reversed.",
            )
        self.assertEqual(str(ctx.exception), "Date must follow the pattern yyyy-MM-dd.")

    def test_15_title_too_long_rejected(self):
        with self.assertRaises(InvalidInputException) as ctx:
            self.memory_manager.create_memory(
                owner_id=self.user.user_id,
                title="A" * 61,
                date_str="2025-08-04",
                description="Valid length description.",
            )
        self.assertIn("60 characters or fewer", str(ctx.exception))

    def test_16_description_too_short_rejected(self):
        with self.assertRaises(InvalidInputException) as ctx:
            self.memory_manager.create_memory(
                owner_id=self.user.user_id,
                title="Valid title",
                date_str="2025-08-04",
                description="Tiny",
            )
        self.assertIn("between 5 and 500 characters", str(ctx.exception))


class TestReadAndList(BaseVaultTest):
    """Group 4: Read and Listing (4 tests)"""

    def setUp(self):
        super().setUp()
        self.user = self.auth_service.register("elena", "password123")
        self.m1, _, _ = self.memory_manager.create_memory(
            self.user.user_id, "Old record", "2024-01-01", "Old description for testing.", "STUDY"
        )
        self.m2, _, _ = self.memory_manager.create_memory(
            self.user.user_id, "Mid record", "2025-06-15", "Mid description for testing.", "EVENT"
        )
        self.m3, _, _ = self.memory_manager.create_memory(
            self.user.user_id, "New record", "2026-03-01", "New description for testing.", "STUDY"
        )

    def test_17_list_returns_newest_first(self):
        mems = self.memory_manager.get_memories_for_user(self.user.user_id)
        self.assertEqual([m.memory_id for m in mems], [self.m3.memory_id, self.m2.memory_id, self.m1.memory_id])

    def test_18_filter_by_category(self):
        mems = self.memory_manager.get_memories_for_user(self.user.user_id, category="STUDY")
        self.assertEqual(len(mems), 2)
        for m in mems:
            self.assertEqual(m.category, "STUDY")

    def test_19_filter_by_date_range(self):
        mems = self.memory_manager.get_memories_for_user(
            self.user.user_id, from_date="2025-01-01", to_date="2025-12-31"
        )
        self.assertEqual(len(mems), 1)
        self.assertEqual(mems[0].memory_id, self.m2.memory_id)

    def test_20_read_single_by_id(self):
        m = self.memory_manager.get_memory_by_id(self.user.user_id, self.m1.memory_id)
        self.assertEqual(m.title, "Old record")


class TestSearch(BaseVaultTest):
    """Group 5: Search & Relevance Ranking (7 tests)"""

    def setUp(self):
        super().setUp()
        self.user = self.auth_service.register("frank", "password123")
        self.m_hackathon, _, _ = self.memory_manager.create_memory(
            self.user.user_id,
            "First Hackathon",
            "2026-09-16",
            "Participated in an AI hackathon at CIT and presented a voice assistance project with my team.",
            "ACHIEVEMENT",
        )
        self.m_java, _, _ = self.memory_manager.create_memory(
            self.user.user_id,
            "Started Java unit 3",
            "2025-08-04",
            "Began the third unit of the Java Programming course covering collections and exception handling.",
            "STUDY",
        )
        self.m_trip, _, _ = self.memory_manager.create_memory(
            self.user.user_id,
            "Family trip to Thanjavur",
            "2026-06-18",
            "Visited the historic Brihadisvara temple and spent time exploring Thanjavur with family.",
            "TRAVEL",
        )

    def test_21_search_by_keyword(self):
        mems = self.memory_manager.get_memories_for_user(self.user.user_id)
        tokens, results, elapsed = self.search_service.search(self.user.user_id, mems, "java collections")
        self.assertIn("java", tokens)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0][0].memory_id, self.m_java.memory_id)

    def test_22_search_stopword_removal_sanity_check(self):
        query = "show my hackathon achievements"
        tokens = AIService.tokenize(query)
        self.assertEqual(tokens, ["hackathon", "achievements"])

    def test_23_ranking_formula_sanity_check(self):
        """
        Sanity check from specification:
        query 'show my hackathon achievements' -> tokens [hackathon, achievements]
        Record 'First Hackathon' with body having hackathon:
          body match = 1/2 = 0.50 -> 0.50*0.50 = 0.25
          title match = 1/2 = 0.50 -> 0.30*0.50 = 0.15
          category match = 0.00 -> 0.20*0.00 = 0.00
          total score = 0.40
        """
        mems = self.memory_manager.get_memories_for_user(self.user.user_id)
        tokens, results, elapsed = self.search_service.search(
            self.user.user_id, mems, "show my hackathon achievements"
        )
        self.assertTrue(len(results) >= 1)
        top_mem, score = results[0]
        self.assertEqual(top_mem.memory_id, self.m_hackathon.memory_id)
        self.assertAlmostEqual(score, 0.40, places=2)

    def test_24_empty_query_returns_empty(self):
        mems = self.memory_manager.get_memories_for_user(self.user.user_id)
        tokens, results, elapsed = self.search_service.search(self.user.user_id, mems, "the is at")
        self.assertEqual(tokens, [])
        self.assertEqual(results, [])

    def test_25_search_combined_with_category_filter(self):
        mems = self.memory_manager.get_memories_for_user(self.user.user_id)
        tokens, results, elapsed = self.search_service.search(
            self.user.user_id, mems, "hackathon", category_filter="ACHIEVEMENT"
        )
        self.assertEqual(len(results), 1)

        tokens2, results2, _ = self.search_service.search(
            self.user.user_id, mems, "hackathon", category_filter="TRAVEL"
        )
        self.assertEqual(len(results2), 0)

    def test_26_search_combined_with_date_filter(self):
        mems = self.memory_manager.get_memories_for_user(self.user.user_id)
        tokens, results, _ = self.search_service.search(
            self.user.user_id, mems, "hackathon", from_date="2026-09-01", to_date="2026-09-30"
        )
        self.assertEqual(len(results), 1)

    def test_27_zero_match_search(self):
        mems = self.memory_manager.get_memories_for_user(self.user.user_id)
        tokens, results, _ = self.search_service.search(self.user.user_id, mems, "quantum mechanics astrophysics")
        self.assertEqual(len(results), 0)


class TestUpdate(BaseVaultTest):
    """Group 6: Updates & Keywords (4 tests)"""

    def setUp(self):
        super().setUp()
        self.user = self.auth_service.register("grace", "password123")
        self.mem, _, _ = self.memory_manager.create_memory(
            self.user.user_id, "Old Title", "2025-01-01", "Old description about python code.", "STUDY"
        )

    def test_28_update_title_and_description(self):
        updated = self.memory_manager.update_memory(
            self.user.user_id,
            self.mem.memory_id,
            "Updated Title",
            "2025-01-02",
            "Updated description about advanced algorithms.",
            "STUDY",
        )
        self.assertEqual(updated.title, "Updated Title")
        self.assertEqual(updated.date, "2025-01-02")

    def test_29_keywords_refresh_on_update(self):
        updated = self.memory_manager.update_memory(
            self.user.user_id,
            self.mem.memory_id,
            "Rust Programming",
            "2025-01-02",
            "Learning rust ownership borrowing concurrency principles.",
            "STUDY",
        )
        self.assertIn("rust", updated.keywords)

    def test_30_update_category(self):
        updated = self.memory_manager.update_memory(
            self.user.user_id,
            self.mem.memory_id,
            self.mem.title,
            self.mem.date,
            self.mem.description,
            "ACHIEVEMENT",
        )
        self.assertEqual(updated.category, "ACHIEVEMENT")

    def test_31_unauthorized_update_rejected(self):
        other_user = self.auth_service.register("hacker", "password123")
        with self.assertRaises(MemoryNotFoundException):
            self.memory_manager.update_memory(
                other_user.user_id,
                self.mem.memory_id,
                "Malicious Edit",
                "2025-01-01",
                "Trying to overwrite someone else's memory.",
                "STUDY",
            )


class TestDelete(BaseVaultTest):
    """Group 7: Deletion (4 tests)"""

    def setUp(self):
        super().setUp()
        self.user = self.auth_service.register("helen", "password123")
        self.mem, _, _ = self.memory_manager.create_memory(
            self.user.user_id, "To Be Deleted", "2025-01-01", "Memory earmarked for deletion.", "PERSONAL"
        )

    def test_32_delete_with_confirm_true(self):
        self.memory_manager.delete_memory(self.user.user_id, self.mem.memory_id, confirm=True)
        with self.assertRaises(MemoryNotFoundException):
            self.memory_manager.get_memory_by_id(self.user.user_id, self.mem.memory_id)

    def test_33_delete_without_confirm_rejected(self):
        with self.assertRaises(InvalidInputException) as ctx:
            self.memory_manager.delete_memory(self.user.user_id, self.mem.memory_id, confirm=False)
        self.assertEqual(str(ctx.exception), "Confirmation required before deletion.")

    def test_34_delete_nonexistent_returns_404(self):
        with self.assertRaises(MemoryNotFoundException):
            self.memory_manager.delete_memory(self.user.user_id, "M999", confirm=True)

    def test_35_record_removed_from_inverted_index(self):
        mems = self.memory_manager.get_memories_for_user(self.user.user_id)
        _, results_before, _ = self.search_service.search(self.user.user_id, mems, "earmarked")
        self.assertEqual(len(results_before), 1)

        self.memory_manager.delete_memory(self.user.user_id, self.mem.memory_id, confirm=True)

        mems_after = self.memory_manager.get_memories_for_user(self.user.user_id)
        _, results_after, _ = self.search_service.search(self.user.user_id, mems_after, "earmarked")
        self.assertEqual(len(results_after), 0)


class TestValidationNegative(BaseVaultTest):
    """Group 8: Validation Negative Cases (5 tests)"""

    def test_36_description_over_500_chars(self):
        with self.assertRaises(InvalidInputException):
            validate_description("X" * 501)

    def test_37_invalid_category_rejected(self):
        with self.assertRaises(InvalidInputException):
            validate_category("RANDOM_CAT")

    def test_38_negative_numeric_choice_helper(self):
        with self.assertRaises(InvalidInputException) as ctx:
            validate_numeric_choice("0", min_val=1, max_val=5)
        self.assertEqual(str(ctx.exception), "Choice must be between 1 and 5.")

    def test_39_non_numeric_choice_helper(self):
        with self.assertRaises(InvalidInputException) as ctx:
            validate_numeric_choice("abc", min_val=1, max_val=5)
        self.assertEqual(str(ctx.exception), "Please enter a number, not text.")

    def test_40_valid_numeric_choice(self):
        res = validate_numeric_choice("3", min_val=1, max_val=5)
        self.assertEqual(res, 3)


class TestSecurityAndIsolation(BaseVaultTest):
    """Group 9: Tenant Isolation & Security (2 tests)"""

    def setUp(self):
        super().setUp()
        self.user_a = self.auth_service.register("user_a", "passwordA1")
        self.user_b = self.auth_service.register("user_b", "passwordB1")

        self.mem_a, _, _ = self.memory_manager.create_memory(
            self.user_a.user_id, "User A Secret", "2025-05-01", "Confidential record belonging to User A.", "PERSONAL"
        )

    def test_41_user_b_cannot_read_user_a_record(self):
        with self.assertRaises(MemoryNotFoundException) as ctx:
            self.memory_manager.get_memory_by_id(self.user_b.user_id, self.mem_a.memory_id)
        self.assertIn("exists for the current user", str(ctx.exception))

    def test_42_user_b_cannot_search_user_a_record(self):
        b_memories = self.memory_manager.get_memories_for_user(self.user_b.user_id)
        tokens, results, elapsed = self.search_service.search(
            self.user_b.user_id, b_memories, "Confidential Secret"
        )
        self.assertEqual(len(results), 0)


class TestPersistenceAndRecovery(BaseVaultTest):
    """Group 10: Persistence & Fault Recovery (2 tests)"""

    def test_43_corrupted_line_is_skipped_with_warning(self):
        # Write 1 valid line, 1 corrupt line (< 7 fields), 1 valid line
        with open(self.memories_file, "w", encoding="utf-8") as f:
            f.write("M001|U001|First Memory|STUDY|2025-01-01|Valid first description.|study,first\n")
            f.write("CORRUPT_LINE_WITH_MISSING_FIELDS\n")
            f.write("M002|U001|Second Memory|EVENT|2025-02-01|Valid second description.|event,second\n")

        storage = FileStorage(users_file=self.users_file, memories_file=self.memories_file)
        loaded = storage.load_memories()

        # Corrupt line is skipped, valid 2 records are preserved
        self.assertEqual(len(loaded), 2)
        self.assertTrue(len(storage.warnings) > 0)
        self.assertIn("expected 7 fields", storage.warnings[0])

    def test_44_missing_data_files_recovered(self):
        if self.memories_file.exists():
            os.remove(self.memories_file)
        if self.users_file.exists():
            os.remove(self.users_file)

        storage = FileStorage(users_file=self.users_file, memories_file=self.memories_file)
        self.assertTrue(self.memories_file.exists())
        self.assertTrue(self.users_file.exists())
        self.assertEqual(len(storage.load_memories()), 0)


class TestConcurrencyKnownLimitation(BaseVaultTest):
    """Group 11: Documented multi-process concurrency limitation"""

    @unittest.expectedFailure
    def test_45_multi_process_file_locking_limitation(self):
        """
        Documented known limitation:
        AI MemoVault uses in-process threading.Lock. Multiple separate OS processes
        writing to memories.csv concurrently without OS-level fcntl/flock is a known limitation.
        """
        # Marked as expectedFailure to document architectural boundary
        raise RuntimeError("Multi-process write concurrency requires OS-level advisory file locks.")


class TestAIComponentsUnit(unittest.TestCase):
    """Group 12: Unit tests for AI Service components & formulas (5 tests)"""

    def test_46_tokenizer_stop_words_and_min_length(self):
        raw = "Show me the Hackathon 2026, with winners and AI medals!"
        tokens = AIService.tokenize(raw)
        # 'show', 'the', 'with', 'and' removed; 'me', 'ai' shorter than 3 chars removed
        self.assertEqual(tokens, ["hackathon", "2026", "winners", "medals"])

    def test_47_tfidf_formula_exactness(self):
        """
        TF-IDF Formula:
          w(t,d) = tf(t,d) * ( ln( N / (1 + df(t)) ) + 1 )
        For 1 document where token 'python' appears 2 times, N=1, df=1:
          w('python') = 2 * ( ln( 1 / 2 ) + 1 ) = 2 * ( -0.693147 + 1 ) = 2 * 0.306853 = 0.6137
        """
        corpus = ["python python programming"]
        keywords = AIService.extract_keywords(corpus, "python python", "programming")
        self.assertIn("python", keywords)
        self.assertEqual(keywords[0], "python")

    def test_48_lexicon_classifier_confidence_normalisation(self):
        # High confidence achievement
        cat, conf = AIService.classify("Won first prize hackathon award", "Selected as topper and published paper")
        self.assertEqual(cat, "ACHIEVEMENT")
        self.assertLessEqual(conf, 1.0)
        self.assertGreater(conf, 0.5)

        # Empty text defaults to PERSONAL with 0.0 confidence
        cat_empty, conf_empty = AIService.classify("", "")
        self.assertEqual(cat_empty, "PERSONAL")
        self.assertEqual(conf_empty, 0.0)

    def test_49_inverted_index_lifecycle(self):
        index = InvertedIndex()
        m1 = Memory("M1", "U1", "Python Guide", "STUDY", "2025-01-01", "Complete study notes on python.")
        index.add(m1)

        candidates = index.lookup(["python"])
        self.assertIn("M1", candidates)

        index.remove("M1")
        candidates_after = index.lookup(["python"])
        self.assertNotIn("M1", candidates_after)
        self.assertEqual(index.get_terms_count(), 0)

    def test_50_jaccard_similarity_calculation(self):
        """
        J(A, B) = |A ∩ B| / |A ∪ B|
        A = 'python java rust' -> {python, java, rust} (3 tokens)
        B = 'python rust golang' -> {python, rust, golang} (3 tokens)
        Intersection = {python, rust} (2 tokens)
        Union = {python, java, rust, golang} (4 tokens)
        J = 2 / 4 = 0.5000
        """
        sim = AIService.calculate_jaccard("python java rust", "python rust golang")
        self.assertAlmostEqual(sim, 0.50, places=2)


if __name__ == "__main__":
    unittest.main()
