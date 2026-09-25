"""
OMEGA AI Workbench - Model Router
Selects local Ollama models according to task requirements.
"""
import re

# ==============================================================================
# REQUIRED LOCAL MODEL CONSTANTS
# ==============================================================================
MODEL_CHAT = "llama3.1:8b"
MODEL_CODER = "qwen2.5-coder:7b"
MODEL_VISION = "qwen2-vl:7b"
MODEL_EMBED = "nomic-embed-text"

# Coding keywords and patterns for automated routing
CODING_KEYWORDS = [
    "python", "programming", "coding", "sql", "html", "css",
    "javascript", "debugging", "algorithms", "algorithm",
    "typescript", "java", "c++", "c#", "rust", "golang", "go lang",
    "bash", "powershell", "git", "regex", "docker", "function",
    "class", "async", "await", "exception", "syntax", "refactor",
    "unit test", "api endpoint", "database query", "fastapi", "flask",
    "django", "react", "vue", "pandas", "numpy", "code snippet"
]

CODE_SYNTAX_PATTERNS = [
    r"```",               # Markdown code block
    r"def\s+\w+\s*\(",    # Python function definition
    r"class\s+\w+[\s:(]", # Class definition
    r"SELECT\s+.*\s+FROM",# SQL query
    r"import\s+\w+",      # Python import
    r"from\s+\w+\s+import",
    r"console\.log\(",    # JS console
    r"for\s*\([^)]*\)",   # C/JS for loop
    r"while\s*\([^)]*\)", # While loop
]


def is_coding_question(message: str) -> bool:
    """
    Determines if the given message is related to programming or coding.
    """
    if not message or not isinstance(message, str):
        return False
        
    lower_msg = message.lower()
    
    # Check for keyword matches
    for keyword in CODING_KEYWORDS:
        # Match whole words or phrase
        pattern = r"\b" + re.escape(keyword) + r"\b"
        if re.search(pattern, lower_msg):
            return True
            
    # Check for syntax patterns
    for pat in CODE_SYNTAX_PATTERNS:
        if re.search(pat, message, re.IGNORECASE):
            return True
            
    return False


def choose_model(message: str, has_image: bool = False) -> str:
    """
    Model routing logic:
    - If user uploads an image: qwen2-vl:7b
    - If user asks about coding/programming/debugging: qwen2.5-coder:7b
    - If user asks general questions: llama3.1:8b
    """
    if has_image:
        return MODEL_VISION
        
    if is_coding_question(message):
        return MODEL_CODER
        
    return MODEL_CHAT


def get_model_info(model_name: str) -> dict:
    """
    Returns descriptive metadata and badge details for a model.
    """
    info_map = {
        MODEL_CHAT: {
            "name": MODEL_CHAT,
            "role": "General Intelligence & Reasoning",
            "type": "General Chat",
            "color": "#3B82F6", # Neon Blue
            "icon": "💬"
        },
        MODEL_CODER: {
            "name": MODEL_CODER,
            "role": "Code Generation & Debugging",
            "type": "Software Specialist",
            "color": "#10B981", # Emerald
            "icon": "⚡"
        },
        MODEL_VISION: {
            "name": MODEL_VISION,
            "role": "Multimodal Image & Visual Reasoning",
            "type": "Vision Analyst",
            "color": "#8B5CF6", # Purple Neon
            "icon": "👁️"
        },
        MODEL_EMBED: {
            "name": MODEL_EMBED,
            "role": "High-Dimensional Vector Embeddings",
            "type": "RAG Embeddings",
            "color": "#06B6D4", # Cyan
            "icon": "📐"
        }
    }
    return info_map.get(model_name, {
        "name": model_name,
        "role": "Local Ollama Model",
        "type": "Local Inference",
        "color": "#64748B",
        "icon": "🤖"
    })
