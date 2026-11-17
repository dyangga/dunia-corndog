# API Express /api/v1

Semua endpoint kecuali `POST /auth/login` dan `/health` membutuhkan sesi aktif. Web memakai cookie + `X-CSRF-Token` untuk mutation; Expo bearer token. Error berbentuk `{error:{code,message,details?,fieldErrors?,requestId}}`.

| Modul         | Endpoint                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Sesi          | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`                                                                     |
| Staf owner    | `GET/POST /staff`, `PATCH /staff/:id`                                                                                       |
| Cabang        | `GET/POST /branches`, `PATCH /branches/:id`                                                                                 |
| Owner state   | `GET /owner/state`                                                                                                          |
| Menu          | `GET /catalog?branchId=...`, `GET /skus`, `POST /products`, `PATCH /products/:id`                                           |
| Stok          | `GET /inventory?branchId=...`, `POST /inventory/items`, `PATCH /inventory/:id/minimum`                                      |
| Posting stok  | `POST /inventory/receive`, `/inventory/transfer`, `/inventory/waste`, `/inventory/count`                                    |
| Resep         | `GET/PUT /recipes`, `GET/PUT /modifier-recipes`                                                                             |
| Produksi      | `POST /production`                                                                                                          |
| Shift         | `GET /shifts/current`, `POST /shifts/open`, `POST /shifts/:id/close`                                                        |
| Penjualan     | `POST /checkout`, `GET /orders?branchId=...&limit=25&cursor=...&active=true`, `GET /orders/:id`, `PATCH /orders/:id/status` |
| Refund        | `GET /orders/:id/consumption` (owner), `POST /orders/:id/refund` (owner)                                                    |
| Opex          | `POST /expenses`, `POST /expenses/:id/reverse`                                                                              |
| Hasil operasi | `GET /operations/:operation/:key` (aktor yang sama)                                                                         |
| Laporan       | `GET /reports?from=YYYY-MM-DD&to=YYYY-MM-DD&branchId=...`, `GET /reports/export`, `GET /orders/export`                      |
| Kasir/owner   | `POST /requests`, `PATCH /requests/:id` (owner), `GET /notifications` (owner)                                               |
| Profil        | `PATCH /business` (owner)                                                                                                   |

## Identitas dan otorisasi

Bentuk akun staf: `{name,username,password?,branches:[uuid],active}`. Password wajib saat menambah, opsional saat edit. Sesi lama dicabut ketika staf diedit. Username unik tanpa membedakan huruf besar/kecil. Role tidak dapat dipilih oleh client.

Kasir hanya melihat cabang penugasannya. Server mengambil cabang checkout dari shift yang dimiliki akun, bukan dari ID cabang yang dikirim client. Respons kasir tidak berisi HPP, biaya bahan, resep internal, audit atau data staf lain.

## Idempotensi

Posting checkout, produksi, stok, transfer, refund, pengeluaran/reversal dan buka/tutup shift membutuhkan `Idempotency-Key` 8–128 karakter. Ulangi payload yang sama dengan kunci yang sama ketika hasil tidak pasti. Payload lain dengan kunci lama mendapat `409 IDEMPOTENCY_CONFLICT`. Pembacaan hasil hanya untuk aktor yang membuat operasi.

## Uang dan stok

Harga SKU dijual dalam integer IDR. Qty resep dan stok memakai string decimal (maksimal tiga angka pecahan); nilai persediaan PostgreSQL numeric/Decimal. Checkout hanya mengirim SKU, modifier IDs, qty, note, expected total dan konfirmasi pembayaran. Server menghitung harga/HPP dan mengunci stok.

Permintaan refund menyertakan `{reason,method,reference,shiftId?,restock:[{itemId,quantity}]}`. Default `restock:[]`. Pembayaran tunai yang benar-benar menggunakan laci harus mengirim shift aktif cabang yang sama; tanpa shift berarti sumber kas di luar laci. QRIS/transfer tidak mengubah uang fisik shift.

Laporan agregat dan CSV ringkasan menggunakan tanggal posting Asia/Jakarta, termasuk refund/reversal lintas hari. CSV transaksi menyertakan filter periode bayar, cabang, metode/status Refund dan pencarian seperti tabel transaksi. Ekspor aman terhadap formula injection pada nama/teks.
