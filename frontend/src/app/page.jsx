"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine, ArrowLeft, Bell, BookOpen, CalendarCheck2,
  CalendarClock, Check, CheckCheck, ChevronDown, ChevronRight, CircleAlert, CircleCheck,
  ClipboardCheck, FileArchive, FileCheck2, FileText, GraduationCap, LayoutDashboard,
  ListFilter, LogOut, MapPin, Menu, Plus, Search, Send, ShieldCheck,
  Upload, UserRound, Users, X
} from "lucide-react";
import { api, downloadFile, formatDate, STATUS } from "@/lib/api";

function StatusBadge({ value }) {
  const [label, style] = STATUS[value] || [value, "muted"];
  return (
    <span className={`status status-${style}`}>
      <span className="status-dot" />
      {label}
    </span>
  );
}

const displayName = { MAHASISWA: "Mahasiswa", DOSEN: "Dosen", PIC: "PIC" };

const menuFor = (role) => {
  const common = [
    { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { key: "notifications", label: "Notifikasi", Icon: Bell }
  ];
  if (role === "MAHASISWA") {
    return [
      ...common,
      { key: "mine", label: "Pengajuan Demo", Icon: CalendarClock },
      { key: "history", label: "Riwayat & Evaluasi", Icon: BookOpen }
    ];
  }
  if (role === "DOSEN") {
    return [
      ...common,
      { key: "review", label: "Peninjauan Aplikasi", Icon: ClipboardCheck },
      { key: "schedule", label: "Jadwal Demo", Icon: CalendarCheck2 },
      { key: "history", label: "Riwayat & Penilaian", Icon: BookOpen }
    ];
  }
  return [
    ...common,
    { key: "pending", label: "Pemeriksaan Pengajuan", Icon: ShieldCheck },
    { key: "ready", label: "Kelola Penjadwalan", Icon: CalendarClock },
    { key: "submissions", label: "Validasi Repository", Icon: FileCheck2 },
    { key: "mapping", label: "Mapping Dosen", Icon: Users },
    { key: "all", label: "Semua Pengajuan", Icon: BookOpen },
    { key: "users", label: "Kelola Pengguna", Icon: UserRound },
    { key: "reports", label: "Laporan & Rekap", Icon: FileArchive },
    { key: "period", label: "Periode Pengajuan", Icon: CalendarClock }
  ];
};

function getGreetingName(user) {
  return user?.fullName || "";
}

function Sidebar({ user, active, onSelect, onLogout, open, setOpen }) {
  return (
    <>
      {open && <button aria-label="Tutup menu" className="sidebar-mask" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <GraduationCap size={22} />
          </div>
          <div>
            <strong>SPDA</strong>
            <small>Sistem Penjadwalan Demo</small>
          </div>
        </div>
        <div className="sidebar-scroll">
          <div className="sidebar-label">MENU UTAMA</div>
          <nav className="nav-list">
            {menuFor(user.role).map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => {
                  onSelect(item.key);
                  setOpen(false);
                }}
                className={`nav-item ${active === item.key ? "active" : ""}`}
              >
                <item.Icon size={18} />
                <span>{item.label}</span>
                {active === item.key && <ChevronRight size={15} className="ml-auto" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-label section-label">AKUN</div>
          <div className="nav-list">
            <div className="nav-item static">
              <UserRound size={18} />
              <span>{displayName[user.role]}</span>
            </div>
            <button type="button" onClick={onLogout} className="nav-item">
              <LogOut size={18} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function StatCard({ label, count, statusType = "neutral", caption }) {
  return (
    <div className="stat-card">
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        {statusType !== "neutral" && <span className={`stat-dot-sm stat-dot-${statusType}`} />}
      </div>
      <div className={`stat-number ${statusType}`}>{count}</div>
      <div className="stat-caption">{caption}</div>
    </div>
  );
}

function OnboardingCard() {
  return (
    <div className="onboarding-card">
      <div className="onboarding-head">
        <h2>Mulai dari sini: ajukan demo pertamamu</h2>
        <p>Ikuti 3 langkah ringkas berikut untuk mengajukan dan menyelesaikan jadwal demo tugas akhir Anda:</p>
      </div>
      <div className="onboarding-steps">
        <div className="onboarding-step">
          <span className="onboarding-step-num">1</span>
          <div>
            <strong>Isi Formulir Aplikasi</strong>
            <span>Tuliskan judul aplikasi, deskripsi fitur, pilih dosen pembimbing, dan persyaratan.</span>
          </div>
        </div>
        <div className="onboarding-step">
          <span className="onboarding-step-num">2</span>
          <div>
            <strong>Unggah Berkas Pendukung</strong>
            <span>Sertakan dokumen (PDF, DOCX, atau ZIP) agar dapat diperiksa kelengkapannya oleh PIC PKTA.</span>
          </div>
        </div>
        <div className="onboarding-step">
          <span className="onboarding-step-num">3</span>
          <div>
            <strong>Pantau Jadwal & Penilaian</strong>
            <span>Dosen meninjau pengajuan, PIC menetapkan waktu demo, dan dosen mencatat evaluasi akhir.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProcessStepper({ onDetailClick }) {
  const steps = [
    { num: 1, label: "Ajukan" },
    { num: 2, label: "PIC memeriksa" },
    { num: 3, label: "Dosen meninjau" },
    { num: 4, label: "PIC menjadwalkan" },
    { num: 5, label: "Dosen mengevaluasi" },
    { num: 6, label: "Kirim tugas akhir" }
  ];

  return (
    <div className="process-stepper-panel">
      <div className="stepper-header">
        <span className="stepper-title">Alur Pengajuan Demo</span>
        {onDetailClick && (
          <button type="button" className="stepper-link" onClick={onDetailClick}>
            Lihat Detail <ChevronRight size={13} />
          </button>
        )}
      </div>
      <div className="stepper-track">
        {steps.map((st, idx) => (
          <div key={st.num} className="stepper-step">
            <span className="step-num">{st.num}</span>
            <span className="step-label">{st.label}</span>
            {idx < steps.length - 1 && <span className="step-sep">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ section, isStudent }) {
  let message = "Belum ada pengajuan yang sesuai dengan filter ini.";
  if (section === "pending") {
    message = "Tidak ada pengajuan yang sedang menunggu persetujuan.";
  } else if (section === "submissions") {
    message = "Belum ada tugas yang menunggu validasi.";
  } else if (isStudent) {
    message = "Belum ada pengajuan demo yang terdaftar. Gunakan tombol \"Ajukan Demo Baru\" di sudut kanan atas untuk mulai membuat pengajuan.";
  }

  return (
    <div className="empty-state">
      <h3>Belum ada data</h3>
      <p>{message}</p>
    </div>
  );
}

function DemoTable({ demos, onOpen, isStudent }) {
  if (!demos.length) return <EmptyState isStudent={isStudent} />;
  return (
    <div className="table-scroller">
      <table className="data-table">
        <thead>
          <tr>
            <th>APLIKASI / MAHASISWA</th>
            <th>DOSEN PEMBIMBING</th>
            <th>JADWAL & LOKASI</th>
            <th>STATUS</th>
            <th>AKSI</th>
          </tr>
        </thead>
        <tbody>
          {demos.map((d) => (
            <tr
              key={d.id}
              onClick={() => onOpen(d.id)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onOpen(d.id);
              }}
            >
              <td>
                <div className="name-cell">
                  <div>
                    <strong>{d.title}</strong>
                    <span>{d.studentName} · #{String(d.id).padStart(4, "0")}</span>
                  </div>
                </div>
              </td>
              <td>{d.lecturerName}</td>
              <td>
                <div className="two-line">
                  <strong>{d.scheduledAt ? formatDate(d.scheduledAt) : "Menunggu jadwal PIC"}</strong>
                  <span><MapPin size={12} />{d.location || "Lokasi belum ditetapkan"}</span>
                </div>
              </td>
              <td><StatusBadge value={d.status} /></td>
              <td>
                <button
                  className="table-open"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(d.id);
                  }}
                >
                  Detail <ChevronRight size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getLocalDateTime(value) {
  const when = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const components = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(when);
  const part = (name) => components.find((p) => p.type === name)?.value || "00";
  return `${part("year")}-${part("month")}-${part("day")}T${value ? part("hour") : "10"}:${value ? part("minute") : "00"}`;
}

function wibToIso(value) {
  return new Date(`${value}:00+07:00`).toISOString();
}

function DemoForm({ initial, lecturers, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    description: initial?.description || "",
    lecturerId: initial?.lecturerId || "",
    requiredDocuments: initial?.requiredDocuments || ""
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setField = (field, val) => setForm((old) => ({ ...old, [field]: val }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!initial && !file) throw new Error("Unggah minimal satu dokumen pendukung untuk pemeriksaan PIC.");
      const payload = { ...form, lecturerId: Number(form.lecturerId) };
      const result = initial
        ? await api(`/demos/${initial.id}`, { method: "PUT", body: payload })
        : await api("/demos", { method: "POST", body: payload });
      const demoId = initial?.id || result.id;
      let warning = null;
      if (file) {
        try {
          const data = new FormData();
          data.append("kind", "SUPPORTING");
          data.append("file", file);
          await api(`/demos/${demoId}/files`, { method: "POST", body: data });
        } catch (e) {
          warning = `Pengajuan tersimpan, tetapi unggah dokumen gagal: ${e.message}`;
        }
      }
      await onSaved(demoId, warning);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="form-modal" role="dialog" aria-modal="true" aria-label="Pengajuan demo">
        <div className="modal-header">
          <div>
            <span className="eyebrow">FORM PENGAJUAN</span>
            <h2>{initial ? "Perbaiki Pengajuan" : "Ajukan Demo Aplikasi"}</h2>
            <p>Lengkapi informasi dan dokumen aplikasi. Jadwal demo akan ditentukan PIC setelah dosen melakukan peninjauan.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="modal-body">
          <div className="form-section-title"><span>01</span> INFORMASI APLIKASI</div>
          <label>
            Judul Aplikasi <em>*</em>
            <input required maxLength={180} value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="Contoh: Sistem Informasi Perpustakaan" />
          </label>
          <label>
            Deskripsi Aplikasi
            <textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Tujuan dan fungsi utama aplikasi" />
          </label>
          <div className="form-section-title"><span>02</span> PEMBIMBING & PERSYARATAN</div>
          <label>
            Dosen Pembimbing <em>*</em>
            <select required value={form.lecturerId} onChange={(e) => setField("lecturerId", e.target.value)}>
              <option value="">Pilih dosen</option>
              {lecturers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
            </select>
          </label>
          <label>
            Persyaratan / Dokumen yang Dibawa <em>*</em>
            <textarea required maxLength={1500} rows={3} value={form.requiredDocuments} onChange={(e) => setField("requiredDocuments", e.target.value)} placeholder="Dokumen atau kelengkapan yang perlu disiapkan" />
          </label>
          <label>
            Dokumen Pendukung <span className="optional">{initial ? "(opsional jika sebelumnya sudah diunggah)" : "(wajib; PDF, DOCX, ZIP ≤10 MB)"}</span>
            <div className="file-select">
              <Upload size={17} />
              <span>{file?.name || "Pilih berkas pendukung"}</span>
              <input type="file" accept=".pdf,.docx,.zip" onChange={(e) => setFile(e.target.files?.[0] || null)} aria-label="Dokumen pendukung" />
            </div>
          </label>
          {error && <div className="alert error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn subtle" disabled={busy} onClick={onClose}>Batal</button>
            <button type="submit" disabled={busy} className="btn primary">
              <Send size={16} />{busy ? "Menyimpan..." : initial ? "Kirim Revisi" : "Kirim Pengajuan"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DetailPanel({ id, demo, role, lecturers, onClose, onUpdated, onEdit }) {
  const [history, setHistory] = useState([]);
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState("");
  const [score, setScore] = useState("");
  const [date, setDate] = useState(getLocalDateTime(demo?.scheduledAt));
  const [duration, setDuration] = useState(demo?.durationMinutes || 60);
  const [location, setLocation] = useState(demo?.location || "");
  const [newLecturer, setNewLecturer] = useState(demo?.lecturerId || "");
  const [file, setFile] = useState(null);
  const [supportFile, setSupportFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDate(getLocalDateTime(demo?.scheduledAt));
    setDuration(demo?.durationMinutes || 60);
    setLocation(demo?.location || "");
    setNewLecturer(demo?.lecturerId || "");
  }, [demo?.scheduledAt, demo?.durationMinutes, demo?.location, demo?.lecturerId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api(`/demos/${id}/history`), api(`/demos/${id}/files`)])
      .then(([h, f]) => {
        if (!cancelled) { setHistory(h); setFiles(f); }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => { cancelled = true; };
  }, [id, demo?.status]);

  const action = async (path, body, message) => {
    setBusy(true); setError("");
    try {
      await api(path, { method: "POST", body });
      await onUpdated(message);
      setNotes("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitFile = async (event) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError("");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("kind", "SUBMISSION");
      await api(`/demos/${id}/files`, { method: "POST", body: data });
      await onUpdated("Tugas akhir berhasil dikirim ke PIC.");
      setFile(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadSupporting = async (e) => {
    e.preventDefault();
    if (!supportFile) return;
    setBusy(true); setError("");
    try {
      const data = new FormData();
      data.append("kind", "SUPPORTING");
      data.append("file", supportFile);
      await api(`/demos/${id}/files`, { method: "POST", body: data });
      setSupportFile(null);
      await onUpdated("Dokumen pendukung berhasil diunggah.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!demo) return null;

  return (
    <div className="detail-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="detail-panel" role="dialog" aria-modal="true" aria-label="Detail demo aplikasi">
        <div className="detail-top">
          <button className="back-link" onClick={onClose}><ArrowLeft size={16} /> Kembali ke daftar</button>
          <button className="icon-button" onClick={onClose} aria-label="Tutup detail"><X size={18} /></button>
        </div>
        <div className="detail-head">
          <div>
            <span className="eyebrow">PENGAJUAN #{String(demo.id).padStart(4, "0")}</span>
            <h2>{demo.title}</h2>
            <StatusBadge value={demo.status} />
          </div>
        </div>
        <div className="detail-body">
          <div className="detail-section">
            <h3>Informasi Pengajuan</h3>
            <div className="info-grid">
              <div><span>Mahasiswa</span><strong>{demo.studentName}</strong></div>
              <div><span>Dosen Pembimbing</span><strong>{demo.lecturerName}</strong></div>
              <div><span>Waktu Pelaksanaan</span><strong>{demo.scheduledAt ? formatDate(demo.scheduledAt) : "Belum ditetapkan PIC"}</strong></div>
              <div><span>Durasi</span><strong>{demo.durationMinutes ? `${demo.durationMinutes} menit` : "—"}</strong></div>
              <div><span>Lokasi / Ruangan</span><strong>{demo.location || "Belum ditetapkan"}</strong></div>
              <div><span>Diajukan Pada</span><strong>{formatDate(demo.createdAt)}</strong></div>
            </div>
          </div>
          {demo.description && (
            <div className="detail-section">
              <h3>Deskripsi Aplikasi</h3>
              <p className="description-text">{demo.description}</p>
            </div>
          )}
          <div className="detail-section">
            <h3>Dokumen yang Harus Dibawa</h3>
            <div className="soft-box">
              <FileText size={18} />
              <p>{demo.requiredDocuments}</p>
            </div>
          </div>
          {(demo.reviewNotes || demo.lecturerReviewNotes || demo.lecturerNotes || demo.submissionNotes) && (
            <div className="detail-section">
              <h3>Catatan Proses</h3>
              {demo.reviewNotes && <div className="notice"><strong>Catatan PIC (Pengajuan)</strong><p>{demo.reviewNotes}</p></div>}
              {demo.lecturerReviewNotes && <div className="notice"><strong>Catatan Peninjauan Dosen</strong><p>{demo.lecturerReviewNotes}</p></div>}
              {demo.lecturerNotes && <div className="notice"><strong>Evaluasi Dosen {demo.lecturerScore != null ? `• Nilai ${demo.lecturerScore}/100` : ""}</strong><p>{demo.lecturerNotes}</p></div>}
              {demo.submissionNotes && <div className="notice"><strong>Catatan PIC (Tugas Akhir)</strong><p>{demo.submissionNotes}</p></div>}
            </div>
          )}
          <div className="detail-section">
            <h3>Berkas Terunggah <span className="light-counter">{files.length}</span></h3>
            {files.length ? (
              files.map((f) => (
                <button className="file-row" key={f.id} onClick={() => downloadFile(f).catch((e) => setError(e.message))}>
                  <span className="file-mini"><FileText size={16} /></span>
                  <span className="file-description">
                    <strong>{f.originalName}</strong>
                    <small>{f.fileKind === "SUBMISSION" ? "Tugas akhir" : "Dokumen pendukung"} • {(f.fileSize / 1024 / 1024).toFixed(2)} MB</small>
                  </span>
                  <ArrowDownToLine size={16} />
                </button>
              ))
            ) : (
              <p className="muted small">Belum ada dokumen terunggah.</p>
            )}
          </div>
          {role === "MAHASISWA" && ["PENDING_PIC", "REVISION_PIC", "REVISION_DOSEN"].includes(demo.status) && (
            <form className="action-card" onSubmit={uploadSupporting}>
              <h3><Upload size={17} /> Tambahkan Dokumen Pendukung</h3>
              <p>Unggah berkas tambahan (PDF, DOCX, atau ZIP maksimal 10 MB) jika diminta PIC atau dosen.</p>
              <div className="file-select">
                <Upload size={16} />
                <span>{supportFile?.name || "Pilih dokumen pendukung"}</span>
                <input type="file" accept=".pdf,.docx,.zip" onChange={(e) => setSupportFile(e.target.files?.[0] || null)} aria-label="Tambahan dokumen pendukung" />
              </div>
              <button className="btn primary" disabled={busy || !supportFile}><Upload size={16} /> Unggah Dokumen</button>
            </form>
          )}
          {role === "MAHASISWA" && ["REVISION_PIC", "REVISION_DOSEN"].includes(demo.status) && (
            <div className="action-card">
              <h3><CircleAlert size={17} /> Perbaikan Pengajuan Diperlukan</h3>
              <p>Silakan baca catatan di atas, kemudian perbaiki isian pengajuan Anda.</p>
              <button className="btn primary" onClick={() => onEdit(demo)}><FileText size={16} /> Perbaiki Pengajuan</button>
            </div>
          )}
          {role === "MAHASISWA" && ["DEMO_DONE", "SUBMISSION_REVISION"].includes(demo.status) && (
            <form onSubmit={submitFile} className="action-card">
              <h3><Upload size={17} /> {demo.status === "SUBMISSION_REVISION" ? "Kirim Revisi Tugas Akhir" : "Kumpulkan Tugas Akhir Aplikasi"}</h3>
              <p>Unggah berkas hasil akhir aplikasi (ZIP, PDF, atau DOCX; maksimal 30 MB) untuk divalidasi PIC.</p>
              <div className="file-select">
                <Upload size={16} />
                <span>{file?.name || "Pilih berkas tugas akhir"}</span>
                <input aria-label="Berkas tugas akhir" type="file" required accept=".zip,.pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <button disabled={busy || !file} className="btn primary"><Send size={16} /> Kirim Tugas ke PIC</button>
            </form>
          )}
          {role === "PIC" && demo.status === "PENDING_PIC" && (
            <div className="action-card">
              <h3><ShieldCheck size={17} /> Pemeriksaan Kelengkapan PIC</h3>
              <p>Periksa kelengkapan berkas sebelum meneruskan ke dosen pembimbing.</p>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Catatan pemeriksaan PIC" placeholder="Catatan atau masukan revisi" rows={3} />
              <div className="action-buttons">
                <button disabled={busy} className="btn success" onClick={() => action(`/demos/${id}/review`, { decision: "APPROVE", notes }, "Pengajuan diteruskan ke dosen.")}><Check size={16} /> Teruskan ke Dosen</button>
                <button disabled={busy || !notes.trim()} className="btn warning" onClick={() => action(`/demos/${id}/review`, { decision: "REVISE", notes }, "Permintaan revisi dikirim.")}>Minta Revisi</button>
                <button disabled={busy || !notes.trim()} className="btn outline-danger" onClick={() => action(`/demos/${id}/review`, { decision: "REJECT", notes }, "Pengajuan ditolak.")}>Tolak</button>
              </div>
            </div>
          )}
          {role === "DOSEN" && demo.status === "PENDING_DOSEN" && (
            <div className="action-card">
              <h3><ClipboardCheck size={17} /> Peninjauan Dosen</h3>
              <p>Tinjau pengajuan mahasiswa. Setujui agar PIC dapat menjadwalkan demo.</p>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Catatan peninjauan dosen" rows={3} placeholder="Catatan persetujuan atau perbaikan" />
              <div className="action-buttons">
                <button className="btn success" disabled={busy} onClick={() => action(`/demos/${id}/lecturer-review`, { decision: "APPROVE", notes }, "Pengajuan siap dijadwalkan PIC.")}><Check size={16} /> Setujui Pengajuan</button>
                <button className="btn warning" disabled={busy || !notes.trim()} onClick={() => action(`/demos/${id}/lecturer-review`, { decision: "REVISE", notes }, "Permintaan revisi dikirim.")}>Minta Revisi</button>
              </div>
            </div>
          )}
          {role === "PIC" && ["READY_TO_SCHEDULE", "SCHEDULED"].includes(demo.status) && (
            <form className="action-card" onSubmit={(e) => { e.preventDefault(); action(`/demos/${id}/schedule`, { scheduledAt: wibToIso(date), durationMinutes: Number(duration), location }, "Jadwal berhasil disimpan."); }}>
              <h3><CalendarClock size={17} /> {demo.status === "SCHEDULED" ? "Ubah Jadwal Demo" : "Tetapkan Jadwal Demo"}</h3>
              <div className="form-grid">
                <label>Tanggal & Jam (WIB)<input required type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                <label>Durasi<select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[30, 45, 60, 90, 120, 180, 240].map((n) => <option key={n} value={n}>{n} menit</option>)}</select></label>
              </div>
              <label>Lokasi / Ruang<input required maxLength={150} value={location} placeholder="Contoh: Lab Komputer 2" onChange={(e) => setLocation(e.target.value)} /></label>
              <button type="submit" className="btn primary" disabled={busy}><CalendarCheck2 size={16} /> Simpan Jadwal</button>
            </form>
          )}
          {role === "DOSEN" && demo.status === "SCHEDULED" && (
            <div className="action-card">
              <h3><ClipboardCheck size={17} /> Evaluasi Pelaksanaan Demo</h3>
              <label>Nilai (0–100)<input type="number" min={0} max={100} required value={score} onChange={(e) => setScore(e.target.value)} /></label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Evaluasi demo" placeholder="Catatan evaluasi demo" rows={3} />
              <button className="btn primary" disabled={busy || score === "" || !notes.trim()} onClick={() => action(`/demos/${id}/complete-demo`, { score: Number(score), notes }, "Nilai dan evaluasi tersimpan.")}><CheckCheck size={16} /> Simpan Nilai</button>
            </div>
          )}
          {role === "PIC" && demo.status === "SUBMITTED" && (
            <div className="action-card">
              <h3><FileCheck2 size={17} /> Verifikasi Tugas Akhir</h3>
              <textarea aria-label="Catatan validasi tugas" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan verifikasi tugas" rows={3} />
              <div className="action-buttons">
                <button className="btn success" disabled={busy} onClick={() => action(`/demos/${id}/submission-review`, { decision: "APPROVE", notes }, "Tugas disetujui.")}><CheckCheck size={16} /> Setujui Tugas</button>
                <button className="btn warning" disabled={busy || !notes.trim()} onClick={() => action(`/demos/${id}/submission-review`, { decision: "REVISE", notes }, "Minta revisi tugas.")}>Minta Revisi</button>
              </div>
            </div>
          )}
          {demo.status === "COMPLETED" && (
            <div className="completed-callout">
              <CircleCheck size={20} />
              <div>
                <strong>Proses Demo Selesai</strong>
                <span>Pengajuan, peninjauan, demo, dan repository telah selesai divalidasi.</span>
              </div>
            </div>
          )}
          <div className="detail-section">
            <h3>Riwayat Aktivitas</h3>
            <div className="timeline">
              {history.length ? (
                history.map((h) => (
                  <div key={h.id} className="timeline-item">
                    <span className="timeline-bullet" />
                    <div>
                      <strong>{(h.actionName || "").replaceAll("_", " ")}</strong>
                      <small>{h.actorName} • {formatDate(h.createdAt)}</small>
                      {h.notes && <p>{h.notes}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted small">Belum ada riwayat aktivitas.</p>
              )}
            </div>
          </div>
          {error && <div className="alert error">{error}</div>}
        </div>
      </aside>
    </div>
  );
}

function NotificationsPanel({ items, onRead, onOpen }) {
  return (
    <section className="table-panel">
      <div className="table-panel-head">
        <div>
          <h2>Notifikasi</h2>
          <p>Pemberitahuan perubahan status, jadwal, dan penilaian</p>
        </div>
      </div>
      <div className="notification-list">
        {items.length ? (
          items.map((n) => (
            <button
              key={n.id}
              className={`notification-item ${!n.isRead ? "notification-unread" : ""}`}
              onClick={() => {
                onRead(n.id);
                onOpen(n.demoId);
              }}
            >
              <span className="notification-ico"><Bell size={16} /></span>
              <span>
                <strong>{n.title}</strong>
                <small>{n.message}</small>
                <small>{formatDate(n.createdAt)}</small>
              </span>
              {!n.isRead && <span className="unread-dot" />}
            </button>
          ))
        ) : (
          <div className="empty-state">
            <p>Belum ada notifikasi.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function UsersPanel({ users, onSaved }) {
  const [form, setForm] = useState({ username: "", fullName: "", password: "", roleName: "MAHASISWA", email: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: "", email: "", newPassword: "" });
  const change = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/users", { method: "POST", body: form });
      setForm({ username: "", fullName: "", password: "", roleName: "MAHASISWA", email: "" });
      await onSaved("Pengguna baru berhasil ditambahkan.");
    } catch (ex) {
      setError(ex.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(u) {
    try {
      await api(`/users/${u.id}`, { method: "PATCH", body: { fullName: u.fullName, email: u.email || "", isActive: !u.isActive } });
      await onSaved("Status akun berhasil diubah.");
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const target = users.find((u) => u.id === editing);
      await api(`/users/${editing}`, {
        method: "PATCH",
        body: { fullName: editForm.fullName, email: editForm.email, isActive: target?.isActive ?? true, newPassword: editForm.newPassword || null }
      });
      setEditing(null);
      await onSaved("Data akun diperbarui.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack-panels">
      <section className="table-panel">
        <div className="table-panel-head">
          <div>
            <h2>Tambah Pengguna</h2>
            <p>Kelola akun mahasiswa, dosen pembimbing, dan PIC</p>
          </div>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <div className="form-grid">
            <label>Username<input required maxLength={80} value={form.username} onChange={(e) => change("username", e.target.value)} /></label>
            <label>Nama Lengkap<input required maxLength={150} value={form.fullName} onChange={(e) => change("fullName", e.target.value)} /></label>
          </div>
          <div className="form-grid">
            <label>
              Role
              <select value={form.roleName} onChange={(e) => change("roleName", e.target.value)}>
                <option value="MAHASISWA">Mahasiswa</option>
                <option value="DOSEN">Dosen</option>
                <option value="PIC">PIC PKTA</option>
              </select>
            </label>
            <label>Password Awal<input required minLength={8} type="password" value={form.password} onChange={(e) => change("password", e.target.value)} /></label>
          </div>
          <label>Email (opsional)<input type="email" value={form.email} onChange={(e) => change("email", e.target.value)} /></label>
          {error && <div className="alert error">{error}</div>}
          <div><button className="btn primary" disabled={saving}><Plus size={16} /> Tambah Akun</button></div>
        </form>
      </section>

      {editing != null && (
        <section className="table-panel">
          <div className="table-panel-head">
            <div><h2>Ubah Data Pengguna</h2><p>Perbarui profil akun pengguna</p></div>
            <button className="btn subtle" onClick={() => setEditing(null)}>Batal</button>
          </div>
          <form className="modal-body" onSubmit={saveEdit}>
            <div className="form-grid">
              <label>Nama Lengkap<input required maxLength={150} value={editForm.fullName} onChange={(e) => setEditForm((x) => ({ ...x, fullName: e.target.value }))} /></label>
              <label>Email<input type="email" value={editForm.email} onChange={(e) => setEditForm((x) => ({ ...x, email: e.target.value }))} /></label>
            </div>
            <label>Password Baru <span className="optional">(kosongkan jika tidak diubah)</span><input minLength={8} type="password" value={editForm.newPassword} onChange={(e) => setEditForm((x) => ({ ...x, newPassword: e.target.value }))} /></label>
            {error && <div className="alert error">{error}</div>}
            <button className="btn primary" disabled={saving}>Simpan Perubahan</button>
          </form>
        </section>
      )}

      <section className="table-panel">
        <div className="table-panel-head"><h2>Daftar Pengguna ({users.length})</h2></div>
        <div className="table-scroller">
          <table className="data-table">
            <thead>
              <tr>
                <th>NAMA</th>
                <th>USERNAME</th>
                <th>ROLE</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.fullName}</strong></td>
                  <td>{u.username}</td>
                  <td>{displayName[u.role]}</td>
                  <td>{u.isActive ? "Aktif" : "Nonaktif"}</td>
                  <td>
                    <div className="inline-actions">
                      <button className="table-open" onClick={() => { setEditing(u.id); setEditForm({ fullName: u.fullName, email: u.email || "", newPassword: "" }); }}>Edit</button>
                      <button className="table-open" onClick={() => toggle(u)}>{u.isActive ? "Nonaktifkan" : "Aktifkan"}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MappingPanel({ demos, lecturers, onOpen }) {
  const [lecturer, setLecturer] = useState("");
  const visible = lecturer ? demos.filter((d) => String(d.lecturerId) === lecturer) : demos;
  const grouped = lecturers.map((l) => ({ name: l.fullName, count: visible.filter((d) => d.lecturerId === l.id).length })).filter((x) => x.count > 0);

  return (
    <div className="stack-panels">
      <section className="table-panel">
        <div className="table-panel-head">
          <div><h2>Mapping Mahasiswa per Dosen</h2><p>Pengelompokan pengajuan berdasarkan dosen pembimbing</p></div>
          <select className="filter-select" value={lecturer} onChange={(e) => setLecturer(e.target.value)}>
            <option value="">Semua dosen</option>
            {lecturers.map((l) => <option key={l.id} value={l.id}>{l.fullName}</option>)}
          </select>
        </div>
        <div className="mapping-cards">
          {grouped.map((g) => (
            <div className="mapping-card" key={g.name}>
              <strong>{g.count}</strong>
              <span>{g.name}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="table-panel">
        <div className="table-panel-head"><h2>Daftar Pengajuan</h2></div>
        <DemoTable demos={visible} onOpen={onOpen} isStudent={false} />
      </section>
    </div>
  );
}

function ReportsPanel({ demos, onOpen }) {
  const statuses = Object.entries(STATUS).map(([code, value]) => ({ code, label: value[0], count: demos.filter((d) => d.status === code).length })).filter((x) => x.count > 0);

  function csv() {
    const headers = ["ID", "Judul", "Mahasiswa", "Dosen", "Status", "Jadwal", "Tempat", "Nilai"];
    const rows = demos.map((d) => [
      d.id, d.title, d.studentName, d.lecturerName,
      STATUS[d.status]?.[0] || d.status,
      d.scheduledAt ? formatDate(d.scheduledAt) : "",
      d.location || "", d.lecturerScore ?? ""
    ]);
    const esc = (v) => {
      const raw = String(v ?? "");
      const safe = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const content = "\uFEFF" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "laporan-demo-aplikasi.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="stack-panels">
      <section className="table-panel">
        <div className="table-panel-head">
          <div><h2>Rekapitulasi Pengajuan</h2><p>Jumlah pengajuan berdasarkan tahapan proses</p></div>
          <button className="btn primary" onClick={csv}><ArrowDownToLine size={16} /> Ekspor CSV</button>
        </div>
        <div className="mapping-cards">
          {statuses.map((x) => (
            <div key={x.code} className="mapping-card">
              <strong>{x.count}</strong>
              <span>{x.label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="table-panel">
        <div className="table-panel-head"><h2>Data Pengajuan & Evaluasi</h2></div>
        <DemoTable demos={demos} onOpen={onOpen} isStudent={false} />
      </section>
    </div>
  );
}

function PeriodSettings({ period, onSaved }) {
  const [open, setOpen] = useState(period?.isOpen ?? true);
  const [requirements, setRequirements] = useState(period?.requirementsText || "");
  const [start, setStart] = useState(getLocalDateTime(period?.startAt));
  const [end, setEnd] = useState(getLocalDateTime(period?.endAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (period) {
      setOpen(period.isOpen);
      setStart(getLocalDateTime(period.startAt));
      setEnd(getLocalDateTime(period.endAt));
      setRequirements(period.requirementsText || "");
    }
  }, [period]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await api("/period", {
        method: "PUT",
        body: { isOpen: open, startAt: wibToIso(start), endAt: wibToIso(end), requirementsText: requirements }
      });
      await onSaved(result.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="period-card">
      <div className="period-heading">
        <div className="period-icon"><CalendarClock size={22} /></div>
        <div>
          <h2>Pengaturan Periode Pengajuan</h2>
          <p>Tentukan jadwal periode aktif dan persyaratan dokumen pengajuan</p>
        </div>
      </div>
      <form onSubmit={save} className="period-form">
        <label className="switch-row">
          <span>
            <strong>Terima Pengajuan Baru</strong>
            <small>Aktifkan untuk membuka pengajuan demo aplikasi bagi mahasiswa.</small>
          </span>
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
        </label>
        <div className="form-grid">
          <label>Tanggal & Jam Mulai (WIB)<input required type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label>Tanggal & Jam Berakhir (WIB)<input required type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <label>
          Persyaratan Dokumen Pengajuan
          <textarea maxLength={1500} rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Tuliskan daftar dokumen yang harus disiapkan mahasiswa" />
        </label>
        {error && <div className="alert error">{error}</div>}
        <div><button className="btn primary" disabled={busy}><Check size={16} />{busy ? "Menyimpan..." : "Simpan Periode"}</button></div>
      </form>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [demos, setDemos] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [period, setPeriod] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [section, setSection] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [formItem, setFormItem] = useState(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alert, setAlert] = useState(null);

  const reload = useCallback(async () => {
    const items = await api("/demos");
    setDemos(items);
    setNotifications(await api("/notifications"));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await api("/auth/me");
        setUser(me);
        const [all, teachers, currentPeriod] = await Promise.all([
          api("/demos"),
          api("/users/lecturers"),
          api("/period")
        ]);
        setDemos(all);
        setLecturers(teachers);
        setPeriod(currentPeriod);
        setNotifications(await api("/notifications"));
        if (me.role === "PIC") setUsers(await api("/users"));
      } catch (e) {
        if (e.status === 401) router.replace("/login");
        else setAlert({ message: e.message, danger: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (alert) {
      const t = window.setTimeout(() => setAlert(null), 5000);
      return () => window.clearTimeout(t);
    }
  }, [alert]);

  const onUpdated = useCallback(async (message) => {
    await reload();
    setAlert({ message, danger: false });
  }, [reload]);

  const selected = demos.find((d) => d.id === selectedId);

  const onRead = async (id) => {
    try {
      await api(`/notifications/${id}/read`, { method: "POST" });
      setNotifications((old) => old.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
    } catch (e) {
      setAlert({ message: e.message, danger: true });
    }
  };

  const onUsersSaved = async (message) => {
    setUsers(await api("/users"));
    setLecturers(await api("/users/lecturers"));
    setAlert({ message, danger: false });
  };

  const stats = useMemo(() => {
    const active = demos.filter((d) => !["COMPLETED", "REJECTED", "CANCELLED"].includes(d.status)).length;
    const awaiting = user?.role === "PIC"
      ? demos.filter((d) => ["PENDING_PIC", "READY_TO_SCHEDULE", "SUBMITTED"].includes(d.status)).length
      : user?.role === "DOSEN"
      ? demos.filter((d) => ["PENDING_DOSEN", "SCHEDULED"].includes(d.status)).length
      : demos.filter((d) => ["PENDING_PIC", "PENDING_DOSEN", "READY_TO_SCHEDULE", "SUBMITTED"].includes(d.status)).length;
    const completed = demos.filter((d) => d.status === "COMPLETED").length;
    return { all: demos.length, active, awaiting, completed };
  }, [demos, user]);

  const filtered = useMemo(() => {
    const searchText = search.toLowerCase().trim();
    return demos.filter((d) => {
      if (section === "pending" && d.status !== "PENDING_PIC") return false;
      if (section === "submissions" && d.status !== "SUBMITTED") return false;
      if (section === "ready" && !["READY_TO_SCHEDULE", "SCHEDULED"].includes(d.status)) return false;
      if (section === "review" && d.status !== "PENDING_DOSEN") return false;
      if (section === "schedule" && d.status !== "SCHEDULED") return false;
      if (section === "history" && !["COMPLETED", "REJECTED", "DEMO_DONE", "SUBMITTED", "SUBMISSION_REVISION", "REVISION_PIC", "REVISION_DOSEN"].includes(d.status)) return false;
      if (!searchText) return true;
      return [d.title, d.studentName, d.lecturerName, d.location, d.status].some((v) => String(v).toLowerCase().includes(searchText));
    });
  }, [demos, section, search]);

  const sectionTitle = {
    dashboard: "Dashboard",
    mine: "Pengajuan Demo Saya",
    pending: "Pemeriksaan Dokumen PIC",
    review: "Peninjauan Dosen",
    ready: "Penjadwalan Demo",
    submissions: "Verifikasi Repository",
    all: "Semua Pengajuan",
    history: "Riwayat & Evaluasi",
    schedule: "Jadwal Demo",
    period: "Periode Pengajuan",
    mapping: "Mapping Dosen",
    users: "Kelola Pengguna",
    reports: "Laporan & Rekapitulasi",
    notifications: "Notifikasi"
  }[section] || "Daftar Demo";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Memuat sistem SPDA...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="loading-screen">
        <CircleAlert />
        <p>{alert?.message || "Mengalihkan ke halaman masuk..."}</p>
        <button className="btn primary" onClick={() => router.push("/login")}>Ke halaman login</button>
      </div>
    );
  }

  const isStudent = user.role === "MAHASISWA";
  const hasData = stats.all > 0;

  return (
    <div className="app-shell">
      <Sidebar user={user} active={section} onSelect={setSection} onLogout={logout} open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-toggle" onClick={() => setSidebarOpen(true)} aria-label="Buka menu">
              <Menu size={22} />
            </button>
            <div className="breadcrumbs">
              <span>SPDA</span>
              <ChevronRight size={14} />
              <strong>{section === "dashboard" ? "Dashboard" : sectionTitle}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <div className="role-pill">
              <ShieldCheck size={14} />
              {displayName[user.role]}
            </div>
            <span className="top-separator" />
            <div className="profile-avatar">
              {user.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="profile-name">
              <strong>{user.fullName}</strong>
              <small>{displayName[user.role]}</small>
            </div>
            <ChevronDown size={14} color="#94a3b8" />
          </div>
        </header>

        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">DASHBOARD / {displayName[user.role].toUpperCase()}</div>
              <h1>
                {section === "dashboard" ? `Halo, ${getGreetingName(user)}` : sectionTitle}
              </h1>
              <p>
                {section === "dashboard"
                  ? "Sistem Penjadwalan Demo Aplikasi Tugas Akhir. Pantau progres pengajuan Anda di sini."
                  : "Kelola proses demo aplikasi secara terstruktur."}
              </p>
            </div>
            {isStudent && (
              <button
                className="btn primary"
                disabled={!period?.isOpen || new Date(period?.startAt) > new Date() || new Date(period?.endAt) < new Date()}
                onClick={() => {
                  setFormItem(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus size={17} /> Ajukan Demo Baru
              </button>
            )}
          </div>

          {isStudent && period?.requirementsText && (
            <div className="requirements-banner">
              <FileText size={17} />
              <div>
                <strong>Persyaratan PIC PKTA</strong>
                <p>{period.requirementsText}</p>
              </div>
            </div>
          )}

          {section === "dashboard" && (
            <>
              {/* Kartu Statistik atau Blok Onboarding */}
              {!hasData && isStudent ? (
                <OnboardingCard />
              ) : (
                <div className="stats-grid">
                  <StatCard
                    label="Total Pengajuan"
                    count={stats.all}
                    statusType="neutral"
                    caption="Seluruh pengajuan terdaftar"
                  />
                  <StatCard
                    label="Sedang Berjalan"
                    count={stats.active}
                    statusType="info"
                    caption="Dalam proses peninjauan atau jadwal"
                  />
                  <StatCard
                    label={user.role === "DOSEN" ? "Menunggu Demo" : user.role === "PIC" ? "Perlu Persetujuan" : "Menunggu Verifikasi"}
                    count={stats.awaiting}
                    statusType="waiting"
                    caption="Memerlukan tindak lanjut"
                  />
                  <StatCard
                    label="Selesai"
                    count={stats.completed}
                    statusType="success"
                    caption="Telah diverifikasi dan diarsipkan"
                  />
                </div>
              )}

              {/* Stepper Horizontal Alur Pengajuan */}
              {isStudent && (
                <ProcessStepper
                  onDetailClick={() => setSection("mine")}
                />
              )}
            </>
          )}

          {section === "period" && user.role === "PIC" ? (
            <PeriodSettings
              period={period}
              onSaved={async (message) => {
                setPeriod(await api("/period"));
                setAlert({ message, danger: false });
              }}
            />
          ) : section === "notifications" ? (
            <NotificationsPanel items={notifications} onRead={onRead} onOpen={setSelectedId} />
          ) : section === "users" && user.role === "PIC" ? (
            <UsersPanel users={users} onSaved={onUsersSaved} />
          ) : section === "mapping" && user.role === "PIC" ? (
            <MappingPanel demos={demos} lecturers={lecturers} onOpen={setSelectedId} />
          ) : section === "reports" && user.role === "PIC" ? (
            <ReportsPanel demos={demos} onOpen={setSelectedId} />
          ) : (
            <section className="table-panel">
              <div className="table-panel-head">
                <div>
                  <h2>{section === "dashboard" ? "Aktivitas Demo Terbaru" : sectionTitle}</h2>
                  <p>
                    {section === "dashboard"
                      ? "Daftar pengajuan dan perkembangan tahapan terkini"
                      : `${filtered.length} pengajuan ditemukan`}
                  </p>
                </div>
                <div className="table-tools">
                  <div className="search-box">
                    <Search size={15} />
                    <input
                      type="search"
                      placeholder="Cari judul aplikasi atau dosen..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Cari pengajuan"
                    />
                  </div>
                  <div className="count-chip">
                    <ListFilter size={14} />
                    {filtered.length} Data
                  </div>
                </div>
              </div>
              <DemoTable
                demos={section === "dashboard" ? filtered.slice(0, 8) : filtered}
                onOpen={setSelectedId}
                isStudent={isStudent}
              />
              {section === "dashboard" && filtered.length > 8 && (
                <div className="table-footer">
                  <button
                    className="view-all"
                    onClick={() => setSection(user.role === "PIC" ? "all" : user.role === "DOSEN" ? "schedule" : "mine")}
                  >
                    Lihat Semua <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </section>
          )}

          <div className="content-footer">
            <span>SPDA — Sistem Penjadwalan Demo Aplikasi</span>
            <span>Simulasi UAT & Ujian Akhir Semester</span>
          </div>
        </main>
      </div>

      {selectedId != null && selected && (
        <DetailPanel
          key={selectedId}
          id={selectedId}
          demo={selected}
          role={user.role}
          lecturers={lecturers}
          onClose={() => setSelectedId(null)}
          onUpdated={onUpdated}
          onEdit={(item) => {
            setSelectedId(null);
            setFormItem(item);
            setFormOpen(true);
          }}
        />
      )}

      {formOpen && (
        <DemoForm
          initial={formItem}
          lecturers={lecturers}
          onClose={() => setFormOpen(false)}
          onSaved={async (id, warning) => {
            await reload();
            setFormOpen(false);
            setSelectedId(id);
            setAlert({
              message: warning || (formItem ? "Revisi pengajuan berhasil dikirim ke PIC." : "Pengajuan demo berhasil dikirim ke PIC."),
              danger: !!warning
            });
          }}
        />
      )}

      {alert && (
        <div className={`toast-message ${alert.danger ? "toast-danger" : ""}`}>
          <span>{alert.danger ? <CircleAlert size={18} /> : <CircleCheck size={18} />}</span>
          {alert.message}
          <button aria-label="Tutup notifikasi" onClick={() => setAlert(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
