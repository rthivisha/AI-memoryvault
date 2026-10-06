"""
Custom exception hierarchy for AI MemoVault.
Ensures uniform error reporting across all application layers.
"""


class VaultException(Exception):
    """
    Abstract base exception for all domain-specific errors in AI MemoVault.
    Contains user-friendly error message and associated HTTP status code.
    """

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message: str = message
        self.status_code: int = status_code


class InvalidInputException(VaultException):
    """Raised when request payload or parameter fails domain validation rules."""

    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=400)


class MemoryNotFoundException(VaultException):
    """Raised when a requested memory does not exist or belongs to another user."""

    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=404)


class AuthenticationException(VaultException):
    """Raised when authentication credentials are invalid or missing."""

    def __init__(self, message: str = "Please log in first.") -> None:
        super().__init__(message=message, status_code=401)
