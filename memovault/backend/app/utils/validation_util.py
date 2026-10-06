"""
Centralized validation logic for AI MemoVault.
All domain constraints are validated here to prevent duplicate rule definitions.
Raises InvalidInputException with clean, user-facing error messages.
"""

import re
from datetime import date, datetime
from app.exceptions import InvalidInputException
from app.models.memory import VALID_CATEGORIES

# Regex patterns
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]{3,30}$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_username(username: str) -> str:
    """Validates username: 3-30 chars, alphanumeric or underscores."""
    if not username or not isinstance(username, str):
        raise InvalidInputException("Username must be 3-30 characters containing only letters, numbers, and underscores.")
    cleaned = username.strip()
    if not USERNAME_PATTERN.match(cleaned):
        raise InvalidInputException("Username must be 3-30 characters containing only letters, numbers, and underscores.")
    return cleaned


def validate_password(password: str) -> str:
    """Validates password: minimum 6 characters."""
    if not password or not isinstance(password, str) or len(password) < 6:
        raise InvalidInputException("Password must be at least 6 characters long.")
    return password


def validate_title(title: str) -> str:
    """Validates memory title: non-empty, 1 to 60 characters."""
    if not title or not isinstance(title, str) or not title.strip():
        raise InvalidInputException("Title cannot be empty and must be 60 characters or fewer.")
    cleaned = title.strip()
    if len(cleaned) > 60:
        raise InvalidInputException("Title cannot be empty and must be 60 characters or fewer.")
    return cleaned


def validate_description(description: str) -> str:
    """Validates memory description: between 5 and 500 characters."""
    if not description or not isinstance(description, str):
        raise InvalidInputException("Description must be between 5 and 500 characters.")
    cleaned = description.strip()
    if len(cleaned) < 5 or len(cleaned) > 500:
        raise InvalidInputException("Description must be between 5 and 500 characters.")
    return cleaned


def validate_date(date_str: str) -> str:
    """
    Validates date string format (yyyy-MM-dd) and ensures it is not in the future.
    """
    if not date_str or not isinstance(date_str, str):
        raise InvalidInputException("Date must follow the pattern yyyy-MM-dd.")
    cleaned = date_str.strip()
    if not DATE_PATTERN.match(cleaned):
        raise InvalidInputException("Date must follow the pattern yyyy-MM-dd.")
    try:
        parsed_date = datetime.strptime(cleaned, "%Y-%m-%d").date()
    except ValueError:
        raise InvalidInputException("Date must follow the pattern yyyy-MM-dd.")

    today = date.today()
    if parsed_date > today:
        raise InvalidInputException("A memory cannot be dated in the future.")
    return cleaned


def validate_category(category: str) -> str:
    """Validates category is one of the 6 allowed standard categories."""
    if not category or not isinstance(category, str):
        raise InvalidInputException("Category must be one of: ACHIEVEMENT, EVENT, STUDY, TRAVEL, REMINDER, PERSONAL.")
    cleaned = category.strip().upper()
    if cleaned not in VALID_CATEGORIES:
        raise InvalidInputException("Category must be one of: ACHIEVEMENT, EVENT, STUDY, TRAVEL, REMINDER, PERSONAL.")
    return cleaned


def validate_numeric_choice(choice_str: str, min_val: int, max_val: int) -> int:
    """
    Validates console/numeric menu choices.
    Returns parsed integer if within range.
    """
    if not choice_str or not isinstance(choice_str, str):
        raise InvalidInputException("Please enter a number, not text.")
    cleaned = choice_str.strip()
    try:
        val = int(cleaned)
    except ValueError:
        raise InvalidInputException("Please enter a number, not text.")
    if val < min_val or val > max_val:
        raise InvalidInputException(f"Choice must be between {min_val} and {max_val}.")
    return val
