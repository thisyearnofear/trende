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

    async def list_models(self) -> List[str]:
        """Fetches available models from Venice."""
        if not self.api_key:
            return []
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers=self.headers,
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    # Response format: {"data": [{"id": "..."}, ...]}
                    return [m['id'] for m in data.get('data', [])]
        except Exception as e:
            print(f"Venice list_models failed: {e}")
        return []

    async def chat_completion(self, model: str, messages: List[Dict[str, str]], **kwargs) -> Optional[str]:
        if not self.api_key:
            return None

        # Fallback logic: If the requested model isn't available, try to find a similar one
        # or use a known stable one from the live list.
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
                
                if response.status_code == 404:
                    # Model likely rotated. Try to find the closest match or default.
                    available = await self.list_models()
                    if available:
                        # Try to find a llama-3 based model if that's what was requested
                        new_model = next((m for m in available if "llama-3" in m.lower()), available[0])
                        print(f"Venice model {model} not found. Falling back to {new_model}")
                        payload["model"] = new_model
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
