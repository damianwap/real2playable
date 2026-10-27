# Kontribusi

Implementasi dibuat dengan bantuan coding assistant pada 27 Oktober 2026, dari repo yang awalnya hanya berisi `Real2Playable_PRD_v1.3.md`. Dokumen PRD berasal dari pengguna dan tidak diklaim sebagai karya implementasi assistant.

| Komponen | Kontribusi | Berkas | Pihak ketiga |
|---|---|---|---|
| Studio & desain | Integrasi utama, React UI, upload/inspector, responsive, motion preview, export/library | `src/`, konfigurasi root | React, Vite, Lucide, font Google |
| Backend | Penyimpanan, private files, model adapters, job API, compiler, alpha QA, ZIP | `apps/api/` | FastAPI, Pillow, Pydantic, httpx, SAM parser |
| Consumer | Validator ZIP independen dan scene Phaser | `playground/` | Phaser, fflate |
| Ilustrasi | Source drawing melalui kode Pillow, tanpa foto eksternal / output model | `apps/api/fixtures.py` | Pillow |
| Verifikasi | Contract/security tests serta smoke browser aktual | `tests/`, `docs/EVALUATION.md` | pytest, browser automation |

Assistant menggunakan dua pekerja paralel untuk backend compiler dan consumer Phaser. Integrasi utama menemukan dan memperbaiki ketidaksesuaian timestamp frame atlas melalui uji browser end-to-end.

Pada implementasi awal, model Meta belum dijalankan karena key belum tersedia. Setelah pengguna menambahkan kredensial, sesi perbaikan memverifikasi SAM label/box serta pipeline Muse Image → SAM re-mask → Muse Spark dengan ilustrasi kontrol orisinal; detail ada di `EVALUATION.md`. Dependency/library bukan karya tim. Tidak ada commit, repo publik, identitas anggota tim, tautan video, hasil studi pengguna atau submission yang dibuat/dikarang. Tim harus mencatat kontribusi manusia dan commit aktual pada saat publikasi; dokumen ini hanya merekam kontribusi yang teramati.
