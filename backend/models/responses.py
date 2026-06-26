"""Response schemas for API endpoints."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class BoqUploadResponse(BaseModel):
    """Response returned after a BOQ spreadsheet is parsed."""

    filename: str
    sheet_names: list[str]
    total_rows: int
    total_columns: int
    column_names: list[str]
    preview: list[dict[str, Any]]


class CadDxfUploadResponse(BaseModel):
    """Response returned after a DXF drawing is parsed."""

    filename: str
    cad_version: str
    layers: list[str]
    blocks: list[str]
    entity_count: int
    entity_types: dict[str, int] = Field(default_factory=dict)
    text: list[str] = Field(default_factory=list)


class CadDwgUploadResponse(BaseModel):
    """Response returned after a DWG drawing is accepted."""

    status: Literal["accepted"]
    message: str
