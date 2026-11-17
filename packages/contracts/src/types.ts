export type MenuSize = "Small" | "Medium" | "Jumbo";
export type Branch = {
  id: string;
  name: string;
  address: string;
  active: boolean;
  cashier: string;
};
export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  prices: Partial<Record<MenuSize, number>>;
  potatoNoodleAllowed: boolean;
  coatingAllowed?: boolean; // Legacy browser data, migrated on load.
  cost: number;
  stock: number;
  color: string;
  active: boolean;
};
export type Line = {
  key: string;
  productId: string;
  name: string;
  size: string;
  toppings: string[];
  category?: string;
  coating?: string;
  extraToppings?: string[];
  extra: number;
  qty: number;
  price: number;
  cost: number;
  note: string;
};
export type Order = {
  id: string;
  branch: string;
  date: string;
  time: string;
  cashier: string;
  lines: Line[];
  total: number;
  cost: number;
  method: string;
  received: number;
  status: string;
  refunded: boolean;
  refundReason?: string;
  refundDate?: string;
  recoveredCost?: number;
  number?: string;
};
export type Stock = {
  itemId?: string;
  version?: number;
  id: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  min: number;
  cost: number;
  branch: string;
};
export type Expense = {
  reversed?: boolean;
  id: string;
  name: string;
  category: string;
  amount: number;
  branch: string;
  date: string;
  method: string;
};
export type Posting = {
  id: string;
  type: string;
  item: string;
  qty: number;
  branch: string;
  date: string;
  note: string;
};
export type Shift = {
  id: string;
  branch: string;
  cashier: string;
  opening: number;
  open: boolean;
  actual?: number;
  difference?: number;
};
export type State = {
  branches: Branch[];
  products: Product[];
  orders: Order[];
  stocks: Stock[];
  expenses: Expense[];
  postings: Posting[];
  shifts: Shift[];
  business: string;
  users: {
    id: string;
    name: string;
    branch: string;
    branches?: string[];
    username?: string;
    active: boolean;
  }[];
};

export type ReportTotals = {
  from: string;
  to: string;
  branchId: string | null;
  gross: number;
  refunds: number;
  net: number;
  cogs: number;
  opex: number;
  stockLoss: number;
  profit: number;
  cashFlow: number;
  count: number;
};
export type SalesDay = {
  date: string;
  gross: number;
  refunds: number;
  net: number;
};
export type ReportProduct = {
  productId: string;
  name: string;
  category: string;
  size: string;
  sold: number;
  refunded: number;
  gross: number;
  refunds: number;
};
export type ReportModifier = {
  name: string;
  kind: string;
  sold: number;
  refunded: number;
};
export type ReportPayment = {
  method: string;
  count: number;
  refundCount: number;
  gross: number;
  refunds: number;
  net: number;
};
export type ReportOverview = {
  expenseStats?: { count: number; categories: number };
  totals: ReportTotals;
  daily: SalesDay[];
  products: ReportProduct[];
  modifiers: ReportModifier[];
  payments: ReportPayment[];
  branches: {
    id: string;
    gross: number;
    refunds: number;
    net: number;
    count: number;
    completed: number;
  }[];
  recentOrders: Order[];
};
export type OwnerOrderPage = { items: Order[]; nextCursor: string | null };
