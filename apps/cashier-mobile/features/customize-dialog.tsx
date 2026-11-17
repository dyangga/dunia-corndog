import { memo, useCallback, useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import {
  CATEGORIES,
  type Catalog,
  type CatalogProduct,
  type CatalogModifier,
  type MenuSize,
} from "@dc/contracts";
import { colors as c } from "@dc/design-tokens";
import Corndog from "../components/corndog";
import { SelectField } from "../components/select-field";
import { Stepper } from "../components/stepper";
import { Text } from "../components/typography";
import {
  Button,
  Choice,
  Field,
  ModalFrame,
  Notice,
  money,
  s,
} from "../components/ui";
import type { CartLine } from "./cart-line";

const CATEGORY_OPTIONS = CATEGORIES.map((value) => ({ value, label: value }));

export const CustomizeDialog = memo(function CustomizeDialog({
  size,
  catalog,
  pending,
  onClose,
  onAdd,
}: {
  size: MenuSize | null;
  catalog: Catalog | undefined;
  pending: boolean;
  onClose: () => void;
  onAdd: (line: CartLine, available: number) => boolean;
}) {
  const width = useWindowDimensions().width;
  const [category, setCategory] = useState(
    () =>
      catalog?.products.find((p) =>
        p.skus.some((s) => s.size === size && s.available > 0),
      )?.category || "Gurih pedas",
  );
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const modifiers = catalog?.modifiers || [];
  const selectedModifiers = selected
    .map((id) => modifiers.find((m) => m.id === id))
    .filter((m): m is CatalogModifier => !!m);
  const sku = product?.skus.find((s) => s.size === size);
  const unitPrice =
    (sku?.price || 0) + selectedModifiers.reduce((sum, m) => sum + m.price, 0);
  const sizeProducts = useMemo(
    () =>
      (catalog?.products || []).filter(
        (p) => p.category === category && p.skus.some((s) => s.size === size),
      ),
    [catalog, category, size],
  );
  const fillingOptions = useMemo(
    () =>
      sizeProducts.map((p) => {
        const sku = p.skus.find((s) => s.size === size)!;
        return {
          value: p.id,
          label: p.name,
          detail: sku.available ? money(sku.price) : "Habis",
          disabled: !sku.available,
        };
      }),
    [sizeProducts, size],
  );
  const hasAvailableFilling = sizeProducts.some((p) =>
    p.skus.some((s) => s.size === size && s.available > 0),
  );
  const chooseCategory = useCallback(
    (next: string) => {
      if (next === category) return;
      setCategory(next);
      setProduct(null);
      setSelected([]);
      setQuantity(1);
    },
    [category],
  );
  const chooseFilling = useCallback(
    (id: string) => {
      const p = sizeProducts.find((p) => p.id === id);
      if (!p) return;
      setProduct(p);
      setQuantity(1);
      if (!p.potatoNoodleAllowed)
        setSelected((old) =>
          old.filter(
            (id) =>
              !["Kentang", "Mie"].includes(
                modifiers.find((m) => m.id === id)?.name || "",
              ),
          ),
        );
    },
    [sizeProducts, modifiers],
  );
  function toggle(id: string) {
    setSelected((old) =>
      old.includes(id) ? old.filter((i) => i !== id) : [...old, id],
    );
  }
  function add() {
    if (!product || !sku || !size || !sku.available || pending) return;
    const line: CartLine = {
      key: [sku.id, [...selected].sort().join(","), note].join("|"),
      skuId: sku.id,
      productId: product.id,
      name: product.name,
      category,
      size,
      quantity,
      modifierIds: selected,
      modifiers: selectedModifiers.map((m) => m.name),
      note,
      unitPrice,
    };
    if (onAdd(line, sku.available)) onClose();
  }
  return (
    <ModalFrame
      open={!!size}
      title={`${size || ""} Corndog`}
      illustration={<Corndog id="customize-header" width={42} height={54} />}
      onClose={onClose}
      footer={
        <View style={s.row}>
          <Stepper
            value={quantity}
            min={1}
            max={sku?.available || 1}
            disabled={!sku || !!pending}
            onChange={setQuantity}
          />
          <View style={{ flex: 1 }}>
            <Button
              disabled={!sku || !sku.available || !!pending}
              onPress={add}
            >
              {sku
                ? `Tambah · ${money(unitPrice * quantity)}`
                : "Pilih isian dulu"}
            </Button>
          </View>
        </View>
      }
    >
      <View style={styles.selectionPanel}>
        <View
          style={[
            styles.selectionFields,
            { flexDirection: width >= 600 ? "row" : "column" },
          ]}
        >
          <View style={width >= 600 ? { width: "36%" } : undefined}>
            <SelectField
              label="Kategori"
              accessibilityLabel="Kategori corndog"
              value={category}
              options={CATEGORY_OPTIONS}
              onChange={chooseCategory}
            />
          </View>
          <View style={width >= 600 ? { flex: 1, minWidth: 0 } : undefined}>
            <SelectField
              key={category}
              label="Isian"
              accessibilityLabel="Isian corndog"
              value={product?.id || ""}
              placeholder="Pilih isian"
              disabled={!hasAvailableFilling}
              options={fillingOptions}
              onChange={chooseFilling}
            />
          </View>
        </View>
        {!hasAvailableFilling && (
          <Notice>
            Belum ada isian tersedia untuk kategori dan ukuran ini.
          </Notice>
        )}
        {product && (
          <>
            {(["INCLUDED", "EXTRA"] as const).map((kind) => (
              <View key={kind}>
                <View style={[s.row, { marginBottom: 10 }]}>
                  <Text style={styles.optionSectionTitle}>
                    {kind === "INCLUDED" ? "Topping include" : "Extra topping"}
                  </Text>
                  <View
                    style={[
                      styles.optionSectionBadge,
                      {
                        backgroundColor:
                          kind === "INCLUDED" ? "#EAF2EC" : "#F0EEE8",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "600",
                        color: kind === "INCLUDED" ? c.green : c.muted,
                      }}
                    >
                      {kind === "INCLUDED" ? "Gratis" : "Berbayar"}
                    </Text>
                  </View>
                </View>
                <View style={[s.choices, styles.panelChoices]}>
                  {modifiers
                    .filter(
                      (m) =>
                        m.category === category &&
                        m.kind === kind &&
                        (product.potatoNoodleAllowed ||
                          !["Kentang", "Mie"].includes(m.name)),
                    )
                    .map((m) => (
                      <Choice
                        key={m.id}
                        compact
                        title={m.name}
                        subtitle={m.price ? `+${money(m.price)}` : "Gratis"}
                        selected={selected.includes(m.id)}
                        onPress={() => toggle(m.id)}
                      />
                    ))}
                </View>
              </View>
            ))}
          </>
        )}
        <Field
          label="Catatan pelanggan"
          value={note}
          onChangeText={setNote}
          maxLength={200}
          placeholder="Contoh: saus dipisah"
        />
      </View>
    </ModalFrame>
  );
});
const styles = StyleSheet.create({
  selectionPanel: {
    gap: 14,
    backgroundColor: "#F5F3ED",
    borderRadius: 16,
    padding: 14,
    marginBottom: 22,
  },
  selectionFields: { gap: 12 },
  panelChoices: { marginBottom: 0 },
  optionSectionTitle: { fontSize: 14, fontWeight: "600", color: c.ink },
  optionSectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
