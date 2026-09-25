"""
OMEGA AI Workbench - Local Document RAG Engine
Local vector storage with ChromaDB + nomic-embed-text embeddings + llama3.1:8b reasoning.
All documents and queries remain 100% on the local machine.
"""
import os
import re
import uuid
from typing import List, Dict, Any, Optional, Tuple
import chromadb
from chromadb.config import Settings

from backend.model_router import MODEL_CHAT, MODEL_EMBED
from backend.embeddings import get_embedding, get_batch_embeddings
from backend.ollama_client import ask_ollama

# Default local persistence path for ChromaDB
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMA_DATA_DIR = os.path.join(BASE_DIR, "data", "chroma")
os.makedirs(CHROMA_DATA_DIR, exist_ok=True)

# Collection name for document RAG
COLLECTION_NAME = "omega_local_documents"

_client_instance = None


def get_chroma_client():
    """
    Singleton persistent Chroma client for offline vector storage.
    """
    global _client_instance
    if _client_instance is None:
        _client_instance = chromadb.PersistentClient(
            path=CHROMA_DATA_DIR,
            settings=Settings(anonymized_telemetry=False, is_persistent=True)
        )
    return _client_instance


def get_or_create_collection():
    """
    Retrieves or initializes the Chroma document collection.
    """
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "OMEGA offline local document collection"}
    )


def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[str]:
    """
    Splits document text into overlapping token/character windows cleanly on sentence or paragraph boundaries.
    """
    if not text or not text.strip():
        return []
        
    cleaned_text = re.sub(r'\r\n|\r', '\n', text)
    cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text).strip()
    
    # Split by paragraphs first
    paragraphs = cleaned_text.split('\n\n')
    chunks: List[str] = []
    current_chunk = ""
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        if len(current_chunk) + len(para) + 2 <= chunk_size:
            if current_chunk:
                current_chunk += "\n\n" + para
            else:
                current_chunk = para
        else:
            if current_chunk:
                chunks.append(current_chunk)
                # Apply overlap from the tail of current chunk if possible
                tail = current_chunk[-chunk_overlap:] if len(current_chunk) > chunk_overlap else ""
                current_chunk = (tail + "\n" + para).strip()
            else:
                # If a single paragraph is longer than chunk_size, split by sentences
                sentences = re.split(r'(?<=[.!?]) +', para)
                sub_chunk = ""
                for s in sentences:
                    if len(sub_chunk) + len(s) + 1 <= chunk_size:
                        sub_chunk = (sub_chunk + " " + s).strip()
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk)
                        sub_chunk = s
                if sub_chunk:
                    chunks.append(sub_chunk)
                current_chunk = ""
                
    if current_chunk:
        chunks.append(current_chunk)
        
    return chunks


def index_document(
    filename: str,
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50
) -> Tuple[bool, int, str]:
    """
    Indexes an uploaded document:
    1. Chunks text
    2. Computes embeddings using local nomic-embed-text
    3. Persists chunks + vectors into local ChromaDB
    
    Returns: (success, num_chunks, status_message)
    """
    chunks = chunk_text(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    if not chunks:
        return False, 0, "Document text was empty or unreadable."
        
    try:
        collection = get_or_create_collection()
        
        # Prepare IDs and metadata
        doc_id_base = str(uuid.uuid4())[:8]
        ids = [f"{doc_id_base}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {"source": filename, "chunk_index": i, "total_chunks": len(chunks)}
            for i in range(len(chunks))
        ]
        
        # Generate embeddings using local nomic-embed-text
        embeddings = get_batch_embeddings(chunks, model=MODEL_EMBED)
        
        # Add to ChromaDB
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas
        )
        
        return True, len(chunks), f"✅ Document '{filename}' processed locally ({len(chunks)} chunks indexed)."
        
    except ConnectionError as ce:
        return False, 0, f"❌ Ollama is offline. Please start Ollama to generate embeddings. ({str(ce)})"
    except Exception as e:
        return False, 0, f"❌ Error indexing document locally: {str(e)}"


def query_document_rag(
    query: str,
    n_results: int = 4,
    min_similarity: float = 0.3
) -> Dict[str, Any]:
    """
    Executes a grounded RAG query over indexed local documents:
    1. Embeds the user query via nomic-embed-text
    2. Retrieves top similar chunks from ChromaDB
    3. Prompts llama3.1:8b to answer strictly using retrieved context
    
    Returns structured answer and source references.
    """
    clean_query = query.strip()
    if not clean_query:
        return {
            "success": False,
            "answer": "Please enter a valid question about the document.",
            "sources": []
        }
        
    try:
        collection = get_or_create_collection()
        count = collection.count()
        if count == 0:
            return {
                "success": False,
                "answer": "No documents are currently indexed. Please upload a PDF, DOCX, or TXT file first.",
                "sources": []
            }
            
        # 1. Embed question locally
        query_vector = get_embedding(clean_query, model=MODEL_EMBED)
        if not query_vector:
            return {
                "success": False,
                "answer": "Could not generate vector embedding for the query. Verify Ollama is running.",
                "sources": []
            }
            
        # 2. Query ChromaDB
        actual_k = min(n_results, count)
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=actual_k,
            include=["documents", "metadatas", "distances"]
        )
        
        retrieved_docs = results.get("documents", [[]])[0]
        retrieved_meta = results.get("metadatas", [[]])[0]
        retrieved_dist = results.get("distances", [[]])[0]
        
        if not retrieved_docs:
            return {
                "success": True,
                "answer": "I could not find this information in the uploaded document.",
                "sources": []
            }
            
        # Format sources
        sources = []
        context_parts = []
        for doc, meta, dist in zip(retrieved_docs, retrieved_meta, retrieved_dist):
            # Chroma distances with cosine: similarity ~ 1 - distance
            similarity = round(max(0.0, 1.0 - (dist if dist is not None else 1.0)), 3)
            sources.append({
                "source": meta.get("source", "Document"),
                "chunk_index": meta.get("chunk_index", 0),
                "text": doc,
                "similarity": similarity
            })
            context_parts.append(f"[Excerpt from {meta.get('source', 'document')}]:\n{doc}")
            
        context_str = "\n\n---\n\n".join(context_parts)
        
        # 3. Grounded Prompt with strict instructions as requested
        system_instruction = (
            "You are OMEGA, a secure and sovereign offline AI workbench. "
            "You are answering questions about an uploaded document. "
            "CRITICAL INSTRUCTION: You must answer the user's question STRICTLY based on the provided document context below. "
            "If the answer does not exist or cannot be directly inferred from the document context, you MUST reply exactly: "
            "'I could not find this information in the uploaded document.' "
            "Do NOT hallucinate, pretend, or use external assumptions."
        )
        
        prompt = (
            f"DOCUMENT CONTEXT:\n"
            f"{context_str}\n\n"
            f"USER QUESTION: {clean_query}\n\n"
            f"GROUNDED ANSWER:"
        )
        
        # 4. Ask llama3.1:8b
        res = ask_ollama(
            model=MODEL_CHAT,
            prompt=prompt,
            system=system_instruction,
            timeout=120
        )
        
        if res.get("success"):
            answer = res.get("response", "").strip()
            return {
                "success": True,
                "answer": answer,
                "sources": sources,
                "model_used": MODEL_CHAT
            }
        else:
            return {
                "success": False,
                "answer": res.get("response", "Error generating response from local model."),
                "sources": sources,
                "error": res.get("error")
            }
            
    except ConnectionError:
        return {
            "success": False,
            "answer": "❌ Ollama is offline. Please start Ollama.",
            "sources": []
        }
    except Exception as e:
        return {
            "success": False,
            "answer": f"❌ Error querying local document vector store: {str(e)}",
            "sources": []
        }


def clear_chroma_collection() -> bool:
    """
    Clears all indexed documents from the ChromaDB collection.
    """
    try:
        client = get_chroma_client()
        client.delete_collection(COLLECTION_NAME)
        return True
    except Exception:
        return False


def get_chroma_stats() -> Dict[str, Any]:
    """
    Returns statistics about the local Chroma database.
    """
    try:
        collection = get_or_create_collection()
        count = collection.count()
        return {
            "status": "Online (Persistent)",
            "total_chunks": count,
            "storage_path": CHROMA_DATA_DIR,
            "healthy": True
        }
    except Exception as e:
        return {
            "status": f"Error: {str(e)}",
            "total_chunks": 0,
            "storage_path": CHROMA_DATA_DIR,
            "healthy": False
        }
