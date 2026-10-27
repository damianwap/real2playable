"""Deterministic RGBA normalization, transform timelines and verifiable ZIP output."""
import hashlib
import io
import json
import math
import mimetypes
import zipfile
from datetime import datetime, timezone
from pathlib import PurePosixPath
from PIL import Image, ImageChops, ImageDraw, ImageOps, UnidentifiedImageError
from .models import APIError, Suggestions, VERSION
from .schema import Animations, AssetManifest

MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 24_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
MOTIONS = ("idle_bob", "interact_pulse", "impact_flash")


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2).encode("utf-8")


def image_bytes(image, format="PNG"):
    out = io.BytesIO()
    image.save(out, format=format)
    return out.getvalue()


def decode_image(data: bytes, declared_mime: str | None = None) -> Image.Image:
    if len(data) > MAX_BYTES:
        raise APIError("UPLOAD_TOO_LARGE", "Images must be at most 10 MB.", 413)
    try:
        with Image.open(io.BytesIO(data)) as opened:
            actual = {"PNG":"image/png", "JPEG":"image/jpeg", "WEBP":"image/webp"}.get(opened.format)
            if actual is None or (declared_mime is not None and declared_mime != actual):
                raise APIError("INVALID_IMAGE_TYPE", "Only correctly declared PNG, JPEG and WebP images are accepted.", 415)
            if opened.width * opened.height > MAX_PIXELS:
                raise APIError("IMAGE_TOO_LARGE", "Image dimensions must not exceed 24 megapixels.", 413)
            if getattr(opened, "n_frames", 1) != 1:
                raise APIError("ANIMATED_INPUT", "Upload a single still image, not an animated file.", 415)
            opened.load()
            image = ImageOps.exif_transpose(opened).convert("RGBA")
            # Reconstruct pixels without EXIF, ICC profiles, comments or original filenames.
            return Image.frombytes("RGBA", image.size, image.tobytes())
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise APIError("INVALID_IMAGE", "Image content could not be safely decoded.", 415) from exc


def retain_center_component(image: Image.Image):
    """Keep the centered subject in-place; discard disconnected alpha debris."""
    alpha=image.getchannel("A")
    center=(image.width//2,image.height//2)
    if alpha.getpixel(center)==0:
        raise APIError("OUTPUT_ALPHA_INVALID","SAM removed the center of the generated subject; no invalid sprite was exported.",502)
    component=alpha.point(lambda value:255 if value else 0)
    ImageDraw.floodfill(component,center,128)
    component=component.point(lambda value:255 if value==128 else 0)
    cleaned=ImageChops.multiply(alpha,component)
    corners=((0,0),(image.width-1,0),(0,image.height-1),(image.width-1,image.height-1))
    if any(cleaned.getpixel(corner)!=0 for corner in corners):
        raise APIError("OUTPUT_ALPHA_INVALID","The generated subject is still connected to the canvas background; no invalid sprite was exported.",502)
    image.putalpha(cleaned)


def normalize(image: Image.Image):
    image = image.convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise APIError("EMPTY_ALPHA", "The selected image contains no visible pixels.", 422)
    content = image.crop(bounds)
    content.thumbnail((416,416), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (512,512))
    result.alpha_composite(content, ((512-content.width)//2, 464-content.height))
    bbox = result.getchannel("A").getbbox()
    return result, {"x":bbox[0], "y":bbox[1], "width":bbox[2]-bbox[0], "height":bbox[3]-bbox[1]}


def keyframe(t, translate=(0,0), scale=(1,1), rotation=0, opacity=1):
    return {"t_ms":t,"translate":list(translate),"scale":list(scale),"rotation_deg":rotation,"opacity":opacity}


def timelines(motions):
    templates = {
        "idle_bob": {"kind":"transform_timeline", "loop":True, "duration_ms":1600, "keyframes":[keyframe(0),keyframe(400,(0,-8),rotation=-2),keyframe(800,(0,0)),keyframe(1200,(0,-5),rotation=2),keyframe(1600)]},
        "interact_pulse": {"kind":"transform_timeline", "loop":True, "duration_ms":1000, "keyframes":[keyframe(0),keyframe(250,scale=(1.06,.94)),keyframe(500,scale=(.96,1.04)),keyframe(750,scale=(1.02,.98)),keyframe(1000)]},
        "impact_flash": {"kind":"transform_timeline", "loop":False, "duration_ms":600, "keyframes":[keyframe(0),keyframe(150,(-5,0),rotation=-3,opacity=.35),keyframe(300,(5,0),rotation=3),keyframe(450,opacity=.5),keyframe(600)]},
    }
    return {"schema_version":VERSION, "states":{name:templates[name] for name in motions}}


def evaluate(state, t):
    keys=state["keyframes"]
    for a,b in zip(keys,keys[1:]):
        if t <= b["t_ms"]:
            f=(t-a["t_ms"])/(b["t_ms"]-a["t_ms"])
            result={"t_ms":t}
            for key in ("translate","scale","rotation_deg","opacity"):
                result[key]=[x+(y-x)*f for x,y in zip(a[key],b[key])] if isinstance(a[key],list) else a[key]+(b[key]-a[key])*f
            return result
    return keys[-1]


def atlas(sprite, animations, origin):
    name,state=next(iter(animations["states"].items()))
    sheet=Image.new("RGBA",(2048,512))
    records=[]
    ax,ay=origin["x"]*512,origin["y"]*512
    for i in range(4):
        t=round(state["duration_ms"]*i/3)
        value=evaluate(state,t)
        sx,sy=value["scale"]
        angle=math.radians(value["rotation_deg"])
        c,s=math.cos(angle),math.sin(angle)
        tx,ty=value["translate"]
        # Inverse affine: rotate/scale around the declared canvas anchor.
        a,b=c/sx,s/sx
        dd,e=-s/sy,c/sy
        coeff=(a,b,ax-a*(ax+tx)-b*(ay+ty),dd,e,ay-dd*(ax+tx)-e*(ay+ty))
        frame=sprite.transform((512,512),Image.Transform.AFFINE,coeff,Image.Resampling.BICUBIC)
        frame.putalpha(frame.getchannel("A").point(lambda n:round(n*value["opacity"])))
        sheet.alpha_composite(frame,(i*512,0))
        records.append({"frame":{"x":i*512,"y":0,"w":512,"h":512},"offset":{"x":0,"y":0},"pivot":origin,"t_ms":t})
    return image_bytes(sheet), {"schema_version":VERSION,"kind":"procedural_motion_frames","image":"atlas/spritesheet.png","motion":name,"duration_ms":state["duration_ms"],"frames":records}


def validate_core(asset, animations, sprite):
    AssetManifest.model_validate(asset)
    Animations.model_validate(animations)
    if asset.get("schema_version") != VERSION or animations.get("schema_version") != VERSION:
        raise APIError("INVALID_SCHEMA", "Unsupported package schema version.", 422)
    Suggestions.model_validate({key:asset[key] for key in ("name","asset_type","tags")})
    spec=asset["sprite"]
    if sprite.mode != "RGBA" or sprite.size != (512,512) or not sprite.getchannel("A").getbbox():
        raise APIError("INVALID_SPRITE", "Sprite must be nonempty 512×512 RGBA.", 422)
    box=sprite.getchannel("A").getbbox()
    expected={"x":box[0],"y":box[1],"width":box[2]-box[0],"height":box[3]-box[1]}
    if spec["file"] != "sprite.png" or spec["width"] != 512 or spec["height"] != 512 or spec["visual_bounds"] != expected:
        raise APIError("INVALID_BOUNDS", "Sprite metadata does not match pixels.", 422)
    if any(not isinstance(spec["origin"][axis],(float,int)) or not math.isfinite(spec["origin"][axis]) or not 0 <= spec["origin"][axis] <= 1 for axis in ("x","y")):
        raise APIError("INVALID_ORIGIN", "Origin must be normalized to 0–1.", 422)
    if asset["animation_file"] != "animations.json":
        raise APIError("INVALID_REFERENCE", "Animation file reference is invalid.", 422)
    for name,state in animations["states"].items():
        if name not in MOTIONS or state["kind"] != "transform_timeline" or not 0 < state["duration_ms"] <= 10000 or type(state["loop"]) is not bool:
            raise APIError("INVALID_TIMELINE", "Invalid motion state.", 422)
        previous=-1
        for key in state["keyframes"]:
            if not previous < key["t_ms"] <= state["duration_ms"]:
                raise APIError("INVALID_TIMELINE", "Keyframe times must increase within duration.", 422)
            previous=key["t_ms"]
            values=[*key["translate"],*key["scale"],key["rotation_deg"],key["opacity"]]
            if len(key["translate"]) != 2 or len(key["scale"]) != 2 or not all(math.isfinite(n) for n in values) or any(abs(n)>64 for n in key["translate"]) or any(not .5<=n<=1.5 for n in key["scale"]) or abs(key["rotation_deg"])>45 or not 0<=key["opacity"]<=1:
                raise APIError("INVALID_TIMELINE", "Motion transform exceeds safe bounds.", 422)
        if not state["keyframes"] or state["keyframes"][0]["t_ms"] != 0 or previous != state["duration_ms"]:
            raise APIError("INVALID_TIMELINE", "Motion must span its declared duration.", 422)


def package(response, sprite):
    asset,animations=response["asset"],response["animations"]
    validate_core(asset,animations,sprite)
    thumb=sprite.copy(); thumb.thumbnail((256,256),Image.Resampling.LANCZOS)
    readme=("# Real2Playable asset pack\n\nSchema 1.3.0. Load sprite.png as an RGBA texture and asset.json as metadata.\n"
        "Origin is normalized to the full 512×512 canvas; bounds are pixels from top-left. +X right, +Y down.\n"
        "Read animations.json states. Linearly interpolate keyframes in milliseconds; translate pixels, scale multipliers, rotation degrees, opacity 0–1.\n"
        "Loop only if loop=true. Atlas holds four PROCEDURAL transforms of one illustration, not AI-generated poses.\n"
        "atlas/frames.json frames use pixel rectangles, offset pixels and normalized pivot. The atlas bakes the first chosen motion only; timelines contain all states.\n"
        "Verify manifest.json file SHA256 values before import. Manifest excludes its own hash. No source photo is included.\n"
        f"Provenance: {response['mode']}. Fixture artwork is original Pillow-drawn illustration; manual fallback is a crop, NOT AI stylization.\n"
        "User photos and model output remain subject to the user's rights and provider terms; no universal commercial license is promised.\n")
    files={"sprite.png":image_bytes(sprite),"thumbnail.webp":image_bytes(thumb,"WEBP"),"asset.json":json_bytes(asset),"animations.json":json_bytes(animations),"README.md":readme.encode()}
    if animations["states"]:
        sheet,frames=atlas(sprite,animations,asset["sprite"]["origin"])
        files["atlas/spritesheet.png"]=sheet
        files["atlas/frames.json"]=json_bytes(frames)
    listing=[{"path":path,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),"mime":mimetypes.guess_type(path)[0] or "application/octet-stream"} for path,data in files.items()]
    manifest={"package_version":VERSION,"compiler_version":VERSION,"created_at":datetime.now(timezone.utc).isoformat(),"asset_id":asset["asset_id"],"files":listing,"stages":response["stages"],"source_photo_included":False,"license_note":"Original authored fixtures; user inputs and model outputs subject to their respective rights.","warnings":response["warnings"]}
    files["manifest.json"]=json_bytes(manifest)
    out=io.BytesIO()
    with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as archive:
        for path,data in files.items():
            archive.writestr(path,data)
    payload=out.getvalue()
    checks=verify_package(payload)
    listing_with_manifest=[*listing,{"path":"manifest.json","bytes":len(files["manifest.json"]),"sha256":hashlib.sha256(files["manifest.json"]).hexdigest(),"mime":"application/json"}]
    return payload,listing_with_manifest,checks


def verify_package(payload):
    try:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            infos=archive.infolist()
            names=[item.filename for item in infos]
            if len(names)!=len(set(names)) or len(names)>16 or sum(item.file_size for item in infos)>32*1024*1024:
                raise ValueError("Duplicate entries or excessive decompressed package size")
            for item in infos:
                p=PurePosixPath(item.filename)
                if p.is_absolute() or ".." in p.parts or "\\" in item.filename or ":" in item.filename or (item.external_attr>>16)&0o170000 == 0o120000:
                    raise ValueError("Unsafe ZIP path or symlink")
            required={"sprite.png","thumbnail.webp","asset.json","animations.json","manifest.json","README.md"}
            if not required.issubset(names):
                raise ValueError("Missing core package files")
            manifest=json.loads(archive.read("manifest.json"))
            if manifest["package_version"]!=VERSION or manifest["compiler_version"]!=VERSION or manifest["source_photo_included"] is not False:
                raise ValueError("Invalid manifest version or source inclusion")
            listed=[item["path"] for item in manifest["files"]]
            if len(listed)!=len(set(listed)) or set(listed)!=(set(names)-{"manifest.json"}):
                raise ValueError("Manifest must list every file except itself")
            for item in manifest["files"]:
                data=archive.read(item["path"])
                if len(data)!=item["bytes"] or hashlib.sha256(data).hexdigest()!=item["sha256"]:
                    raise ValueError("Checksum or byte count mismatch")
            asset=json.loads(archive.read("asset.json")); animations=json.loads(archive.read("animations.json"))
            with Image.open(io.BytesIO(archive.read("sprite.png"))) as sprite:
                if sprite.size!=(512,512) or sprite.mode!="RGBA": raise ValueError("Invalid sprite dimensions or color mode")
                sprite.load(); validate_core(asset,animations,sprite)
            if asset["asset_id"]!=manifest["asset_id"]:
                raise ValueError("Asset and manifest identity mismatch")
            with Image.open(io.BytesIO(archive.read("thumbnail.webp"))) as thumb:
                if thumb.size!=(256,256): raise ValueError("Invalid thumbnail dimensions")
                thumb.load()
            if animations["states"]:
                frames=json.loads(archive.read("atlas/frames.json"))
                if frames["image"]!="atlas/spritesheet.png" or frames["kind"]!="procedural_motion_frames" or len(frames["frames"])!=4 or frames["motion"] not in animations["states"]:
                    raise ValueError("Invalid procedural atlas metadata")
                duration=animations["states"][frames["motion"]]["duration_ms"]
                times=[frame["t_ms"] for frame in frames["frames"]]
                if frames["duration_ms"]!=duration or times[0]!=0 or times[-1]!=duration or any(a>=b for a,b in zip(times,times[1:])):
                    raise ValueError("Atlas timestamps must span the motion duration")
                with Image.open(io.BytesIO(archive.read(frames["image"]))) as sheet:
                    if sheet.size!=(2048,512) or sheet.mode!="RGBA": raise ValueError("Invalid atlas image")
                    sheet.load()
                    for i,frame in enumerate(frames["frames"]):
                        if frame["frame"]!={"x":i*512,"y":0,"w":512,"h":512} or frame["pivot"]!=asset["sprite"]["origin"]:
                            raise ValueError("Invalid atlas rectangle or anchor")
            elif any(name.startswith("atlas/") for name in names):
                raise ValueError("Static package must not contain an atlas")
    except (KeyError,TypeError,ValueError,OSError,RuntimeError,NotImplementedError,Image.DecompressionBombError,zipfile.BadZipFile) as exc:
        raise APIError("INVALID_PACKAGE", f"Package validation failed: {str(exc)[:180]}",422) from exc
    return {"schema":True,"rgba":True,"alpha_bounds":True,"safe_paths":True,"checksums_after_reopen":True,"references":True,"timelines":True,"atlas":True,"source_excluded":True}
