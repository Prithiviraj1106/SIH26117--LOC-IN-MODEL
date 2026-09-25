"""Validation helpers for generated local artifacts."""

from pathlib import Path
from zipfile import BadZipFile, ZipFile


def validate_artifact(result: str, extension: str) -> tuple[bool, str]:
    if not result or result.startswith("Error") or result.startswith("Approval required"):
        return False, result or "No artifact path returned."
    path = Path(result.strip())
    if path.suffix.lower() != extension or not path.is_file():
        return False, f"Generated artifact is missing or has the wrong type: {result}"
    try:
        with ZipFile(path) as archive:
            if archive.testzip() is not None:
                return False, f"Generated artifact is corrupt: {path}"
    except BadZipFile:
        return False, f"Generated artifact is not a valid {extension} file: {path}"
    return True, str(path)