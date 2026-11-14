# PRD Backend — UG Lost and Found

## 1. Ringkasan

Backend menyediakan REST API untuk sistem pelaporan kehilangan barang Universitas Gunadarma. Backend melayani dua aplikasi:

- **Frontend User:** pelaporan publik tanpa login dan pelacakan status.
- **Frontend Admin:** autentikasi petugas, inventori barang temuan, review laporan, verifikasi loket, serah terima, dan audit.

Backend mengikuti alur pada `PRD_UG_Lost_and_Found.docx`, dengan perubahan teknologi berikut:

| Komponen | Keputusan |
|---|---|
| Bahasa | Go 1.23.3+ |
| Web framework | Fiber |
| ORM | GORM |
| Migration | GORM `AutoMigrate` saat startup |
| Database | PostgreSQL |
| Autentikasi admin | JWT |
| Email | SMTP transactional |
| Upload | Multipart upload dengan validasi MIME dan ukuran |
| API | REST, prefix `/api/v1` |

Backend tidak menyediakan katalog inventori publik.

## 2. Masalah yang Diselesaikan

1. Laporan kehilangan tersebar dan tidak memiliki database terpusat.
2. Data barang temuan yang terbuka memungkinkan claim sniping dan social engineering.
3. Dokumen KTM/KRS mengandung data pribadi dan harus disimpan privat.
4. Pelapor terlambat mengetahui perubahan status.
5. Laporan lebih dari 30 hari menumpuk di antrean aktif admin.
6. Serah terima tanpa audit trail sulit ditelusuri.

## 3. Tujuan

- Menerima laporan kehilangan tanpa akun.
- Menerbitkan ticket code acak untuk setiap laporan.
- Menyediakan pelacakan status dengan ticket code dan challenge 4 digit.
- Menyediakan inventori internal tertutup untuk admin.
- Mengirim email konfirmasi dan undangan verifikasi.
- Menandai laporan `Lawas` setelah 30 hari berstatus `Belum Ada`.
- Mencatat perubahan penting dan serah terima dalam audit log.
- Mencegah akses file pribadi tanpa otorisasi admin.

## 4. Di Luar Scope

- Aplikasi mobile native.
- Katalog barang temuan untuk publik.
- Chat antara pelapor dan admin.
- Pembayaran atau denda.
- OCR dokumen KTM/KRS.
- Pencocokan barang otomatis berbasis machine learning.
- Migrasi historis dari media sosial.

## 5. Aktor dan Hak Akses

### 5.1 Pelapor

- Membuat laporan tanpa login.
- Mengunggah KTM/KRS dan foto pendukung.
- Menerima ticket code melalui email.
- Melacak status dengan ticket code dan 4 digit verifikasi.
- Tidak dapat melihat inventori atau data pelapor lain.

### 5.2 Admin Loket

- Login dengan JWT.
- Mengelola inventori barang temuan.
- Melihat dan memproses laporan.
- Melihat file privat.
- Mengubah status laporan.
- Membuat catatan serah terima.
- Memulihkan laporan lawas.
- Melihat audit log sesuai hak akses.

### 5.3 Sistem

- Membuat ID dan ticket code unik.
- Menyimpan file secara privat dengan nama acak.
- Mengirim email asynchronous atau non-blocking.
- Menjalankan penandaan laporan lawas.
- Membuat audit log untuk aksi sensitif.

## 6. Alur Operasional End-to-End

### 6.1 Happy Path

1. Admin login.
2. Penemu menyerahkan barang ke loket.
3. Admin membuat inventori dengan status `Tersimpan`.
4. Pelapor membuka form publik tanpa login.
5. Pelapor mengisi identitas, kontak, detail kehilangan, ciri rahasia, dan file pendukung.
6. Backend memvalidasi input dan file.
7. Backend membuat laporan dengan status `Belum Ada`.
8. Backend membuat ticket code acak, misalnya `UG-7X9K2`.
9. Backend mengirim email konfirmasi berisi ticket code dan link tracking.
10. Admin membandingkan laporan dengan inventori internal.
11. Admin mengubah status menjadi `Perlu Verifikasi` jika ada kecocokan.
12. Backend mengirim email undangan ke loket dengan jadwal dan lokasi.
13. Pelapor hadir membawa KTM asli.
14. Admin mencocokkan KTM dan ciri rahasia barang.
15. Admin mengunggah bukti serah terima dan mengisi data penerima.
16. Backend membuat handover.
17. Backend mengubah laporan menjadi `Selesai`.
18. Backend mengubah inventori menjadi `Diambil`.
19. Backend membuat audit log.

### 6.2 Barang Belum Cocok dan Lawas

1. Laporan tetap berstatus `Belum Ada`.
2. Pelapor tetap dapat melacak status.
3. Setelah lebih dari 30 hari, backend mengatur `is_stale = true`.
4. Admin melihat laporan pada tab lawas.
5. Admin dapat memulihkan laporan jika barang ditemukan.
6. Pemulihan mengatur `is_stale = false` dan membuat audit log.

### 6.3 Laporan Ditolak

1. Admin menemukan data fiktif, file rusak, atau dokumen tidak valid.
2. Admin mengubah status menjadi `Ditolak` dan mengisi alasan.
3. Backend membuat audit log.
4. Backend mengirim email penolakan jika alamat email valid.

### 6.4 Verifikasi Loket Gagal

1. Pelapor hadir di loket.
2. KTM atau ciri rahasia tidak cocok.
3. Admin menolak serah terima.
4. Barang tetap `Tersimpan`.
5. Laporan dikembalikan ke `Belum Ada` atau diubah menjadi `Ditolak`.
6. Backend membuat audit log dan catatan alasan.

## 7. Status dan Transisi

### 7.1 Status Laporan

| Status | Arti |
|---|---|
| `Belum Ada` | Belum ada barang yang cocok atau belum direview selesai |
| `Perlu Verifikasi` | Ada kecocokan awal dan pelapor harus datang ke loket |
| `Selesai` | Serah terima berhasil |
| `Ditolak` | Laporan tidak valid atau verifikasi gagal |

`is_stale` adalah flag terpisah. Nilai `true` berarti laporan `Belum Ada` lebih dari 30 hari.

Transisi valid:

- `Belum Ada` → `Perlu Verifikasi`
- `Belum Ada` → `Ditolak`
- `Belum Ada` → `Belum Ada` dengan pemulihan flag lawas
- `Perlu Verifikasi` → `Selesai`
- `Perlu Verifikasi` → `Belum Ada`
- `Perlu Verifikasi` → `Ditolak`

### 7.2 Status Inventori

| Status | Arti |
|---|---|
| `Tersimpan` | Barang berada di loket |
| `Diambil` | Barang sudah diserahkan |

Barang hanya boleh berubah ke `Diambil` setelah handover berhasil.

## 8. Model Data GORM

### 8.1 `admins`

- `id` UUID primary key.
- `username` varchar(50), unique, required.
- `password_hash` varchar(255), required.
- `name` varchar(100), required.
- `created_at`, `updated_at`.

Password tidak pernah dikembalikan melalui API.

### 8.2 `reports`

- `id` UUID primary key.
- `ticket_code` varchar(12), unique, required.
- `reporter_name` varchar(100), required.
- `reporter_email` varchar(100), required.
- `npm` varchar(15), required.
- `phone_number` varchar(20), required.
- `item_name` varchar(100), required.
- `loss_location` varchar(150), required.
- `loss_datetime` timestamp, required.
- `item_description` text, required.
- `secret_traits` text, required.
- `ktm_krs_path` varchar(255), required, privat.
- `item_image_path` varchar(255), nullable, privat.
- `status` enum atau constraint, default `Belum Ada`.
- `is_stale` boolean, default `false`, indexed.
- `admin_notes` text, nullable.
- `rejection_reason` text, nullable.
- `created_at`, `updated_at`.

### 8.3 `inventories`

- `id` UUID primary key.
- `item_name` varchar(100), required.
- `internal_category` varchar(50), required.
- `found_location` varchar(150), required.
- `found_datetime` timestamp, required.
- `item_details` text, required.
- `finder_name` varchar(100), required.
- `finder_contact` varchar(50), required.
- `status` enum atau constraint, default `Tersimpan`.
- `created_at`, `updated_at`.

Data inventori hanya untuk admin.

### 8.4 `handovers`

- `id` UUID primary key.
- `report_id` UUID, unique, foreign key ke `reports.id`.
- `inventory_id` UUID, foreign key ke `inventories.id`.
- `admin_id` UUID, foreign key ke `admins.id`.
- `recipient_name` varchar(100), required.
- `recipient_npm` varchar(15), required.
- `handover_proof_path` varchar(255), required, privat.
- `handover_notes` text, nullable.
- `created_at`.

Satu laporan hanya boleh memiliki satu handover sukses.

### 8.5 `audit_logs`

- `id` UUID primary key.
- `admin_id` UUID, nullable untuk aksi sistem.
- `action` varchar(50), required.
- `target_table` varchar(50), required.
- `target_id` UUID, required.
- `payload` JSONB, nullable.
- `ip_address` varchar(45), nullable.
- `created_at`.

### 8.6 Auto Migration

- Semua model utama didaftarkan di `models.AutoMigrate`.
- Auto migration berjalan setelah koneksi database berhasil.
- Migration harus idempotent dan tidak menghapus data.
- Perubahan destruktif, rename kolom, dan migrasi data wajib mendapat prosedur migration terpisah.
- Seed role, permission, dan admin default berjalan setelah migration.

## 9. API Contract

Base URL: `/api/v1`

### 9.1 Public Report

`POST /reports`

- Content type: `multipart/form-data`.
- Menerima data laporan, `ktm_krs`, dan `item_image` opsional.
- Mengembalikan `201 Created`.

Response minimum:

```json
{
  "data": {
    "ticket_code": "UG-7X9K2",
    "status": "Belum Ada",
    "tracking_url": "/track/UG-7X9K2"
  }
}
```

Backend tidak mengembalikan path file privat.

### 9.2 Public Tracking

`POST /reports/track`

Request:

```json
{
  "ticket_code": "UG-7X9K2",
  "verification_code": "1234"
}
```

Response hanya memuat data minimum:

- ticket code.
- status.
- `is_stale`.
- waktu laporan.
- pesan status publik.
- instruksi berikutnya jika `Perlu Verifikasi`.

Response tidak memuat secret traits, dokumen, foto, nama penemu, atau data laporan lain.

### 9.3 Admin Authentication

- `POST /auth/login`
- `POST /auth/refresh` jika refresh token digunakan.
- `POST /auth/logout` jika mekanisme revoke digunakan.

JWT wajib memuat identitas admin dan role. Password memakai hash adaptif, bukan plaintext.

### 9.4 Admin Inventory

- `GET /admin/inventories`
- `POST /admin/inventories`
- `GET /admin/inventories/:id`
- `PATCH /admin/inventories/:id`

Semua endpoint membutuhkan JWT dan role admin.

### 9.5 Admin Reports

- `GET /admin/reports?status=&is_stale=&page=&limit=`
- `GET /admin/reports/:id`
- `PATCH /admin/reports/:id/status`
- `POST /admin/reports/:id/restore`
- `GET /admin/reports/:id/files/:file_type`

File hanya dikirim setelah authorization berhasil. Endpoint file tidak boleh memakai path filesystem langsung.

### 9.6 Handover

`POST /admin/handovers`

Validasi wajib:

- report berstatus `Perlu Verifikasi`.
- inventory berstatus `Tersimpan`.
- report belum memiliki handover.
- bukti serah terima valid.
- admin terautentikasi.

Operasi perubahan handover, report, dan inventory harus berada dalam satu database transaction.

### 9.7 Audit Log

- `GET /admin/audit-logs`
- Akses hanya untuk role yang diberi permission.
- Audit log tidak boleh dapat diedit atau dihapus melalui API biasa.

## 10. Validasi dan Keamanan

### 10.1 Input

- Validasi field required, panjang, format email, NPM, nomor telepon, dan tanggal.
- Trim input teks.
- Tolak payload berlebihan.
- Gunakan query parameter terparameterisasi melalui GORM.
- Escape data saat frontend merendernya.

### 10.2 Upload

- Hanya JPG, PNG, dan PDF.
- Validasi magic number, bukan ekstensi saja.
- Ukuran maksimum 2 MB per file.
- Nama file UUID acak.
- Simpan di direktori private di luar static public.
- Jangan eksekusi atau render file upload sebagai HTML.
- Tolak file rusak dan MIME mismatch.

### 10.3 Anti-IDOR

- Ticket code menggunakan karakter acak dan tidak berurutan.
- Tracking wajib memakai ticket code dan challenge 4 digit.
- Jangan gunakan ID database sebagai kredensial tracking.
- Jangan mengembalikan data laporan lain saat ticket code salah.
- Pertimbangkan rate limit pada endpoint tracking dan submit.

### 10.4 Admin

- Hash password dengan algoritma adaptif.
- JWT diverifikasi pada setiap endpoint admin.
- Authorization dicek berdasarkan role atau permission.
- CORS hanya mengizinkan origin aplikasi saat production.
- Jangan memakai `AllowOrigins: "*"` bersama kredensial produksi.

### 10.5 Email

Email minimal:

1. Konfirmasi laporan dibuat.
2. Undangan verifikasi loket.
3. Penolakan laporan.

Kegagalan SMTP tidak boleh menghapus laporan yang sudah tersimpan. Status pengiriman perlu dicatat untuk observasi.

## 11. Background Job dan Waktu

- Proses stale berjalan terjadwal minimal sekali per hari.
- Kandidat stale: `status = Belum Ada`, `is_stale = false`, dan `created_at` lebih lama dari 30 hari.
- Proses harus idempotent.
- Gunakan timezone yang disepakati sistem.
- Perubahan `is_stale` dicatat sebagai audit aksi sistem jika diperlukan.

## 12. Non-Functional Requirements

- API responsif pada operasi database normal.
- Error memakai format JSON konsisten.
- Log tidak boleh memuat password, token, atau isi dokumen.
- Semua endpoint admin memiliki test authorization.
- Operasi handover atomik.
- Database memakai index untuk `ticket_code`, `status`, `is_stale`, dan timestamp yang digunakan query.
- Health check: `GET /health`.

## 13. Deliverable Bertahap

### Tahap 1 — Fondasi

- Konfigurasi Fiber, PostgreSQL, GORM.
- Model GORM.
- `AutoMigrate`.
- Seed role, permission, dan admin.
- Health check.
- Format error dan logging dasar.

**Hasil:** service berjalan dan schema database terbentuk otomatis.

### Tahap 2 — Auth Admin

- Login JWT.
- Auth middleware.
- Admin authorization.
- Rate limit login.

**Hasil:** endpoint admin terlindungi.

### Tahap 3 — Inventori dan Laporan

- CRUD inventori admin.
- Submit laporan publik.
- Validasi upload privat.
- Ticket code.
- Tracking anti-IDOR.

**Hasil:** pelapor dapat membuat dan melacak laporan; admin dapat mencatat barang.

### Tahap 4 — Review dan Notifikasi

- Review laporan.
- Transisi status.
- SMTP email konfirmasi, undangan, dan penolakan.
- Endpoint file privat.

**Hasil:** admin dapat memproses kecocokan dan pelapor menerima notifikasi.

### Tahap 5 — Handover dan Audit

- Form handover.
- Transaction report-inventory-handover.
- Upload bukti serah terima.
- Audit log.

**Hasil:** serah terima tercatat dan status konsisten.

### Tahap 6 — Stale dan Hardening

- Job flag `is_stale`.
- Filter dan restore laporan lawas.
- Rate limit.
- Security test upload, IDOR, auth, dan privilege.

**Hasil:** antrean admin tetap efisien dan celah utama tertutup.

## 14. Acceptance Criteria

- [ ] `go run main.go` membuat schema yang diperlukan melalui GORM `AutoMigrate`.
- [ ] Submit laporan tanpa login menghasilkan ticket code unik.
- [ ] Submit menolak field invalid dan file tidak sesuai.
- [ ] File KTM/KRS tidak dapat diakses dari URL publik.
- [ ] Tracking membutuhkan ticket code dan kode verifikasi.
- [ ] Tracking tidak membocorkan secret traits atau data pribadi sensitif.
- [ ] Admin tanpa JWT tidak dapat membuka endpoint admin.
- [ ] Admin non-authorized tidak dapat melakukan aksi yang tidak dimiliki permission.
- [ ] Perubahan ke `Perlu Verifikasi` memicu email undangan.
- [ ] Handover gagal seluruhnya jika salah satu perubahan transaction gagal.
- [ ] Handover sukses mengubah report menjadi `Selesai` dan inventory menjadi `Diambil`.
- [ ] Laporan `Belum Ada` lebih dari 30 hari mendapat `is_stale = true`.
- [ ] Aksi status, inventori, file, dan handover menghasilkan audit log.
- [ ] Kegagalan SMTP tidak membatalkan penyimpanan laporan.

## 15. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| IDOR pada tracking | Ticket code acak + kode verifikasi + rate limit |
| Kebocoran KTM/KRS | Private storage + authorization + secure streaming |
| Malware upload | Magic number, allowlist MIME, batas 2 MB, nama UUID |
| Claim sniping | Inventori tertutup + secret traits + verifikasi fisik |
| Fraud serah terima | Bukti foto + KTM fisik + transaction + audit log |
| SMTP timeout | Email non-blocking, retry/observability, submit tetap sukses |
| Auto migration merusak data | Auto migration hanya perubahan kompatibel; migration destruktif terpisah |
