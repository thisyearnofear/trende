from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class PlatformType(str, Enum):
    TWITTER = "twitter"
    LINKEDIN = "linkedin"
    NEWS = "news"
    WEB = "web"
    GITHUB = "github"

class TrendItem(BaseModel):
    id: str
    platform: PlatformType
    title: str
    content: str
    author: str
    url: str
    timestamp: datetime
    metrics: Dict[str, Any] = Field(default_factory=dict)
    raw_data: Optional[Dict[str, Any]] = None

class TrendResult(BaseModel):
    query_id: str
    items: List[TrendItem]
    summary: str
    relevance_score: float
    impact_score: float
    generated_at: datetime = Field(default_factory=datetime.now)

class QueryStatus(str, Enum):
    PENDING = "pending"
    PLANNING = "planning"
    RESEARCHING = "researching"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"
