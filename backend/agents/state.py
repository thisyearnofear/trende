from typing import List, Optional, Dict, Any, TypedDict
from shared.models import TrendItem, QueryStatus

class GraphState(TypedDict):
    # Input
    topic: str
    platforms: List[str]
    models: List[str]
    paragraph_api_key: Optional[str]  # New field for API key
    
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
    
    # Editorial / Publishing (New fields)
    editorial_draft: Optional[str]
    publish_status: Optional[str]
    published_url: Optional[str]
    
    # Iterative Research (New fields)
    current_depth: int
    max_depth: int
    follow_up_directions: List[str]
    quality_assessment: Optional[Dict[str, Any]]
    retry_platforms: List[str]
    attempted_query_keys: List[str]
    augmentation: Dict[str, str]
    source_routes: List[Dict[str, Any]]
    
    # Financial Intelligence (SynthData)
    financial_intelligence: Optional[Dict[str, Any]]
    
    error: Optional[str]
