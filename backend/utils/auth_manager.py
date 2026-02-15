import os
from typing import Dict, List, Optional
from shared.config import get_settings

class AuthManager:
    def __init__(self):
        self.settings = get_settings()
        # Dictionary of platform -> list of keys for rotation
        self._keys: Dict[str, List[str]] = {
            "twitter": [self.settings.rapidapi_key] if self.settings.rapidapi_key else [],
            "newsapi": [self.settings.newsapi_key] if self.settings.newsapi_key else [],
            "gemini": [self.settings.gemini_api_key] if self.settings.gemini_api_key else [],
        }
        self._current_indices: Dict[str, int] = {k: 0 for k in self._keys}

    def get_key(self, platform: str) -> Optional[str]:
        """Gets the current active key for a platform."""
        keys = self._keys.get(platform, [])
        if not keys:
            return None
        idx = self._current_indices.get(platform, 0)
        return keys[idx]

    def rotate_key(self, platform: str):
        """Rotates to the next available key (e.g., if current is rate limited)."""
        keys = self._keys.get(platform, [])
        if not keys or len(keys) <= 1:
            return
        
        self._current_indices[platform] = (self._current_indices[platform] + 1) % len(keys)
        print(f"Rotated key for {platform}. New index: {self._current_indices[platform]}")

    def add_key(self, platform: str, key: str):
        if platform not in self._keys:
            self._keys[platform] = []
        if key not in self._keys[platform]:
            self._keys[platform].append(key)

auth_manager = AuthManager()
