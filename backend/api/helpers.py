"""
Utility helper functions for the API layer.

This module contains pure utility functions with minimal external dependencies,
organized by category for easy maintenance and testing.
"""

import datetime
import math
import os
import re
from typing import Any


# =============================================================================
# Environment & Configuration
# =============================================================================


def env_flag(name: str, default: str = "false") -> bool:
    """Parse environment variable as boolean flag."""
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


# =============================================================================
# Date/Time Parsing
# =============================================================================


def parse_iso(value: Any) -> datetime.datetime | None:
    """Parse ISO datetime string, handling various formats."""
    if not value:
        return None
    try:
        parsed = datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=datetime.timezone.utc)
        return parsed
    except Exception:
        return None


def parse_market_dt(value: Any) -> datetime.datetime | None:
    """Parse market datetime from various formats."""
    if not value:
        return None
    parsed = parse_iso(value)
    if parsed:
        return parsed
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            dt = datetime.datetime.strptime(str(value), fmt)
            return dt.replace(tzinfo=datetime.timezone.utc)
        except Exception:
            continue
    return None


# =============================================================================
# Data Normalization
# =============================================================================


def normalize_key_parts(values: list[str]) -> tuple[str, ...]:
    """Normalize a list of string values for comparison/deduplication."""
    return tuple(sorted({(value or "").strip().lower() for value in values if (value or "").strip()}))


# =============================================================================
# Text Processing
# =============================================================================


def tokenize_market_text(value: str) -> set[str]:
    """Extract meaningful tokens from market text for matching."""
    return {
        token
        for token in re.findall(r"[a-z0-9]{3,}", value.lower())
        if token not in {"with", "from", "this", "that", "will", "have", "where", "what"}
    }


def has_market_intent(topic_tokens: set[str]) -> bool:
    """Check if topic tokens indicate market/prediction intent."""
    market_intent_tokens = {
        "market",
        "markets",
        "prediction",
        "predictions",
        "price",
        "prices",
        "trading",
        "trade",
        "token",
        "tokens",
        "btc",
        "bitcoin",
        "eth",
        "ethereum",
        "sol",
        "solana",
        "forecast",
        "odds",
        "probability",
        "liquidity",
        "volatility",
    }
    return len(topic_tokens & market_intent_tokens) > 0


# =============================================================================
# Numeric Utilities
# =============================================================================


def normalize_probability(value: Any) -> float | None:
    """Normalize probability value to 0-1 range."""
    try:
        if value is None:
            return None
        parsed = float(value)
        if math.isnan(parsed):
            return None
        if parsed > 1:
            parsed = parsed / 100.0
        return max(0.0, min(1.0, parsed))
    except Exception:
        return None


def provider_failure_rate(consensus_data: dict[str, Any]) -> float:
    """Calculate failure rate from consensus provider outputs."""
    outputs = consensus_data.get("provider_outputs") or []
    if not outputs:
        return 0.0
    failures = [item for item in outputs if str(item.get("status", "ok")).lower() != "ok"]
    return round(len(failures) / max(len(outputs), 1), 3)
