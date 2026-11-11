# SPDA — Sistem Penjadwalan Demo Aplikasi (Kelompok 02) — Versi 2

**Source code full-stack** untuk simulasi UAS Teknik Supervisi, berdasarkan `Product Documentation_Kelompok 02.docx` BAB 2 (proses bisnis, aktor, master/transaksi, fitur), dengan referensi rencana kerja `AP_SPDA_Kel 02.xlsx`.

> Versi ini menggantikan alur lama. **Mahasiswa tidak menentukan waktu/ruangan final**: mahasiswa mengajukan data aplikasi + dosen + dokumen; **PIC PKTA memeriksa kelengkapan**; **dosen meninjau**; **PIC menetapkan jadwal**; **dosen mencatat nilai & evaluasi**; lalu tugas akhir diarsipkan. Pengumpulan aplikasi akhir dan approval PIC tetap disediakan sebagai **tambahan dari kebutuhan awal**, sebab dokumen terbaru menyebut *Repository Aplikasi* tetapi belum merinci approval kedua.

## 1. Teknologi

| Layer | Teknologi | Software |
|---|---|---|
| Database | **Microsoft SQL Server** dan T-SQL (2017+) | SQL Server Database Engine + **SSMS** untuk mengelola |
| Backend | **ASP.NET Core Web API .NET 8**, Dapper, JWT, Swagger | **Visual Studio 2022** |
| Frontend | **React + Next.js 15**, JavaScript, CSS, Lucide | **Visual Studio Code** |
| File | Folder privat `backend/PrivateUploads` | Diunduh lewat endpoint yang memeriksa role |

**SSMS bukan database engine.** Pastikan SQL Server Express/Developer sudah berjalan. Proyek menggunakan autentikasi lokal untuk demo, bukan SSO bawaan template akademik. UI biru disesuaikan dengan konsep template yang diberikan.

## 2. Struktur proyek

```
Sistem_Demo_Aplikasi/
├── database/
│   ├── 01_schema.sql                 # Instalasi baru
│   └── 02_upgrade_from_v1.sql       # Migrasi dari versi lama (BACKUP dulu)
├── backend/
│   ├── DemoScheduling.Api.sln        # Buka di Visual Studio 2022
│   ├── DemoScheduling.Api.csproj
│   ├── Program.cs                    # Endpoint REST dan workflow
│   ├── Access.cs                     # Otorisasi, validasi, notifikasi, histori
│   ├── Contracts.cs                  # Request DTO
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   └── Properties/launchSettings.json
├── frontend/
│   ├── package.json
│   ├── .env.local.example
│   └── src/app/page.jsx              # Dashboard mahasiswa/dosen/PIC
├── docs/
│   ├── ALUR_DAN_STATUS.md
│   └── CHECKLIST_UAT.md
└── references/                       # Dokumen acuan yang diunggah pengguna
```

## 3. Setup dan menjalankan di Windows

### A. Database: SSMS

1. Siapkan SQL Server Database Engine dan buka SQL Server Management Studio (SSMS).
2. Sambungkan ke instance SQL (`localhost`, `.\\SQLEXPRESS`, atau instance lain).
3. **Jika belum pernah membuat database dari proyek ini:** buka `database/01_schema.sql`, klik **Execute**.
4. **Jika sudah pernah menjalankan `01_schema.sql` dari aplikasi versi lama:** **BACKUP** database `DemoAplikasiDB`, kemudian buka dan jalankan **`database/02_upgrade_from_v1.sql`**. Jangan hapus database lama; data historis dipertahankan dan status lama `APPROVED` menjadi `SCHEDULED`.
5. Refresh `Databases > DemoAplikasiDB > Tables`. Harus ada `AppUsers`, `DemoRequests`, `DemoFiles`, `DemoHistory`, `DemoPeriod`, `DemoNotifications`.

Jangan menjalankan kedua skrip sebagai pengganti backup. `01_schema.sql` digunakan untuk instalasi baru, sedangkan `02_upgrade_from_v1.sql` untuk upgrade.

### B. Backend: Visual Studio 2022

1. Pasang workload **ASP.NET and web development** serta .NET 8 SDK.
2. Buka `backend/DemoScheduling.Api.sln` di Visual Studio 2022.
3. Edit `backend/appsettings.json` bagian `ConnectionStrings.DefaultConnection`. Contoh SQL Server Express pada file JSON:

   ```json
   "DefaultConnection": "Server=localhost\\SQLEXPRESS;Database=DemoAplikasiDB;Trusted_Connection=True;TrustServerCertificate=True;"
   ```

   Atau default server `localhost` (jika instance default). Untuk SQL Authentication, gunakan koneksi SQL user dengan hak minimum, simpan rahasia di environment/user secrets, bukan di Git.
4. Restore NuGet bila diminta, pilih profil `http`, lalu jalankan **F5** (atau `dotnet run --launch-profile http`).
5. Backend berjalan di **http://localhost:5000**. Buka **http://localhost:5000/swagger** untuk melihat dokumentasi API. Akun demo dibuat otomatis saat Development pertama kali dijalankan jika schema sudah dibuat.

### C. Frontend: Visual Studio Code

1. Buka folder `frontend/`.
2. Salin `.env.local.example` menjadi `.env.local`. Isinya `BACKEND_URL=http://localhost:5000`.
3. Pada terminal:

   ```powershell
   npm install
   npm run dev
   ```

4. Akses **http://localhost:3000/login**. Pastikan backend port 5000 dan frontend port 3000 menyala bersamaan.

**Akun demo khusus Development:**

| Role | Username | Password |
|---|---|---|
| Mahasiswa | `mahasiswa1`, `mahasiswa2` | `Demo123!` |
| Dosen | `dosen1`, `dosen2` | `Demo123!` |
| PIC PKTA | `pic1` | `Demo123!` |

Ubah akun, password, dan kunci JWT untuk pemakaian nyata. Jangan aktifkan seed demo di produksi.

## 4. Proses bisnis baru

1. PIC PKTA membuka periode pengajuan dan menetapkan persyaratan.
2. Mahasiswa mengisi judul/deskripsi aplikasi, memilih dosen pembimbing, mencantumkan persyaratan, dan mengunggah dokumen pendukung.
3. PIC memeriksa kelengkapan; boleh meminta revisi, menolak, atau meneruskan ke dosen. Minimal satu berkas pendukung diperlukan untuk meneruskan.
4. Dosen pembimbing meninjau; boleh menyetujui atau meminta revisi.
5. Bila lolos, PIC menetapkan tanggal, jam, durasi, serta lokasi demo; ada pengecekan bentrok waktu dosen dan lokasi.
6. Mahasiswa dan dosen memperoleh notifikasi **di dalam aplikasi** (bukan email/push).
7. Setelah waktu demo berlangsung, dosen memberikan **nilai 0–100** dan catatan evaluasi (rentang nilai adalah keputusan implementasi prototipe; ketentuan bobot penilaian belum ditentukan pada dokumen).
8. Mahasiswa mengunggah file hasil akhir/repository dan PIC memverifikasi atau mengembalikan untuk revisi — **tahap tambahan yang dipertahankan dari penjelasan awal**.
9. PIC melakukan monitoring, mapping berdasarkan dosen, dan ekspor laporan CSV; setiap transisi tercatat di `DemoHistory`.

Lihat `docs/ALUR_DAN_STATUS.md` untuk diagram status dan hak akses lengkap.

## 5. Fitur per role

**Mahasiswa:** dashboard, pengajuan, unggah dokumen, perbaikan dari PIC/dosen, status/jadwal, riwayat/evaluasi, kirim repository, notifikasi.

**Dosen:** dashboard, antrean peninjauan, keputusan dan catatan revisi, jadwal final, nilai/evaluasi, riwayat, notifikasi.

**PIC PKTA:** pemeriksaan dokumen, pengelolaan periode dan persyaratan, penjadwalan & reschedule, pergantian dosen (mengulang persetujuan), validasi repository, mapping, kelola akun, laporan CSV, histori, notifikasi.

## 6. API inti

| Method | Endpoint | Role | Hasil |
|---|---|---|---|
| POST | `/api/auth/login` | publik | JWT login |
| GET/POST | `/api/demos` | sesuai role/mahasiswa | daftar/buat pengajuan |
| PUT | `/api/demos/{id}` | mahasiswa | revisi sebelum peninjauan ulang |
| POST | `/api/demos/{id}/review` | PIC | lengkap/revisi/tolak |
| POST | `/api/demos/{id}/lecturer-review` | dosen | setuju/revisi |
| POST | `/api/demos/{id}/schedule` | PIC | tetapkan/ubah jadwal |
| POST | `/api/demos/{id}/reassign-lecturer` | PIC | ganti dosen, kembali tinjau |
| POST | `/api/demos/{id}/complete-demo` | dosen | nilai + evaluasi |
| POST | `/api/demos/{id}/files` | mahasiswa | dokumen/repository (multipart) |
| POST | `/api/demos/{id}/submission-review` | PIC | verifikasi/revisi repository |
| GET/PUT | `/api/period` | semua/PIC | lihat/atur periode + persyaratan |
| GET/POST/PATCH | `/api/users` dan `/api/users/{id}` | PIC | daftar/tambah/ubah akun |
| GET/POST | `/api/notifications`, `/api/notifications/{id}/read` | login | lihat/tandai dibaca |

Swagger memuat semua endpoint rinci. Frontend memakai route `/api/backend/...` sebagai reverse proxy; JWT disimpan di cookie HTTP-only.

## 7. Batasan dan verifikasi

- **Belum ada pengujian end-to-end langsung pada instance SQL Server atau kompilasi .NET** di lingkungan pembuatan artefak. Syntax JSX diperiksa, namun jalankan `dotnet build`, `npm install`, `npm run build`, dan skenario `docs/CHECKLIST_UAT.md` di Windows sebelum presentasi.
- Tidak ada integrasi SSO, email, push notification, sinkronisasi kalender eksternal, atau unggah source code ke Git; repository berbentuk berkas ZIP/PDF/DOCX dan arsip lokal privat.
- File disimpan di server backend lokal. Untuk deployment riil, perlukan backup berkala, pemindaian malware, log audit lanjutan, pembatasan rate login, TLS/HTTPS, dan pengaturan file storage permanen.
- Persyaratan periode dari PIC ditampilkan ke mahasiswa sebagai teks; sistem belum memiliki checklist wajib per-jenis dokumen otomatis.
- **SSMS 2018** tidak menentukan versi SQL Server Database Engine. SQL T-SQL di proyek ditargetkan untuk SQL Server 2017 atau lebih baru.

## 8. Asal dan prioritas aturan

1. `Product Documentation_Kelompok 02.docx`, terutama BAB 2.1–2.6, menjadi **acuan utama proses baru**.
2. `AP_SPDA_Kel 02.xlsx` menjadi acuan rencana pekerjaan, **bukan skema database aplikasi**.
3. Kebutuhan awal pengguna mengenai **unggah hasil akhir dan persetujuan kedua PIC** dipertahankan sebagai tambahan yang dinyatakan eksplisit, tidak diklaim berasal dari urutan final BAB 2.5.
4. Template aplikasi akademik digunakan sebagai **referensi gaya dashboard**. Kode autentikasi SSO khusus institusi tidak digunakan.
