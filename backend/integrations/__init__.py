"""Integrations module - platform connectors."""

from .base import BaseConnector, PlatformItem
from .twitter import TwitterConnector
from .linkedin import LinkedInConnector
from .newsapi import NewsAPIConnector

__all__ = [
    "BaseConnector",
    "PlatformItem",
    "TwitterConnector",
    "LinkedInConnector",
    "NewsAPIConnector",
]
