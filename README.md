# Dunia Corndog

Satu monorepo untuk dashboard owner Next.js, aplikasi kasir Expo/React Native, dan API Express. PostgreSQL adalah sumber data bersama. Desain owner yang telah direview tetap digunakan; kasir native mengikuti koreksi menu terbaru.

```text
apps/
  owner-web/          Next.js + shadcn/ui (port 3000)
  cashier-mobile/     Expo Router + React Native + NativeWind (Metro 8081)
  api/                Express + autentikasi + layanan bisnis (port 4000)
packages/
  contracts/          Zod, DTO, tipe data dan API client
  db/                 PostgreSQL, Drizzle, migrasi SQL dan seed
  design-tokens/      Warna dan radius bersama
```

API dipisahkan ke Express mengikuti instruksi pengguna, menggantikan rekomendasi Route Handlers pada PRD. Database hanya diakses API serta skrip migrasi/seed/test. UI web dan native terpisah; tidak ada komponen shadcn DOM yang diimpor ke Expo. Kasir memakai Expo 58.0.25 dan React Native 0.88.1. React web/native diselaraskan ke 19.3.0 untuk mencegah duplikasi runtime. npm workspaces melanjutkan package manager proyek awal; tidak memerlukan pnpm.

## Setup lokal

Node 22.13+ pada jalur 22, Node 24.3+ pada jalur 24, atau Node 26+ dan Docker diperlukan. Gunakan terminal pada folder `dunia-corndog`.

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

`db:up` memakai Docker CLI langsung sehingga tetap bisa digunakan saat plugin Compose belum terpasang. Alternatifnya `docker compose up -d db`. Database hanya dipublikasikan ke loopback komputer. Migrasi memakai tabel versi dan lock; menjalankannya ulang aman. Seed tidak mereset data/kredensial bisnis yang sudah ada.

Buka dashboard: http://localhost:3000. Next.js meneruskan `/api/v1/*` ke Express melalui rewrite. API juga tersedia di http://localhost:4000/api/v1; health check di `/health`.

Akun lokal dari `.env.example` (khusus data contoh):

| Peran | Username | Password |
| --- | --- | --- |
| Owner | `owner` | `OwnerReview123!` |
| Kasir Dipatiukur | `nadia` | `KasirReview123!` |
| Kasir Antapani | `rizky` | `KasirReview123!` |

Ubah password seed pada `.env` **sebelum seed pertama** untuk menggunakan kredensial lain. Password disimpan sebagai Argon2id. Seed memuat dua cabang, katalog dan stok dengan biaya/resep **contoh**, tanpa penjualan fiktif. Review browser/native dapat menambahkan akun/transaksi berlabel review pada database lokal; pengujian integrasi memakai database lain.

## Menjalankan Expo

Salin `apps/cashier-mobile/.env.example` menjadi `.env.local` di folder yang sama. Isi `EXPO_PUBLIC_API_URL` dengan alamat LAN komputer, misalnya `http://192.168.1.10:4000/api/v1`. **localhost pada tablet menunjuk ke tablet itu sendiri.** Gunakan jaringan yang sama dan izinkan port API/Metro melalui firewall lokal.

```bash
npm run dev:mobile
# Preview React Native Web:
npm run web -w @dc/cashier-mobile
# Buka emulator/perangkat Android yang tersedia:
npm run android -w @dc/cashier-mobile
```

Aplikasi memakai Expo SDK 58. Pilih Expo Go yang mendukung SDK 58, atau buat ulang development build setelah upgrade SDK. Preview web hanya pengujian tambahan; bukan pengganti aplikasi Android. Token native disimpan di Expo SecureStore; preview web menyimpannya di memori dan memerlukan login ulang setelah refresh.

Untuk emulator dengan `adb reverse`, `EXPO_PUBLIC_API_URL=http://127.0.0.1:4000/api/v1` bisa digunakan setelah `adb reverse tcp:4000 tcp:4000`. Variabel `EXPO_PUBLIC_*` masuk bundle dan tidak boleh berisi secret. Produksi harus memakai HTTPS; tidak ada deployment otomatis dalam pekerjaan ini.

## Akun staf

Owner membuka **Tim & shift → Tambah anggota** untuk mengatur nama, username, password minimal 10 karakter dan satu/lebih penugasan cabang. Tombol **Edit** dapat mengubah username/password/penugasan. Kosongkan password saat edit untuk mempertahankan password sebelumnya. Hash/password lama tidak ditampilkan atau dikirim ke client.

Setiap edit akun mencabut sesi kasir yang lama. Akun nonaktif tidak dapat login. Penonaktifan/perubahan penugasan ditolak ketika kasir masih memiliki shift terbuka; owner dapat menutup shift setelah memasukkan kas aktual. Kasir menggunakan akun tersebut di Expo, bukan memilih peran dari UI.

## Aturan menu yang disepakati

- Kategori: **Gurih pedas** dan **Manis**. Owner mengatur nama isian dan harga per **Small, Medium, Jumbo**. Ukuran tanpa harga tidak dijual.
- Kasir menampilkan tiga kartu ukuran, kemudian kategori/isian di dialog. Pilihan disusun tiga kolom, header/tutup tetap terlihat dan isi dapat digulir.
- Panir adalah lapisan utama yang termasuk harga. Kentang dan Mie adalah **extra topping**, masing-masing +Rp1.000 per porsi, boleh dipilih bersama.
- Include Gurih pedas: saus tomat, saus cabai, mayones. Include Manis: cokelat, stroberi, tiramisu, taro, green tea. Harga Rp0; bahan tetap dihitung sesuai resep.
- Extra Gurih pedas: saus keju, Kentang, Mie. Extra Manis: keju parut, choco chip. Harga +Rp1.000 per pilihan.
- Harga referensi `/home/desta/Downloads/buku menu.png`: Small mozzarella/sosis Rp3.000; Medium Beng-beng/Dilan Rp5.000 dan isian lainnya Rp7.000; Jumbo Rp10.000. Full mozzarella dicontohkan tersedia juga di Manis Medium/Jumbo.
- Harga, kategori dan opsi yang diizinkan diverifikasi server. Harga client hanya untuk mendeteksi perubahan; `PRICE_CHANGED` meminta tinjau ulang.

## Alur terhubung

1. Owner mengelola staf, cabang, isian/harga dan ketersediaan.
2. Di **Stok & produksi → Resep, bahan & produksi**, owner menambah bahan/produk jadi, mengatur kebutuhan per SKU-cabang/topping dan memilih mode stok.
3. Penerimaan stok mencatat qty dan biaya. `MADE_TO_ORDER` mengurangi bahan saat checkout. `READY_STOCK` mengubah bahan menjadi produk saat produksi; penjualan hanya mengurangi produk jadi dan tambahan topping.
4. Kasir login, memilih cabang penugasan, membuka shift, membuat pesanan, menerima pembayaran tunai/QRIS manual/transfer manual, lalu checkout dan memproses antrean.
5. Checkout menyimpan order, snapshot resep/harga/HPP, pembayaran, ledger, audit dan hasil idempotensi dalam satu transaksi. Stok dikunci dalam urutan konsisten; saldo negatif ditolak.
6. Draft bukan penjualan. Draft dan kunci checkout yang belum dipastikan dipersistenkan per akun/cabang. Timeout harus diperiksa atau dikirim ulang dengan kunci yang sama; pembuatan pesanan baru diblokir selama hasil belum pasti.
7. Refund penuh owner memerlukan alasan, metode dan referensi pengembalian manual. Default tanpa restock. Pemulihan eksplisit dibatasi pemakaian/nilai keluar asli.
8. Laporan menggunakan tanggal kejadian Asia/Jakarta, refund dan koreksi pada tanggal posting masing-masing. Pembelian stok terpisah dari opex/HPP. Transfer menjaga nilai gabungan. CSV ringkasan menggunakan sumber agregat yang sama dengan laporan.

## Pemeriksaan

```bash
npm run typecheck
npm run test:ui
# Buat database pengujian terpisah sekali:
docker exec dunia-corndog-db createdb -U corndog dunia_corndog_test
npm run test:api
npm run build
npm run export -w @dc/cashier-mobile
```

`TEST_DATABASE_URL` dapat mengganti alamat database pengujian, tetapi nama database wajib berakhiran `_test`. Test menghapus schema **database test tersebut**. Jangan arahkan ke database operasional. Hasil aktual dan batas verifikasi dicatat di [docs/verification.md](docs/verification.md).

## Batas penggunaan

- Resep/takaran, biaya, saldo awal dan nama cabang seed adalah contoh yang wajib divalidasi sebelum bisnis sungguhan menggunakannya. Tidak ada migrasi otomatis transaksi lama dari localStorage ke database produksi.
- Online-first: checkout, perubahan stok dan shift memerlukan konfirmasi server. Tidak ada sinkronisasi penjualan offline, payment gateway, printer, pajak, diskon, akuntansi penuh atau deployment otomatis.
- Satu bisnis Dunia Corndog; scope cabang/peran diperiksa server. Dashboard memperbarui data setiap 20 detik; kasir melakukan polling ketika aktif. Ringkasan owner dihitung server melalui `/reports/overview`; `/owner/state` hanya membawa 25 transaksi terbaru dan shift aktif, tanpa histori pengeluaran. Histori pengeluaran/shift memakai `/owner/expenses` dan `/owner/shifts` dengan cursor pagination; KPI pengeluaran dihitung server. Tabel transaksi memakai cursor pagination 25 baris melalui `/owner/orders`. Grafik mendukung neto negatif; rincian produk, topping dan pembayaran memisahkan penjualan/refund sesuai tanggal kejadian.
- Pengujian emulator/web tidak menggantikan uji tablet fisik, distribusi APK, backup/restore produksi, HTTPS dan tinjauan keamanan deployment. Sebelum rilis produksi, selesaikan daftar penerimaan dan batas tersisa pada dokumen verifikasi.
