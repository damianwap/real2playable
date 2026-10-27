"""SAM output semantics: real wire grammar, pixel placement and honest errors."""
import asyncio
import base64

import pytest
from PIL import Image

from apps.api import meta
from apps.api.models import APIError
from apps.api.compiler import image_bytes

# One complete public wire example from Meta's segmentation protocol documentation.
WIRE_MASK = (
    "<0f>0<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|>"
    "<|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>"
)


def test_box_local_mask_keeps_pixel_coordinates_and_source_transparency(monkeypatch):
    async def provider_response(_body):
        return {"output": [{"type": "message", "content": [{"type": "output_text", "text": WIRE_MASK}]}]}

    monkeypatch.setattr(meta, "responses", provider_response)
    image = Image.new("RGBA", (320, 334), (10, 20, 30, 255))
    image.putpixel((217, 228), (10, 20, 30, 0))
    cutout, _stage = asyncio.run(meta.segment(image, "button"))

    assert cutout.size == image.size
    assert cutout.getpixel((216, 228)) == (10, 20, 30, 255)
    assert cutout.getpixel((217, 228))[3] == 0
    assert cutout.getpixel((211, 228))[3] == 0
    assert cutout.getpixel((0, 0))[3] == 0
    assert cutout.getpixel((271, 255))[3] == 0


def test_background_complement_removes_background_and_preserves_existing_alpha(monkeypatch):
    async def provider_response(_body):
        return {"output": [{"type": "message", "content": [{"type": "output_text", "text": WIRE_MASK}]}]}

    monkeypatch.setattr(meta, "responses", provider_response)
    image = Image.new("RGBA", (320, 334), (10, 20, 30, 255))
    image.putpixel((217, 228), (10, 20, 30, 0))
    cutout, _stage = asyncio.run(meta.segment(image, "background", invert_mask=True))
    assert cutout.getpixel((216, 228))[3] == 0
    assert cutout.getpixel((217, 228))[3] == 0
    assert cutout.getpixel((0, 0)) == (10, 20, 30, 255)


def test_nonempty_nonsegmentation_output_is_not_reported_as_missing_object(monkeypatch):
    async def provider_response(_body):
        return {"output": [{"type": "message", "content": [{"type": "output_text", "text": "The service did not produce a segmentation record."}]}]}

    monkeypatch.setattr(meta, "responses", provider_response)
    with pytest.raises(APIError) as error:
        asyncio.run(meta.segment(Image.new("RGBA", (32, 32), "white"), "mug"))
    assert error.value.code == "SAM_INVALID_MASK"


def test_empty_sam_output_remains_an_explicit_no_match(monkeypatch):
    async def provider_response(_body):
        return {"output": [{"type": "message", "content": [{"type": "output_text", "text": ""}]}]}

    monkeypatch.setattr(meta, "responses", provider_response)
    with pytest.raises(APIError) as error:
        asyncio.run(meta.segment(Image.new("RGBA", (32, 32), "white"), "mug"))
    assert error.value.code == "SAM_NO_MATCH"


def test_generated_artwork_mask_failure_is_not_a_source_selection_error(monkeypatch):
    rendered = Image.new("RGBA", (320, 334), "white")
    replies = iter([
        {"output": [{"type": "image_generation_call", "status": "completed", "result": base64.b64encode(image_bytes(rendered)).decode("ascii")}]},
        {"output": [{"type": "message", "content": [{"type": "output_text", "text": ""}]}]},
    ])

    async def provider_response(_body):
        return next(replies)

    monkeypatch.setattr(meta, "responses", provider_response)
    with pytest.raises(APIError) as error:
        asyncio.run(meta.stylize(rendered, "money"))
    assert error.value.code == "OUTPUT_ALPHA_NO_MASK"
    assert error.value.status == 502


def test_generated_background_mask_is_rejected_instead_of_exported(monkeypatch):
    rendered = Image.new("RGBA", (320, 334), "white")

    async def provider_response(_body):
        return {"output": [{"type": "image_generation_call", "status": "completed", "result": base64.b64encode(image_bytes(rendered)).decode("ascii")}]}

    async def background_mask(image, _label, **_prompts):
        background = image.copy()
        background.putpixel((image.width // 2, image.height // 2), (255, 255, 255, 0))
        return background, {"name": "sam_selection", "mode": "live"}

    monkeypatch.setattr(meta, "responses", provider_response)
    monkeypatch.setattr(meta, "segment", background_mask)
    with pytest.raises(APIError) as error:
        asyncio.run(meta.stylize(rendered, "money"))
    assert error.value.code == "OUTPUT_ALPHA_INVALID"
    assert error.value.status == 502


def test_generated_edge_fragments_are_removed_without_clipping_center_subject(monkeypatch):
    rendered = Image.new("RGBA", (100, 100), "white")

    async def provider_response(_body):
        return {"output": [{"type": "image_generation_call", "status": "completed", "result": base64.b64encode(image_bytes(rendered)).decode("ascii")}]}

    async def mask_with_edge_fragments(image, _label, **_prompts):
        alpha = Image.new("L", image.size)
        alpha.paste(255, (30, 30, 71, 71))
        alpha.paste(255, (0, 0, 100, 1))
        alpha.paste(255, (0, 99, 100, 100))
        alpha.putpixel((10, 10), 255)
        candidate = image.copy()
        candidate.putalpha(alpha)
        return candidate, {"name": "sam_selection", "mode": "live"}

    monkeypatch.setattr(meta, "responses", provider_response)
    monkeypatch.setattr(meta, "segment", mask_with_edge_fragments)
    cutout, _stages = asyncio.run(meta.stylize(rendered, "money"))
    assert cutout.getchannel("A").getbbox() == (30, 30, 71, 71)
    assert cutout.getpixel((50, 50))[3] == 255
    assert cutout.getpixel((10, 10))[3] == 0
    assert cutout.getpixel((0, 0))[3] == 0
