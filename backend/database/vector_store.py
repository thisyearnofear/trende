try:
    import chromadb
    from chromadb.config import Settings
    HAS_CHROMA = True
except ImportError:
    HAS_CHROMA = False

try:
    import pinecone
    HAS_PINECONE = True
except ImportError:
    HAS_PINECONE = False

from typing import List, Dict, Any, Optional
from shared.config import get_settings
from shared.models import TrendItem
import uuid
import os

settings = get_settings()

class VectorStore:
    def __init__(self):
        # Check if Pinecone is configured and available
        self.use_pinecone = HAS_PINECONE and bool(os.getenv("PINECONE_API_KEY"))
        
        if self.use_pinecone and HAS_PINECONE:
            try:
                from backend.services.pinecone_service import pinecone_service
                self.pinecone_service = pinecone_service
                self.backend = "pinecone"
            except Exception as e:
                print(f"Warning: Pinecone service initialization failed: {e}")
                self.backend = "chroma" if HAS_CHROMA else "mock"
        else:
            self.backend = "chroma" if HAS_CHROMA else "mock"
        
        if self.backend == "chroma" and HAS_CHROMA:
            try:
                self.client = chromadb.PersistentClient(path="./chroma_db")
                self.collection = self.client.get_or_create_collection(
                    name="trend_findings",
                    metadata={"hnsw:space": "cosine"}
                )
            except Exception as e:
                print(f"Warning: ChromaDB initialization failed: {e}")
                self.collection = None
        elif self.backend == "pinecone":
            # Pinecone service is handled by the service instance
            pass
        else:
            print("Warning: No vector store available. VectorStore will operate in Mock mode.")
            self.collection = None

    def add_findings(self, findings: List[TrendItem], task_id: str):
        if not findings:
            return

        if self.backend == "pinecone" and self.pinecone_service.initialized:
            # Use Pinecone service
            vectors = []
            for item in findings:
                # In a real implementation, you'd generate embeddings here
                # For now, we'll simulate with a placeholder
                vector_data = {
                    "id": f"{task_id}_{uuid.uuid4().hex}",
                    "values": [0.1] * 1536,  # Placeholder embedding
                    "metadata": {
                        "task_id": task_id,
                        "platform": item.platform,
                        "author": item.author,
                        "url": item.url,
                        "timestamp": item.timestamp.isoformat() if hasattr(item.timestamp, 'isoformat') else str(item.timestamp),
                        "content": item.content
                    }
                }
                vectors.append(vector_data)
            
            success = self.pinecone_service.upsert_vectors(vectors)
            if not success:
                print("Warning: Failed to upsert vectors to Pinecone")
        elif self.backend == "chroma" and HAS_CHROMA and self.collection:
            # Use ChromaDB
            documents = []
            metadatas = []
            ids = []

            for item in findings:
                documents.append(item.content)
                metadatas.append({
                    "task_id": task_id,
                    "platform": item.platform,
                    "author": item.author,
                    "url": item.url,
                    "timestamp": item.timestamp.isoformat() if hasattr(item.timestamp, 'isoformat') else str(item.timestamp)
                })
                ids.append(f"{task_id}_{uuid.uuid4().hex}")

            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
        else:
            # Mock mode - just print a message
            print(f"Mock mode: Would add {len(findings)} findings to vector store")

    def query_historical_context(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        if self.backend == "pinecone" and self.pinecone_service.initialized:
            # Use Pinecone service
            # In a real implementation, you'd generate an embedding for the query
            # For now, we'll simulate with a placeholder
            query_embedding = [0.1] * 1536  # Placeholder embedding
            matches = self.pinecone_service.query_vectors(query_embedding, top_k=n_results)
            
            results = []
            for match in matches:
                results.append({
                    "content": match.metadata.get("content", ""),
                    "metadata": {k: v for k, v in match.metadata.items() if k != "content"},
                    "distance": match.score
                })
            return results
        elif self.backend == "chroma" and HAS_CHROMA and self.collection:
            # Use ChromaDB
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results
            )

            matches = []
            if results['documents']:
                for i in range(len(results['documents'][0])):
                    matches.append({
                        "content": results['documents'][0][i],
                        "metadata": results['metadatas'][0][i],
                        "distance": results['distances'][0][i] if 'distances' in results else None
                    })
            return matches
        else:
            # Mock mode
            print("Mock mode: Returning empty results from vector store")
            return []

vector_store = VectorStore()
