"""Public request and exported data validation, independent of model output."""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

VERSION = "1.3.0"
Motion = Literal["idle_bob", "interact_pulse", "impact_flash"]
AssetType = Literal["character", "prop", "item", "environment", "ui"]
Text = Annotated[str, Field(min_length=1, max_length=80)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


    @field_validator("label", check_fields=False)
    @classmethod
    def valid_label(cls, value):
        if value is None:
            return value
        if not value.strip() or any(ord(c) < 32 for c in value):
            raise ValueError("Label must be nonblank and contain no control characters")
        return value

class Origin(StrictModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class Box(StrictModel):
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    width: float = Field(gt=0)
    height: float = Field(gt=0)


class SelectionRequest(StrictModel):
    method: Literal["manual_box", "sam", "sam_auto"]
    label: Text | None = None
    box: Box | None = None


class SuggestRequest(StrictModel):
    box: Box | None = None


class GenerateRequest(StrictModel):
    upload_id: str = Field(pattern=r"^upl_[a-f0-9]{32}$")
    selection_id: str = Field(pattern=r"^sel_[a-f0-9]{32}$")
    label: Text
    mode: Literal["live", "manual"]
    consent: bool


class Suggestions(StrictModel):
    name: Text
    asset_type: AssetType
    tags: list[Annotated[str, Field(min_length=1, max_length=32)]] = Field(max_length=12)

    @field_validator("name", "tags")
    @classmethod
    def nonblank(cls, value):
        values = value if isinstance(value, list) else [value]
        if any(not item.strip() or any(ord(c) < 32 for c in item) for item in values):
            raise ValueError("Text must be nonblank and contain no control characters")
        return value


class AssetPatch(StrictModel):
    name: Text | None = None
    asset_type: AssetType | None = None
    tags: list[Annotated[str, Field(min_length=1, max_length=32)]] | None = Field(default=None, max_length=12)
    origin: Origin | None = None
    motions: list[Motion] | None = Field(default=None, max_length=3)

    @field_validator("name", "tags")
    @classmethod
    def nonblank(cls, value):
        if value is not None:
            Suggestions.nonblank(value)
        return value

    @field_validator("motions")
    @classmethod
    def unique(cls, value):
        if value is not None and len(set(value)) != len(value):
            raise ValueError("Motion choices must be unique")
        return value


class APIError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        self.code, self.message, self.status = code, message, status
        super().__init__(message)
