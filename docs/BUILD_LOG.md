# Build log

## 27 Oktober 2026 — versi implementasi 1.3.0

- Mulai dari direktori berisi PRD v1.3 saja. Tidak ada aplikasi awal atau template proyek yang disamarkan sebagai karya baru.
- Tentukan studio desktop-first: sidebar workspace, source illustration/photo, checkerboard sprite, inspector metadata, procedural motion, portable export. Palette lavender/white; DM Sans dan Space Grotesk.
- Bangun Vite / React / TypeScript, FastAPI / SQLite / Pillow, dan entry Phaser terpisah.
- Implementasikan original fixture illustrations dan manual crop; bedakan `fixture`, `fallback`, `live`, `cached` pada kontrak. Tidak menampilkan klaim model live tanpa panggilan sukses.
- Baca dokumentasi resmi Meta; implementasikan SAM via parser resmi, Muse Image Responses dan Spark structured descriptive output. Kredensial tidak tersedia; live smoke tidak dilakukan.
- Tambahkan explicit consent boundary untuk SAM dan bedakan persetujuan menerima manual selection dari izin mengirim ke Meta.
- Browser smoke menemukan kontrak timestamp atlas yang tidak cocok; perbaiki compiler dan tambahkan regresi.
- Jalankan build produksi, tests backend, desktop/mobile browser, independent ZIP import dan motion untuk tiga fixture, synthetic manual upload, offline import, serta rejection untuk hash tamper/traversal/corruption. Detail hasil di `EVALUATION.md`.
- Dokumentasikan arsitektur, provenance, hak dependency dan batas readiness. Tidak membuat riwayat commit atau tautan submission palsu.

## Perbaikan setelah konfigurasi kredensial

- `.env` terdeteksi pada proses baru; restart backend diperlukan karena proses lama dimulai sebelum key ditambahkan. Verifikasi hanya menampilkan boolean konfigurasi, bukan isi secret.
- Perbaiki request SAM yang sebelumnya mengirim box default tersembunyi dan mengabaikan label. Tambahkan pilihan by-label dan by-box yang eksplisit tanpa fallback otomatis.
- Bedakan output model kosong dari output non-kosong yang tidak memuat mask. Tambahkan regresi pixel geometry / alpha serta klasifikasi error; total delapan tests lulus.
- Generate artwork tetap memerlukan consent, tetapi kekurangan consent sekarang memberi penjelasan dan fokus checkbox, bukan tombol disabled tanpa alasan.
- Uji browser live berhasil untuk label dan box pada ilustrasi kontrol; Muse Image, SAM re-mask dan Muse Spark kemudian menyelesaikan job. ZIP hasil live diverifikasi dan motion dimainkan oleh consumer Phaser independen. Tiga foto baru dan klaim kualitas umum tetap belum dibuktikan.

## Perbaikan alpha pada artwork aktual

- Log job aktual menunjukkan no-match terjadi di `sam_alpha_remask` sesudah Muse sukses, bukan pada seleksi foto. Ubah error output alpha agar tidak menyalahkan label foto.
- Pemeriksaan visual menolak hasil box penuh yang mengambil latar dan titik foreground tunggal yang hanya mengambil bagian objek, walaupun kontrak ZIP lulus.
- Gunakan mask background SAM dengan titik spasial, komplemen alpha, dan cleanup komponen terhubung oleh compiler. Simpan gambar Muse privat untuk pemeriksaan tanpa mengulang generasi gambar yang sudah tersedia.
- Tambahkan regresi komplemen alpha, kegagalan tahap output, penolakan mask latar, dan pembersihan fragmen tepi; total 12 tests lulus.
- Perbaiki artefak input aktual dengan hasil Muse/SAM tersimpan, refresh metadata Spark dan verifikasi visual serta ZIP → Phaser. Artefak percobaan yang salah dihapus, sumber pengguna dipertahankan. Batas kualitas umum tetap dicatat di evaluasi.

Perubahan berikutnya harus menambahkan bukti aktual, bukan mengganti hasil fixture menjadi klaim model live.
