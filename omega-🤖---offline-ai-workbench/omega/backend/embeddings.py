"""
OMEGA AI Workbench - Local Embeddings
Uses local Ollama with nomic-embed-text to generate high-dimensional vectors.
Endpoint: http://localhost:11434/api/embeddings
100% offline, no cloud dependencies.
"""
from typing import List, Optional
import requests

from backend.model_router import MODEL_EMBED

OLLAMA_EMBED_URL = "http://localhost:11434/api/embeddings"


def get_embedding(text: str, model: str = MODEL_EMBED) -> Optional[List[float]]:
    """
    Generates an embedding vector for a single string using local Ollama.
    """
    clean_text = text.strip()
    if not clean_text:
        return None
        
    try:
        response = requests.post(
            OLLAMA_EMBED_URL,
            json={
                "model": model,
                "prompt": clean_text
            },
            headers={"Content-Type": "application/json"},
            timeout=30.0
        )
        
        if response.status_code == 200:
            data = response.json()
            embedding = data.get("embedding", [])
            if embedding and isinstance(embedding, list):
                return embedding
            return None
            
        elif response.status_code == 404:
            raise RuntimeError(
                f"Model '{model}' not found in Ollama. "
                f"Please run `ollama pull {model}` in your terminal."
            )
        else:
            raise RuntimeError(
                f"Ollama embedding request failed with status {response.status_code}: {response.text}"
            )
            
    except requests.exceptions.ConnectionError:
        raise ConnectionError("❌ Ollama is offline. Please start Ollama.")
    except Exception as e:
        raise RuntimeError(f"Embedding error: {str(e)}")


def get_batch_embeddings(texts: List[str], model: str = MODEL_EMBED) -> List[List[float]]:
    """
    Generates embedding vectors for a list of text chunks.
    """
    embeddings = []
    for idx, text in enumerate(texts):
        emb = get_embedding(text, model=model)
        if emb is None:
            # Fallback zero vector if text was empty
            emb = [0.0] * 768
        embeddings.append(emb)
    return embeddings
