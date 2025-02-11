from composio_llamaindex import Action, ComposioToolSet
from llama_index.core.llms import ChatMessage
from llama_index.core.agent import FunctionCallingAgentWorker
from dotenv import load_dotenv
from llama_index.llms.openai import OpenAI
from datetime import datetime
import os
import sys
import time
from twitter_lists import TWITTER_LISTS
import http.client
import json
import google.generativeai as genai

load_dotenv()

# Initialize Gemini
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
gemini_model = genai.GenerativeModel('gemini-1.5-flash')

def get_selected_accounts():
    """Get Twitter accounts from selected categories."""
    categories = os.getenv('TREND_CATEGORIES', '').split(',')
    if not categories or not categories[0]:
        return []
    
    accounts = []
    for category in categories:
        if category in TWITTER_LISTS:
            accounts.extend(TWITTER_LISTS[category])
    return accounts

def save_to_markdown(content, filename="trend_analysis.md"):
    """Save the trend analysis to a markdown file with timestamp."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        os.makedirs('trends', exist_ok=True)
        filename = os.path.join('trends', f"trends_{timestamp}.md")
        
        print(f"Attempting to save to: {filename}")
        
        # Create a fallback content if the response is empty
        if not content or len(str(content).strip()) < 10:
            content = """# AI Trend Analysis Error"""
        
        with open(filename, "w") as f:
            f.write("# AI Trend Analysis\n\n")
            f.write(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("---\n\n")
            f.write(str(content))
        
        print(f"\nAnalysis saved to: {filename}")
        return filename
    except Exception as e:
        error_msg = f"Error saving file: {str(e)}"
        print(error_msg, file=sys.stderr)
        raise

def retry_with_backoff(func, max_retries=3):
    """Retry a function with exponential backoff."""
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"All {max_retries} attempts failed")
                raise
            wait_time = (2 ** attempt) + 1
            print(f"Attempt {attempt + 1} failed: {str(e)}")
            print(f"Retrying in {wait_time} seconds...")
            time.sleep(wait_time)

def get_llm(use_openai=False):
    """Get the LLM based on preference."""
    if use_openai:
        return OpenAI(model="gpt-4")
    else:
        return gemini_model

def analyze_with_gemini(message, system_prompt):
    """Analyze content using Gemini API."""
    try:
        # Combine system prompt and message
        full_prompt = f"{system_prompt}\n\n{message}"
        
        # Generate content using Gemini
        response = gemini_model.generate_content(full_prompt)
        
        return response.text
    except Exception as e:
        print(f"Gemini API error: {str(e)}")
        return None

def get_tweets_from_rapidapi(handle):
    """Get tweets using RapidAPI Twitter endpoints."""
    try:
        # Use the working timeline endpoint
        conn = http.client.HTTPSConnection("twitter-api45.p.rapidapi.com")
        headers = {
            'x-rapidapi-key': os.getenv('RAPIDAPI_KEY', ""),
            'x-rapidapi-host': "twitter-api45.p.rapidapi.com"
        }
        
        # Get user's timeline directly
        conn.request("GET", f"/timeline.php?screenname={handle}", headers=headers)
        res = conn.getresponse()
        if res.status == 200:
            data = json.loads(res.read().decode("utf-8"))
            if data and 'timeline' in data:
                return {
                    'tweets': [
                        {
                            'text': tweet.get('text', ''),
                            'created_at': tweet.get('created_at', ''),
                            'metrics': {
                                'retweet_count': tweet.get('retweets', 0),
                                'reply_count': tweet.get('replies', 0),
                                'like_count': tweet.get('favorites', 0),
                                'quote_count': tweet.get('quotes', 0),
                                'view_count': tweet.get('views', 0)
                            }
                        }
                        for tweet in data['timeline']
                    ]
                }
    except Exception as e:
        print(f"RapidAPI error for {handle}: {str(e)}")
    return None

def analyze_tweets(accounts):
    """Analyze tweets from selected accounts using RapidAPI."""
    # For now, just focus on entrepreneurs
    handles = [account['handle'] for account in accounts if account.get('handle') == 'elonmusk']
    if not handles:
        handles = [accounts[0]['handle']]  # If no Elon, take the first account
    
    results = []
    errors = []
    
    # Use RapidAPI to get tweets
    if not os.getenv('RAPIDAPI_KEY'):
        raise Exception("RAPIDAPI_KEY is required but not set in environment variables")
    
    for handle in handles:
        try:
            rapidapi_data = get_tweets_from_rapidapi(handle)
            if rapidapi_data:
                tweets = rapidapi_data.get('tweets', [])
                if tweets:
                    # Take the 10 most recent tweets without filtering
                    results.extend([{
                        'author': handle,
                        'text': tweet.get('text', ''),
                        'created_at': tweet.get('created_at', ''),
                        'metrics': tweet.get('metrics', {})
                    } for tweet in tweets[:10]])
        except Exception as e:
            errors.append(f"RapidAPI error for {handle}: {str(e)}")
    
    if not results:
        error_msg = "\n".join(errors) if errors else "No tweets found"
        raise Exception(f"Search failed:\n{error_msg}")
    
    return {"data": results}

def get_system_prompt():
    """Generate system prompt based on selected categories."""
    accounts = get_selected_accounts()
    handles = [f"@{account['handle']}" for account in accounts]
    
    categories = os.getenv('TREND_CATEGORIES', '').split(',')
    category_focus = []
    for cat in categories:
        if cat in TWITTER_LISTS:
            focus_areas = set(focus for account in TWITTER_LISTS[cat] for focus in account['focus'])
            category_focus.append(f"{cat.title()}: {', '.join(focus_areas)}")
    
    return f"""You are an advanced trend analyzer specializing in AI and crypto technology trends, focusing on extracting specific insights from Twitter discussions.
            
            Target Accounts: {', '.join(handles)}
            Category Focus Areas:
            {chr(10).join(f"- {focus}" for focus in category_focus)}
            
            Output Format:
            # 🤖 AI & Crypto Trend Analysis Report

            ## Category Overview
            Brief overview of the selected category's recent activity and focus areas.

            ## Trending Topics
            
            ### :relevant emoji: Trend Title [Impact Score: X/10]
            - **Key Insight**: One-line summary of the specific development or trend
            - **Source**: @twitter_handle: "exact quote or precise paraphrase" (include engagement metrics if notable)
            - **Supporting Voices**: 
              - @another_handle: "supporting quote"
              - Additional relevant context from their thread
            - **Technical Details**: Specific technical aspects mentioned
            - **Market Impact**: Concrete implications, with specific numbers/predictions when available
            
            Note: Only include trends with direct quotes or clear evidence from the target accounts."""

def main():
    print("Getting trend analysis...")
    
    try:
        # Get selected accounts
        accounts = get_selected_accounts()
        if not accounts:
            print("No categories selected. Please select at least one category.")
            return
        
        # Get the search results
        search_data = analyze_tweets(accounts)
        
        if not search_data.get('data'):
            raise Exception("No relevant content found for analysis")
        
        # Get system prompt
        system_prompt = get_system_prompt()
        
        # Generate the message for analysis
        handles = [f"@{tweet['author']}" for tweet in search_data['data'][:1]]  # Just get the handle from first tweet
        
        # Prepare the tweets for analysis
        tweets_text = "\n\n".join([
            f"Tweet from @{tweet['author']}:\n{tweet['text']}\n(Posted: {tweet['created_at']})"
            for tweet in search_data['data']
        ])
        
        message = f"""Analyze these tweets from {', '.join(handles)}:

        {tweets_text}
        
        Focus on:
        1. Recent tweets and discussions
        2. Technical developments and research
        3. Market impacts and predictions
        4. Specific quotes and insights
        
        Create a trend analysis based on these tweets."""
        
        print(f"Added user message to memory: {message}")
        
        # Try Gemini first, fall back to OpenAI if needed
        response = analyze_with_gemini(message, system_prompt)
        
        if not response:
            print("Falling back to OpenAI...")
            agent = FunctionCallingAgentWorker.from_tools(
                tools=[],
                llm=OpenAI(model="gpt-4"),
                system_prompt=system_prompt,
                verbose=True
            )
            response = agent.complete(message)
        
        # Save the analysis
        if response:
            save_to_markdown(str(response))
        else:
            raise Exception("No response generated from analysis")
            
    except Exception as e:
        error_message = f"""# AI Trend Analysis Error

## Error Details
{str(e)}

## Troubleshooting
- Check if the selected accounts have recent posts about AI or crypto
- Verify that your RAPIDAPI_KEY is correct
- Try selecting a different category
- Try again in a few minutes if this is a temporary issue"""
        
        save_to_markdown(error_message)
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
