import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, within, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/components/app";
import InventoryToolsShell from "@/components/inventory-tools-shell";
import { ConfirmationProvider } from "@/components/confirmation";
import { CatalogPage } from "@/components/catalog-page";
import { ExpenseHistory } from "@/components/owner-history";
import { seed } from "./setup";
import type { Connection } from "@/lib/connection";
function connected(request: unknown): Connection {
  return {
    state: seed(),
    request,
    updatedAt: 1,
    refresh: async () => {},
    user: { id: "owner", role: "OWNER" },
  } as Connection;
}
it("keeps catalogue DOM bounded and searching local to the page", async () => {
  const user = userEvent.setup();
  const sample = seed().products[0];
  const products = Array.from({ length: 150 }, (_, i) => ({
    ...sample,
    id: "item-" + i,
    name: "Isian " + String(i).padStart(3, "0"),
  }));
  let parentRenders = 0;
  const edit = vi.fn(),
    toggle = vi.fn();
  function Parent() {
    parentRenders++;
    return (
      <CatalogPage
        products={products}
        connected
        onEdit={edit}
        onToggle={toggle}
      />
    );
  }
  const { container } = render(
    <ConfirmationProvider>
      <Parent />
    </ConfirmationProvider>,
  );
  expect(container.querySelectorAll(".menu-card")).toHaveLength(25);
  await user.click(screen.getByRole("button", { name: "Berikutnya" }));
  expect(screen.getByText("Isian 025")).toBeTruthy();
  expect(container.querySelectorAll(".menu-card")).toHaveLength(25);
  await user.type(screen.getByLabelText("Cari nama menu"), "149");
  await waitFor(() =>
    expect(container.querySelectorAll(".menu-card")).toHaveLength(1),
  );
  expect(screen.getByText("Isian 149")).toBeTruthy();
  expect(parentRenders).toBe(1);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  expect(edit).toHaveBeenCalledWith(products[149]);
});
it("loads only the selected inventory tool and preserves drafts when its dialog is closed", async () => {
  const user = userEvent.setup(),
    request = vi.fn(async (path: string) =>
      path.startsWith("/catalog") ? { products: [], modifiers: [] } : [],
    );
  const c = connected(request),
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={qc}>
      <InventoryToolsShell connected={c} />
    </QueryClientProvider>,
  );
  expect(request).not.toHaveBeenCalled();
  expect(container.querySelector("details")).toBeNull();
  const add = screen.getByRole("button", { name: "Tambah bahan" });
  await user.click(add);
  let dialog = await screen.findByRole("dialog", {
    name: "Tambah bahan / produk jadi",
  });
  expect(dialog.querySelector('[data-slot="scroll-area"]')).not.toBeNull();
  expect(within(dialog).queryByLabelText("Cabang resep")).toBeNull();
  expect(request).not.toHaveBeenCalled();
  await user.type(
    within(dialog).getByLabelText("Nama item stok"),
    "Bahan sementara",
  );
  await user.type(within(dialog).getByLabelText("Satuan dasar"), "pcs");
  await user.click(
    within(dialog).getByRole("button", { name: "Tutup dialog" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(add));
  await user.click(screen.getByRole("button", { name: "Atur resep" }));
  dialog = await screen.findByRole("dialog", { name: "Atur resep" });
  await waitFor(() =>
    expect(request.mock.calls.some(([p]) => p === "/recipes")).toBe(true),
  );
  expect(
    request.mock.calls.some(
      ([p]) => p.startsWith("/catalog") || p.startsWith("/modifier-recipes"),
    ),
  ).toBe(false);
  expect(within(dialog).queryByLabelText("Nama item stok")).toBeNull();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const calls = request.mock.calls.length;
  await act(async () => {
    await qc.invalidateQueries({ queryKey: ["recipes"] });
  });
  expect(request.mock.calls.length).toBe(calls);
  await user.click(add);
  expect(
    ((await screen.findByLabelText("Nama item stok")) as HTMLInputElement)
      .value,
  ).toBe("Bahan sementara");
  expect(
    (screen.getByLabelText("Satuan dasar") as HTMLInputElement).value,
  ).toBe("pcs");
  qc.clear();
});
it("reuses the correction key after a failed request and targets the original expense", async () => {
  const user = userEvent.setup();
  let reversal = 0;
  const request = vi.fn(async (path: string) => {
    if (path.startsWith("/owner/expenses"))
      return {
        items: [
          {
            id: "expense-1",
            originalId: "expense-1",
            name: "Sewa uji",
            category: "Sewa",
            amount: 1000,
            branch: "b1",
            date: "2030-01-01",
            method: "Transfer",
            reversed: false,
          },
        ],
        nextCursor: null,
      };
    if (path === "/expenses/expense-1/reverse") {
      reversal++;
      if (reversal === 1) throw Error("Respons terputus");
      return { ok: true };
    }
    throw Error("Unexpected path " + path);
  });
  render(
    <ExpenseHistory
      connected={connected(request)}
      from="2030-01-01"
      to="2030-01-01"
      branch="all"
    />,
  );
  await user.click(await screen.findByRole("button", { name: "Koreksi" }));
  await user.type(
    screen.getByLabelText("Alasan koreksi"),
    "Duplikat pencatatan",
  );
  await user.click(screen.getByRole("button", { name: "Catat koreksi" }));
  await screen.findByRole("alert");
  await user.click(screen.getByRole("button", { name: "Catat koreksi" }));
  await waitFor(() => expect(reversal).toBe(2));
  const writes = (
    request.mock.calls as unknown as [string, { key: string }][]
  ).filter(([path]) => path.endsWith("/reverse"));
  expect(writes[0][1].key).toBeTruthy();
  expect(writes[1][1].key).toBe(writes[0][1].key);
});

it("keeps minimum and production drafts separate and submits their original API payloads", async () => {
  const user = userEvent.setup();
  const request = vi.fn(async (path: string, options?: unknown) => {
    if (options) return { ok: true };
    if (path.startsWith("/inventory?"))
      return [{ id: "raw-1", name: "Tepung", unit: "g", kind: "RAW" }];
    if (path === "/recipes")
      return [
        {
          id: "recipe-1",
          mode: "READY_STOCK",
          product_name: "Sosis",
          size: "Small",
          branch_id: "b1",
          components: [],
        },
      ];
    return [];
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <InventoryToolsShell connected={connected(request)} />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Batas stok minimum" }));
  let dialog = await screen.findByRole("dialog", {
    name: "Batas stok minimum",
  });
  await waitFor(() =>
    expect(
      within(dialog).getByRole("combobox", { name: "Item stok" }).textContent,
    ).toContain("Tepung (g)"),
  );
  await user.type(within(dialog).getByLabelText("Jumlah minimum"), "15.5");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(screen.getByRole("button", { name: "Posting produksi" }));
  dialog = await screen.findByRole("dialog", { name: "Posting produksi" });
  await waitFor(() =>
    expect(
      within(dialog).getByRole("combobox", { name: "Resep produk siap jual" })
        .textContent,
    ).toContain("Dipatiukur · Sosis Small"),
  );
  await user.type(within(dialog).getByLabelText("Jumlah rencana"), "10");
  await user.type(
    within(dialog).getByLabelText("Hasil aktual layak jual"),
    "8",
  );
  await user.type(
    within(dialog).getByLabelText("Catatan produksi"),
    "Hasil produksi uji",
  );
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(screen.getByRole("button", { name: "Batas stok minimum" }));
  dialog = await screen.findByRole("dialog", { name: "Batas stok minimum" });
  expect(
    (within(dialog).getByLabelText("Jumlah minimum") as HTMLInputElement).value,
  ).toBe("15.5");
  await user.click(
    within(dialog).getByRole("button", { name: "Simpan batas minimum" }),
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "/inventory/raw-1/minimum",
      expect.objectContaining({
        method: "PATCH",
        body: { branchId: "b1", minimum: "15.5" },
      }),
    ),
  );
  await waitFor(() =>
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Tutup dialog",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(screen.getByRole("button", { name: "Posting produksi" }));
  dialog = await screen.findByRole("dialog", { name: "Posting produksi" });
  expect(
    (within(dialog).getByLabelText("Jumlah rencana") as HTMLInputElement).value,
  ).toBe("10");
  expect(
    (
      within(dialog).getByLabelText(
        "Hasil aktual layak jual",
      ) as HTMLInputElement
    ).value,
  ).toBe("8");
  expect(
    (within(dialog).getByLabelText("Catatan produksi") as HTMLInputElement)
      .value,
  ).toBe("Hasil produksi uji");
  await user.click(
    within(dialog).getByRole("button", { name: "Posting produksi" }),
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "/production",
      expect.objectContaining({
        method: "POST",
        key: expect.any(String),
        body: {
          recipeId: "recipe-1",
          quantity: 10,
          actual: 8,
          note: "Hasil produksi uji",
        },
      }),
    ),
  );
  qc.clear();
});

it("keeps the inventory dialog open while a write is pending and refreshes after saving", async () => {
  const user = userEvent.setup();
  let finish!: () => void;
  const request = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const c = { ...connected(request), refresh: vi.fn(async () => {}) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <InventoryToolsShell connected={c} />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Tambah bahan" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Tambah bahan / produk jadi",
  });
  await user.type(
    within(dialog).getByLabelText("Nama item stok"),
    "Tepung baru",
  );
  await user.type(within(dialog).getByLabelText("Satuan dasar"), "g");
  await user.click(within(dialog).getByRole("button", { name: "Tambah item" }));
  expect(request).toHaveBeenCalledExactlyOnceWith(
    "/inventory/items",
    expect.objectContaining({
      method: "POST",
      body: { name: "Tepung baru", unit: "g", kind: "RAW" },
    }),
  );
  expect(
    (
      within(dialog).getByRole("button", {
        name: "Menyimpan…",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    (
      within(dialog).getByRole("button", {
        name: "Tutup dialog",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBe(dialog);
  await act(async () => finish());
  await waitFor(() => expect(c.refresh).toHaveBeenCalledTimes(1));
  await user.click(
    within(dialog).getByRole("button", { name: "Tutup dialog" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  qc.clear();
});

it("places inventory actions in the page header and opens production from its contextual button", async () => {
  const user = userEvent.setup();
  const request = vi.fn(async () => []);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={qc}>
      <App initialPage="inventory" connected={connected(request)} />
    </QueryClientProvider>,
  );
  const heading = container.querySelector(".page-heading") as HTMLElement;
  for (const label of [
    "Tambah bahan",
    "Atur resep",
    "Batas stok minimum",
    "Posting produksi",
  ]) {
    expect(within(heading).getByRole("button", { name: label })).toBeTruthy();
  }
  expect(container.querySelector(".panel.inventory-tools")).toBeNull();
  await user.click(await screen.findByRole("tab", { name: "Produksi" }));
  const trigger = screen.getByRole("button", { name: "Catat produksi" });
  await user.click(trigger);
  const dialog = await screen.findByRole("dialog", {
    name: "Posting produksi",
  });
  expect(within(dialog).getByLabelText("Resep produk siap jual")).toBeTruthy();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  qc.clear();
});
