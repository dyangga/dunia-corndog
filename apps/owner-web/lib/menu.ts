import type { Line, Product, State } from "@/lib/demo";

export const MENU_SIZES = ["Small", "Medium", "Jumbo"] as const;
export type MenuSize = (typeof MENU_SIZES)[number];
export const MENU_CATEGORIES = ["Gurih pedas", "Manis"] as const;
export const INCLUDED_TOPPINGS: Record<string, string[]> = {
  "Gurih pedas": ["Saus tomat", "Saus cabai", "Mayones"],
  Manis: ["Cokelat", "Stroberi", "Tiramisu", "Taro", "Green tea"],
};
export const EXTRA_TOPPINGS: Record<string, string[]> = {
  "Gurih pedas": ["Saus keju"],
  Manis: ["Keju parut", "Choco chip"],
};
export const EXTRA_PRICE = 1000;

// Harga panir dari buku menu; kentang/mie menambah Rp1.000 bila tersedia.
export function menuProducts(): Product[] {
  const rows: [string, string, Partial<Record<MenuSize, number>>, boolean][] = [
    ["Mozzarella", "Gurih pedas", { Small: 3000 }, true],
    ["Sosis", "Gurih pedas", { Small: 3000 }, true],
    ["Full mozzarella", "Gurih pedas", { Medium: 7000, Jumbo: 10000 }, true],
    ["Full sosis", "Gurih pedas", { Medium: 7000, Jumbo: 10000 }, true],
    ["Mozzarella & sosis", "Gurih pedas", { Medium: 7000, Jumbo: 10000 }, true],
    ["Beng-beng", "Manis", { Medium: 5000 }, false],
    ["Dilan", "Manis", { Medium: 5000 }, false],
    ["Full pisang", "Manis", { Medium: 7000 }, false],
    ["Pisang & mozzarella", "Manis", { Medium: 7000 }, false],
    ["Full mozzarella", "Manis", { Medium: 7000, Jumbo: 10000 }, false],
  ];
  return rows.map(([name, category, prices, potatoNoodleAllowed], i) => ({
    id: `menu-${i + 1}`,
    name,
    category,
    prices,
    potatoNoodleAllowed,
    price: Math.min(...Object.values(prices)),
    cost: 0,
    stock: 40,
    color: category === "Manis" ? "choco" : "gold",
    active: true,
  }));
}

export function menuPrice(product: Product, size: MenuSize, extras: string[]) {
  return (product.prices[size] || 0) + extras.length * EXTRA_PRICE;
}

export function lineOptions(line: Line) {
  return [
    line.size,
    line.category,
    line.coating === "Kentang" || line.coating === "Mie"
      ? "Panir"
      : line.coating,
    ...line.toppings,
    ...Array.from(
      new Set([
        ...(line.extraToppings || []),
        ...(["Kentang", "Mie"].includes(line.coating || "")
          ? [line.coating!]
          : []),
      ]),
    ).map((name) => `${name} (+Rp1.000)`),
    ...(line.extra ? [`Extra mozzarella ×${line.extra}`] : []),
  ]
    .filter(Boolean)
    .join(" · ");
}

// Upgrade only the old demo catalogue. Keep historical orders and owner-created fillings.
export function migrateMenu(state: State): State {
  if (state.products.every((p) => p.prices)) {
    if (state.products.every((p) => typeof p.potatoNoodleAllowed === "boolean"))
      return state;
    return {
      ...state,
      products: state.products.map(({ coatingAllowed, ...p }) => ({
        ...p,
        potatoNoodleAllowed:
          p.potatoNoodleAllowed ??
          coatingAllowed ??
          p.category === "Gurih pedas",
      })),
    };
  }
  const custom = state.products
    .filter((p) => !/^p[1-6]$/.test(p.id))
    .map((p) => ({
      ...p,
      category:
        p.category === "Sweet" || p.category === "Manis"
          ? "Manis"
          : "Gurih pedas",
      prices: p.prices || { Medium: p.price },
      potatoNoodleAllowed:
        p.potatoNoodleAllowed ??
        p.coatingAllowed ??
        (p.category !== "Sweet" && p.category !== "Manis"),
    }));
  return { ...state, products: [...menuProducts(), ...custom] };
}
