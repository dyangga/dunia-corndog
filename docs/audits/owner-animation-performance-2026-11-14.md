# Audit performa animasi owner Next.js — 14 November 2026

Lingkup: login, Ringkasan, Laporan keuangan (ringkasan/transaksi), Katalog menu, Stok & produksi (seluruh tab), Pengeluaran, Cabang, Tim & shift, Pengaturan, Notifikasi, serta sidebar/dialog/drawer/select/tooltip bersama. Versi kasir Expo tidak termasuk audit ini; rute web kasir yang dialihkan oleh OwnerShell tidak dianggap halaman operasional owner.

Metode: audit source aplikasi, CSS aktif, dan implementasi tooltip Recharts yang terpasang menggunakan kerangka `animation-performance`. Akses CUA mengembalikan `The browser access host is unavailable`; tidak ada recording Performance/paint/layer/GPU pada sesi ini. Tidak ada angka FPS atau long-task terukur. Semua biaya di bawah merupakan risiko struktural yang dibuktikan dari kode, bukan klaim bahwa dropped frame sudah terjadi. Tidak ada perubahan source aplikasi.

## Inventaris gerakan

| Elemen | Driver | Properti | Terjadi ketika |
| --- | --- | --- | --- |
| Sidebar desktop | CSS transition | transform, opacity, clip-path; visibility diskret | Toggle sidebar, 220 ms |
| Label/sidebar rail | CSS transition | transform/opacity; visibility diskret | Toggle sidebar |
| Konten utama | Pergantian style satu kali | width dan margin-left, tanpa transition | Sidebar berubah |
| Dialog dan overlay | CSS keyframes shadcn/Radix | transform/scale dan opacity; overlay opacity | Dialog masuk/keluar |
| Drawer mobile | CSS keyframes shadcn/Radix | transform | Drawer masuk/keluar |
| Select | CSS keyframes shadcn/Radix | transform/scale dan opacity | Opsi dibuka/ditutup |
| Tooltip biasa | CSS keyframes | transform dan opacity | Hover/fokus |
| Tooltip sidebar ringkas | Tidak dianimasikan | Tidak ada | Hover/fokus ikon |
| Tooltip chart | Recharts memperbarui isi/koordinat; CSS transition | transform untuk posisi | Pointer/keyboard/touch memilih hari |
| Kurva chart | Tidak dianimasikan | Path SVG diperbarui saat data/ukuran berubah | Refresh atau resize; maksimal tujuh titik |
| Tab bisnis | CSS transition eksplisit | background-color, color, border-color | Hover/pergantian tab |
| Tombol/baris/input | CSS transition primitive | Warna, transform, beberapa deklarasi shadow | Hover, fokus, perubahan state |
| Skeleton loading | CSS keyframes | Opacity | Loading route |
| Pergantian halaman owner | Conditional React render | Tidak ada crossfade/slide halaman | Menu dipilih |

Sumber: `hooks/use-sidebar-motion.ts`, `app/globals.css:2642–2758`, `components/ui/dialog.tsx:34–64`, `components/ui/sheet.tsx:57–70`, `components/ui/select.tsx:66`, `components/ui/tooltip.tsx:35`, `components/sales-trend.tsx:155–170`, `components/ui/skeleton.tsx:3`. Posisi tooltip Recharts memakai transition transform pada `node_modules/recharts/lib/component/TooltipBoundingBox.js`.

## Temuan berurutan menurut biaya potensial

### 1. Pertumbuhan DOM dan layout dari daftar yang belum dibatasi

Halaman paling terdampak: Pengeluaran dan Tim & shift; kemudian daftar stok/resep/mutasi serta tabel rincian produk/topping pada data besar.

Sumber: `components/app.tsx:2561` (`costs.map`), `components/app.tsx:2794` (`data.shifts.map`), `components/app.tsx:2375` (stok), `components/app.tsx:2478` (mutasi), `components/inventory-tools.tsx:347` (resep), `components/report-breakdowns.tsx:130` (rincian produk). `apps/api/src/queries.ts:129–139` mengambil seluruh histori shift dan pengeluaran dalam owner-state. Mutasi sudah dibatasi 500 posting oleh server; transaksi penjualan sudah dipaginasi 25 baris.

Penyebab: node DOM, rekonsiliasi React dan pengukuran layout bertambah mengikuti data. Mount/pergantian tab atau pembukaan dialog di halaman besar bisa memerlukan commit dan layout lebih lama.

Sebelum: seluruh histori shift/pengeluaran dikirim dalam polling owner-state dan daftar halaman dirender lewat map.

Usulan sesudah: endpoint/filter/pagination shift dan pengeluaran tersendiri; proyeksi owner-state hanya berisi data operasional yang diperlukan. Tambahkan pagination/virtualisasi tabel yang tumbuh besar. ScrollArea tetap menjadi wadah scroll, tetapi tidak dianggap virtualisasi.

Status: struktur terverifikasi dari kode; besarnya waktu layout dan dropped frame memerlukan recording dengan dataset besar.

### 2. Pencarian, dialog dan polling masih merender komponen utama bersama

Sumber: `components/app.tsx:273–335`, `components/app.tsx:403`, `components/app.tsx:2166–2184`, `components/owner-shell.tsx:146–161`, `hooks/use-owner-report.ts:26–46`.

Penyebab: state pencarian, dialog, sidebar, tab dan banyak pilihan form masih berada dalam satu App. Pencarian katalog/stok menjalankan render parent lagi; kartu katalog membuat ulang subtree ilustrasi SVG tanpa memo. Polling owner-state juga mengubah timestamp Connection; halaman laporan kemudian menjalankan pembaruan pending dan hasil overview.

Ini bukan setState setiap frame. Risikonya berupa kerja JS/commit saat interaksi dimulai atau ketika refresh bertemu animasi dialog/sidebar.

Sebelum: parent App membangun ulang sidebar, konten aktif dan dialog; pencarian langsung memfilter/render kartu pada setiap perubahan teks.

Usulan sesudah: pisahkan halaman dan dialog menjadi komponen dengan state lokal; memo kartu/konten yang stabil, stabilkan props/callback dan data chart. Untuk pencarian katalog/stok besar, gunakan deferred rendering hasil dan pagination. Hindari menambah memo secara menyeluruh tanpa mengecek profiler.

Status: batas state/render terverifikasi dari kode; durasi commit dan first-frame latency belum diukur.

### 3. Inventori mengaktifkan lima query sebelum panel alat dibuka

Sumber: `components/inventory-tools.tsx:28–49`, `components/inventory-tools.tsx:88`, `components/app.tsx:2266`.

Penyebab: query SKU, resep, inventori, katalog dan resep modifier aktif ketika InventoryTools mount; elemen details yang menampung alat masih tertutup secara default. Cache dapat mencegah request tertentu, tetapi query tidak digate oleh keadaan panel.

Sebelum: query aktif berdasarkan mount/branch meskipun alat belum dibuka.

Usulan sesudah: render konten alat setelah dibuka atau pakai enabled berdasarkan panel/target aktif; pertahankan reuse cache resep. Ini mengurangi request, parsing dan render yang bersamaan dengan masuk ke halaman.

Status: terverifikasi dari kode; request aktual bergantung isi cache dan perlu Network/Performance recording.

### 4. Modul chart dan seluruh halaman diimpor secara eager

Sumber: `components/owner-shell.tsx:15`, `components/app.tsx:86–93`, `app/[view]/page.tsx`.

Penyebab: semua view memakai OwnerShell/App yang sama; App mengimpor SalesTrend/Recharts, alat inventori dan komposisi laporan secara statis. Conditional JSX tidak membuat batas lazy loading. Chunk dapat dipisahkan bundler, tetapi import yang eager tetap merupakan dependensi entry tersebut.

Sebelum: dependensi chart tersedia dalam graph client bersama halaman lain, termasuk shell login.

Usulan sesudah: buat batas lazy untuk chart, rincian laporan dan alat inventori dengan placeholder berukuran tetap, atau pisahkan entry halaman. Ukur transfer dan waktu evaluasi sebelum memutuskan batas akhir.

Status: graph import terverifikasi; tidak mengklaim ukuran transfer aktual per halaman karena belum ada Network recording.

### 5. Clip-path sidebar perlu pemeriksaan layer pada perangkat target

Sumber: `app/globals.css:2643–2648`, `app/globals.css:2733–2757`.

Sidebar menganimasikan inset clip-path bersama transform dan opacity. Clip-path bisa diproses compositor, tetapi perlu diuji lintas browser/GPU. Tidak ada bukti saat ini bahwa mask tersebut menyebabkan repaint berat.

Usulan: rekam toggle berulang sambil melakukan refresh atau membuka halaman padat. Hanya bila trace memperlihatkan paint/layer mahal, bandingkan dengan transform/opacity dan clipping statis. Jangan mengubah lebar/margin konten menjadi animasi per frame dan jangan menambahkan will-change tanpa pengukuran; konten saat ini hanya berubah layout sekali.

Status: memerlukan recording; bukan bug performa yang sudah terbukti.

## Cakupan per halaman

| Halaman | Penilaian kode |
| --- | --- |
| Login | Tidak ada animasi berat sendiri; graph import bersama tetap perlu ditinjau |
| Ringkasan | Chart tujuh titik dan tanpa animasi kurva; render ulang saat polling/sidebar perlu diperiksa |
| Laporan ringkasan | Agregasi server sudah baik; tabel produk/modifier masih seluruh kelompok |
| Laporan transaksi | Pagination 25 baris dan debounce request pencarian sudah ada; bukan daftar semua order lagi |
| Katalog menu | Filter setiap perubahan pencarian; semua kartu/SVG hasil dirender |
| Stok & produksi | Lima query alat tertutup; tabel stok/resep/mutasi belum dipaginasi |
| Pengeluaran | Histori owner-state dan tabel bisa tumbuh tanpa batas |
| Cabang | Struktur kartu relatif sederhana; tidak ditemukan animasi layout per frame |
| Tim & shift | Tabel histori shift belum dibatasi; daftar staf juga memakai map |
| Pengaturan | Form relatif statis; tidak ditemukan pola animasi mahal khusus |
| Notifikasi | Daftar permintaan dibatasi server; tetap ikut render shell/polling dan daftar stok rendah |

## Pola yang sudah tepat

- Tidak ditemukan rAF/gesture/scroll handler aplikasi yang menjalankan setState tiap frame.
- Tidak ditemukan animasi width, height, padding atau margin setiap frame pada halaman aktif.
- Dialog, overlay dan drawer memakai transform/opacity; shadow dialog tetap statis.
- Tidak ditemukan animated blur. SVG corndog mempunyai drop shadow statis; potensi biaya paint ketika banyak kartu mount tidak disamakan dengan animasi blur.
- Kurva AreaChart menggunakan isAnimationActive=false; tooltip bekerja di internal chart, bukan state App per gerakan pointer.
- Reduced motion global mematikan transition/animation dan scroll-behavior halus.
- Primitive TabsTrigger masih menyimpan transition-all, tetapi pemakaian aktifnya lewat BusinessTabs ditimpa daftar transition eksplisit di globals.css:1347. Ini catatan pencegahan regresi pada primitive, bukan animasi all yang terbukti aktif di halaman.

## Recording yang masih diperlukan

Pada build produksi dan perangkat kelas menengah: toggle sidebar sambil polling, buka/tutup dialog pada daftar besar, cari katalog/stok sambil mengetik, buka tab stok/resep, gulir histori shift/pengeluaran, gunakan tooltip chart saat resize, serta drawer mobile. Catat long task, waktu commit, layout/paint, dropped frame, layer dan penggunaan memori. Anggaran teoritis 16,7 ms pada 60 Hz dan 8,3 ms pada 120 Hz bukan hasil pengukuran aplikasi.

## Status penerapan setelah audit

1. Histori pengeluaran/shift: endpoint cursor tersendiri, summary pengeluaran server, proyeksi owner-state dibatasi data operasional. Daftar operasional dan rincian agregat memakai pagination DOM.
2. Render bersama: katalog/inventori memiliki state lokal dan deferred search; field produk, koreksi dan penutupan shift terisolasi; memo dan structural sharing menstabilkan ilustrasi/chart/rincian yang tidak berubah. Perbaikan layout shift KPI tetap dipertahankan.
3. Alat inventori: lazy mount pada pembukaan pertama dan enabled berdasarkan panel/target; input dipertahankan saat panel ditutup.
4. Modul eager: App dipisahkan dari shell login; chart, inventori, histori dan rincian laporan mempunyai chunk dynamic terpisah pada manifest produksi.
5. Sidebar clip-path: belum diganti, karena rekomendasi audit adalah melakukan recording terlebih dahulu. Tidak ada bukti repaint/drop-frame yang membenarkan perubahan visual sidebar.

Validasi: 29 tes UI, 10 skenario integrasi API/PostgreSQL, TypeScript semua workspace, build produksi dan migrasi indeks 0003 lulus. Hasil ini tidak menyatakan FPS perangkat nyata; lihat docs/verification.md untuk batas pengukuran.
