# Verifikasi implementasi — 13 November 2026

## Pemeriksaan yang benar-benar dijalankan

| Pemeriksaan                                                  | Hasil                                                                                                           |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| TypeScript semua workspace                                   | Lulus (`npm run typecheck`)                                                                                     |
| Regresi frontend owner/prototipe                             | 17 pengujian lulus (`npm run test:ui`)                                                                          |
| API dengan PostgreSQL 17 nyata, database terpisah `_test`    | 8 skenario integrasi lulus (`npm run test:api`)                                                                 |
| Build Express                                                | Lulus (`tsup`, ESM Node 22)                                                                                     |
| Build produksi Next.js                                       | Lulus (`next build --webpack`)                                                                                  |
| Ekspor Expo Android dan web                                  | Lulus; bundle Hermes Android dan static web dibuat                                                              |
| Kompatibilitas dependency Expo                               | `expo install --check` lulus pada workspace mobile                                                              |
| Expo Doctor SDK 58                                          | 20/20 lulus; tidak ada duplikasi React Native, Reanimated, atau Worklets                                        |
| Browser owner ↔ Expo React Native Web ↔ Express ↔ PostgreSQL | Lulus alur tambah/edit staf → login kredensial baru → buka shift → checkout → struk → antrean → dashboard owner |
| Smoke HTTP CSV ringkasan dan transaksi dengan filter         | Lulus; status 200 dan transaksi native `DC-000003` ditemukan sesuai filter                                      |
| Logout kasir ketika koneksi browser offline                  | Lulus; UI kembali ke login dan cache/draft lokal dibersihkan                                                    |
| Baseline Android native melalui Expo Go SDK 55               | Lulus smoke test pada emulator API 37 dengan viewport 1440×900 / density 160                                    |
| Android native melalui Expo Go SDK 58                        | Lulus login, checkout Medium Manis Rp6.000, struk API `DC-000007`, dan antrean pada emulator API 37               |

Tidak ada ESLint yang dikonfigurasi pada proyek awal; tidak diklaim sebagai pemeriksaan yang lulus. TypeScript, kompilasi dan formatting dipakai selama implementasi. Tidak ada deployment, layanan berbayar atau publikasi aplikasi.

Satu regresi frontend terhubung secara khusus memeriksa bahwa versi stok pada awal opname tetap dikirim meskipun polling menyegarkan saldo sebelum formulir disubmit.

## Upgrade Expo 58

SDK dinaikkan bertahap 55 → 56.0.24 → 57.0.33 → 58.0.25. Pemeriksaan dependency dan TypeScript dijalankan pada tahap 56 dan 57; rangkaian typecheck, 17 tes UI, 8 tes API PostgreSQL, build Express/Next.js, serta ekspor Android/web diulang pada versi akhir. React 19.3.0 digunakan satu runtime fisik oleh dashboard dan kasir; React Native 0.88.1, Reanimated 4.7.1, dan Worklets 0.13.0 diselaraskan dalam lockfile dan overrides workspace.

Konfigurasi `newArchEnabled` yang sudah tidak diterima schema dihapus. NativeWind tetap memakai versi stabil 4.2.7; `darkMode: "class"` membuat pengaturan tema light dari Expo kompatibel dengan interop NativeWind pada web. Review browser diulang setelah perbaikan: login dengan kredensial staf hasil edit, buka shift, checkout Small + Kentang Rp4.000, antrean, dan logout offline lulus tanpa uncaught runtime error. Skrip review sekarang menggagalkan pemeriksaan bila mendeteksi uncaught browser exception.

Smoke Android diulang memakai Expo Go 58.0.5 pada emulator API 37 (1440×900, density 160): login dengan akun review hasil edit owner, pulihkan shift review yang dibuka lewat browser, pilih Medium → Manis → Beng-beng → Cokelat gratis → Keju parut +Rp1.000 → tunai pas → struk `DC-000007` Rp6.000 dari PostgreSQL → antrean. Screenshot `android-pos`, `android-customize`, `android-receipt`, dan `android-queue` diperbarui dan tampilan dialog/struk diperiksa. Akun/shift milik pengguna yang sudah ada tidak ditutup dalam pengujian ini.

Pemulihan SecureStore juga lulus setelah force-stop dan cold launch Expo Go tanpa mengisi ulang kredensial. Dua shift milik akun review yang dibuat dalam pengujian upgrade ditutup sesuai kas simulasi; kedua akun dinonaktifkan dan sesinya dicabut. Histori review tetap disimpan. Ukuran/density emulator direset dan emulator dihentikan; Metro dikembalikan ke akses LAN untuk tablet.

## Penyempurnaan tampilan dan animasi Expo

Login, navigasi, kartu Small/Medium/Jumbo, keranjang, dialog, status transaksi dan baris stok diperbarui memakai komponen React Native. Dashboard dan aturan harga/stok tidak diubah. Font lokal Host Grotesk disertakan dengan lisensinya. Atribut SVG dekoratif tetap dibedakan: `aria-hidden` pada web dan `accessible={false}` pada native.

Pemeriksaan browser CDP pada 1440×1000 dan 390×844 lulus: login, skala kartu saat ditekan (matrix 0.97), exit dialog dengan opacity/transform perantara sebelum unmount, kategori Manis, isian Beng-beng, include Cokelat gratis, extra Keju parut, keranjang Rp6.000, panel keranjang ponsel, tab stok dan logout. Tidak ada horizontal overflow ponsel atau console/runtime error pada alur ini. Dengan `prefers-reduced-motion: reduce`, transform tekan dan panel menjadi identitas; dialog tetap berfungsi.

Alur browser terhubung owner → tambah/edit staf → login kasir → buka shift → Small + Kentang → pembayaran → antrean → logout offline lulus kembali. Tab diberi label aksesibilitas eksplisit agar ikon tidak mengubah nama kontrol bagi pembaca layar maupun pengujian.

Android API 37 dengan Expo Go 58.0.5 (1440×900, density 160) juga lulus login akun review, checkout Medium Manis/Beng-beng/Cokelat/Keju parut Rp6.000, struk API `DC-000009`, dan antrean. Pengujian native menemukan bahwa kurva CSS Reanimated harus memakai objek `cubicBezier(...)`; kode diperbaiki dan alur native diulang tanpa galat tersebut. Screenshot Android dan `native-polish-*` di `artifacts/review/` diperiksa.

Interaksi tekan/tahan/lepas kartu pada Android juga membuka dialog dan penutupan kembali ke POS lulus. Setelah review, shift milik akun uji yang dibuat pada tahap ini ditutup sesuai kas simulasi dan akunnya dinonaktifkan; sesi dicabut, histori dipertahankan. Ukuran/density emulator direset dan emulator dihentikan. Pemeriksaan akhir: typecheck semua workspace, 17 tes UI, 8 tes API, ekspor Android/web, dan Expo Doctor 20/20 lulus.

Ini verifikasi fungsi dan tampilan melalui browser/emulator, bukan pengukuran frame rate release pada tablet fisik. Rasa haptik, respons saat input cepat, font skala besar dan kelancaran pada tablet Android paling lambat yang akan didukung masih perlu dicoba pada perangkat tersebut. Tidak ada animasi geser antartab atau interpolasi angka uang.

## Dialog dengan isian wajib dipilih

Kategori ditampilkan sebagai dua tombol sejajar, isian sebagai grid dua kolom di bawahnya, kemudian topping gratis, extra berbayar, dan catatan. Pilihan topping lebih ringkas dengan area sentuh minimal 48 dp. Kategori/isian menggunakan role radio (pilih satu), topping menggunakan checkbox. State pilihan diekspos melalui `aria-checked` pada preview web dan accessibility state native.

Isian tidak otomatis terpilih saat membuka ukuran atau mengganti kategori. Footer menampilkan tombol nonaktif “Pilih isian dulu” dan stepper jumlah nonaktif sampai isian tersedia dipilih. Mengganti kategori mengosongkan isian/topping dan mengembalikan jumlah ke satu; mengetuk kategori yang sedang aktif mempertahankan pilihan. Harga per porsi yang belum dipilih ditampilkan sebagai “—”. Pesan tidak tersedia hanya muncul bila kategori/ukuran benar-benar tidak memiliki isian yang tersedia.

Review browser CDP pada 1440×900 dan 390×900 lulus: pembukaan Medium/Small tanpa isian terpilih, penolakan tambah sebelum memilih, kategori di atas grid dua kolom, Beng-beng Rp5.000 + Cokelat gratis + Keju parut Rp1.000 → Rp6.000, pemeliharaan pilihan saat kategori aktif ditekan lagi, pengosongan pilihan saat kategori berubah, serta item dan modifier yang benar pada keranjang. Tidak ada console/runtime error. TypeScript mobile, 17 tes UI owner, dan ekspor Android/web lulus; alur dialog baru belum diulang pada perangkat Android fisik.

## Dropdown kategori/isian dan penyempurnaan dialog

Kategori dan isian memakai select berdesain lokal (`@rn-primitives/select` 1.5.2 / portal 1.5.3), dengan portal di dalam modal native. Pada tablet kedua field sejajar; pada ponsel field memakai lebar penuh. Nama isian dan harga dipisahkan pada trigger/daftar pilihan, pilihan aktif ditandai centang, dan header memakai ilustrasi corndog. Topping tetap multi-select dengan badge Gratis/Berbayar. Footer jumlah/total tetap terlihat dan isian tetap harus dipilih sendiri.

Review browser CDP (1440×900 dan 390×900) memeriksa kategori, isian wajib, reset ketika berganti kategori, total Beng-beng/Cokelat/Keju parut Rp6.000, penambahan ke keranjang, pembukaan ulang tanpa pilihan otomatis, serta Escape yang menutup menu tanpa menutup dialog induk. Tidak ada console/runtime error pada alur yang lulus. Screenshot `cashier-designed-select-*` berada di `artifacts/review/`.

Aplikasi debug Android `id.duniacorndog.kasir` dibangun dan dipasang langsung melalui `npx expo run:android --no-bundler --device emulator-5554` pada emulator Small_Tablet (1920×1200 / density 320); build Gradle berhasil. Pengujian langsung tanpa Expo Go lulus memilih Manis → Beng-beng → harga Rp5.000, menutup menu melalui Back tanpa menutup dialog, mengganti kategori yang mengosongkan isian dan menonaktifkan Tambah, serta menutup dialog tanpa mengirim pesanan. Emulator milik pengguna tetap berjalan; akun, shift, dan stok tidak diubah oleh pengujian ini.

Pemeriksaan dependency Expo lulus. Expo Doctor memberi 19/20 dengan peringatan bahwa folder native sudah ada sehingga konfigurasi `app.json` perlu disinkronkan lewat prebuild bila konfigurasi native berubah; tidak ada prebuild clean atau penghapusan proyek Android pengguna. Rasa gerak pada tablet fisik dan uji iOS tetap belum diverifikasi.

## Cakupan delapan skenario API

1. Owner membuat dan mengedit username/password staf, password Argon2id, sesi lama dicabut, password/hash tidak terdapat dalam respons client.
2. Kasir ditolak ketika mengakses cabang lain, data owner dan biaya. Respons stok kasir tidak menyertakan nilai biaya.
3. Cookie web HttpOnly, mutation tanpa CSRF ditolak, mutation dengan token yang benar diterima.
4. Checkout isian/ukuran/include gratis/extra berbayar, pengiriman ulang menghasilkan ID sama dan satu pembayaran, payload berbeda ditolak, perubahan harga ditolak, refund ganda ditolak, refund tanpa restock tetap mempertahankan HPP.
5. Dua kasir membeli sisa satu isian: tepat satu berhasil, satu ditolak, saldo nol tanpa negatif.
6. Moving average penerimaan 10×Rp5.000 + 10×Rp7.000 → nilai Rp120.000; waste 3 → 17 pcs/Rp102.000; opname versi lama ditolak; transfer menjaga nilai gabungan; transfer kurang stok rollback; ledger tidak dapat diedit.
7. Produksi READY_STOCK mengalokasikan biaya rencana ke hasil aktual, penjualan mengurangi produk jadi tanpa konsumsi bahan kedua, refund pemulihan mengembalikan nilai keluar asli.
8. Koreksi pengeluaran mempertahankan catatan asli dan memisahkan kejadian reversal; koreksi ganda ditolak; kas harapan direkonsiliasi; checkout setelah shift ditutup ditolak.

## Baseline smoke test native Android SDK 55

Emulator Android API 37 dijalankan sementara dengan Expo Go 55.0.7. Viewport diubah ke 1440×900 untuk memeriksa tata letak tablet, lalu pengaturan ukuran/density direset dan emulator dihentikan. Tidak ada tablet fisik yang terhubung.

Alur aktual: login `nadia` → buka shift Rp100.000 → Medium → Manis → Beng-beng → Cokelat gratis → Keju parut +Rp1.000 → tunai pas → struk `DC-000003` Rp6.000 dari API → antrean tampil. Pemulihan sesi native setelah reload juga terlihat melalui SecureStore. Data ini merupakan data review pada bisnis contoh, bukan transaksi operasional sungguhan.

Setelah review, empat shift pengujian ditutup dengan nilai kas yang sesuai simulasi. Akun yang dibuat skrip browser dinonaktifkan; akun seed owner/nadia/rizky tetap aktif. Sesi native Nadia dicabut untuk memulai review berikutnya dari login. Histori penjualan, ledger dan audit tetap dipertahankan.

Pengujian native menemukan gaya callback Pressable yang tidak diterapkan sesuai harapan oleh interop NativeWind pada Android; tombol/kartu diperbaiki menjadi style array dan feedback ripple native. Area tombol utama minimal 48 dp, pilihan minimal 52 dp. Corndog menggunakan komponen SVG native, bukan DOM SVG web.

Screenshot lokal berada di `artifacts/review/`: owner-staff, owner-add-staff, expo-pos-tablet, expo-customize-tablet, expo-receipt-tablet, expo-queue-phone, owner-dashboard-phone, android-login, android-pos, android-customize, android-receipt, android-queue. Screenshot menunjukkan data contoh yang dapat bertambah saat skrip review dijalankan ulang.

## Mengulang review browser

Jalankan API, owner web dan Metro terlebih dahulu. Gunakan Chrome/Chromium headless yang tersedia di komputer:

```bash
ALLOW_REVIEW_WRITES=1 CHROME_PATH=/path/to/chrome-headless-shell node scripts/review-browser.mjs
```

Skrip menambah staf dan transaksi review. Ia hanya menerima bisnis seed yang masih berlabel `data contoh` dan kredensial demo lokal pada README. Jangan arahkan ke bisnis operasional. Browser tersebut menguji React Native Web; hasil itu dipisahkan dari smoke test Android di atas.

## Batas sebelum produksi

Ini implementasi terhubung untuk review lokal, belum pernyataan seluruh FR-01–FR-24 siap produksi.

- Validasi resep, mode stok tiap cabang, biaya dan saldo awal aktual masih diperlukan. Semua takaran/biaya seed ditandai contoh.
- Belum ada uji tablet fisik Android/iPad, uji iOS, build APK/AAB bertanda tangan, distribusi, backup/restore produksi, uji beban, atau konfigurasi HTTPS/hosting produksi.
- Skenario timeout diuji melalui replay/hasil idempotensi; fault injection jaringan yang memutus respons persis sesudah commit dan race tutup-shift-vs-checkout secara simultan belum diuji terpisah. Uji tersebut tetap menjadi gerbang penerimaan produksi.
- Ringkasan owner kini memakai agregasi server dan transaksi memakai cursor pagination. Dataset 10.000 order diuji pada database `_test`; benchmark beban produksi bersamaan serta rekonsiliasi mandiri terjadwal belum dilakukan.
- UI notifikasi mencakup stok rendah dan permintaan kasir. Selisih shift terlihat di monitor shift; notifikasi selisih khusus dan halaman penelusuran audit lengkap masih perlu dilengkapi untuk penerimaan P1 penuh.
- Endpoint koreksi/pemulihan stok tersedia. Pilihan mana yang secara fisik dapat dipulihkan tetap keputusan owner; API hanya membatasi jumlah dan biaya asli.
- Tidak ada impor otomatis histori localStorage. Prototipe lama dipertahankan sebagai fixture regresi UI; halaman aplikasi utama menggunakan autentikasi/API nyata.
- Pengguna harus memeriksa URL LAN dan firewall komputer saat memakai tablet. `EXPO_PUBLIC_*` berisi URL publik saja, tanpa secret. Untuk produksi, kedua aplikasi memerlukan API HTTPS.
# Optimasi render Expo — 14 November 2026

- TypeScript mobile dan export Android Hermes + web berhasil.
- Regresi browser pada 1440 dan 390 px: isian wajib dipilih, kategori berbeda mereset isian/topping, kategori yang sama mempertahankan pilihan, topping gratis dan berbayar menghasilkan total Rp6.000, keranjang menerima baris yang benar, membuka sesi berikutnya mengosongkan isian, Escape hanya menutup menu dropdown. Tidak ada runtime/console error.
- Pemeriksaan fiber React melalui hook DevTools pada browser: setelah mengetik catatan, nilai input berubah sementara hook state `Cashier` dan props `SizeMenu` tetap identik. State input terisolasi di dialog.
- Fixture 200 transaksi disisipkan hanya ke respons fetch pada browser review; tidak disimpan ke API. FlatList memasang 15 baris pada tampilan awal dan 21 baris setelah menggulir hingga transaksi terakhir. Semua 200 transaksi tetap dapat dijangkau.
- Selama 21,5 detik di riwayat tidak ada fetch berkala tambahan. Antrean tetap melakukan polling berikutnya pada interval 20 detik.
- Pada APK debug di emulator Pixel Tablet: dropdown kategori/isian, harga Beng-beng Medium Rp5.000, Back menutup menu tanpa menutup dialog, pergantian kategori mengosongkan isian dan menonaktifkan tombol tambah, serta penutupan dialog berhasil. Tidak ada checkout atau perubahan shift dalam review ini. Aplikasi dimuat ulang setelah Fast Refresh akibat perubahan tipe ekspor komponen.
- Hasil ini membuktikan batas render dan perilaku UI; bukan benchmark FPS perangkat fisik. Build release pada ponsel Android kelas menengah dan iOS masih memerlukan pengukuran. Cabang dropdown native dengan lebih dari 30 opsi telah diperiksa melalui kode dan export, belum melalui fixture besar pada perangkat fisik.


## Perbaikan laporan Next.js — 14 November 2026

- 21 tes UI lulus, termasuk batang neto negatif dan pemilihan melalui tombol, pemeliharaan KPI saat refresh gagal, pengosongan nilai filter lama, error awal tanpa angka nol palsu, dan pagination dengan filter yang tetap dibawa.
- 9 skenario API/PostgreSQL lulus. Skenario baru memeriksa batas hari Asia/Jakarta, refund dari penjualan periode sebelumnya, neto negatif, qty produk/topping refund yang terpisah, pembayaran/refund, isolasi cabang, penolakan akun kasir, detail order lama, pagination 25+15 tanpa duplikat, dan 40 baris CSV sesuai filter.
- Fixture tambahan 10.000 order hanya dibuat pada database `_test`: ringkasan memberi count 10.000 dan bruto Rp20.000.000, recent-orders tetap empat baris dan owner-state tetap 25 baris. Ini pengujian fungsi dengan data besar, bukan benchmark konkurensi atau latensi produksi.
- Migrasi indeks 0002 telah diterapkan pada database lokal melalui `npm run db:migrate`.
- Akses host browser CUA tidak tersedia. Pemeriksaan visual browser nyata pada lebar desktop/ponsel belum dilakukan untuk perubahan ini; validasi komponen menggunakan jsdom dan build produksi. Tidak ada mutasi order/shift operasional pada review ini.
- Pemeriksaan akhir: `npm run typecheck` seluruh workspace dan `npm run build` (Express + Next.js) lulus setelah perubahan final.

## Chart shadcn/Recharts — 14 November 2026

- Grafik manual diganti area chart Recharts 3.10.1 dengan komponen Chart dari registry resmi shadcn (`new-york-v4`). Komponen dipasang hanya pada owner-web; React/React DOM tetap satu versi 19.3.0 dan patch NativeWind tetap terdaftar.
- 21 tes UI lulus. Pengujian chart memeriksa path area, garis referensi nol, tooltip bruto/refund melalui navigasi keyboard, serta data harian dengan neto negatif. Ukuran ResponsiveContainer pada jsdom disimulasikan karena jsdom tidak memiliki mesin layout.
- TypeScript owner-web lulus. Tidak ada perubahan pada agregasi API atau alur kasir Expo dalam revisi chart ini.

## Stabilitas kartu KPI saat navigasi — 14 November 2026

- Penyebab layout shift yang ditemukan: paragraf loading/refresh dalam alur normal ditambahkan tepat sebelum kartu, lalu dilepas ketika request selesai. Pada tab Ringkasan laporan, grup KPI sebelumnya juga digantikan paragraf selama loading awal.
- Status loading dipindahkan ke slot waktu pembaruan dengan lebar/tinggi stabil; pengumuman screen reader berada di elemen sr-only. Grup kartu laporan tetap ada sejak render awal, menggunakan placeholder nilai yang belum tersedia. Refresh tetap mempertahankan angka terakhir.
- 25 tes UI lulus. Regresi baru menahan respons API untuk memeriksa identitas DOM kartu tetap sama saat loading/loaded/refresh pada dashboard, laporan, dan pengeluaran; tidak ada banner loading dalam alur normal sebelum kartu; kembali dari katalog ke laporan mempertahankan nilai cache selama refresh.
- Pengujian ini memverifikasi struktur dan lifecycle React melalui jsdom. Rekaman visual/layout-shift di browser nyata belum tersedia karena host CUA tidak terhubung. Optimasi luas dari audit sebelumnya belum diterapkan dalam perubahan khusus KPI ini.
- Pemeriksaan akhir TypeScript owner-web dan build produksi Next.js lulus setelah perbaikan KPI ini.

## Penerapan audit performa owner — 14 November 2026

- 29 tes UI lulus. Pengujian tambahan: katalog 150 item memasang 25 kartu, pencarian menemukan item di halaman jauh tanpa merender parent, pembukaan edit meneruskan produk yang benar; panel inventori tertutup tidak mengaktifkan request, query berhenti ketika ditutup, draft input bertahan ketika dibuka lagi; retry koreksi menggunakan kunci dan originalId yang sama; data overview identik mempertahankan referensi untuk komponen memo. Regresi KPI loading/navigasi dan versi opname tetap lulus.
- 10 skenario API/PostgreSQL lulus. Skenario baru memasukkan 70 expense dan 70 shift dengan timestamp mikrodetik yang sama, menelusuri semua halaman tanpa duplikat, memeriksa kejadian reversal/tanggal/jumlah, agregasi expenseStats dan opex, isolasi cabang, penolakan akun kasir, cursor invalid, serta proyeksi owner-state yang hanya membawa shift aktif dan tanpa histori expense.
- TypeScript seluruh workspace dan build Express + Next.js lulus. React-loadable manifest produksi menempatkan sales-trend, inventory-page/tools, report-breakdowns, owner-history dan App pada chunk dynamic terpisah.
- Migrasi `0003_owner_history_indexes.sql` diterapkan ke database lokal. Tidak ada order/shift operasional yang dibuat, ditutup atau dihapus selama pemeriksaan; fixture histori hanya berada pada database `_test`.
- Perubahan diverifikasi lewat source, jsdom, PostgreSQL dan build produksi. Belum ada recording FPS/paint/GPU pada perangkat nyata karena host browser CUA tidak tersedia. Sidebar dipertahankan sesuai review; pemeriksaan clip-path tetap menjadi tindak lanjut berbasis pengukuran.

## Tombol aksi dan konfirmasi owner — 14 November 2026

- Footer katalog mengelompokkan Edit dan status di sisi kanan dengan pembungkusan responsif. Aksi staf memakai grup berjarak konsisten. Primitive Button memakai radius bersama dan varian soft/danger-outline; aksi edit, status, koreksi, tutup shift, inventori, dan ekspor mendapat ikon sesuai fungsi.
- AlertDialog berbasis Radix dengan pola shadcn dipasang melalui ConfirmationProvider. Aktivasi/penonaktifan menu, cabang, dan akun staf serta penandaan laporan kasir sebagai ditinjau menyebut entitas dan dampak sebelum menulis perubahan. Form refund, koreksi pengeluaran, opname, waste dan tutup shift mempertahankan alur review yang sudah ada dengan label akhir yang lebih jelas; reset demo memakai tombol destruktif.
- 37 tes UI lulus. Regresi mencakup pembatalan tanpa mutasi, fokus awal Batal dan pemulihan fokus, satu penulisan saat klik ganda, larangan dismiss ketika pending, error/retry API pada dialog yang sama, larangan menonaktifkan cabang/staf dengan shift aktif, persistensi perubahan status demo setelah konfirmasi, dan provider yang tidak merender ulang parent halaman. Regresi KPI, laporan, pagination dan versi opname tetap lulus.
- TypeScript owner-web dan build produksi Next.js lulus. Tidak ada perubahan API, skema database, maupun aplikasi Expo. Pengujian menggunakan mock API atau data demo browser; tidak ada perubahan data operasional.
- Host browser CUA kembali diperiksa dan tidak tersedia. Tata letak desktop/ponsel belum diverifikasi secara visual di browser nyata; pemeriksaan saat ini menggunakan source, jsdom dan build produksi.

## Penyelarasan tab website — 14 November 2026

- Gaya tab diterapkan pada komposisi FilterTabs bersama: laporan Ringkasan/Transaksi, filter metode transaksi, kategori katalog, dan enam tab operasional stok. Setiap pilihan memiliki ikon; tab aktif memakai latar arang dengan ikon emas, sementara grup memakai permukaan abu netral selebar isinya.
- Pada layar kecil grup mengisi lebar tersedia dan pilihan membungkus ke baris berikutnya. Semantik Radix tab/tabpanel dan navigasi keyboard dipertahankan; fokus keyboard pada tab aktif memiliki indikator terang. Perubahan warna hanya bertransisi untuk pointer, dan aturan reduced-motion tetap berlaku.
- 37 tes UI, TypeScript owner-web dan build produksi Next.js lulus. Verifikasi visual browser nyata masih belum tersedia karena host CUA tidak terhubung.

## Form inventori melalui dialog — 14 November 2026

- Panel details panjang inventori diganti empat tombol pada aksi kanan atas judul halaman Stok & produksi: Tambah bahan, Atur resep, Batas stok minimum dan Posting produksi. Tiap tombol membuka satu dialog dengan Scroll Area shadcn; daftar takaran bahan tidak lagi memiliki scroll internal tambahan. Pada ponsel aksi membentuk dua kolom di bawah judul.
- Implementasi form tetap dimuat secara lazy pada pembukaan pertama. Draft dikontrol state di controller yang tetap terpasang saat dialog tertutup; cabang resep dan cabang batas minimum terpisah. Query hanya aktif untuk formulir yang sedang dibuka, dan seluruh query alat nonaktif ketika dialog ditutup. Fokus dikembalikan ke tombol pemicu; penutupan dan pengiriman ulang ditahan selama penyimpanan.
- Tombol kontekstual Catat produksi kini membuka dialog produksi yang sama, menggantikan pemberitahuan yang hanya mengarahkan pengguna ke panel lama.
- 40 tes UI lulus. Regresi memeriksa draft item/unit setelah tutup dan buka ulang, pemuatan query sesuai alat, penghentian query tertutup, Scroll Area, pemulihan fokus, draft minimum/produksi terpisah, payload minimum dan produksi, state pending pada penambahan bahan, serta peletakan tombol di header dan pembukaan produksi dari tabnya. API pada tes dimock; tidak ada posting produksi atau perubahan stok operasional.
- TypeScript owner-web dan build produksi Next.js lulus. Host browser CUA diperiksa lagi dan belum tersedia, sehingga tampilan desktop/ponsel belum diperiksa langsung di browser nyata.
