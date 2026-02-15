import os
import httpx
from typing import List, Dict, Any, Optional

class OpenRouterService:
    """
    Service for interacting with OpenRouter API.
    Provides fallback to a wide range of models, including free ones.
    """
    def __init__(self):
        self._api_key = os.getenv('OPENROUTER_API_KEY')
        self.base_url = "https://openrouter.ai/api/v1"

    @property
    def api_key(self) -> Optional[str]:
        if not self._api_key:
            self._api_key = os.getenv('OPENROUTER_API_KEY')
        return self._api_key

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://trende.ai", # Optional, for OpenRouter analytics
            "X-Title": "Trende AI",
            "Content-Type": "application/json"
        }

    async def chat_completion(self, model: str, messages: List[Dict[str, str]], **kwargs) -> Optional[str]:
        if not self.api_key:
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
                    print(f"OpenRouter API error: {response.status_code} - {response.text}")
                    return None

                data = response.json()
                return data['choices'][0]['message']['content']
        except Exception as e:
            print(f"OpenRouter chat completion failed: {e}")
            return None

openrouter_service = OpenRouterService()
