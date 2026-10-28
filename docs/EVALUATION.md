# Evaluasi implementasi

Tanggal: 27 Oktober 2026. Pengujian internal oleh coding assistant; bukan studi pengguna atau validasi pasar.

## Bukti yang dijalankan

| Skenario | Hasil teramati |
|---|---|
| Build React / TypeScript dan entry Phaser | `npm run build` berhasil. Warning ukuran chunk Phaser tetap terlihat; tidak disembunyikan. |
| Kontrak dan keamanan backend | 12 tests lulus, mencakup kontrak awal, mask lokal dan alpha asli, komplemen background, respons non-mask/kosong, error output alpha, penolakan mask latar dan cleanup fragmen terpisah. Satu warning deprecation Starlette/httpx test transport. |
| Inspector browser desktop | Source comparison menampilkan dua gambar; bounds/origin dapat ditampilkan; rename disimpan; motion ditambahkan; ZIP terkompilasi dan inventori ditampilkan. |
| Tiga contoh independen | Petal the Cactus, Mallow Mushroom, Sunday Mug masing-masing diekspor menjadi ZIP, divalidasi 4/4 pada consumer terpisah, dirender pada satu canvas Phaser dan timeline idle bergerak. **Ketiganya ilustrasi fixture, bukan tiga foto live.** |
| Upload manual end-to-end | Gambar PNG sintetis 480×360 dibuat khusus smoke, diunggah lewat input file browser, dicrop, direview, diterima tanpa consent provider, dinormalisasi, diekspor, diverifikasi 4/4 dan dirender Phaser. Hasil dilabeli fallback; latar crop dipertahankan. |
| Offline consumer | ZIP hasil ekspor diberikan ke input file consumer setelah query asset dihapus. Verifikasi lulus; **0 request API** sesudah pemilihan file. |
| Tampered ZIP | Perubahan byte sprite dengan manifest lama ditolak: `SHA-256 mismatch for sprite.png`. |
| Traversal ZIP | Berkas `../outside.md` ditolak: `Unsafe ZIP path`. |
| Corrupt ZIP | Empat byte bukan ZIP ditolak dengan pesan batas/format ZIP. |
| Mobile 390×844 | Screenshot aktual; lebar dokumen 390 px (tanpa horizontal overflow). Kartu motion dapat diaktifkan dengan tap; area tombol motion 44 px. |
| Library / keyboard | Search tanpa hasil memberi empty state; clear search berfungsi. Navigasi icon-only tetap memiliki nama aksesibel; dialog dapat ditutup dengan Escape. |
| Hapus lewat UI | Aset upload sintetis dihapus melalui confirmation dialog; GET aset sesudah penghapusan mengembalikan HTTP 404. Data smoke sementara dibersihkan. |
| Reduced motion | Dengan media `prefers-reduced-motion: reduce`, preview studio dibuka dalam keadaan pause. |
| Consumer mobile | ZIP asli terverifikasi 4/4 pada 390 px; canvas Phaser tampil dan lebar dokumen tetap 390 px. |
| Build produksi di browser | `npm run preview` melayani kedua entry produksi; studio berhasil compile, consumer hasil build memverifikasi 4/4 dan merender canvas Phaser. Tidak ada runtime error browser pada kedua halaman produksi. |

## Bug integrasi yang ditemukan dan diperbaiki

Compiler awal membake atlas pada t=0, 1/4, 2/4, 3/4 durasi, sedangkan importer mengharuskan empat timestamp mencakup awal dan akhir. Browser menolak paket meski test backend awal lulus. Compiler diperbaiki menjadi t=0, 1/3, 2/3, akhir durasi; validasi backend dan regression assertion ditambahkan. Ketiga fixture kemudian lolos consumer nyata.

## Perbaikan alur SAM dan Generate artwork

- Frontend sebelumnya selalu mengirim box default bahkan ketika pengguna memilih SAM berdasarkan label; adapter memilih prompt box sehingga label diabaikan. Sekarang tersedia mode **SAM by label** tanpa box dan **SAM by box** dengan overlay serta kontrol box yang terlihat.
- Generate artwork sebelumnya diam-diam disabled ketika consent belum dicentang. Sekarang klik memberi pesan yang dapat ditindaklanjuti dan memfokuskan checkbox; uji browser mencatat **0 request generasi** tanpa consent.
- Decoder sebelumnya menyebut respons non-kosong tanpa mask sebagai `SAM_NO_MATCH`. Regression test gagal sebelum perbaikan dan lulus setelah respons tersebut diklasifikasikan sebagai `SAM_INVALID_MASK`. Output yang benar-benar kosong tetap `SAM_NO_MATCH`.
- Uji live menggunakan **ilustrasi kontrol orisinal**, bukan foto pengguna: input 768×640, prompt `potted cactus`. Request by-label tidak menyertakan box dan menghasilkan mask live dengan 55.281 piksel foreground serta 436.239 piksel transparan. Box yang dikirim sesuai empat kontrol terlihat juga menghasilkan mask live.
- Klik Generate artwork mengembalikan HTTP 202 dan job selesai dengan stage Meta sukses: `sam_selection`, `muse_image_edit`, `sam_alpha_remask`, `muse_spark_suggestions`. Normalisasi menghasilkan sprite 512×512, ekspor ZIP lolos 4/4 pada importer independen, dan motion idle dimainkan di Phaser.
- Model live dijalankan setelah kredensial ditambahkan pengguna. Tidak ada key atau foto pribadi dicetak dalam bukti ini. Keberhasilan satu ilustrasi kontrol tidak menjamin semua objek akan ditemukan.

## Kasus aktual: gagal setelah Muse berhasil

- Riwayat job pengguna membuktikan `muse_image_edit` sukses dan `sam_alpha_remask` gagal dengan no-match; ini bukan kegagalan seleksi foto awal. Perbaikan frontend saja tidak menyelesaikan stage tersebut.
- Uji box penuh berhasil secara teknis tetapi memilih latar; uji titik foreground tunggal hanya mengambil sebagian subjek. Keduanya ditolak sebagai hasil visual yang tidak layak, bukan dijadikan bukti sukses hanya karena ZIP valid.
- Strategi final menyegmentasi latar dengan prompt spasial SAM, mengambil komplemen alpha dan membersihkan komponen yang terlepas dari subjek tengah. Regression test membuktikan alpha asal dipertahankan, mask latar terbalik ditolak, dan fragmen tepi dibuang tanpa memotong subjek utama.
- Gambar Muse dan hasil SAM dari job disimpan privat dan digunakan ulang untuk perbaikan artefak; tidak ada generasi Muse tambahan pada langkah perbaikan tersimpan tersebut. Metadata Spark diperbarui pada sprite yang sudah diperbaiki. Manifest membedakan stage cached, pemrosesan compiler, dan model live.
- Pemeriksaan visual pada input aktual memperlihatkan seluruh kelompok objek, bukan latar kosong atau satu fragmen. Sprite akhir 512×512 mempunyai bounds terukur 416×304 dan sudut transparan. ZIP diperiksa ulang, importer independen lulus 4/4 dan motion dimainkan di Phaser.
- Artefak uji awal yang salah dihapus tanpa menghapus sumber pengguna; endpoint foto sumber tetap HTTP 200. Hasil akhir disimpan untuk pengguna. Ini satu kasus aktual, bukan bukti keberhasilan universal atau exit gate tiga foto.

## Belum dibuktikan

- Generalisasi kualitas SAM / Muse Image / Muse Spark pada foto nyata yang beragam, izin model akun lain, rate limit dan kualitas segmentasi pada setiap foto pengguna. Ilustrasi kontrol dan satu kasus alpha artwork aktual telah diperiksa; detail terpisah dan tepian masih memerlukan review.
- Saran label vision dan alur auto-detect pada model live (kontrak endpoint dan parsing diuji tanpa key; keberhasilan live belum dibuktikan).
- Exit gate PRD tiga foto baru → SAM → Muse Image → Spark → transparent sprite → Phaser.
- Human likeness review, perbandingan workflow manual vs AI chat, time saved, latency SLA, biaya model atau style consistency.
- Repo publik, commit history tim, video demo, submission / eligibility event.
- Deployment multi-user publik, tenant isolation, encrypted storage atau automatic retention.

Tidak ada klaim “lebih cepat X%”, kualitas universal AI atau kelayakan submission. Bukti awal memakai fixture; bukti lanjutan meliputi pipeline live pada ilustrasi kontrol serta perbaikan artwork dari satu input aktual, belum tiga foto baru.
