import os
import http.client
import json
import datetime
from typing import List, Optional
from backend.integrations.base import AbstractPlatformConnector
from shared.models import TrendItem, PlatformType
from backend.utils.rate_limit import rate_limiter

from backend.services.aisa_service import aisa_service

class TwitterConnector(AbstractPlatformConnector):
    @property
    def platform(self) -> str:
        return PlatformType.TWITTER.value

    def __init__(self):
        self.aisa_key = os.getenv('AISA_API_KEY')
        self.rapid_api_key = os.getenv('RAPIDAPI_KEY')
        self.host = "twitter-api45.p.rapidapi.com"

    async def search(self, query: str, limit: int = 10) -> List[TrendItem]:
        # Apply Rate Limiting
        if not await rate_limiter.wait_for_slot(self.platform):
            print(f"Rate limit hit for {self.platform}")
            return []

        # 1. Try AIsa first
        if self.aisa_key:
            results = await aisa_service.twitter_search(query, limit)
            if results:
                print(f"[Twitter] AIsa returned {len(results)} results")
                items = []
                for tweet in results:
                    items.append(TrendItem(
                        id=tweet.get('id', 'unknown'),
                        platform=self.platform,
                        title=f"Tweet by {tweet.get('author_name', 'unknown')}",
                        content=tweet.get('text', ''),
                        author=tweet.get('author_name', 'unknown'),
                        author_handle=tweet.get('author_handle', 'unknown'),
                        url=tweet.get('url', ''),
                        timestamp=datetime.datetime.now(datetime.timezone.utc),
                        metrics=tweet.get('metrics', {}),
                        raw_data=tweet
                    ))
                return items
            else:
                print(f"[Twitter] AIsa returned no results, falling back to RapidAPI")

        # 2. Fallback to RapidAPI
        if not self.rapid_api_key:
            print("Warning: Neither AISA_API_KEY nor RAPIDAPI_KEY set for Twitter")
            return []

        try:
            # Note: In a real async implementation, we would use httpx
            # For this skeleton, using http.client to match existing logic
            conn = http.client.HTTPSConnection(self.host)
            headers = {
                'x-rapidapi-key': self.rapid_api_key,
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
            raw_tweets = data.get('search_results', []) or data.get('timeline', [])
            
            for tweet in raw_tweets[:limit]:
                items.append(TrendItem(
                    id=tweet.get('id_str', tweet.get('id', 'unknown')),
                    platform=self.platform,
                    title=f"Tweet by {tweet.get('user', {}).get('screen_name', 'unknown')}",
                    content=tweet.get('text', ''),
                    author=tweet.get('user', {}).get('name', 'unknown'),
                    author_handle=tweet.get('user', {}).get('screen_name', 'unknown'),
                    url=f"https://twitter.com/i/web/status/{tweet.get('id_str', '')}",
                    timestamp=datetime.datetime.now(datetime.timezone.utc),
                    metrics={
                        'likes': int(tweet.get('favorites', 0)),
                        'retweets': int(tweet.get('retweets', 0)),
                        'views': int(tweet.get('views', 0))
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
