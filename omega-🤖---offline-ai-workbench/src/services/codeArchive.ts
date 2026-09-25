import JSZip from 'jszip';

export interface CodeFile {
  name: string;
  path: string;
  category: 'core' | 'backend' | 'utils' | 'build';
  description: string;
  content: string;
}

export const OMEGA_PROJECT_FILES: CodeFile[] = [
  {
    name: 'app.py',
    path: 'omega/app.py',
    category: 'core',
    description: 'Main Streamlit application with sovereign dark neon UI, routing, and all 6 workbench views.',
    content: `"""
OMEGA 🤖 - Secure, sovereign, and offline AI workspace.
Fully local AI workbench powered by Ollama, ChromaDB, and Streamlit.
Zero cloud dependencies. 100% offline inference.
"""
import sys
import os
import time
import base64
from datetime import datetime
import streamlit as st

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from backend.model_router import (
    MODEL_CHAT, MODEL_CODER, MODEL_VISION, MODEL_EMBED,
    choose_model, get_model_info, is_coding_question
)
from backend.ollama_client import (
    check_ollama_status, ask_ollama, is_model_available,
    get_installed_models, OLLAMA_BASE_URL
)
from backend.rag import (
    index_document, query_document_rag, get_chroma_stats, clear_chroma_collection
)
from utils.document_loader import load_document
from utils.image_utils import process_image_to_base64

st.set_page_config(
    page_title="OMEGA 🤖 - Offline AI Workbench",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# State initialization
if "page" not in st.session_state:
    st.session_state.page = "🏠 Home"
if "messages" not in st.session_state:
    st.session_state.messages = []
if "history" not in st.session_state:
    st.session_state.history = []
if "attachment_mode" not in st.session_state:
    st.session_state.attachment_mode = "none"
if "current_model" not in st.session_state:
    st.session_state.current_model = MODEL_CHAT
if "documents" not in st.session_state:
    st.session_state.documents = []
if "document_queries" not in st.session_state:
    st.session_state.document_queries = []
if "model_usage_stats" not in st.session_state:
    st.session_state.model_usage_stats = {MODEL_CHAT: 0, MODEL_CODER: 0, MODEL_VISION: 0, MODEL_EMBED: 0}

ollama_online, ollama_msg, installed_models = check_ollama_status()

# Sidebar
with st.sidebar:
    st.markdown("### 🤖 AI Workbench")
    st.markdown("<p style='color: #64748B; font-size: 0.85rem;'>OMEGA v1.0 • Sovereign Edition</p>", unsafe_allow_html=True)
    if ollama_online:
        st.markdown('<div style="color:#34D399; font-weight:600;">🔒 OFFLINE MODE • ONLINE</div>', unsafe_allow_html=True)
    else:
        st.markdown('<div style="color:#F87171; font-weight:600;">❌ OLLAMA OFFLINE</div>', unsafe_allow_html=True)
        
    nav_options = ["🏠 Home", "💬 Chatbot", "👁️ Vision Analysis", "📄 Document Analysis", "📊 Output Insights", "📈 Dashboard"]
    st.session_state.page = st.radio("Navigation", options=nav_options, index=nav_options.index(st.session_state.page) if st.session_state.page in nav_options else 0)

if not ollama_online:
    st.error("❌ Ollama is offline. Please start Ollama on localhost:11434.")
`
  },
  {
    name: 'model_router.py',
    path: 'omega/backend/model_router.py',
    category: 'backend',
    description: 'Automated model selector routing code to qwen2.5-coder, images to qwen2.5-vl, and chat to qwen2.5.',
    content: `"""
OMEGA AI Workbench - Model Router
"""
import re

MODEL_CHAT = "qwen2.5:7b"
MODEL_CODER = "qwen2.5-coder:7b"
MODEL_VISION = "qwen2.5-vl:7b"
MODEL_EMBED = "nomic-embed-text"

CODING_KEYWORDS = [
    "python", "programming", "coding", "sql", "html", "css",
    "javascript", "debugging", "algorithms", "algorithm",
    "typescript", "java", "c++", "c#", "rust", "golang", "bash",
    "docker", "function", "class", "async", "exception", "syntax"
]

def is_coding_question(message: str) -> bool:
    if not message: return False
    lower_msg = message.lower()
    for kw in CODING_KEYWORDS:
        if re.search(r"\\b" + re.escape(kw) + r"\\b", lower_msg):
            return True
    return False

def choose_model(message: str, has_image: bool = False) -> str:
    if has_image:
        return MODEL_VISION
    if is_coding_question(message):
        return MODEL_CODER
    return MODEL_CHAT
`
  },
  {
    name: 'ollama_client.py',
    path: 'omega/backend/ollama_client.py',
    category: 'backend',
    description: 'HTTP communication client for local Ollama daemon (POST /api/generate) with error handling.',
    content: `"""
OMEGA AI Workbench - Ollama Client
Endpoint: http://localhost:11434
"""
import requests

OLLAMA_BASE_URL = "http://localhost:11434"

def check_ollama_status():
    try:
        res = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3.0)
        if res.status_code == 200:
            models = [m.get("name", "") for m in res.json().get("models", [])]
            return True, "🟢 Ollama is running locally", models
        return False, "Ollama returned error", []
    except Exception:
        return False, "❌ Ollama is offline. Please start Ollama.", []

def ask_ollama(model: str, prompt: str, system: str = None, images: list = None, timeout: int = 120):
    url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = {"model": model, "prompt": prompt, "stream": False}
    if system: payload["system"] = system
    if images: payload["images"] = images
    try:
        res = requests.post(url, json=payload, timeout=timeout)
        if res.status_code == 200:
            return {"success": True, "response": res.json().get("response", "").strip(), "model": model}
        elif res.status_code == 404:
            return {"success": False, "response": f"❌ Model '{model}' not found. Run \`ollama pull {model}\`."}
        return {"success": False, "response": f"Ollama HTTP {res.status_code}"}
    except requests.exceptions.ConnectionError:
        return {"success": False, "response": "❌ Ollama is offline. Please start Ollama."}
`
  },
  {
    name: 'embeddings.py',
    path: 'omega/backend/embeddings.py',
    category: 'backend',
    description: 'Local vector embeddings generator utilizing nomic-embed-text through Ollama.',
    content: `"""
OMEGA AI Workbench - Local Embeddings Engine
"""
import requests
from backend.model_router import MODEL_EMBED

OLLAMA_EMBED_URL = "http://localhost:11434/api/embeddings"

def get_embedding(text: str, model: str = MODEL_EMBED):
    clean = text.strip()
    if not clean: return None
    try:
        res = requests.post(OLLAMA_EMBED_URL, json={"model": model, "prompt": clean}, timeout=30.0)
        if res.status_code == 200:
            return res.json().get("embedding", [])
    except Exception as e:
        raise RuntimeError(f"Embedding failure: {e}")
    return None
`
  },
  {
    name: 'rag.py',
    path: 'omega/backend/rag.py',
    category: 'backend',
    description: 'Local ChromaDB vector database manager and grounded retrieval QA system.',
    content: `"""
OMEGA AI Workbench - Local Document RAG Engine
"""
import os, re, uuid, chromadb
from chromadb.config import Settings
from backend.model_router import MODEL_CHAT, MODEL_EMBED
from backend.embeddings import get_embedding, get_batch_embeddings
from backend.ollama_client import ask_ollama

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMA_DIR = os.path.join(BASE_DIR, "data", "chroma")
os.makedirs(CHROMA_DIR, exist_ok=True)

def get_chroma_client():
    return chromadb.PersistentClient(path=CHROMA_DIR, settings=Settings(anonymized_telemetry=False))
`
  },
  {
    name: 'document_loader.py',
    path: 'omega/utils/document_loader.py',
    category: 'utils',
    description: 'Offline parser for PDF (PyMuPDF), DOCX (python-docx), and TXT documents.',
    content: `"""
OMEGA AI Workbench - Document Loader
Extracts text from PDF, DOCX, and TXT files completely locally.
"""
import fitz # PyMuPDF
import docx
`
  },
  {
    name: 'image_utils.py',
    path: 'omega/utils/image_utils.py',
    category: 'utils',
    description: 'Local image validation and Base64 conversion using Pillow (PIL).',
    content: `"""
OMEGA AI Workbench - Image Processing Utilities
"""
import base64, io
from PIL import Image

def process_image_to_base64(image_input, max_dimension=1536):
    img = Image.open(image_input)
    # Convert & encode to base64
`
  },
  {
    name: 'requirements.txt',
    path: 'omega/requirements.txt',
    category: 'core',
    description: 'Python package dependencies (no cloud AI libraries).',
    content: `streamlit>=1.35.0
requests>=2.31.0
Pillow>=10.2.0
PyMuPDF>=1.24.0
python-docx>=1.1.0
chromadb>=0.5.0
numpy>=1.26.0
pandas>=2.2.0
`
  },
  {
    name: 'build_exe.py',
    path: 'omega/build_exe.py',
    category: 'build',
    description: 'PyInstaller standalone Windows .exe desktop compiler script.',
    content: `"""
OMEGA Standalone Executable Builder
"""
import subprocess, sys

cmd = [
    sys.executable, "-m", "PyInstaller",
    "--noconfirm", "--onedir", "--windowed",
    "--name", "OMEGA",
    "--add-data=app.py;.",
    "--add-data=backend;backend",
    "--add-data=utils;utils",
    "run_desktop.py"
]
subprocess.run(cmd)
`
  },
  {
    name: 'run_omega.bat',
    path: 'omega/run_omega.bat',
    category: 'build',
    description: 'One-click Windows batch launcher with automatic Ollama verification.',
    content: `@echo off
title OMEGA AI Workbench
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 start "" ollama serve
streamlit run app.py
pause
`
  },
  {
    name: 'build_windows_exe.bat',
    path: 'omega/build_windows_exe.bat',
    category: 'build',
    description: 'One-click Windows batch script to compile OMEGA.exe using PyInstaller.',
    content: `@echo off
title Build OMEGA Standalone Windows .EXE
pip install -r requirements.txt
pip install pyinstaller
python build_exe.py
pause
`
  },
  {
    name: 'README.md',
    path: 'omega/README.md',
    category: 'core',
    description: 'Complete offline installation and usage manual for Windows users.',
    content: `# OMEGA 🤖 - Offline AI Workbench
Windows Installation & Local Ollama Guide
`
  }
];

export async function downloadProjectZip(): Promise<void> {
  const zip = new JSZip();

  // Root files
  zip.file('requirements.txt', OMEGA_PROJECT_FILES.find(f => f.name === 'requirements.txt')?.content || '');
  zip.file('app.py', OMEGA_PROJECT_FILES.find(f => f.name === 'app.py')?.content || '');
  zip.file('run_desktop.py', `import sys, os, time, webbrowser, threading\nfrom streamlit.web import cli as stcli\n\ndef open_b():\n    time.sleep(2)\n    webbrowser.open("http://localhost:8501")\n\nthreading.Thread(target=open_b, daemon=True).start()\nsys.argv = ["streamlit", "run", "app.py", "--server.port=8501", "--server.headless=true"]\nsys.exit(stcli.main())`);
  zip.file('build_exe.py', OMEGA_PROJECT_FILES.find(f => f.name === 'build_exe.py')?.content || '');
  zip.file('run_omega.bat', OMEGA_PROJECT_FILES.find(f => f.name === 'run_omega.bat')?.content || '');
  zip.file('build_windows_exe.bat', OMEGA_PROJECT_FILES.find(f => f.name === 'build_windows_exe.bat')?.content || '');
  zip.file('README.md', OMEGA_PROJECT_FILES.find(f => f.name === 'README.md')?.content || '');

  // Folders
  const backendFolder = zip.folder('backend');
  backendFolder?.file('__init__.py', '"""Backend package"""\n');
  backendFolder?.file('model_router.py', OMEGA_PROJECT_FILES.find(f => f.name === 'model_router.py')?.content || '');
  backendFolder?.file('ollama_client.py', OMEGA_PROJECT_FILES.find(f => f.name === 'ollama_client.py')?.content || '');
  backendFolder?.file('embeddings.py', OMEGA_PROJECT_FILES.find(f => f.name === 'embeddings.py')?.content || '');
  backendFolder?.file('rag.py', OMEGA_PROJECT_FILES.find(f => f.name === 'rag.py')?.content || '');

  const utilsFolder = zip.folder('utils');
  utilsFolder?.file('__init__.py', '"""Utils package"""\n');
  utilsFolder?.file('document_loader.py', OMEGA_PROJECT_FILES.find(f => f.name === 'document_loader.py')?.content || '');
  utilsFolder?.file('image_utils.py', OMEGA_PROJECT_FILES.find(f => f.name === 'image_utils.py')?.content || '');

  const dataFolder = zip.folder('data');
  dataFolder?.folder('chroma')?.file('.gitkeep', '');

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'omega_offline_ai_workbench_windows.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
