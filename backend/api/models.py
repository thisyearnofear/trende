"""
Pydantic models for API request/response validation.
"""
from typing import Any
from pydantic import BaseModel, Field, model_validator

from backend.services.x402_service import X402Payment


class QueryRequest(BaseModel):
    """Request model for starting a new research task."""
    topic: str | None = None
    idea: str | None = None
    platforms: list[str] = Field(default_factory=lambda: ["twitter", "newsapi", "linkedin"])
    models: list[str] = Field(
        default_factory=lambda: [
            "venice_default",
            "venice_mistral",
            "openrouter_llama_70b",
            "openrouter_hermes",
            "aisa",
        ]
    )
    relevance_threshold: float | None = None
    visibility: str = "public"
    augmentation: dict[str, str] = Field(default_factory=dict)
    payment: X402Payment | None = None

    @model_validator(mode="after")
    def validate_topic(self) -> "QueryRequest":
        resolved = (self.topic or self.idea or "").strip()
        if not resolved:
            raise ValueError("Either 'topic' or 'idea' is required")
        self.topic = resolved
        visibility = (self.visibility or "public").strip().lower()
        if visibility not in {"private", "unlisted", "public"}:
            visibility = "public"
        self.visibility = visibility
        normalized_aug: dict[str, str] = {}
        for key in ("firecrawl", "synthdata"):
            value = str((self.augmentation or {}).get(key, "auto")).strip().lower()
            normalized_aug[key] = value if value in {"auto", "on", "off"} else "auto"
        self.augmentation = normalized_aug
        return self


class AttestationVerifyRequest(BaseModel):
    """Request model for verifying TEE attestation."""
    payload: dict[str, Any]
    attestation: dict[str, Any]


class SaveResearchRequest(BaseModel):
    """Request model for saving research to vault."""
    visibility: str = "private"
    pin_to_ipfs: bool = False
    save_label: str | None = None
    tags: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_visibility(self) -> "SaveResearchRequest":
        normalized = (self.visibility or "private").strip().lower()
        if normalized not in {"private", "unlisted", "public"}:
            raise ValueError("visibility must be one of: private, unlisted, public")
        self.visibility = normalized
        self.tags = [tag.strip().lower() for tag in self.tags if tag.strip()][:8]
        if self.save_label is not None:
            self.save_label = self.save_label.strip()[:120] or None
        return self


class ActionSubmitRequest(BaseModel):
    """Request model for submitting agent actions."""
    action_type: str
    task_id: str | None = None
    input: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = None

    @model_validator(mode="after")
    def validate_action(self) -> "ActionSubmitRequest":
        self.action_type = (self.action_type or "").strip().lower()
        if not self.action_type:
            raise ValueError("action_type is required.")
        if self.idempotency_key is not None:
            self.idempotency_key = self.idempotency_key.strip()[:128] or None
        return self


class ResearchTelemetryRequest(BaseModel):
    """Request model for research telemetry events (renamed from MissionTelemetryRequest)."""
    name: str
    payload: dict[str, Any] = Field(default_factory=dict)
    session_id: str | None = None
    source: str | None = None
    stage: str | None = None

    @model_validator(mode="after")
    def validate_event(self) -> "ResearchTelemetryRequest":
        self.name = (self.name or "").strip()
        if not self.name:
            raise ValueError("Event name is required")
        if self.session_id is not None:
            self.session_id = self.session_id.strip()[:128] or None
        if self.source is not None:
            self.source = self.source.strip()[:64] or None
        if self.stage is not None:
            self.stage = self.stage.strip()[:64] or None
        return self


class PublishRequest(BaseModel):
    """Request model for publishing to external platforms."""
    platform: str = "paragraph"
    api_key: str
    title: str | None = None
    tags: list[str] = Field(default_factory=list)


class SynthDataForecastRequest(BaseModel):
    """Request model for SynthData forecast queries."""
    asset: str
    include_options: bool = False
    horizon_days: int = 7


class AskTrendeRequest(BaseModel):
    """Request model for Ask Trende AI queries."""
    question: str

    @model_validator(mode="after")
    def validate_question(self) -> "AskTrendeRequest":
        self.question = (self.question or "").strip()
        if not self.question:
            raise ValueError("Question is required")
        if len(self.question) > 500:
            raise ValueError("Question must be 500 characters or less")
        return self


class MissionTelemetryRequest(BaseModel):
    """Request model for mission telemetry events."""
    name: str
    payload: dict[str, Any] = Field(default_factory=dict)
    session_id: str | None = None
    source: str | None = None
    stage: str | None = None

    @model_validator(mode="after")
    def validate_event(self) -> "MissionTelemetryRequest":
        self.name = (self.name or "").strip().lower()[:120]
        if not self.name:
            raise ValueError("name is required.")
        self.session_id = (self.session_id or "").strip()[:120] or None
        self.source = (self.source or "").strip()[:80] or None
        self.stage = (self.stage or "").strip()[:80] or None
        return self
