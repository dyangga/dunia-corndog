import { memo, useDeferredValue, useState } from "react";
import dynamic from "next/dynamic";
import type { State, Stock, Product } from "@dc/contracts";
import type { Connection } from "@/lib/connection";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";
import { Alert, AlertDescription } from "./ui/alert";
import { FilterTabs, StatusBadge as Badge } from "./business-ui";
import { PaginatedList } from "./paginated-list";
import { money, number } from "@/lib/utils";
import {
  BookOpen,
  History,
  Trash2,
  Boxes,
  TriangleAlert,
  Search,
  Plus,
  ChefHat,
  ArrowLeftRight,
  ClipboardList,
  Info,
  Package,
} from "lucide-react";
const RecipeList = dynamic(
  () => import("./inventory-tools").then((m) => m.RecipeList),
  { loading: () => <p role="status">Memuat resep…</p> },
);
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Package size={30} />
      <b>{text}</b>
    </div>
  );
}
export const InventoryPage = memo(function InventoryPage({
  data,
  stocks,
  branch,
  online,
  connected,
  onAction,
  onStartCount,
  branchName,
}: {
  data: State;
  stocks: Stock[];
  branch: string;
  online: boolean;
  connected?: Connection;
  onAction: (name: string) => void;
  onStartCount: () => void;
  branchName: (id: string) => string;
}) {
  const live = !!connected;
  const [search, setSearch] = useState(""),
    [inventoryTab, setInventoryTab] = useState("Persediaan");
  const deferredSearch = useDeferredValue(search);
  const low = stocks.filter((s) => s.qty < s.min);
  return (
    <>
      <div className="mini-summary">
        <span>
          <Boxes size={19} />
          <b>{stocks.length}</b> item persediaan
        </span>
        <span>
          <TriangleAlert size={18} />
          <b>{low.length}</b> stok menipis
        </span>
        <span>
          Nilai persediaan{" "}
          <b>{money(stocks.reduce((s, x) => s + x.qty * x.cost, 0))}</b>
        </span>
      </div>
      <FilterTabs
        value={inventoryTab}
        onValueChange={setInventoryTab}
        options={[
          "Persediaan",
          "Produksi",
          "Transfer",
          "Opname & waste",
          "Mutasi",
          "Resep",
        ]}
        label="Operasional stok"
        icons={{
          Persediaan: <Boxes size={17} />,
          Produksi: <ChefHat size={17} />,
          Transfer: <ArrowLeftRight size={17} />,
          "Opname & waste": <ClipboardList size={17} />,
          Mutasi: <History size={17} />,
          Resep: <BookOpen size={17} />,
        }}
      >
        <Card className="panel">
          <div className="inventory-actions">
            <label className="search-box">
              <Search size={16} />
              <Input
                aria-label="Cari bahan atau produk"
                placeholder="Cari bahan atau produk…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="button-group">
              {inventoryTab === "Persediaan" ? (
                <Button disabled={!online} onClick={() => onAction("stock-in")}>
                  <Plus size={16} />
                  Stok masuk
                </Button>
              ) : inventoryTab === "Produksi" ? (
                <Button
                  disabled={!online}
                  onClick={() => onAction("production")}
                >
                  <ChefHat size={17} />
                  Catat produksi
                </Button>
              ) : inventoryTab === "Transfer" ? (
                <Button disabled={!online} onClick={() => onAction("transfer")}>
                  <ArrowLeftRight size={17} />
                  Transfer stok
                </Button>
              ) : inventoryTab === "Opname & waste" ? (
                <>
                  <Button
                    variant="outline"
                    disabled={!online}
                    onClick={() => onAction("waste")}
                  >
                    <Trash2 aria-hidden="true" /> Catat waste
                  </Button>
                  <Button
                    disabled={!online}
                    onClick={() => {
                      onStartCount();
                      onAction("count");
                    }}
                  >
                    <ClipboardList size={17} />
                    Mulai opname
                  </Button>
                </>
              ) : null}
            </div>
          </div>
          {inventoryTab === "Persediaan" ? (
            <PaginatedList
              items={stocks.filter((s) =>
                s.name.toLowerCase().includes(deferredSearch.toLowerCase()),
              )}
              pageKey={`${inventoryTab}:${deferredSearch}:${branch}`}
            >
              {(pageItems) => (
                <div className="table-scroll">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama item</TableHead>
                        <TableHead>Cabang</TableHead>
                        <TableHead>Stok tersedia</TableHead>
                        <TableHead>Minimum</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageItems.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <b>{s.name}</b>
                            <small>{s.category}</small>
                          </TableCell>
                          <TableCell>{branchName(s.branch)}</TableCell>
                          <TableCell>
                            <b>
                              {number(s.qty)} {s.unit}
                            </b>
                          </TableCell>
                          <TableCell>
                            {number(s.min)} {s.unit}
                          </TableCell>
                          <TableCell>
                            <Badge>
                              {s.qty === 0
                                ? "Habis"
                                : s.qty < s.min
                                  ? "Menipis"
                                  : "Aman"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </PaginatedList>
          ) : inventoryTab === "Resep" ? (
            connected ? (
              <RecipeList connected={connected} />
            ) : (
              <div className="recipe-grid">
                {data.products.slice(0, 3).map((p) => (
                  <div className="recipe-card" key={p.id}>
                    <ChefHat size={24} />
                    <h2 className="item-title">{p.name}</h2>
                    <Badge tone="neutral">Versi demo 1</Badge>
                    <p>Mode: dibuat saat dipesan</p>
                    <div>
                      Tepung premix <b>50 g</b>
                    </div>
                    <div>
                      Keju mozzarella <b>30 g</b>
                    </div>
                    <small>
                      Contoh resep untuk review tampilan, belum dipakai otomatis
                      saat checkout.
                    </small>
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              <Alert role="note" className="notice">
                <AlertDescription>
                  <Info size={18} />
                  {live
                    ? inventoryTab === "Transfer"
                      ? "Transfer diposting setelah barang diterima cabang tujuan, dengan nilai buku yang sama."
                      : "Mutasi stok tersimpan di ledger dan tidak dapat dihapus. Koreksi dicatat sebagai kejadian baru."
                    : inventoryTab === "Produksi"
                      ? "Simulasi batch: 50 g premix + 30 g mozzarella menghasilkan 1 pcs corndog siap goreng."
                      : inventoryTab === "Transfer"
                        ? "Transfer demo langsung diterima oleh cabang tujuan."
                        : inventoryTab === "Opname & waste"
                          ? "Opname mencatat selisih hitung fisik. Waste mengurangi saldo dan memerlukan alasan."
                          : "Histori simulasi perubahan stok pada browser ini."}
                </AlertDescription>
              </Alert>
              {data.postings.filter(
                (p) =>
                  (branch === "all" || p.branch === branch) &&
                  (inventoryTab === "Mutasi" ||
                    (inventoryTab === "Produksi" && p.type === "production") ||
                    (inventoryTab === "Transfer" && p.type === "transfer") ||
                    (inventoryTab === "Opname & waste" &&
                      ["count", "waste"].includes(p.type))),
              ).length ? (
                <PaginatedList
                  items={data.postings.filter(
                    (p) =>
                      (branch === "all" || p.branch === branch) &&
                      (inventoryTab === "Mutasi" ||
                        (inventoryTab === "Produksi" &&
                          p.type === "production") ||
                        (inventoryTab === "Transfer" &&
                          p.type === "transfer") ||
                        (inventoryTab === "Opname & waste" &&
                          ["count", "waste"].includes(p.type))),
                  )}
                  pageKey={`${inventoryTab}:${deferredSearch}:${branch}`}
                >
                  {(pageItems) => (
                    <div className="table-scroll">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead>Cabang</TableHead>
                            <TableHead>Jenis</TableHead>
                            <TableHead>Perubahan</TableHead>
                            <TableHead>Alasan</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageItems.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>{p.date}</TableCell>
                              <TableCell>{p.item}</TableCell>
                              <TableCell>{branchName(p.branch)}</TableCell>
                              <TableCell>{p.type}</TableCell>
                              <TableCell>
                                {p.qty > 0 ? "+" : ""}
                                {p.qty}
                              </TableCell>
                              <TableCell>{p.note}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </PaginatedList>
              ) : (
                <Empty text="Belum ada pencatatan." />
              )}
            </>
          )}
        </Card>
      </FilterTabs>
    </>
  );
});
