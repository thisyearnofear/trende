import os
import asyncio
from dotenv import load_dotenv

# Load .env from root
load_dotenv(".env")

async def test_openrouter():
    print("--- Testing OpenRouter ---")
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("❌ OPENROUTER_API_KEY not found")
        return
    
    from backend.services.openrouter_service import openrouter_service
    messages = [{"role": "user", "content": "Say hello from OpenRouter"}]
    try:
        response = await openrouter_service.chat_completion(
            model="google/gemini-flash-1.5-exp",
            messages=messages
        )
        if response:
            print(f"✅ OpenRouter Response: {response}")
        else:
            print("❌ OpenRouter returned empty response")
    except Exception as e:
        print(f"❌ OpenRouter Error: {e}")

async def test_pinecone():
    print("\n--- Testing Pinecone ---")
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        print("❌ PINECONE_API_KEY not found")
        return
    
    from backend.services.pinecone_service import pinecone_service
    if not pinecone_service.initialized:
        print("❌ Pinecone service not initialized")
        return
    
    try:
        # Test listing indexes
        print(f"Listing indexes...")
        indexes = pinecone_service.pc.list_indexes()
        print(f"✅ Pinecone Indexes: {[idx.name for idx in indexes]}")
        
        # Test a query
        print("Testing query...")
        query_vector = [0.1] * 1536
        results = pinecone_service.query_vectors(query_vector, top_k=1)
        print(f"✅ Pinecone Query Success: Found {len(results)} matches")
    except Exception as e:
        print(f"❌ Pinecone Error: {e}")

async def main():
    await test_openrouter()
    await test_pinecone()

if __name__ == "__main__":
    asyncio.run(main())
