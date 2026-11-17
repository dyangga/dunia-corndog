import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/components/app";
import { seed } from "./setup";
import type { Connection } from "@/lib/connection";
it("preserves the stock-count version captured at start even after a polling refresh", async () => {
  const user = userEvent.setup();
  const state = seed();
  state.stocks = state.stocks.map((s) => ({
    ...s,
    id: `${s.branch}:${s.id}`,
    version: 1,
  }));
  const request = vi.fn(async (path: string) =>
    path.startsWith("/reports")
      ? {
          gross: 0,
          refunds: 0,
          net: 0,
          cogs: 0,
          opex: 0,
          profit: 0,
          stockLoss: 0,
          cashFlow: 0,
        }
      : path.startsWith("/catalog")
        ? { products: [], modifiers: [] }
        : [],
  );
  const connected: Connection = {
    state,
    user: {
      id: "owner",
      name: "Owner",
      username: "owner",
      role: "OWNER",
      businessId: "business",
      branches: [],
    },
    request: request as Connection["request"],
    refresh: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    updatedAt: Date.now(),
    stale: false,
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (c: Connection) => (
    <QueryClientProvider client={qc}>
      <App initialPage="inventory" connected={c} />
    </QueryClientProvider>
  );
  const rendered = render(view(connected));
  await user.click(await screen.findByRole("tab", { name: "Opname & waste" }));
  await user.click(screen.getByRole("button", { name: "Mulai opname" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Hitung stok fisik",
  });
  rendered.rerender(
    view({
      ...connected,
      state: {
        ...state,
        stocks: state.stocks.map((s) => ({ ...s, qty: s.qty + 1, version: 2 })),
      },
    }),
  );
  await user.type(
    within(dialog).getByLabelText("Jumlah hasil hitung fisik (satuan dasar)"),
    "3",
  );
  await user.type(
    within(dialog).getByPlaceholderText(
      "Jelaskan alasan pencatatan (minimal 5 karakter)",
    ),
    "Hasil hitung fisik setelah mulai opname",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Konfirmasi stok opname" }),
  );
  await waitFor(() =>
    expect(
      request.mock.calls.some(([path]) => path === "/inventory/count"),
    ).toBe(true),
  );
  const call = (
    request.mock.calls as unknown as [string, { body: { version: number } }][]
  ).find(([path]) => path === "/inventory/count")!;
  expect(call[1].body.version).toBe(1);
  qc.clear();
});
