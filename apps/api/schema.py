"""Strict engine-neutral export contract; deliberately excludes gameplay metadata."""
from typing import Annotated, Literal
from pydantic import Field
from .models import Motion, Origin, StrictModel, Suggestions, Text


class Bounds(StrictModel):
    x: int = Field(ge=0,le=511)
    y: int = Field(ge=0,le=511)
    width: int = Field(gt=0,le=512)
    height: int = Field(gt=0,le=512)


class Sprite(StrictModel):
    file: Literal["sprite.png"]
    width: Literal[512]
    height: Literal[512]
    origin: Origin
    visual_bounds: Bounds


class Source(StrictModel):
    kind: Literal["user_photo","original_illustration_fixture"]
    source_object_label: Text


class AssetManifest(Suggestions):
    schema_version: Literal["1.3.0"]
    asset_id: str = Field(pattern=r"^ast_[a-f0-9]{32}$")
    style_id: Literal["storybook_toy_v1","manual_crop_v1"]
    sprite: Sprite
    animation_file: Literal["animations.json"]
    source: Source


class Keyframe(StrictModel):
    t_ms: int = Field(ge=0,le=10000)
    translate: list[Annotated[float,Field(ge=-64,le=64)]] = Field(min_length=2,max_length=2)
    scale: list[Annotated[float,Field(ge=.5,le=1.5)]] = Field(min_length=2,max_length=2)
    rotation_deg: float = Field(ge=-45,le=45)
    opacity: float = Field(ge=0,le=1)


class MotionState(StrictModel):
    kind: Literal["transform_timeline"]
    loop: bool
    duration_ms: int = Field(gt=0,le=10000)
    keyframes: list[Keyframe] = Field(min_length=2,max_length=32)


class Animations(StrictModel):
    schema_version: Literal["1.3.0"]
    states: dict[Motion,MotionState] = Field(max_length=3)
