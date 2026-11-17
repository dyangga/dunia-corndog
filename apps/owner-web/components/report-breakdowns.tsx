import { memo } from "react";
import { Download } from "lucide-react";
import { PaginatedList } from "./paginated-list";
import type { ReportOverview } from "@dc/contracts";
import { Card, CardHeader } from "./ui/card";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "./ui/table";
import { Button } from "./ui/button";
import { money, number } from "@/lib/utils";
function download(name: string, rows: (string | number)[][]) {
  const safe = (value: string | number) => {
    let s = String(value);
    if (typeof value === "string" && /^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + rows.map((row) => row.map(safe).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export const ReportPayments = memo(function ReportPayments({
  data,
}: {
  data: ReportOverview;
}) {
  return (
    <Card className="panel">
      <CardHeader className="panel-heading">
        <div>
          <h2>Metode pembayaran</h2>
          <p>Penjualan dan refund sesuai tanggal kejadian</p>
        </div>
      </CardHeader>
      <div className="table-scroll">
        <Table>
          <TableHeader>
            <TableRow>
              {["Metode", "Penjualan bruto", "Refund", "Neto"].map((t) => (
                <TableHead key={t}>{t}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {["QRIS", "Tunai", "Transfer"].map((method) => {
              const row = data.payments.find((p) => p.method === method);
              return (
                <TableRow key={method}>
                  <TableCell>
                    <b>{method}</b>
                    <small>
                      {row?.count || 0} penjualan · {row?.refundCount || 0}{" "}
                      refund
                    </small>
                  </TableCell>
                  <TableCell>{money(row?.gross || 0)}</TableCell>
                  <TableCell>{money(row?.refunds || 0)}</TableCell>
                  <TableCell>{money(row?.net || 0)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="notice">
        QRIS dan transfer dikonfirmasi manual. Refund dicatat pada hari
        pengembalian dana.
      </p>
    </Card>
  );
});
export const ReportBreakdowns = memo(function ReportBreakdowns({
  data,
}: {
  data: ReportOverview;
}) {
  const scope = `${data.totals.from} s.d. ${data.totals.to}`;
  const productRows: (string | number)[][] = [
    [
      "Produk",
      "Kategori",
      "Ukuran",
      "Terjual",
      "Direfund",
      "Bruto (IDR)",
      "Refund (IDR)",
      "Neto (IDR)",
    ],
    ...data.products.map((p) => [
      p.name,
      p.category,
      p.size,
      p.sold,
      p.refunded,
      p.gross,
      p.refunds,
      p.gross - p.refunds,
    ]),
  ];
  const modifierRows: (string | number)[][] = [
    ["Topping", "Jenis", "Terpilih", "Direfund"],
    ...data.modifiers.map((p) => [p.name, p.kind, p.sold, p.refunded]),
  ];
  return (
    <div className="report-breakdowns">
      <Card className="panel">
        <CardHeader className="panel-heading">
          <div>
            <h2>Produk & ukuran</h2>
            <p>{scope} · Penjualan dan refund dihitung terpisah</p>
          </div>
          <Button
            variant="outline"
            onClick={() => download("produk-dunia-corndog.csv", productRows)}
          >
            <Download aria-hidden="true" /> Ekspor rincian produk
          </Button>
        </CardHeader>
        <PaginatedList items={data.products}>
          {(pageItems) => (
            <div className="table-scroll">
              <Table>
                <TableHeader>
                  <TableRow>
                    {productRows[0].map((t) => (
                      <TableHead key={t}>{t}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell>{p.size}</TableCell>
                      <TableCell>{number(p.sold)}</TableCell>
                      <TableCell>{number(p.refunded)}</TableCell>
                      <TableCell>{money(p.gross)}</TableCell>
                      <TableCell>{money(p.refunds)}</TableCell>
                      <TableCell>{money(p.gross - p.refunds)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!data.products.length && (
                <p className="empty">
                  Belum ada penjualan atau refund produk pada periode ini.
                </p>
              )}
            </div>
          )}
        </PaginatedList>
      </Card>
      <Card className="panel">
        <CardHeader className="panel-heading">
          <div>
            <h2>Topping include & extra</h2>
            <p>
              {scope} · Jumlah pilihan topping mengikuti porsi; tidak menambah
              jumlah corndog
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => download("topping-dunia-corndog.csv", modifierRows)}
          >
            <Download aria-hidden="true" /> Ekspor rincian topping
          </Button>
        </CardHeader>
        <PaginatedList items={data.modifiers}>
          {(pageItems) => (
            <div className="table-scroll">
              <Table>
                <TableHeader>
                  <TableRow>
                    {modifierRows[0].map((t) => (
                      <TableHead key={t}>{t}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.kind}</TableCell>
                      <TableCell>{number(p.sold)}</TableCell>
                      <TableCell>{number(p.refunded)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!data.modifiers.length && (
                <p className="empty">Belum ada topping pada periode ini.</p>
              )}
            </div>
          )}
        </PaginatedList>
      </Card>
    </div>
  );
});
