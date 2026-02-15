import os
import google.generativeai as genai
from typing import List, Optional
from shared.models.models import PlatformType

class AIService:
    def __init__(self):
        gemini_key = os.getenv('GEMINI_API_KEY')
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.gemini_model = None

    async def get_response(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        if not self.gemini_model:
            return "Gemini API key not configured."
        
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        response = self.gemini_model.generate_content(full_prompt)
        return response.text

ai_service = AIService()
