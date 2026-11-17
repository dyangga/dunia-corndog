import { describe, expect, it } from "vitest";
import { seed } from "@/lib/demo";
import { lineOptions, migrateMenu } from "@/lib/menu";

describe("legacy catalogue migration", () => {
  it("upgrades topping availability while keeping historical order totals", () => {
    const legacy = seed();
    legacy.products = legacy.products.map(({ potatoNoodleAllowed, ...p }) => ({
      ...p,
      potatoNoodleAllowed: undefined!,
      coatingAllowed: false,
    }));
    legacy.orders[0].lines[0].coating = "Kentang";
    const before = legacy.orders[0].total;
    const migrated = migrateMenu(legacy);
    expect(
      migrated.products.every((p) => p.potatoNoodleAllowed === false),
    ).toBe(true);
    expect(migrated.orders[0].total).toBe(before);
    expect(lineOptions(migrated.orders[0].lines[0])).toContain("Panir");
    expect(lineOptions(migrated.orders[0].lines[0])).toContain(
      "Kentang (+Rp1.000)",
    );
  });
  it("preserves transaction snapshots and owner-created fillings", () => {
    const legacy = JSON.parse(JSON.stringify(seed()));
    legacy.products = [
      {
        id: "p1",
        name: "Mozzarella Corndog",
        category: "Corndog",
        price: 18000,
        cost: 7500,
        stock: 56,
        color: "gold",
        active: true,
      },
      {
        id: "owner-custom",
        name: "Pisang spesial",
        category: "Sweet",
        price: 8500,
        cost: 2500,
        stock: 9,
        color: "choco",
        active: false,
      },
    ];
    legacy.orders[0].lines[0].name = "Menu historis";
    const migrated = migrateMenu(legacy);
    expect(migrated.orders).toBe(legacy.orders);
    expect(
      migrated.products.find((p) => p.id === "owner-custom"),
    ).toMatchObject({
      name: "Pisang spesial",
      category: "Manis",
      prices: { Medium: 8500 },
      stock: 9,
      cost: 2500,
      active: false,
    });
    expect(migrated.products.some((p) => p.id === "p1")).toBe(false);
    expect(migrateMenu(migrated)).toBe(migrated);
  });
});
