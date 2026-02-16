#!/usr/bin/env python3
"""Test OpenRouter API key against free models."""

import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv(".env")

# Known free models on OpenRouter (fetched Feb 2026)
FREE_MODELS = [
    "openrouter/aurora-alpha",
    "openrouter/free",
    "stepfun/step-3.5-flash:free",
    "arcee-ai/trinity-large-preview:free",
    "upstage/solar-pro-3:free",
    "liquid/lfm-2.5-1.2b-thinking:free",
    "liquid/lfm-2.5-1.2b-instruct:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "arcee-ai/trinity-mini:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    "z-ai/glm-4.5-air:free",
    "qwen/qwen3-coder:free",
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    "google/gemma-3n-e2b-it:free",
    "deepseek/deepseek-r1-0528:free",
    "google/gemma-3n-e4b-it:free",
    "qwen/qwen3-4b:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "google/gemma-3-4b-it:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
]

BASE_URL = "https://openrouter.ai/api/v1"

async def test_model(client: httpx.AsyncClient, headers: dict, model: str) -> dict:
    """Test a single model and return result."""
    try:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": "Reply with just: OK"}],
            "max_tokens": 10,
        }
        response = await client.post(
            f"{BASE_URL}/chat/completions",
            json=payload,
            headers=headers,
            timeout=15.0,
        )
        
        if response.status_code == 200:
            data = response.json()
            content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            return {"model": model, "status": "✅ OK", "response": content[:50]}
        else:
            error = response.json().get('error', {}).get('message', response.text[:100])
            return {"model": model, "status": "❌ FAIL", "error": error}
    except asyncio.TimeoutError:
        return {"model": model, "status": "⏱️ TIMEOUT", "error": "Request timed out"}
    except Exception as e:
        return {"model": model, "status": "❌ ERROR", "error": str(e)[:100]}

async def main():
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("❌ OPENROUTER_API_KEY not found in environment")
        return
    
    print(f"🔑 API Key found: {api_key[:8]}...{api_key[-4:]}")
    print(f"\n📋 Testing {len(FREE_MODELS)} free models...\n")
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://trende.ai",
        "X-Title": "Trende AI - Model Test",
        "Content-Type": "application/json"
    }
    
    working = []
    failed = []
    
    async with httpx.AsyncClient() as client:
        # Test models concurrently in batches of 5
        for i in range(0, len(FREE_MODELS), 5):
            batch = FREE_MODELS[i:i+5]
            tasks = [test_model(client, headers, model) for model in batch]
            results = await asyncio.gather(*tasks)
            
            for result in results:
                model_short = result['model'].replace(':free', '')
                if result['status'].startswith('✅'):
                    working.append(result['model'])
                    print(f"{result['status']} {model_short}")
                else:
                    failed.append(result)
                    error_msg = result.get('error', 'Unknown error')[:60]
                    print(f"{result['status']} {model_short}: {error_msg}")
            
            # Small delay between batches to avoid rate limiting
            if i + 5 < len(FREE_MODELS):
                await asyncio.sleep(0.5)
    
    print(f"\n{'='*60}")
    print(f"📊 Results: {len(working)}/{len(FREE_MODELS)} models working")
    print(f"\n✅ Working models ({len(working)}):")
    for m in working:
        print(f"   - {m}")
    
    if failed:
        print(f"\n❌ Failed models ({len(failed)}):")
        for f in failed:
            print(f"   - {f['model']}: {f.get('error', 'Unknown')[:50]}")

if __name__ == "__main__":
    asyncio.run(main())
