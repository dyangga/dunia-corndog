import React from "react";
import { it, expect, vi } from "vitest";
import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/components/app";
import { ConfirmationProvider } from "@/components/confirmation";
import { CatalogPage } from "@/components/catalog-page";
import { seed } from "./setup";

it("requires confirmation for the selected menu, defaults focus to cancel, and restores trigger focus", async () => {
  const user = userEvent.setup(),
    toggle = vi.fn();
  const product = { ...seed().products[0], active: true };
  render(
    <ConfirmationProvider>
      <CatalogPage
        products={[product]}
        connected
        onEdit={vi.fn()}
        onToggle={toggle}
      />
    </ConfirmationProvider>,
  );
  const trigger = screen.getByRole("button", { name: "Nonaktifkan" });
  await user.click(trigger);
  const dialog = await screen.findByRole("alertdialog", {
    name: "Nonaktifkan menu?",
  });
  expect(dialog.textContent).toContain(product.name);
  expect(dialog.textContent).toContain("Riwayat penjualan tetap tersimpan");
  expect(toggle).not.toHaveBeenCalled();
  const cancel = within(dialog).getByRole("button", { name: "Batal" });
  await waitFor(() => expect(document.activeElement).toBe(cancel));
  await user.click(cancel);
  expect(toggle).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  await user.click(trigger);
  await user.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Nonaktifkan menu",
    }),
  );
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(toggle).toHaveBeenCalledExactlyOnceWith(product);
});

it("blocks duplicate writes and dismissal while pending, and keeps errors retryable", async () => {
  const user = userEvent.setup();
  let reject!: (error: Error) => void;
  const toggle = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValue(undefined);
  render(
    <ConfirmationProvider>
      <CatalogPage
        products={[{ ...seed().products[0], active: true }]}
        connected
        onEdit={vi.fn()}
        onToggle={toggle}
      />
    </ConfirmationProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Nonaktifkan" }));
  let dialog = await screen.findByRole("alertdialog");
  const submit = within(dialog).getByRole("button", {
    name: "Nonaktifkan menu",
  });
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(toggle).toHaveBeenCalledTimes(1);
  expect(
    (
      within(dialog).getByRole("button", {
        name: "Menyimpan…",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    (within(dialog).getByRole("button", { name: "Batal" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await user.keyboard("{Escape}");
  expect(screen.getByRole("alertdialog")).toBe(dialog);
  await act(async () => reject(new Error("Koneksi terputus")));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Koneksi terputus",
  );
  dialog = screen.getByRole("alertdialog");
  await user.click(
    within(dialog).getByRole("button", { name: "Nonaktifkan menu" }),
  );
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(toggle).toHaveBeenCalledTimes(2);
});

it("does not rerender the page when opening or cancelling a confirmation", async () => {
  const user = userEvent.setup();
  let renders = 0;
  function Page() {
    renders++;
    return (
      <CatalogPage
        products={[{ ...seed().products[0], active: true }]}
        connected
        onEdit={vi.fn()}
        onToggle={vi.fn()}
      />
    );
  }
  render(
    <ConfirmationProvider>
      <Page />
    </ConfirmationProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Nonaktifkan" }));
  await user.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Batal",
    }),
  );
  expect(renders).toBe(1);
});

it.each(["branches", "users"])(
  "preserves the active-shift guard on %s",
  async (page) => {
    const user = userEvent.setup();
    render(<App initialPage={page} />);
    await user.click(screen.getAllByRole("button", { name: "Nonaktifkan" })[0]);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(
      await screen.findByText(
        page === "branches"
          ? "Tutup shift aktif sebelum menonaktifkan cabang."
          : "Tutup shift anggota sebelum menonaktifkan akun.",
      ),
    ).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem("dc-demo-v1")!);
    expect(saved[page === "branches" ? "branches" : "users"][0].active).toBe(
      true,
    );
  },
);

it.each(["branches", "users"])(
  "confirms and persists a %s status change after shifts are closed",
  async (page) => {
    const user = userEvent.setup();
    const state = seed();
    state.shifts = [];
    localStorage.setItem("dc-demo-v1", JSON.stringify(state));
    render(<App initialPage={page} />);
    await user.click(screen.getAllByRole("button", { name: "Nonaktifkan" })[0]);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(
      page === "branches" ? state.branches[0].name : state.users[0].name,
    );
    await user.click(
      within(dialog).getByRole("button", {
        name:
          page === "branches" ? "Nonaktifkan cabang" : "Nonaktifkan akun staf",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(
      JSON.parse(localStorage.getItem("dc-demo-v1")!)[
        page === "branches" ? "branches" : "users"
      ][0].active,
    ).toBe(false);
  },
);

it("waits for the connected menu update, surfaces failure, and retries the same explicit status", async () => {
  const user = userEvent.setup();
  const state = seed();
  let writes = 0;
  const request = vi.fn(async () => {
    writes++;
    if (writes === 1) throw new Error("Status belum tersimpan");
    return { ok: true };
  });
  const refresh = vi.fn(async () => {});
  const connected = {
    state,
    request,
    refresh,
    updatedAt: 1,
    user: { id: "owner", role: "OWNER", name: "Owner", branches: [] },
  } as unknown as import("@/lib/connection").Connection;
  render(<App initialPage="catalog" connected={connected} />);
  await user.click(screen.getAllByRole("button", { name: "Nonaktifkan" })[0]);
  expect(request).not.toHaveBeenCalled();
  const dialog = await screen.findByRole("alertdialog");
  await user.click(
    within(dialog).getByRole("button", { name: "Nonaktifkan menu" }),
  );
  expect((await within(dialog).findByRole("alert")).textContent).toContain(
    "Status belum tersimpan",
  );
  expect(refresh).not.toHaveBeenCalled();
  await user.click(
    within(dialog).getByRole("button", { name: "Nonaktifkan menu" }),
  );
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  const calls = request.mock.calls as unknown as [
    string,
    { method: string; body: { active: boolean; name: string } },
  ][];
  expect(calls).toHaveLength(2);
  for (const [path, options] of calls) {
    expect(path).toBe(`/products/${state.products[0].id}`);
    expect(options.method).toBe("PATCH");
    expect(options.body).toMatchObject({
      name: state.products[0].name,
      active: false,
    });
  }
  expect(refresh).toHaveBeenCalledTimes(1);
});
