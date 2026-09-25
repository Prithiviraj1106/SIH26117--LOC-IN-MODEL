"""
docgen_mcp_server.py — MCP server for generating Word (.docx) documents.

Provides one tool: generate_docx(title, content) -> str (saved file path).

Uses python-docx to create professional Word documents.

When to call: When the orchestrator's flow_approval_note() or any
other flow needs to produce a .docx file as output.
When NOT to call: For simple text responses — use the chat model
instead. Only call when a physical Word document is required.
"""
import json
import os
from pathlib import Path
from fastmcp import FastMCP
from docx import Document
from docx.shared import Pt, Inches
from security import safe_filename

mcp = FastMCP("docgen", instructions="Generate Word (.docx) documents")

OUTPUT_DIR = Path(__file__).parent / "generated_files"
OUTPUT_DIR.mkdir(exist_ok=True)
MULTIPLICATION_TABLES_MARKER = "MRPL_MULTIPLICATION_TABLES_JSON:"


@mcp.tool()
def generate_docx(title: str, content: str | dict) -> str:
    """Generate a Word document with the given title and content.
    
    Args:
        title: The document title (used as heading and filename).
        content: The body text of the document.
    
    Returns:
        The file path of the saved .docx file.
    
    When NOT to call: If content is empty or title is None, return
    an error instead of generating an empty document.
    NEVER call this for general conversation, greetings, or questions
    about how the system itself works."""
    if not content or not title:
        return "Error: title and content are required."

    doc = Document()

    # Title
    doc.add_heading(title, level=0)

    if isinstance(content, str) and content.startswith(MULTIPLICATION_TABLES_MARKER):
        tables = json.loads(content[len(MULTIPLICATION_TABLES_MARKER):])
        for table_data in tables:
            number = int(table_data["number"])
            doc.add_heading(f"Table {number}", level=1)
            table = doc.add_table(rows=1, cols=2)
            table.style = "Table Grid"
            table.rows[0].cells[0].text = "Multiplier"
            table.rows[0].cells[1].text = "Result"
            for multiplier, result in table_data["rows"]:
                cells = table.add_row().cells
                cells[0].text = str(multiplier)
                cells[1].text = str(result)
    elif isinstance(content, dict) and isinstance(content.get("blocks"), list):
        for block in content["blocks"]:
            block_type = block.get("type")
            if block_type == "heading" and block.get("text"):
                doc.add_heading(str(block["text"]), level=1)
            elif block_type == "paragraph" and block.get("text"):
                doc.add_paragraph(str(block["text"]))
            elif block_type == "bullet_list":
                for item in block.get("items", []):
                    if str(item).strip():
                        doc.add_paragraph(str(item), style="List Bullet")
            elif block_type == "table" and block.get("rows"):
                rows = [[str(cell) for cell in row] for row in block["rows"] if isinstance(row, list)]
                if rows:
                    table = doc.add_table(rows=0, cols=max(len(row) for row in rows))
                    table.style = "Table Grid"
                    for row in rows:
                        cells = table.add_row().cells
                        for index, cell in enumerate(row):
                            cells[index].text = cell
    else:
        # Parse content — support simple section headers
        sections = content.split("\n\n")
        for section in sections:
            section = section.strip()
            if not section:
                continue
            # If section looks like a header, treat it as one
            if section.isupper() and len(section) < 50:
                doc.add_heading(section, level=1)
            elif section.startswith("Findings") or section.startswith("SOP Reference") or section.startswith("Recommendation"):
                doc.add_heading(section, level=1)
            else:
                doc.add_paragraph(section)

    filename = safe_filename(title, ".docx")
    filepath = OUTPUT_DIR / filename
    doc.save(str(filepath))
    return str(filepath)


@mcp.tool()
def read_docx(file_path: str) -> str:
    """Extract paragraphs and table text from an existing DOCX file."""
    try:
        document = Document(file_path)
        parts = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]
        for table in document.tables:
            parts.extend(" | ".join(cell.text for cell in row.cells) for row in table.rows)
        return "\n".join(parts) or "No readable DOCX content found."
    except Exception as exc:
        return f"Error reading DOCX: {exc}"


if __name__ == "__main__":
    import os as _os
    _os.environ["FASTMCP_TRANSPORT"] = "stdio"
    mcp.run(transport="stdio")
