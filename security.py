"""Local path and artifact safety helpers."""

import re
from pathlib import Path


def safe_filename(value: str, extension: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", (value or "artifact")).strip("._")
    stem = stem[:80] or "artifact"
    return f"{stem}{extension}"


def confined_path(value: str, root: Path) -> Path | None:
    """Return a resolved path only when it stays under the approved root."""
    try:
        candidate = Path(value).resolve()
        allowed = root.resolve()
        candidate.relative_to(allowed)
        return candidate
    except (OSError, ValueError):
        return None


def validate_upload(path: str, root: Path, allowed_extensions: set[str]) -> Path | None:
    """Accept files that are inside the approved root or a trusted project sibling root."""
    submitted = Path(path)
    candidates = []
    try:
        resolved = submitted.resolve()
        candidates.append(resolved)
    except OSError:
        resolved = None

    approved_root = root.resolve()
    trusted_roots = [approved_root]
    try:
        project_root = approved_root.parent.resolve()
        trusted_roots.append(project_root)
    except OSError:
        pass

    for base in trusted_roots:
        try:
            if resolved is not None and resolved.is_relative_to(base):
                candidate = resolved
                if candidate.suffix.lower() in allowed_extensions and candidate.is_file():
                    return candidate
        except AttributeError:
            pass

    return None