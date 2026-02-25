from backend.utils.url_quality import is_low_signal_search_url


def test_blocks_search_engine_result_pages() -> None:
    assert is_low_signal_search_url("https://www.google.com/search?q=bitcoin")
    assert is_low_signal_search_url("https://duckduckgo.com/?q=ai+agents")
    assert is_low_signal_search_url("https://www.bing.com/search?q=defi")


def test_allows_real_content_urls() -> None:
    assert not is_low_signal_search_url("https://blog.example.com/posts/agentic-economy")
    assert not is_low_signal_search_url("https://docs.synthdata.co/api/insights")

