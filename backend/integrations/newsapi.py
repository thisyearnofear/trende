"""NewsAPI connector."""

from .base import BaseConnector, PlatformItem


class NewsAPIConnector(BaseConnector):
    """NewsAPI platform connector."""

    @property
    def platform_name(self) -> str:
        return "newsapi"

    async def search(self, query: str, limit: int = 10) -> list[PlatformItem]:
        """Search news for the query."""
        # TODO: Implement using NewsAPI
        # https://newsapi.org/v2/everything?q={query}
        return []

    async def get_item(self, item_id: str) -> PlatformItem | None:
        """Get a specific article by ID."""
        # TODO: Implement
        return None
