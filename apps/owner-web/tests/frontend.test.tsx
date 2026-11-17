import React from "react";
import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/components/app";
import { FocusModality } from "@/components/focus-modality";
import { BusinessSelect, Field } from "@/components/business-ui";
import { seed } from "./setup";

describe("shadcn/ui integration", () => {
  it("renders registry components on the owner dashboard", () => {
    const { container } = render(<App />);
    for (const slot of [
      "button",
      "card",
      "card-header",
      "table",
      "table-row",
      "table-head",
      "table-cell",
      "badge",
    ])
      expect(
        container.querySelector(`[data-slot="${slot}"]`),
        slot,
      ).not.toBeNull();
    expect(
      screen.getByRole("combobox", { name: "Filter cabang" }),
    ).toBeTruthy();
    expect(container.querySelector(".workspace")).toBeNull();
  });
  it("keeps branch and period filters working through Select", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("combobox", { name: "Filter cabang" }));
    await user.click(await screen.findByRole("option", { name: "Antapani" }));
    expect(
      screen.getByRole("combobox", { name: "Filter cabang" }).textContent,
    ).toContain("Antapani");
    await user.click(screen.getByRole("combobox", { name: "Periode laporan" }));
    await user.click(
      await screen.findByRole("option", { name: "Hari ini, 10 Nov" }),
    );
    const sample = seed().orders.filter(
      (o) => o.branch === "b2" && o.date === "2026-11-10",
    );
    expect(
      screen.getByText(`${sample.length} transaksi dalam periode`),
    ).toBeTruthy();
  });
  it("preserves named values when Select submits FormData, including defaults", async () => {
    const user = userEvent.setup();
    let result: FormData | undefined;
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          result = new FormData(e.currentTarget);
        }}
      >
        <Field label="Cabang">
          <BusinessSelect
            name="branch"
            options={[
              { value: "b1", label: "Dipatiukur" },
              { value: "b2", label: "Antapani" },
            ]}
          />
        </Field>
        <button type="submit">Simpan</button>
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "Simpan" }));
    expect(result?.get("branch")).toBe("b1");
    await user.click(screen.getByRole("combobox", { name: "Cabang" }));
    await user.click(await screen.findByRole("option", { name: "Antapani" }));
    await user.click(screen.getByRole("button", { name: "Simpan" }));
    expect(result?.get("branch")).toBe("b2");
  });
  it("filters menu with keyboard-accessible Tabs and keeps tab-panel links", async () => {
    const user = userEvent.setup();
    render(<App initialPage="catalog" />);
    await user.click(screen.getByRole("tab", { name: "Gurih pedas" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Full sosis")).toBeTruthy();
    expect(within(panel).queryByText("Beng-beng")).toBeNull();
    const tab = screen.getByRole("tab", { name: "Gurih pedas" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(panel.id).toBe(tab.getAttribute("aria-controls"));
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(
        screen
          .getByRole("tab", { name: "Manis" })
          .getAttribute("aria-selected"),
      ).toBe("true"),
    );
  });
  it("saves an owner filling with size-specific prices and offers it in the cashier", async () => {
    const user = userEvent.setup();
    const owner = render(<App initialPage="catalog" />);
    await user.click(screen.getByRole("button", { name: "Tambah isian" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Tambah isian corndog",
    });
    await user.click(
      within(dialog).getByRole("combobox", { name: "Kategori isian" }),
    );
    await user.click(await screen.findByRole("option", { name: "Manis" }));
    await user.type(
      within(dialog).getByLabelText("Nama isian corndog"),
      "Pisang cokelat",
    );
    await user.type(within(dialog).getByLabelText("Medium"), "6500");
    await user.clear(within(dialog).getByLabelText("Stok awal isian (porsi)"));
    await user.type(
      within(dialog).getByLabelText("Stok awal isian (porsi)"),
      "12",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Simpan simulasi" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const saved = JSON.parse(localStorage.getItem("dc-demo-v1")!);
    expect(saved.products.at(-1)).toMatchObject({
      name: "Pisang cokelat",
      category: "Manis",
      prices: { Medium: 6500 },
      stock: 12,
      potatoNoodleAllowed: false,
    });
    owner.unmount();
    render(<App initialPage="pos" />);
    await user.click(screen.getByRole("button", { name: /^Medium/ }));
    const options = await screen.findByRole("dialog");
    await user.click(within(options).getByRole("button", { name: "Manis" }));
    await user.click(
      within(options).getByRole("button", { name: /^Pisang cokelat/ }),
    );
    await user.click(within(options).getByRole("button", { name: /^Cokelat/ }));
    await user.click(
      within(options).getByRole("button", { name: /^Keju parut/ }),
    );
    expect(
      within(options).getByRole("button", { name: "Tambah · Rp7.500" }),
    ).toBeTruthy();
    expect(
      within(options).queryByRole("button", { name: /^Kentang/ }),
    ).toBeNull();
    await user.click(
      within(options).getByRole("button", { name: "Gurih pedas" }),
    );
    expect(
      within(options).queryByRole("button", { name: /^Keju parut/ }),
    ).toBeNull();
    expect(
      within(options).getByRole("button", { name: "Tambah · Rp7.000" }),
    ).toBeTruthy();
  });
  it("opens and closes the mobile Sheet, including navigation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Buka navigasi" }));
    const sheet = await screen.findByRole("dialog", {
      name: "Navigasi ruang usaha",
    });
    expect(sheet.getAttribute("data-slot")).toBe("sheet-content");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Buka navigasi" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Katalog menu",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Katalog menu",
    );
  });
  it("records a demo expense using the migrated Dialog and form controls", async () => {
    const user = userEvent.setup();
    render(<App initialPage="expenses" />);
    await user.click(screen.getByRole("button", { name: "Catat pengeluaran" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Catat pengeluaran",
    });
    expect(dialog.getAttribute("data-slot")).toBe("dialog-content");
    await user.type(
      within(dialog).getByLabelText("Keterangan"),
      "Pengeluaran uji UI",
    );
    await user.type(
      within(dialog).getByLabelText("Jumlah pengeluaran (Rp)"),
      "50000",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Simpan simulasi" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Pengeluaran uji UI")).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem("dc-demo-v1")!);
    expect(saved.expenses.at(-1)).toMatchObject({
      branch: "b1",
      category: "Utilitas",
      amount: 50000,
      method: "Transfer",
    });
  });
  it("completes cash checkout and creates a receipt after item customization", async () => {
    const user = userEvent.setup();
    render(<App initialPage="pos" />);
    await user.click(screen.getByRole("button", { name: /^Small/ }));
    let dialog = await screen.findByRole("dialog", {
      name: "Small Corndog",
    });
    expect(within(dialog).queryByRole("group", { name: "Lapisan" })).toBeNull();
    const extras = within(dialog).getByRole("group", {
      name: "Extra topping · berbayar, opsional",
    });
    await user.click(within(extras).getByRole("button", { name: /^Kentang/ }));
    await user.click(within(extras).getByRole("button", { name: /^Mie/ }));
    expect(
      within(dialog).getByRole("button", { name: "Tambah · Rp5.000" }),
    ).toBeTruthy();
    await user.click(within(extras).getByRole("button", { name: /^Mie/ }));
    await user.click(
      within(dialog).getByRole("button", { name: /^Saus tomat/ }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: /^Saus keju/ }),
    );
    await user.click(within(dialog).getByRole("button", { name: /Tambah ·/ }));
    await user.click(screen.getByRole("button", { name: "Lanjut pembayaran" }));
    dialog = await screen.findByRole("dialog", {
      name: "Selesaikan pembayaran",
    });
    const confirm = within(dialog).getByRole("button", {
      name: "Konfirmasi pembayaran demo",
    });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    await user.type(
      within(dialog).getByLabelText("Uang diterima (Rp)"),
      "20000",
    );
    await user.click(confirm);
    const receipt = await screen.findByRole("dialog", {
      name: "Pesanan berhasil dicatat",
    });
    expect(within(receipt).getByText("Lunas · Demo")).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem("dc-demo-v1")!);
    expect(saved.orders.at(-1).lines[0]).toMatchObject({
      size: "Small",
      coating: "Panir",
      toppings: ["Saus tomat"],
      extraToppings: ["Kentang", "Saus keju"],
      price: 5000,
    });
    expect(saved.orders.at(-1)).toMatchObject({
      total: 5000,
      received: 20000,
      method: "Tunai",
      status: "Antrean",
    });
  });
  it("requires explicit confirmation for manually recorded non-cash payment", async () => {
    const user = userEvent.setup();
    render(<App initialPage="pos" />);
    await user.click(screen.getByRole("button", { name: /^Small/ }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /Tambah ·/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Lanjut pembayaran" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Selesaikan pembayaran",
    });
    await user.click(within(dialog).getByRole("button", { name: "QRIS" }));
    const confirm = within(dialog).getByRole("button", {
      name: "Konfirmasi pembayaran demo",
    });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    const checkbox = within(dialog).getByRole("checkbox", {
      name: /Saya sudah memeriksa/,
    });
    await user.click(checkbox);
    expect(checkbox.getAttribute("data-state")).toBe("checked");
    await user.click(confirm);
    expect(
      await screen.findByRole("dialog", { name: "Pesanan berhasil dicatat" }),
    ).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("dc-demo-v1")!).orders.at(-1).method,
    ).toBe("QRIS");
  });
});

describe("sidebar motion and accessibility", () => {
  it("preserves page content and scroll positions when toggling the sidebar", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const viewport = container.querySelector<HTMLElement>(
      ".content-scroll [data-slot='scroll-area-viewport']",
    )!;
    const metric = container.querySelector(".metric")!;
    const transaction = container.querySelector(
      ".transactions-panel tbody tr",
    )!;
    const tableScroll = container.querySelector<HTMLElement>(
      ".transactions-panel .table-scroll",
    )!;
    const url = location.href;
    viewport.scrollTop = 580;
    tableScroll.scrollLeft = 56;

    for (const name of ["Tutup sidebar", "Buka sidebar"]) {
      await user.click(screen.getByRole("button", { name }));
      expect(container.querySelector(".metric")).toBe(metric);
      expect(container.querySelector(".transactions-panel tbody tr")).toBe(
        transaction,
      );
      expect(
        container.querySelector(
          ".content-scroll [data-slot='scroll-area-viewport']",
        ),
      ).toBe(viewport);
      expect(viewport.scrollTop).toBe(580);
      expect(tableScroll.isConnected).toBe(true);
      expect(tableScroll.scrollLeft).toBe(56);
      expect(location.href).toBe(url);
    }
    (transaction as HTMLElement).focus();
    expect(document.activeElement).toBe(transaction);
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");
    await user.click(transaction);
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  function desktopMedia(reduce = false) {
    const original = window.matchMedia;
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches:
        query.includes("min-width") ||
        (reduce && query.includes("prefers-reduced-motion")),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true;
      },
    }));
    return () => {
      vi.mocked(original).mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return true;
        },
      }));
    };
  }

  it("keeps the page out of sidebar motion and supports rapid toggles", async () => {
    const restore = desktopMedia();
    try {
      const user = userEvent.setup();
      const { container } = render(<App />);
      const main = container.querySelector<HTMLDivElement>(".main-shell")!;
      const sidebar = container.querySelector<HTMLElement>("#desktop-sidebar")!;
      const animate = vi.fn();
      main.animate = animate;
      const measure = vi.spyOn(main, "getBoundingClientRect");
      await user.click(screen.getByRole("button", { name: "Tutup sidebar" }));
      expect(container.querySelector(".sidebar-motion")).not.toBeNull();
      expect(sidebar.hasAttribute("hidden")).toBe(false); // Exit remains renderable.
      expect(sidebar.hasAttribute("inert")).toBe(true);
      expect(sidebar.getAttribute("aria-hidden")).toBe("true");
      // Reverse immediately, without waiting for the 220ms CSS transition.
      await user.click(screen.getByRole("button", { name: "Buka sidebar" }));
      expect(sidebar.hasAttribute("inert")).toBe(false);
      expect(sidebar.getAttribute("aria-hidden")).toBe("false");
      await user.click(screen.getByRole("button", { name: "Tutup sidebar" }));
      const rail = screen.getByRole("complementary", {
        name: "Sidebar ringkas",
      });
      expect(
        within(rail).getByRole("link", { name: "Dunia Corndog — Ringkasan" }),
      ).toBeTruthy();
      expect(rail.hasAttribute("inert")).toBe(false);
      const compactMenu = within(rail).getByRole("navigation", {
        name: "Menu utama ringkas",
      });
      expect(within(compactMenu).getAllByRole("button")).toHaveLength(8);
      expect(
        within(compactMenu)
          .getByRole("button", { name: "Ringkasan" })
          .getAttribute("aria-current"),
      ).toBe("page");
      await user.click(
        within(compactMenu).getByRole("button", { name: "Katalog menu" }),
      );
      expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
        "Katalog menu",
      );
      expect(
        within(compactMenu)
          .getByRole("button", { name: "Katalog menu" })
          .getAttribute("aria-current"),
      ).toBe("page");
      expect(
        screen
          .getByRole("button", { name: "Buka sidebar" })
          .getAttribute("aria-expanded"),
      ).toBe("false");
      await user.click(screen.getByRole("button", { name: "Buka sidebar" }));
      expect(sidebar.hasAttribute("inert")).toBe(false);
      expect(sidebar.getAttribute("aria-hidden")).toBe("false");
      expect(container.querySelector(".sidebar-motion")).not.toBeNull();
      expect(animate).not.toHaveBeenCalled();
      expect(measure).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("keeps keyboard and reduced-motion toggles immediate", async () => {
    const restore = desktopMedia();
    try {
      const user = userEvent.setup();
      const { container } = render(<App />);
      const main = container.querySelector<HTMLDivElement>(".main-shell")!;
      const animate = vi.fn();
      main.animate = animate;
      screen.getByRole("button", { name: "Tutup sidebar" }).focus();
      await user.keyboard("{Enter}");
      expect(
        screen
          .getByRole("button", { name: "Buka sidebar" })
          .getAttribute("aria-expanded"),
      ).toBe("false");
      expect(container.querySelector(".sidebar-motion")).toBeNull();
      expect(animate).not.toHaveBeenCalled();
      desktopMedia(true);
      await user.click(screen.getByRole("button", { name: "Buka sidebar" }));
      expect(container.querySelector(".sidebar-motion")).toBeNull();
      expect(animate).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

describe("global focus modality", () => {
  it("keeps pointer focus after a dropdown restores focus and the window resizes", async () => {
    const user = userEvent.setup();
    render(
      <>
        <FocusModality />
        <App />
      </>,
    );
    const trigger = screen.getByRole("combobox", { name: "Filter cabang" });
    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "Antapani" }));
    expect(document.documentElement.dataset.inputModality).toBe("pointer");
    expect(document.activeElement).toBe(trigger);
    fireEvent(window, new Event("resize"));
    expect(document.documentElement.dataset.inputModality).toBe("pointer");
    expect(document.activeElement).toBe(trigger);
  });
  it("keeps typing quiet and switches back to keyboard indicators on Tab", async () => {
    const user = userEvent.setup();
    render(
      <>
        <FocusModality />
        <App initialPage="pos" />
      </>,
    );
    const search = screen.getByRole("textbox", { name: "Cari menu kasir" });
    await user.click(search);
    await user.type(search, "sosis mozzarella");
    expect(document.documentElement.dataset.inputModality).toBe("pointer");
    await user.keyboard("{Tab}");
    expect(document.documentElement.dataset.inputModality).toBe("keyboard");
    fireEvent(window, new Event("resize"));
    expect(document.documentElement.dataset.inputModality).toBe("keyboard");
    await user.click(screen.getByRole("button", { name: "Kembali ke owner" }));
    expect(document.documentElement.dataset.inputModality).toBe("pointer");
  });
});
