# Future Updates — UG Lost & Found

Dokumen ini merangkum rencana pengembangan lanjutan setelah tahap *UI slicing* `frontend-admin`, mencakup migrasi dari `mockData.js` ke REST API Backend (`/api/v1`), penguatan fitur inti (*base features*), implementasi **AI Auto-Matching** untuk pencocokan laporan & inventori, serta integrasi penuh alur status **`Dibatalkan`**, **30 Loker**, dan **Delete Inventori**.

---

## 1. Roadmap & Prioritas Fase

| Fase | Fokus Utama | Target Modul | Status Saat Ini |
|---|---|---|---|
| **Fase 1** | Implementasi REST API inti (`/api/v1/auth`, `reports`, `inventories`, `handovers`, `audit-logs`) & migrasi `mockData.js` | `backend`, `frontend-admin` | Backend masih kerangka awal (`routes/routes.go`); `frontend-admin` masih memakai `mockData.js` & `auth.js` mock |
| **Fase 2** | Integrasi penuh status **`Dibatalkan`**, token **Ajukan Ulang**, & email transaksional | `backend`, `frontend`, `frontend-admin` | UI & state `frontend-admin` sudah selesai; perlu endpoint & halaman `frontend` publik |
| **Fase 3** | **AI Auto-Matching & Multi-Candidate Ranking** (Third-Party LLM/Embedding API) | `backend`, `frontend-admin` | Belum diimplementasikan (masih rancangan) |
| **Fase 4** | Optimasi performa, proteksi tautan ganda, & validasi loker/file privat | `backend`, `frontend-admin`, `frontend` | Sebagian sudah disiapkan di UI `frontend-admin` |

---

## 2. Fitur 1: AI Auto-Matching & Multi-Candidate Ranking

### 2.1 Konsep Utama: *"Auto-Tautkan (AI Draft) + 1-Klik Approval Staff"*
Alih-alih staff mencari manual atau AI langsung mengirim email undangan secara otomatis tanpa pengawasan, sistem memakai pola **AI Auto-Suggestion**:
1. AI mencocokkan deskripsi laporan kehilangan dari user (`itemName`, `category`, `lostLocation`, `lostDate`, `description`) dengan catatan barang temuan di inventori (`title`, `category`, `foundLocation`, `foundDate`, `notes`).
2. **Jangan auto-invite / auto-email tanpa konfirmasi staff**, karena berisiko saat:
   - Ada **>1 laporan mirip** untuk 1 barang fisik yang sama (misal 3 mahasiswa sama-sama kehilangan kunci motor Honda Vario).
   - Terjadi *false positive* secara teks yang baru terlihat berbeda saat staff membandingkan foto atau ciri rahasia (`secretFeature`).
3. **Hasilnya di UI**: AI otomatis menautkan/menyarankan kandidat teratas beserta **skor kecocokan (%)** dan **alasan singkat**. Staff cukup meninjau lalu klik **Terbitkan Undangan Loket** (1 klik).

> **Catatan Audit `mockData.js`:** Pada data awal saat ini, laporan `UG-7X9K2` berstatus `Belum Ada` namun sudah memiliki `matchedInventoryId: 'INV-084'`, sehingga kartu `INV-084` menampilkan `Tertaut: UG-7X9K2`. Saat integrasi API aktif, kondisi tersebut dibedakan secara tegas menjadi:
> - **AI Suggested / Draft Match** (status laporan masih `Belum Ada`), dan
> - **Confirmed Match / Tertaut Resmi** (status laporan sudah `Perlu Verifikasi` atau `Selesai`).

### 2.2 Arsitektur Keamanan & Efisiensi Kuota API
- **API Key wajib di Backend (`.env`)**: Jangan pernah menyimpan API key third-party AI di `frontend-admin` (kode frontend dapat diinspeksi melalui *Network/DevTools*).
  ```env
  AI_PROVIDER=gemini # atau openai / groq
  AI_API_KEY=your_secret_key_here
  AI_MODEL=gemini-2.5-flash
  AI_MATCH_THRESHOLD=60
  ```
- **Event-Driven (Bukan tiap refresh halaman)**:
  AI hanya dipanggil pada 3 kondisi:
  1. Laporan baru masuk dari `frontend` (`POST /api/v1/reports`).
  2. Inventori temuan baru dicatat atau diubah (`POST/PUT /api/v1/admin/inventories`).
  3. Staff menekan tombol **"Analisis Ulang AI"** (`POST /api/v1/admin/ai-match/rescan`).
- Hasil matching disimpan di database agar saat halaman dimuat ulang, `frontend-admin` hanya membaca hasil tersimpan dari PostgreSQL (cepat & hemat token).

### 2.3 Skema Data & Kontrak JSON Output AI

#### Tabel Baru: `report_ai_matches`
| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `UUID` | Primary key |
| `report_id` | `UUID` | FK ke `reports.id` |
| `inventory_id` | `VARCHAR` / `UUID` | FK ke `inventories.id` |
| `confidence_score` | `INT` (`0–100`) | Persentase kecocokan dari AI |
| `reasoning` | `TEXT` | Alasan singkat kesamaan (lokasi, warna, tipe, waktu) |
| `rank` | `INT` | Urutan kandidat (`1`, `2`, `3`, ...) |
| `status` | `VARCHAR` | `SUGGESTED`, `CONFIRMED`, `DISMISSED` |
| `created_at` | `TIMESTAMP` | Waktu analisis AI dijalankan |

#### Kontrak Structured Output dari Provider AI
```json
{
  "inventory_id": "INV-084",
  "candidates": [
    {
      "ticket_code": "UG-7X9K2",
      "confidence": 94,
      "reason": "Jenis Laptop ASUS abu-abu, lokasi Lab Komputer TI Lt. 3, dan tanggal hilang 10/11/2026 identik."
    },
    {
      "ticket_code": "UG-4M1P9",
      "confidence": 68,
      "reason": "Kategori Elektronik sama, namun lokasi kehilangan berada di Kampus E."
    }
  ]
}
```

### 2.4 Penanganan >1 Laporan Mirip & Proteksi Tautan Ganda
- **Di Kartu Inventori (`AdminInventoryPage`)**:
  - Jika belum tertaut resmi tapi ada kandidat AI, tampilkan indikator seperti `AI Kandidat: UG-7X9K2 (94%) · +1 lainnya`.
  - Klik **`Cocokkan Laporan →`** langsung membuka **Panel/Modal Ranking Kandidat** yang mengurutkan seluruh laporan `Belum Ada` berdasarkan skor AI (`#1`, `#2`, `#3`) dan tombol **"Tinjau & Pasangkan"** pada tiap baris.
- **Di Drawer Review (`AdminReviewDrawer`)**:
  - Kelompokkan dropdown inventori menggunakan `<optgroup>`:
    1. `Rekomendasi AI & Kategori Sama`
    2. `Inventori Tersimpan Lainnya`
  - **Proteksi Tautan Ganda**: Satu barang inventori berstatus `Tersimpan` hanya boleh menjadi undangan aktif (`Perlu Verifikasi`) untuk **1 tiket pada satu waktu**. Inventori yang sedang diproses oleh tiket lain dikunci/ditandai di dropdown (*"Sedang Diverifikasi oleh UG-3M8P1"*), dan baru bebas kembali jika tiket tersebut diklik **Kembalikan** (`Perlu Verifikasi` → `Belum Ada`) atau **Dibatalkan**.

---

## 3. Fitur 2: Sinkronisasi Status `Dibatalkan`, Token Ajukan Ulang & Email

Di `frontend-admin`, alur revert `Ditolak` → `Dibatalkan` dan `Selesai` → `Dibatalkan` sudah tersedia di UI. Tahap berikutnya menyambungkan kontrak ini ke `backend` dan `frontend`:

### 3.1 Pembaruan State Machine di `docs/PRD-backend.md`
Tambahkan status laporan **`Dibatalkan`** (status arsip/terminal hasil koreksi):
- `Ditolak` → `Dibatalkan` (`STATUS_REVERT` / `CANCEL_REJECTED_REPORT`)
- `Selesai` → `Dibatalkan` (`HANDOVER_VOID` / `CANCEL_COMPLETED_REPORT`)

### 3.2 Perbedaan Alur Email Berdasarkan Status Asal

| Transisi | Jenis Email | Isi Email | Aksi Lanjutan di `frontend` |
|---|---|---|---|
| **`Ditolak` → `Dibatalkan`** | `RESUBMIT_INVITATION` | Alasan pembatalan penolakan dari petugas + tombol CTA **"Ajukan Ulang Laporan"** | Mengarah ke `/lapor?reopen=<token>` dengan data laporan lama *pre-filled* untuk menerbitkan **tiket baru** (`reopened_from_ticket`) |
| **`Selesai` → `Dibatalkan`** | `ERROR_CLARIFICATION` | Pemberitahuan resmi adanya kesalahan/pembatalan status *Selesai* sesuai **`reason`** petugas (*Petugas Keliru*, *Barang Tertukar*, dll.) + tombol **"Ajukan Ulang"** (opsional jika dicentang petugas) | Jika tombol disertakan, mengarah ke `/lapor?reopen=<token>`; jika tidak (misal barang masih ditarik di loket), pelapor cukup berkoordinasi dengan petugas |

### 3.3 Keamanan Token `reopen` & Konsistensi Data
- Token pengajuan ulang (`resubmit_token`) harus:
  1. Disimpan di database (atau signed JWT) dengan **masa berlaku** (misal 7 hari).
  2. Bersifat **single-use** (otomatis hangus setelah tiket baru berhasil dibuat).
  3. Memvalidasi bahwa status tiket asal memang `Dibatalkan` dan belum pernah melahirkan tiket pengganti aktif.
- Untuk `Selesai` → `Dibatalkan`:
  - Record serah terima (`handovers`) lama **tidak dihapus**, melainkan ditandai `voided_at`, `voided_by`, dan `void_reason` untuk kebutuhan audit.
  - Status inventori dikembalikan dari `Diambil` → `Tersimpan` **hanya jika** staff mengonfirmasi barang fisik masih/kembali berada di loket.

---

## 4. Fitur 3: Manajemen Loker (30 Slot) & Penghapusan Inventori

### 4.1 Standarisasi Loker di Backend
Saat migrasi ke database PostgreSQL, gunakan daftar kode loker terstandar (30 slot Loket D):
- `Loker A-01 (Loket D)` s.d. `Loker A-10 (Loket D)` (10 slot)
- `Loker B-01 (Loket D)` s.d. `Loker B-10 (Loket D)` (10 slot)
- `Loker C-01 (Loket D)` s.d. `Loker C-05 (Loket D)` (5 slot)
- `Loker Safe-01 (Loket D)` s.d. `Loker Safe-05 (Loket D)` (5 slot)

Backend menyediakan agregasi jumlah item `Tersimpan` per loker (atau dihitung di client dari daftar inventori aktif) untuk merender indikator slot kosong (hijau) dan slot terisi vertikal (merah). Loker tetap diperbolehkan menampung >1 barang bila kondisi loket penuh (*overflow*), dengan catatan audit.

### 4.2 Endpoint Delete Inventori dengan Verifikasi Case-Sensitive
Tambahkan endpoint penghapusan inventori di `backend`:
- **Endpoint:** `DELETE /api/v1/admin/inventories/:id`
- **Request Body:**
  ```json
  {
    "reason": "Salah input data barang / duplikasi entri",
    "confirm_id": "INV-085"
  }
  ```
- **Validasi Backend:**
  1. `reason` wajib tidak kosong.
  2. `confirm_id === id` secara **case-sensitive** (tolak dengan `400 Bad Request` jika tidak persis sama).
  3. Hanya item berstatus `Tersimpan` yang boleh dihapus (item `Diambil` tidak boleh dihapus agar histori serah terima tetap utuh).
  4. **Side effect transaksional:** Jika inventori masih tertaut (`matched_inventory_id`) ke laporan berstatus `Perlu Verifikasi`, backend wajib melepas tautan tersebut dan mengembalikan status laporan ke `Belum Ada`, lalu mencatat aksi `INV_DELETE` ke `audit_logs`.

---

## 5. Fitur 4: Migrasi `mockData.js` ke API Backend & Optimasi Base Features

### 5.1 Penggantian `mockData.js` dengan Service Layer
Saat ini `frontend-admin/src/services/` baru memiliki `auth.js` (yang masih menggunakan `MOCK_OFFICERS`). Untuk konsumsi API backend (`/api/v1`), buat layer API terstruktur di `frontend-admin/src/services/`:
- `apiClient.js`: wrapper `fetch` dengan base URL (`VITE_API_BASE_URL`), injeksi header `Authorization: Bearer <jwt>`, dan penanganan `401 Unauthorized` (auto-logout & redirect `/login`).
- `auth.js`: ganti `MOCK_OFFICERS` dengan `POST /api/v1/auth/login` dan simpan token JWT + profil petugas.
- `reports.js`: fetch antrean laporan, detail laporan, update `admin_notes`, terbitkan undangan (`Perlu Verifikasi`), tolak laporan (`Ditolak`), kembalikan (`Perlu Verifikasi` → `Belum Ada`), pulihkan lawas, dan batalkan status (`Selesai`/`Ditolak` → `Dibatalkan`).
- `inventories.js`: CRUD inventori temuan (`GET`, `POST`, `PUT`, `DELETE` dengan verifikasi `confirm_id` & `reason`).
- `handovers.js`: eksekusi serah terima fisik (`POST /api/v1/admin/handovers`) dengan upload bukti foto `multipart/form-data`.
- `auditLogs.js`: fetch log audit dengan pagination & filter (khusus role otoritas tinggi).

### 5.2 Optimasi Base Features Tambahan
1. **Keamanan Media Privat (KTM & Foto Barang)**:
   - Pastikan URL thumbnail di `AdminReviewDrawer` dan `SecureFileModal` tidak memakai URL publik langsung, melainkan endpoint terautentikasi (`GET /api/v1/admin/files/:fileId`) dengan `Authorization` header atau *short-lived signed URL*.
2. **Pagination & Server-Side Filtering**:
   - Pindahkan filter pencarian, kategori, status tab (`Semua`, `Belum Ada`, `Perlu Verifikasi`, `Selesai`, `Ditolak`, `Dibatalkan`), dan flag `Lawas (>30h)` ke query parameter API agar tetap ringan saat data laporan/inventori mencapai ribuan baris.
3. **Frontend Publik (`frontend/`)**:
   - Bangun halaman pelaporan (`/lapor`), halaman cek status tiket (`/lacak`), dan dukungan parameter `?reopen=<token>` untuk alur **Ajukan Ulang Laporan**.
4. **Sinkronisasi `PRD-backend.md` & `PRD-frontend-admin.md`**:
   - Perbarui daftar transisi status, endpoint `DELETE /inventories/:id`, status `Dibatalkan`, dan endpoint AI matching pada dokumen PRD utama sebelum masuk fase coding backend.
