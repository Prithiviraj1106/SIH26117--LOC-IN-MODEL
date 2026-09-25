"""
pptx_mcp_server.py — MCP server for generating PowerPoint (.pptx) presentations.

Provides one tool: generate_pptx(data) -> str (saved file path).

Uses python-pptx to create slide decks from structured content.

When to call: When the orchestrator's flow_pptx() converts a
request into slide content and needs to save it as .pptx.
When NOT to call: For single-page documents — use docgen instead.
"""
import json
from pathlib import Path
from fastmcp import FastMCP
from pptx import Presentation
from pptx.util import Inches, Pt
from security import safe_filename

mcp = FastMCP("pptx", instructions="Generate PowerPoint (.pptx) presentations")

OUTPUT_DIR = Path(__file__).parent / "generated_files"
OUTPUT_DIR.mkdir(exist_ok=True)


@mcp.tool()
def generate_pptx(data: dict) -> str:
    """Generate a PowerPoint presentation from structured data.
    
    Args:
        data: A dict with keys 'title' and 'slides_content'
              (sections separated by ---, each starting with a heading).
    
    Returns:
        The file path of the saved .pptx file.
    
    When NOT to call: If data is not valid JSON or missing
    required keys, return an error message.
    NEVER call this for general conversation, greetings, or questions
    about how the system itself works."""
    try:
        if isinstance(data, str):
            data = json.loads(data)
        if not isinstance(data, dict):
            return "Error: presentation data must be an object."
        title = data.get("title")
        slides_content = data.get("slides_content")
        if not isinstance(title, str) or not title.strip():
            return "Error: presentation title is required."
        if not isinstance(slides_content, str) or not slides_content.strip():
            return "Error: presentation slide content is required."
    except (json.JSONDecodeError, TypeError) as e:
        return f"Error parsing data: {e}"

    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Title slide
    title_slide_layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(title_slide_layout)
    slide.shapes.title.text = title

    # Parse slides — split by --- separator
    sections = slides_content.split("---")
    for section in sections:
        section = section.strip()
        if not section:
            continue
        lines = section.split("\n")
        heading = lines[0].strip() if lines else "Slide"

        # Use title + content layout
        if len(prs.slides._sldIdLst) > 0:
            slide_layout = prs.slide_layouts[1]  # Title and Content
            slide = prs.slides.add_slide(slide_layout)
            slide.shapes.title.text = heading
            content = "\n".join(lines[1:]).strip()
            if content:
                slide.placeholders[1].text = content
        else:
            slide_layout = prs.slide_layouts[1]
            slide = prs.slides.add_slide(slide_layout)
            slide.shapes.title.text = heading
            content = "\n".join(lines[1:]).strip()
            if content:
                slide.placeholders[1].text = content

    filename = safe_filename(title, ".pptx")
    filepath = OUTPUT_DIR / filename
    prs.save(str(filepath))
    return str(filepath)


@mcp.tool()
def read_pptx(file_path: str) -> str:
    """Extract text from an existing PowerPoint presentation."""
    try:
        presentation = Presentation(file_path)
        parts = []
        for index, slide in enumerate(presentation.slides, start=1):
            slide_text = [shape.text for shape in slide.shapes if hasattr(shape, "text") and shape.text.strip()]
            if slide_text:
                parts.append(f"[Slide {index}]\n" + "\n".join(slide_text))
        return "\n\n".join(parts) or "No readable PPTX content found."
    except Exception as exc:
        return f"Error reading PPTX: {exc}"


if __name__ == "__main__":
    import os as _os
    _os.environ["FASTMCP_TRANSPORT"] = "stdio"
    mcp.run(transport="stdio")
