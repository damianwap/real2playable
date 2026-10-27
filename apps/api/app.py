"""Local-first Real2Playable image compiler. Start with uvicorn apps.api.app:app."""
import asyncio
import math
import os
import time
from collections import OrderedDict, deque
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from dotenv import load_dotenv
from fastapi import FastAPI, File, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image
from starlette.exceptions import HTTPException as StarletteHTTPException
from . import meta
from .compiler import MAX_BYTES, decode_image, image_bytes, normalize, package, timelines, verify_package
from .fixtures import SAMPLES, illustration, source_illustration
from .models import APIError, AssetPatch, GenerateRequest, SelectionRequest, VERSION
from .store import Store, identifier, new_id

load_dotenv()

class BodyLimitMiddleware:
    """Bound bytes before multipart parsing can spool an unbounded upload."""
    def __init__(self,app):
        self.app=app

    async def __call__(self,scope,receive,send):
        if scope["type"]!="http":
            return await self.app(scope,receive,send)
        consumed=0
        async def limited_receive():
            nonlocal consumed
            message=await receive()
            consumed+=len(message.get("body",b""))
            if consumed>MAX_BYTES+1024*1024:
                raise StarletteHTTPException(status_code=413)
            return message
        await self.app(scope,limited_receive,send)



def bounded_setting(name,default,maximum):
    try:
        return max(1,min(maximum,int(os.getenv(name,str(default)))))
    except ValueError:
        return default


def create_app(data_dir=None):
    tasks=set()
    active_uploads=set()
    job_started={}
    rate=OrderedDict()
    concurrency=bounded_setting("R2P_MODEL_CONCURRENCY",2,4)
    max_jobs=bounded_setting("R2P_MAX_JOBS",8,32)
    rate_limit=bounded_setting("R2P_MUTATIONS_PER_MINUTE",30,120)

    @asynccontextmanager
    async def lifespan(app):
        app.state.store=Store(data_dir or os.getenv("R2P_DATA_DIR",".data"))
        app.state.model_slots=asyncio.Semaphore(concurrency)
        try:
            yield
        finally:
            for task in tuple(tasks): task.cancel()
            if tasks: await asyncio.gather(*tasks,return_exceptions=True)
            app.state.store.close()

    app=FastAPI(title="Real2Playable local asset compiler",version=VERSION,lifespan=lifespan)
    app.add_middleware(BodyLimitMiddleware)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request,exc):
        code,message=("NOT_FOUND","Resource was not found.") if exc.status_code==404 else ("REQUEST_TOO_LARGE","Request exceeds the local upload limit.") if exc.status_code==413 else ("HTTP_ERROR","Request could not be handled.")
        return JSONResponse(status_code=exc.status_code,content={"detail":{"code":code,"message":message}})

    @app.exception_handler(APIError)
    async def api_error(request,exc):
        return JSONResponse(status_code=exc.status,content={"detail":{"code":exc.code,"message":exc.message}})

    @app.exception_handler(RequestValidationError)
    async def validation_error(request,exc):
        # Do not echo request values or filenames back in validation errors.
        return JSONResponse(status_code=422,content={"detail":{"code":"INVALID_REQUEST","message":"Request fields are missing, unknown, or outside their supported values."}})

    @app.middleware("http")
    async def local_boundary(request,call_next):
        host=request.url.hostname
        if host not in ("127.0.0.1","localhost","::1","testserver"):
            return JSONResponse(status_code=403,content={"detail":{"code":"LOCAL_ONLY","message":"This private demo API accepts local hosts only."}})
        origin=request.headers.get("origin")
        if origin and urlparse(origin).hostname not in ("127.0.0.1","localhost","::1"):
            return JSONResponse(status_code=403,content={"detail":{"code":"ORIGIN_DENIED","message":"Cross-site access to the private local compiler is not allowed."}})
        if request.method in ("POST","PATCH","DELETE"):
            length=request.headers.get("content-length")
            if length and (not length.isdigit() or int(length)>MAX_BYTES+1024*1024):
                return JSONResponse(status_code=413,content={"detail":{"code":"REQUEST_TOO_LARGE","message":"Request exceeds the local upload limit."}})
            key=request.client.host if request.client else "local"
            now=time.monotonic()
            history=rate.setdefault(key,deque())
            rate.move_to_end(key)
            while history and history[0]<now-60: history.popleft()
            if len(history)>=rate_limit:
                return JSONResponse(status_code=429,headers={"Retry-After":"60"},content={"detail":{"code":"RATE_LIMIT","message":"Local mutation limit reached. Wait one minute before retrying."}})
            history.append(now)
            while len(rate)>256: rate.popitem(last=False)
        reply=await call_next(request)
        reply.headers["Cache-Control"]="no-store"
        reply.headers["X-Content-Type-Options"]="nosniff"
        return reply

    def store():
        return app.state.store

    def file_url(id_,filename):
        return f"/api/v1/files/{id_}/{filename}"

    def save_asset(image,source,label,mode,stages,warnings,upload_id=None,suggestions=None):
        started=time.monotonic()
        sprite,bounds=normalize(image)
        id_=new_id("ast")
        suggestions=suggestions or {"name":label,"asset_type":"prop","tags":[]}
        asset={"schema_version":VERSION,"asset_id":id_,**suggestions,"style_id":"storybook_toy_v1" if mode in ("live","fixture") else "manual_crop_v1","sprite":{"file":"sprite.png","width":512,"height":512,"origin":{"x":.5,"y":.90625},"visual_bounds":bounds},"animation_file":"animations.json","source":{"kind":"original_illustration_fixture" if mode=="fixture" else "user_photo","source_object_label":label}}
        stages=[*stages,{"name":"normalize_rgba","provider":"Real2Playable","model":None,"mode":mode,"success":True,"duration_ms":round((time.monotonic()-started)*1000)}]
        response={"asset_id":id_,"preview_url":file_url(id_,"sprite.png"),"source_url":file_url(id_,"source.png"),"asset":asset,"animations":timelines(["idle_bob"]),"motions":["idle_bob"],"warnings":warnings,"stages":stages,"mode":mode}
        directory=store().directory(id_)
        sprite.save(directory/"sprite.png")
        source.save(directory/"source.png")
        thumb=sprite.copy();thumb.thumbnail((256,256),Image.Resampling.LANCZOS);thumb.save(directory/"thumbnail.webp")
        store().put(id_,"asset",{"response":response,"upload_id":upload_id,"export":None},upload_id)
        return response

    @app.get("/api/v1/health")
    async def health():
        return {"status":"ok","meta_configured":meta.configured(),"version":VERSION}

    @app.get("/api/v1/samples")
    async def samples():
        return {"samples":[{"id":id_,"name":name,"description":description,"thumbnail_url":f"/api/v1/samples/{id_}/thumbnail"} for id_,(name,description) in SAMPLES.items()]}

    @app.get("/api/v1/samples/{sample_id}/thumbnail")
    async def sample_thumbnail(sample_id:str):
        if sample_id not in SAMPLES: raise APIError("NOT_FOUND","Unknown original sample.",404)
        return Response(image_bytes(illustration(sample_id)),media_type="image/png")

    @app.post("/api/v1/samples/{sample_id}/load")
    async def load_sample(sample_id:str):
        if sample_id not in SAMPLES: raise APIError("NOT_FOUND","Unknown original sample.",404)
        sprite=illustration(sample_id)
        return save_asset(sprite,source_illustration(sprite),SAMPLES[sample_id][0],"fixture",[{"name":"original_pillow_illustration","provider":"Real2Playable","model":None,"mode":"fixture","success":True}],["Original authored illustration fixture — not a photograph and not AI-generated. Motion frames are procedural."],suggestions={"name":SAMPLES[sample_id][0],"asset_type":"prop","tags":[sample_id,"original illustration","fixture"]})

    @app.post("/api/v1/uploads")
    async def upload(file:UploadFile=File(...)):
        try:
            raw=await file.read(MAX_BYTES+1)
        finally:
            await file.close()
        image=decode_image(raw,file.content_type)
        id_=new_id("upl")
        image.save(store().directory(id_)/"source.png")
        value={"upload_id":id_,"preview_url":file_url(id_,"source.png"),"width":image.width,"height":image.height}
        store().put(id_,"upload",value)
        return value

    def pixel_box(box,image):
        if box is None: raise APIError("BOX_REQUIRED","Draw a bounding box in original image pixels.",422)
        x,y=math.floor(box.x),math.floor(box.y)
        right,bottom=math.ceil(box.x+box.width),math.ceil(box.y+box.height)
        if box.x+box.width>image.width or box.y+box.height>image.height or not 0<=x<right<=image.width or not 0<=y<bottom<=image.height:
            raise APIError("INVALID_BOX","Selection must lie entirely inside the original image.",422)
        return (x,y,right,bottom)

    @app.post("/api/v1/uploads/{upload_id}/selection")
    async def select(upload_id:str,body:SelectionRequest):
        identifier(upload_id,"upl"); store().get(upload_id,"upload")
        with Image.open(store().directory(upload_id)/"source.png") as opened: image=opened.convert("RGBA")
        stages=[];warnings=[]
        if body.method=="manual_box":
            bounds=pixel_box(body.box,image)
            cutout=image.crop(bounds)
            mode="fallback"
            warnings=["Manual rectangular crop: background within the box is retained. This is not SAM segmentation or AI stylization."]
            stages=[{"name":"manual_box_crop","provider":"Real2Playable","model":None,"mode":"fallback","success":True}]
        else:
            meta.require_key()
            if not body.consent:
                raise APIError("CONSENT_REQUIRED", "Allow sending this image to Meta before requesting segmentation.", 422)
            bounds=pixel_box(body.box,image) if body.box else None
            if upload_id in active_uploads or app.state.model_slots.locked():
                raise APIError("MODEL_BUSY","All local model slots are busy. Retry after an existing request finishes.",429)
            active_uploads.add(upload_id)
            try:
                async with app.state.model_slots:
                    cutout,sam_stage=await meta.segment(image,body.label,bounds)
            finally:
                active_uploads.discard(upload_id)
            stages=[sam_stage];mode="live"
            warnings=["Review the SAM mask before generating; the model can omit details."]
        id_=new_id("sel");directory=store().directory(id_)
        cutout.save(directory/"selection.png")
        # A white-on-transparent mask preview, NOT a fabricated isolated object.
        mask=Image.new("RGBA",cutout.size,"white");mask.putalpha(cutout.getchannel("A"));mask.save(directory/"mask.png")
        result={"selection_id":id_,"mask_url":file_url(id_,"mask.png"),"preview_url":file_url(id_,"selection.png"),"method":body.method,"mode":mode,"warnings":warnings,"stages":stages}
        store().put(id_,"selection",{"response":result,"upload_id":upload_id,"label":body.label},upload_id)
        return result

    async def run_job(job_id,body):
        job=store().get(job_id,"job")
        started=job_started[job_id]
        def update(stage_name,status="running"):
            job.update(stage=stage_name,status=status,elapsed_ms=round((time.monotonic()-started)*1000))
            store().put(job_id,"job",job,body.upload_id)
        try:
            async with app.state.model_slots:
                job["attempts"]=1
                update("selection_review_accepted")
                selection=store().get(body.selection_id,"selection")
                stages=list(selection["response"]["stages"])
                warnings=list(selection["response"]["warnings"])
                with Image.open(store().directory(body.selection_id)/"selection.png") as opened: cutout=opened.convert("RGBA")
                with Image.open(store().directory(body.upload_id)/"source.png") as opened: source=opened.convert("RGBA")
                suggestions=None
                if body.mode=="live":
                    update("muse_image_edit")
                    def edit_complete(edit_stage,generated_image):
                        generated_image.save(store().directory(job_id)/"generated.png")
                        job["stages"]=[*stages,edit_stage]
                        update("sam_alpha_remask")
                    cutout,model_stages=await meta.stylize(cutout,body.label,edit_complete)
                    stages.extend(model_stages);job["stages"]=list(stages)
                    update("muse_spark_suggestions")
                    suggestions,spark_stage=await meta.suggest(cutout,body.label)
                    stages.append(spark_stage)
                    warnings.append("Live generated artwork: review likeness and alpha. Descriptive suggestions are editable; motion frames are procedural.")
                    mode="live"
                else:
                    mode="fallback"
                    warnings.append("Explicit manual fallback: normalized selected crop only; no Muse stylization or Spark inference was performed.")
                update("normalize_rgba")
                result=save_asset(cutout,source,body.label,mode,stages,warnings,body.upload_id,suggestions)
                job.update(result=result,stages=result["stages"],mode=mode)
                update("completed","completed")
        except asyncio.CancelledError:
            job["error"]={"code":"JOB_INTERRUPTED","message":"Server stopped during processing; retry explicitly."}
            update("interrupted","failed")
            raise
        except APIError as exc:
            job["error"]={"code":exc.code,"message":exc.message}
            job["stages"]=[*job.get("stages",[]),{"name":job["stage"],"provider":"Meta" if body.mode=="live" else "Real2Playable","model":None,"mode":job["mode"],"success":False}]
            update("failed","failed")
        except Exception:
            # Never return exception repr: provider messages may carry sensitive inputs.
            job["error"]={"code":"PROCESSING_FAILED","message":"Processing failed unexpectedly. No successful model output was fabricated; retry explicitly."}
            update("failed","failed")

    @app.post("/api/v1/assets/generate",status_code=202)
    async def generate(body:GenerateRequest):
        if not body.consent:
            raise APIError("REVIEW_REQUIRED","Review and accept the exact selection before generation.",422)
        store().get(body.upload_id,"upload")
        selection=store().get(body.selection_id,"selection")
        if selection["upload_id"]!=body.upload_id:
            raise APIError("SELECTION_MISMATCH","Selection does not belong to this upload.",422)
        if body.mode=="live": meta.require_key()
        if len(tasks)>=max_jobs:
            raise APIError("JOB_LIMIT","Local job queue is full. Wait for an existing job to finish.",429)
        id_=new_id("job")
        job={"job_id":id_,"status":"queued","stage":"queued","mode":"live" if body.mode=="live" else "fallback","attempts":0,"elapsed_ms":0,"stages":selection["response"]["stages"]}
        store().put(id_,"job",job,body.upload_id)
        job_started[id_]=time.monotonic()
        def finished(task):
            tasks.discard(task)
            job_started.pop(id_,None)
        task=asyncio.create_task(run_job(id_,body));tasks.add(task);task.add_done_callback(finished)
        return {"job_id":id_}

    @app.get("/api/v1/jobs/{job_id}")
    async def job_status(job_id:str):
        identifier(job_id,"job")
        value=store().get(job_id,"job")
        if job_id in job_started:
            value["elapsed_ms"]=round((time.monotonic()-job_started[job_id])*1000)
        return value

    @app.get("/api/v1/assets/{asset_id}")
    async def inspect(asset_id:str):
        identifier(asset_id,"ast")
        return store().get(asset_id,"asset")["response"]

    @app.patch("/api/v1/assets/{asset_id}")
    async def edit_asset(asset_id:str,body:AssetPatch):
        identifier(asset_id,"ast")
        record=store().get(asset_id,"asset");response=record["response"]
        changes=body.model_dump(exclude_unset=True)
        if any(value is None for value in changes.values()):
            raise APIError("INVALID_REQUEST","Edited fields cannot be null.",422)
        for key in ("name","asset_type","tags"):
            if key in changes: response["asset"][key]=changes[key]
        if "origin" in changes: response["asset"]["sprite"]["origin"]=changes["origin"]
        if "motions" in changes:
            response["motions"]=changes["motions"];response["animations"]=timelines(changes["motions"])
        record["export"]=None
        old=store().directory(asset_id)/"export.zip"
        if old.exists(): old.unlink()
        store().put(asset_id,"asset",record,record["upload_id"])
        return response

    def compile_asset(asset_id):
        identifier(asset_id,"ast")
        record=store().get(asset_id,"asset")
        if record["export"] is not None: return record["export"]
        with Image.open(store().directory(asset_id)/"sprite.png") as opened: sprite=opened.convert("RGBA")
        payload,files,checks=package(record["response"],sprite)
        (store().directory(asset_id)/"export.zip").write_bytes(payload)
        result={"export_id":new_id("exp"),"asset_id":asset_id,"schema_valid":True,"download_url":f"/api/v1/assets/{asset_id}/export","files":files,"warnings":record["response"]["warnings"],"checks":checks}
        record["export"]=result
        store().put(asset_id,"asset",record,record["upload_id"])
        return result

    @app.post("/api/v1/assets/{asset_id}/compile")
    async def compile_endpoint(asset_id:str):
        return compile_asset(asset_id)

    @app.get("/api/v1/assets/{asset_id}/export")
    async def export(asset_id:str):
        compile_asset(asset_id)
        return FileResponse(store().directory(asset_id)/"export.zip",media_type="application/zip",filename=f"real2playable-{asset_id}.zip")

    @app.post("/api/v1/playground/validate")
    async def validate(file:UploadFile=File(...)):
        try: payload=await file.read(MAX_BYTES+1)
        finally: await file.close()
        if len(payload)>MAX_BYTES: raise APIError("PACKAGE_TOO_LARGE","ZIP must be at most 10 MB.",413)
        return {"valid":True,"schema_valid":True,"checks":verify_package(payload),"warnings":[]}

    @app.delete("/api/v1/assets/{asset_id}",status_code=204)
    async def delete(asset_id:str):
        identifier(asset_id,"ast")
        record=store().get(asset_id,"asset");upload_id=record["upload_id"]
        if upload_id:
            if upload_id in active_uploads:
                raise APIError("ASSET_BUSY","An associated upload is being segmented. Delete after it finishes.",409)
            related=store().related(upload_id)
            if any(kind=="job" and data["status"] in ("queued","running") for _,kind,data in related):
                raise APIError("ASSET_BUSY","An associated upload is still processing. Delete after it finishes.",409)
            for id_,kind,data in related:
                if kind=="job" and data.get("result",{}).get("asset_id")==asset_id: store().remove(id_)
            store().remove(asset_id)
            if not store().related(upload_id,"asset"):
                for id_,_,_ in store().related(upload_id): store().remove(id_)
                store().remove(upload_id)
        else: store().remove(asset_id)
        return Response(status_code=204)

    @app.get("/api/v1/files/{id_}/{filename}")
    async def files(id_:str,filename:str):
        identifier(id_)
        allowed={"ast":{"sprite.png","source.png","thumbnail.webp"},"upl":{"source.png"},"sel":{"selection.png","mask.png"}}
        prefix=id_.split("_")[0]
        if filename not in allowed.get(prefix,set()): raise APIError("NOT_FOUND","File is not public.",404)
        store().get(id_,{"ast":"asset","upl":"upload","sel":"selection"}[prefix])
        path=store().directory(id_)/filename
        if not path.is_file(): raise APIError("NOT_FOUND","File was not found or was deleted.",404)
        return FileResponse(path,media_type="image/webp" if filename.endswith(".webp") else "image/png")

    return app


app=create_app()
