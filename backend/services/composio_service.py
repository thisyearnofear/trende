"""Composio integration service for enhanced AI tooling."""

import os
from typing import Any, Dict, List, Optional

from openai import OpenAI

try:
    from composio.tools.toolset import ComposioToolSet
    COMPOSIO_AVAILABLE = True
except ImportError as e:
    COMPOSIO_AVAILABLE = False
    print(f"Warning: Composio not available. Import error: {e}")


class ComposioService:
    """Service to integrate Composio tools with the AI ecosystem."""
    
    def __init__(self):
        self.composio_api_key = os.getenv("COMPOSIO_API_KEY", "")
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.default_user_id = "trende_agent"
        
        if not COMPOSIO_AVAILABLE or not self.composio_api_key:
            if not COMPOSIO_AVAILABLE:
                print("Warning: Composio package not installed. Composio integration will be disabled.")
            elif not self.composio_api_key:
                print("Warning: COMPOSIO_API_KEY not set. Composio integration will be disabled.")
            self.toolset = None
            self.client = None
        else:
            try:
                # Modern initialization using ComposioToolSet
                self.toolset = ComposioToolSet(api_key=self.composio_api_key)
                self.client = OpenAI(api_key=self.openai_api_key) if self.openai_api_key else None
                print("Composio service initialized successfully.")
            except Exception as e:
                print(f"Warning: Failed to initialize Composio: {e}")
                self.toolset = None
                self.client = None
            
    def get_tools(self, apps: List[str] = None, user_id: str = None) -> List[Any]:
        """
        Get Composio tools for specified apps.
        """
        if not self.toolset:
            return []
            
        try:
            uid = user_id or self.default_user_id
            if apps:
                # Newer SDKs use toolset.get_tools
                tools = self.toolset.get_tools(apps=apps)
            else:
                # Default to some useful apps for research
                tools = self.toolset.get_tools(apps=["github", "google-search", "exa"])
            return tools
        except Exception as e:
            print(f"Error getting Composio tools: {e}")
            return []
    
    def execute_tool(self, tool_name: str, params: Dict[str, Any], user_id: str = None) -> Dict[str, Any]:
        """
        Execute a specific Composio tool.
        """
        if not self.toolset:
            return {"error": "Composio not configured"}
            
        try:
            uid = user_id or self.default_user_id
            # Execute action via toolset
            result = self.toolset.execute_action(
                action=tool_name,
                params=params,
                entity_id=uid
            )
            return result
        except Exception as e:
            print(f"Error executing Composio tool {tool_name}: {e}")
            return {"error": str(e)}
    
    def enhance_with_composio(self, query: str, apps: List[str] = None, user_id: str = None) -> Dict[str, Any]:
        """
        Enhance a query by leveraging Composio tools.
        """
        if not self.client or not self.toolset:
            return {"original_query": query, "enhancement": "Composio not available"}
        
        try:
            uid = user_id or self.default_user_id
            # Get relevant tools
            tools = self.get_tools(apps or ["google-search", "github"], user_id=uid)
            
            if not tools:
                return {"original_query": query, "enhancement": "No tools available"}
            
            # Create a message for the LLM with tools
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": query}],
                tools=tools,
            )
            
            # Process the response and execute tools if needed
            tool_calls = getattr(response.choices[0].message, 'tool_calls', None)
            results = []
            
            if tool_calls:
                for tool_call in tool_calls:
                    # In modern SDK, handle_tool_call might be different, 
                    # but toolset.execute_action is the safe way
                    import json
                    args = json.loads(tool_call.function.arguments)
                    tool_result = self.execute_tool(tool_call.function.name, args, user_id=uid)
                    results.append({
                        "tool_name": tool_call.function.name,
                        "arguments": args,
                        "result": tool_result
                    })
            
            return {
                "original_query": query,
                "enhancement": "Tools executed successfully" if results else "No tools needed",
                "tool_results": results
            }
        except Exception as e:
            print(f"Error enhancing with Composio: {e}")
            return {"original_query": query, "enhancement": f"Error: {str(e)}"}


# Global instance
composio_service = ComposioService()