# Arsitektur dan kontrak

## Batas komponen

Studio (`src/`) menggunakan API publik FastAPI, tidak memasukkan key model ke browser. API (`apps/api/app.py`) mengelola job asyncio dan record SQLite (`store.py`) pada folder privat `.data/`. `meta.py` bertanggung jawab atas panggilan Responses API; `compiler.py` bertanggung jawab atas transformasi deterministik, pixel bounds, hashing dan packaging. Model tidak menetapkan geometri.

Consumer (`playground/`) adalah entry Vite terpisah. Ia hanya memuat ZIP lewat input file atau endpoint export, membuka PNG / JSON, memverifikasi hash / schema / bounds, kemudian membuat scene Phaser. Ia tidak mengimpor komponen React, fungsi backend, database, atau object asset internal.

## Jalur input

- Fixture: original Pillow artwork → normalizer → inspector.
- Manual: foto → validasi / EXIF strip → box crop → review → normalizer. Latar dalam box tetap ada; provenance `fallback`.
- Live: foto → SAM selection → review → Muse Image → SAM alpha re-mask → Muse Spark descriptive metadata → normalizer. Key yang tidak ada menghentikan panggilan live; tidak otomatis mengganti hasil.
- Auto: foto → saran label vision → SAM by label → review. Label terisi otomatis dan dapat diubah sebelum generate; keberhasilan live belum diverifikasi.

Re-mask output tidak memakai ulang label foto. Muse diminta menggambar subjek di tengah pada latar netral; SAM diminta menyegmentasi latar melalui titik positif di sudut dan titik negatif di tengah. Compiler mengambil komplemen mask SAM, mempertahankan alpha asli, lalu menyisakan komponen terhubung di pusat untuk membuang fragmen tepi yang terlepas. Mask yang menghapus pusat atau masih menghubungkan subjek ke sudut kanvas ditolak. Ini bukan mask rectangle palsu atau pengganti inference: mask berasal dari SAM, cleanup berasal dari compiler. Detail yang terlepas dari subjek tetap perlu diperiksa manusia.

Gambar Muse sebelum alpha disimpan privat dalam direktori job. Kegagalan output alpha memiliki kode khusus `OUTPUT_ALPHA_NO_MASK` / `OUTPUT_ALPHA_INVALID`, sehingga tidak mengarahkan pengguna mengganti seleksi foto yang sudah berhasil. Tidak ada retry berbayar otomatis.

Normalisasi mempertahankan aspek, area subjek maksimum 416×416, full canvas 512×512 dengan margin. Alpha bounds dihitung dari piksel final. Origin default (0.5, 0.90625), dapat diubah. Motion berada di JSON engine-neutral, tanpa combat stats atau extension arena.

## Ekspor

Schema 1.3.0; Pydantic strict models ada di `models.py` / `schema.py`. Paket statis berisi enam berkas; paket bermotion menambah dua berkas atlas. Manifest memuat seluruh berkas kecuali dirinya, dengan ukuran, MIME dan SHA-256. Compiler membuka ulang ZIP untuk pemeriksaan integritas. Importer browser melakukan verifikasi terpisah termasuk ZIP central directory sebelum dekompresi, path, symlink, ukuran, references, image headers, alpha bounds dan timeline.

## Phaser: sprite statis dari hasil ekstraksi

Serve hasil unzip melalui HTTP (bukan URL `file://`). Contoh minimal scene Phaser 3:

```javascript
class AssetScene extends Phaser.Scene {
  preload() {
    this.load.image('sprite', '/assets/my-object/sprite.png');
    this.load.json('asset', '/assets/my-object/asset.json');
    this.load.json('motion', '/assets/my-object/animations.json');
  }
  create() {
    const asset = this.cache.json.get('asset');
    this.add.image(400, 300, 'sprite')
      .setOrigin(asset.sprite.origin.x, asset.sprite.origin.y);
  }
}
new Phaser.Game({ type: Phaser.AUTO, width: 800, height: 600, scene: AssetScene });
```

Untuk playback timeline lengkap, lihat `playground/main.ts` dan evaluator `playground/package.ts`. Interpolasikan keyframe linear dengan waktu ms, gunakan `loop` untuk pengulangan, aplikasikan translate piksel dan scale terhadap origin full canvas. Frame baked di atlas berasal dari sprite yang sama, bukan pose baru.

## Keamanan / batas operasi

API mendengarkan localhost, menolak host / origin non-lokal, membatasi byte multipart, memeriksa MIME berdasarkan decode, dan menggunakan identifier/path allowlist. Key hanya environment backend. Output model dianggap tidak tepercaya, diparsing ke schema deskriptif. Tidak ada eksekusi kode impor.

Ini demo lokal single-user. Tidak ada autentikasi / tenant isolation, auto-retention, cloud storage, quota billing atau janji SLA. SQLite/file bertahan sampai dihapus eksplisit. Job yang terputus server harus diulang secara eksplisit. API yang error tidak menghasilkan status live sukses palsu.
