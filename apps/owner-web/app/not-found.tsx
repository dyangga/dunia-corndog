import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="system-page">
      <span className="eyebrow">Dunia Corndog · 404</span>
      <h1>Halaman belum tersedia</h1>
      <p>Kembali ke ruang usaha untuk melanjutkan.</p>
      <Link className="btn btn-primary" href="/dashboard">
        Kembali ke ringkasan
      </Link>
    </main>
  );
}
