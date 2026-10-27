"""Private, local SQLite records; only allowlisted files have HTTP routes."""
import json
import re
import shutil
import sqlite3
import time
import uuid
from pathlib import Path
from .models import APIError

ID_PATTERN=re.compile(r"^(?:ast|upl|sel|job|exp)_[a-f0-9]{32}$")


def identifier(value, prefix=None):
    if not ID_PATTERN.fullmatch(value) or (prefix is not None and not value.startswith(prefix+"_")):
        raise APIError("INVALID_IDENTIFIER","Malformed resource identifier.",400)
    return value


def new_id(prefix):
    return prefix+"_"+uuid.uuid4().hex


class Store:
    def __init__(self, root):
        self.root=Path(root).resolve()
        self.root.mkdir(parents=True,exist_ok=True)
        self.db=sqlite3.connect(self.root/"private.sqlite3")
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, upload_id TEXT, created_at REAL NOT NULL)")
        # A restarted process cannot resume a paid provider request safely.
        for id_,data in self.db.execute("SELECT id,data FROM records WHERE kind='job'").fetchall():
            job=json.loads(data)
            if job["status"] in ("queued","running"):
                job.update(status="failed",stage="interrupted",error={"code":"JOB_INTERRUPTED","message":"Server restarted during processing; retry explicitly."})
                self.db.execute("UPDATE records SET data=? WHERE id=?",(json.dumps(job),id_))
        self.db.commit()

    def directory(self,id_):
        identifier(id_)
        path=self.root/id_
        path.mkdir(exist_ok=True)
        return path

    def get(self,id_,kind=None):
        identifier(id_)
        row=self.db.execute("SELECT kind,data FROM records WHERE id=?",(id_,)).fetchone()
        if row is None or (kind and row[0]!=kind):
            raise APIError("NOT_FOUND","Resource was not found or was deleted.",404)
        return json.loads(row[1])

    def put(self,id_,kind,value,upload_id=None):
        identifier(id_)
        self.db.execute("INSERT INTO records(id,kind,data,upload_id,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,upload_id=excluded.upload_id",(id_,kind,json.dumps(value,allow_nan=False),upload_id,time.time()))
        self.db.commit()

    def related(self,upload_id,kind=None):
        query="SELECT id,kind,data FROM records WHERE upload_id=?"
        args=[upload_id]
        if kind:
            query+=" AND kind=?";args.append(kind)
        return [(id_,kind,json.loads(data)) for id_,kind,data in self.db.execute(query,args).fetchall()]

    def remove(self,id_):
        identifier(id_)
        self.db.execute("DELETE FROM records WHERE id=?",(id_,));self.db.commit()
        path=self.root/id_
        if path.exists():
            shutil.rmtree(path)

    def close(self):
        self.db.close()
