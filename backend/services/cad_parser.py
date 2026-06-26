"""CAD parsing service for DXF and DWG uploads."""

from __future__ import annotations

import logging
from collections import Counter
from pathlib import Path

import ezdxf
from ezdxf.lldxf.const import DXFError
from fastapi import HTTPException, UploadFile

from ..models.responses import CadDwgUploadResponse, CadDxfUploadResponse
from .file_utils import save_upload_file, validate_extension

logger = logging.getLogger(__name__)

ALLOWED_CAD_EXTENSIONS = {".dxf", ".dwg"}


async def parse_cad_upload(file: UploadFile, upload_dir: Path) -> CadDxfUploadResponse | CadDwgUploadResponse:
    """Validate, save, and parse a CAD drawing upload."""
    extension = validate_extension(file.filename, ALLOWED_CAD_EXTENSIONS)
    saved_path, _ = await save_upload_file(file, upload_dir)

    if extension == ".dwg":
        return CadDwgUploadResponse(
            status="accepted",
            message="DWG uploaded successfully. Convert to DXF for parsing or integrate a DWG parser later.",
        )

    return _parse_dxf_file(saved_path=saved_path, filename=file.filename or saved_path.name)


def _parse_dxf_file(saved_path: Path, filename: str) -> CadDxfUploadResponse:
    """Extract summary data from a DXF file."""
    try:
        document = ezdxf.readfile(saved_path)
    except (OSError, DXFError) as exc:
        logger.warning("Invalid DXF file uploaded: %s", filename)
        raise HTTPException(status_code=400, detail="Invalid DXF file. Unable to parse drawing.") from exc
    except Exception as exc:
        logger.exception("Unexpected DXF parsing error for file: %s", filename)
        raise HTTPException(status_code=500, detail="Unexpected error while parsing DXF file.") from exc

    modelspace = document.modelspace()
    entity_counter: Counter[str] = Counter()
    text_values: list[str] = []

    for entity in modelspace:
        entity_type = entity.dxftype()
        entity_counter[entity_type] += 1

        if entity_type in {"TEXT", "MTEXT"}:
            text_content = _extract_text(entity)
            if text_content:
                text_values.append(text_content)

    layers = sorted(layer.dxf.name for layer in document.layers)
    blocks = sorted(block.name for block in document.blocks)

    return CadDxfUploadResponse(
        filename=filename,
        cad_version=document.dxfversion,
        layers=layers,
        blocks=blocks,
        entity_count=sum(entity_counter.values()),
        entity_types=dict(sorted(entity_counter.items())),
        text=text_values,
    )


def _extract_text(entity: object) -> str:
    """Extract text from supported ezdxf text entities."""
    try:
        if hasattr(entity, "plain_text"):
            return str(entity.plain_text()).strip()
        return str(entity.dxf.text).strip()
    except Exception:
        logger.debug("Unable to extract text from DXF entity", exc_info=True)
        return ""
