"""Shared exception classes."""

from .base import (
    TrendPlatformError,
    RateLimitError,
    ValidationError,
    ConfigurationError,
    APIError,
    ProcessingError,
)

__all__ = [
    "TrendPlatformError",
    "RateLimitError",
    "ValidationError",
    "ConfigurationError",
    "APIError",
    "ProcessingError",
]
