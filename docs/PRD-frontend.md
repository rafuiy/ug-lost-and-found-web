# PRD Frontend User — UG Lost and Found

## 1. Ringkasan

Frontend User adalah web responsive untuk mahasiswa atau pelapor. Aplikasi mengikuti alur pada `PRD_UG_Lost_and_Found.docx`:

- Pelaporan tanpa login.
- Upload KTM/KRS dan foto pendukung opsional.
- Ticket code setelah laporan berhasil.
- Link email dan halaman tracking.
- Tracking memakai ticket code dan 4 digit verifikasi.
- Tidak ada katalog barang temuan publik.

## 2. Keputusan Teknologi

| Komponen | Keputusan |
|---|---|
| Build tool | Vite |
| UI | React + TypeScript |
| Styling | Tailwind CSS |
| Platform | Web responsive desktop dan mobile |
| Data | REST API backend |
| Auth user | Tidak ada login |

Frontend tidak boleh mengandalkan data inventori untuk mencocokkan barang. Pencocokan dilakukan admin berdasarkan data tertutup dan verifikasi fisik.

## 3. Tujuan

- Membuat laporan kehilangan dengan cepat.
- Mengurangi kebutuhan komunikasi manual.
- Memberi status yang mudah dipahami.
- Menjaga privasi dokumen identitas dan detail laporan.
- Mengarahkan pelapor ke loket saat status membutuhkan verifikasi.

## 4. Di Luar Scope

- Login atau registrasi pelapor.
- Halaman daftar barang temuan publik.
- Chat dengan admin.
- Pencarian berdasarkan nama barang di inventori.
- Klaim otomatis tanpa pemeriksaan loket.
- Aplikasi mobile native.

## 5. Struktur Halaman

### 5.1 Beranda

Isi:

- Nama dan tujuan layanan UG Lost and Found.
- Tombol `Laporkan Kehilangan`.
- Tombol `Lacak Laporan`.
- Penjelasan singkat proses.
- Peringatan bahwa barang diserahkan dan diverifikasi di loket.
- Kontak atau jam layanan jika tersedia.

Beranda tidak menampilkan data laporan atau inventori.

### 5.2 Form Laporan

Field wajib:

- Nama pelapor.
- Email aktif.
- NPM.
- Nomor WhatsApp atau telepon.
- Nama barang.
- Lokasi kehilangan.
- Waktu kehilangan.
- Deskripsi barang.
- Ciri khusus atau rahasia barang.
- Foto KTM/KRS.

Field opsional:

- Foto pendukung barang, misalnya foto sebelum hilang atau nota.

Petunjuk UI:

- Tandai field wajib.
- Jelaskan bahwa ciri rahasia tidak ditampilkan ke publik.
- Jelaskan format dan batas file sebelum upload.
- Tampilkan nama file dan ukuran.
- Sediakan hapus atau ganti file sebelum submit.
- Nonaktifkan submit selama request berjalan.
- Jangan mengosongkan seluruh form saat error validasi.

### 5.3 Hasil Submit

Saat backend berhasil:

- Tampilkan ticket code.
- Tampilkan status awal `Belum Ada`.
- Tampilkan link tracking.
- Tampilkan instruksi menyimpan ticket code.
- Tampilkan bahwa konfirmasi dikirim ke email.
- Sediakan tombol salin ticket code.

Ticket code tidak boleh tertutup oleh navigasi atau hilang setelah reload tanpa cara mendapatkannya kembali melalui email.

### 5.4 Halaman Tracking

Input:

- Ticket code.
- 4 digit verifikasi sesuai aturan backend, berasal dari NPM atau nomor WhatsApp.

Output aman:

- Ticket code.
- Status.
- Waktu laporan.
- Pesan status.
- Badge `Lawas` jika `is_stale = true`.
- Instruksi berikutnya.

Jangan tampilkan:

- Secret traits.
- KTM/KRS.
- Foto pendukung.
- Data penemu.
- Daftar inventori.
- Data laporan lain.

Jika kredensial tracking salah, tampilkan pesan umum. Jangan menjelaskan bagian mana yang salah.

### 5.5 Status Laporan

#### `Belum Ada`

Pesan: laporan sudah diterima, tetapi belum ada kecocokan barang.

Jika `is_stale = true`, tampilkan badge `Lawas >30 Hari` dan penjelasan bahwa laporan tetap tersimpan.

#### `Perlu Verifikasi`

Pesan: ada kecocokan awal. Pelapor harus datang ke loket.

Tampilkan:

- Jadwal loket.
- Lokasi loket.
- Dokumen yang wajib dibawa: KTM asli.
- Peringatan bahwa admin tetap memeriksa ciri rahasia barang.

Jangan tampilkan seluruh detail inventori.

#### `Selesai`

Pesan: serah terima selesai.

#### `Ditolak`

Pesan: laporan atau verifikasi ditolak.

Jika backend mengirim alasan yang aman untuk publik, tampilkan alasan tersebut. Jangan tampilkan catatan internal admin.

## 6. Alur Pengguna

### 6.1 Happy Path

1. Pelapor membuka beranda.
2. Pelapor memilih `Laporkan Kehilangan`.
3. Pelapor mengisi form.
4. Pelapor mengunggah KTM/KRS.
5. Pelapor mengunggah foto pendukung jika ada.
6. Frontend memvalidasi format dasar.
7. Frontend mengirim `multipart/form-data` ke `POST /api/v1/reports`.
8. Frontend menampilkan ticket code.
9. Pelapor menerima email konfirmasi.
10. Pelapor membuka link tracking.
11. Pelapor memasukkan ticket code dan 4 digit verifikasi.
12. Saat status `Perlu Verifikasi`, pelapor datang ke loket.
13. Admin memverifikasi KTM dan ciri khusus secara offline.
14. Pelapor melihat status `Selesai` setelah handover tercatat.

### 6.2 Barang Belum Cocok

1. Pelapor melacak laporan.
2. Frontend menampilkan `Belum Ada`.
3. Setelah 30 hari, frontend menampilkan badge `Lawas >30 Hari`.
4. Frontend tetap menyediakan tracking.

### 6.3 Error Submit

- Error validasi: tampilkan pada field terkait.
- File terlalu besar: tampilkan batas 2 MB.
- File tidak didukung: tampilkan JPG, PNG, atau PDF.
- Network error: tampilkan status gagal dan tombol coba lagi.
- Timeout email: tetap tampilkan ticket code jika API menyatakan laporan tersimpan.
- Error server: tampilkan pesan umum tanpa detail internal.

### 6.4 Tracking Gagal

- Tampilkan pesan umum jika ticket code atau kode verifikasi tidak valid.
- Jangan memberi petunjuk apakah ticket code terdaftar.
- Batasi percobaan pada sisi UI tanpa menggantikan rate limit backend.

## 7. Kontrak API yang Dipakai

### Submit

`POST /api/v1/reports`

Content type: `multipart/form-data`.

Response sukses minimum:

```json
{
  "data": {
    "ticket_code": "UG-7X9K2",
    "status": "Belum Ada",
    "tracking_url": "/track/UG-7X9K2"
  }
}
```

### Tracking

`POST /api/v1/reports/track`

Request:

```json
{
  "ticket_code": "UG-7X9K2",
  "verification_code": "1234"
}
```

Frontend hanya merender field publik dari response. Frontend tidak mencoba mengambil file privat.

## 8. Validasi UI

- Nama: tidak kosong, batas panjang mengikuti backend.
- Email: format email valid.
- NPM: format dan panjang mengikuti aturan backend.
- Nomor telepon: karakter yang diizinkan dan panjang wajar.
- Tanggal kehilangan: format valid.
- Semua field wajib harus terisi.
- KTM/KRS: wajib, JPG/PNG/PDF, maksimum 2 MB.
- Foto pendukung: opsional, JPG/PNG/PDF jika backend mengizinkan format tersebut, maksimum 2 MB.
- Ciri khusus: wajib dan tidak boleh hanya whitespace.

Validasi frontend meningkatkan UX. Backend tetap menjadi sumber kebenaran keamanan.

## 9. Privasi dan Aksesibilitas

- Jangan menyimpan KTM/KRS di `localStorage`, URL, analytics, atau log browser.
- Jangan menampilkan isi file di halaman publik setelah upload.
- Gunakan label yang terhubung ke input.
- Sediakan pesan error yang terbaca screen reader.
- Semua aksi utama dapat dilakukan dengan keyboard.
- Kontras teks dan tombol memenuhi standar aksesibilitas.
- Loading state memiliki teks, bukan hanya animasi.
- Fokus dipindahkan ke hasil submit atau error setelah request selesai.
- Ukuran target sentuh memadai pada mobile.

## 10. Responsive Behavior

### Mobile

- Form satu kolom.
- Upload dapat memakai kamera atau file picker perangkat.
- Tombol utama mudah dijangkau.
- Ticket code berukuran terbaca dan mudah disalin.

### Desktop

- Form dapat memakai layout dua kolom jika tidak mengurangi keterbacaan.
- Informasi instruksi berada dekat field terkait.
- Area hasil tracking tetap ringkas.

## 11. Deliverable Bertahap

### Tahap 1 — Shell UI

- Setup Vite, React, TypeScript, Tailwind.
- Routing halaman publik.
- Layout responsive.
- Beranda dan navigasi.

**Hasil:** pengguna dapat berpindah ke form dan tracking.

### Tahap 2 — Form Laporan

- Semua field.
- Validasi client-side.
- Upload file.
- Loading dan error state.
- Submit ke backend.

**Hasil:** laporan valid dapat dikirim tanpa login.

### Tahap 3 — Hasil dan Tracking

- Halaman hasil submit.
- Ticket code dan salin.
- Halaman tracking.
- Render status dan `Lawas`.
- Pesan status `Perlu Verifikasi`.

**Hasil:** pelapor dapat mengetahui progres tanpa login.

### Tahap 4 — Privacy dan Accessibility Hardening

- Audit data yang disimpan browser.
- Keyboard navigation.
- Screen reader labels.
- Focus management.
- Responsive QA.
- Error boundary dan network recovery.

**Hasil:** alur publik siap dipakai pada desktop dan mobile.

## 12. Acceptance Criteria

- [ ] Pengguna dapat membuat laporan tanpa login.
- [ ] Form meminta semua data wajib dari alur DOCX.
- [ ] KTM/KRS wajib diunggah.
- [ ] Foto pendukung bersifat opsional.
- [ ] File invalid ditolak sebelum submit atau oleh backend dengan pesan jelas.
- [ ] Submit sukses menampilkan ticket code unik dari backend.
- [ ] Pengguna dapat menyalin ticket code.
- [ ] Tracking meminta ticket code dan 4 digit verifikasi.
- [ ] Tracking tidak menampilkan katalog inventori.
- [ ] Tracking tidak menampilkan secret traits atau file pribadi.
- [ ] Status `Perlu Verifikasi` menampilkan lokasi, jadwal, dan KTM asli sebagai instruksi.
- [ ] Status `Lawas` terlihat saat `is_stale = true`.
- [ ] Error tidak menghapus input yang masih valid.
- [ ] Loading state mencegah submit ganda.
- [ ] Layout berfungsi pada mobile dan desktop.
- [ ] Form dan error dapat digunakan dengan keyboard dan screen reader.

## 13. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Pengguna lupa ticket code | Kirim email konfirmasi dan sediakan tombol salin |
| Data pribadi tersimpan browser | Jangan simpan file atau data sensitif di local storage |
| Tracking ditebak | Backend memakai ticket code acak dan rate limit |
| Pengguna mengira barang pasti tersedia | Copy status menjelaskan verifikasi admin dan loket |
| Submit ganda | Disable tombol selama request dan backend idempotency bila diperlukan |
| Email terlambat | Tampilkan hasil berdasarkan response penyimpanan backend, bukan status email |
