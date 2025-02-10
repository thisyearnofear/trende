from composio_llamaindex import Action, ComposioToolSet
from llama_index.core.llms import ChatMessage
from llama_index.core.agent import FunctionCallingAgentWorker
from dotenv import load_dotenv
from llama_index.llms.openai import OpenAI
from datetime import datetime
import os
import sys
import time

load_dotenv()

def save_to_markdown(content, filename="trend_analysis.md"):
    """Save the trend analysis to a markdown file with timestamp."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        os.makedirs('trends', exist_ok=True)
        filename = os.path.join('trends', f"trends_{timestamp}.md")
        
        print(f"Attempting to save to: {filename}")
        
        # Create a fallback content if the response is empty
        if not content or len(str(content).strip()) < 10:
            content = """# AI Trend Analysis

## Error in Analysis

The trend analysis could not be completed successfully. This might be due to:
1. API timeouts
2. Rate limiting
3. Connection issues

Please try running the analysis again in a few minutes.

## Raw Data Collected
"""
        
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
        
        # Try to save in the current directory as a fallback
        try:
            fallback_file = f"trend_analysis_error_{timestamp}.md"
            with open(fallback_file, "w") as f:
                f.write(f"# Error in Analysis\n\n{error_msg}\n\n{content}")
            print(f"Fallback file saved as: {fallback_file}")
            return fallback_file
        except:
            print("Could not save fallback file either", file=sys.stderr)
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

llm = OpenAI(model="gpt-4")

toolset = ComposioToolSet()
tools = toolset.get_tools(actions=[
    Action.TWITTER_RECENT_SEARCH,
    Action.TAVILY_TAVILY_SEARCH
])

prefix_messages = [
    ChatMessage(
        role="system",
        content="""You are an advanced trend analyzer specializing in AI technology trends.
            
            Output Format:
            # 🤖 AI Trend Analysis Report

            ## Trending Topics
            
            ### :relevant emoji: Trend Title [Trend Score: X/10] [Momentum: ↑↓→]
            - **Key Insight**: One-line summary
            - **Evidence**: Engagement metrics across platforms, do not say based on Tavily Search but suggest what kind of posts are doing well.
            - **Market Impact**: Potential business implications
            - **Action Items**: Specific next steps
            
            ## Analysis Guidelines Used:
            1. Cross-validated trends across platforms
            2. Included engagement metrics (views, likes, shares)
            3. Performed sentiment analysis
            4. Compared with historical data
            5. Added expert citations where available
            6. Identified market opportunities
            7. Suggested practical applications
            
            ## Data Sources:
            - Recent Twitter Discussions
            - LinkedIn Professional Insights
            - Industry Expert Opinions

            ## Methodology:
            1. Scanned recent Twitter discussions
            2. Researched professional insights and expert opinions
            3. Synthesized findings into actionable insights
            """
    )
]

agent = FunctionCallingAgentWorker(
    tools=tools,  # type: ignore[arg-type]
    llm=llm,
    prefix_messages=prefix_messages,
    max_function_calls=10,
    allow_parallel_tool_calls=False,
    verbose=True
).as_agent()

try:
    print("Getting trend analysis...")
    
    def get_analysis():
        return agent.chat(
            "What are the latest trends in AI? Format the response as a detailed markdown report "
            "focusing on recent Twitter discussions and professional insights."
        )
    
    response = retry_with_backoff(get_analysis)
    print("Got response from agent")
    
    # Save the response to a markdown file
    print("Saving response to file...")
    filename = save_to_markdown(str(response))
    print(f"Process completed successfully. Check {filename} for the analysis.")
except Exception as e:
    print(f"Error during execution: {str(e)}", file=sys.stderr)
    raise
