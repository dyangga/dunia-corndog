import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/components/app";
import { seed } from "./setup";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { SalesTrend } from "@/components/sales-trend";
import { OwnerTransactions } from "@/components/owner-transactions";
import { useOwnerReport } from "@/hooks/use-owner-report";
import type { Connection } from "@/lib/connection";
import type { ReportOverview, Order } from "@dc/contracts";
const overview: ReportOverview = {
  totals: {
    from: "2030-01-01",
    to: "2030-01-02",
    branchId: null,
    gross: 5000,
    refunds: 10000,
    net: -5000,
    cogs: 0,
    opex: 0,
    stockLoss: 0,
    profit: -5000,
    cashFlow: 0,
    count: 1,
  },
  daily: [],
  products: [],
  modifiers: [],
  payments: [],
  branches: [],
  recentOrders: [],
};
function connection(request: Connection["request"]): Connection {
  return {
    request: (path: string, options?: unknown) =>
      path.startsWith("/owner/expenses") || path.startsWith("/owner/shifts")
        ? Promise.resolve({ items: [], nextCursor: null })
        : request(path, options as Parameters<Connection["request"]>[1]),
    updatedAt: 1,
  } as Connection;
}
afterEach(() => vi.restoreAllMocks());

describe("owner report correctness", () => {
  it("renders an area chart with a zero reference and exposes signed daily figures", async () => {
    // jsdom has no layout engine; give ResponsiveContainer its measured viewport.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 640, 280),
    );
    const user = userEvent.setup();
    const { container } = render(
      <SalesTrend
        from="2030-01-01"
        to="2030-01-02"
        data={[
          { date: "2030-01-01", gross: 5000, refunds: 0, net: 5000 },
          { date: "2030-01-02", gross: 0, refunds: 10000, net: -10000 },
        ]}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector(".recharts-area-curve")).not.toBeNull(),
    );
    expect(container.querySelector(".recharts-reference-line")).not.toBeNull();
    screen
      .getByRole("application", { name: "Tren penjualan neto harian" })
      .focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await waitFor(() =>
      expect(
        container.querySelector(".recharts-tooltip-wrapper")?.textContent,
      ).toContain("Penjualan bruto"),
    );
    expect(
      container.querySelector(".recharts-tooltip-wrapper")?.textContent,
    ).toContain("Refund");
    await user.click(screen.getByText("Lihat data harian"));
    const table = screen.getByRole("table", {
      name: "Rincian penjualan dan refund harian",
    });
    expect(within(table).getByText("-Rp10.000")).toBeTruthy();
    expect(within(table).getAllByText("Rp10.000")).toHaveLength(1);
  });
  it("preserves loaded totals during refresh failure and hides previous-filter data", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(overview)
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementation(() => new Promise(() => {}));
    const c = connection(mock as Connection["request"]);
    const { result, rerender } = renderHook(
      ({ branch, stamp }) =>
        useOwnerReport(
          { ...c, updatedAt: stamp },
          "2030-01-01",
          "2030-01-02",
          branch,
          true,
        ),
      { initialProps: { branch: "all", stamp: 1 } },
    );
    await waitFor(() => expect(result.current.data?.totals.net).toBe(-5000));
    rerender({ branch: "all", stamp: 2 });
    await waitFor(() => expect(result.current.error).toBe("offline"));
    expect(result.current.data?.totals.net).toBe(-5000);
    rerender({ branch: "another", stamp: 2 });
    expect(result.current.data).toBeUndefined();
    expect(result.current.pending).toBe(true);
  });
  it("paginates bounded server rows and carries filters to subsequent pages", async () => {
    const row = (id: string) => ({ id, number: id }) as Order;
    const mock = vi
      .fn()
      .mockResolvedValueOnce({ items: [row("first")], nextCursor: "42" })
      .mockResolvedValueOnce({ items: [row("second")], nextCursor: null });
    const c = connection(mock as Connection["request"]);
    const user = userEvent.setup();
    render(
      <OwnerTransactions
        connection={c}
        from="2030-01-01"
        to="2030-01-02"
        branch="branch-id"
        method="Refund"
        search=""
        renderTable={(items) => (
          <ul>
            {items.map((o) => (
              <li key={o.id}>{o.number}</li>
            ))}
          </ul>
        )}
      />,
    );
    await screen.findByText("first");
    await user.click(screen.getByRole("button", { name: "Berikutnya" }));
    await screen.findByText("second");
    const url = new URL(mock.mock.calls[1][0], "http://test");
    expect(url.searchParams.get("cursor")).toBe("42");
    expect(url.searchParams.get("branchId")).toBe("branch-id");
    expect(url.searchParams.get("method")).toBe("Refund");
    expect(screen.getByText(/Halaman 2 · Data server/)).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Berikutnya" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
  it("shows unavailable KPI values rather than false zero when initial report loading fails", async () => {
    const c = {
      ...connection(
        vi
          .fn()
          .mockRejectedValue(new Error("offline")) as Connection["request"],
      ),
      state: seed(),
      user: { name: "Owner", role: "OWNER" },
    } as Connection;
    const { container } = render(<App initialPage="dashboard" connected={c} />);
    await screen.findByRole("button", { name: "Coba lagi laporan" });
    expect(
      [...container.querySelectorAll(".metrics .metric > strong")].map(
        (e) => e.textContent,
      ),
    ).toEqual(["—", "—", "—", "—"]);
    expect(
      screen.getByText("Grafik belum tersedia karena laporan gagal dimuat."),
    ).toBeTruthy();
  });
  it.each(["dashboard", "reports", "expenses"])(
    "keeps KPI cards mounted through first load and refresh on %s",
    async (page) => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 640, 280),
      );
      let resolveFirst!: (value: ReportOverview) => void,
        resolveRefresh!: (value: ReportOverview) => void;
      const first = new Promise<ReportOverview>((resolve) => {
        resolveFirst = resolve;
      });
      const second = new Promise<ReportOverview>((resolve) => {
        resolveRefresh = resolve;
      });
      const mock = vi
        .fn()
        .mockReturnValueOnce(first)
        .mockReturnValueOnce(second);
      const c = {
        ...connection(mock as Connection["request"]),
        state: seed(),
        user: { name: "Owner", role: "OWNER" },
      } as Connection;
      const qc = new QueryClient();
      const view = (stamp: number) => (
        <QueryClientProvider client={qc}>
          <App initialPage={page} connected={{ ...c, updatedAt: stamp }} />
        </QueryClientProvider>
      );
      const { container, rerender } = render(view(1));
      const metrics = container.querySelector(".metrics")!;
      const card = metrics.firstElementChild;
      expect(metrics.getAttribute("aria-busy")).toBe("true");
      expect(metrics.querySelectorAll(".metric")).toHaveLength(
        page === "expenses" ? 3 : 4,
      );
      // Loading text must never enter normal flow above the cards.
      const assertNoBannerBeforeCards = () => {
        for (const feedback of container.querySelectorAll(".report-feedback")) {
          expect(
            Boolean(
              feedback.compareDocumentPosition(metrics) &
              Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          ).toBe(false);
        }
      };
      assertNoBannerBeforeCards();
      await act(async () => {
        resolveFirst(overview);
        await first;
      });
      await waitFor(() =>
        expect(metrics.getAttribute("aria-busy")).toBe("false"),
      );
      expect(container.querySelector(".metrics")).toBe(metrics);
      expect(metrics.firstElementChild).toBe(card);
      const amounts = [...metrics.querySelectorAll("strong")].map(
        (e) => e.textContent,
      );
      rerender(view(2));
      await waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
      expect(metrics.getAttribute("aria-busy")).toBe("true");
      expect(
        [...metrics.querySelectorAll("strong")].map((e) => e.textContent),
      ).toEqual(amounts);
      expect(
        container.querySelector(".last-updated-label")?.textContent,
      ).toContain("Memperbarui laporan");
      assertNoBannerBeforeCards();
      await act(async () => {
        resolveRefresh(overview);
        await second;
      });
      await waitFor(() =>
        expect(metrics.getAttribute("aria-busy")).toBe("false"),
      );
      expect(metrics.firstElementChild).toBe(card);
      qc.clear();
    },
  );
  it("keeps cached KPI values when returning from the catalogue to financial reports", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 640, 280),
    );
    const mock = vi
      .fn()
      .mockResolvedValueOnce(overview)
      .mockImplementation(() => new Promise(() => {}));
    const c = {
      ...connection(mock as Connection["request"]),
      state: seed(),
      user: { name: "Owner", role: "OWNER" },
    } as Connection;
    const user = userEvent.setup();
    const { container } = render(<App initialPage="dashboard" connected={c} />);
    await waitFor(() =>
      expect(
        container.querySelector(".metrics")?.getAttribute("aria-busy"),
      ).toBe("false"),
    );
    await user.click(screen.getByRole("button", { name: "Katalog menu" }));
    await user.click(screen.getByRole("button", { name: "Laporan keuangan" }));
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
    const metrics = container.querySelector(".metrics")!;
    expect(metrics.querySelector("strong")?.textContent).toBe("-Rp5.000");
    expect(metrics.getAttribute("aria-busy")).toBe("true");
    expect(
      container.querySelector(".last-updated-label")?.textContent,
    ).toContain("Memperbarui laporan");
  });
  it("shares unchanged report data across polling refreshes for memoized charts", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(overview)
      .mockResolvedValueOnce(structuredClone(overview));
    const c = connection(request as Connection["request"]);
    const { result, rerender } = renderHook(
      ({ stamp }) =>
        useOwnerReport(
          { ...c, updatedAt: stamp },
          "2030-01-01",
          "2030-01-02",
          "all",
          true,
        ),
      { initialProps: { stamp: 1 } },
    );
    await waitFor(() => expect(result.current.pending).toBe(false));
    const first = result.current.data;
    rerender({ stamp: 2 });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.data).toBe(first);
    expect(result.current.data?.daily).toBe(first?.daily);
  });
});
