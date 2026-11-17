"use client";
import { useEffect, useState } from "react";
import { Plus, Save, ChefHat } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Connection } from "@/lib/connection";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { BusinessDialog, Field, BusinessSelect } from "./business-ui";
import { PaginatedList } from "./paginated-list";
export type InventoryTool = "item" | "recipe" | "minimum" | "production";
const toolCopy = {
  item: {
    title: "Tambah bahan / produk jadi",
    description: "Tambahkan item stok beserta jenis dan satuan dasarnya.",
  },
  recipe: {
    title: "Atur resep",
    description:
      "Tentukan bahan dan takaran untuk setiap isian, ukuran, atau topping di cabang.",
  },
  minimum: {
    title: "Batas stok minimum",
    description:
      "Tentukan batas untuk menandai stok yang mulai menipis di cabang.",
  },
  production: {
    title: "Posting produksi",
    description: "Catat jumlah rencana dan hasil aktual produksi sesuai resep.",
  },
};
export default function InventoryTools({
  connected: c,
  tool,
  open,
  onOpenChange,
  returnFocus,
}: {
  connected: Connection;
  tool: InventoryTool;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: () => void;
}) {
  const [draft, setDraft] = useState({
    name: "",
    unit: "",
    kind: "RAW",
    minimumItem: "",
    minimum: "",
    recipe: "",
    quantity: "",
    actual: "",
    note: "",
  });
  const updateDraft = (key: keyof typeof draft, value: string) =>
    setDraft((old) => ({ ...old, [key]: value }));
  const qc = useQueryClient();
  const [branch, setBranch] = useState(
    c.state.branches.find((b) => b.active)?.id || "",
  );
  const [minimumBranch, setMinimumBranch] = useState(branch);
  const inventoryBranch = tool === "minimum" ? minimumBranch : branch;
  const [sku, setSku] = useState(""),
    [mode, setMode] = useState("MADE_TO_ORDER"),
    [finished, setFinished] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [target, setTarget] = useState("sku"),
    [modifier, setModifier] = useState("");
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => setMessage(""), [tool]);
  const skus = useQuery({
    queryKey: ["skus"],
    enabled: open && tool === "recipe" && target === "sku",
    queryFn: () => c.request<any[]>("/skus"),
  });
  const recipes = useQuery({
    queryKey: ["recipes"],
    enabled: open && (tool === "recipe" || tool === "production"),
    queryFn: () => c.request<any[]>("/recipes"),
  });
  const inventory = useQuery({
    queryKey: ["inventory", inventoryBranch],
    enabled:
      open && !!inventoryBranch && (tool === "recipe" || tool === "minimum"),
    queryFn: () => c.request<any[]>(`/inventory?branchId=${inventoryBranch}`),
  });
  const catalog = useQuery({
    queryKey: ["owner-catalog", branch],
    enabled: open && tool === "recipe" && !!branch && target === "modifier",
    queryFn: () => c.request<any>(`/catalog?branchId=${branch}`),
  });
  const modifierRecipes = useQuery({
    queryKey: ["modifier-recipes", branch],
    enabled: open && tool === "recipe" && !!branch && target === "modifier",
    queryFn: () => c.request<any[]>(`/modifier-recipes?branchId=${branch}`),
  });
  useEffect(() => {
    const r =
      target === "sku"
        ? recipes.data?.find((r) => r.sku_id === sku && r.branch_id === branch)
        : modifierRecipes.data?.find((r) => r.modifier_id === modifier);
    setQuantities(
      Object.fromEntries(
        (r?.components || []).map((v: any) => [v.itemId, v.quantity]),
      ),
    );
    setMode(r?.mode || "MADE_TO_ORDER");
    setFinished(r?.finished_item_id || "");
  }, [sku, branch, target, modifier, recipes.data, modifierRecipes.data]);
  async function save(path: string, body: unknown, method = "POST") {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await c.request(path, { method, body, key: crypto.randomUUID() });
      setMessage("Berhasil disimpan.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["recipes"] }),
        qc.invalidateQueries({ queryKey: ["inventory"] }),
        qc.invalidateQueries({ queryKey: ["modifier-recipes"] }),
        c.refresh(),
      ]);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <BusinessDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title={toolCopy[tool].title}
      description={toolCopy[tool].description}
      closeDisabled={busy}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        returnFocus();
      }}
    >
      <div className="inventory-tools-content" aria-busy={busy}>
        {tool === "item" && (
          <section>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save("/inventory/items", {
                  name: f.get("name"),
                  unit: f.get("unit"),
                  kind: f.get("kind"),
                });
              }}
            >
              <Field label="Nama item stok">
                <Input
                  name="name"
                  required
                  minLength={2}
                  value={draft.name}
                  onChange={(e) => updateDraft("name", e.target.value)}
                />
              </Field>
              <Field label="Satuan dasar">
                <Input
                  name="unit"
                  required
                  placeholder="g, ml, pcs"
                  value={draft.unit}
                  onChange={(e) => updateDraft("unit", e.target.value)}
                />
              </Field>
              <Field label="Jenis">
                <BusinessSelect
                  name="kind"
                  value={draft.kind}
                  onValueChange={(value) => updateDraft("kind", value)}
                  options={[
                    { value: "RAW", label: "Bahan baku" },
                    { value: "FINISHED", label: "Produk jadi" },
                  ]}
                />
              </Field>
              <Button disabled={busy}>
                <Plus aria-hidden="true" />{" "}
                {busy ? "Menyimpan…" : "Tambah item"}
              </Button>
            </form>
          </section>
        )}
        {tool === "recipe" && (
          <section>
            <Field label="Cabang resep">
              <BusinessSelect
                value={branch}
                onValueChange={setBranch}
                options={c.state.branches
                  .filter((b) => b.active)
                  .map((b) => ({ value: b.id, label: b.name }))}
              />
            </Field>
            <Field label="Resep untuk">
              <BusinessSelect
                value={target}
                onValueChange={setTarget}
                options={[
                  { value: "sku", label: "Isian & ukuran" },
                  { value: "modifier", label: "Topping" },
                ]}
              />
            </Field>
            {target === "sku" ? (
              <>
                <Field label="Isian dan ukuran">
                  <BusinessSelect
                    value={sku}
                    onValueChange={setSku}
                    options={(skus.data || []).map((s) => ({
                      value: s.id,
                      label: `${s.category} · ${s.name} · ${s.size}`,
                    }))}
                  />
                </Field>
                <Field label="Mode pemenuhan">
                  <BusinessSelect
                    value={mode}
                    onValueChange={setMode}
                    options={[
                      {
                        value: "MADE_TO_ORDER",
                        label: "Dibuat per pesanan (kurangi bahan)",
                      },
                      {
                        value: "READY_STOCK",
                        label: "Stok siap jual (kurangi produk jadi)",
                      },
                    ]}
                  />
                </Field>
                {mode === "READY_STOCK" && (
                  <Field label="Produk jadi output">
                    <BusinessSelect
                      value={finished}
                      onValueChange={setFinished}
                      options={(inventory.data || [])
                        .filter((i) => i.kind === "FINISHED")
                        .map((i) => ({ value: i.id, label: i.name }))}
                    />
                  </Field>
                )}
              </>
            ) : (
              <Field label="Topping">
                <BusinessSelect
                  value={modifier}
                  onValueChange={setModifier}
                  options={(catalog.data?.modifiers || []).map((m: any) => ({
                    value: m.id,
                    label: `${m.category} · ${m.name}`,
                  }))}
                />
              </Field>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const components = Object.entries(quantities)
                  .filter(([, quantity]) => Number(quantity) > 0)
                  .map(([itemId, quantity]) => ({ itemId, quantity }));
                void save(
                  target === "sku" ? "/recipes" : "/modifier-recipes",
                  target === "sku"
                    ? {
                        skuId: sku,
                        branchId: branch,
                        mode,
                        finishedItemId:
                          mode === "READY_STOCK" ? finished : null,
                        components,
                      }
                    : { modifierId: modifier, branchId: branch, components },
                  "PUT",
                );
              }}
            >
              <p className="menu-flow-hint">
                Takaran per 1 porsi. Kosongkan bahan yang tidak digunakan.
              </p>
              <div className="recipe-ingredient-list">
                {(inventory.data || [])
                  .filter((i) => i.kind === "RAW" && i.id !== finished)
                  .map((i) => (
                    <Field key={i.id} label={`${i.name} (${i.unit})`}>
                      <Input
                        type="number"
                        min={0}
                        step="0.001"
                        value={quantities[i.id] || ""}
                        onChange={(e) =>
                          setQuantities((old) => ({
                            ...old,
                            [i.id]: e.target.value,
                          }))
                        }
                        placeholder="Tidak digunakan"
                      />
                    </Field>
                  ))}
              </div>
              <Button disabled={busy || !(target === "sku" ? sku : modifier)}>
                <Save aria-hidden="true" />{" "}
                {busy ? "Menyimpan…" : "Simpan resep"}
              </Button>
            </form>
          </section>
        )}
        {tool === "minimum" && (
          <section>
            <Field label="Cabang stok">
              <BusinessSelect
                value={minimumBranch}
                onValueChange={setMinimumBranch}
                options={c.state.branches
                  .filter((b) => b.active)
                  .map((b) => ({ value: b.id, label: b.name }))}
              />
            </Field>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save(
                  `/inventory/${f.get("item")}/minimum`,
                  {
                    branchId: minimumBranch,
                    minimum: String(f.get("minimum")),
                  },
                  "PATCH",
                );
              }}
            >
              <Field label="Item stok">
                <BusinessSelect
                  name="item"
                  value={draft.minimumItem || inventory.data?.[0]?.id || ""}
                  onValueChange={(value) => updateDraft("minimumItem", value)}
                  options={(inventory.data || []).map((i) => ({
                    value: i.id,
                    label: `${i.name} (${i.unit})`,
                  }))}
                />
              </Field>
              <Field label="Jumlah minimum">
                <Input
                  name="minimum"
                  type="number"
                  min={0}
                  step="0.001"
                  required
                  value={draft.minimum}
                  onChange={(e) => updateDraft("minimum", e.target.value)}
                />
              </Field>
              <Button disabled={busy}>
                <Save aria-hidden="true" />{" "}
                {busy ? "Menyimpan…" : "Simpan batas minimum"}
              </Button>
            </form>
          </section>
        )}
        {tool === "production" && (
          <section>
            <p className="menu-flow-hint">
              Produksi mengurangi bahan resep dan memindahkan nilainya ke hasil
              aktual produk jadi.
            </p>
            <form
              className="production-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save("/production", {
                  recipeId: f.get("recipe"),
                  quantity: Number(f.get("quantity")),
                  actual: Number(f.get("actual")),
                  note: f.get("note"),
                });
              }}
            >
              <Field label="Resep produk siap jual">
                <BusinessSelect
                  name="recipe"
                  value={
                    draft.recipe ||
                    recipes.data?.find((r) => r.mode === "READY_STOCK")?.id ||
                    ""
                  }
                  onValueChange={(value) => updateDraft("recipe", value)}
                  options={(recipes.data || [])
                    .filter((r) => r.mode === "READY_STOCK")
                    .map((r) => ({
                      value: r.id,
                      label: `${c.state.branches.find((b) => b.id === r.branch_id)?.name} · ${r.product_name} ${r.size}`,
                    }))}
                />
              </Field>
              <Field label="Jumlah rencana">
                <Input
                  name="quantity"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={draft.quantity}
                  onChange={(e) => updateDraft("quantity", e.target.value)}
                />
              </Field>
              <Field label="Hasil aktual layak jual">
                <Input
                  name="actual"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={draft.actual}
                  onChange={(e) => updateDraft("actual", e.target.value)}
                />
              </Field>
              <Field label="Catatan produksi">
                <Input
                  name="note"
                  required
                  minLength={5}
                  value={draft.note}
                  onChange={(e) => updateDraft("note", e.target.value)}
                />
              </Field>
              <Button
                disabled={
                  busy || !recipes.data?.some((r) => r.mode === "READY_STOCK")
                }
              >
                <ChefHat aria-hidden="true" />{" "}
                {busy ? "Menyimpan…" : "Posting produksi"}
              </Button>
            </form>
          </section>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
      </div>
    </BusinessDialog>
  );
}

export function RecipeList({ connected: c }: { connected: Connection }) {
  const data = useQuery({
    queryKey: ["recipes"],
    queryFn: () => c.request<any[]>("/recipes"),
  });
  return (
    <PaginatedList items={data.data || []}>
      {(pageItems) => (
        <div className="recipe-grid">
          {pageItems.map((r) => (
            <div className="recipe-card" key={r.id}>
              <h2>
                {r.product_name} · {r.size}
              </h2>
              <p>
                {c.state.branches.find((b) => b.id === r.branch_id)?.name} ·{" "}
                {r.mode === "READY_STOCK"
                  ? "Stok siap jual"
                  : "Dibuat saat dipesan"}{" "}
                · versi {r.version}
              </p>
              {r.components.map((part: any) => (
                <div key={part.itemId}>
                  {c.state.stocks.find((s) => s.itemId === part.itemId)?.name ||
                    part.itemId}
                  <b>{part.quantity}</b>
                </div>
              ))}
            </div>
          ))}
          {data.error && <p role="alert">{data.error.message}</p>}
        </div>
      )}
    </PaginatedList>
  );
}
