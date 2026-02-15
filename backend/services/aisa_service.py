import os
import httpx
from typing import List, Dict, Any, Optional

class AIsaService:
    """
    Service for interacting with AIsa.one Unified API.
    AIsa provides a single endpoint for multiple LLMs with pay-as-you-go pricing.
    """
    def __init__(self):
        self._api_key = os.getenv('AISA_API_KEY')
        self.base_url = "https://api.aisa.one/v1"

    @property
    def api_key(self) -> Optional[str]:
        # Lazy load key if not present (helps with module-level initialization)
        if not self._api_key:
            self._api_key = os.getenv('AISA_API_KEY')
        return self._api_key

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def chat_completion(self, model: str, messages: List[Dict[str, str]], **kwargs) -> Optional[str]:
        """
        OpenAI-compatible chat completion endpoint.
        """
        if not self.api_key:
            # Try reloading one last time
            if not os.getenv('AISA_API_KEY'):
                print("Warning: AISA_API_KEY not set")
                return None

        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "model": model,
                    "messages": messages,
                    **kwargs
                }
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=self.headers,
                    timeout=60.0
                )
                
                if response.status_code != 200:
                    print(f"AIsa API error: {response.status_code} - {response.text}")
                    return None

                data = response.json()
                return data['choices'][0]['message']['content']
        except Exception as e:
            print(f"AIsa chat completion failed: {e}")
            return None

    def get_available_models(self) -> List[str]:
        return [
            "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo",
            "claude-3-5-sonnet", "claude-3-opus",
            "gemini-1.5-pro", "gemini-1.5-flash",
            "grok-1", "llama-3-70b"
        ]

    async def twitter_search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not self.api_key:
            return []
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/tools/twitter/search",
                    json={"query": query, "limit": limit},
                    headers=self.headers,
                    timeout=30.0
                )
                if response.status_code == 200:
                    return response.json().get("results", [])
                return []
        except Exception as e:
            print(f"AIsa Twitter search failed: {e}")
            return []

    async def web_search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not self.api_key:
            return []
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/tools/web/search",
                    json={"query": query, "limit": limit},
                    headers=self.headers,
                    timeout=30.0
                )
                if response.status_code == 200:
                    return response.json().get("results", [])
                return []
        except Exception as e:
            print(f"AIsa Web search failed: {e}")
            return []

aisa_service = AIsaService()
