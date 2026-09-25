"""
OMEGA AI Workbench - Ollama Client
Robust, local HTTP communication with local Ollama service.
Endpoint: http://localhost:11434
No external cloud requests.
"""
import json
import logging
from typing import Optional, List, Dict, Any, Tuple
import requests

# Base endpoint for local Ollama instance
OLLAMA_BASE_URL = "http://localhost:11434"
TIMEOUT_SECONDS = 120  # Model inference can take time on consumer hardware

logger = logging.getLogger("omega.ollama")


def check_ollama_status() -> Tuple[bool, str, List[str]]:
    """
    Pings local Ollama service to check if the daemon is online and inspects installed models.
    Returns: (is_online, status_message, list_of_model_names)
    """
    try:
        url = f"{OLLAMA_BASE_URL}/api/tags"
        response = requests.get(url, timeout=3.0)
        
        if response.status_code == 200:
            data = response.json()
            models = [m.get("name", "") for m in data.get("models", [])]
            return True, "🟢 Ollama is running locally", models
        else:
            return False, f"⚠️ Ollama responded with HTTP {response.status_code}", []
            
    except requests.exceptions.ConnectionError:
        return False, "❌ Ollama is offline. Please start Ollama.", []
    except requests.exceptions.Timeout:
        return False, "⏳ Ollama connection timed out. Service may be unresponsive.", []
    except Exception as e:
        return False, f"❌ Ollama connection error: {str(e)}", []


def get_installed_models() -> List[str]:
    """
    Retrieves a list of all model names currently pulled in the local Ollama instance.
    """
    is_online, _, models = check_ollama_status()
    if is_online:
        return models
    return []


def is_model_available(model_name: str) -> bool:
    """
    Checks if a specific model tag or base name is pulled locally in Ollama.
    """
    installed = get_installed_models()
    # Support partial matches e.g. "llama3.1:8b" vs "llama3.1:8b" or "llama3.1:latest"
    base_name = model_name.split(":")[0].lower()
    for m in installed:
        if m.lower() == model_name.lower() or m.lower().startswith(base_name):
            return True
    return False


def ask_ollama(
    model: str,
    prompt: str,
    system: Optional[str] = None,
    images: Optional[List[str]] = None,
    stream: bool = False,
    timeout: int = TIMEOUT_SECONDS
) -> Dict[str, Any]:
    """
    Sends a generation request to the local Ollama /api/generate endpoint.
    
    Args:
        model: Ollama model name (e.g., 'llama3.1:8b', 'qwen2.5-coder:7b', 'qwen2-vl:7b')
        prompt: The text prompt from the user or RAG pipeline
        system: Optional system instruction prompt
        images: Optional list of base64-encoded image strings for vision models
        stream: Whether to stream (False by default for deterministic local handling)
        timeout: Request timeout in seconds
        
    Returns:
        Dictionary containing:
        - "success": bool
        - "response": str (the generated AI text or error message)
        - "model": str
        - "total_duration": int (nanoseconds, if available)
        - "error": Optional error detail
    """
    url = f"{OLLAMA_BASE_URL}/api/generate"
    
    payload: Dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": stream
    }
    
    if system:
        payload["system"] = system
        
    if images and isinstance(images, list) and len(images) > 0:
        payload["images"] = images

    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=timeout
        )
        
        # Check HTTP status codes
        if response.status_code == 200:
            result = response.json()
            return {
                "success": True,
                "response": result.get("response", "").strip(),
                "model": result.get("model", model),
                "total_duration": result.get("total_duration", 0),
                "eval_count": result.get("eval_count", 0),
                "error": None
            }
            
        elif response.status_code == 404:
            err_msg = (
                f"❌ Model '{model}' was not found in your local Ollama library.\n\n"
                f"To install this model offline, open terminal/PowerShell and run:\n"
                f"```bash\nollama pull {model}\n```"
            )
            return {
                "success": False,
                "response": err_msg,
                "model": model,
                "error": "ModelNotFound"
            }
            
        else:
            err_msg = f"❌ Ollama server returned error {response.status_code}: {response.text}"
            return {
                "success": False,
                "response": err_msg,
                "model": model,
                "error": f"HTTP {response.status_code}"
            }
            
    except requests.exceptions.ConnectionError:
        return {
            "success": False,
            "response": (
                "❌ Ollama is offline. Please start Ollama.\n\n"
                "To start Ollama on Windows:\n"
                "1. Open Start menu and launch 'Ollama', or\n"
                "2. Open Command Prompt/PowerShell and run `ollama serve`"
            ),
            "model": model,
            "error": "ConnectionError"
        }
        
    except requests.exceptions.Timeout:
        return {
            "success": False,
            "response": (
                f"⏳ Local generation timed out after {timeout} seconds.\n\n"
                "This can happen if your local GPU/CPU is saturated or loading the model weights. "
                "Please retry or allocate more resources."
            ),
            "model": model,
            "error": "Timeout"
        }
        
    except Exception as e:
        return {
            "success": False,
            "response": f"❌ Unexpected error communicating with local Ollama: {str(e)}",
            "model": model,
            "error": str(e)
        }
