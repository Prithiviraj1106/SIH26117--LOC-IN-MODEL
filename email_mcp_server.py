"""
email_mcp_server.py — MCP server for sending emails via local MailHog.

Provides one tool: send_email(to, subject, body) -> str.

Uses Python's built-in smtplib to send through MailHog
(local SMTP on localhost:1025). This keeps email fully
offline — no cloud SMTP providers involved.

When to call: When the orchestrator's flow_email() needs to
draft and send a notification email. Used in the demo to
show correspondence without any external network calls.
When NOT to call: When MailHog is not running — the call
will fail. Do not use for real external email addresses.
Also NOT for production — this is demo-only.
"""
import smtplib
import os
import json
import sys
from datetime import datetime, timezone
from email.message import EmailMessage
from fastmcp import FastMCP

mcp = FastMCP("email", instructions="Send emails via local MailHog SMTP server")

SMTP_HOST = os.getenv("MRPL_SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("MRPL_SMTP_PORT", "1025"))
SMTP_USER = os.getenv("MRPL_SMTP_USER", "")
SMTP_PASSWORD = os.getenv("MRPL_SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("MRPL_SMTP_FROM", SMTP_USER or "workbench@mrpl.local")
SMTP_TLS = os.getenv("MRPL_SMTP_TLS", "false").lower() == "true"
MAILHOG_URL = "http://localhost:8025"


@mcp.tool()
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email through the configured SMTP server.
    
    Args:
        to: Recipient email address.
        subject: Email subject line.
        body: Email body text.
    
    Returns:
        Confirmation string with recipient and status.
    
    MailHog is the default local server. External SMTP is enabled only
    when configured explicitly through MRPL_SMTP_* environment variables.
    NEVER call this for general conversation, greetings, or questions
    about how the system itself works."""
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    print(f"[Email] send_email timestamp={timestamp} to={to}", file=sys.stderr, flush=True)
    try:
        msg = EmailMessage()
        msg["From"] = SMTP_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if SMTP_TLS:
                server.starttls()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to, msg.as_string())
        mode = "local MailHog" if SMTP_HOST in {"localhost", "127.0.0.1"} else f"SMTP {SMTP_HOST}"
        return json.dumps({
            "success": True,
            "confirmation": f"Email sent to {to} with subject '{subject}' via {mode}",
            "to": to,
            "subject": subject,
            "body": body,
            "mailhog_url": MAILHOG_URL if SMTP_HOST in {"localhost", "127.0.0.1"} else None,
        })
    except ConnectionRefusedError:
        return json.dumps({
            "success": False,
            "error": "MailHog not running on localhost:1025. Start MailHog first.",
            "to": to,
            "subject": subject,
            "body": body,
        })
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": f"Error sending email: {e}",
            "to": to,
            "subject": subject,
            "body": body,
        })


if __name__ == "__main__":
    import os as _os
    _os.environ["FASTMCP_TRANSPORT"] = "stdio"
    mcp.run(transport="stdio")
