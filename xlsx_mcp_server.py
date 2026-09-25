"""
xlsx_mcp_server.py — MCP server for generating Excel (.xlsx) spreadsheets.

Provides one tool: generate_xlsx(data) -> str (saved file path).

Uses openpyxl to create spreadsheets from structured data.

When to call: When the orchestrator's flow_xlsx() converts a
request into spreadsheet data and needs to save it as .xlsx.
When NOT to call: For unstructured text — use chat model instead.
"""
import json
from pathlib import Path
from fastmcp import FastMCP
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from security import safe_filename

mcp = FastMCP("xlsx", instructions="Generate Excel (.xlsx) spreadsheets")

OUTPUT_DIR = Path(__file__).parent / "generated_files"
OUTPUT_DIR.mkdir(exist_ok=True)


@mcp.tool()
def generate_xlsx(data: dict) -> str:
    """Generate an Excel spreadsheet from structured data.
    
    Args:
        data: A dict with keys 'title', 'headers' (list),
              'rows' (JSON string of list of lists).
    
    Returns:
        The file path of the saved .xlsx file.
    
    When NOT to call: If data is not valid JSON or missing
    required keys, return an error message.
    NEVER call this for general conversation, greetings, or questions
    about how the system itself works."""
    try:
        if isinstance(data, str):
            data = json.loads(data)
        if not isinstance(data, dict):
            return "Error: spreadsheet data must be an object."
        title = data.get("title")
        headers = data.get("headers")
        rows = data.get("rows")
        if not isinstance(title, str) or not title.strip():
            return "Error: spreadsheet title is required."
        if not isinstance(headers, list) or not headers:
            return "Error: spreadsheet headers are required."
        if isinstance(rows, str):
            rows = json.loads(rows)
        if not isinstance(rows, list) or any(not isinstance(row, list) for row in rows):
            return "Error: spreadsheet rows must be a list of rows."
    except (json.JSONDecodeError, TypeError) as e:
        return f"Error parsing data: {e}"

    wb = Workbook()
    ws = wb.active
    ws.title = title[:31]  # Excel sheet name limit

    # Header row
    if headers:
        ws.append(headers)
        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
            cell.font = Font(bold=True, color="FFFFFF")

    # Data rows
    for row in rows:
        ws.append(row)

    filename = safe_filename(title, ".xlsx")
    filepath = OUTPUT_DIR / filename
    wb.save(str(filepath))
    return str(filepath)


@mcp.tool()
def read_xlsx(file_path: str) -> str:
    """Extract values from all worksheets in an existing XLSX file."""
    try:
        from openpyxl import load_workbook
        workbook = load_workbook(file_path, read_only=True, data_only=True)
        parts = []
        for sheet in workbook.worksheets:
            parts.append(f"[Sheet: {sheet.title}]")
            for row in sheet.iter_rows(values_only=True):
                values = ["" if value is None else str(value) for value in row]
                if any(values):
                    parts.append(" | ".join(values))
        return "\n".join(parts) or "No readable XLSX content found."
    except Exception as exc:
        return f"Error reading XLSX: {exc}"


if __name__ == "__main__":
    import os as _os
    _os.environ["FASTMCP_TRANSPORT"] = "stdio"
    mcp.run(transport="stdio")
