# OMEGA 🤖 - Offline AI Workbench
> **Secure, sovereign, and offline AI workspace.**

OMEGA is a production-ready, fully offline AI workbench designed to run directly on a local Windows PC without sending prompts, images, documents, or data to any cloud service.

---

## 📋 Technology Stack
- **Runtime:** Python 3.11+
- **Frontend / UI:** Streamlit (Dark sovereign neon UI)
- **Local AI Engine:** Ollama (`http://localhost:11434`)
- **Document RAG:** PyMuPDF (`fitz`), `python-docx`, built-in TXT handling
- **Vision Analyst:** Pillow (PIL) + Base64
- **Local Vector DB:** ChromaDB (Local persistence in `data/chroma/`)
- **Embeddings:** `nomic-embed-text`
- **HTTP Client:** `requests`

---

## 🤖 Required Local AI Models

Install Ollama on your Windows machine, open PowerShell or Command Prompt, and pull the required offline models:

```powershell
# 1. General Chat & Reasoning (8B parameters)
ollama pull llama3.1:8b

# 2. Coding & Software Engineering (7B parameters)
ollama pull qwen2.5-coder:7b

# 3. Multimodal Vision Analysis (7B parameters)
ollama pull qwen2-vl:7b

# 4. Local Vector Embeddings (High-dimensional)
ollama pull nomic-embed-text
```

---

## ⚙️ Model Auto-Routing Rules

| Scenario / Query Type | Model Routed | Role |
| :--- | :--- | :--- |
| **Images Uploaded** | `qwen2-vl:7b` | Visual recognition, diagram analysis, OCR |
| **Coding / Programming / Debugging** | `qwen2.5-coder:7b` | Python, JS, SQL, algorithms, bug fixes |
| **General Q&A / Reasoning** | `llama3.1:8b` | Sovereign chat, explanations, synthesis |
| **Document RAG Embeddings** | `nomic-embed-text` | ChromaDB vector storage & similarity search |

---

## 🚀 Quick Start (Running via Streamlit)

### 1. Setup Python Environment
```powershell
# Create virtual environment
python -m venv venv

# Activate on Windows
.\venv\Scripts\Activate.ps1
# or in cmd:
# venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt
```

### 2. Verify Ollama is Running
Make sure Ollama is active on your PC:
```powershell
# Verify by curling or opening in browser:
curl http://localhost:11434/api/tags
```
If not running, launch **Ollama** from your Windows Start Menu, or run:
```powershell
ollama serve
```

### 3. Launch OMEGA
```powershell
streamlit run app.py
```
Or simply double-click:
`run_omega.bat`

OMEGA will automatically open in your default browser at `http://localhost:8501`.

---

## 📦 Building Standalone Windows Desktop App (.EXE)

To compile OMEGA into a self-contained `.exe` executable for Windows:

```powershell
# 1. Install PyInstaller
pip install pyinstaller

# 2. Run the build script
python build_exe.py

# Alternatively, double-click:
# build_windows_exe.bat
```

Once compilation finishes, you will find your standalone Windows application in:
`dist\OMEGA\OMEGA.exe`

Double-clicking `OMEGA.exe` will start the background offline engine and automatically open the OMEGA interface!

---

## 🔒 Offline & Sovereign Guarantees
- **No Cloud API Keys:** OMEGA requires zero API keys (OpenAI, Gemini, Claude, or Hugging Face).
- **Network Boundary:** All network calls are strictly addressed to `http://localhost:11434`.
- **Local Persistence:** Documents and vector embeddings are stored strictly inside your local folder `data/chroma/`.
