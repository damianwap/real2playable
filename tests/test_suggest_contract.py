"""Vision label suggestion and auto-detect contract; no live provider calls."""
import asyncio
import base64
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from apps.api import meta
from apps.api.app import create_app
from apps.api.models import APIError

# Same public wire example as tests/test_sam_contract.py, kept local so files run alone.
WIRE_MASK = (
    "<0f>0<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|>"
    "<|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>"
)


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    with TestClient(create_app(tmp_path / "private")) as session:
        yield session


def png(size=(180, 120)):
    image = Image.new("RGB", size, "#dd9988")
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


def upload(client):
    return client.post(
        "/api/v1/uploads", files={"file": ("photo.png", png(), "image/png")}
    ).json()


def test_suggest_requires_key(client):
    uploaded = upload(client)
    reply = client.post(f"/api/v1/uploads/{uploaded['upload_id']}/suggest")
    assert reply.status_code == 503
    assert reply.json()["detail"]["code"] == "MODEL_UNAVAILABLE"


def test_suggest_needs_no_consent(client, monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "wire-format-only")

    async def provider_response(_body):
        return {
            "output": [
                {
                    "type": "message",
                    "content": [{"type": "output_text", "text": "mug"}],
                }
            ]
        }

    monkeypatch.setattr(meta, "responses", provider_response)
    uploaded = upload(client)
    reply = client.post(f"/api/v1/uploads/{uploaded['upload_id']}/suggest")
    assert reply.status_code == 200, reply.text
    assert reply.json()["label"] == "mug"


def test_suggest_rejects_unknown_upload(client, monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "consent-check-only")
    missing = client.post(f"/api/v1/uploads/{'upl_' + '0' * 32}/suggest")
    assert missing.status_code == 404
    malformed = client.post("/api/v1/uploads/nope/suggest")
    assert malformed.status_code == 400


def test_auto_selection_requires_key(client):
    uploaded = upload(client)
    url = f"/api/v1/uploads/{uploaded['upload_id']}/selection"
    without_key = client.post(url, json={"method": "sam_auto"})
    assert without_key.status_code == 503
    assert without_key.json()["detail"]["code"] == "MODEL_UNAVAILABLE"


def test_manual_and_sam_selection_still_require_label(client):
    uploaded = upload(client)
    url = f"/api/v1/uploads/{uploaded['upload_id']}/selection"
    manual = client.post(url, json={"method": "manual_box"})
    assert manual.status_code == 422
    assert manual.json()["detail"]["code"] == "LABEL_REQUIRED"
    sam = client.post(url, json={"method": "sam"})
    assert sam.status_code == 422
    assert sam.json()["detail"]["code"] == "LABEL_REQUIRED"
    unknown = client.post(url, json={"method": "teleport", "label": "object"})
    assert unknown.status_code == 422


def test_clean_label_strips_quotes_and_collapses_whitespace():
    assert meta.clean_label('  "A  potted\ncactus."  ') == "A potted cactus"


def test_clean_label_removes_control_characters():
    assert meta.clean_label("mu\x00g\x1f") == "mug"


def test_clean_label_truncates_at_word_boundary():
    label = meta.clean_label(" ".join(["word"] * 30))
    assert label == " ".join(["word"] * 16)
    assert len(label) <= 80


def test_clean_label_empty_for_punctuation_only():
    assert meta.clean_label('... " " ...') == ""


def test_suggest_label_cleans_provider_text(monkeypatch):
    async def provider_response(_body):
        return {
            "output": [
                {
                    "type": "message",
                    "content": [
                        {"type": "output_text", "text": '  "A potted cactus."\n'}
                    ],
                }
            ]
        }

    monkeypatch.setattr(meta, "responses", provider_response)
    label, stage = asyncio.run(
        meta.suggest_label(Image.new("RGBA", (32, 32), "white"))
    )
    assert label == "A potted cactus"
    assert stage["name"] == "vision_label_suggestion"
    assert stage["model"] == "muse-spark-1.3"
    assert stage["success"] is True


def test_suggest_label_empty_output_is_an_explicit_error(monkeypatch):
    async def provider_response(_body):
        return {
            "output": [
                {
                    "type": "message",
                    "content": [{"type": "output_text", "text": "..."}],
                }
            ]
        }

    monkeypatch.setattr(meta, "responses", provider_response)
    with pytest.raises(APIError) as error:
        asyncio.run(meta.suggest_label(Image.new("RGBA", (32, 32), "white")))
    assert error.value.code == "VISION_EMPTY_LABEL"
    assert error.value.status == 502


def test_suggest_returns_cleaned_label_with_canned_wire(monkeypatch, client):
    monkeypatch.setenv("MODEL_API_KEY", "wire-format-only")

    async def provider_response(_body):
        return {
            "output": [
                {
                    "type": "message",
                    "content": [{"type": "output_text", "text": "\n Sunday mug!\n"}],
                }
            ]
        }

    monkeypatch.setattr(meta, "responses", provider_response)
    uploaded = upload(client)
    reply = client.post(f"/api/v1/uploads/{uploaded['upload_id']}/suggest")
    assert reply.status_code == 200, reply.text
    body = reply.json()
    assert body["label"] == "Sunday mug"
    assert body["stages"][0]["name"] == "vision_label_suggestion"


def test_auto_selection_suggests_label_then_segments_with_canned_wire(
    monkeypatch, client
):
    monkeypatch.setenv("MODEL_API_KEY", "wire-format-only")
    replies = iter(
        [
            {
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {"type": "output_text", "text": ' "Potted cactus." '}
                        ],
                    }
                ]
            },
            {
                "output": [
                    {
                        "type": "message",
                        "content": [{"type": "output_text", "text": WIRE_MASK}],
                    }
                ]
            },
        ]
    )

    async def provider_response(_body):
        return next(replies)

    monkeypatch.setattr(meta, "responses", provider_response)
    uploaded = client.post(
        "/api/v1/uploads",
        files={"file": ("photo.png", png((320, 334)), "image/png")},
    ).json()
    response = client.post(
        f"/api/v1/uploads/{uploaded['upload_id']}/selection",
        json={"method": "sam_auto"},
    )
    assert response.status_code == 200, response.text
    selection = response.json()
    assert selection["suggested_label"] == "Potted cactus"
    assert selection["method"] == "sam_auto"
    assert selection["mode"] == "live"
    assert [stage["name"] for stage in selection["stages"]] == [
        "vision_label_suggestion",
        "sam_selection",
    ]
    assert client.get(selection["preview_url"]).status_code == 200
    assert client.get(selection["mask_url"]).status_code == 200


def test_suggest_reads_boxed_crop_not_full_photo(monkeypatch, client):
    monkeypatch.setenv("MODEL_API_KEY", "wire-format-only")
    seen = {}

    async def provider_response(body):
        seen.update(body)
        return {
            "output": [
                {
                    "type": "message",
                    "content": [{"type": "output_text", "text": "mug"}],
                }
            ]
        }

    monkeypatch.setattr(meta, "responses", provider_response)
    uploaded = upload(client)
    reply = client.post(
        f"/api/v1/uploads/{uploaded['upload_id']}/suggest",
        json={"box": {"x": 10, "y": 10, "width": 100, "height": 60}},
    )
    assert reply.status_code == 200, reply.text
    assert reply.json()["label"] == "mug"
    content = seen["input"][1]["content"]
    image_part = next(p for p in content if p["type"] == "input_image")
    raw = base64.b64decode(image_part["image_url"].split(",", 1)[1])
    with Image.open(io.BytesIO(raw)) as sent:
        assert sent.size == (100, 60)


def test_suggest_rejects_box_outside_photo(client, monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "wire-format-only")
    uploaded = upload(client)
    reply = client.post(
        f"/api/v1/uploads/{uploaded['upload_id']}/suggest",
        json={"box": {"x": 150, "y": 0, "width": 100, "height": 20}},
    )
    assert reply.status_code == 422
    assert reply.json()["detail"]["code"] == "INVALID_BOX"
