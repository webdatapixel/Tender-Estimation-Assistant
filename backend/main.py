"""FastAPI entrypoint for the Tender & Estimation Assistant backend."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .models.responses import BoqUploadResponse, CadDwgUploadResponse, CadDxfUploadResponse
from .services.cad_parser import parse_cad_upload
from .services.excel_parser import parse_excel_upload

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Tender & Estimation Assistant API",
    version="1.0",
    description="Backend API for parsing BOQ spreadsheets and CAD drawings.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
def health_check() -> dict[str, str]:
    """Return API health status."""
    return {
        "status": "running",
        "service": "Tender & Estimation Assistant API",
        "version": "1.0",
    }


@app.post("/upload-boq", response_model=BoqUploadResponse, tags=["BOQ"])
async def upload_boq(file: UploadFile = File(...)) -> BoqUploadResponse:
    """Upload and parse a BOQ Excel file."""
    try:
        return await parse_excel_upload(file=file, upload_dir=UPLOAD_DIR)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected error while processing BOQ upload: %s", file.filename)
        raise HTTPException(status_code=500, detail="Unexpected error while processing BOQ upload.") from exc


@app.post(
    "/upload-cad",
    response_model=CadDxfUploadResponse | CadDwgUploadResponse,
    tags=["CAD"],
)
async def upload_cad(file: UploadFile = File(...)) -> CadDxfUploadResponse | CadDwgUploadResponse:
    """Upload and parse a CAD drawing file."""
    try:
        return await parse_cad_upload(file=file, upload_dir=UPLOAD_DIR)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected error while processing CAD upload: %s", file.filename)
        raise HTTPException(status_code=500, detail="Unexpected error while processing CAD upload.") from exc
