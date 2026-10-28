# Real2Playable

**From real objects to reusable, animation-ready 2D game assets.**

Website hackathon berdasarkan [PRD v1.3](Real2Playable_PRD_v1.3.md). Studio React untuk inspeksi aset, compiler Python untuk PNG + JSON + ZIP, dan aplikasi Phaser terpisah yang membaca **ZIP ekspor**, bukan state generator.

## Jalankan

Prasyarat: Node.js 22+ dan Python 3.11+.

```sh
npm install
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

macOS / Linux:

```sh
.venv/bin/python -m pip install -r requirements.txt
```

```sh
npm run dev:all
```

Buka **http://127.0.0.1:5173**. Launcher memilih Python `.venv` otomatis. Backend mendengarkan `127.0.0.1:8000`; Vite mem-proxy `/api`. Menjalankan terpisah: `npm run dev:api` dan `npm run dev`.

## Yang dapat digunakan tanpa API key

- Tiga ilustrasi contoh orisinal: **Petal the Cactus**, **Mallow Mushroom**, **Sunday Mug**, seluruhnya dilabeli **Demo fixture**, bukan foto dan bukan hasil AI.
- Upload JPG / PNG / WebP maksimal 10 MB / 24 megapiksel, pemeriksaan isi file, decode ulang dan penghapusan EXIF.
- Pemilihan objek memakai box persentase, preview hasil crop untuk diterima/ditolak, dan jalur **manual fallback** yang eksplisit. Crop manual **tidak menghapus latar di dalam box dan tidak mengkartunkan foto**.
- Inspector: source comparison, checkerboard, nama, jenis, tags, origin, bounds alpha terukur, provenance dan warnings.
- Tiga motion preset: `idle_bob`, `interact_pulse`, `impact_flash`. Semua berupa transformasi prosedural satu sprite; dapat dihapus untuk aset statis.
- ZIP PNG RGBA 512×512 + metadata + timeline + SHA-256, dengan atlas empat frame jika motion dipilih. Compiler membuka ulang ZIP untuk validasi.
- Library lokal, download tanpa akun, dan penghapusan aset beserta sumber terkait.
- Playground Phaser independen: unggah ZIP lokal, verifikasi file, pilih motion, play/pause/restart/scrub, origin dan grid. File ZIP diproses di browser tanpa mengunggahnya ke server.

## Model Meta: konfigurasi dan batas bukti

Salin `.env.example` menjadi `.env`, isi `MODEL_API_KEY` **di server saja**, lalu restart API. Jangan gunakan prefix `VITE_` untuk secret.

Adapter mengikuti [Responses API Meta](https://dev.meta.ai/docs/overview):

1. `sam-3.1`: seleksi box/label, decoding mask menggunakan parser resmi `meta-sam-parser`.
2. `muse-image-1.0`: edit cutout menjadi gaya `storybook_toy_v1`, lalu SAM menyegmentasi latar artwork dengan prompt spasial; compiler mengambil komplemennya dan mempertahankan komponen subjek di tengah.
3. `muse-spark-1.3`: saran metadata deskriptif dengan schema ketat; bukan geometri atau gameplay.

**Verifikasi live:** SAM 3.1 (label dan box), Muse Image, SAM alpha re-mask, serta Muse Spark telah berhasil dijalankan pada ilustrasi kontrol. Perbaikan alpha juga diverifikasi pada artwork dari input aktual yang sebelumnya gagal, termasuk pemeriksaan visual, ZIP dan playback Phaser. Artifact yang diproses ulang memakai hasil Muse/SAM tersimpan dan provenance cached yang eksplisit. Ini belum membuktikan kualitas pada tiga foto baru sebagaimana exit gate PRD; lihat [EVALUATION](docs/EVALUATION.md).

Status “configured” hanya berarti key tersedia, bukan jaminan akses setiap model. Hanya stage yang benar-benar berhasil dipanggil mendapat provenance live. Tidak ada pengganti otomatis. Menggunakan fitur AI (Suggest, SAM, Auto-detect, Generate artwork) otomatis mengirim gambar ke Meta tanpa checkbox persetujuan; crop manual tidak memanggil Meta sama sekali.

### Pilih objek dan jalankan artwork

- **SAM 3.1 by label:** gunakan satu nama objek singkat, misalnya `mug` atau `potted cactus`. Mode ini tidak mengirim box.
- **SAM 3.1 by box:** atur box yang terlihat agar mengelilingi satu objek. SAM memakai box; nama objek tetap menjadi label aset.
- **Auto-detect:** tanpa mengetik — vision menamai objek utama, lalu SAM mensegmentasinya. Tombol **Suggest** mengisi nama untuk mode lain (membaca area dalam box bila metode memakai box). Keduanya membutuhkan API key; keberhasilan live belum diverifikasi.
- **Manual box / crop:** hanya memotong piksel asli, bukan segmentasi SAM.
- Review seleksi, lalu klik **Generate artwork**. Fitur AI langsung mengirim gambar ke Meta; tidak ada checkbox persetujuan.
- Jika `.env` baru diubah, restart backend lalu refresh halaman. Key hanya dimuat saat startup.
- Respons SAM kosong tetap dilaporkan sebagai no-match. Respons non-kosong yang tidak berisi mask valid dilaporkan sebagai error format, bukan klaim bahwa objek tidak ada.
- `OUTPUT_ALPHA_NO_MASK` / `OUTPUT_ALPHA_INVALID` berarti pembersihan artwork setelah Muse gagal, **bukan** label foto asal tidak ditemukan. Alpha cleanup mengasumsikan satu subjek yang terhubung dan berada di tengah; periksa detail terpisah dan tepian di inspector.

## Paket portabel

```text
name.asset.zip
├── sprite.png                 # 512×512 RGBA
├── thumbnail.webp             # 256×256
├── asset.json                 # core; tidak ada field gameplay
├── animations.json            # timeline dalam ms, atau states kosong
├── manifest.json              # provenance + SHA-256 setiap file lain
├── README.md                  # koordinat, playback, hak penggunaan
└── atlas/                     # hanya jika ada motion
    ├── spritesheet.png        # empat transformasi sprite tunggal
    └── frames.json
```

Origin: 0–1 terhadap full canvas. Bounds / translate / frame rectangles: piksel; +X kanan, +Y bawah. Rotasi: derajat searah jarum jam di layar; scale: multiplier; opacity: 0–1. Timeline diinterpolasi linear. Atlas membake motion pertama pada 0, 1/3, 2/3, dan akhir durasi; JSON memuat seluruh motion terpilih. Manifest tidak self-hash. Foto sumber tidak disertakan.

Buka `/playground/` dan pilih ZIP yang diunduh, atau gunakan **Test in playground**. Tautan `?asset=ID` hanya mengambil endpoint ekspor; setelah unzip, consumer tidak membaca data internal compiler. Contoh integrasi tersedia di [arsitektur](docs/ARCHITECTURE.md).

## Verifikasi

```sh
npm run build
# Windows
.venv\Scripts\python.exe -m pytest tests -q
# macOS / Linux
.venv/bin/python -m pytest tests -q
```

Hasil dan batas bukti tercatat di [EVALUATION](docs/EVALUATION.md). Build produksi dapat dilayani dengan `npm run preview` sementara API tetap berjalan. Phaser hanya dimuat di halaman playground; bundle engine memicu peringatan ukuran chunk Vite, bukan kegagalan build.

## Privasi dan deployment

**Ini workspace lokal single-user, bukan layanan publik multi-tenant.** API membatasi host/origin lokal; belum ada akun, autentikasi atau isolasi tenant. Jangan mengekspos API langsung ke internet. File dan SQLite tersimpan di `.data/`, tidak masuk repo dan tidak dienkripsi. **Tidak ada penghapusan otomatis 24 jam**: gunakan Delete di panel provenance. Upload yang belum menghasilkan aset juga tetap tersimpan di `.data/`. Jangan memakai gambar sensitif dalam demo.

Hasil Muse disimpan privat sebagai artefak job untuk pemeriksaan alpha, tidak disajikan oleh file API atau dimasukkan ke ZIP. Penyimpanan artefak bukan fitur auto-retry atau janji bahwa job yang terputus dapat dilanjutkan otomatis.

Batas lokal: 2 slot pemrosesan model, 8 queued jobs, 30 mutasi/menit per IP; konfigurasi di `.env.example`. Pengguna bertanggung jawab atas hak foto dan output model. Tidak ada klaim lisensi komersial universal.

## Struktur

- `src/`: studio React / TypeScript, inspector dan alur upload.
- `apps/api/`: FastAPI, adapter Meta, fixture asli, SQLite, schema dan compiler.
- `playground/`: consumer Phaser independen dan validator ZIP sisi browser.
- `tests/`: kontrak ekspor, input invalid, integritas dan deletion.
- `docs/`: arsitektur, kontribusi, build log, provenance, notices dan evaluasi.

## Submission hackathon

Arena, adapter Unity/Godot, pose generatif dan kolaborasi cloud tidak diimplementasikan, sesuai batas P0. Repo publik, rekaman 180 detik, pengujian tiga **foto baru melalui model live**, dan pengukuran pengguna belum dilakukan; jangan mengklaim exit gate submission sudah lulus. Lihat [demo script](docs/DEMO_SCRIPT.md) dan [contributions](docs/CONTRIBUTIONS.md).

Kode dan ilustrasi fixture orisinal: [MIT](LICENSE). Dependency dan font memiliki lisensi masing-masing: [third-party notices](docs/THIRD_PARTY_NOTICES.md).
