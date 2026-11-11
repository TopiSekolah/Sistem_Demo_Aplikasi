export async function api(path, options = {}) {
  const hasForm = options.body instanceof FormData;
  const response = await fetch(`/api/backend${path}`, {
    ...options, cache: "no-store",
    headers: hasForm ? (options.headers || {}) : {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    body: hasForm ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}
export async function downloadFile(file) {
  const response = await fetch(`/api/backend/files/${file.id}/download`, { cache: "no-store" });
  if (!response.ok) throw new Error("Gagal mengunduh dokumen.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.originalName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const formatDate = (value) => value ? new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false
}).format(new Date(value)) + " WIB" : "—";
export const STATUS = {
  PENDING_PIC:["Pemeriksaan PIC","waiting"],
  REVISION_PIC:["Revisi dari PIC","danger"],
  PENDING_DOSEN:["Peninjauan Dosen","waiting"],
  REVISION_DOSEN:["Revisi dari Dosen","danger"],
  READY_TO_SCHEDULE:["Siap Dijadwalkan","info"],
  SCHEDULED:["Demo Terjadwal","info"],
  DEMO_DONE:["Telah Dievaluasi","info"],
  SUBMITTED:["Menunggu Verifikasi PIC","waiting"],
  SUBMISSION_REVISION:["Revisi Repository","danger"],
  COMPLETED:["Selesai","success"],
  REJECTED:["Ditolak","danger"],
  CANCELLED:["Dibatalkan","muted"]
};
