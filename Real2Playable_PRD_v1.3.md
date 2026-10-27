# REAL2PLAYABLE
## Product Requirements Document (PRD) — AI Asset Compiler for Indie Developers

**Tagline:** *From real objects to reusable, animation-ready 2D game assets.*  
**Version:** 1.3 · **Date:** 27 Oktober 2026 · **Status:** Specification / belum diimplementasikan  
**Event:** Meta Global AI Developer Hackathon 2026  
**Track yang disarankan:** Indie Developer · **Tema:** Build for Your World  
**Platform MVP:** web desktop-first, unggah foto dari ponsel melalui browser  
**Prioritas:** portable asset > pengalaman playground > fitur arena  
**Batas waktu submission yang dipublikasikan:** 4 November 2026, 21.00 ET (5 November 2026, 09.00 WIB)

> **North-star promise.** Developer membawa foto objek miliknya, memilih style, lalu memperoleh sprite 2D transparan, animasi sederhana yang terdefinisi secara eksplisit, metadata teknis tervalidasi, dan paket ekspor yang dapat dipakai di luar aplikasi. **Tidak ada game mechanic yang diwajibkan dalam paket inti.**
>
> **Kejujuran status:** PRD ini mendeskripsikan hasil yang ingin dibangun, bukan klaim fitur sudah berjalan, kecepatan inferensi, kemampuan animasi generatif, atau validasi pasar. Akses API Meta, hasil model, dan performa harus diuji nyata.

---

# 1. Executive Summary

## 1.1 Masalah nyata

Generator gambar AI sudah bisa mengubah foto menjadi ilustrasi. Tetapi **ilustrasi ≠ aset game siap integrasi**. Dalam workflow developer indie, pekerjaan lanjutan masih mencakup memisahkan latar, normalisasi ukuran dan pivot, menghasilkan variasi/animasi yang masuk akal, menyiapkan spritesheet atau timeline, menulis metadata, memeriksa kualitas, dan mengimpor aset ke engine. Tahapan berulang tersebut menambah friksi setiap kali developer mencoba karakter atau prop baru.

**Problem statement (English):**

> Indie game developers can generate images with AI, but turning those images into consistent, animation-ready, portable 2D assets still involves tedious manual cleanup, metadata work, and engine integration. Real2Playable compiles photographs of everyday objects into validated 2D asset packs with predictable structure and a playable integration proof—without imposing any particular game's roles, statistics, or mechanics.

## 1.2 Solusi

**Real2Playable** adalah *AI-assisted asset compiler*, bukan game dan bukan chatbot. Pengguna mengunggah foto benda nyata, memilih objek yang ingin digunakan, menentukan style, memeriksa hasil kartunnya, memilih preset animasi teknis sederhana, dan mengekspor **aset 2D terstruktur**. *Reference Playground* adalah aplikasi konsumen paket ekspor yang membuktikan aset dapat digunakan; Arena Battle hanya **opsional** untuk demonstrasi.

## 1.3 Outcome yang ingin dibuktikan

- Developer bisa menghasilkan **paket sprite transparan + manifest + data frame/timeline** dari foto baru tanpa membuka editor gambar manual.
- Paket hasil ekspor dapat dibuka dalam **Phaser sample importer yang terpisah** dari generator.
- Gambar kartun masih mudah dikaitkan dengan objek foto asalnya; kesamaan dinilai manusia, bukan diasumsikan.
- Developer menyelesaikan tugas persiapan dan impor lebih efektif dibandingkan workflow pembanding; **klaim waktu hemat hanya dipakai setelah pengukuran**.

## 1.4 Batas definisi istilah

- **Cartoon sprite:** satu gambar raster 2D ber-alpha dari hasil transformasi objek foto.
- **Animation-ready:** metadata frame/pivot/timeline valid dan dapat dirender oleh engine; **tidak otomatis berarti frame pose unik hasil AI**.
- **Spritesheet:** atlas PNG berisi beberapa frame; jika dibuat dari transformasi sprite yang sama, disebut secara jelas **procedural-motion frames**, bukan animasi karakter bergambar ulang.
- **Engine-agnostic core:** format PNG + JSON dan koordinat terdokumentasi, **bukan janji integrasi otomatis semua engine**. P0 diuji dengan Phaser; Godot/Unity adapter masuk P1/P2.
- **Behavior:** aksi, skill, stats, rarity, atau aturan RPG lain; hanya extension/arena-demo, **tidak termasuk core asset contract**.

# 2. Keputusan Final dan Perubahan dari PRD v1.2

| Aspek | Real2Toon Creator v1.2 | Real2Playable v1.3 |
|---|---|---|
| Nama / kategori | Creator karakter 2D | **AI Asset Compiler** |
| Unit produk | Character | **Asset**: karakter, prop, item, dekorasi |
| Fokus | Playable character pack | **Reusable visual asset pack** yang tidak mengunci genre |
| Metadata wajib | Class, HP, skill, damage, lore | **Dimensi, alpha, frame, anchor, source/style, provenance** |
| Animasi MVP | Tween di Arena | **Engine-neutral motion/timeline + optional baked frames** |
| Output primer | `character.json` + sprite | **`asset.json`, `animations.json`, `sprite.png`, 4-frame optional atlas** |
| Arena | Referensi wajib 1v1 | **Playground P0; Arena Battle P1/extension** |
| Engine | Phaser | **Format lintas engine, validasi nyata di Phaser** |
| Klaim produk | Photo-to-playable fighter | **Photo-to-structured, verifiable asset** |

**Design decision D-001:** Tidak ada field `role`, `class`, `hp`, `attack`, `rarity`, `lore`, atau `attack_type` dalam `asset.json` inti. Contoh demo memuat field itu di `extensions/arena_demo.json` bila fitur dipasang.

**D-002:** Style dan animasi merupakan **parameter kreatif yang disarankan**, sedangkan manifest, bounds, pivot, dan ekspor adalah kontrak teknis tervalidasi.

**D-003:** Jika animasi hanya berupa scale/bob/slide/flash, UI dan video harus menyebutnya *motion presets*; tidak boleh menyebut AI generated multi-pose animation.

# 3. Hackathon Fit, Aturan, dan Positioning

**Tema dipilih:** Build for Your World. Problem domain: workflow pembangunan/prototyping game 2D. Proyek memberi manfaat yang dapat diuji berupa pengurangan langkah dari foto ke aset yang dapat diimpor.

**Mengapa bukan simple image analyzer/image wrapper:** keluaran akhirnya adalah **format aset yang valid**, bukan hanya visual. Team membangun segmentasi & perbaikan alpha, normalization, animation/timeline compiler, metadata schema/versioning, export packager, verification runner, dan adapter/playground yang mengonsumsi paket persis hasil ekspor. Semua harus tampak dalam demo dan repo.

**Aturan wajib dari participant guide yang disampaikan:**

1. Semua fitur, kode, dan fungsionalitas yang diklaim/didemokan harus dibuat selama **26 Okt – 4 Nov 2026**; kontribusi dari sebelum event tidak boleh disamarkan sebagai karya baru.
2. Repo submission **publik**; sejarah commit dan daftar kontribusi harus membuat pekerjaan tim dapat dibedakan dari library/template/model pihak ketiga.
3. Tim maksimal **4 orang**, solo diperbolehkan; **1 track** dan **1 submitter**.
4. Demo video **3 menit** memperlihatkan hanya fitur yang benar-benar bekerja.
5. Gunakan materi berlisensi/hak jelas; patuhi kebijakan hukum, etika, platform, serta aturan terkini yang disetujui peserta.
6. Akhiri demo dengan bukti bahwa aset diimpor dan digunakan **dalam aplikasi game terpisah**, bukan hanya preview canvas hasil generate.

**Catatan:** Penentuan kelayakan final ada pada penyelenggara; kepatuhan teknis versi PRD belum menjamin lolos.

# 4. Target Pengguna, Jobs To Be Done, dan Hipotesis

| Persona | Masalah | Jobs to be done |
|---|---|---|
| Solo 2D developer | Lebih mahir programming daripada art | “Saya butuh prop atau karakter 2D siap diimpor saat menguji mekanik.” |
| Game-jam developer | Butuh iterasi sangat cepat | “Saya ingin beberapa aset dalam art direction yang sama tanpa mengedit tiap file manual.” |
| Indie prototyper | Sulit menjaga konsistensi format | “Saya perlu output dengan anchor, bounding box, nama file, dan frame yang bisa diprediksi.” |

**Hipotesis H1:** Workflow gabungan Real2Playable mengurangi langkah manual dibandingkan proses prompt generik + editor + import. **H2:** Aset dikenali sebagai turunan objek foto. **H3:** Export berbasis schema menurunkan error integrasi. Ketiganya belum terbukti sampai pengujian.

**Non-persona:** studio besar yang memerlukan animation rigs, game AAA 3D, custom skeletal animation produksi, atau kepastian lisensi komersial universal.

# 5. Prinsip Produk dan Pembeda

1. **Compiler, not gallery:** hasil kerja utama adalah berkas standar yang dapat dipakai ulang, bukan gambar showcase.
2. **Core/extension separation:** identitas grafis, metadata render dan animasi tidak bergantung pada mekanik game.
3. **Recognizability:** bentuk, warna dominan, dan ciri khas objek tetap dipertahankan sebisa mungkin.
4. **Interoperability with proof:** spesifikasi diikuti dengan importer yang benar-benar dijalankan.
5. **Honest animation:** bedakan pose generatif versus gerakan prosedural.
6. **Configurable but bounded:** satu style dan beberapa motion preset dahulu; kualitas lebih penting daripada pilihan tanpa batas.
7. **Auditability:** setiap hasil mengetahui source mode dan model/stage yang benar-benar memprosesnya.
8. **Portability & privacy:** hasil bisa diunduh tanpa akun, foto sumber tidak otomatis disertakan.

# 6. Scope Fitur

## 6.1 P0 — minimum untuk submission

| ID | Fitur | Kriteria penerimaan / Definition of Done |
|---|---|---|
| P0-01 | Upload foto JPG/PNG/WEBP | Decode, strip EXIF, file ≤ 10 MB, validasi dimensi, preview terlihat; kamera bukan syarat |
| P0-02 | Pilih satu objek | Click/box atau deskripsi singkat; pengguna dapat mengganti target |
| P0-03 | **SAM 3.1 mask** | Mask ditampilkan dan pengguna dapat menerima/menolak; fallback manual diberi label |
| P0-04 | **Muse Image stylization** | Foto/cutout menjadi ilustrasi dalam `storybook_toy_v1`; identitas diverifikasi manual |
| P0-05 | Normalisasi & alpha | `sprite.png` RGBA 512×512; background benar transparan; bounds tidak terpotong |
| P0-06 | **Muse Spark semantic assistance** | Menyarankan nama/label objek, jenis aset atau tags sebagai opsi; metadata core tetap dikalkulasi secara deterministik |
| P0-07 | Asset Inspector | Compare source vs sprite; checkerboard, rename, adjust origin; QA warnings terlihat |
| P0-08 | Motion presets P0 | `idle_bob`, `interact_pulse`, `impact_flash`; parameter keyframe terstruktur bisa dihapus |
| P0-09 | Portable asset ZIP + minimal atlas | `sprite.png`, `asset.json`, `animations.json`, `manifest.json`, `README.md`; ketika motion dipilih, output juga `atlas/spritesheet.png` + `atlas/frames.json` (4 procedural frames) |
| P0-10 | **Independent Phaser Playground** | Membuka berkas hasil ekspor dan menampilkan sprite dengan preset motion; tidak bergantung pada data internal backend |
| P0-11 | Job observability | `live/cached/fallback`, stage, timing, error/retry dan input-safe logging |
| P0-12 | Repository & evidensi | README, tes contract, kontribusi, lisensi aset, Build Log, demo 180 detik |

**Exit gate P0:** *Foto baru milik tim → model Meta bekerja → sprite transparan → ZIP valid → import Phaser → motion tampil.* Jika itu belum lulus, jangan membangun battle system.

## 6.2 P1 — sesudah P0 stabil

- Custom jumlah frame dan frame-baking untuk berbagai animasi, bukan hanya 4 frame P0; tetap tampilkan label **procedural sprite frames**.
- User-defined animation state/timeline (`jump`, `open`, `collect`), dengan batas keyframe dan validasi.
- **Arena Demo Extension:** `extensions/arena_demo.json` opsional: role, stats, attack type, rarity, lore, behavior template; template lokal tidak memengaruhi core.
- Phaser template export siap dibuka dan docs/import snippet untuk Godot (tanpa menjanjikan full auto-import).
- Batch dua–tiga aset dan penilaian style consistency side-by-side.

## 6.3 P2 — produk sesudah hackathon

- Adapter resmi Godot/Unity, scene prefab, custom schema/plugin API.
- Generasi pose multi-frame berbasis referensi dan validasi temporal/silhouette; pose kreatif bersifat nondeterministik.
- Layer separation, skeletal rigging, sprite packing atlas multiasset, tilesets, particle FX, pipeline CI untuk game studio.
- User-defined animation state machine yang dikonfigurasi sesuai mekanik game.
- Multi-user collaboration, library cloud, version history, licensing policy UI.

## 6.4 Tidak masuk scope MVP

Full game 3v3, multiplayer, marketplace, 3D, video tracking langsung, kontrol webcam sebagai input game, animasi tulang kompleks, auto-generate behavior yang mengeksekusi kode, janji kompatibilitas universal seluruh engine.

# 7. User Journey dan Antarmuka

**Happy path:** `Upload → Select → Segment → Stylize → Inspect → Choose motion → Compile → Preview → Export → Import`. 

| View | Tindakan | Konten wajib | Recovery |
|---|---|---|---|
| V01 Landing | Start compiling | Nilai manfaat, contoh nyata vs output | Contoh labeled sample |
| V02 Capture | Upload/camera | Jenis file, hak foto, file size | Upload jika kamera diblokir |
| V03 Select | Pilih target | Box/mask overlay, ubah seleksi | Manual box/crop (labeled) |
| V04 Stylize | Generate | Gaya tunggal, tahap/progress, biaya retry | Retry atau failure transparan |
| V05 Inspector | Approve | Source comparison, checkerboard, alpha QA, origin control | Regenerate/reselect/correct alpha |
| V06 Animation | Add motion | Timeline preset, playback, disable toggle | Default static |
| V07 Package | Compile & export | ZIP contents, schema status, checksums | Build ulang jika gagal |
| V08 Playground | Test exported ZIP | Sprite, motion state, anchor debug | Error parsing jelas |
| V09 Handoff | Integration instructions | Phaser import code dan generic import tips | Dokumentasi offline ZIP |

**UX copy penting:** gunakan “Motion preset” untuk transformasi 2D; “Generated artwork” untuk hasil Muse Image; “Preview in Phaser” untuk bukti engine nyata. Jangan pakai “fully animated character” tanpa pose unik.

# 8. Kontrak Asset Compiler yang Engine-Agnostic

## 8.1 Standar ekspor inti

```text
spoon-knight.asset.zip
├── sprite.png                # 512x512 RGBA, transparan
├── thumbnail.webp            # preview 256x256
├── asset.json                # core technical manifest; no gameplay mechanics
├── animations.json           # procedural motion timelines, optional arrays
├── manifest.json             # versions, checksums, provenance
├── README.md                 # import docs, rights and limitations
├── atlas/                    # P0 when motion enabled; absent for static
│   ├── spritesheet.png
│   └── frames.json
└── extensions/               # optional, absent in core-only exports
    └── arena_demo.json       # role/stats/skill/lore for example game ONLY
```

**Invariant penting:** Tidak ada `role`, `rarity`, `attack`, `lore` di core. Pengguna dapat memilih hanya **PNG+JSON** tanpa game extension. Hanya berkas yang ada di ZIP yang boleh direferensikan oleh manifest/animations.

## 8.2 `asset.json` — contoh inti

```json
{
  "schema_version": "1.3.0",
  "asset_id": "ast_spoon_001",
  "name": "Silver Spoon",
  "asset_type": "character",
  "tags": ["spoon", "metal", "cartoon"],
  "style_id": "storybook_toy_v1",
  "sprite": {
    "file": "sprite.png",
    "width": 512,
    "height": 512,
    "origin": {"x": 0.5, "y": 0.85},
    "visual_bounds": {"x": 87, "y": 35, "width": 336, "height": 445}
  },
  "animation_file": "animations.json",
  "source": {"kind": "user_photo", "source_object_label": "spoon"}
}
```

**Koordinat:** `origin.x/y` ternormalisasi 0–1 relatif sprite full-canvas; `visual_bounds` piksel relatif kiri atas; frame duration dalam milidetik; orientasi +X kanan, +Y bawah pada gambar. `asset_type` hanya petunjuk editor (`character|prop|item|environment|ui`), **bukan gameplay logic**.

## 8.3 `animations.json` — contoh motion yang portable

```json
{
  "schema_version": "1.3.0",
  "states": {
    "idle": {
      "kind": "transform_timeline", "loop": true, "duration_ms": 1200,
      "keyframes": [
        {"t_ms": 0, "translate": [0, 0], "scale": [1, 1], "rotation_deg": 0, "opacity": 1},
        {"t_ms": 600, "translate": [0, -5], "scale": [1.02, 0.98], "rotation_deg": 0, "opacity": 1},
        {"t_ms": 1200, "translate": [0, 0], "scale": [1, 1], "rotation_deg": 0, "opacity": 1}
      ]
    }
  }
}
```

**Rendering contract:** Playback tween berbasis interpolasi linear antar keyframe dan berulang; client boleh menggunakan easing internal, tetapi untuk parity test gunakan linear. Animasi `attack` tidak dimasukkan wajib. **P0** mengekspor atlas empat *procedural frames* ketika motion dipilih (contoh: waktu 0/400/800/1200 ms untuk idle); `atlas/frames.json` memetakan rectangle/offset/pivot setiap frame dan mengacu ke file yang ada. Atlas adalah frame transformasi gambar yang sama, bukan pose baru dari Muse. Output `static` boleh tanpa atlas. Origin, bounds dan keyframe memiliki unit eksplisit agar konsumen engine lain dapat mengimplementasikan importer.

## 8.4 `manifest.json` dan provenance

Fields: `package_version`, `compiler_version`, `created_at`, `asset_id`, `files:[{path,sha256,bytes,mime}]`, `stages:[{name,provider,model,mode,success}]`, `source_photo_included=false`, `license_note`, `warnings`. Nama model hanya dicantumkan jika benar dipakai. Keamanan: jangan taruh API key, raw prompts pengguna, identitas pribadi, atau foto sumber secara default.

## 8.5 Validasi build deterministik

- Sprite decode RGB+alpha dan ukuran tepat; nonempty alpha bbox; piksel tepi tidak memotong subjek secara mencolok.
- `visual_bounds` dihitung dari alpha channel, bukan dikarang Muse Spark; otomatis diperbarui jika sprite direvisi.
- Keyframes terurut berdasarkan `t_ms` dan dalam `duration_ms`; nilai posisi/rotasi/scale dibatasi.
- `sha256` tiap output dihitung setelah berkas final, diverifikasi setelah unzip; path relatif aman tanpa `../`.
- ZIP bisa diekstrak tanpa symlink/path traversal dan setiap referensi file resolvable.
- Paket tidak memerlukan database atau backend pembuat untuk dirender.

# 9. Architecture & Separation of Concerns

```text
Web (React / TypeScript)
  Upload + Selection + Inspector + Motion Editor
           |
           v
FastAPI / Jobs / Storage / Audit Log
           |
      Provider adapters
  +--------+------------+-------------+
  | SAM 3.1| Muse Image | Muse Spark  |
  +--------+------------+-------------+
           |
      Asset compiler (TEAM CODE)
  Mask/alpha -> normalize -> measure bounds
  Motion timeline -> schema validate -> ZIP
           |
      Portable PNG + JSON package
           |
    Independent Phaser Playground (consumer)
           |
    Optional Arena Extension (separate plugin)
```

**Core packages:** `asset-schema`, `compiler-core`, `asset-exporter`, `phaser-importer`; `arena-extension` **mengimpor** core, tetapi core tidak boleh mengimpor arena.

**Pemisahan dependency:** Meta providers bergantung pada API external; compiler harus punya fixtures lokal untuk tests; preview harus memuat berkas dari export ZIP/folder hasil ekstraksi, bukan membaca private in-memory object.

# 10. Model AI Meta dan Alur Proses

## 10.1 Mapping kemampuan yang harus diuji live

| Model | Model ID / Interface | Tanggung jawab | Batasan yang diakui |
|---|---|---|---|
| SAM 3.1 | `sam-3.1`, Responses API | Segmentasi dari prompt/box menghasilkan mask/boxes | Tidak selalu menemukan objek yang dipilih; perlu koreksi |
| Muse Image | `muse-image-1.0`, image edits / Responses | Mengkartunkan objek dan menjaga visual anchor | Hasil nondeterministik, style/pose bisa bergeser |
| Muse Spark | `muse-spark-1.3`, model reasoning | Saran objek, tags, art prompt dan QA explanation | Bukan sumber kebenaran untuk pixel geometry atau game stats |

**Base URL:** `https://api.meta.ai/v1`; autentikasi `MODEL_API_KEY` hanya di backend. Nama dan antarmuka di atas telah dirujuk pada dokumentasi Meta per **27 Oktober 2026**, tetapi **akses akun, response shape, rate limit, dan behavior harus dites langsung**. Muse Image tidak otomatis menjamin alpha transparan atau konsistensi frame animasi; compiler mengerjakan QA dan cutout tambahan.

## 10.2 Pipeline yang dijalankan

1. Foto diunggah dan dinormalisasi (EXIF removed); pilih objek yang dituju.
2. SAM mengembalikan mask dan box untuk ditinjau pengguna.
3. Crop/cutout diteruskan ke Muse Image untuk style `storybook_toy_v1`.
4. Hasil kartun ditinjau; jika background solid, lakukan re-mask (SAM) pada output.
5. Compiler meresize tanpa distorsi, meletakkan subjek di canvas 512 RGBA, mengukur bounds, dan memberi origin default yang dapat diedit.
6. Muse Spark hanya menyarankan `name`, `asset_type`, `tags` dan prompt refinement (semua boleh diedit).
7. User memilih motion preset atau `static`; sistem membuat `animations.json` secara deterministik.
8. Sistem menguji kontrak schema, melakukan ZIP build, lalu preview konsumsi paket di Phaser.
9. Ekspor final diunduh; option `arena-demo` menambah file extension tanpa mengubah core.

**Jika API mati:** gunakan fixtures/mock sebagai *development-only* dan label **DEMO FIXTURE**. Submission harus memperlihatkan integrasi nyata jika model Meta diklaim sebagai fitur.

## 10.3 Prompt templates (starting points; harus A/B test)

**Muse Image edit:**

```text
Transform ONLY the isolated photographed object into one complete 2D
storybook-toy game sprite. Preserve the source silhouette, dominant
colors, and at least one distinctive feature. Single subject, full body,
clean clear outline, soft flat colors, consistent 3/4 view, centered,
neutral expression. Do not add a second character, text, watermark,
logo, heavy shadows or decorative scenery. Return a clean isolated
object suitable for extracting a transparent sprite.
```

**Muse Spark metadata suggestion (JSON only):**

```text
You are suggesting descriptive metadata for a 2D asset, not game design.
Given the selected object photo and label, return only: name (<=40 chars),
asset_type (character|prop|item|environment|ui), tags (max 5),
source_object_label (<=60 chars), and style_prompt_hint (<=160 chars).
Never create stats, attack type, rarity, skills, class, lore, scripts,
shell commands, collision numbers or animation geometry. If uncertain,
use the neutral asset type 'prop'.
```

**Guardrails:** semua output LLM dianggap tidak dipercaya; strict JSON schema, whitelist enum, string escaping, retries terbatas, tidak menjalankan kode hasil AI.

# 11. Motion System Design

**Mengapa ada animasi di core:** developer membutuhkan aset yang bisa ditempatkan di scene dan **bereaksi secara visual** tanpa menulis semua efek dasar sendiri. Namun, itu tidak boleh mengikat jenis game.

| Preset P0 | Visual | Trigger umum | Kemampuan sebenarnya |
|---|---|---|---|
| `static` | Diam | Semua aset | No motion |
| `idle_bob` | Naik turun sedikit | Idle state | Translate/scale tween |
| `interact_pulse` | Membesar sekilas | On interact | Scale tween |
| `impact_flash` | Flash alpha/scale | On hit/feedback | Opacity/scale tween |

**Opsional `arena-extension`:** Memetakan action game `idle`, `attack`, `hurt`, `death` ke preset umum; jika gameplay membutuhkannya. Rarity/lore/stats berada di sana, bukan sistem motion.

**P0:** 4-frame procedural atlas dari motion terpilih dengan provenance jelas; **P1:** variasi jumlah frame dan multiple states. **P2:** Model menghasilkan pose baru dengan pemeriksaan konsistensi antarkerangka; jangan disatukan dengan P0.

# 12. Public API Internal Aplikasi (BUKAN Meta Endpoints)

| Method | Endpoint | Output inti |
|---|---|---|
| POST | `/api/v1/uploads` | `{upload_id, preview_url}` |
| POST | `/api/v1/uploads/{id}/selection` | `{selection_id, mask_url, method}` |
| POST | `/api/v1/assets/generate` | `202 {job_id}` |
| GET | `/api/v1/jobs/{job_id}` | `{status, stage, mode, attempts, result}` |
| GET | `/api/v1/assets/{id}` | `{asset_id, preview_url, asset, warnings}` |
| PATCH | `/api/v1/assets/{id}` | Edit name, tags, origin dan motion choices |
| POST | `/api/v1/assets/{id}/compile` | `{export_id, schema_valid, qa_warnings}` |
| GET | `/api/v1/assets/{id}/export` | Zip stream |
| POST | `/api/v1/playground/validate` | Import contract report dari file ZIP atau asset_id |
| DELETE | `/api/v1/assets/{id}` | 204 setelah penghapusan file sesuai retention policy |

**Job state:** `queued → segmenting → stylizing → postprocessing → enriching → compiling → completed` serta `failed_retryable`, `failed_final`, `cancelled`. Mode per stage `live|cached|fallback|fixture` disimpan dan tampil. Progress persen estimasi, bukan janji latensi.

**Error contract:** kode stabil seperti `INVALID_IMAGE`, `MODEL_UNAVAILABLE`, `MASK_EMPTY`, `STYLE_UNUSABLE`, `SPRITE_INVALID`, `EXPORT_SCHEMA_FAIL`, `ZIP_VERIFICATION_FAIL`, `EXTERNAL_RATE_LIMIT`; setiap error memiliki pesan recovery dan logging aman.

# 13. Tech Stack & Repo Structure

| Layer | MVP technology | Keputusan |
|---|---|---|
| Frontend | Vite + React + TypeScript | Inspector, timeline control, asset download |
| Preview | Phaser 3 | Konsumen paket independen dan motion renderer |
| Backend | Python 3.11+ + FastAPI | Jobs, security, model providers, ZIP |
| Image utils | Pillow / OpenCV | Alpha, resize, masks, bounds, hashing |
| Model calls | Meta Model API; adapter | Tidak bocorkan key ke browser |
| Validation | JSON Schema / Pydantic | Shared schema dan typed models |
| Storage | Local SQLite + private assets | Cukup untuk demo; records bisa dihapus |
| Tests | pytest + Vitest + Playwright | Contract, flow, E2E |

```text
real2playable/
├── apps/
│   ├── web/src/{capture,selection,inspector,motion,export}/
│   ├── playground-phaser/src/     # independent ZIP consumer
│   └── api/app/{routes,jobs,providers,storage}/
├── packages/
│   ├── compiler-core/             # pure processing, no battle code
│   ├── asset-schema/              # schema + fixtures
│   ├── asset-exporter/            # builds/validates ZIP
│   └── optional-arena-extension/  # P1, can be omitted entirely
├── tests/{unit,integration,e2e,fixtures}/
├── docs/{PRD.md,CONTRIBUTIONS.md,BUILD_LOG.md,
│         ASSET_PROVENANCE.csv,THIRD_PARTY_NOTICES.md,
│         DEMO_SCRIPT.md,EVALUATION.md}
├── .env.example
├── .gitignore
└── README.md
```

# 14. Data Privacy, Hak, dan Keamanan

- Foto hanya yang dimiliki pengguna atau dengan izin yang dapat dibuktikan; jangan otomatis mempublikasikan upload ke repo.
- Perlihatkan bahwa gambar dikirim ke penyedia Meta Model API; minta persetujuan yang wajar untuk penggunaan foto.
- Strip EXIF dan batasi ukuran file; decode ulang supaya payload bukan file jahat. Batas 10MB, megapiksel dibatasi di server, cek MIME **berdasarkan isi**.
- Kunci API hanya environment server. Rate limiting, batas retry, job concurrency, quota agar demo tidak menguras biaya.
- Semua asset path adalah identifier terverifikasi; hindari path traversal/zip-slip/SSRF.
- Waktu simpan mentah usulan maksimal 24 jam untuk demo anonim; **validasi mekanisme delete sebelum mengklaim penerapan**.
- Ekspor sumber foto **opt-in**, default tidak disertakan. Manifest tidak memasukkan informasi pribadi dan kredensial.
- Filter konten berhak cipta/merek/objek sensitif sesuai kebijakan; larangan klaim lisensi komersial menyeluruh.
- Catat lisensi font, ikon, audio, template, contoh asset, engine dan SDK ke `THIRD_PARTY_NOTICES.md`.

# 15. Nonfunctional Requirements dan Quality Bar

| Aspek | Target desain MVP (belum terukur) |
|---|---|
| Alpha/integritas | Semua ekspor yang dinyatakan sukses lolos checker validasi PNG + JSON + ZIP |
| Scene import | Minimal 9/10 aset uji dapat dibuka di Phaser importer yang sama |
| Kualitas foto | Sistem meminta ulang foto jika blur/occluded/mask rusak |
| Recognizability | Target ≥80% reviewer cocokkan kartun ke objek asal dalam eksperimen blinded |
| Portabilitas | ZIP dapat di-unzip pada Windows/macOS/Linux; paths relatif standar |
| Input error | Tidak ada hard crash dari file korup/large image; kesalahan terbaca |
| Observation | Timing tiap stage, model ID, job status, dan mode tersedia untuk audit |
| Accessibility | Upload tanpa kamera, keyboard nav, reduced motion, checkerboard berkontur jelas |
| Cost | Batas generation quota, catat jumlah model calls dan biaya perkiraan per job |
| Latency | **Ukur hasil nyata sebelum menetapkan atau mengiklankan SLA** |

# 16. Problem Validation — Bandingkan dengan AI Chat Biasa

**Ini bagian diferensiasi yang paling penting.** Benchmark harus membandingkan produk dengan alternatif yang memang sudah ada, bukan berpura-pura photo-to-cartoon adalah invensi baru.

**Tugas standar:** Beri peserta foto objek, lalu minta: `buat sprite 512 RGBA yang dikenali, atur anchor, buat satu motion state dan impor ke scene Phaser sederhana`.

| Arm | Workflow | Catat |
|---|---|---|
| A — Manual | Editor gambar + aset awal biasa | Total waktu, langkah, errors, editing effort |
| B — Generative AI umum | Kirim foto ke image AI, lalu edit hasil dan impor manual | Total waktu, repeated prompts, correction count |
| C — Real2Playable | Upload foto dan compile ke paket siap import | Total waktu dan kegagalan export/import |

**Metodologi:** Bila memungkinkan 5–8 indie developers, urutan tugas diacak, foto objek setara tingkat sulitnya, stopwatch dari foto ke aset terlihat di scene, rekam kegagalan, pengulangan dan waktu tunggu. Jika hanya ada internal study, beri label internal. Peserta yang tidak berhasil tetap masuk data, bukan dibuang.

**Metrik keberhasilan utama:** median **time-to-import**, porsi import berhasil, jumlah langkah edit manual, kesamaan bentuk, dan preferensi peserta. Laporkan n kecil dan keterbatasan eksperimen. **Jangan mengklaim X% lebih cepat sebelum ada hasil.**

# 17. Acceptance Tests, Release Gates dan Bukti

| Test | Input | Expected result |
|---|---|---|
| AC-01 Upload aman | JPG/PNG/WEBP valid + korup | Valid diproses; korup ditolak tanpa crash |
| AC-02 SAM selection | Foto beberapa objek | Target terisolasi, mask ditinjau/dikoreksi |
| AC-03 Muse stylize | Objek nyata pilihan | Style cartoon diterapkan, hasil bisa direview; mode live ditandai |
| AC-04 Alpha integrity | Sprite selesai | Transparansi nyata, bounds tak kosong, tidak terpotong |
| AC-05 Core separation | Export core-only | Tidak ada field combat, rarity, role, atau lore |
| AC-06 Motion schema | `idle_bob` | t_ms naik, nilai valid, playback dalam Phaser konsisten |
| AC-07 ZIP checksums | Paket diekstrak ulang | Semua hashes, MIME, paths dan refs valid |
| AC-08 Consumer test | ZIP extracted | Phaser menampilkan sprite dan menggerakkan timeline tanpa backend generation |
| AC-08b Atlas 4 frame | Motion enabled vs static | `spritesheet.png` + `frames.json` valid untuk motion, optional/absent untuk static; semua frame dari transform sprite tunggal diberi label |
| AC-09 Extension isolation | Arena extension disabled | Core generator & importer tetap berfungsi |
| AC-10 Model outage | API timeout/rate limit | Retry atau error/fallback labeled; bukan hasil palsu |
| AC-11 Privacy | Delete asset | File dan record terkait dihapus sesuai retention yang dijanjikan |
| AC-12 Submission | Repo public + demo 180 detik | Fitur di video dapat dicocokkan dengan repo dan build log |

**Definition of Done utama:** *Setidaknya tiga dry-run dari foto berbeda telah berhasil diekspor, ZIP dibuka ulang, importer Phaser memuatnya, dan animation timeline P0 dimainkan. Semua hasil/limitasi tercatat.*

# 18. Sprint Plan 27 Okt – 4 Nov 2026

| Hari | Fokus | Exit proof |
|---|---|---|
| **27 Okt** | Repo baru, asset contract & schema, foto uji legal, akses Meta API | Komit awal + model smoke tests |
| **28 Okt** | Upload, select, SAM mask, UI compare | Mask nyata tampil dan bisa dikoreksi |
| **29 Okt** | Muse Image edit + alpha normalizer | 1 `sprite.png` 512 RGBA valid |
| **30 Okt** | Muse Spark metadata terbatas + Inspector | Object tags validated, origin adjustable |
| **31 Okt** | Motion presets + `animations.json` | 3 preset terbaca unit tester |
| **1 Nov** | Export ZIP + schema/hash verifier | Fresh unzip passes validator |
| **2 Nov** | Independent Phaser consumer + regression suite | 3 real photos imported |
| **3 Nov** | Baseline benchmark, bugfix, 180s video recording | Usability evidence + rough cut video |
| **4 Nov** | Smoke tests, public repo audit, final video and submit | Submission proof and no unlicensed assets |

**Prioritas cut saat tertinggal:** Drop Arena, alternative styles, custom atlas states P1, native camera, Godot adapter. **Jangan** drop keterbukaan source, valid ZIP, importer nyata, Meta model usage, dan transparansi demo.

# 19. Risiko dan Mitigasi

| Risiko | Impact | Mitigasi / cut |
|---|---|---|
| API key tidak diizinkan panggil model | Blocker | Test 27 Okt; periksa akun/quotas; jangan klaim integrasi jika tidak live |
| Mask cacat | High | Re-select + manual correction yang diberi label |
| Cartoon berubah terlalu jauh | High | Prompt preserve cues; compare; regenerate capped |
| Alpha salah / semu | High | Re-mask output + compute bounds & alpha check |
| Generated motion poses inkonsisten | High | **Tidak menjadi bagian P0**; gunakan runtime tween saja |
| Animator dianggap cuma CSS demo | Medium | Generic timeline JSON, independent importer, export/integration proof |
| Format hanya bekerja di proyek sendiri | High | Imported consumer isolated dari backend; docs schema validated |
| “Why not just AI image?” | High | Demo pembanding dan waktu workflow, bukan fokus promosi stylization |
| Licenses + personal photo leaks | High | Rights/provenance logs, EXIF stripping, public repo audit |
| Video gagal menggambarkan fitur | High | Storyboard 180 detik, show live model & ZIP/import, screen recording |
| Scope meledak | High | P0-first; P1 Arena boleh sepenuhnya ditiadakan |

# 20. Demo Video 180 Detik (Skenario P0)

| Time | Aksi yang harus tampak | Narasi pesan |
|---|---|---|
| 0:00–0:20 | Masalah: AI image bukan sprite terintegrasi | “A pretty picture is not a game-ready asset.” |
| 0:20–0:45 | Foto benda nyata / upload dan pilih objek | Mulai dari foto yang baru, milik tim |
| 0:45–1:15 | SAM mask + Muse Image stylization | Perlihatkan Meta API aktif; jangan fake progress |
| 1:15–1:40 | Inspector alpha, anchor dan original recognition | Compiler memperbaiki masalah teknis output gambar |
| 1:40–2:05 | Tambah motion preset dan run preview | Ini tween terstruktur, bukan pose AI |
| 2:05–2:35 | ZIP download, inspect manifest, load di Phaser **independen** | “Game-ready, engine-neutral data.” |
| 2:35–2:50 | Benchmark yang *sudah diukur* bila tersedia | Tampilan data real; jika belum, tampilkan test results teknis |
| 2:50–3:00 | Contributions + repo publik + penutup | “From real objects to reusable game assets.” |

**Aturan demo:** Jangan gunakan hasil cache tanpa disclosure. Jika waktu model terlalu lama, gunakan rekaman terpisah yang diberi label dan tunjukkan satu real request sesuai kemampuan waktu dan aturan penyelenggara.

# 21. Repository, Provenance & Team Contributions

File submission minimal: `README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/CONTRIBUTIONS.md`, `docs/BUILD_LOG.md`, `docs/ASSET_PROVENANCE.csv`, `docs/THIRD_PARTY_NOTICES.md`, `docs/EVALUATION.md`, `.env.example`, automated tests, schema, importer, demo link.

**Contribution ledger:** fitur, owner, commit sha, dibuat kapan, path, library yang dipakai, bukti demo. AI-assisted development dan model usage dicatat jujur. Starter/template buatan sebelum 26 Okt **tidak boleh** ditampilkan sebagai pekerjaan baru.

**Third-party audit:** Periksa foto, plugin, game engine, font, ikon, demo musik/SFX, prompts terproteksi hak cipta, generated art, editor library. Hindari menggunakan logo/karakter berhak cipta yang tidak berizin.

# 22. Go/No-Go dan Open Questions

**GO jika:** Satu foto baru → SAM nyata → Muse Image nyata → sprite transparan → ZIP valid → Phaser menampilkan aset + motion, plus repo public, kontribusi jelas, hak penggunaan dan demo valid.

**NO-GO untuk klaim produk penuh jika:** hanya menghasilkan kartun tunggal, output harus dicopas manual, animasi diklaim multi-pose padahal tween, importer cuma membaca database internal, atau fitur Meta sebenarnya mock.

**Open questions untuk eksperimen:**

- Apakah Muse Image mempertahankan identitas objek pada 10 foto yang bervariasi? Perlu uji.
- Apakah pengguna benar-benar membutuhkan procedural motion, atau lebih mementingkan integritas sprite/export? Uji dengan 5–8 peserta.
- Seberapa banyak konsep `character` vs `prop` digunakan? Pilihan UI diputuskan berdasarkan feedback.
- Berapa median waktu dan biaya per aset di akses API yang tersedia? Ukur, jangan tebak.
- Apakah 4-frame procedural atlas P0 cukup untuk developer, atau mereka hanya memerlukan transform timeline? Uji dan revisi setelah MVP.

# 23. Dev Handoff — 48 Jam Pertama

1. Mulai repository baru di dalam window 26 Okt–4 Nov; buat changelog dan tracker kontribusi.
2. Jalankan smoke call Meta `sam-3.1`, `muse-image-1.0`, `muse-spark-1.3` dengan satu foto milik tim; simpan log aman dari request id, waktu, dan model.
3. Buat asset contract + strict validator, baru komponen UI; beri pengujian terhadap JSON sample pada bagian 8.
4. Implementasikan image normalizer (alpha, bounds, origin) dan ZIP packaging deterministik.
5. Buat independent Phaser consumer dari **ZIP yang diekstrak** lebih awal, bukan terakhir.
6. Hubungkan pipeline model dengan compiler; warnai setiap stage live/cache/fallback.
7. Implementasikan preset motion dan alpha-quality inspector.
8. Jika seluruh jalur lulus 3 kali, baru pertimbangkan optional Arena extension.

# 24. Referensi Resmi dan Disclaimer

- Meta Global AI Developer Hackathon, tema/track/deadline: https://dev.meta.ai/events/global-hackathon
- Meta Model API overview (Muse Spark, Muse Image, SAM): https://dev.meta.ai/docs/overview
- Meta SAM 3.1 segmentation: https://dev.meta.ai/docs/sam/overview
- Meta Muse Image editing/generation: https://dev.meta.ai/docs/image-generation
- Meta Muse Image overview dan stochastic consistency caveat: https://dev.meta.ai/resources/blog/build-with-muse-Image

**Diperiksa:** 27 Oktober 2026. Dokumentasi resmi harus dibuka ulang saat coding; jalur permission dan tarif bergantung akses akun. Isi participant guide milik pengguna tetap menjadi acuan utama aturan kompetisi, terutama originalitas dan video.

---

## Appendix A — Core vs Optional Extension (Contoh)

**`extensions/arena_demo.json` (hanya apabila plugin diaktifkan):**

```json
{
  "extension_schema": "arena-demo/0.1",
  "asset_id": "ast_spoon_001",
  "role": "striker",
  "rarity": "rare",
  "stats": {"hp": 90, "attack": 12, "defense": 5, "speed": 8},
  "attack_type": "melee",
  "lore": "A spoon recruited to defend a tiny kitchen kingdom.",
  "behavior_template": "approach_then_attack"
}
```

Fields ini sengaja **tidak muncul** dalam core JSON. Jika dihapus, aset masih dapat dibuka dan dimotion oleh Phaser Playground.

## Appendix B — Event Telemetry Minimal

```json
{
  "event": "asset_compile_completed",
  "timestamp": "2026-10-27T12:00:00+07:00",
  "asset_id": "ast_spoon_001",
  "stage_modes": {"sam": "live", "muse_image": "live", "muse_spark": "live"},
  "export_valid": true,
  "phaser_import_valid": true,
  "duration_ms": null
}
```

Contoh ini **ilustrasi format data**, bukan klaim bahwa sebuah job nyata telah sukses. Hindari menanam data contoh tersebut sebagai hasil evaluasi.

## Appendix C — Kriteria Cut-Line Final

**MVP yang layak didemokan:** satu objek, satu style, satu PNG RGBA, satu manifest generik, 2–3 motion presets, atlas 4-frame jika motion digunakan, satu ZIP, satu independent Phaser importer, dan bukti panggilan Meta.

**Bukan MVP:** konten 3v3, karakter langka, item loot, procedural level, multiplayer, full 2D skeletal animation atau semua engine sekaligus.
