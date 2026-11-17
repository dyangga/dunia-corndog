import { pool, transaction } from "./index";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
export async function seedDatabase() {
  return transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(77340002)");
    const existing = await tx.query("SELECT id FROM businesses LIMIT 1");
    if (existing.rowCount) {
      console.log(
        "Seed already exists; existing credentials and data preserved.",
      );
      return;
    }
    const ownerPassword = process.env.SEED_OWNER_PASSWORD;
    const cashierPassword = process.env.SEED_CASHIER_PASSWORD;
    if (!ownerPassword || !cashierPassword)
      throw new Error(
        "Set SEED_OWNER_PASSWORD and SEED_CASHIER_PASSWORD (minimum 10 characters).",
      );
    if (ownerPassword.length < 10 || cashierPassword.length < 10)
      throw new Error("Seed passwords must have at least 10 characters.");
    const business = (
      await tx.query(
        "INSERT INTO businesses(name) VALUES ('Dunia Corndog — data contoh') RETURNING id",
      )
    ).rows[0].id;
    const owner = (
      await tx.query(
        "INSERT INTO app_users(business_id,name,username,password_hash,role) VALUES ($1,'Owner', $2,$3,'OWNER') RETURNING id",
        [
          business,
          process.env.SEED_OWNER_USERNAME || "owner",
          await hash(ownerPassword),
        ],
      )
    ).rows[0].id;
    const branchIds: string[] = [];
    for (const [name, address, username, cashier] of [
      ["Dipatiukur", "Dipatiukur, Bandung", "nadia", "Nadia Putri"],
      ["Antapani", "Antapani, Bandung", "rizky", "Rizky Pratama"],
    ]) {
      const branch = (
        await tx.query(
          "INSERT INTO branches(business_id,name,address) VALUES ($1,$2,$3) RETURNING id",
          [business, name, address],
        )
      ).rows[0].id;
      branchIds.push(branch);
      const user = (
        await tx.query(
          "INSERT INTO app_users(business_id,name,username,password_hash,role) VALUES ($1,$2,$3,$4,'CASHIER') RETURNING id",
          [business, cashier, username, await hash(cashierPassword)],
        )
      ).rows[0].id;
      await tx.query("INSERT INTO user_branches VALUES ($1,$2)", [
        user,
        branch,
      ]);
    }
    async function item(
      name: string,
      unit: string,
      cost: number,
      quantity: number,
    ) {
      const id = (
        await tx.query(
          "INSERT INTO stock_items(business_id,name,unit,kind) VALUES ($1,$2,$3,'RAW') RETURNING id",
          [business, name, unit],
        )
      ).rows[0].id;
      for (const branch of branchIds) {
        await tx.query(
          "INSERT INTO stock_balances(branch_id,item_id,quantity,value,minimum) VALUES ($1,$2,$3,$4,$5)",
          [branch, id, quantity, quantity * cost, Math.floor(quantity * 0.15)],
        );
        await tx.query(
          "INSERT INTO stock_ledger(branch_id,item_id,quantity_delta,value_delta,source_type,source_id,actor_id,note) VALUES ($1,$2,$3,$4,'OPENING',$5,$6,'Saldo contoh; takaran dan biaya wajib divalidasi sebelum operasional')",
          [branch, id, quantity, quantity * cost, randomUUID(), owner],
        );
      }
      return id;
    }
    const flour = await item("Tepung premix", "g", 25, 10000),
      panir = await item("Panir", "g", 10, 10000);
    const rows: [string, string, Record<string, number>, boolean][] = [
      ["Mozzarella", "Gurih pedas", { Small: 3000 }, true],
      ["Sosis", "Gurih pedas", { Small: 3000 }, true],
      ["Full mozzarella", "Gurih pedas", { Medium: 7000, Jumbo: 10000 }, true],
      ["Full sosis", "Gurih pedas", { Medium: 7000, Jumbo: 10000 }, true],
      [
        "Mozzarella & sosis",
        "Gurih pedas",
        { Medium: 7000, Jumbo: 10000 },
        true,
      ],
      ["Beng-beng", "Manis", { Medium: 5000 }, false],
      ["Dilan", "Manis", { Medium: 5000 }, false],
      ["Full pisang", "Manis", { Medium: 7000 }, false],
      ["Pisang & mozzarella", "Manis", { Medium: 7000 }, false],
      ["Full mozzarella", "Manis", { Medium: 7000, Jumbo: 10000 }, false],
    ];
    for (const [name, category, prices, potato] of rows) {
      const p = (
        await tx.query(
          "INSERT INTO products(business_id,name,category,potato_noodle_allowed) VALUES ($1,$2,$3,$4) RETURNING id",
          [business, name, category, potato],
        )
      ).rows[0].id;
      const filling = await item(
        `Isian ${category} — ${name}`,
        "porsi",
        Math.round(Math.min(...Object.values(prices)) * 0.35),
        100,
      );
      for (const [size, price] of Object.entries(prices)) {
        const sku = (
          await tx.query(
            "INSERT INTO skus(product_id,size,price) VALUES ($1,$2,$3) RETURNING id",
            [p, size, price],
          )
        ).rows[0].id;
        for (const branch of branchIds)
          await tx.query(
            "INSERT INTO recipes(sku_id,branch_id,mode,components) VALUES ($1,$2,'MADE_TO_ORDER',$3)",
            [
              sku,
              branch,
              JSON.stringify([
                {
                  itemId: flour,
                  quantity:
                    size === "Small" ? "20" : size === "Medium" ? "35" : "50",
                },
                { itemId: panir, quantity: "8" },
                { itemId: filling, quantity: "1" },
              ]),
            ],
          );
      }
    }
    for (const [category, names, kind, price] of [
      ["Gurih pedas", ["Saus tomat", "Saus cabai", "Mayones"], "INCLUDED", 0],
      [
        "Manis",
        ["Cokelat", "Stroberi", "Tiramisu", "Taro", "Green tea"],
        "INCLUDED",
        0,
      ],
      ["Gurih pedas", ["Saus keju", "Kentang", "Mie"], "EXTRA", 1000],
      ["Manis", ["Keju parut", "Choco chip"], "EXTRA", 1000],
    ] as const) {
      for (const name of names) {
        const modifier = (
          await tx.query(
            "INSERT INTO modifiers(business_id,category,name,kind,price) VALUES ($1,$2,$3,$4,$5) RETURNING id",
            [business, category, name, kind, price],
          )
        ).rows[0].id;
        const stock = await item(
          `Topping ${name}`,
          "porsi",
          kind === "EXTRA" ? 350 : 150,
          150,
        );
        for (const branch of branchIds)
          await tx.query("INSERT INTO modifier_recipes VALUES ($1,$2,$3)", [
            modifier,
            branch,
            JSON.stringify([{ itemId: stock, quantity: "1" }]),
          ]);
      }
    }
    await tx.query(
      "INSERT INTO audit_events(business_id,actor_id,action,detail) VALUES ($1,$2,'SEED',$3)",
      [
        business,
        owner,
        JSON.stringify({
          demo: true,
          recipeWarning: "Takaran dan biaya contoh, bukan resep aktual.",
        }),
      ],
    );
    console.log(
      "Created demo business, 2 branches, owner and cashiers nadia/rizky. No fabricated sales.",
    );
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await seedDatabase();
  } finally {
    await pool.end();
  }
}
