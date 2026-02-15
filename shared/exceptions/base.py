"""Base exception classes for the application."""


class TrendPlatformError(Exception):
    """Base exception for all platform-related errors."""

    def __init__(self, message: str, platform: str | None = None):
        self.platform = platform
        super().__init__(message)


class RateLimitError(TrendPlatformError):
    """Raised when API rate limit is exceeded."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        platform: str | None = None,
        retry_after: int | None = None,
    ):
        self.retry_after = retry_after
        super().__init__(message, platform)


class ValidationError(TrendPlatformError):
    """Raised when input validation fails."""

    def __init__(self, message: str, field: str | None = None):
        self.field = field
        super().__init__(message)


class ConfigurationError(TrendPlatformError):
    """Raised when configuration is invalid or missing."""

    def __init__(self, message: str, config_key: str | None = None):
        self.config_key = config_key
        super().__init__(message)


class APIError(TrendPlatformError):
    """Raised when an external API call fails."""

    def __init__(
        self,
        message: str,
        platform: str | None = None,
        status_code: int | None = None,
    ):
        self.status_code = status_code
        super().__init__(message, platform)


class ProcessingError(TrendPlatformError):
    """Raised when trend processing fails."""

    def __init__(self, message: str, stage: str | None = None):
        self.stage = stage
        super().__init__(message)
