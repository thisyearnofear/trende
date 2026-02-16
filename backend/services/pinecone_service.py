"""Pinecone integration service for vector storage and retrieval."""

import os
from typing import Any, Dict, List, Optional

try:
    from pinecone import Pinecone, ServerlessSpec
    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False
    print("Warning: pinecone-client not installed. Pinecone integration will be disabled.")


class PineconeService:
    """Service to integrate Pinecone vector database with the AI ecosystem."""
    
    def __init__(self):
        self.api_key = os.getenv("PINECONE_API_KEY", "")
        self.index_name = os.getenv("PINECONE_INDEX", "trends")
        
        if not self.api_key:
            print("Warning: PINECONE_API_KEY not set. Pinecone integration will be disabled.")
            self.initialized = False
        elif not PINECONE_AVAILABLE:
            self.initialized = False
        else:
            try:
                # Initialize Pinecone with new API
                self.pc = Pinecone(api_key=self.api_key)
                
                # Check if index exists, create if not
                try:
                    index_list = self.pc.list_indexes()
                    existing_indexes = [idx.name for idx in index_list]
                except Exception as e:
                    print(f"Warning: Could not list Pinecone indexes: {e}")
                    existing_indexes = []
                
                if self.index_name not in existing_indexes:
                    print(f"Creating Pinecone index: {self.index_name}")
                    try:
                        self.pc.create_index(
                            name=self.index_name,
                            dimension=1536,  # Standard for OpenAI embeddings
                            metric='cosine',
                            spec=ServerlessSpec(cloud='aws', region='us-east-1')
                        )
                    except Exception as e:
                        if "already exists" in str(e).lower():
                            print(f"Index {self.index_name} already exists (race condition).")
                        else:
                            raise e
                
                self.index = self.pc.Index(self.index_name)
                self.initialized = True
                print(f"Pinecone service initialized with index: {self.index_name}")
            except Exception as e:
                print(f"Error initializing Pinecone: {e}")
                self.initialized = False
    
    def upsert_vectors(self, vectors: List[Dict[str, Any]], namespace: str = "trends") -> bool:
        """
        Upsert vectors to Pinecone index.
        
        Args:
            vectors: List of vectors to upsert, each with id, values, and metadata
            namespace: Namespace to store vectors in
            
        Returns:
            True if successful, False otherwise
        """
        if not self.initialized:
            return False
            
        try:
            self.index.upsert(vectors=vectors, namespace=namespace)
            return True
        except Exception as e:
            print(f"Error upserting vectors to Pinecone: {e}")
            return False
    
    def query_vectors(self, vector: List[float], top_k: int = 10, namespace: str = "trends", 
                     filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Query Pinecone index for similar vectors.
        
        Args:
            vector: Query vector
            top_k: Number of results to return
            namespace: Namespace to query
            filters: Metadata filters
            
        Returns:
            List of matching vectors with metadata
        """
        if not self.initialized:
            return []
            
        try:
            response = self.index.query(
                vector=vector,
                top_k=top_k,
                namespace=namespace,
                filter=filters,
                include_metadata=True
            )
            return response.matches
        except Exception as e:
            print(f"Error querying Pinecone: {e}")
            return []
    
    def delete_vectors(self, ids: List[str], namespace: str = "trends") -> bool:
        """
        Delete vectors from Pinecone index by ID.
        
        Args:
            ids: List of vector IDs to delete
            namespace: Namespace to delete from
            
        Returns:
            True if successful, False otherwise
        """
        if not self.initialized:
            return False
            
        try:
            self.index.delete(ids=ids, namespace=namespace)
            return True
        except Exception as e:
            print(f"Error deleting vectors from Pinecone: {e}")
            return False
    
    def get_vector_stats(self, namespace: str = "trends") -> Dict[str, Any]:
        """
        Get statistics about the Pinecone index.
        
        Args:
            namespace: Namespace to get stats for
            
        Returns:
            Statistics about the index
        """
        if not self.initialized:
            return {}
            
        try:
            return self.index.describe_index_stats()
        except Exception as e:
            print(f"Error getting Pinecone stats: {e}")
            return {}
    
    def enhance_search(self, query: str, query_embedding: List[float], 
                      top_k: int = 5) -> Dict[str, Any]:
        """
        Enhance search results using Pinecone vector similarity.
        
        Args:
            query: Original search query
            query_embedding: Embedding of the query
            top_k: Number of similar items to retrieve
            
        Returns:
            Enhanced search results with context
        """
        if not self.initialized:
            return {"original_query": query, "enhanced_results": [], "context": ""}
        
        try:
            matches = self.query_vectors(vector=query_embedding, top_k=top_k)
            
            enhanced_results = []
            context_parts = []
            
            for match in matches:
                enhanced_results.append({
                    "id": match.id,
                    "score": match.score,
                    "metadata": match.metadata
                })
                if "text" in match.metadata:
                    context_parts.append(match.metadata["text"])
            
            context = " ".join(context_parts)
            
            return {
                "original_query": query,
                "enhanced_results": enhanced_results,
                "context": context,
                "match_count": len(matches)
            }
        except Exception as e:
            print(f"Error enhancing search with Pinecone: {e}")
            return {"original_query": query, "enhanced_results": [], "context": "", "error": str(e)}


# Global instance
pinecone_service = PineconeService()