"""Consumer-visible contract/security tests; no credentials or provider mocks required."""
import hashlib
import io
import json
import time
import zipfile
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from apps.api.app import create_app


@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.delenv("MODEL_API_KEY",raising=False)
    with TestClient(create_app(tmp_path/"private")) as session:
        yield session


def png(size=(180,120)):
    image=Image.new("RGB",size,"#dd9988")
    buffer=io.BytesIO();image.save(buffer,"PNG")
    return buffer.getvalue()


def test_original_fixture_exports_independent_valid_package(client):
    sample = "cactus"
    response=client.post(f"/api/v1/samples/{sample}/load")
    assert response.status_code==200
    asset=response.json();id_=asset["asset_id"]
    assert asset["mode"]=="fixture"
    assert asset["asset"]["source"]["kind"]=="original_illustration_fixture"
    assert all(stage["provider"]!="Meta" for stage in asset["stages"])
    compiled=client.post(f"/api/v1/assets/{id_}/compile")
    assert compiled.status_code==200
    assert compiled.json()["checks"]["checksums_after_reopen"] is True
    downloaded=client.get(compiled.json()["download_url"])
    with zipfile.ZipFile(io.BytesIO(downloaded.content)) as archive:
        manifest=json.loads(archive.read("manifest.json"))
        assert manifest["source_photo_included"] is False
        assert "source.png" not in archive.namelist()
        assert set(archive.namelist())=={item["path"] for item in manifest["files"]}|{"manifest.json"}
        for item in manifest["files"]:
            data=archive.read(item["path"])
            assert hashlib.sha256(data).hexdigest()==item["sha256"]
            assert len(data)==item["bytes"]
        with Image.open(io.BytesIO(archive.read("sprite.png"))) as sprite:
            assert sprite.mode=="RGBA" and sprite.size==(512,512)
            alpha=sprite.getchannel("A")
            assert alpha.getbbox() is not None and alpha.getpixel((0,0))==0
        frames=json.loads(archive.read("atlas/frames.json"))
        assert len(frames["frames"])==4
        assert all(frame["pivot"]==asset["asset"]["sprite"]["origin"] for frame in frames["frames"])
        assert frames["kind"]=="procedural_motion_frames"
        timestamps = [frame["t_ms"] for frame in frames["frames"]]
        assert timestamps[0] == 0 and timestamps[-1] == frames["duration_ms"]
        assert all(a < b for a, b in zip(timestamps, timestamps[1:]))
        assert not any(word in json.dumps(json.loads(archive.read("asset.json"))) for word in ('"attack"','"rarity"','"lore"'))
    assert client.post("/api/v1/playground/validate",files={"file":("asset.zip",downloaded.content,"application/zip")}).json()["valid"] is True
    assert client.patch(f"/api/v1/assets/{id_}",json={"motions":[]}).status_code==200
    with zipfile.ZipFile(io.BytesIO(client.get(f"/api/v1/assets/{id_}/export").content)) as archive:
        assert not any(name.startswith("atlas/") for name in archive.namelist())
        assert json.loads(archive.read("animations.json"))["states"]=={}


def test_manual_crop_review_job_and_private_deletion(client):
    uploaded=client.post("/api/v1/uploads",files={"file":("private.png",png(),"image/png")}).json()
    selection=client.post(f"/api/v1/uploads/{uploaded['upload_id']}/selection",json={"method":"manual_box","label":"peach object","box":{"x":20,"y":10,"width":70,"height":80}})
    assert selection.status_code==200
    selected=selection.json()
    assert selected["mode"]=="fallback" and selected["method"]=="manual_box"
    body={"upload_id":uploaded["upload_id"],"selection_id":selected["selection_id"],"label":"peach object","mode":"manual","consent":False}
    assert client.post("/api/v1/assets/generate",json=body).json()["detail"]["code"]=="REVIEW_REQUIRED"
    body["consent"]=True
    queued=client.post("/api/v1/assets/generate",json=body)
    assert queued.status_code==202
    for _ in range(100):
        job=client.get(f"/api/v1/jobs/{queued.json()['job_id']}").json()
        if job["status"] in ("completed","failed"): break
        time.sleep(.01)
    assert job["status"]=="completed",job
    result=job["result"]
    assert result["mode"]=="fallback" and result["asset"]["style_id"]=="manual_crop_v1"
    assert client.post(f"/api/v1/assets/{result['asset_id']}/compile").status_code==200
    assert client.delete(f"/api/v1/assets/{result['asset_id']}").status_code==204
    assert client.get(result["preview_url"]).status_code==404
    assert client.get(uploaded["preview_url"]).status_code==404
    assert client.get(selected["preview_url"]).status_code==404
    assert client.get(f"/api/v1/jobs/{queued.json()['job_id']}").status_code==404


def test_input_and_model_boundary_errors_are_honest(client):
    assert client.post("/api/v1/uploads",files={"file":("spoof.jpg",png(),"image/jpeg")}).status_code==415
    assert client.post("/api/v1/uploads",files={"file":("broken.png",b"not an image","image/png")}).status_code==415
    uploaded=client.post("/api/v1/uploads",files={"file":("valid.png",png(),"image/png")}).json()
    url=f"/api/v1/uploads/{uploaded['upload_id']}/selection"
    outside=client.post(url,json={"method":"manual_box","label":"object","box":{"x":170,"y":0,"width":30,"height":20}})
    assert outside.status_code==422 and outside.json()["detail"]["code"]=="INVALID_BOX"
    sam=client.post(url,json={"method":"sam","label":"object"})
    assert sam.status_code==503 and sam.json()["detail"]["code"]=="MODEL_UNAVAILABLE"
    fixture=client.post("/api/v1/samples/cactus/load").json()
    assert client.patch(f"/api/v1/assets/{fixture['asset_id']}",json={"origin":{"x":2,"y":.5}}).status_code==422
    assert client.patch(f"/api/v1/assets/{fixture['asset_id']}",json={"motions":["unknown"]}).status_code==422
    assert client.patch(f"/api/v1/assets/{fixture['asset_id']}",json={"attack":50}).status_code==422
    assert client.get(f"/api/v1/files/{fixture['asset_id']}/private.sqlite3").status_code==404
    assert client.post("/api/v1/samples/cactus/load",headers={"Origin":"https://evil.example"}).status_code==403


def test_zip_validation_rejects_corruption_and_traversal(client):
    fixture=client.post("/api/v1/samples/mug/load").json()
    payload=client.get(f"/api/v1/assets/{fixture['asset_id']}/export").content
    for malicious in (False,True):
        result=io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(payload)) as original,zipfile.ZipFile(result,"w") as edited:
            for item in original.infolist():
                data=original.read(item.filename)
                edited.writestr(item.filename,b"tampered" if item.filename=="sprite.png" and not malicious else data)
            if malicious: edited.writestr("../outside.txt","unsafe")
        reply=client.post("/api/v1/playground/validate",files={"file":("bad.zip",result.getvalue(),"application/zip")})
        assert reply.status_code==422 and reply.json()["detail"]["code"]=="INVALID_PACKAGE"


def test_sam_requires_explicit_provider_consent(client, monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "consent-check-only")
    uploaded = client.post("/api/v1/uploads", files={"file": ("photo.png", png(), "image/png")}).json()
    response = client.post(
        f"/api/v1/uploads/{uploaded['upload_id']}/selection",
        json={"method": "sam", "label": "object", "consent": False},
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "CONSENT_REQUIRED"
