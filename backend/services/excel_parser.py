"""Excel parsing service for BOQ uploads."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import HTTPException, UploadFile

from ..models.responses import BoqUploadResponse
from .file_utils import save_upload_file, validate_extension

logger = logging.getLogger(__name__)

ALLOWED_EXCEL_EXTENSIONS = {".xlsx", ".xls"}


async def parse_excel_upload(file: UploadFile, upload_dir: Path) -> BoqUploadResponse:
    """Validate, save, and parse a BOQ spreadsheet upload."""
    validate_extension(file.filename, ALLOWED_EXCEL_EXTENSIONS)
    saved_path, _ = await save_upload_file(file, upload_dir)

    try:
        workbook = pd.read_excel(saved_path, sheet_name=None)
    except ValueError as exc:
        logger.warning("Invalid Excel file uploaded: %s", file.filename)
        raise HTTPException(status_code=400, detail="Invalid Excel file. Unable to read workbook.") from exc
    except ImportError as exc:
        logger.exception("Missing Excel parser dependency for file: %s", file.filename)
        raise HTTPException(status_code=500, detail="Excel parser dependency is not installed.") from exc
    except Exception as exc:
        logger.warning("Failed to parse Excel upload %s: %s", file.filename, exc)
        raise HTTPException(status_code=400, detail="Invalid Excel file. Please upload a valid .xlsx or .xls workbook.") from exc

    if not workbook:
        raise HTTPException(status_code=400, detail="Excel workbook does not contain any sheets.")

    first_sheet = next(iter(workbook.values()))
    column_names = [str(column) for column in first_sheet.columns]
    preview = _dataframe_preview(first_sheet)

    return BoqUploadResponse(
        filename=file.filename or saved_path.name,
        sheet_names=list(workbook.keys()),
        total_rows=int(first_sheet.shape[0]),
        total_columns=int(first_sheet.shape[1]),
        column_names=column_names,
        preview=preview,
    )


def _dataframe_preview(dataframe: pd.DataFrame) -> list[dict[str, Any]]:
    """Return the first 20 rows as JSON-safe dictionaries."""
    preview_frame = dataframe.head(20).where(pd.notnull(dataframe), None)
    return preview_frame.to_dict(orient="records")
