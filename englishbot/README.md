# englishbot — English Companion di WhatsApp

Bot WhatsApp (whatsapp-web.js) yang mengirim soal conversation terjadwal dan menilai jawaban.
Bank soal & penilai jawaban diambil dari app **English 90 Hari** (GitHub Pages), jadi selalu sama dengan app.

- Senin–Jumat: 06–07, 07–09.30, 11.30–13.30, 16.30–19, 19–21.30 WIB (maks 10 soal/hari)
- Sabtu–Minggu: 08–11, 11–14, 14–17, 17–21 WIB (maks 12 soal/hari)
- Satu soal aktif; salah/hampir → kisi-kisi bertahap, soal tetap; benar → soal berikutnya setelah 10 menit
- Soal belum dijawab diingatkan ulang tiap 15 menit (maks 3 per window)
- Review mode: Day 1–20
- Hanya membalas nomor pemilik. Perintah: `soal`, `lewati`, `jeda`, `mulai`, `status`, `bantuan`

## Jalan di server (docker-compose utama WaBot)
1. Di `.env` folder WaBot (server), isi:
   ```
   EB_OWNER_NUMBER=62xxxxxxxxxx     # nomor Anda (penerima soal)
   EB_ADMIN_TOKEN=string-acak-panjang
   EB_OWNER_NAME=Ikbal
   ```
2. Push ke `main` → auto-deploy (`docker-compose up -d --build`).
3. Buka `http://SERVER:3100/qr?token=EB_ADMIN_TOKEN`, scan dengan WhatsApp **nomor bot** (Perangkat tertaut).
4. Cek: `http://SERVER:3100/health`.

Sesi WhatsApp disimpan di volume Docker `englishbot_data` (aman dari `git clean`; tidak perlu scan ulang tiap deploy).
Jika WhatsApp Web berubah dan login gagal, coba isi `EB_WA_WEB_VERSION` dengan versi dari
https://github.com/wppconnect-team/wa-version (atau `none` untuk versi bawaan library).

## Test
```
npm install && npm test          # APP_DIR=/path/english-90-hari npm test  (pakai app lokal)
```
