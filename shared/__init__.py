"""Shared core modules - single source of truth for all developers."""

from .models import Query, QueryStatus, TrendResult, TrendItem, Platform, PlatformType
from .exceptions import (
    TrendPlatformError,
    RateLimitError,
    ValidationError,
    ConfigurationError,
)

__all__ = [
    "Query",
    "QueryStatus",
    "TrendResult",
    "TrendItem",
    "Platform",
    "PlatformType",
    "TrendPlatformError",
    "RateLimitError",
    "ValidationError",
    "ConfigurationError",
]
