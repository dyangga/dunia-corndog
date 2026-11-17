import { useEffect, useRef, useState } from "react";
import type { Order, OwnerOrderPage } from "@dc/contracts";
import type { Connection } from "@/lib/connection";
import { Button } from "./ui/button";

export function OwnerTransactions({
  connection: c,
  from,
  to,
  branch,
  method,
  search,
  renderTable,
}: {
  connection: Connection;
  from: string;
  to: string;
  branch: string;
  method: string;
  search: string;
  renderTable: (items: Order[]) => React.ReactNode;
}) {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [result, setResult] = useState<OwnerOrderPage>();
  const [pending, setPending] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const cursor = cursors.at(-1);
  const loadedCursor = useRef<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    if (loadedCursor.current !== cursor) setResult(undefined);
    const timer = setTimeout(
      () => {
        const params = new URLSearchParams({
          from,
          to,
          method,
          search,
          limit: "25",
        });
        if (branch !== "all") params.set("branchId", branch);
        if (cursor) params.set("cursor", cursor);
        c.request<OwnerOrderPage>(`/owner/orders?${params}`)
          .then((data) => {
            if (active) {
              loadedCursor.current = cursor;
              setResult(data);
              setPending(false);
            }
          })
          .catch((e) => {
            if (active) {
              setError(e.message);
              setPending(false);
            }
          });
      },
      search ? 200 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    c.request,
    c.updatedAt,
    from,
    to,
    branch,
    method,
    search,
    cursor,
    revision,
  ]);
  return (
    <div aria-busy={pending}>
      {result && renderTable(result.items)}
      {pending && (
        <p className="report-feedback" role="status">
          {result ? "Memperbarui transaksi…" : "Memuat transaksi…"}
        </p>
      )}
      {error && (
        <div className="report-feedback" role="alert">
          {error}
          <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
            Coba lagi
          </Button>
        </div>
      )}
      <div className="table-footer">
        <span>
          {result
            ? `Menampilkan ${result.items.length} transaksi · Halaman ${cursors.length} · Data server`
            : "25 transaksi per halaman"}
        </span>
        <div className="button-group">
          <Button
            variant="outline"
            disabled={pending || cursors.length === 1}
            onClick={() => setCursors((old) => old.slice(0, -1))}
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            disabled={pending || !result?.nextCursor}
            onClick={() => setCursors((old) => [...old, result!.nextCursor!])}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  );
}
