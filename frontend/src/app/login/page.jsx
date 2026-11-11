"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck2,
  CircleCheck,
  FileText,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Login gagal.");
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-shell">
      <section className="login-brand-panel">
        <div className="brand">
          <span className="brand-icon">
            <GraduationCap size={21} />
          </span>
          <span>
            DEMO<span className="brand-accent">AKADEMIK</span>
          </span>
        </div>
        <div className="login-promo">
          <h1>
            Sistem penjadwalan <span>demo aplikasi</span>
          </h1>
          <div className="promo-list">
            <div>
              <CalendarCheck2 size={20} /> Pengajuan demo aplikasi dan dokumen
            </div>
          </div>
        </div>
        <div className="login-side-footer">© 2026 Supervisi Team</div>
      </section>
      <section className="login-form-panel">
        <div className="login-box">
          <span className="eyebrow">SELAMAT DATANG</span>
          <h2>Masuk ke Aplikasi</h2>
          <form onSubmit={login} className="login-form">
            <label>
              Username
              <input
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
              />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
              />
            </label>
            {error && <div className="alert error">{error}</div>}
            <button type="submit" className="btn primary full" disabled={busy}>
              {busy ? "Memproses..." : "Masuk"}
              <ArrowRight size={17} />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}