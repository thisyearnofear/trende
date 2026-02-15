import os
import httpx
from typing import List, Dict, Any, Optional

class VeniceService:
    """
    Service for interacting with Venice.ai API.
    Venice provides an OpenAI-compatible API for private, uncensored inference.
    """
    def __init__(self):
        self._api_key = os.getenv('VENICE_API_KEY')
        self.base_url = "https://api.venice.ai/api/v1"

    @property
    def api_key(self) -> Optional[str]:
        if not self._api_key:
            self._api_key = os.getenv('VENICE_API_KEY')
        return self._api_key

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
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
                    print(f"Venice API error: {response.status_code} - {response.text}")
                    return None

                data = response.json()
                return data['choices'][0]['message']['content']
        except Exception as e:
            print(f"Venice chat completion failed: {e}")
            return None

venice_service = VeniceService()
