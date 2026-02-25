from __future__ import annotations

from urllib.parse import parse_qs, urlparse


LOW_SIGNAL_HOSTS = {
    "google.com",
    "www.google.com",
    "bing.com",
    "www.bing.com",
    "duckduckgo.com",
    "www.duckduckgo.com",
    "search.yahoo.com",
}


def is_low_signal_search_url(url: str) -> bool:
    """True for search-result pages / redirects that are poor evidence artifacts."""
    if not url:
        return True
    try:
        parsed = urlparse(url.strip())
    except Exception:
        return True

    if parsed.scheme not in {"http", "https"}:
        return True

    host = (parsed.netloc or "").lower()
    path = (parsed.path or "").lower()
    query = parse_qs(parsed.query or "")

    if host in LOW_SIGNAL_HOSTS:
        # Direct SERP pages.
        if path in {"/search", "/"} and any(k in query for k in ("q", "query", "p")):
            return True
        # Redirect wrappers.
        if any(k in query for k in ("url", "u", "r", "redirect")):
            return True

    if host.endswith("google.com") and path.startswith("/search"):
        return True
    if host.endswith("duckduckgo.com") and any(k in query for k in ("q", "ia", "iax")):
        return True
    if host.endswith("bing.com") and path.startswith("/search"):
        return True

    return False

