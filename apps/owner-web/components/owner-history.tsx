"use client";
import { useState } from "react";
import { RotateCcw, LogOut } from "lucide-react";
import type { Expense, Shift } from "@dc/contracts";
import type { Connection } from "@/lib/connection";
import { useOwnerRecords } from "@/hooks/use-owner-records";
import {
  BusinessDialog,
  BusinessSelect,
  Field,
  StatusBadge,
} from "./business-ui";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardHeader } from "./ui/card";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "./ui/table";
import { CloseStaffShift } from "./owner-operations";
import { money } from "@/lib/utils";
function HistoryControls({
  records,
}: {
  records: {
    pending: boolean;
    error: string;
    page: number;
    hasNext: boolean;
    previous: () => void;
    next: () => void;
    retry: () => void;
  };
}) {
  return (
    <>
      {records.pending && (
        <p className="sr-only" role="status">
          Memperbarui riwayat…
        </p>
      )}
      {records.error && (
        <p className="report-feedback" role="alert">
          {records.error}
          <Button onClick={records.retry} variant="outline">
            Coba lagi
          </Button>
        </p>
      )}
      <div className="table-footer">
        <span>Halaman {records.page} · 25 catatan per halaman</span>
        <div className="button-group">
          <Button
            variant="outline"
            onClick={records.previous}
            disabled={records.pending || records.page === 1}
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            onClick={records.next}
            disabled={records.pending || !records.hasNext}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </>
  );
}
export function ExpenseHistory({
  connected: c,
  from,
  to,
  branch,
}: {
  connected: Connection;
  from: string;
  to: string;
  branch: string;
}) {
  const params = new URLSearchParams({ from, to, limit: "25" });
  if (branch !== "all") params.set("branchId", branch);
  const records = useOwnerRecords<Expense & { originalId: string }>(
    c,
    `/owner/expenses?${params}`,
  );
  const [selected, setSelected] = useState<{
    expense: Expense & { originalId: string };
    key: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Card className="panel">
        <CardHeader className="panel-heading">
          <h2>Riwayat pengeluaran</h2>
          <StatusBadge tone="neutral">Operasional</StatusBadge>
        </CardHeader>
        <div className="table-scroll" aria-busy={records.pending}>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Keterangan",
                  "Cabang",
                  "Tanggal",
                  "Pembayaran",
                  "Jumlah",
                  "Aksi",
                ].map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <b>{e.name}</b>
                    <small>{e.category}</small>
                  </TableCell>
                  <TableCell>
                    {c.state.branches.find((b) => b.id === e.branch)?.name ||
                      e.branch}
                  </TableCell>
                  <TableCell>{e.date}</TableCell>
                  <TableCell>{e.method}</TableCell>
                  <TableCell>
                    <b>{money(e.amount)}</b>
                  </TableCell>
                  <TableCell>
                    {!e.reversed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelected({ expense: e, key: crypto.randomUUID() });
                          setError("");
                        }}
                      >
                        <RotateCcw aria-hidden="true" /> Koreksi
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!records.pending && !records.error && !records.items.length && (
            <p className="empty">Belum ada pengeluaran pada periode ini.</p>
          )}
        </div>
        <HistoryControls records={records} />
      </Card>
      <BusinessDialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
        title="Koreksi pengeluaran"
        description={
          selected
            ? `${selected.expense.name} · Koreksi dicatat pada hari ini tanpa mengubah catatan asli.`
            : undefined
        }
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selected || busy) return;
            const reason = String(new FormData(e.currentTarget).get("reason"));
            setBusy(true);
            setError("");
            try {
              await c.request(
                `/expenses/${selected.expense.originalId}/reverse`,
                { method: "POST", body: { reason }, key: selected.key },
              );
              await c.refresh();
              records.retry();
              setSelected(null);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Alasan koreksi">
            <Input name="reason" minLength={5} maxLength={500} required />
          </Field>
          {error && <p role="alert">{error}</p>}
          <Button variant="destructive" disabled={busy}>
            <RotateCcw aria-hidden="true" />{" "}
            {busy ? "Menyimpan…" : "Catat koreksi"}
          </Button>
        </form>
      </BusinessDialog>
    </>
  );
}
export function ShiftMonitor({ connected: c }: { connected: Connection }) {
  const [branch, setBranch] = useState("all"),
    [state, setState] = useState("all"),
    [selected, setSelected] = useState<Shift | null>(null);
  const params = new URLSearchParams({ state, limit: "25" });
  if (branch !== "all") params.set("branchId", branch);
  const records = useOwnerRecords<Shift>(c, `/owner/shifts?${params}`);
  return (
    <>
      <Card className="panel">
        <CardHeader className="panel-heading">
          <div>
            <h2>Monitor shift</h2>
            <p>Kasir aktif dan rekonsiliasi kas</p>
          </div>
        </CardHeader>
        <div className="list-toolbar">
          <BusinessSelect
            label="Filter cabang shift"
            value={branch}
            onValueChange={setBranch}
            options={[
              { value: "all", label: "Semua cabang" },
              ...c.state.branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
          <BusinessSelect
            label="Filter status shift"
            value={state}
            onValueChange={setState}
            options={[
              { value: "all", label: "Semua shift" },
              { value: "active", label: "Shift aktif" },
              { value: "closed", label: "Shift ditutup" },
            ]}
          />
        </div>
        <div className="table-scroll" aria-busy={records.pending}>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Kasir",
                  "Cabang",
                  "Kas awal",
                  "Kas aktual",
                  "Selisih",
                  "Status",
                  "Aksi",
                ].map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.items.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell>
                    <b>{shift.cashier}</b>
                  </TableCell>
                  <TableCell>
                    {c.state.branches.find((b) => b.id === shift.branch)
                      ?.name || shift.branch}
                  </TableCell>
                  <TableCell>{money(shift.opening)}</TableCell>
                  <TableCell>
                    {shift.actual === undefined ? "—" : money(shift.actual)}
                  </TableCell>
                  <TableCell>
                    {shift.difference === undefined
                      ? "—"
                      : money(shift.difference)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge>
                      {shift.open ? "Aktif" : "Ditutup"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {shift.open && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelected(shift)}
                      >
                        <LogOut aria-hidden="true" /> Tutup shift
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!records.pending && !records.error && !records.items.length && (
            <p className="empty">Belum ada shift untuk filter ini.</p>
          )}
        </div>
        <HistoryControls records={records} />
      </Card>
      <CloseStaffShift
        shift={selected}
        connected={c}
        onClose={() => {
          setSelected(null);
          records.retry();
        }}
      />
    </>
  );
}
