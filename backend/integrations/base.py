from abc import ABC, abstractmethod
from typing import List, Optional
from shared.models import TrendItem, PlatformType

class AbstractPlatformConnector(ABC):
    @property
    @abstractmethod
    def platform(self) -> PlatformType:
        pass

    @abstractmethod
    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        """Search the platform for a given query."""
        pass

    @abstractmethod
    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        """Fetch secondary details for a specific item (e.g., comments/thread)."""
        pass
