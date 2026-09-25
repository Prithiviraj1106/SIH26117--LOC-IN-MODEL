"""
embedding.py — Custom ChromaDB embedding function for fully-offline RAG.

Implements a lightweight, deterministic, pure-Python embedding based on
character n-gram hashing (a bag-of-ngrams word-hashing style trick).

WHY: ChromaDB's default ONNX MiniLM embedder downloads a 79MB model from
S3, and this Ollama server build does not expose an embeddings API. To
keep the workbench 100% sovereign / on-prem with zero external downloads,
we generate fixed-size vectors entirely on-device.

This is adequate for semantic-ish retrieval over the small SOP corpus.
Vectors are L2-normalized so cosine similarity == dot product.

If a local Ollama embedding API becomes available, replace this class
with a thin wrapper around ollama.embed() (see OllamaEmbeddingFunction
commented at the bottom).
"""
from typing import List, Union
import math
import numpy as np

from chromadb.api.types import (
    Documents,
    EmbeddingFunction,
    Embeddings,
)

# Fixed embedding dimension
DIM = 384
# Character n-gram range for the hashing trick
RANGE = 3  # uses 2-grams and 3-grams
SALT = 0x9E3779B9


def _hash_ngram(ngram: str, i: int) -> int:
    """Stable string hash (FNV-1a variant) mixed with position bucket."""
    h = 2166136261
    for ch in ngram:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    h ^= (i * SALT) & 0xFFFFFFFF
    return h & 0xFFFFFFFF


class LocalEmbeddingFunction(EmbeddingFunction):
    """Deterministic bag-of-character-ngrams hashing embedder (offline)."""

    def __init__(self, dim: int = DIM):
        self.dim = dim

    def _embed_one(self, text: str) -> np.ndarray:
        vec = np.zeros(self.dim, dtype=np.float32)
        norm_text = text.lower()
        for n in range(2, RANGE + 1):
            for i in range(len(norm_text) - n + 1):
                ngram = norm_text[i:i + n]
                idx = _hash_ngram(ngram, i) % self.dim
                vec[idx] += 1.0
        # L2 normalize
        norm = float(np.linalg.norm(vec))
        if norm > 0:
            vec = vec / norm
        return vec

    def __call__(self, input: Union[str, Documents]) -> Embeddings:
        if isinstance(input, str):
            input = [input]
        return [self._embed_one(doc) for doc in input]


# Default used by the RAG pipeline
DEFAULT_EMBEDDING_FUNCTION = LocalEmbeddingFunction()
