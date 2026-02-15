"""Platform type definitions."""

from enum import Enum
from typing import Optional


class PlatformType(str, Enum):
    """Supported platform types."""

    TWITTER = "twitter"
    LINKEDIN = "linkedin"
    FACEBOOK = "facebook"
    NEWSAPI = "newsapi"
    TIKTOK = "tiktok"
    YOUTUBE = "youtube"
    WEB = "web"  # General web search (Serper/Tavily)


class Platform:
    """Platform configuration and metadata."""

    def __init__(
        self,
        platform_type: PlatformType,
        display_name: str,
        icon: str,
        color: str,
        supports_embed: bool = True,
        api_name: str | None = None,
    ):
        self.type = platform_type
        self.display_name = display_name
        self.icon = icon
        self.color = color
        self.supports_embed = supports_embed
        self.api_name = api_name or platform_type.value

    def to_dict(self) -> dict:
        return {
            "type": self.type.value,
            "displayName": self.display_name,
            "icon": self.icon,
            "color": self.color,
            "supportsEmbed": self.supports_embed,
        }


# Platform registry - single source of truth
PLATFORMS: dict[PlatformType, Platform] = {
    PlatformType.TWITTER: Platform(
        PlatformType.TWITTER,
        "Twitter/X",
        "𝕏",
        "#1DA1F2",
        supports_embed=True,
    ),
    PlatformType.LINKEDIN: Platform(
        PlatformType.LINKEDIN,
        "LinkedIn",
        "in",
        "#0A66C2",
        supports_embed=True,
    ),
    PlatformType.FACEBOOK: Platform(
        PlatformType.FACEBOOK,
        "Facebook",
        "f",
        "#1877F2",
        supports_embed=True,
    ),
    PlatformType.NEWSAPI: Platform(
        PlatformType.NEWSAPI,
        "News",
        "📰",
        "#FF6B35",
        supports_embed=False,
    ),
    PlatformType.TIKTOK: Platform(
        PlatformType.TIKTOK,
        "TikTok",
        "🎵",
        "#000000",
        supports_embed=True,
    ),
    PlatformType.YOUTUBE: Platform(
        PlatformType.YOUTUBE,
        "YouTube",
        "📺",
        "#FF0000",
        supports_embed=True,
    ),
    PlatformType.WEB: Platform(
        PlatformType.WEB,
        "Web",
        "🌐",
        "#6366F1",
        supports_embed=False,
    ),
}


def get_platform(platform_type: PlatformType) -> Platform:
    """Get platform configuration by type."""
    return PLATFORMS.get(platform_type)


def get_all_platforms() -> list[Platform]:
    """Get all available platforms."""
    return list(PLATFORMS.values())
