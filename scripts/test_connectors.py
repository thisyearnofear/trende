
import asyncio
import os
import sys
from typing import List

# Setup path to include project root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.integrations.connectors.twitter import TwitterConnector
from backend.integrations.connectors.tiktok import TikTokConnector
from backend.integrations.connectors.gdelt import GDELTConnector
from backend.integrations.connectors.newsapi import NewsConnector
from shared.models import TrendItem

async def test_connector(name, connector, query):
    print(f"\n--- Testing {name} Connector ---")
    try:
        results: List[TrendItem] = await connector.search(query, limit=3)
        print(f"Results found: {len(results)}")
        for i, item in enumerate(results):
            print(f"[{i+1}] {item.title}")
            print(f"    URL: {item.url}")
            print(f"    Content Preview: {item.content[:100]}...")
        return len(results) > 0
    except Exception as e:
        print(f"Error testing {name}: {e}")
        return False

async def main():
    query = "Arbitrum"
    
    connectors = [
        ("GDELT", GDELTConnector(), query),
        ("NewsAPI", NewsConnector(), query),
        ("Twitter", TwitterConnector(), query),
        ("TikTok", TikTokConnector(), query),
    ]
    
    summary = {}
    for name, connector, q in connectors:
        success = await test_connector(name, connector, q)
        summary[name] = "OK" if success else "FAILED"
        # Sleep to avoid rate limits (especially GDELT)
        print("Waiting 6 seconds for rate limit reset...")
        await asyncio.sleep(6)
    
    print("\n" + "="*30)
    print("Connector Test Summary:")
    for name, status in summary.items():
        print(f"{name}: {status}")
    print("="*30)

if __name__ == "__main__":
    asyncio.run(main())
