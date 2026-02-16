from typing import List, Optional, Dict, Any, TypedDict
from shared.models import TrendItem, QueryStatus

class GraphState(TypedDict):
    # Input
    topic: str
    platforms: List[str]
    models: List[str]
    
    # Internal State
    query_id: str
    created_at: str
    plan: Optional[Dict[str, Any]]
    search_queries: List[Dict[str, Any]]
    raw_findings: List[TrendItem]
    filtered_findings: List[TrendItem]
    
    # Status & Logging
    status: QueryStatus
    logs: List[str]
    
    # Output
    summary: Optional[str]
    final_report_md: Optional[str]
    relevance_score: float
    impact_score: float
    confidence_score: float
    validation_results: List[str]
    meme_page_data: Optional[Dict[str, Any]]
    consensus_data: Optional[Dict[str, Any]]
    attestation_data: Optional[Dict[str, Any]]
    error: Optional[str]
