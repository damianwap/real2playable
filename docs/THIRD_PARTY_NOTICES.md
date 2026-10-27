# Third-party notices

Kode library, engine, model dan font berikut bukan karya Real2Playable. Versi JavaScript terselesaikan ada di `package-lock.json`; dependensi Python dan batas versinya ada di `requirements.txt`. Lisensi proyek MIT tidak mengganti lisensi dependency / layanan model.

| Komponen | Penggunaan | Lisensi / ketentuan |
|---|---|---|
| [React](https://github.com/facebook/react) | UI studio | MIT |
| [Vite](https://github.com/vitejs/vite), [TypeScript](https://github.com/microsoft/TypeScript) | Toolchain | MIT / Apache-2.0 |
| [Lucide](https://lucide.dev/license) | Ikon antarmuka | ISC |
| [Phaser 3](https://github.com/phaserjs/phaser) | Independent runtime scene | MIT |
| [fflate](https://github.com/101arrowz/fflate) | ZIP browser | MIT |
| [FastAPI](https://github.com/fastapi/fastapi), [Starlette](https://github.com/encode/starlette), [Uvicorn](https://github.com/encode/uvicorn) | API/server | MIT / BSD-3-Clause / BSD-3-Clause |
| [Pillow](https://python-pillow.github.io/) | Raster authoring dan compiler | HPND / Pillow license |
| [Pydantic](https://github.com/pydantic/pydantic), [httpx](https://github.com/encode/httpx) | Validation / HTTP | MIT / BSD-3-Clause |
| [python-multipart](https://github.com/Kludex/python-multipart), [python-dotenv](https://github.com/theskumar/python-dotenv) | Upload / environment | Apache-2.0 / BSD-3-Clause |
| [pytest](https://github.com/pytest-dev/pytest) | Contract tests | MIT |
| [meta-sam-parser 0.1.0](https://github.com/meta-models/meta-sam) | Official SAM protocol parser | **SAM License**, updated November 19, 2025. Not MIT. See package `dist-info/licenses/LICENSE`; comply with redistribution, attribution and use restrictions. |
| [DM Sans](https://fonts.google.com/specimen/DM+Sans), [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) | Browser-hosted fonts | SIL Open Font License 1.1; fonts served by Google Fonts, not bundled in repo; system font fallback works offline |

Transitive dependencies retain their own notices in installed distributions. When redistributing packaged dependencies, include their license files, especially the SAM License. This repository references the official parser dependency; it does not relicense or reproduce Meta model weights.

## Model services

SAM 3.1, Muse Image and Muse Spark belong to Meta; their API access and output remain governed by [Meta's current terms and documentation](https://dev.meta.ai/docs/overview). Integration adapters are project code. No credentials or model weights are shipped. Live verification after credentials were supplied is documented in `EVALUATION.md`; control artwork is original illustration, not a user photograph.

## Assets and marks

The cactus, mushroom and mug are original deterministic drawings authored through `apps/api/fixtures.py` with AI-assisted coding. Their neutral source previews are illustrations, not photos. They are provided under this project's MIT license. No stock photos, third-party character IP, music or audio are bundled. App icons come from Lucide. Real2Playable does not claim affiliation with or endorsement by Meta.
