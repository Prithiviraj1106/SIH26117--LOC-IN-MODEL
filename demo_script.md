# Demo Script — MRPL Sovereign On-Prem Agentic AI Workbench

## Pre-Demo Setup (do this before judges arrive)

1. **Disconnect from the internet** — physically disconnect WiFi/ethernet.
2. Ensure Ollama is running and all models are pulled:
   - `ollama run llama3.2:3b`
   - `ollama run qwen2.5-coder:3b`
   - `ollama run moondream`
3. Ensure MailHog is running on `localhost:1025` (SMTP) and `localhost:8025` (web inbox).
4. Ensure Docker is running (for code execution sandbox).
5. Run `python ingest_sops.py` to populate ChromaDB.
6. Start the network monitor in a visible terminal:
   - `python network_monitor.py`
7. **Start Streamlit with LAN access** (REQUIRED for multi-device demo):
   - `streamlit run app.py --server.address 0.0.0.0 --server.port 8501`
8. Find your laptop's LAN IP: `ipconfig` → look for IPv4 under your active adapter
9. Other devices on the same LAN can now reach the app at:
   - `http://<laptop-lan-ip>:8501`

---

## Multi-Device Access — Per-Employee Identity

### How it works
- Multiple phones/tablets on the same LAN can connect to the single running app
- Each person enters their **name** and **email** in the sidebar
- The app stores this in `st.session_state` and uses it for email attribution
- When an employee sends an email, the subject includes their name and the body is signed

### Testing multi-device access
1. Start the app with: `streamlit run app.py --server.address 0.0.0.0 --server.port 8501`
2. From Phone A (same LAN), open `http://<laptop-ip>:8501`
3. Enter name: "Alice", email: "alice@mrpl.local"
4. From Phone B (same LAN), open `http://<laptop-ip>:8501`
5. Enter name: "Bob", email: "bob@mrpl.local"
6. From Phone A: type "send email to engineer about maintenance"
7. From Phone B: type "send email to engineer about safety"
8. Open MailHog web inbox at `http://<laptop-ip>:8025`
9. **Confirm**: Two separate emails appear, each attributed to the correct employee name
10. Run `network_monitor.py` — it should NOT flag either phone's LAN IP as external

### Network Monitor behavior
- Private/LAN IPs (10.x.x.x, 192.168.x.x, 127.x.x.x) = ✅ LOCAL
- Genuine public IPs = ⚠ EXTERNAL
- The `ipaddress` module's `is_private`/`is_loopback` checks are used, not manual prefix matching

---

## Demo Flow (click-by-click)

### Step 0: Employee Identity (new)
1. Each employee enters their name and email in the sidebar.
2. The app shows "Logged in as: {name} ({email})" at the top.
3. Each message displayed has a caption showing who sent it.

### Step 1: Simple Chat (Intent Gate Demo)
1. Type "hi" in the chat box.
2. Observe: The intent gate (`needs_tools()`) returns False — no MCP tools are called.
3. The agent responds with a simple chat reply.
4. **Judge sees**: Simple queries don't waste tool calls.

### Step 2: Code Execution Task
1. Type "run code to print hello world".
2. The router classifies this as a "code" task → routes to `qwen2.5-coder:3b`.
3. The agent generates Python code, then calls `run_code_sandboxed` via the code_exec MCP server.
4. Code runs inside a Docker container with `--network none`.
5. **Judge sees**: Code output + verified/failed status flag.
6. Network monitor shows: **zero external connections** (Docker uses --network none).

### Step 3: Approval Note (Full Agentic Pipeline)
1. Upload a sample scanned inspection report (or paste a text file path).
2. Type "draft an approval note for pump inspection".
3. Pipeline executes:
   - `extract_from_document` (OCR/vision) reads the document
   - `search_sops` (RAG) retrieves relevant SOP context
   - `chat` (llama3.2:3b) drafts the approval note with calculation steps
   - `generate_docx` creates the Word document
4. **Judge sees**: A real .docx file is generated and available for download.
5. The network monitor proves: **zero external calls** throughout.

### Step 4: Email Automation with Employee Attribution (multi-device demo)
1. From **Phone A** (Alice): type "send email to engineer about maintenance".
   - Subject becomes: "Workbench Notification from Alice"
   - Body signed with: "— Sent by Alice"
2. From **Phone B** (Bob): type "send email to engineer about safety".
   - Subject becomes: "Workbench Notification from Bob"
   - Body signed with: "— Sent by Bob"
3. Open MailHog web inbox at `http://<laptop-ip>:8025`.
4. **Confirm**: Two separate emails, each attributed to the correct employee.
5. **Judge sees**: Email in local inbox — no cloud SMTP used — with per-employee attribution.
6. Network monitor: **zero external connections** (private LAN IPs are not flagged).

### Step 5: Vision / P&ID Image Understanding
1. Upload a P&ID image or scanned document.
2. The agent calls `extract_from_document` via the vision MCP server.
3. Tesseract OCR extracts text; if under 20 chars, moondream VLM kicks in.
4. **Judge sees**: Extracted text from the image.
5. Network monitor: **zero external connections**.

### Step 6: Spreadsheet Generation
1. Type "generate a spreadsheet of equipment inventory".
2. The agent generates structured data, then calls `generate_xlsx`.
3. A .xlsx file appears in `generated_files/`.
4. **Judge sees**: Downloadable Excel file.

### Step 7: Presentation Generation
1. Type "create slides for safety report".
2. The agent generates slide content, then calls `generate_pptx`.
3. A .pptx file appears in `generated_files/`.
4. **Judge sees**: Downloadable PowerPoint file.

### Step 8: ReAct Fallback Loop (Intent Not Matched)
1. Type "search sops for pump maintenance and summarize".
2. `match_known_task()` returns None → ReAct fallback loop activates.
3. The agent iterates up to 5 times, calling tools and reasoning.
4. **Judge sees**: The iterative capability in action — not a one-shot answer.

---

## Sovereignty Proof (The Key Moment)

After all demo steps, point to the network monitor terminal:

> "Throughout this entire demo — code execution, email, document generation,
> everything — there are ZERO outbound network connections. Every model call
> goes to local Ollama. Every email goes to local MailHog. Every file is
> generated on this machine. Nothing left this laptop."

> "And the network monitor correctly distinguishes LAN traffic (phones on
> 192.168.x.x or 10.x.x.x) from genuine external calls — private IPs are
> treated as expected local traffic, not violations."

---

## Key Talking Points

- **New models**: Add with `ollama pull <model>` + one line in `models_config.json`
- **New capabilities**: Add as a new MCP server file + one line in `MCP_SERVERS` dict
- **Multi-device access**: Phones on the same LAN connect at `http://<laptop-ip>:8501`
- **Employee identity**: Each person enters their name in the sidebar — emails are attributed correctly
- **No cloud dependencies**: Everything runs on localhost only
- **Transparent routing**: `router.py` is hand-written, not a black-box framework
- **VRAM-safe**: All model calls use `num_ctx=4096` — designed for 6GB GPU
- **LAN vs external**: `network_monitor.py` uses `ipaddress.is_private`/`is_loopback` to correctly classify private IPs as local
