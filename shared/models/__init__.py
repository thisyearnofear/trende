"""Domain models - single source of truth for all data structures."""

from .query import Query, QueryStatus
from .result import TrendResult, TrendItem
from .platform import Platform, PlatformType

__all__ = [
    "Query",
    "QueryStatus",
    "TrendResult",
    "TrendItem",
    "Platform",
    "PlatformType",
]
