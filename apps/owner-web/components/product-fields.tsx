import { memo, useState } from "react";
import type { Product } from "@dc/contracts";
import { MENU_CATEGORIES, MENU_SIZES } from "@/lib/menu";
import { Field, BusinessSelect } from "./business-ui";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import { Info } from "lucide-react";
export const ProductFields = memo(function ProductFields({
  product,
  live,
}: {
  product?: Product;
  live: boolean;
}) {
  const editingProduct = product?.id,
    data = { products: product ? [product] : [] };
  const [newCategory, setNewCategory] = useState(
    product?.category || "Gurih pedas",
  );
  return (
    <>
      <Field label="Kategori isian">
        <BusinessSelect
          name="category"
          value={newCategory}
          onValueChange={setNewCategory}
          options={MENU_CATEGORIES.map((category) => ({
            value: category,
            label: category,
          }))}
        />
      </Field>
      <Field label="Nama isian corndog">
        <Input
          name="name"
          required
          pattern={".*\\S.*"}
          maxLength={100}
          defaultValue={
            editingProduct
              ? data.products.find((p) => p.id === editingProduct)?.name
              : undefined
          }
          placeholder={
            newCategory === "Manis"
              ? "Contoh: Beng-beng atau pisang"
              : "Contoh: Mozzarella & sosis"
          }
        />
      </Field>
      <fieldset className="menu-price-fields">
        <legend>Harga panir per ukuran (Rp)</legend>
        <p>Isi ukuran yang dijual. Kosongkan ukuran yang tidak tersedia.</p>
        <div className="menu-price-grid">
          {MENU_SIZES.map((size) => (
            <Field key={size} label={size}>
              <Input
                name={`price-${size}`}
                type="number"
                min={1}
                step={1}
                defaultValue={
                  editingProduct
                    ? data.products.find((p) => p.id === editingProduct)
                        ?.prices[size]
                    : undefined
                }
                placeholder="Tidak dijual"
              />
            </Field>
          ))}
        </div>
      </fieldset>
      {newCategory === "Gurih pedas" && (
        <div className="checkbox-row">
          <Checkbox
            id="new-potato-noodle"
            name="potato-noodle"
            defaultChecked={
              editingProduct
                ? data.products.find((p) => p.id === editingProduct)
                    ?.potatoNoodleAllowed
                : true
            }
          />
          <Label htmlFor="new-potato-noodle">
            Tersedia extra topping Kentang dan Mie (+Rp1.000 per pilihan)
          </Label>
        </div>
      )}
      {!live && (
        <Field label="Stok awal isian (porsi)">
          <Input
            name="stock"
            type="number"
            min={0}
            step={1}
            defaultValue={0}
            required
          />
        </Field>
      )}
      <Alert role="note" className="notice">
        <AlertDescription>
          <Info size={17} />
          Topping include mengikuti kategori dan gratis. Extra topping +Rp1.000
          per pilihan.{" "}
          {live
            ? "Atur resep dan stok cabang di Stok & produksi sebelum isian dapat dijual."
            : "Stok awal 0 membuat isian belum bisa dipesan kasir."}
        </AlertDescription>
      </Alert>
    </>
  );
});
