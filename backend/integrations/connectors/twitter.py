import os
import http.client
import json
from datetime import datetime
from typing import List, Optional
from backend.integrations.base import AbstractPlatformConnector
from shared.models.models import TrendItem, PlatformType

class TwitterConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> PlatformType:
        return PlatformType.TWITTER

    def __init__(self):
        self.api_key = os.getenv('RAPIDAPI_KEY')
        self.host = "twitter-api45.p.rapidapi.com"

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        if not self.api_key:
            print("Warning: RAPIDAPI_KEY not set")
            return []

        try:
            # Note: In a real async implementation, we would use httpx
            # For this skeleton, using http.client to match existing logic
            conn = http.client.HTTPSConnection(self.host)
            headers = {
                'x-rapidapi-key': self.api_key,
                'x-rapidapi-host': self.host
            }
            
            # Using search instead of timeline for broad discovery
            encoded_query = query.replace(" ", "%20")
            conn.request("GET", f"/search.php?query={encoded_query}", headers=headers)
            res = conn.getresponse()
            
            if res.status != 200:
                print(f"Twitter API error: {res.status}")
                return []

            data = json.loads(res.read().decode("utf-8"))
            items = []
            
            # Placeholder: Adjust parsing based on actual RapidAPI 'search.php' response structure
            # mimicking the timeline logic from main.py
            raw_tweets = data.get('search_results', []) or data.get('timeline', [])
            
            for tweet in raw_tweets[:limit]:
                items.append(TrendItem(
                    id=tweet.get('id_str', tweet.get('id', 'unknown')),
                    platform=self.platform,
                    title=f"Tweet by {tweet.get('user', {}).get('screen_name', 'unknown')}",
                    content=tweet.get('text', ''),
                    author=tweet.get('user', {}).get('screen_name', 'unknown'),
                    url=f"https://twitter.com/i/web/status/{tweet.get('id_str', '')}",
                    timestamp=datetime.now(), # Map properly if available
                    metrics={
                        'likes': tweet.get('favorites', 0),
                        'retweets': tweet.get('retweets', 0),
                        'views': tweet.get('views', 0)
                    },
                    raw_data=tweet
                ))
            return items
        except Exception as e:
            print(f"Twitter search failed: {e}")
            return []

    async def get_item_details(self, item_id: str) -> Optional[TrendItem]:
        # Implementation for specific tweet details
        return None
