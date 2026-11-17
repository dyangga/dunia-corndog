"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Connection } from "@/lib/connection";
import type { Shift } from "@dc/contracts";
import { BusinessDialog, Field, BusinessSelect } from "./business-ui";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { CheckCheck, ReceiptText, RotateCcw, LogOut } from "lucide-react";
import { useConfirmation } from "./confirmation";
export function OwnerRequests({
  connected: c,
  onOrder,
}: {
  connected: Connection;
  onOrder: (id: string) => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirmation();
  const data = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      c.request<{
        requests: {
          id: string;
          message: string;
          kind: string;
          branch_id: string;
          order_id?: string;
        }[];
      }>("/notifications"),
    refetchInterval: 20000,
  });
  return (
    <Card className="panel inventory-tools">
      <h2>Laporan & permintaan kasir</h2>
      {data.data?.requests.map((r) => (
        <div className="request-row" key={r.id}>
          <div>
            <b>
              {r.kind === "REFUND" ? "Permintaan refund" : "Masalah stok"} ·{" "}
              {c.state.branches.find((b) => b.id === r.branch_id)?.name}
            </b>
            <p>{r.message}</p>
          </div>
          <div className="button-group">
            {r.order_id && (
              <Button variant="outline" onClick={() => onOrder(r.order_id!)}>
                <ReceiptText aria-hidden="true" /> Lihat transaksi
              </Button>
            )}
            <Button
              variant="soft"
              onClick={() =>
                confirm({
                  title: "Tandai laporan sudah ditinjau?",
                  description: `${r.kind === "REFUND" ? "Permintaan refund" : "Masalah stok"} dari ${c.state.branches.find((b) => b.id === r.branch_id)?.name || "cabang"}: “${r.message}”. Laporan akan keluar dari daftar menunggu. Aksi ini hanya menandai peninjauan; proses refund atau koreksi stok dilakukan terpisah.`,
                  confirmLabel: "Tandai ditinjau",
                  action: async () => {
                    await c.request(`/requests/${r.id}`, {
                      method: "PATCH",
                      body: { resolved: true },
                    });
                    await qc.invalidateQueries({ queryKey: ["notifications"] });
                  },
                })
              }
            >
              <CheckCheck aria-hidden="true" /> Tandai ditinjau
            </Button>
          </div>
        </div>
      ))}
      {data.data?.requests.length === 0 && (
        <p className="menu-flow-hint">
          Belum ada laporan yang menunggu ditinjau.
        </p>
      )}
      {data.error && <p role="alert">{data.error.message}</p>}
    </Card>
  );
}
export function RefundRestock({
  orderId,
  connected: c,
}: {
  orderId: string;
  connected: Connection;
}) {
  const data = useQuery({
    queryKey: ["consumption", orderId],
    queryFn: () =>
      c.request<
        { item_id: string; name: string; unit: string; quantity: string }[]
      >(`/orders/${orderId}/consumption`),
  });
  return (
    <details className="refund-restock">
      <summary>Pulihkan stok yang belum digunakan</summary>
      <p className="menu-flow-hint">
        Kosongkan untuk refund tanpa restock. Hanya pulihkan bahan/produk yang
        benar-benar masih layak dan belum dipakai.
      </p>
      {data.data?.map((i) => (
        <Field
          key={i.item_id}
          label={`${i.name} · maks. ${Number(i.quantity)} ${i.unit}`}
        >
          <Input
            name={`restock-${i.item_id}`}
            type="number"
            min={0}
            max={i.quantity}
            step="0.001"
            placeholder="Tidak dipulihkan"
          />
        </Field>
      ))}
      {data.error && <p role="alert">{data.error.message}</p>}
    </details>
  );
}
export function CloseStaffShift({
  shift,
  connected: c,
  onClose,
}: {
  shift: Shift | null;
  connected: Connection;
  onClose: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState("");
  useEffect(() => {
    setKey(crypto.randomUUID());
    setError("");
  }, [shift?.id]);
  return (
    <BusinessDialog
      open={!!shift}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title="Tutup shift kasir"
      description={
        shift
          ? `${shift.cashier} · Hitung uang fisik kasir sebelum menutup shift.`
          : ""
      }
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await c.request(`/shifts/${shift!.id}/close`, {
              method: "POST",
              body: { actual: Number(f.get("actual")) },
              key,
            });
            await c.refresh();
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Kas aktual di laci (Rp)">
          <Input name="actual" type="number" min={0} step={1} required />
        </Field>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Button disabled={busy}>
          <LogOut aria-hidden="true" />{" "}
          {busy ? "Menyimpan…" : "Konfirmasi tutup shift"}
        </Button>
      </form>
    </BusinessDialog>
  );
}

export function ExpenseCorrections({
  connected: c,
}: {
  connected: Connection;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState("");
  useEffect(() => setKey(crypto.randomUUID()), []);
  return (
    <Card className="panel inventory-tools">
      <details>
        <summary>Koreksi pengeluaran</summary>
        <p className="menu-flow-hint">
          Pengeluaran asli tetap disimpan. Koreksi dicatat pada tanggal sekarang
          dan tidak mengubah kas shift yang sudah ditutup.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await c.request(`/expenses/${f.get("expense")}/reverse`, {
                method: "POST",
                body: { reason: f.get("reason") },
                key,
              });
              setKey(crypto.randomUUID());
              await c.refresh();
              setError("Koreksi berhasil dicatat.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Pengeluaran yang dikoreksi">
            <BusinessSelect
              name="expense"
              options={c.state.expenses
                .filter((e) => !e.reversed)
                .map((e) => ({
                  value: e.id,
                  label: `${e.date} · ${e.name} · Rp${e.amount}`,
                }))}
            />
          </Field>
          <Field label="Alasan koreksi">
            <Input name="reason" minLength={5} maxLength={500} required />
          </Field>
          <Button
            variant="destructive"
            disabled={busy || !c.state.expenses.some((e) => !e.reversed)}
          >
            <RotateCcw aria-hidden="true" />{" "}
            {busy ? "Menyimpan…" : "Catat koreksi"}
          </Button>
          {error && <p role="status">{error}</p>}
        </form>
      </details>
    </Card>
  );
}
