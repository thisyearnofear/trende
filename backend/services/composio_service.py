"""Composio integration service for enhanced AI tooling."""

import os
from typing import Any, Dict, List, Optional

from composio_openai import ComposioToolSet
from openai import OpenAI


class ComposioService:
    """Service to integrate Composio tools with the AI ecosystem."""
    
    def __init__(self):
        self.composio_api_key = os.getenv("COMPOSIO_API_KEY", "")
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        
        if not self.composio_api_key:
            print("Warning: COMPOSIO_API_KEY not set. Composio integration will be disabled.")
            self.toolset = None
            self.client = None
        else:
            self.toolset = ComposioToolSet(api_key=self.composio_api_key)
            self.client = OpenAI(api_key=self.openai_api_key) if self.openai_api_key else None
            
    def get_tools(self, apps: List[str] = None) -> List[Any]:
        """
        Get Composio tools for specified apps.
        
        Args:
            apps: List of app names to get tools for (e.g., ['github', 'gmail', 'slack'])
            
        Returns:
            List of tool objects that can be used with LLMs
        """
        if not self.toolset:
            return []
            
        try:
            if apps:
                tools = self.toolset.get_tools(apps=apps)
            else:
                # Default to some useful apps
                tools = self.toolset.get_tools(apps=["github", "browseruse"])
            return tools
        except Exception as e:
            print(f"Error getting Composio tools: {e}")
            return []
    
    def execute_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """
        Execute a specific Composio tool with given parameters.
        
        Args:
            tool_name: Name of the tool to execute
            **kwargs: Parameters for the tool
            
        Returns:
            Result of the tool execution
        """
        if not self.toolset:
            return {"error": "Composio not configured"}
            
        try:
            result = self.toolset.execute_action(
                action=tool_name,
                params=kwargs,
            )
            return result
        except Exception as e:
            print(f"Error executing Composio tool {tool_name}: {e}")
            return {"error": str(e)}
    
    def enhance_with_composio(self, query: str, apps: List[str] = None) -> Dict[str, Any]:
        """
        Enhance a query by leveraging Composio tools.
        
        Args:
            query: Original query to enhance
            apps: Apps to use for enhancement
            
        Returns:
            Enhanced result with tool outputs
        """
        if not self.client or not self.toolset:
            return {"original_query": query, "enhancement": "Composio not available"}
        
        try:
            # Get relevant tools
            tools = self.get_tools(apps or ["browseruse", "github"])
            
            if not tools:
                return {"original_query": query, "enhancement": "No tools available"}
            
            # Create a message for the LLM with tools
            response = self.client.chat.completions.create(
                model="gpt-4o",  # Using a capable model
                messages=[{"role": "user", "content": query}],
                tools=tools,
            )
            
            # Process the response and execute tools if needed
            tool_calls = getattr(response.choices[0].message, 'tool_calls', None)
            results = []
            
            if tool_calls:
                for tool_call in tool_calls:
                    tool_result = self.toolset.handle_tool_call(tool_call)
                    results.append({
                        "tool_name": tool_call.function.name,
                        "arguments": tool_call.function.arguments,
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