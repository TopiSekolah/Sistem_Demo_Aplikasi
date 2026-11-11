# Checklist UAT Sistem Penjadwalan Demo Aplikasi

Gunakan akun Development untuk simulasi; lakukan pengujian pada database percobaan, bukan produksi.

| ID | Role / aksi | Ekspektasi |
|---|---|---|
| U01 | PIC login, buka menu Periode | Periode dan persyaratan dapat disimpan dan ditampilkan ke mahasiswa |
| U02 | Mahasiswa membuat pengajuan lengkap beserta PDF | Status `PENDING_PIC`, masuk menu Pemeriksaan PIC |
| U03 | PIC meneruskan pengajuan tanpa dokumen | Ditolak dengan validasi dokumen pendukung |
| U04 | PIC meminta revisi dengan catatan | Status `REVISION_PIC`; mahasiswa dapat memperbaiki |
| U05 | Mahasiswa mengirim revisi | Kembali `PENDING_PIC` untuk diperiksa ulang |
| U06 | PIC meneruskan pengajuan lengkap | Status `PENDING_DOSEN`; dosen memperoleh antrean peninjauan |
| U07 | Dosen meminta revisi | Status `REVISION_DOSEN`; mahasiswa mendapat catatan |
| U08 | Dosen menyetujui pengajuan | Status `READY_TO_SCHEDULE`; PIC dapat menentukan jadwal |
| U09 | PIC menetapkan waktu, durasi, lokasi | Status `SCHEDULED`; jadwal tampil pada mahasiswa/dosen |
| U10 | PIC mencoba bentrok dosen atau ruangan | Server menolak dengan HTTP 409 |
| U11 | PIC mengubah jadwal | Jadwal tersimpan dan notifikasi baru masuk untuk mahasiswa/dosen |
| U12 | PIC mengganti dosen sebelum demo | Pengajuan kembali `PENDING_DOSEN`; jadwal kosong; dosen baru perlu review |
| U13 | Dosen memberi nilai 0–100 dan evaluasi **sebelum** waktu demo | Ditolak oleh backend |
| U14 | Dosen memberi nilai dan catatan **setelah** waktu demo | Status `DEMO_DONE`; mahasiswa melihat evaluasi |
| U15 | Mahasiswa mengirim ZIP aplikasi akhir | Status `SUBMITTED`; PIC melihat tugas dalam verifikasi |
| U16 | PIC meminta revisi repository | Status `SUBMISSION_REVISION`; mahasiswa dapat upload ulang |
| U17 | PIC setuju repository | Status `COMPLETED`; riwayat tersimpan |
| U18 | Mahasiswa membuka pengajuan mahasiswa lain (ID langsung) | Forbidden/akses ditolak |
| U19 | Dosen mencoba memeriksa pengajuan dosen lain | Forbidden/akses ditolak |
| U20 | PIC menambah akun mahasiswa/dosen/PIC | Daftar pengguna bertambah |
| U21 | PIC menonaktifkan akun lain | Akun tidak dapat mengakses API dengan JWT lamanya |
| U22 | PIC membuka Mapping Dosen | Mahasiswa dan jumlah per dosen tampil benar |
| U23 | PIC mengekspor laporan CSV | CSV UTF-8 terbuka, kolom evaluasi tersedia |
| U24 | Semua role membuka Notifikasi | Notifikasi relevan tampil, bisa ditandai dibaca |

## Build gate sebelum presentasi

```powershell
# Backend — Visual Studio Developer PowerShell
cd backend
dotnet restore
dotnet build -c Release

# Frontend — terminal VS Code
cd frontend
npm install
npm run build
npm run dev
```

Periksa bahwa SQL Server aktif, connection string benar, JWT Development sudah terisi, dan `.env.local` mengarah ke backend port 5000. Uji satu alur lengkap minimal sekali dengan ketiga role.
