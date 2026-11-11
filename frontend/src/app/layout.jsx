import "./globals.css";
export const metadata = {
  title: "Demo Akademik | Sistem Penjadwalan Demo Aplikasi",
  description: "Pengajuan, persetujuan, penjadwalan, pelaksanaan, dan pengumpulan hasil demo aplikasi."
};
export default function RootLayout({ children }) {
  return <html lang="id"><body>{children}</body></html>;
}
