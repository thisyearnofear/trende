"""Application settings - single source of truth for configuration."""

import os
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Keys
    composio_api_key: str = Field(default="", alias="COMPOSIO_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    rapidapi_key: str = Field(default="", alias="RAPIDAPI_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    newsapi_key: str = Field(default="", alias="NEWSAPI_KEY")
    tabstack_api_key: str = Field(default="", alias="TABSTACK_API_KEY")
    tinyfish_api_key: str = Field(default="", alias="TINYFISH_API_KEY")
    coingecko_api_key: str = Field(default="", alias="COINGECKO_API_KEY")

    # Platform API Keys
    twitter_api_key: str = Field(default="", alias="TWITTER_API_KEY")
    twitter_api_secret: str = Field(default="", alias="TWITTER_API_SECRET")
    linkedin_api_key: str = Field(default="", alias="LINKEDIN_API_KEY")
    facebook_api_key: str = Field(default="", alias="FACEBOOK_API_KEY")

    # Vector Store
    pinecone_api_key: str = Field(default="", alias="PINECONE_API_KEY")
    pinecone_environment: str = Field(default="", alias="PINECONE_ENVIRONMENT")
    pinecone_index: str = Field(default="trends", alias="PINECONE_INDEX")

    # Database
    database_url: str = Field(default="sqlite:///./trends.db", alias="DATABASE_URL")

    # Redis (for caching)
    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")

    # Application
    app_name: str = "Trende"
    debug: bool = Field(default=False, alias="DEBUG")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # API Configuration
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")

    # Frontend URL (for CORS)
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")

    # Monad Configuration
    monad_rpc_url: str = Field(default="https://testnet-rpc.monad.xyz", alias="MONAD_RPC_URL")
    monad_chain_id: int = Field(default=10143, alias="MONAD_CHAIN_ID")
    monad_explorer_url: str = Field(default="https://testnet.monadexplorer.com", alias="MONAD_EXPLORER_URL")
    x402_recipient_address: str = Field(default="", alias="X402_RECIPIENT_ADDRESS")
    x402_payment_amount: str = Field(default="0.001", alias="X402_PAYMENT_AMOUNT")  # MON per search

    # Rate Limiting Tiers
    free_tier_daily_limit: int = Field(default=3, alias="FREE_TIER_DAILY_LIMIT")
    connected_tier_daily_limit: int = Field(default=10, alias="CONNECTED_TIER_DAILY_LIMIT")

    # Processing
    max_results_per_platform: int = 20
    relevance_threshold: float = 0.5
    cache_ttl_seconds: int = 300  # 5 minutes
    poll_interval_seconds: int = 300  # 5 minutes

    # LLM Configuration
    default_llm: str = "openai"  # or "anthropic"
    openai_model: str = "gpt-4"
    anthropic_model: str = "claude-3-opus-20240229"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"  # Allow extra fields


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
