import { menuProducts, MENU_SIZES } from "@/lib/menu";
import type { MenuSize } from "@/lib/menu";
export type {
  Branch,
  Product,
  Line,
  Order,
  Stock,
  Expense,
  Posting,
  Shift,
  State,
} from "@dc/contracts";
import type { Line, Order, State } from "@dc/contracts";
export const TODAY = "2026-11-10";
export const seed = (): State => {
  const branches = [
    {
      id: "b1",
      name: "Dipatiukur",
      address: "Jl. Dipati Ukur No. 45, Bandung",
      active: true,
      cashier: "Nadia Putri",
    },
    {
      id: "b2",
      name: "Antapani",
      address: "Jl. Terusan Jakarta No. 28, Bandung",
      active: true,
      cashier: "Rizky Pratama",
    },
  ];
  const products = menuProducts();
  const orders: Order[] = [];
  for (let day = 4; day <= 10; day++)
    for (let i = 0; i < 18 + day; i++) {
      const p = products[(i + day) % products.length],
        qty = 1 + (i % 4),
        size = MENU_SIZES.filter((size) => p.prices[size])[
          i % Object.keys(p.prices).length
        ],
        price = p.prices[size]!;
      const line: Line = {
        key: `seed-${day}-${i}`,
        productId: p.id,
        name: p.name,
        size,
        category: p.category,
        coating: "Panir",
        extraToppings: [],
        toppings: [],
        extra: 0,
        qty,
        price,
        cost: p.cost,
        note: "",
      };
      orders.push({
        id: `DC-${day.toString().padStart(2, "0")}${(i + 1).toString().padStart(3, "0")}`,
        branch: i % 3 === 0 ? "b2" : "b1",
        date: `2026-11-${day.toString().padStart(2, "0")}`,
        time: `${(10 + Math.floor(i / 3)).toString().padStart(2, "0")}:${((i * 13) % 60).toString().padStart(2, "0")}`,
        cashier: i % 3 === 0 ? "Rizky Pratama" : "Nadia Putri",
        lines: [line],
        total: price * qty,
        cost: line.cost * qty,
        method: ["QRIS", "Tunai", "QRIS", "Transfer"][i % 4],
        received: price * qty,
        status:
          day === 10 && i > 24
            ? ["Antrean", "Diproses", "Siap"][i % 3]
            : "Selesai",
        refunded: false,
      });
    }
  const stocks = branches.flatMap((b, j) => [
    {
      id: `s${j}1`,
      name: "Keju mozzarella",
      category: "Bahan baku",
      unit: "g",
      qty: j ? 3200 : 850,
      min: 1500,
      cost: 110,
      branch: b.id,
    },
    {
      id: `s${j}2`,
      name: "Sosis sapi",
      category: "Bahan baku",
      unit: "pcs",
      qty: j ? 80 : 120,
      min: 30,
      cost: 2300,
      branch: b.id,
    },
    {
      id: `s${j}3`,
      name: "Tepung premix",
      category: "Bahan baku",
      unit: "g",
      qty: j ? 1200 : 6000,
      min: 2000,
      cost: 25,
      branch: b.id,
    },
    {
      id: `s${j}4`,
      name: "Tepung roti",
      category: "Bahan baku",
      unit: "g",
      qty: 4000,
      min: 1000,
      cost: 30,
      branch: b.id,
    },
    {
      id: `s${j}5`,
      name: "Corndog siap goreng",
      category: "Produk siap jual",
      unit: "pcs",
      qty: j ? 8 : 32,
      min: 15,
      cost: 7500,
      branch: b.id,
    },
  ]);
  return {
    branches,
    products,
    orders,
    stocks,
    expenses: [
      {
        id: "e1",
        name: "Sewa outlet November",
        category: "Sewa",
        amount: 450000,
        branch: "b1",
        date: TODAY,
        method: "Transfer",
      },
      {
        id: "e2",
        name: "Listrik outlet",
        category: "Utilitas",
        amount: 175000,
        branch: "b2",
        date: "2026-11-08",
        method: "Transfer",
      },
      {
        id: "e3",
        name: "Transportasi operasional",
        category: "Transportasi",
        amount: 50000,
        branch: "b1",
        date: "2026-11-07",
        method: "Tunai",
      },
    ],
    postings: [],
    shifts: [
      {
        id: "sh1",
        branch: "b1",
        cashier: "Nadia Putri",
        opening: 200000,
        open: true,
      },
      {
        id: "sh2",
        branch: "b2",
        cashier: "Rizky Pratama",
        opening: 150000,
        open: true,
      },
    ],
    business: "Dunia Corndog",
    users: [
      { id: "u1", name: "Nadia Putri", branch: "b1", active: true },
      { id: "u2", name: "Rizky Pratama", branch: "b2", active: true },
    ],
  };
};
