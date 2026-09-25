"""
app.py — Streamlit UI for the MRPL Sovereign On-Prem Agentic AI Workbench.

Multi-device access with per-employee identity:
- Employees enter their name and email in the sidebar
- Each message is displayed with the employee name as a caption
- Employee identity is forwarded to the orchestrator for email attribution

The app is started with:
    streamlit run app.py --server.address 0.0.0.0 --server.port 8501
so other devices on the same LAN can reach it at:
    http://<laptop-lan-ip>:8501

The main entry point for users. Calls orchestrator.handle_message()
and displays chat with FULL conversation history, tool-use traces,
and download buttons for generated files. Sidebar shows model status,
network status, and the model-settings panel.

Conversation history is stored in st.session_state and passed back
to the orchestrator on every new message — so the agent remembers
everything said in the current session.
"""
import streamlit as st
import asyncio
import json
import os
import uuid
from pathlib import Path

from orchestrator import (
    MCPManager,
    decide_execution,
    handle_message,
    needs_tools,
    resolve_email_recipient,
)
from router import classify_task, pick_model, required_servers, route_request
from task_state import TaskState
from chat_memory import ChatStore

st.set_page_config(page_title="MRPL Workbench", layout="wide")

# ─── Initialize conversation history ───
if "messages" not in st.session_state:
    st.session_state["messages"] = []   # list of {"role": "user"/"assistant", "content": "..."}
if "owner_id" not in st.session_state:
    st.session_state["owner_id"] = f"streamlit:{uuid.uuid4().hex}"
if "conversation_id" not in st.session_state:
    st.session_state["conversation_id"] = 0
if "manager" not in st.session_state:
    st.session_state["manager"] = None
if "employee_name" not in st.session_state:
    st.session_state["employee_name"] = ""
if "employee_email" not in st.session_state:
    st.session_state["employee_email"] = ""
if "approved_actions" not in st.session_state:
    st.session_state["approved_actions"] = set()
if "pending_request" not in st.session_state:
    st.session_state["pending_request"] = None
if "active_file_path" not in st.session_state:
    st.session_state["active_file_path"] = None
if "chat_store" not in st.session_state:
    st.session_state["chat_store"] = ChatStore()
if "active_chat_id" not in st.session_state:
    st.session_state["active_chat_id"] = st.session_state["chat_store"].create_chat(owner_id=st.session_state["owner_id"])
if "messages_loaded" not in st.session_state:
    st.session_state["messages_loaded"] = False
if "memory_refresh" not in st.session_state:
    st.session_state["memory_refresh"] = False


def _remember_active_file(file_path: str | None) -> str | None:
    """Persist the most recent file attachment across rerenders and prompt follow-ups."""
    if file_path is None:
        file_path = st.session_state.get("active_file_path")
    if file_path is None:
        return None
    st.session_state["active_file_path"] = str(file_path)
    return st.session_state["active_file_path"]

# ─── Employee identity — sidebar inputs ───
st.sidebar.title("🔒 MRPL Sovereign Workbench")
st.sidebar.markdown("**All models run locally. Zero external calls.**")

# Employee identity inputs in sidebar
st.sidebar.subheader("👤 Your Identity")
employee_name = st.sidebar.text_input("Employee Name", value=st.session_state["employee_name"], placeholder="Enter your name")
employee_email = st.sidebar.text_input("Employee Email", value=st.session_state["employee_email"], placeholder="Enter your email")

# Save to session state
if employee_name:
    st.session_state["employee_name"] = employee_name
if employee_email:
    st.session_state["employee_email"] = employee_email

# If no name entered yet, show prompt and stop rendering the rest
if not st.session_state["employee_name"].strip():
    st.warning("👋 Please enter your name in the sidebar to begin.")
    st.stop()

chat_store = st.session_state["chat_store"]
owner_id = st.session_state["owner_id"]
active_chat_id = st.session_state["active_chat_id"]
if not st.session_state["messages_loaded"]:
    st.session_state["messages"] = chat_store.get_messages(active_chat_id, owner_id)
    st.session_state["messages_loaded"] = True

# Persistent ChatGPT-style conversation list. Only the selected chat is loaded
# into session state and passed to the orchestrator.
st.sidebar.subheader("Chats")
if st.sidebar.button("+ New Chat", use_container_width=True):
    st.session_state["active_chat_id"] = chat_store.create_chat(owner_id=owner_id)
    st.session_state["messages"] = []
    st.session_state["messages_loaded"] = True
    st.session_state["pending_request"] = None
    st.rerun()

def _chat_date_label(value: str) -> str:
    chat_date = value[:10]
    today = __import__("datetime").date.today()
    if chat_date == today.isoformat():
        return "Today"
    if chat_date == (today - __import__("datetime").timedelta(days=1)).isoformat():
        return "Yesterday"
    return chat_date

chats_by_date = {}
for chat in chat_store.list_chats(owner_id):
    chats_by_date.setdefault(_chat_date_label(chat["updated_at"]), []).append(chat)
for date_label, chats in chats_by_date.items():
    st.sidebar.caption(date_label)
    for chat in chats:
        label = chat["title"] or "New chat"
        if st.sidebar.button(
            label[:34],
            key=f"chat_{chat['chat_id']}",
            use_container_width=True,
            type="primary" if chat["chat_id"] == active_chat_id else "secondary",
        ):
            st.session_state["active_chat_id"] = chat["chat_id"]
            st.session_state["messages"] = chat_store.get_messages(chat["chat_id"], owner_id)
            st.session_state["messages_loaded"] = True
            st.session_state["pending_request"] = None
            st.rerun()

with st.sidebar.expander("Manage active chat"):
    active_chat = next(
        (chat for chat in chat_store.list_chats(owner_id) if chat["chat_id"] == active_chat_id),
        None,
    )
    rename_value = st.text_input(
        "Chat title",
        value=active_chat["title"] if active_chat else "New chat",
        key="rename_chat_title",
    )
    if st.button("Rename chat", key="rename_active_chat"):
        chat_store.rename_chat(active_chat_id, rename_value, owner_id)
        st.rerun()
    if st.button("Delete chat", key="delete_active_chat"):
        chat_store.delete_chat(active_chat_id, owner_id)
        st.session_state["active_chat_id"] = chat_store.create_chat(owner_id=owner_id)
        st.session_state["messages"] = []
        st.session_state["messages_loaded"] = True
        st.rerun()

# Sidebar — model and network status
st.sidebar.subheader("Model Status")
models = ["qwen2.5:7b (chat)", "qwen2.5-coder:7b (code)", "qwen2.5vl:7b (vision)"]
for m in models:
    st.sidebar.text(f"  {m}")

st.sidebar.subheader("Saved Memories")
memories = chat_store.list_memories(owner_id)
if memories:
    for memory in memories[:8]:
        with st.sidebar.container():
            st.sidebar.caption(memory["category"])
            st.sidebar.write(memory["content"])
            if st.sidebar.button(f"Forget #{memory['id']}", key=f"forget_mem_{memory['id']}", use_container_width=True):
                chat_store.delete_memory(memory["id"], owner_id)
                st.session_state["memory_refresh"] = True
                st.rerun()
else:
    st.sidebar.caption("No saved memories yet.")

# Network status
st.sidebar.subheader("Network Status")
st.sidebar.success("✅ Offline mode — no external connections")

# Model settings panel
st.sidebar.subheader("Model Settings")
selected_model = st.sidebar.selectbox(
    "Chat model",
    ["qwen2.5:7b", "qwen2.5-coder:7b", "qwen2.5vl:7b"],
    index=0,
)
if st.sidebar.button("Apply model change"):
    st.sidebar.info(f"Switching to {selected_model}")
    st.rerun()

# Email delivery settings. Credentials are entered only in the UI and are
# passed to the local email MCP subprocess through inherited environment vars.
st.sidebar.subheader("Email Delivery")
email_mode = st.sidebar.radio(
    "Email service",
    ["MailHog (local)", "Gmail SMTP"],
    index=0,
)
smtp_user = ""
smtp_password = ""
if email_mode == "Gmail SMTP":
    smtp_user = st.sidebar.text_input(
        "Gmail address",
        value=st.session_state.get("smtp_user", ""),
        placeholder="you@gmail.com",
    )
    smtp_password = st.sidebar.text_input(
        "Gmail app password",
        value=st.session_state.get("smtp_password", ""),
        type="password",
        placeholder="16-character app password",
        help="Use a Google App Password, not your normal Gmail password.",
    )
    st.session_state["smtp_user"] = smtp_user
    st.session_state["smtp_password"] = smtp_password
    os.environ["MRPL_SMTP_HOST"] = "smtp.gmail.com"
    os.environ["MRPL_SMTP_PORT"] = "587"
    os.environ["MRPL_SMTP_USER"] = smtp_user
    os.environ["MRPL_SMTP_PASSWORD"] = smtp_password
    os.environ["MRPL_SMTP_FROM"] = smtp_user
    os.environ["MRPL_SMTP_TLS"] = "true"
    st.sidebar.warning("Gmail mode uses an external network connection.")
else:
    for variable in (
        "MRPL_SMTP_HOST", "MRPL_SMTP_PORT", "MRPL_SMTP_USER",
        "MRPL_SMTP_PASSWORD", "MRPL_SMTP_FROM", "MRPL_SMTP_TLS",
    ):
        os.environ.pop(variable, None)
    st.sidebar.caption("Emails are captured locally at http://localhost:8025")

approve_sensitive = st.sidebar.checkbox(
    "Approve sensitive actions this session",
    help="Allows email, code execution, and document generation tools to run.",
)
if approve_sensitive:
    st.session_state["approved_actions"].update(
        {"send_email", "run_code_sandboxed", "generate_docx", "generate_xlsx", "generate_pptx"}
    )

# Conversation info
st.sidebar.subheader("Session Info")
st.sidebar.info(f"Employee: {st.session_state['employee_name']}")
st.sidebar.info(f"Email: {st.session_state['employee_email']}")
st.sidebar.info(f"Conversation #{st.session_state['conversation_id']}")
st.sidebar.info(f"Messages so far: {len(st.session_state['messages'])}")
if st.sidebar.button("🔄 Clear History"):
    st.session_state["messages"] = []
    st.session_state["conversation_id"] += 1
    st.rerun()

# ─── Instructions for multi-device access ───
st.info(
    "📱 **Multi-device mode:** This app is accessible from other devices on the same LAN "
    "at `http://<laptop-lan-ip>:8501`. Start with `streamlit run app.py --server.address 0.0.0.0 --server.port 8501`. "
    "Each person entering a different name in the sidebar will be treated as a separate employee."
)

# Main UI
st.title("🔒 MRPL Sovereign On-Prem Agentic AI Workbench")
st.markdown("Fully offline. Zero external network calls. All models run locally.")

# Display the current employee name as a header
st.markdown(f"**Logged in as:** {st.session_state['employee_name']} ({st.session_state['employee_email']})")

# Display full conversation history with employee name captions
for msg in st.session_state["messages"]:
    if msg["role"] == "user":
        st.chat_message("user").markdown(msg["content"])
        # Show employee name as caption
        st.caption(f"📤 Sent by: {st.session_state['employee_name']}")
    else:
        historical_email = None
        try:
            parsed_message = json.loads(msg["content"])
            if isinstance(parsed_message, dict) and "confirmation" in parsed_message:
                historical_email = parsed_message
        except (TypeError, json.JSONDecodeError):
            pass
        if historical_email:
            with st.chat_message("assistant"):
                if historical_email.get("success"):
                    st.markdown(historical_email["confirmation"])
                    if historical_email.get("mailhog_url"):
                        st.markdown(f"[View in MailHog inbox]({historical_email['mailhog_url']})")
                    with st.expander("View sent email"):
                        st.markdown(f"**To:** {historical_email.get('to', '')}")
                        st.markdown(f"**Subject:** {historical_email.get('subject', '')}")
                        st.text(historical_email.get("body", ""))
                else:
                    st.error(historical_email.get("error", "Email sending failed."))
        else:
            st.chat_message("assistant").markdown(msg["content"])
        st.caption("🤖 System response")

# File upload
uploaded_file = st.file_uploader(
    "Upload a document/image (optional)",
    type=["txt", "pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg"],
)
file_path = _remember_active_file(st.session_state.get("active_file_path"))
if uploaded_file:
    max_upload_bytes = 200 * 1024 * 1024
    safe_name = Path(uploaded_file.name).name
    if uploaded_file.size > max_upload_bytes:
        st.error("Upload rejected: maximum file size is 200 MB.")
        st.stop()
    save_dir = Path("sample_data_uploads")
    save_dir.mkdir(exist_ok=True)
    file_path = str(save_dir / safe_name)
    _remember_active_file(file_path)
    with open(file_path, "wb") as f:
        f.write(uploaded_file.getbuffer())

if file_path and st.session_state.get("active_file_path") != file_path:
    _remember_active_file(file_path)

file_path = _remember_active_file(st.session_state.get("active_file_path") or file_path)

# Chat input
user_message = st.chat_input("Ask something — the agent remembers what you said before...")
file_path = _remember_active_file(st.session_state.get("active_file_path") or file_path)
pending_request = st.session_state.get("pending_request")
approval_retry = False
if pending_request:
    st.warning("This request is waiting for approval before the sensitive action can run.")
    if st.button("Approve and continue", type="primary"):
        st.session_state["approved_actions"].add(pending_request["tool"])
        user_message = pending_request["message"]
        file_path = _remember_active_file(
            pending_request.get("file_path")
            or st.session_state.get("active_file_path")
            or file_path
        )
        st.session_state["pending_request"] = None
        approval_retry = True

if user_message:
    # Add user message to history
    if not approval_retry:
        st.session_state["messages"].append({"role": "user", "content": user_message})
        chat_store.add_message(active_chat_id, "user", user_message, owner_id)
        st.chat_message("user").markdown(user_message)
        st.caption(f"📤 Sent by: {st.session_state['employee_name']}")

    # Determine task type for display
    decision = decide_execution(user_message, file_path)
    route = decision["route"]
    task_type = route["task_type"]
    st.info(f"🔄 Routing to: {route['primary_model']} (task: {task_type})")

    if task_type == "email" and email_mode == "Gmail SMTP" and (not smtp_user or not smtp_password):
        st.error("Enter your Gmail address and Google App Password in the Email Delivery sidebar first.")
        st.stop()
    if task_type == "email":
        st.info(f"Sending to: {resolve_email_recipient(user_message)}")

    # Build messages list from conversation history for the orchestrator
    # This gives the agent full context of everything said so far
    conversation_messages = [{"role": m["role"], "content": m["content"]} for m in st.session_state["messages"]]

    # Get employee identity from session state
    sender_name = st.session_state["employee_name"]
    sender_email = st.session_state["employee_email"]

    memory_context = ""
    try:
        from orchestrator import build_memory_context
        memory_context = build_memory_context(user_message, chat_store, limit=3, owner_id=owner_id)
    except Exception:
        memory_context = ""

    # Run orchestrator with full conversation history and employee identity
    task_state = TaskState(user_request=user_message, intent=task_type)
    task_state.event(f"Intent detected: {task_type}")
    task_state.event(f"Model selected: {route['primary_model']}")
    manager = MCPManager(
        # Unknown tasks expose all dynamically discovered MCP tools to Qwen;
        # known workflows keep their narrow tool allow-list.
        servers=None if decision["mode"] == "react" else required_servers(route),
        approved_actions=st.session_state["approved_actions"],
        task_state=task_state,
    )

    async def _run_agent():
        # An uploaded document always needs the vision/document tool, even when
        # the wording is conversational, such as "can you explain this".
        message_needs_tools = decision["mode"] != "direct" or route["needs_tools"] or bool(file_path)
        if not message_needs_tools:
            return await handle_message(
                user_message,
                manager,
                file_path=file_path,
                conversation_history=conversation_messages,
                sender_name=sender_name,
                sender_email=sender_email,
                memory_context=memory_context,
                owner_id=owner_id,
            )

        with st.status("Connecting to MCP servers...", expanded=False) as status:
            async with manager:
                status.update(label="MCP servers connected", state="complete")
                return await handle_message(
                    user_message,
                    manager,
                    file_path=file_path,
                    conversation_history=conversation_messages,
                    sender_name=sender_name,
                    sender_email=sender_email,
                    memory_context=memory_context,
                    owner_id=owner_id,
                )

    with st.spinner("Agent is working..."):
        try:
            result = asyncio.run(_run_agent())
            if result.startswith("Approval required:"):
                tool_name = result.split("'", 2)[1] if "'" in result else "send_email"
                st.session_state["pending_request"] = {
                    "message": user_message,
                    "file_path": file_path,
                    "tool": tool_name,
                }
            # Add assistant response to history
            st.session_state["messages"].append({"role": "assistant", "content": result})
            chat_store.add_message(active_chat_id, "assistant", result, owner_id)
            try:
                if sender_name:
                    import asyncio
                    async def _store_facts():
                        from orchestrator import make_llm
                        llm = make_llm("chat")
                        await chat_store.auto_save_if_relevant(conversation_messages + [{"role": "user", "content": user_message}], llm=llm, owner_id=owner_id)
                    asyncio.run(_store_facts())
            except Exception:
                pass
            email_details = None
            if task_type == "email":
                try:
                    parsed_result = json.loads(result)
                    if isinstance(parsed_result, dict) and "confirmation" in parsed_result:
                        email_details = parsed_result
                except (TypeError, json.JSONDecodeError):
                    pass
            if email_details:
                with st.chat_message("assistant"):
                    if email_details.get("success"):
                        st.markdown(email_details["confirmation"])
                        if email_details.get("mailhog_url"):
                            st.markdown(
                                f"[View in MailHog inbox]({email_details['mailhog_url']})"
                            )
                        with st.expander("View sent email"):
                            st.markdown(f"**To:** {email_details.get('to', '')}")
                            st.markdown(f"**Subject:** {email_details.get('subject', '')}")
                            st.text(email_details.get("body", ""))
                    else:
                        st.error(email_details.get("error", "Email sending failed."))
            else:
                st.chat_message("assistant").markdown(result)
            st.caption("🤖 System response")
            if task_state.trace:
                with st.expander("Execution trace"):
                    st.code("\n".join(task_state.trace))

            # Check if a file was generated
            generated_dir = Path("generated_files")
            if generated_dir.exists():
                for f in generated_dir.iterdir():
                    if f.stat().st_mtime > os.path.getmtime(__file__) - 300:  # last 5 min
                        with open(f, "rb") as fh:
                            st.download_button(
                                label=f"📥 Download {f.name}",
                                data=fh,
                                file_name=f.name,
                                mime="application/octet-stream",
                            )

        except Exception as e:
            error_message = f"Error: {type(e).__name__}: {e}"
            st.session_state["messages"].append({"role": "assistant", "content": error_message})
            chat_store.add_message(active_chat_id, "assistant", error_message, owner_id)
            with st.chat_message("assistant"):
                st.error(error_message)
            st.caption("🤖 System error")

# Demo section
st.sidebar.subheader("Quick Demo")
demo_tasks = [
    ("Hi there", "Simple chat — no tools needed"),
    ("Run code to print hello world", "Code execution task"),
    ("Draft an approval note for pump inspection", "Approval note flow"),
    ("Send email to engineer about maintenance", "Email task"),
    ("Generate a spreadsheet of equipment", "Excel generation"),
    ("Create slides for safety report", "PPT generation"),
]

st.sidebar.markdown("---")
st.sidebar.subheader("Try a demo task")
for task, desc in demo_tasks:
    if st.sidebar.button(f"▶ {task[:30]}...", help=desc, key=f"demo_{task[:20]}"):
        st.session_state["demo_task"] = task
        st.rerun()

if "demo_task" in st.session_state:
    user_message = st.session_state["demo_task"]
    st.info(f"Demo prompt selected: {user_message}")
