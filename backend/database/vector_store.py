import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any, Optional
from shared.config import get_settings
from shared.models import TrendItem
import uuid

settings = get_settings()

class VectorStore:
    def __init__(self):
        # Initialize ChromaDB client
        # In a real environment, this might point to a persistent server
        # For now, we use a local persistent directory
        self.client = chromadb.PersistentClient(path="./chroma_db")
        self.collection = self.client.get_or_create_collection(
            name="trend_findings",
            metadata={"hnsw:space": "cosine"}
        )

    def add_findings(self, findings: List[TrendItem], task_id: str):
        """Adds findings to the vector store for future RAG queries."""
        if not findings:
            return

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

    def query_historical_context(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Queries the vector store for relevant historical trends."""
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        
        # Flatten results into a more usable list of matches
        matches = []
        if results['documents']:
            for i in range(len(results['documents'][0])):
                matches.append({
                    "content": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i],
                    "distance": results['distances'][0][i] if 'distances' in results else None
                })
        return matches

vector_store = VectorStore()
