"""
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

# Add the project root to sys.path so modules in backend and utils resolve smoothly
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from backend.model_router import (
    MODEL_CHAT,
    MODEL_CODER,
    MODEL_VISION,
    MODEL_EMBED,
    choose_model,
    get_model_info,
    is_coding_question
)
from backend.ollama_client import (
    check_ollama_status,
    ask_ollama,
    is_model_available,
    get_installed_models,
    OLLAMA_BASE_URL
)
from backend.rag import (
    index_document,
    query_document_rag,
    get_chroma_stats,
    clear_chroma_collection
)
from utils.document_loader import load_document
from utils.image_utils import process_image_to_base64


# ==============================================================================
# STREAMLIT PAGE CONFIGURATION & MODERN NEON DARK UI STYLING
# ==============================================================================
st.set_page_config(
    page_title="OMEGA 🤖 - Offline AI Workbench",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for dark sovereign aesthetic with subtle neon blue glow
st.markdown("""
<style>
    /* Global dark canvas */
    .stApp {
        background-color: #070B14;
        color: #E2E8F0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    
    /* Top Header Bar */
    header[data-testid="stHeader"] {
        background-color: transparent !important;
    }

    /* Sidebar Dark Styling */
    section[data-testid="stSidebar"] {
        background-color: #0B1120 !important;
        border-right: 1px solid #1E293B;
    }
    section[data-testid="stSidebar"] .block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
    }

    /* Subtle neon blue glow accent */
    .neon-glow {
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.25);
        border: 1px solid rgba(59, 130, 246, 0.4);
    }
    .neon-glow-card {
        background: linear-gradient(145deg, #0F172A, #0B1120);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 12px;
        padding: 1.25rem;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 10px rgba(59, 130, 246, 0.15);
    }

    /* Sovereign badge */
    .offline-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(16, 185, 129, 0.15);
        color: #34D399;
        border: 1px solid rgba(16, 185, 129, 0.3);
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.05em;
    }
    .offline-badge-alert {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(239, 68, 68, 0.15);
        color: #F87171;
        border: 1px solid rgba(239, 68, 68, 0.3);
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
    }

    /* Model Pill Badge */
    .model-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 10px;
        border-radius: 8px;
        font-size: 0.8rem;
        font-family: monospace;
        font-weight: 500;
    }

    /* Clean Chat Message Styling */
    .chat-bubble-user {
        background: #1E293B;
        color: #F1F5F9;
        border-radius: 12px 12px 2px 12px;
        padding: 14px 18px;
        margin-bottom: 12px;
        border-left: 3px solid #3B82F6;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .chat-bubble-ai {
        background: #0F172A;
        color: #E2E8F0;
        border-radius: 12px 12px 12px 2px;
        padding: 14px 18px;
        margin-bottom: 12px;
        border: 1px solid #1E293B;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    /* ChatGPT style large home prompt area */
    .home-chat-container {
        max-width: 820px;
        margin: 0 auto;
        padding-top: 1.5rem;
    }
    .hero-title {
        font-size: 2.75rem;
        font-weight: 800;
        background: linear-gradient(135deg, #FFFFFF 0%, #93C5FD 50%, #3B82F6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.25rem;
        letter-spacing: -0.02em;
    }
    .hero-subtitle {
        color: #94A3B8;
        font-size: 1.15rem;
        font-weight: 400;
        margin-bottom: 2rem;
    }

    /* Inputs and buttons */
    .stTextInput > div > div > input, .stTextArea > div > div > textarea {
        background-color: #0F172A !important;
        color: #F8FAFC !important;
        border: 1px solid #334155 !important;
        border-radius: 10px !important;
    }
    .stTextInput > div > div > input:focus, .stTextArea > div > div > textarea:focus {
        border: 1px solid #3B82F6 !important;
        box-shadow: 0 0 10px rgba(59, 130, 246, 0.3) !important;
    }
    
    /* Primary buttons with neon glow */
    button[kind="primary"] {
        background: linear-gradient(135deg, #2563EB, #1D4ED8) !important;
        border: 1px solid #60A5FA !important;
        box-shadow: 0 0 12px rgba(37, 99, 235, 0.4) !important;
        color: white !important;
        border-radius: 8px !important;
        font-weight: 600 !important;
    }
    
    /* Hide Streamlit default branding footer */
    footer {visibility: hidden;}
    #MainMenu {visibility: hidden;}
</style>
""", unsafe_allow_html=True)


# ==============================================================================
# SESSION STATE INITIALIZATION
# ==============================================================================
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
    st.session_state.model_usage_stats = {
        MODEL_CHAT: 0,
        MODEL_CODER: 0,
        MODEL_VISION: 0,
        MODEL_EMBED: 0
    }

# Check Ollama daemon status
ollama_online, ollama_msg, installed_models = check_ollama_status()


# ==============================================================================
# PERMANENT SIDEBAR
# ==============================================================================
with st.sidebar:
    st.markdown("### 🤖 AI Workbench")
    st.markdown(
        "<p style='color: #64748B; font-size: 0.85rem; margin-top: -10px;'>OMEGA v1.0 • Sovereign Edition</p>",
        unsafe_allow_html=True
    )
    
    # Status Badge
    if ollama_online:
        st.markdown(
            '<div class="offline-badge">🔒 OFFLINE MODE • ONLINE</div>',
            unsafe_allow_html=True
        )
    else:
        st.markdown(
            '<div class="offline-badge-alert">❌ OLLAMA OFFLINE</div>',
            unsafe_allow_html=True
        )
        
    st.markdown("<div style='margin-bottom: 1.25rem;'></div>", unsafe_allow_html=True)
    
    # Navigation Menu
    nav_options = [
        "🏠 Home",
        "💬 Chatbot",
        "👁️ Vision Analysis",
        "📄 Document Analysis",
        "📊 Output Insights",
        "📈 Dashboard"
    ]
    
    selected_page = st.radio(
        "Navigation",
        options=nav_options,
        index=nav_options.index(st.session_state.page) if st.session_state.page in nav_options else 0,
        label_visibility="collapsed"
    )
    st.session_state.page = selected_page
    
    st.markdown("---")
    
    # Active Model & Routing Preview
    st.markdown("#### 🎯 Model Engine")
    curr_info = get_model_info(st.session_state.current_model)
    st.markdown(
        f"""
        <div style="background: #0F172A; padding: 10px; border-radius: 8px; border: 1px solid #1E293B;">
            <div style="font-size: 0.75rem; color: #94A3B8;">CURRENT ROUTE</div>
            <div style="font-weight: 700; color: {curr_info['color']}; font-family: monospace; font-size: 0.9rem;">
                {curr_info['icon']} {st.session_state.current_model}
            </div>
            <div style="font-size: 0.75rem; color: #64748B; margin-top: 3px;">
                {curr_info['role']}
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )
    
    st.markdown("---")
    
    # Recent Activity Section
    st.markdown("#### 🕒 Recent Activity")
    if st.session_state.history:
        for idx, item in enumerate(reversed(st.session_state.history[-6:])):
            q_text = item.get("query", "")
            time_str = item.get("time", "")
            model_tag = item.get("model", "")
            
            # Truncate for sidebar
            disp_query = q_text if len(q_text) <= 32 else q_text[:30] + "..."
            st.markdown(
                f"""
                <div style="font-size: 0.8rem; padding: 5px 8px; margin-bottom: 4px; background: #0A0F1D; border-radius: 6px; border-left: 2px solid #3B82F6;">
                    <div style="color: #E2E8F0; font-weight: 500;">{disp_query}</div>
                    <div style="color: #64748B; font-size: 0.7rem;">{time_str} • {model_tag}</div>
                </div>
                """,
                unsafe_allow_html=True
            )
    else:
        st.markdown("<p style='color: #475569; font-size: 0.8rem;'>No recent queries yet.</p>", unsafe_allow_html=True)
        
    st.markdown("---")
    st.markdown(
        "<div style='font-size: 0.7rem; color: #475569; text-align: center;'>"
        "Zero Cloud Calls • Local Ollama 11434<br>Strict Privacy Guaranteed"
        "</div>",
        unsafe_allow_html=True
    )


# ==============================================================================
# TOP OFFLINE WARNING IF OLLAMA IS DOWN
# ==============================================================================
if not ollama_online:
    st.error(
        "❌ **Ollama is offline. Please start Ollama.**\n\n"
        "OMEGA operates strictly locally and cannot reach external cloud APIs.\n"
        "To start Ollama on your Windows PC:\n"
        "1. Open Start menu and run **Ollama**, or\n"
        "2. Open Command Prompt / PowerShell and execute `ollama serve`\n"
        f"3. Verify endpoint: `{OLLAMA_BASE_URL}`"
    )


# ==============================================================================
# HELPER FUNCTIONS FOR ACTIVITY TRACKING
# ==============================================================================
def record_activity(query: str, model_used: str, category: str = "Chat"):
    """
    Saves an entry into local session history.
    """
    now_str = datetime.now().strftime("%H:%M:%S")
    st.session_state.history.append({
        "query": query,
        "model": model_used,
        "category": category,
        "time": now_str
    })
    # Update stats
    if model_used in st.session_state.model_usage_stats:
        st.session_state.model_usage_stats[model_used] += 1
    else:
        st.session_state.model_usage_stats[model_used] = 1


# ==============================================================================
# PAGE 1: 🏠 HOME PAGE
# ==============================================================================
if st.session_state.page == "🏠 Home":
    st.markdown("<div class='home-chat-container'>", unsafe_allow_html=True)
    
    col1, col2 = st.columns([4, 1])
    with col1:
        st.markdown("<h1 class='hero-title'>OMEGA 🤖</h1>", unsafe_allow_html=True)
        st.markdown(
            "<p class='hero-subtitle'>Secure, sovereign, and offline AI workspace.</p>",
            unsafe_allow_html=True
        )
    with col2:
        st.markdown(
            """
            <div style="text-align: right; padding-top: 1rem;">
                <div class="offline-badge">🔒 100% OFFLINE</div>
            </div>
            """,
            unsafe_allow_html=True
        )
        
    # Quick prompt suggestion chips
    st.markdown("<div style='margin-bottom: 0.5rem; font-size: 0.85rem; color: #64748B;'>Try asking:</div>", unsafe_allow_html=True)
    sug_cols = st.columns(3)
    
    sample_queries = [
        "Explain Python decorators",
        "Write a Python program for a calculator",
        "What is photosynthesis?"
    ]
    
    preset_clicked = None
    with sug_cols[0]:
        if st.button("⚡ Explain Python decorators", use_container_width=True):
            preset_clicked = "Explain Python decorators"
    with sug_cols[1]:
        if st.button("🧮 Calculator in Python", use_container_width=True):
            preset_clicked = "Write a Python program for a calculator"
    with sug_cols[2]:
        if st.button("🌿 What is photosynthesis?", use_container_width=True):
            preset_clicked = "What is photosynthesis?"

    # Chat Input Box
    with st.form(key="home_chat_form", clear_on_submit=True):
        user_input = st.text_area(
            "Prompt",
            value=preset_clicked if preset_clicked else "",
            placeholder="Ask OMEGA anything...",
            height=95,
            label_visibility="collapsed"
        )
        submit_button = st.form_submit_button("Ask OMEGA ➔", type="primary", use_container_width=True)

    # Process submission
    active_prompt = preset_clicked if preset_clicked else (user_input if submit_button and user_input.strip() else None)
    
    if active_prompt:
        clean_prompt = active_prompt.strip()
        
        # 1. Automated Model Routing
        selected_model = choose_model(clean_prompt, has_image=False)
        st.session_state.current_model = selected_model
        
        # 2. Append User Message
        st.session_state.messages.append({
            "role": "user",
            "content": clean_prompt,
            "model": selected_model,
            "timestamp": datetime.now().strftime("%H:%M:%S")
        })
        
        # Record Activity
        record_activity(clean_prompt, selected_model, category="Coding" if is_coding_question(clean_prompt) else "General")
        
        # 3. Query Local Ollama
        with st.spinner(f"Routing to local model `{selected_model}` via Ollama..."):
            resp = ask_ollama(
                model=selected_model,
                prompt=clean_prompt
            )
            
            ai_content = resp.get("response", "No response received.")
            st.session_state.messages.append({
                "role": "assistant",
                "content": ai_content,
                "model": selected_model,
                "timestamp": datetime.now().strftime("%H:%M:%S")
            })

    # Render Conversation Area below
    if st.session_state.messages:
        st.markdown("---")
        st.markdown("### Conversation")
        
        for msg in reversed(st.session_state.messages[-10:]):
            if msg["role"] == "user":
                st.markdown(
                    f"""
                    <div class="chat-bubble-user">
                        <div style="font-size: 0.75rem; color: #93C5FD; margin-bottom: 4px; font-weight: 600;">YOU • {msg.get('timestamp', '')}</div>
                        <div>{msg['content']}</div>
                    </div>
                    """,
                    unsafe_allow_html=True
                )
            else:
                model_name = msg.get("model", MODEL_CHAT)
                info = get_model_info(model_name)
                st.markdown(
                    f"""
                    <div class="chat-bubble-ai">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span class="model-badge" style="background: rgba(59, 130, 246, 0.15); color: {info['color']};">
                                {info['icon']} {model_name}
                            </span>
                            <span style="font-size: 0.75rem; color: #64748B;">{msg.get('timestamp', '')}</span>
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True
                )
                # Use st.markdown for assistant text to render code blocks and markdown properly
                st.markdown(msg["content"])
                st.markdown("<div style='margin-bottom: 1.5rem;'></div>", unsafe_allow_html=True)
                
    st.markdown("</div>", unsafe_allow_html=True)


# ==============================================================================
# PAGE 2: 💬 CHATBOT PAGE
# ==============================================================================
elif st.session_state.page == "💬 Chatbot":
    col_t1, col_t2 = st.columns([3, 1])
    with col_t1:
        st.markdown("## 💬 Local Sovereign Chat")
        st.markdown("<p style='color: #94A3B8;'>Full conversation history with automated model routing and offline attachments.</p>", unsafe_allow_html=True)
    with col_t2:
        if st.button("🗑️ Clear Conversation", use_container_width=True):
            st.session_state.messages = []
            st.rerun()

    # Content Attachment Expander
    with st.expander("➕ Attach Content (Camera / Local Files)", expanded=(st.session_state.attachment_mode != "none")):
        attach_type = st.radio(
            "Select Attachment Source",
            ["None", "📸 Camera", "📁 Files"],
            horizontal=True
        )
        
        attached_b64 = None
        attached_preview = None
        attached_doc_text = None
        
        if attach_type == "📸 Camera":
            camera_img = st.camera_input("Capture Local Photo")
            if camera_img:
                attached_b64, attached_preview, err = process_image_to_base64(camera_img)
                if err:
                    st.error(err)
                else:
                    st.success("Camera snapshot captured locally.")
                    
        elif attach_type == "📁 Files":
            uploaded_file = st.file_uploader(
                "Upload Image or Document (PNG, JPG, PDF, DOCX, TXT)",
                type=["png", "jpg", "jpeg", "pdf", "docx", "txt"]
            )
            if uploaded_file:
                fname = uploaded_file.name.lower()
                if fname.endswith((".png", ".jpg", ".jpeg")):
                    attached_b64, attached_preview, err = process_image_to_base64(uploaded_file)
                    if err:
                        st.error(err)
                    else:
                        st.image(attached_preview, caption="Attached Local Image", width=300)
                else:
                    doc_text, count, ftype = load_document(uploaded_file)
                    attached_doc_text = doc_text
                    st.success(f"Attached {ftype} file ({count} units) locally.")

    # Render Existing Messages
    for msg in st.session_state.messages:
        role = msg["role"]
        content = msg["content"]
        timestamp = msg.get("timestamp", "")
        model_name = msg.get("model", MODEL_CHAT)
        
        if role == "user":
            with st.chat_message("user", avatar="👤"):
                st.markdown(f"**You** <span style='font-size:0.75rem; color:#64748B;'>({timestamp})</span>", unsafe_allow_html=True)
                if msg.get("image_preview"):
                    st.image(msg["image_preview"], width=280)
                st.markdown(content)
        else:
            with st.chat_message("assistant", avatar="🤖"):
                info = get_model_info(model_name)
                st.markdown(
                    f"<span class='model-badge' style='background: rgba(59, 130, 246, 0.15); color:{info['color']}'>"
                    f"{info['icon']} {model_name} • {info['type']}</span>",
                    unsafe_allow_html=True
                )
                st.markdown(content)

    # Chat Input
    prompt = st.chat_input("Type your message here...")
    
    if prompt:
        has_image = (attached_b64 is not None)
        
        # Select Model
        if has_image:
            target_model = MODEL_VISION
        else:
            target_model = choose_model(prompt, has_image=False)
            
        st.session_state.current_model = target_model
        
        # User message
        user_msg = {
            "role": "user",
            "content": prompt,
            "model": target_model,
            "timestamp": datetime.now().strftime("%H:%M:%S")
        }
        if attached_preview:
            user_msg["image_preview"] = attached_preview
        st.session_state.messages.append(user_msg)
        
        # Record
        record_activity(prompt, target_model, category="Chatbot")
        
        # Display immediately
        with st.chat_message("user", avatar="👤"):
            if attached_preview:
                st.image(attached_preview, width=280)
            st.markdown(prompt)
            
        # Assistant generation
        with st.chat_message("assistant", avatar="🤖"):
            info = get_model_info(target_model)
            st.markdown(
                f"<span class='model-badge' style='background: rgba(59, 130, 246, 0.15); color:{info['color']}'>"
                f"{info['icon']} {target_model}</span>",
                unsafe_allow_html=True
            )
            with st.spinner(f"Inference in progress with local {target_model}..."):
                # If document was attached inline
                final_prompt = prompt
                if attached_doc_text:
                    final_prompt = (
                        f"ATTACHED DOCUMENT CONTEXT:\n{attached_doc_text[:4000]}\n\n"
                        f"USER QUERY: {prompt}"
                    )
                    
                resp = ask_ollama(
                    model=target_model,
                    prompt=final_prompt,
                    images=[attached_b64] if attached_b64 else None
                )
                ai_text = resp.get("response", "No response returned.")
                st.markdown(ai_text)
                
                st.session_state.messages.append({
                    "role": "assistant",
                    "content": ai_text,
                    "model": target_model,
                    "timestamp": datetime.now().strftime("%H:%M:%S")
                })


# ==============================================================================
# PAGE 3: 👁️ VISION ANALYSIS
# ==============================================================================
elif st.session_state.page == "👁️ Vision Analysis":
    st.markdown("## 👁️ Local Vision Analysis")
    st.markdown(
        "<p style='color: #94A3B8;'>Upload any local image. Analysis is performed offline using <code>qwen2-vl:7b</code>.</p>",
        unsafe_allow_html=True
    )
    
    col_v1, col_v2 = st.columns([1, 1])
    
    with col_v1:
        st.markdown("#### 1. Upload Local Image")
        img_file = st.file_uploader(
            "Supported: PNG, JPG, JPEG",
            type=["png", "jpg", "jpeg"],
            key="vision_uploader"
        )
        
        b64_img = None
        pil_img = None
        if img_file:
            b64_img, pil_img, err = process_image_to_base64(img_file)
            if err:
                st.error(err)
            else:
                st.image(pil_img, caption=f"Local Image Preview ({img_file.name})", use_container_width=True)
                
    with col_v2:
        st.markdown("#### 2. Query Local Vision Model")
        
        # Example question pills
        st.markdown("<div style='font-size: 0.8rem; color: #64748B;'>Common Vision Queries:</div>", unsafe_allow_html=True)
        q_cols = st.columns(2)
        v_preset = None
        with q_cols[0]:
            if st.button("🔍 What is in this image?", key="v_btn1", use_container_width=True):
                v_preset = "What is in this image?"
            if st.button("📊 Explain this diagram", key="v_btn2", use_container_width=True):
                v_preset = "Explain this diagram in detail."
        with q_cols[1]:
            if st.button("📝 Read text in image", key="v_btn3", use_container_width=True):
                v_preset = "Read and extract all visible text in this image."
            if st.button("🏷️ Describe the objects", key="v_btn4", use_container_width=True):
                v_preset = "Describe the objects, colors, and layout."

        with st.form("vision_query_form"):
            vision_query = st.text_area(
                "Ask about this image...",
                value=v_preset if v_preset else "What is in this image?",
                height=90
            )
            submit_vision = st.form_submit_button("Analyze Image with qwen2-vl:7b ➔", type="primary", use_container_width=True)
            
        if submit_vision:
            if not b64_img:
                st.warning("⚠️ Please upload an image first.")
            elif not vision_query.strip():
                st.warning("⚠️ Please enter a question about the image.")
            else:
                st.session_state.current_model = MODEL_VISION
                record_activity(vision_query, MODEL_VISION, category="Vision")
                
                with st.spinner(f"Sending image to local `{MODEL_VISION}` on Ollama..."):
                    start_t = time.time()
                    resp = ask_ollama(
                        model=MODEL_VISION,
                        prompt=vision_query.strip(),
                        images=[b64_img],
                        timeout=180
                    )
                    elapsed = round(time.time() - start_t, 2)
                    
                    st.markdown("---")
                    st.markdown(f"#### 🔎 Analysis Result ({elapsed}s)")
                    if resp.get("success"):
                        st.markdown(
                            f"<div class='neon-glow-card' style='margin-top: 10px;'>"
                            f"<div style='font-size:0.75rem; color:#A78BFA; margin-bottom:8px;'>MODEL: {MODEL_VISION} • LOCAL INFERENCE</div>"
                            f"</div>",
                            unsafe_allow_html=True
                        )
                        st.markdown(resp.get("response"))
                    else:
                        st.error(resp.get("response"))


# ==============================================================================
# PAGE 4: 📄 DOCUMENT ANALYSIS (LOCAL RAG)
# ==============================================================================
elif st.session_state.page == "📄 Document Analysis":
    st.markdown("## 📄 Local Document RAG Engine")
    st.markdown(
        "<p style='color: #94A3B8;'>"
        "Secure document retrieval using <code>PyMuPDF</code>/<code>python-docx</code>, "
        "<code>nomic-embed-text</code> vector embeddings in local <code>ChromaDB</code>, "
        "and grounded synthesis with <code>llama3.1:8b</code>."
        "</p>",
        unsafe_allow_html=True
    )
    
    col_d1, col_d2 = st.columns([1, 1])
    
    with col_d1:
        st.markdown("### 📄 Upload Document")
        st.caption("Supported formats: PDF, DOCX, TXT")
        
        doc_file = st.file_uploader(
            "Select a document from your computer",
            type=["pdf", "docx", "txt"],
            key="rag_doc_uploader"
        )
        
        if doc_file:
            # Check if this document has already been processed in session
            already_indexed = any(d["name"] == doc_file.name for d in st.session_state.documents)
            
            if st.button("⚙️ Process & Index Document Locally", type="primary", use_container_width=True):
                with st.spinner(f"Extracting text from {doc_file.name} locally..."):
                    try:
                        extracted_text, count, file_type = load_document(doc_file)
                        
                        if not extracted_text.strip():
                            st.error("❌ Document contained no readable text.")
                        else:
                            st.info(f"Extracted {len(extracted_text):,} characters from {count} {file_type} unit(s). Chunking and embedding with `{MODEL_EMBED}`...")
                            
                            ok, num_chunks, status_msg = index_document(
                                filename=doc_file.name,
                                text=extracted_text,
                                chunk_size=500,
                                chunk_overlap=50
                            )
                            
                            if ok:
                                st.success(status_msg)
                                # Record into session documents
                                st.session_state.documents.append({
                                    "name": doc_file.name,
                                    "chunks": num_chunks,
                                    "type": file_type,
                                    "time": datetime.now().strftime("%H:%M:%S")
                                })
                            else:
                                st.error(status_msg)
                    except Exception as ex:
                        st.error(f"Error loading document: {str(ex)}")
                        
        if st.session_state.documents:
            st.markdown("#### 📚 Processed Documents in Vector Store")
            for d in st.session_state.documents:
                st.markdown(
                    f"""
                    <div style="background: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px;">
                        <div style="font-weight: 600; color: #38BDF8;">📄 {d['name']}</div>
                        <div style="font-size: 0.8rem; color: #94A3B8;">{d['chunks']} vector chunks • {d['type']} • {d['time']}</div>
                        <div style="font-size: 0.75rem; color: #34D399; font-weight: 600;">✅ Document processed locally</div>
                    </div>
                    """,
                    unsafe_allow_html=True
                )
            if st.button("🧹 Clear Local Vector DB", use_container_width=True):
                clear_chroma_collection()
                st.session_state.documents = []
                st.rerun()

    with col_d2:
        st.markdown("### 🔎 Ask Document Questions")
        
        with st.form("rag_query_form"):
            user_doc_query = st.text_input(
                "Ask a question about this document...",
                placeholder="e.g. What are the key findings or deadlines?"
            )
            submit_doc_q = st.form_submit_button("🔎 Query Document", type="primary", use_container_width=True)
            
        if submit_doc_q and user_doc_query.strip():
            st.session_state.current_model = MODEL_CHAT
            record_activity(user_doc_query, MODEL_CHAT, category="Document RAG")
            
            with st.spinner("Searching ChromaDB vectors & generating grounded answer with llama3.1:8b..."):
                rag_result = query_document_rag(user_doc_query, n_results=4)
                
                # Save query record
                st.session_state.document_queries.append({
                    "query": user_doc_query,
                    "answer": rag_result.get("answer"),
                    "sources": rag_result.get("sources", []),
                    "time": datetime.now().strftime("%H:%M:%S")
                })
                
                st.markdown("#### 💡 Grounded Answer")
                st.markdown(
                    f"<div class='neon-glow-card' style='margin-bottom: 1rem;'>"
                    f"<div style='font-size:0.75rem; color:#38BDF8; margin-bottom: 8px;'>REASONING: {MODEL_CHAT} • EMBEDDINGS: {MODEL_EMBED}</div>"
                    f"</div>",
                    unsafe_allow_html=True
                )
                st.markdown(rag_result.get("answer"))
                
                # Sources & Citations
                sources = rag_result.get("sources", [])
                if sources:
                    st.markdown("---")
                    st.markdown("#### 📚 Sources / Relevant Sections")
                    for s_idx, src in enumerate(sources):
                        with st.expander(f"Source {s_idx + 1}: {src['source']} (Relevance: {int(src['similarity']*100)}%)"):
                            st.markdown(f"**Chunk #{src['chunk_index']}**")
                            st.code(src["text"], language=None)


# ==============================================================================
# PAGE 5: 📊 OUTPUT INSIGHTS
# ==============================================================================
elif st.session_state.page == "📊 Output Insights":
    st.markdown("## 📊 Output Insights")
    st.markdown(
        "<p style='color: #94A3B8;'>Synthesized intelligence from previous offline AI interactions. Stored purely in local memory.</p>",
        unsafe_allow_html=True
    )
    
    # Top metrics row
    m1, m2, m3, m4 = st.columns(4)
    with m1:
        st.markdown(
            f"""
            <div class="neon-glow-card">
                <div style="font-size: 0.8rem; color: #94A3B8;">TOTAL INTERACTIONS</div>
                <div style="font-size: 1.8rem; font-weight: 700; color: #60A5FA;">{len(st.session_state.history)}</div>
            </div>
            """,
            unsafe_allow_html=True
        )
    with m2:
        st.markdown(
            f"""
            <div class="neon-glow-card">
                <div style="font-size: 0.8rem; color: #94A3B8;">CHAT MESSAGES</div>
                <div style="font-size: 1.8rem; font-weight: 700; color: #34D399;">{len(st.session_state.messages)}</div>
            </div>
            """,
            unsafe_allow_html=True
        )
    with m3:
        st.markdown(
            f"""
            <div class="neon-glow-card">
                <div style="font-size: 0.8rem; color: #94A3B8;">INDEXED DOCUMENTS</div>
                <div style="font-size: 1.8rem; font-weight: 700; color: #A78BFA;">{len(st.session_state.documents)}</div>
            </div>
            """,
            unsafe_allow_html=True
        )
    with m4:
        st.markdown(
            f"""
            <div class="neon-glow-card">
                <div style="font-size: 0.8rem; color: #94A3B8;">RAG QUERIES</div>
                <div style="font-size: 1.8rem; font-weight: 700; color: #F472B6;">{len(st.session_state.document_queries)}</div>
            </div>
            """,
            unsafe_allow_html=True
        )
        
    st.markdown("<div style='margin-bottom: 2rem;'></div>", unsafe_allow_html=True)
    
    col_i1, col_i2 = st.columns([1, 1])
    
    with col_i1:
        st.markdown("### 📈 Model Usage Distribution")
        stats = st.session_state.model_usage_stats
        for m_name, count in stats.items():
            info = get_model_info(m_name)
            st.markdown(
                f"""
                <div style="display:flex; justify-content:space-between; align-items:center; background:#0F172A; border:1px solid #1E293B; border-radius:8px; padding:12px; margin-bottom:10px;">
                    <div>
                        <span style="font-weight:600; color:{info['color']}; font-family:monospace;">{info['icon']} {m_name}</span>
                        <div style="font-size:0.75rem; color:#64748B;">{info['role']}</div>
                    </div>
                    <div style="font-size:1.2rem; font-weight:700; color:#E2E8F0;">{count} calls</div>
                </div>
                """,
                unsafe_allow_html=True
            )
            
    with col_i2:
        st.markdown("### 🕒 Recent Interaction Log")
        if st.session_state.history:
            for item in reversed(st.session_state.history[-8:]):
                st.markdown(
                    f"""
                    <div style="background:#0F172A; border-left:3px solid #3B82F6; padding:10px 14px; margin-bottom:8px; border-radius:4px;">
                        <div style="font-weight:500; color:#F1F5F9;">{item['query']}</div>
                        <div style="display:flex; gap:12px; font-size:0.75rem; color:#64748B; margin-top:4px;">
                            <span>⏱️ {item['time']}</span>
                            <span>🤖 {item['model']}</span>
                            <span>🏷️ {item.get('category', 'General')}</span>
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True
                )
        else:
            st.info("No recorded interactions yet. Submit questions in Home, Chat, or Vision to generate insights.")


# ==============================================================================
# PAGE 6: 📈 DASHBOARD
# ==============================================================================
elif st.session_state.page == "📈 Dashboard":
    st.markdown("## 📈 Sovereign System Dashboard")
    st.markdown(
        "<p style='color: #94A3B8;'>Real-time operational status of local AI runtimes, vector storage, and hardware isolation.</p>",
        unsafe_allow_html=True
    )
    
    # 4 Status Indicator Cards
    d1, d2, d3, d4 = st.columns(4)
    
    with d1:
        if ollama_online:
            st.markdown(
                """
                <div class="neon-glow-card" style="border-left: 4px solid #10B981;">
                    <div style="font-size: 0.8rem; color: #94A3B8;">OLLAMA STATUS</div>
                    <div style="font-size: 1.3rem; font-weight: 700; color: #34D399;">🟢 ONLINE</div>
                    <div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">localhost:11434</div>
                </div>
                """,
                unsafe_allow_html=True
            )
        else:
            st.markdown(
                """
                <div class="neon-glow-card" style="border-left: 4px solid #EF4444;">
                    <div style="font-size: 0.8rem; color: #94A3B8;">OLLAMA STATUS</div>
                    <div style="font-size: 1.3rem; font-weight: 700; color: #F87171;">🔴 OFFLINE</div>
                    <div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">Run `ollama serve`</div>
                </div>
                """,
                unsafe_allow_html=True
            )
            
    with d2:
        st.markdown(
            """
            <div class="neon-glow-card" style="border-left: 4px solid #3B82F6;">
                <div style="font-size: 0.8rem; color: #94A3B8;">LOCAL AI MODE</div>
                <div style="font-size: 1.3rem; font-weight: 700; color: #60A5FA;">🟢 ACTIVE</div>
                <div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">Zero Cloud Telemetry</div>
            </div>
            """,
            unsafe_allow_html=True
        )
        
    with d3:
        chroma_info = get_chroma_stats()
        ch_color = "#34D399" if chroma_info.get("healthy") else "#F87171"
        st.markdown(
            f"""
            <div class="neon-glow-card" style="border-left: 4px solid #8B5CF6;">
                <div style="font-size: 0.8rem; color: #94A3B8;">VECTOR DATABASE</div>
                <div style="font-size: 1.3rem; font-weight: 700; color: {ch_color};">🟢 CHROMADB</div>
                <div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">{chroma_info.get('total_chunks', 0)} chunks stored</div>
            </div>
            """,
            unsafe_allow_html=True
        )
        
    with d4:
        embed_available = is_model_available(MODEL_EMBED) if ollama_online else False
        emb_status = "🟢 READY" if embed_available else ("🟡 NOT PULLED" if ollama_online else "🔴 OFFLINE")
        st.markdown(
            f"""
            <div class="neon-glow-card" style="border-left: 4px solid #06B6D4;">
                <div style="font-size: 0.8rem; color: #94A3B8;">EMBEDDING MODEL</div>
                <div style="font-size: 1.3rem; font-weight: 700; color: #22D3EE;">{emb_status}</div>
                <div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">{MODEL_EMBED}</div>
            </div>
            """,
            unsafe_allow_html=True
        )
        
    st.markdown("<div style='margin-bottom: 2rem;'></div>", unsafe_allow_html=True)
    
    # Model Availability Matrix
    st.markdown("### 🤖 Required Local Model Matrix")
    req_models = [
        {"name": MODEL_CHAT, "role": "General Chat & Reasoning", "pulled": is_model_available(MODEL_CHAT)},
        {"name": MODEL_CODER, "role": "Coding & Software Engineering", "pulled": is_model_available(MODEL_CODER)},
        {"name": MODEL_VISION, "role": "Multimodal Vision Analysis", "pulled": is_model_available(MODEL_VISION)},
        {"name": MODEL_EMBED, "role": "Document Embeddings & Vector Search", "pulled": is_model_available(MODEL_EMBED)},
    ]
    
    for rm in req_models:
        status_badge = "🟢 Ready Locally" if rm["pulled"] else "⚠️ Not Found in Ollama"
        pull_cmd = f"ollama pull {rm['name']}"
        st.markdown(
            f"""
            <div style="display: flex; justify-content: space-between; align-items: center; background: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 12px 18px; margin-bottom: 8px;">
                <div>
                    <div style="font-family: monospace; font-weight: 700; color: #F1F5F9; font-size: 0.95rem;">{rm['name']}</div>
                    <div style="font-size: 0.8rem; color: #94A3B8;">{rm['role']}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.85rem; font-weight: 600; color: {'#34D399' if rm['pulled'] else '#FBBF24'};">{status_badge}</div>
                    <div style="font-size: 0.75rem; color: #64748B; font-family: monospace;">{pull_cmd}</div>
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )
        
    st.markdown("---")
    
    # Offline Sovereign Verification Card
    st.markdown("### 🔒 Sovereign Privacy & Offline Verification")
    st.markdown(
        """
        <div style="background: #0B1120; border: 1px solid #1E293B; border-radius: 10px; padding: 18px;">
            <ul style="color: #94A3B8; font-size: 0.9rem; line-height: 1.8; margin-bottom: 0;">
                <li><strong style="color: #E2E8F0;">Network Boundary:</strong> All inference requests target <code>http://localhost:11434</code>. No external API keys or cloud tokens are configured.</li>
                <li><strong style="color: #E2E8F0;">Document Storage:</strong> Documents processed in Document Analysis are parsed in-memory and persisted exclusively to local directory <code>data/chroma/</code>.</li>
                <li><strong style="color: #E2E8F0;">Session Privacy:</strong> Chat messages, camera snapshots, and prompt histories reside strictly in local memory and are purged when session is terminated.</li>
            </ul>
        </div>
        """,
        unsafe_allow_html=True
    )
