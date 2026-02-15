"""Query models for user submissions."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class QueryStatus(str, Enum):
    """Status of a trend query."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Query(BaseModel):
    """User query for trend analysis."""

    id: UUID = Field(default_factory=uuid4)
    idea: str = Field(..., min_length=1, max_length=500, description="User's idea or topic")
    platforms: list[str] = Field(
        default=["twitter", "newsapi"],
        description="Platforms to search",
    )
    status: QueryStatus = Field(default=QueryStatus.PENDING)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    # Processing metadata
    total_results: int = Field(default=0)
    relevance_threshold: float = Field(default=0.5, ge=0.0, le=1.0)

    def mark_processing(self) -> None:
        """Mark query as being processed."""
        self.status = QueryStatus.PROCESSING
        self.updated_at = datetime.utcnow()

    def mark_completed(self, total_results: int) -> None:
        """Mark query as completed."""
        self.status = QueryStatus.COMPLETED
        self.total_results = total_results
        self.completed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def mark_failed(self, error: str) -> None:
        """Mark query as failed."""
        self.status = QueryStatus.FAILED
        self.error_message = error
        self.updated_at = datetime.utcnow()

    class Config:
        use_enum_values = True
