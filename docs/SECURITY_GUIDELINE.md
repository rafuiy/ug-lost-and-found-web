# Security Guideline — UG Lost and Found

**Prinsip Utama:** *Security by default, fail-fast, least privilege, dan zero trust terhadap seluruh input klien.*

Dokumen ini menjadi aturan mengikat untuk seluruh pengembangan di repositori `uglf-web` ([backend/](file:///C:/Users/LOQ/Documents/Projects/uglf-web/backend), [frontend/](file:///C:/Users/LOQ/Documents/Projects/uglf-web/frontend), [frontend-admin/](file:///C:/Users/LOQ/Documents/Projects/uglf-web/frontend-admin)), konfigurasi environment, dan setiap milestone sebelum kode di-merge.

---

## 1. Manajemen Secret, Environment Variable & Konfigurasi (Anti-Exposure)

> **Latar belakang insiden yang dicegah:** Menaruh nilai fallback kredensial/konfigurasi sensitif di dalam source code (`config.go`) berisiko membocorkan rahasia ke repositori Git serta menyebabkan aplikasi tetap berjalan diam-diam memakai kredensial dev/lemah di environment production.

### Aturan Wajib

1. **Dilarang keras menaruh nilai fallback (hardcode)** di source code untuk:
   - Kredensial & host database: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
   - Secret signing/token: `JWT_SECRET`
   - Kredensial email: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
   - Password seeder awal: `SEED_ADMIN_PASSWORD`, `SEED_PETUGAS_PASSWORD`
   - URL/origin lingkungan spesifik: `CORS_ALLOWED_ORIGINS`, `PUBLIC_APP_URL`, `LOKET_LOCATION`, `LOKET_SCHEDULE`
2. **Fail-Fast saat Startup:** Aplikasi wajib langsung gagal/berhenti (*fail-fast*) saat inisialisasi jika variabel environment wajib belum diisi. Pesan error **hanya boleh menyebut nama key env** yang kurang — dilarang keras mencetak nilai variabel env ke log/stdout.
3. **Lindungi Struct Config dengan `json:"-"`:** Seluruh field sensitif pada struct konfigurasi dan model (`PasswordHash`, `DBPassword`, `JWTSecret`, `SMTPPassword`, `Seed*Password`) wajib diberi tag `json:"-"` agar tidak pernah ikut ter-serialize ke JSON response atau log.
4. **Pemisahan File Environment:**
   - `.env` dan folder `storage/` wajib selalu tercantum di `.gitignore`.
   - `.env.example` hanya boleh berisi **placeholder non-fungsional** (misalnya `change-this-secret-in-production`), bukan kredensial asli atau password dev yang dipakai di server.
5. **Rotasi & Kekuatan Secret Produksi:** `JWT_SECRET` di production minimal **32 byte acak kriptografis**.
6. **Frontend (`VITE_*`):** Jangan pernah menaruh secret, API private key, atau kredensial admin di variabel `VITE_*` karena seluruh nilai `VITE_*` ikut ter-bundle ke JavaScript sisi browser dan dapat dibaca siapa saja.

### Pola Kode Go (DO vs DON'T)

```go
// ❌ DON'T — membocorkan/mengizinkan fallback secret & kredensial di source code
JWTSecret:  getEnv("JWT_SECRET", "dev-secret-123"),
DBPassword: getEnv("DB_PASSWORD", "postgres"),

// ✅ DO — baca murni dari environment dan fail-fast lewat ValidateConfig
JWTSecret:  os.Getenv("JWT_SECRET"),
DBPassword: os.Getenv("DB_PASSWORD"),
```

---

## 2. Autentikasi, Password & Keamanan JWT

1. **Hashing Password Adaptif:** Password admin wajib di-hash dengan `bcrypt` (minimal `bcrypt.DefaultCost`) atau `argon2id`. Dilarang keras menyimpan plaintext, MD5, SHA-1, atau SHA-256.
2. **Cegah Username Enumeration:** Endpoint `POST /api/v1/auth/login` wajib mengembalikan pesan gagal yang identik/umum (misalnya `"Username atau password tidak valid."`) baik ketika username tidak ditemukan, password salah, maupun akun tidak aktif (`is_active = false`).
3. **Verifikasi JWT Ketat:**
   - Validasi algoritma signing secara eksplisit di callback parser (hanya izinkan `jwt.SigningMethodHMAC` / HS256; tolak `alg: none` dan cegah *algorithm confusion* RSA→HMAC).
   - Validasi klaim waktu (`exp`, `iat`) dengan clock skew wajar.
   - Pastikan admin masih ada dan berstatus `is_active = true` pada saat otorisasi aksi sensitif atau refresh token.
4. **Dilarang JWT di URL Query String:** Token tidak boleh dikirim lewat query parameter (`?token=...`) karena akan terekam di browser history, server access log, dan header `Referer`.
5. **Brute-Force Protection:** Endpoint login wajib dilindungi rate limiter ketat per IP dan/atau kombinasi IP + username.

---

## 3. Otorisasi, RBAC & Pencegahan Mass Assignment / State Bypass

1. **Penegakan Permission di Server:** Semua route `/api/v1/admin/*` wajib melewati `AuthMiddleware` (JWT) dan middleware permission granular. Menyembunyikan menu/tombol di UI frontend **bukan** mekanisme keamanan.
2. **Pemisahan Ketat Role `Admin` vs `Petugas Loket`:**
   - **`admin` (`Admin` / Superadmin):** Memiliki akses penuh termasuk `audit_logs.read` dan `reports.restore`.
   - **`petugas_loket` (`Petugas Loket`):** Hanya memiliki izin operasional loket (`inventories.*`, `reports.read`, `reports.update_status`, `reports.view_files`, `handovers.create`). Dilarang keras mengakses endpoint `GET /admin/audit-logs` dan `POST /admin/reports/:id/restore`.
3. **Anti-Mass Assignment (Wajib DTO Eksplisit):**
   - **DILARANG** mem-parsing body request langsung ke struct model GORM (`c.BodyParser(&models.Report)` atau `db.Updates(inputMap)` bebas).
   - Gunakan struct **Request DTO terpisah** yang hanya mendeklarasikan field yang memang boleh diisi oleh pemanggil sehingga penyerang tidak dapat menyisipkan `id`, `status`, `is_stale`, `role_id`, atau `password_hash`.
4. **Integritas State Machine:**
   - Validasi seluruh transisi status laporan (`Belum Ada` → `Perlu Verifikasi`/`Ditolak`, `Perlu Verifikasi` → `Belum Ada`/`Ditolak`/`Dibatalkan`, dll.) secara ketat di backend.
   - Status laporan `Selesai` dan status inventori `Diambil` **hanya boleh** berubah melalui transaksi atomik pada endpoint Handover — dilarang mengubahnya lewat endpoint `PATCH /admin/reports/:id/status` atau `PATCH /admin/inventories/:id`.

---

## 4. Anti-IDOR, Privasi Data & Anti-Claim Sniping (Ancaman Inti UGLF)

> **Konteks bisnis:** Kebocoran daftar inventori atau `secret_traits` memungkinkan *claim sniping* dan *social engineering* di loket.

1. **Inventori Tertutup Total:** Dilarang keras menyediakan endpoint publik untuk mencari, mendaftar, atau melihat detail `inventories`.
2. **ID & Ticket Code Non-Sequential:**
   - Semua primary key memakai **UUID** (bukan integer auto-increment yang mudah ditebak/di-enumerate).
   - `ticket_code` wajib di-generate memakai `crypto/rand` (bukan `math/rand`) dengan alfabet yang jelas dan tidak berurutan.
3. **Tracking Anti-IDOR:**
   - `POST /api/v1/reports/track` wajib memvalidasi kombinasi `ticket_code` + challenge 4 digit (dari NPM).
   - Jika salah/tidak cocok, kembalikan status & pesan umum yang sama (tidak membedakan antara *"tiket tidak ada"* vs *"4 digit salah"*).
   - Wajib dilindungi rate limit.
4. **Response DTO Whitelist (Least Data Exposure):**
   - Response `POST /reports/track` hanya boleh mengembalikan `ticket_code`, `status`, `is_stale`, `created_at`, pesan status publik, jadwal/lokasi loket (jika `Perlu Verifikasi`), dan alasan publik (jika `Ditolak`).
   - **Dilarang keras** mengekspos `secret_traits`, path/URL file KTM/KRS atau foto, `admin_notes`, identitas/kontak penemu, atau field laporan orang lain.
   - Pisahkan kolom catatan internal (`admin_notes`) dari alasan penolakan yang aman ditampilkan ke pelapor (`rejection_reason`).

---

## 5. Keamanan Upload & Streaming File Privat

Dokumen **KTM/KRS**, foto pendukung laporan, dan foto bukti serah terima mengandung data pribadi (PII) dan berisiko menjadi vektor malware/XSS.

1. **Validasi Magic Number (Content Sniffing):**
   - Hanya izinkan **JPG, PNG, dan PDF**.
   - Validasi file berdasarkan **magic number / isi byte awal** (mis. `http.DetectContentType` / pengecekan signature byte JPEG, PNG, `%PDF-`), **bukan** sekadar ekstensi nama file atau header `Content-Type` dari klien.
   - Tolak SVG, HTML, file executable, atau file dengan MIME mismatch/korup untuk mencegah **Stored XSS** dan upload berbahaya.
2. **Batas Ukuran Ketat:** Maksimal **2 MB per file**, dan atur `BodyLimit` Fiber agar payload berlebih langsung ditolak (`413 Payload Too Large`).
3. **Penyimpanan Privat & Nama File Acak:**
   - Simpan di `UPLOAD_DIR` (`storage/private`) yang berada **di luar** folder static/public web. Jangan pernah mendaftarkan `app.Static` ke folder ini.
   - Generate nama file acak berbasis **UUID** + ekstensi dari tipe MIME terverifikasi. **Jangan pernah** menggunakan nama file asli dari user untuk path disk.
4. **Anti-Path Traversal pada Endpoint Streaming:**
   - `GET /api/v1/admin/reports/:id/files/:file_type` wajib melalui JWT + permission `reports.view_files`.
   - Ambil nama file/path hanya dari record database (bukan parameter path dari user), sanitasi dengan `filepath.Base`, dan verifikasi `filepath.Abs` hasilnya tetap berada di dalam `UPLOAD_DIR`.
   - Set header respons aman:
     - `X-Content-Type-Options: nosniff`
     - `Cache-Control: no-store, private`
     - `Content-Disposition: inline; filename="..."` (atau `attachment`) dengan nama file ter-sanitasi.
5. **Cleanup File Gagal:** Jika penyimpanan database atau transaksi handover gagal/rollback setelah file ditulis ke disk, hapus file tersebut agar tidak meninggalkan *orphan file* sensitif di disk.

---

## 6. Keamanan Database, SQL Injection & Race Condition

1. **Query Terparameterisasi:** Gunakan query terparameterisasi GORM (`db.Where("ticket_code = ?", code)`). Dilarang keras merangkai query SQL dengan konkatenasi string atau `fmt.Sprintf`.
2. **Allowlist Sorting & Filtering:** Jika ada query parameter `sort` / `order`, petakan melalui `map[string]string` / allowlist kolom yang valid sebelum diteruskan ke `db.Order(...)` karena GORM tidak memparameterisasi nama kolom.
3. **Transaksi Atomik & Anti-Race Condition pada Handover:**
   - Proses `POST /api/v1/admin/handovers` wajib dijalankan di dalam **satu `db.Transaction`**.
   - Gunakan *row-level locking* (`clause.Locking{Strength: "UPDATE"}`) saat membaca baris `reports` dan `inventories` di dalam transaksi untuk mencegah **double handover / TOCTOU race condition** ketika dua petugas menekan submit bersamaan.
   - Pertahankan constraint `UNIQUE` pada `handovers.report_id` di tingkat PostgreSQL sebagai lapisan pertahanan kedua.
4. **Aturan Migration:** `AutoMigrate` hanya digunakan untuk perubahan aditif yang aman. Perubahan destruktif (`DROP`, rename kolom, perubahan tipe yang memangkas data) wajib menggunakan prosedur migrasi terpisah dengan backup.

---

## 7. Keamanan HTTP, CORS, Header, Rate Limit & SMTP Resilience

1. **CORS Ketat:** Gunakan allowlist origin dari `CORS_ALLOWED_ORIGINS`. Dilarang keras memakai `AllowOrigins: "*"` bersamaan dengan `AllowCredentials: true` atau di production.
2. **Security Response Headers:** Terapkan header defensif pada respons HTTP:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: no-referrer`
3. **Rate Limiting:** Terapkan batas permintaan pada endpoint rawan penyalahgunaan/brute-force (`POST /api/v1/auth/login`, `POST /api/v1/reports`, `POST /api/v1/reports/track`).
4. **Resiliensi SMTP (Anti-DoS & Non-Blocking):** Pengiriman email konfirmasi, undangan loket, dan penolakan harus berjalan asynchronous dengan timeout koneksi/kirim yang jelas. Kegagalan SMTP **tidak boleh** me-rollback laporan yang sudah valid tersimpan, dan error pengiriman dicatat tanpa membocorkan kredensial SMTP.

---

## 8. Logging, Error Handling & Integritas Audit Log

1. **Sanitasi Log Aplikasi:**
   - **DILARANG** mencatat password, `password_hash`, JWT, header `Authorization`, cookie, `SMTP_PASSWORD`, `secret_traits`, KTM/KRS, atau request body multipart ke stdout/file log.
   - Jangan gunakan `logger.Info` GORM di production karena dapat mencetak nilai parameter query yang sensitif.
2. **Error Handling Aman:** Gunakan `utils.ErrorHandler`. Jangan pernah mengembalikan stack trace Go, pesan error PostgreSQL mentah, atau path direktori server internal dalam respons JSON 500.
3. **Integritas Audit Log (Append-Only):**
   - Setiap aksi sensitif (login gagal/sukses, mutasi inventori, ubah status laporan, akses file privat, handover, restore laporan lawas, job `is_stale`) wajib menulis record ke `audit_logs`.
   - API hanya menyediakan `GET /api/v1/admin/audit-logs` (read-only bagi `admin`); **dilarang keras** menyediakan endpoint update atau delete audit log.
   - Payload JSONB audit log tidak boleh memuat password, token, atau binary file.

---

## 9. Aturan Keamanan Frontend (`frontend` & `frontend-admin`)

1. **Kebersihan Penyimpanan Browser:**
   - Jangan menyimpan file KTM/KRS, `secret_traits`, nomor telepon, atau data pribadi pelapor ke `localStorage`, URL parameter, analytics, atau `console.log`.
   - Simpan token sesi admin sesuai strategi yang disetujui security review (hindari log token atau mencetak object session ke console).
2. **Anti-XSS:** Jangan menggunakan `dangerouslySetInnerHTML`, `eval`, atau menyisipkan string mentah dari API sebagai HTML. Pastikan seluruh teks dirender aman melalui JSX escaping standar React.
3. **Penanganan Token Kedaluwarsa:** Saat API mengembalikan `401 Unauthorized`, segera bersihkan state sesi di client dan arahkan petugas kembali ke halaman login.
4. **Validasi Frontend Bersifat UX:** Jangan pernah mengasumsikan validasi JS/TS di browser menjamin keamanan input — seluruh validasi ukuran/MIME file, format input, transisi status, dan RBAC tetap ditegakkan mutlak di backend.

---

## 10. Checklist Wajib Sebelum Commit / Selesai Milestone

Gunakan checklist ini setiap kali menyelesaikan fitur atau sebelum melakukan `git commit`:

- [ ] **Zero Hardcoded Secrets:** Tidak ada password, `JWT_SECRET`, kredensial DB, kredensial SMTP, atau fallback sensitif di file `.go`, `.js`, `.jsx`, `.ts`, `.tsx`, atau `.env.example`.
- [ ] **Git Hygiene:** File `.env`, folder `storage/`, dan artefak build tidak masuk dalam `git status` / `git diff` yang akan di-commit.
- [ ] **JSON Serialization Guard:** Field sensitif (`PasswordHash`, path file privat, secret config) memiliki tag `json:"-"`.
- [ ] **DTO Anti-Mass Assignment:** Semua endpoint `POST`/`PATCH`/`PUT` memakai struct DTO eksplisit, bukan struct model GORM langsung.
- [ ] **RBAC & Auth Tests:** Endpoint admin terproteksi JWT, dan endpoint khusus `admin` (`audit_logs.read`, `reports.restore`) terbukti menolak role `petugas_loket` (`403 Forbidden`).
- [ ] **Upload Safety:** Upload menguji ukuran maks 2 MB, validasi magic number JPG/PNG/PDF, penamaan UUID acak, penyimpanan di luar public static, dan cleanup saat transaksi gagal.
- [ ] **Anti-IDOR & State Integrity:** Endpoint tracking publik teruji tidak membocorkan `secret_traits`/file/inventori; status `Selesai`/`Diambil` hanya bisa dicapai lewat transaksi handover atomik.
- [ ] **Safe Logging & Error:** Log tidak mencetak token/password/body sensitif; error 500 memakai pesan generik tanpa detail internal.
- [ ] **Automated Tests Pass:** Seluruh unit, integration, dan security test (`go test -v ./...`) lolos setelah perubahan terakhir.
