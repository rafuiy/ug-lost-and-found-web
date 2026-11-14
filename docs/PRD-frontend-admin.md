# PRD Frontend Admin — UG Lost and Found

## 1. Ringkasan

Frontend Admin adalah panel privat untuk petugas loket. Panel mengelola seluruh alur internal:

1. Login admin.
2. Mencatat barang temuan ke inventori.
3. Meninjau laporan kehilangan.
4. Mencocokkan laporan dengan inventori.
5. Mengundang pelapor ke loket.
6. Memverifikasi KTM dan ciri khusus secara offline.
7. Mencatat serah terima.
8. Mengelola laporan lawas.
9. Melihat audit trail.

Panel tidak boleh diakses pelapor atau publik.

## 2. Keputusan Teknologi

| Komponen | Keputusan |
|---|---|
| Build tool | Vite |
| UI | React + TypeScript |
| Styling | Tailwind CSS |
| Font | PLUS JAKARTA SANS (Google Fonts) |
| Icons | React Icons library only |
| Design Guideline | UI_GUIDELINE.md + IMPECCABLE_TASTE_SKILL.md |
| Platform | Web responsive, fokus desktop loket |
| API | REST backend Go |
| Auth | JWT dari backend |
| Data | Inventori dan laporan internal |

Frontend mengikuti alur dan kebutuhan visual pada DOCX. Backend yang dipakai adalah Go + Fiber + GORM + PostgreSQL + auto migration.

**Design Compliance:**
- Semua teks memakai font PLUS JAKARTA SANS (load dari Google Fonts).
- Icon hanya dari React Icons; tidak ada icon set lain.
- Hindari pola AI slop: gradients dekoratif, tabel/card simetris, chip generik, warna arbitrary.
- Spacing mengikuti skala: 4px, 8px, 16px, 24px.
- Color semantic: intent dan hierarchy, bukan dekorasi.

## 3. Tujuan

- Menjaga inventori dan laporan pada satu panel internal.
- Mempercepat screening laporan baru.
- Mencegah kebocoran detail barang temuan.
- Menyediakan proses verifikasi yang konsisten.
- Memastikan setiap perubahan penting dapat diaudit.
- Memisahkan laporan aktif dan laporan lawas.

## 4. Di Luar Scope

- Akses panel tanpa autentikasi.
- Katalog inventori publik.
- Pencocokan otomatis tanpa keputusan admin.
- Serah terima tanpa pemeriksaan fisik.
- Edit atau hapus audit log dari UI.
- Chat real-time.
- Manajemen multi-cabang sebelum kebutuhan role ditetapkan.

## 5. Role dan Permission

### Admin Loket

- Login.
- Melihat inventori.
- Membuat dan mengubah inventori.
- Melihat laporan.
- Mengubah status sesuai alur.
- Membuat handover.
- Melihat file privat sesuai permission.

### Admin Berotorisasi Tinggi

- Semua hak Admin Loket.
- Melihat audit log.
- Memulihkan laporan lawas.
- Mengelola permission jika endpoint backend mendukungnya.

UI harus menyembunyikan aksi yang tidak dimiliki role. Backend tetap wajib memvalidasi permission.

## 6. Struktur Halaman

### 6.1 Login

Field:

- Username.
- Password.

Perilaku:

- Submit ke `POST /api/v1/auth/login`.
- Simpan token sesuai strategi keamanan yang disepakati backend.
- Jangan menampilkan password atau token di log.
- Pesan login gagal bersifat umum.
- Redirect ke dashboard setelah sukses.
- Redirect ke login jika session invalid atau token expired.

### 6.2 Dashboard

Menampilkan ringkasan:

- Laporan `Belum Ada` aktif.
- Laporan `Perlu Verifikasi`.
- Laporan lawas.
- Jumlah inventori `Tersimpan`.
- Aktivitas terbaru yang diizinkan role.

Dashboard tidak menampilkan secret traits atau file secara default.

### 6.3 Inventori

Kolom minimum:

- Nama barang.
- Kategori internal.
- Lokasi ditemukan.
- Waktu ditemukan.
- Status.
- Waktu dibuat.
- Aksi.

Filter:

- Status `Tersimpan` atau `Diambil`.
- Kategori.
- Lokasi.
- Pencarian internal.

Aksi:

- Tambah inventori.
- Lihat detail.
- Edit data sebelum diambil.

Detail inventori memuat:

- Detail fisik.
- Identitas penemu.
- Kontak penemu.
- Status.

Detail inventori tidak pernah tersedia pada frontend user.

### 6.4 Form Tambah/Edit Inventori

Field:

- Nama barang.
- Kategori internal.
- Lokasi ditemukan.
- Waktu ditemukan.
- Detail fisik barang.
- Nama penemu.
- Kontak penemu.

Validasi:

- Field wajib tidak boleh kosong.
- Tanggal dan waktu valid.
- Tampilkan konfirmasi sebelum mengubah inventori yang sudah terkait laporan.
- Jangan mengizinkan perubahan status menjadi `Diambil` dari form inventori biasa.

### 6.5 Daftar Laporan

Tab:

1. `Aktif`.
2. `Perlu Verifikasi`.
3. `Lawas`.
4. `Ditolak`.
5. `Selesai` jika histori dibutuhkan.

Kolom minimum:

- Ticket code.
- Nama pelapor.
- Nama barang.
- Lokasi kehilangan.
- Waktu kehilangan.
- Status.
- Badge `Lawas`.
- Waktu laporan.
- Aksi.

Filter:

- Status.
- `is_stale`.
- Rentang waktu.
- Pencarian ticket code atau nama barang.

Jangan tampilkan dokumen atau secret traits di tabel.

### 6.6 Detail Laporan

Bagian informasi:

- Identitas pelapor.
- Email dan nomor telepon.
- NPM.
- Detail kehilangan.
- Ciri khusus.
- Preview file dengan akses endpoint privat.
- Status dan riwayat perubahan.
- Catatan admin.

Keamanan UI:

- File diambil melalui endpoint terotorisasi.
- Jangan membentuk URL dari path filesystem.
- Jangan memasukkan file privat ke cache publik.
- Hindari preview PDF atau gambar jika browser tidak aman untuk konteks deployment.

Aksi detail:

- Tandai `Perlu Verifikasi`.
- Tolak laporan.
- Kembalikan ke `Belum Ada` setelah verifikasi loket gagal.
- Buat handover saat verifikasi fisik berhasil.
- Pulihkan laporan lawas.

### 6.7 Form Review

Saat admin memilih `Perlu Verifikasi`:

- Tampilkan konfirmasi.
- Minta catatan internal opsional atau wajib sesuai kebijakan.
- Tampilkan jadwal dan lokasi loket yang akan dikirim.
- Kirim request perubahan status.
- Tampilkan hasil email berdasarkan response backend.

Frontend tidak boleh mengubah status hanya dari checkbox tanpa konfirmasi.

### 6.8 Form Penolakan

Field:

- Alasan penolakan.

Perilaku:

- Alasan wajib.
- Tampilkan konfirmasi sebelum submit.
- Backend mengirim email penolakan jika dikonfigurasi.
- Catatan internal tidak otomatis ditampilkan kepada user.

### 6.9 Form Serah Terima

Dipakai hanya saat:

- Report berstatus `Perlu Verifikasi`.
- Inventory berstatus `Tersimpan`.
- Admin sudah mencocokkan KTM asli dan ciri khusus.

Field:

- Pilihan inventory yang cocok.
- Nama penerima.
- NPM penerima.
- Foto bukti serah terima atau KTM/KRS fisik sesuai kebijakan.
- Catatan serah terima.

Konfirmasi wajib memuat:

- Admin sudah memeriksa KTM asli.
- Admin sudah menguji ciri khusus barang.
- Data yang disubmit benar.
- Handover akan mengubah report menjadi `Selesai` dan inventory menjadi `Diambil`.

Setelah sukses:

- Kembali ke detail laporan.
- Tampilkan status `Selesai`.
- Tampilkan ringkasan handover.
- Nonaktifkan aksi handover kedua.

### 6.10 Audit Log

Kolom:

- Waktu.
- Admin.
- Aksi.
- Tabel target.
- ID target.
- IP jika tersedia.
- Ringkasan payload aman.

Audit log read-only.

## 7. Alur Operasional Admin

### 7.1 Mencatat Barang Temuan

1. Admin login.
2. Admin membuka Inventori.
3. Admin memilih `Tambah Inventori`.
4. Admin mengisi data barang dan penemu.
5. Sistem menyimpan status `Tersimpan`.
6. Sistem membuat audit log.

### 7.2 Screening Laporan

1. Admin membuka laporan aktif.
2. Admin membaca detail laporan.
3. Admin melihat foto pendukung dan dokumen melalui akses privat.
4. Admin membandingkan ciri rahasia dengan inventori fisik.
5. Jika cocok, admin memilih `Perlu Verifikasi`.
6. Sistem mengirim email undangan ke pelapor.

### 7.3 Serah Terima Berhasil

1. Pelapor hadir di loket.
2. Admin membuka laporan `Perlu Verifikasi`.
3. Admin meminta KTM asli.
4. Admin menguji ciri khusus barang.
5. Admin memilih inventory yang cocok.
6. Admin mengisi form handover.
7. Admin mengunggah bukti serah terima.
8. Admin mengonfirmasi.
9. Sistem mengubah report menjadi `Selesai`.
10. Sistem mengubah inventory menjadi `Diambil`.
11. Sistem membuat audit log.

### 7.4 Serah Terima Gagal

1. Admin menolak proses handover.
2. Admin mengisi alasan.
3. Inventory tetap `Tersimpan`.
4. Laporan dikembalikan ke `Belum Ada` atau menjadi `Ditolak`.
5. Sistem membuat audit log.

### 7.5 Laporan Lawas

1. Sistem menandai laporan `Belum Ada` lebih dari 30 hari.
2. Admin melihat badge `Lawas >30 Hari`.
3. Admin dapat membuka tab `Lawas`.
4. Admin dapat memulihkan laporan saat ada barang baru yang cocok.
5. Pemulihan mengembalikan laporan ke antrean aktif dan dicatat di audit log.

## 8. Kontrak API yang Dipakai

Base URL: `/api/v1`

- `POST /auth/login`
- `GET /admin/inventories`
- `POST /admin/inventories`
- `GET /admin/inventories/:id`
- `PATCH /admin/inventories/:id`
- `GET /admin/reports?status=&is_stale=&page=&limit=`
- `GET /admin/reports/:id`
- `PATCH /admin/reports/:id/status`
- `POST /admin/reports/:id/restore`
- `GET /admin/reports/:id/files/:file_type`
- `POST /admin/handovers`
- `GET /admin/audit-logs`

Semua endpoint selain login membutuhkan JWT. Backend menjadi sumber kebenaran untuk status dan permission.

## 9. State dan UX Rules

- Tampilkan loading pada setiap request.
- Cegah submit ganda.
- Tampilkan error API dalam bentuk yang dapat dipahami.
- Pertahankan filter saat kembali dari detail ke daftar.
- Gunakan pagination untuk daftar laporan dan inventori.
- Tampilkan empty state berbeda untuk `tidak ada data` dan `filter tidak menemukan data`.
- Minta konfirmasi untuk status, penolakan, pemulihan, dan handover.
- Setelah mutation sukses, refresh data dari backend.
- Jangan menganggap status berubah sebelum response sukses.
- Tangani token expired dengan logout dan redirect ke login.

## 10. Privasi dan Keamanan

- Panel hanya berjalan di origin admin.
- Jangan menampilkan data inventori ke aplikasi user.
- Jangan menaruh file privat di URL publik atau HTML statis.
- Jangan menyimpan password atau token dalam log.
- Hindari menyimpan JWT di `localStorage` jika backend menyediakan cookie HttpOnly.
- Jika token disimpan di browser, terapkan strategi yang disetujui security review.
- Masking data sensitif pada daftar jika tidak diperlukan.
- Batasi preview file berdasarkan permission.
- Admin tidak boleh menghapus audit log dari UI.
- Semua aksi sensitif memerlukan response sukses dari backend.

## 11. Responsive Behavior

### Desktop

- Sidebar navigasi.
- Tabel laporan dan inventori.
- Panel detail atau halaman detail.
- Filter dapat terlihat tanpa membuka modal berulang.

### Tablet dan Mobile

- Tabel berubah menjadi card atau scroll horizontal yang tetap usable.
- Form handover satu kolom.
- Tombol konfirmasi tetap terlihat.
- File preview tidak boleh memenuhi layar tanpa kontrol kembali.

## 12. Deliverable Bertahap

### Tahap 1 — Auth dan Shell

- Setup Vite, React, TypeScript, Tailwind.
- Login.
- Token/session handling.
- Protected route.
- Layout sidebar dan header.
- Logout.

**Hasil:** hanya admin terautentikasi dapat masuk panel.

### Tahap 2 — Inventori

- Dashboard ringkas.
- Daftar inventori.
- Tambah dan edit inventori.
- Filter status.
- Detail barang.

**Hasil:** admin dapat mencatat barang temuan berstatus `Tersimpan`.

### Tahap 3 — Laporan dan Screening

- Daftar laporan.
- Tab aktif dan lawas.
- Filter dan pagination.
- Detail laporan.
- Preview file privat.
- Perubahan status.

**Hasil:** admin dapat menyaring laporan dan mengundang pelapor.

### Tahap 4 — Handover

- Form verifikasi loket.
- Upload bukti.
- Konfirmasi transaction.
- Ringkasan handover.
- Disable handover ganda.

**Hasil:** admin dapat menyelesaikan serah terima secara terkontrol.

### Tahap 5 — Audit dan Hardening

- Audit log read-only.
- Permission-based actions.
- Token expiry handling.
- Error, loading, empty state.
- Responsive QA.
- Security test akses file dan privilege.

**Hasil:** panel siap digunakan operasional loket.

## 13. Acceptance Criteria

- [ ] User tanpa JWT tidak dapat melihat panel admin.
- [ ] Admin berhasil login dengan kredensial valid.
- [ ] Login gagal tidak mengungkap apakah username atau password yang salah.
- [ ] Admin dapat membuat inventori dengan status `Tersimpan`.
- [ ] Daftar inventori tidak pernah tersedia pada frontend user.
- [ ] Admin dapat melihat laporan berdasarkan status dan flag lawas.
- [ ] Detail laporan menampilkan data internal hanya setelah authorization.
- [ ] File privat diambil melalui endpoint backend terotorisasi.
- [ ] Admin dapat mengubah `Belum Ada` menjadi `Perlu Verifikasi`.
- [ ] Admin wajib mengisi alasan saat menolak laporan.
- [ ] Admin hanya dapat handover laporan `Perlu Verifikasi`.
- [ ] Form handover meminta inventory, penerima, NPM, bukti, dan catatan.
- [ ] Handover sukses menampilkan `Selesai` dan inventory `Diambil`.
- [ ] Handover kedua untuk laporan yang sama tidak tersedia.
- [ ] Admin dapat mengembalikan laporan lawas ke antrean aktif.
- [ ] Audit log ditampilkan read-only.
- [ ] Semua mutation memiliki loading, error, success, dan refresh state.
- [ ] Token expired mengeluarkan admin ke halaman login.
- [ ] Layout usable pada desktop dan mobile.

**Design & Style Compliance:**
- [ ] Semua teks pakai font PLUS JAKARTA SANS (Google Fonts import).
- [ ] Icon hanya dari React Icons (20px/24px/16px sizes); tidak ada icon set lain.
- [ ] Tidak ada gradient dekoratif pada button, background, atau card.
- [ ] Tabel dan card layout didasarkan data importance, bukan simetri aesthetis.
- [ ] Spacing konsisten: 4px, 8px, 16px, 24px scale.
- [ ] Color intent-driven: error=red, success=green, info=blue, danger=red, dll.
- [ ] Tidak ada generic chip atau badge UI tanpa konteks/interaksi.
- [ ] Desain audit: review sidebar nav, button styling, form inputs vs UI_GUIDELINE.md.

## 14. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Admin tidak berwenang melihat dokumen | JWT + permission backend + endpoint file privat |
| Salah memilih inventory | Tampilkan detail fisik, minta konfirmasi, validasi backend |
| Handover ganda | Constraint unik `report_id` + transaction + disable UI |
| Laporan aktif tertutup laporan lawas | Tab dan filter `Lawas` terpisah, bukan menghapus |
| Status UI tidak sinkron | Refresh dari backend setelah mutation sukses |
| Audit log dimanipulasi | Endpoint read-only dan pembatasan role |
| Token dicuri dari browser | Cookie HttpOnly bila tersedia, tidak log token, timeout session |
