import { memo, useDeferredValue, useState } from "react";
import type { Product } from "@dc/contracts";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { FilterTabs, StatusBadge as Badge } from "./business-ui";
import { StatusActionButton } from "./confirmation";
import { PaginatedList } from "./paginated-list";
import { money } from "@/lib/utils";
import { Search, Info, Pencil, LayoutGrid, Flame, Candy } from "lucide-react";
import Corndog from "./corndog";
import { MENU_CATEGORIES, MENU_SIZES } from "@/lib/menu";
export const CatalogPage = memo(function CatalogPage({
  products,
  connected,
  onEdit,
  onToggle,
}: {
  products: Product[];
  connected: boolean;
  onEdit: (product: Product) => void;
  onToggle: (product: Product) => void | Promise<unknown>;
}) {
  const data = { products };
  const [search, setSearch] = useState(""),
    [tab, setTab] = useState("Semua");
  const deferredSearch = useDeferredValue(search);
  return (
    <FilterTabs
      value={tab}
      onValueChange={setTab}
      options={["Semua", ...MENU_CATEGORIES]}
      label="Kategori menu"
      icons={{
        Semua: <LayoutGrid size={17} />,
        "Gurih pedas": <Flame size={17} />,
        Manis: <Candy size={17} />,
      }}
    >
      <>
        <div className="list-toolbar standalone">
          <label className="search-box">
            <Search size={16} />
            <Input
              aria-label="Cari nama menu"
              placeholder="Cari nama menu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <PaginatedList
          items={data.products.filter(
            (p) =>
              (tab === "Semua" || p.category === tab) &&
              p.name.toLowerCase().includes(deferredSearch.toLowerCase()),
          )}
          pageKey={`${tab}:${deferredSearch}`}
        >
          {(pageItems) => (
            <div className="catalog-grid">
              {pageItems.map((p) => (
                <Card className="menu-card panel" key={p.id}>
                  <div className={`menu-visual ${p.color}`}>
                    <Corndog id={p.id} kind={p.color} />
                    <Badge>{p.active ? "Aktif" : "Nonaktif"}</Badge>
                  </div>
                  <div className="menu-info">
                    <span className="eyebrow">{p.category}</span>
                    <h2 className="item-title">{p.name}</h2>
                    <div className="menu-size-prices">
                      {MENU_SIZES.filter((size) => p.prices[size]).map(
                        (size) => (
                          <span key={size}>
                            {size}
                            <b>{money(p.prices[size]!)}</b>
                          </span>
                        ),
                      )}
                    </div>
                    <div className="menu-card-bottom">
                      <span>{p.stock} porsi tersedia</span>
                      <div className="menu-card-actions">
                        {connected && (
                          <Button
                            size="sm"
                            variant="soft"
                            onClick={() => onEdit(p)}
                          >
                            <Pencil aria-hidden="true" /> Edit
                          </Button>
                        )}
                        <StatusActionButton
                          active={p.active}
                          name={p.name}
                          kind="menu"
                          description={
                            p.active
                              ? "akan disembunyikan dari pilihan isian kasir. Riwayat penjualan tetap tersimpan."
                              : "akan tersedia kembali sebagai pilihan isian kasir, sesuai ketersediaan stok."
                          }
                          onConfirm={() => onToggle(p)}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </PaginatedList>
        <Alert role="note" className="notice">
          <AlertDescription>
            <Info size={17} />
            Harga panir mengikuti buku menu. Kentang/mie +Rp1.000 jika tersedia.
            Topping include gratis; extra topping +Rp1.000 per pilihan. Stok
            isian dipakai bersama untuk semua ukuran.
          </AlertDescription>
        </Alert>
      </>
    </FilterTabs>
  );
});
