"""Result models for trend analysis outputs."""

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class TrendItem(BaseModel):
    """Individual trend item from a platform."""

    id: str = Field(..., description="Unique identifier from platform")
    platform: str = Field(..., description="Platform source")
    title: str = Field(..., max_length=500)
    content: str = Field(..., description="Full text content")
    author: str = Field(..., description="Author/creator name")
    author_handle: Optional[str] = Field(None, description="Author's handle/username")
    url: str = Field(..., description="Permanent URL to the item")

    # Engagement metrics
    metrics: dict[str, int] = Field(
        default_factory=dict,
        description="Platform-specific metrics (likes, shares, comments, views)",
    )

    # Timestamps
    timestamp: datetime = Field(..., description="When the item was posted")
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Additional data
    raw_data: dict[str, Any] = Field(
        default_factory=dict,
        description="Original API response for reference",
    )

    # Embed support
    embed_html: Optional[str] = Field(
        None,
        description="HTML embed code (for platforms that support it)",
    )

    # Relevance scoring (filled by ranker)
    relevance_score: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="AI-generated relevance score",
    )

    def to_search_result(self) -> dict:
        """Convert to frontend-friendly format."""
        return {
            "id": self.id,
            "platform": self.platform,
            "title": self.title,
            "content": self.content,
            "author": self.author,
            "authorHandle": self.author_handle,
            "url": self.url,
            "metrics": self.metrics,
            "timestamp": self.timestamp.isoformat(),
            "relevanceScore": self.relevance_score,
            "embedHtml": self.embed_html,
        }

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }


class TrendSummary(BaseModel):
    """AI-generated summary of trends."""

    overview: str = Field(..., description="High-level summary")
    key_themes: list[str] = Field(
        default_factory=list,
        description="Main themes identified",
    )
    top_trends: list[dict] = Field(
        default_factory=list,
        description="Top 3-5 specific trends with details",
    )
    sentiment: str = Field(
        default="neutral",
        description="Overall sentiment (positive/negative/neutral)",
    )
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TrendResult(BaseModel):
    """Complete result for a trend query."""

    query_id: UUID
    platform: str
    items: list[TrendItem] = Field(default_factory=list)
    summary: Optional[TrendSummary] = None
    relevance_score: float = Field(default=0.0, ge=0.0, le=1.0)
    total_fetched: int = 0
    processing_time_ms: int = 0

    def add_item(self, item: TrendItem) -> None:
        """Add an item to results."""
        self.items.append(item)
        self.total_fetched = len(self.items)

    def get_top_items(self, limit: int = 10) -> list[TrendItem]:
        """Get top items by relevance score."""
        sorted_items = sorted(
            self.items,
            key=lambda x: x.relevance_score or 0,
            reverse=True,
        )
        return sorted_items[:limit]

    def to_response(self) -> dict:
        """Convert to API response format."""
        return {
            "queryId": str(self.query_id),
            "platform": self.platform,
            "items": [item.to_search_result() for item in self.items],
            "summary": self.summary.model_dump() if self.summary else None,
            "relevanceScore": self.relevance_score,
            "totalFetched": self.total_fetched,
            "processingTimeMs": self.processing_time_ms,
        }

    class Config:
        use_enum_values = True
