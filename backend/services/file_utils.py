"""Reusable upload validation and persistence helpers."""

from __future__ import annotations

import logging
import re
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1024 * 1024


def get_file_extension(filename: str | None) -> str:
    """Return the lowercase suffix for an uploaded filename."""
    if not filename:
        return ""
    return Path(filename).suffix.lower()


def validate_extension(filename: str | None, allowed_extensions: set[str]) -> str:
    """Validate and return the uploaded file extension."""
    extension = get_file_extension(filename)
    if not extension or extension not in allowed_extensions:
        allowed = ", ".join(sorted(allowed_extensions))
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed file types: {allowed}.")
    return extension


def sanitize_filename(filename: str | None) -> str:
    """Return a filesystem-safe filename while preserving the original suffix."""
    if not filename:
        return f"upload-{uuid4().hex}"

    source = Path(filename)
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", source.stem).strip("._")
    safe_stem = stem or "upload"
    return f"{safe_stem}-{uuid4().hex}{source.suffix.lower()}"


async def save_upload_file(file: UploadFile, upload_dir: Path) -> tuple[Path, int]:
    """Save an uploaded file and return its destination path and byte size."""
    upload_dir.mkdir(parents=True, exist_ok=True)
    destination = upload_dir / sanitize_filename(file.filename)
    size = 0

    try:
        with destination.open("wb") as buffer:
            while chunk := await file.read(CHUNK_SIZE):
                size += len(chunk)
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to save upload: %s", file.filename)
        raise HTTPException(status_code=500, detail="Failed to save uploaded file.") from exc
    finally:
        await file.close()

    if size == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    return destination, size
