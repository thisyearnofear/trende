"""Query models for user submissions."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class QueryStatus(str, Enum):
    """Status of a trend query."""

    PENDING = "pending"
    PLANNING = "planning"
    RESEARCHING = "researching"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"
    PROCESSING = "processing"


class Query(BaseModel):
    """User query for trend analysis."""

    id: UUID = Field(default_factory=uuid4)
    idea: str = Field(..., min_length=1, max_length=500, description="User's idea or topic")
    platforms: list[str] = Field(
        default=["twitter", "newsapi"],
        description="Platforms to search",
    )
    status: QueryStatus = Field(default=QueryStatus.PENDING)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    # Processing metadata
    total_results: int = Field(default=0)
    relevance_threshold: float = Field(default=0.5, ge=0.0, le=1.0)

    def mark_processing(self) -> None:
        """Mark query as being processed."""
        self.status = QueryStatus.PROCESSING
        self.updated_at = datetime.now(timezone.utc)

    def mark_completed(self, total_results: int) -> None:
        """Mark query as completed."""
        self.status = QueryStatus.COMPLETED
        self.total_results = total_results
        self.completed_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)

    def mark_failed(self, error: str) -> None:
        """Mark query as failed."""
        self.status = QueryStatus.FAILED
        self.error_message = error
        self.updated_at = datetime.now(timezone.utc)

    class Config:
        use_enum_values = True
