import os
import google.generativeai as genai
from typing import List, Optional
from backend.services.aisa_service import aisa_service

class AIService:
    def __init__(self):
        gemini_key = os.getenv('GEMINI_API_KEY')
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.gemini_model = None
            
        self.aisa_key = os.getenv('AISA_API_KEY')

    async def get_response(self, prompt: str, system_prompt: Optional[str] = None, provider: str = "aisa") -> str:
        """
        Gets a response from an AI provider.
        Default to 'aisa' as it's the requested pay-as-you-go backbone.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Try AIsa first if configured
        if provider == "aisa" and self.aisa_key:
            response = await aisa_service.chat_completion(
                model="gpt-4o", # Default high-quality model via AIsa
                messages=messages
            )
            if response:
                return response

        # Fallback to Gemini if AIsa fails or is not configured
        if self.gemini_model:
            full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
            try:
                # Note: generate_content is synchronous in the basic SDK, 
                # for production we'd use a thread pool or the async client
                response = self.gemini_model.generate_content(full_prompt)
                return response.text
            except Exception as e:
                print(f"Gemini fallback failed: {e}")

        return "No AI provider configured or available."

ai_service = AIService()
