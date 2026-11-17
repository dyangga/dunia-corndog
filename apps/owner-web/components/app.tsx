"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  QrCode,
  RotateCcw,
  Pencil,
  LayoutDashboard,
  ReceiptText,
  Package,
  Boxes,
  Store,
  Users,
  Settings,
  ChartNoAxesCombined,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  ChevronRight,
  CalendarDays,
  Bell,
  Search,
  Plus,
  Download,
  SlidersHorizontal,
  MoreHorizontal,
  Menu,
  X,
  LogOut,
  ShoppingBag,
  Check,
  CheckCheck,
  Clock,
  TriangleAlert,
  Info,
  RefreshCw,
  Trash2,
  Minus,
  CreditCard,
  Banknote,
  Smartphone,
  ChefHat,
  ArrowLeftRight,
  ClipboardList,
  Flame,
  HelpCircle,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebarMotion } from "@/hooks/use-sidebar-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BusinessDialog as Dialog,
  BusinessSelect,
  FilterTabs,
  StatusBadge as Badge,
  Field,
} from "@/components/business-ui";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import Corndog from "./corndog";
import dynamic from "next/dynamic";
import { CatalogPage } from "./catalog-page";
import InventoryToolsShell, {
  type InventoryToolsHandle,
} from "./inventory-tools-shell";
import { ConfirmationProvider, StatusActionButton } from "./confirmation";
import { ProductFields } from "./product-fields";
import { PaginatedList } from "./paginated-list";
const SalesTrend = dynamic(
  () => import("./sales-trend").then((m) => m.SalesTrend),
  {
    loading: () => (
      <div className="sales-trend" style={{ minHeight: 368 }} role="status">
        Memuat tren penjualan…
      </div>
    ),
  },
);
const InventoryPage = dynamic(
  () => import("./inventory-page").then((m) => m.InventoryPage),
  { loading: () => <p role="status">Memuat persediaan…</p> },
);
const ExpenseHistory = dynamic(
  () => import("./owner-history").then((m) => m.ExpenseHistory),
  {
    loading: () => (
      <div className="panel" style={{ minHeight: 260 }} role="status">
        Memuat riwayat pengeluaran…
      </div>
    ),
  },
);
const ShiftMonitor = dynamic(
  () => import("./owner-history").then((m) => m.ShiftMonitor),
  {
    loading: () => (
      <div className="panel" style={{ minHeight: 260 }} role="status">
        Memuat monitor shift…
      </div>
    ),
  },
);
import { OwnerTransactions } from "./owner-transactions";
const ReportPayments = dynamic(
  () => import("./report-breakdowns").then((m) => m.ReportPayments),
  {
    loading: () => (
      <div className="panel" style={{ minHeight: 260 }} role="status">
        Memuat pembayaran…
      </div>
    ),
  },
);
const ReportBreakdowns = dynamic(
  () => import("./report-breakdowns").then((m) => m.ReportBreakdowns),
  {
    loading: () => (
      <div style={{ minHeight: 260 }} role="status">
        Memuat rincian laporan…
      </div>
    ),
  },
);
import { useOwnerReport } from "@/hooks/use-owner-report";
import type { Connection } from "@/lib/connection";
import { ApiError } from "@dc/contracts";
import { OwnerRequests, RefundRestock } from "./owner-operations";
import {
  MENU_SIZES,
  MENU_CATEGORIES,
  INCLUDED_TOPPINGS,
  EXTRA_TOPPINGS,
  EXTRA_PRICE,
  menuPrice,
  migrateMenu,
  lineOptions,
  type MenuSize,
} from "@/lib/menu";
import { money, number } from "@/lib/utils";
import {
  seed,
  TODAY,
  type State,
  type Order,
  type Line,
  type Product,
} from "@/lib/demo";
const nav: { id: string; label: string; icon: LucideIcon; group: string }[] = [
  {
    id: "dashboard",
    label: "Ringkasan",
    icon: LayoutDashboard,
    group: "Utama",
  },
  {
    id: "reports",
    label: "Laporan keuangan",
    icon: ChartNoAxesCombined,
    group: "Utama",
  },
  { id: "catalog", label: "Katalog menu", icon: Package, group: "Operasional" },
  {
    id: "inventory",
    label: "Stok & produksi",
    icon: Boxes,
    group: "Operasional",
  },
  { id: "expenses", label: "Pengeluaran", icon: Wallet, group: "Operasional" },
  { id: "branches", label: "Cabang", icon: Store, group: "Kelola usaha" },
  { id: "users", label: "Tim & shift", icon: Users, group: "Kelola usaha" },
  {
    id: "settings",
    label: "Pengaturan",
    icon: Settings,
    group: "Kelola usaha",
  },
];
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
function Empty({
  text = "Belum ada data untuk filter ini.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Package size={30} />
      <b>{text}</b>
      <span>Data baru akan muncul di sini.</span>
    </div>
  );
}

function OrderTable({
  items,
  compact = false,
  branchName,
  onSelect,
}: {
  items: Order[];
  compact?: boolean;
  branchName: (id: string) => string;
  onSelect: (order: Order) => void;
}) {
  return (
    <div className="table-scroll">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nomor transaksi</TableHead>
            <TableHead>Cabang</TableHead>
            {!compact && <TableHead>Waktu</TableHead>}
            <TableHead>Pembayaran</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((o) => (
            <TableRow
              key={o.id}
              onClick={() => onSelect(o)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSelect(o);
                }
              }}
            >
              <TableCell>
                <b className="order-id">#{o.number || o.id}</b>
                <small>{o.cashier}</small>
              </TableCell>
              <TableCell>{branchName(o.branch)}</TableCell>
              {!compact && (
                <TableCell>
                  {o.date}
                  <small>{o.time} WIB</small>
                </TableCell>
              )}
              <TableCell>
                <span className="payment-label">
                  {o.method === "Tunai" ? (
                    <Banknote size={14} />
                  ) : o.method === "QRIS" ? (
                    <Smartphone size={14} />
                  ) : (
                    <CreditCard size={14} />
                  )}{" "}
                  {o.method}
                </span>
              </TableCell>
              <TableCell className="numeric">
                <b>{money(o.total)}</b>
              </TableCell>
              <TableCell>
                <Badge>{o.refunded ? "Refund" : o.status}</Badge>
              </TableCell>
              <TableCell>
                <ChevronRight size={16} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!items.length && <Empty />}
    </div>
  );
}
function Metric({
  label,
  value,
  icon: Icon,
  foot,
  accent = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  foot: string;
  accent?: boolean;
}) {
  return (
    <Card className={`metric ${accent ? "metric-accent" : ""}`}>
      <div className="metric-label">
        {label}
        <span className="metric-icon">
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="metric-foot">
        <span className="tiny-dot" />
        {foot}
      </div>
    </Card>
  );
}

type AppProps = { initialPage?: string; connected?: Connection };
export default function App(props: AppProps) {
  return (
    <ConfirmationProvider>
      <OwnerWorkspace {...props} />
    </ConfirmationProvider>
  );
}
function OwnerWorkspace({
  initialPage = "dashboard",
  connected,
}: {
  initialPage?: string;
  connected?: Connection;
}) {
  const inventoryTools = useRef<InventoryToolsHandle>(null);
  const live = !!connected;
  const today = live
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
        new Date(),
      )
    : TODAY;
  const weekStart = live
    ? new Date(Date.now() - 6 * 86400000).toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      })
    : "2026-11-04";
  const [data, setData] = useState<State>(() => connected?.state || seed()),
    [ready, setReady] = useState(false),
    [page, setPage] = useState(
      initialPage === "orders" ? "reports" : initialPage,
    ),
    [branch, setBranch] = useState("all"),
    [period, setPeriod] = useState("week"),
    [start, setStart] = useState(weekStart),
    [end, setEnd] = useState(today),
    [mobile, setMobile] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(true),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(""),
    [editingStaff, setEditingStaff] = useState<string | null>(null),
    [editingProduct, setEditingProduct] = useState<string | null>(null),
    [closingShift, setClosingShift] = useState<State["shifts"][number] | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Order | null>(null),
    [search, setSearch] = useState(""),
    [tab, setTab] = useState("Semua"),
    [financialTab, setFinancialTab] = useState(
      initialPage === "orders" ? "Transaksi" : "Ringkasan",
    ),
    [role, setRole] = useState("owner"),
    [cashBranch, setCashBranch] = useState("b1"),
    [cart, setCart] = useState<Line[]>([]),
    [product, setProduct] = useState<Product | null>(null),
    [size, setSize] = useState<MenuSize>("Small"),
    [customizeOpen, setCustomizeOpen] = useState(false),
    [menuCategory, setMenuCategory] = useState<string>("Gurih pedas"),
    [paidToppings, setPaidToppings] = useState<string[]>([]),
    [toppings, setToppings] = useState<string[]>([]),
    [qty, setQty] = useState(1),
    [note, setNote] = useState(""),
    [method, setMethod] = useState("Tunai"),
    [received, setReceived] = useState(""),
    [verified, setVerified] = useState(false),
    [online, setOnline] = useState(true),
    [receipt, setReceipt] = useState<Order | null>(null),
    [read, setRead] = useState(false),
    [loginRole, setLoginRole] = useState("owner");
  const { motionEnabled: sidebarMotion, toggle: toggleSidebar } =
    useSidebarMotion(setSidebarOpen, !["pos", "queue", "login"].includes(page));
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dc-demo-v1");
      if (saved && !live) setData(migrateMenu(JSON.parse(saved)));
      const sidebarPreference = localStorage.getItem("dc-sidebar-open");
      if (sidebarPreference !== null)
        setSidebarOpen(sidebarPreference !== "false");
    } catch {}
    const path = location.pathname.slice(1);
    if (
      [
        ...nav.map((n) => n.id),
        "pos",
        "queue",
        "login",
        "notifications",
        "orders",
      ].includes(path)
    ) {
      setPage(path === "orders" ? "reports" : path);
      setFinancialTab(path === "orders" ? "Transaksi" : "Ringkasan");
    }
    setReady(true);
    document.documentElement.dataset.ready = "1";
    setOnline(navigator.onLine);
    const on = () => setOnline(navigator.onLine);
    addEventListener("online", on);
    addEventListener("offline", on);
    const pop = () => {
      const path = location.pathname.slice(1) || "dashboard";
      setPage(path === "orders" ? "reports" : path);
      setFinancialTab(path === "orders" ? "Transaksi" : "Ringkasan");
      setSearch("");
      setTab("Semua");
    };
    addEventListener("popstate", pop);
    return () => {
      delete document.documentElement.dataset.ready;
      removeEventListener("online", on);
      removeEventListener("offline", on);
      removeEventListener("popstate", pop);
    };
  }, []);
  useEffect(() => {
    if (ready && !live)
      localStorage.setItem("dc-demo-v1", JSON.stringify(data));
  }, [data, ready]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("dc-sidebar-open", String(sidebarOpen));
    } catch {
      // The toggle still works when browser storage is unavailable.
    }
  }, [sidebarOpen, ready]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    setCart([]);
    setReceipt(null);
  }, [cashBranch]);
  useEffect(() => {
    if (connected) setData(connected.state);
  }, [connected?.state]);
  const pendingKeys = useRef(new Map<string, string>());
  const countVersions = useRef<Record<string, number>>({});
  const mutate = useCallback(
    async function mutate(path: string, body: unknown, method = "POST") {
      if (!connected) return;
      const fingerprint = JSON.stringify([path, body]);
      const persistent = [
        "/inventory/",
        "/production",
        "/expenses",
        "/orders/",
      ].some((p) => path.startsWith(p));
      const hash = persistent
        ? Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(fingerprint),
              ),
            ),
          )
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
        : "";
      const storageKey = `dc.op.${connected.user.id}.${hash}`;
      const key =
        pendingKeys.current.get(fingerprint) ||
        (persistent ? sessionStorage.getItem(storageKey) : null) ||
        crypto.randomUUID();
      if (persistent) sessionStorage.setItem(storageKey, key);
      pendingKeys.current.set(fingerprint, key);
      setBusy(true);
      try {
        const result = await connected.request(path, { method, body, key });
        pendingKeys.current.delete(fingerprint);
        if (persistent) sessionStorage.removeItem(storageKey);
        await connected.refresh();
        notify("Perubahan berhasil disimpan.");
        return result;
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status > 0 &&
          error.status < 500
        ) {
          pendingKeys.current.delete(fingerprint);
          if (persistent) sessionStorage.removeItem(storageKey);
        }
        notify((error as Error).message);
        throw error;
      } finally {
        setBusy(false);
      }
    },
    [connected],
  );
  const go = (p: string) => {
    if (connected && ["pos", "queue"].includes(p)) {
      notify(
        "Mode kasir tersedia di aplikasi Expo. Login menggunakan akun staf.",
      );
      return;
    }
    if (connected && p === "login") {
      void connected.logout();
      return;
    }
    const nextPage = p === "orders" ? "reports" : p;
    setPage(nextPage);
    if (p === "orders") setFinancialTab("Transaksi");
    else if (p === "reports") setFinancialTab("Ringkasan");
    setSearch("");
    setTab("Semua");
    setMobile(false);
    history.pushState({}, "", `/${nextPage}`);
  };
  const notify = useCallback((message: string) => setToast(message), []);
  const openModal = useCallback(
    (name: string) => {
      if (name === "production" && connected)
        inventoryTools.current?.open("production");
      else setModal(name);
    },
    [connected],
  );
  const openOrder = (order: Order) => {
    setSelected(order);
    setModal("order");
  };
  const branchName = useCallback(
    (id: string) => data.branches.find((b) => b.id === id)?.name || id,
    [data.branches],
  );
  const editProduct = useCallback((product: Product) => {
    setEditingProduct(product.id);
    setModal("product");
  }, []);
  const toggleProduct = useCallback(
    (product: Product) => {
      if (connected) {
        return mutate(
          `/products/${product.id}`,
          {
            name: product.name,
            category: product.category,
            prices: product.prices,
            potatoNoodleAllowed: product.potatoNoodleAllowed,
            active: !product.active,
          },
          "PATCH",
        );
      }
      setData((old) => ({
        ...old,
        products: old.products.map((item) =>
          item.id === product.id ? { ...item, active: !item.active } : item,
        ),
      }));
      setToast("Status menu demo diperbarui.");
    },
    [connected, mutate],
  );
  const yesterday = new Date(
    new Date(`${today}T12:00:00Z`).getTime() - 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const from =
    period === "today"
      ? today
      : period === "yesterday"
        ? yesterday
        : period === "month"
          ? `${today.slice(0, 7)}-01`
          : period === "week"
            ? weekStart
            : start;
  const to =
    period === "custom" ? end : period === "yesterday" ? yesterday : today;
  const inRange = (date: string) => date >= from && date <= to;
  const reportEnabled = [
    "dashboard",
    "reports",
    "expenses",
    "branches",
  ].includes(page);
  const {
    data: overview,
    updatedAt: reportUpdatedAt,
    pending: reportPending,
    error: reportError,
    retry: retryReport,
  } = useOwnerReport(connected, from, to, branch, reportEnabled);
  const serverTotals = overview?.totals;
  const orders = live
    ? overview?.recentOrders || []
    : data.orders.filter(
        (o) => (branch === "all" || o.branch === branch) && inRange(o.date),
      );
  const costs = data.expenses.filter(
    (e) => (branch === "all" || e.branch === branch) && inRange(e.date),
  );
  const reportMoney = (value: number) =>
    live && !serverTotals ? "—" : money(value);
  const orderCount = live ? serverTotals?.count : orders.length;
  const gross = live
      ? serverTotals?.gross || 0
      : orders.reduce((s, o) => s + o.total, 0),
    refunds = live
      ? serverTotals?.refunds || 0
      : data.orders
          .filter(
            (o) =>
              o.refunded &&
              (branch === "all" || o.branch === branch) &&
              inRange(o.refundDate || today),
          )
          .reduce((s, o) => s + o.total, 0),
    net = gross - refunds,
    cogs = live
      ? serverTotals?.cogs || 0
      : orders.reduce((s, o) => s + o.cost, 0),
    opex = live
      ? serverTotals?.opex || 0
      : costs.reduce((s, e) => s + e.amount, 0),
    profit = live ? serverTotals?.profit || 0 : net - cogs - opex;
  const stocks = useMemo(
    () =>
      data.stocks.filter((item) => branch === "all" || item.branch === branch),
    [data.stocks, branch],
  );
  const low = useMemo(
    () => stocks.filter((item) => item.qty < item.min),
    [stocks],
  );
  const beginCount = useCallback(() => {
    countVersions.current = Object.fromEntries(
      stocks.map((item) => [item.id, item.version || 0]),
    );
  }, [stocks]);
  const expenseCount = live ? overview?.expenseStats?.count : costs.length;
  const expenseCategories = live
    ? overview?.expenseStats?.categories
    : new Set(costs.map((item) => item.category)).size;
  const cashier = page === "pos" || page === "queue";
  const cashShift = data.shifts.find((s) => s.branch === cashBranch && s.open);
  const cashOrders = data.orders.filter(
    (o) => o.branch === cashBranch && o.date === today,
  );
  const cartTotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const filteredOrders = orders
    .filter(
      (o) =>
        (tab === "Semua" ||
          (tab === "Refund" ? o.refunded : o.method === tab)) &&
        `${o.number || o.id} ${o.id} ${o.cashier} ${branchName(o.branch)}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const best = useMemo(() => {
    if (live)
      return (overview?.products || [])
        .filter((p) => p.sold > 0)
        .map((p) => ({
          name: `${p.name} · ${p.size}`,
          qty: p.sold,
          amount: p.gross,
          color: p.category === "Manis" ? "choco" : "gold",
        }));
    const map = new Map<
      string,
      { name: string; qty: number; amount: number; color: string }
    >();
    orders
      .filter((o) => !o.refunded)
      .forEach((o) =>
        o.lines.forEach((l) => {
          const old = map.get(l.productId) || {
            name: l.name,
            qty: 0,
            amount: 0,
            color:
              data.products.find((p) => p.id === l.productId)?.color || "gold",
          };
          old.qty += l.qty;
          old.amount += l.qty * l.price;
          map.set(l.productId, old);
        }),
      );
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [orders, data.products, live, overview]);
  async function exportCSV() {
    if (connected) {
      try {
        const transactions = page === "reports" && financialTab === "Transaksi";
        const urlPath = `/api/v1/${transactions ? "orders" : "reports"}/export?from=${from}&to=${to}${branch === "all" ? "" : `&branchId=${branch}`}${transactions ? `&method=${encodeURIComponent(tab)}&search=${encodeURIComponent(search)}` : ""}`;
        const r = await fetch(urlPath, { credentials: "include" });
        if (!r.ok) throw new Error("Ekspor gagal.");
        const url = URL.createObjectURL(await r.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = "laporan-dunia-corndog.csv";
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        notify((e as Error).message);
      }
      return;
    }
    const safe = (v: unknown) => {
      let t = String(v);
      if (/^[=+@\-]/.test(t)) t = "'" + t;
      return '"' + t.replaceAll('"', '""') + '"';
    };
    const rows = [
      [
        "Nomor",
        "Tanggal (Asia/Jakarta)",
        "Cabang",
        "Kasir",
        "Metode",
        "Bruto (IDR)",
        "Refund (IDR)",
        "Neto (IDR)",
        "HPP (IDR)",
      ],
      ...orders.map((o) => [
        o.id,
        o.date,
        branchName(o.branch),
        o.cashier,
        o.method,
        o.total,
        0,
        o.total,
        o.cost,
      ]),
      ...data.orders
        .filter(
          (o) =>
            o.refunded &&
            (branch === "all" || o.branch === branch) &&
            inRange(o.refundDate || today),
        )
        .map((o) => [
          o.id + "-REFUND",
          o.refundDate,
          branchName(o.branch),
          o.cashier,
          o.method,
          0,
          o.total,
          -o.total,
          0,
        ]),
    ];
    const blob = new Blob(
      ["\uFEFF" + rows.map((r) => r.map(safe).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dunia-corndog-penjualan-demo.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    notify("Laporan demo berhasil diekspor.");
  }
  const fillings = data.products.filter(
    (p) => p.category === menuCategory && p.prices[size],
  );
  const customizationPrice = product
    ? menuPrice(product, size, paidToppings)
    : 0;
  function chooseCategory(category: string, selectedSize = size) {
    setMenuCategory(category);
    setQty(1);
    setProduct(
      data.products.find(
        (p) =>
          p.category === category &&
          p.prices[selectedSize] &&
          p.active &&
          p.stock > 0,
      ) || null,
    );
    setToppings([]);
    setPaidToppings([]);
  }
  function openSize(selectedSize: MenuSize) {
    setSize(selectedSize);
    const first = data.products.find(
      (p) => p.prices[selectedSize] && p.active && p.stock > 0,
    );
    chooseCategory(first?.category || "Gurih pedas", selectedSize);
    setQty(1);
    setNote("");
    setCustomizeOpen(true);
  }
  function addItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!product || !product.active || !product.prices[size]) return;
    const reserved = cart
      .filter((l) => l.productId === product.id)
      .reduce((sum, l) => sum + l.qty, 0);
    if (reserved + qty > product.stock) {
      notify("Stok isian tidak mencukupi. Tinjau jumlah pesanan.");
      return;
    }
    const key = [
      product.id,
      size,
      "Panir",
      [...toppings].sort().join(","),
      [...paidToppings].sort().join(","),
      note,
    ].join("|");
    const line: Line = {
      key,
      productId: product.id,
      name: product.name,
      size,
      category: product.category,
      coating: "Panir",
      toppings,
      extraToppings: paidToppings,
      extra: 0,
      qty,
      price: customizationPrice,
      cost: product.cost,
      note,
    };
    setCart((c) =>
      c.some((l) => l.key === key)
        ? c.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l))
        : [...c, line],
    );
    setCustomizeOpen(false);
    notify(`${size} ${product.name} ditambahkan ke pesanan.`);
  }
  function checkout(e: FormEvent) {
    e.preventDefault();
    if (!online || !cashShift || !cart.length) return;
    if (method === "Tunai" && Number(received) < cartTotal) return;
    if (method !== "Tunai" && !verified) return;
    if (
      cart.some(
        (l) =>
          cart
            .filter((x) => x.productId === l.productId)
            .reduce((s, x) => s + x.qty, 0) >
          (data.products.find((p) => p.id === l.productId)?.stock || 0),
      )
    ) {
      notify("Stok menu tidak mencukupi. Tinjau jumlah pesanan.");
      return;
    }
    const order: Order = {
      id: `DC-10${String(data.orders.filter((o) => o.date === today).length + 1).padStart(3, "0")}`,
      branch: cashBranch,
      date: today,
      time: new Date()
        .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        .replace(".", ":"),
      cashier: cashShift.cashier,
      lines: cart,
      total: cartTotal,
      cost: cart.reduce((s, l) => s + l.cost * l.qty, 0),
      method,
      received: method === "Tunai" ? Number(received) : cartTotal,
      status: "Antrean",
      refunded: false,
    };
    setData((d) => ({
      ...d,
      orders: [...d.orders, order],
      products: d.products.map((p) => ({
        ...p,
        stock:
          p.stock -
          cart
            .filter((l) => l.productId === p.id)
            .reduce((s, l) => s + l.qty, 0),
      })),
    }));
    setCart([]);
    setModal("");
    setReceipt(order);
    notify("Pembayaran demo dicatat. Pesanan masuk antrean.");
  }
  async function submitForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      v = (s: string) => String(f.get(s) || ""),
      n = (s: string) => Number(f.get(s) || 0),
      b = v("branch") || "b1",
      id = uid();
    if (connected) {
      try {
        if (modal === "user")
          await mutate(
            editingStaff ? `/staff/${editingStaff}` : "/staff",
            {
              name: v("name"),
              username: v("username"),
              ...(v("password") ? { password: v("password") } : {}),
              branches: f.getAll("staff-branch").map(String),
              active: editingStaff
                ? data.users.find((u) => u.id === editingStaff)!.active
                : true,
            },
            editingStaff ? "PATCH" : "POST",
          );
        else if (modal === "branch")
          await mutate("/branches", { name: v("name"), address: v("address") });
        else if (modal === "product")
          await mutate(
            editingProduct ? `/products/${editingProduct}` : "/products",
            {
              active: editingProduct
                ? data.products.find((p) => p.id === editingProduct)?.active
                : true,
              name: v("name"),
              category: v("category"),
              prices: Object.fromEntries(
                MENU_SIZES.filter((size) => n(`price-${size}`) > 0).map(
                  (size) => [size, n(`price-${size}`)],
                ),
              ),
              potatoNoodleAllowed: f.get("potato-noodle") === "on",
            },
            editingProduct ? "PATCH" : "POST",
          );
        else if (modal === "expense")
          await mutate("/expenses", {
            name: v("name"),
            category: v("category"),
            amount: n("amount"),
            branchId: b,
            method: v("method"),
            shiftId:
              v("funding-shift") && v("funding-shift") !== "external"
                ? v("funding-shift")
                : undefined,
          });
        else if (modal === "refund" && selected)
          await mutate(`/orders/${selected.id}/refund`, {
            reason: v("reason"),
            method: v("refund-method"),
            reference: v("refund-reference"),
            shiftId:
              v("funding-shift") && v("funding-shift") !== "external"
                ? v("funding-shift")
                : undefined,
            restock: [],
          });
        else if (["stock-in", "transfer", "waste", "count"].includes(modal)) {
          const stock = data.stocks.find((s) => s.id === v("item"));
          if (!stock) return;
          const [, itemId] = stock.id.split(":");
          await mutate(
            `/inventory/${modal === "stock-in" ? "receive" : modal}`,
            {
              branchId: stock.branch,
              itemId,
              quantity: v("amount"),
              note: v("reason"),
              targetBranchId: modal === "transfer" ? v("target") : undefined,
              version:
                modal === "count"
                  ? countVersions.current[stock.id]
                  : stock.version,
              unitCost: v("unit-cost") || undefined,
              method: v("method") || "Transfer",
              shiftId:
                v("funding-shift") && v("funding-shift") !== "external"
                  ? v("funding-shift")
                  : undefined,
            },
          );
        } else {
          notify(
            "Gunakan panel resep untuk produksi, atau aplikasi kasir untuk shift.",
          );
          return;
        }
        setModal("");
        setEditingStaff(null);
      } catch {}
      return;
    }
    if (modal === "expense")
      setData((d) => ({
        ...d,
        expenses: [
          ...d.expenses,
          {
            id,
            name: v("name"),
            category: v("category"),
            amount: n("amount"),
            branch: b,
            date: today,
            method: v("method"),
          },
        ],
      }));
    if (modal === "branch")
      setData((d) => ({
        ...d,
        branches: [
          ...d.branches,
          {
            id,
            name: v("name"),
            address: v("address"),
            active: true,
            cashier: "Belum ditugaskan",
          },
        ],
      }));
    if (modal === "user")
      setData((d) => ({
        ...d,
        users: [...d.users, { id, name: v("name"), branch: b, active: true }],
      }));
    if (modal === "product") {
      const prices = Object.fromEntries(
        MENU_SIZES.filter((size) => n(`price-${size}`) > 0).map((size) => [
          size,
          n(`price-${size}`),
        ]),
      );
      if (!Object.keys(prices).length) {
        notify("Isi harga untuk minimal satu ukuran.");
        return;
      }
      if (
        data.products.some(
          (p) =>
            p.category === v("category") &&
            p.name.toLowerCase() === v("name").trim().toLowerCase(),
        )
      ) {
        notify("Isian dengan kategori tersebut sudah ada.");
        return;
      }
      setData((d) => ({
        ...d,
        products: [
          ...d.products,
          {
            id,
            name: v("name").trim(),
            category: v("category"),
            prices,
            price: Math.min(...Object.values(prices)),
            cost: 0,
            stock: n("stock"),
            potatoNoodleAllowed:
              v("category") === "Gurih pedas" &&
              f.get("potato-noodle") === "on",
            color: v("category") === "Manis" ? "choco" : "gold",
            active: true,
          },
        ],
      }));
    }
    if (modal === "refund" && selected) {
      setData((d) => ({
        ...d,
        orders: d.orders.map((o) =>
          o.id === selected.id
            ? {
                ...o,
                refunded: true,
                refundReason: v("reason"),
                refundDate: today,
                status: o.status === "Selesai" ? "Selesai" : "Dibatalkan",
              }
            : o,
        ),
      }));
      setSelected(null);
    }
    if (
      ["stock-in", "production", "transfer", "waste", "count"].includes(modal)
    ) {
      const item = data.stocks.find((s) => s.id === v("item"));
      if (!item) return;
      const amount = n("amount"),
        delta =
          modal === "waste" || modal === "transfer"
            ? -amount
            : modal === "count"
              ? amount - item.qty
              : amount;
      if (item.qty + delta < 0) {
        notify("Jumlah melebihi stok tersedia.");
        return;
      }
      if (
        modal === "transfer" &&
        (item.branch === v("target") ||
          !data.stocks.some(
            (s) => s.branch === v("target") && s.name === item.name,
          ))
      ) {
        notify("Pilih cabang tujuan berbeda yang memiliki item sama.");
        return;
      }
      if (modal === "production") {
        const flour = data.stocks.find(
            (s) => s.branch === item.branch && s.name === "Tepung premix",
          ),
          cheese = data.stocks.find(
            (s) => s.branch === item.branch && s.name === "Keju mozzarella",
          );
        if (
          !flour ||
          !cheese ||
          flour.qty < amount * 50 ||
          cheese.qty < amount * 30
        ) {
          notify(
            "Bahan produksi tidak cukup (50 g premix + 30 g mozzarella / pcs).",
          );
          return;
        }
      }
      setData((d) => ({
        ...d,
        stocks: d.stocks.map((s) => {
          if (s.id === item.id) return { ...s, qty: s.qty + delta };
          if (
            modal === "transfer" &&
            s.branch === v("target") &&
            s.name === item.name
          )
            return { ...s, qty: s.qty + amount };
          if (
            modal === "production" &&
            s.branch === item.branch &&
            s.name === "Tepung premix"
          )
            return { ...s, qty: s.qty - amount * 50 };
          if (
            modal === "production" &&
            s.branch === item.branch &&
            s.name === "Keju mozzarella"
          )
            return { ...s, qty: s.qty - amount * 30 };
          return s;
        }),
        postings: [
          {
            id,
            type: modal,
            item: item.name,
            qty: delta,
            branch: item.branch,
            date: today,
            note: v("reason"),
          },
          ...d.postings,
        ],
      }));
    }
    if (modal === "open-shift")
      setData((d) => ({
        ...d,
        shifts: [
          ...d.shifts,
          {
            id,
            branch: cashBranch,
            cashier:
              data.users.find((u) => u.branch === cashBranch && u.active)
                ?.name || "Kasir demo",
            opening: n("amount"),
            open: true,
          },
        ],
      }));
    if (modal === "close-shift" && cashShift) {
      const expected =
        cashShift.opening +
        cashOrders
          .filter((o) => o.method === "Tunai" && !o.refunded)
          .reduce((s, o) => s + o.total, 0);
      setData((d) => ({
        ...d,
        shifts: d.shifts.map((s) =>
          s.id === cashShift.id
            ? {
                ...s,
                open: false,
                actual: n("amount"),
                difference: n("amount") - expected,
              }
            : s,
        ),
      }));
      setCart([]);
    }
    setModal("");
    notify("Perubahan demo berhasil disimpan.");
  }
  const title =
    nav.find((n) => n.id === page)?.label ||
    {
      pos: "Kasir",
      queue: "Antrean pesanan",
      notifications: "Notifikasi",
      login: "Masuk",
    }[page] ||
    "Ringkasan";
  const filters = (
    <div className="filters">
      <div className="filter-select">
        <BusinessSelect
          label="Filter cabang"
          startIcon={<Store size={15} aria-hidden="true" />}
          value={branch}
          onValueChange={setBranch}
          options={[
            { value: "all", label: "Semua cabang" },
            ...data.branches.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
      </div>
      <div className="filter-select">
        <BusinessSelect
          label="Periode laporan"
          startIcon={<CalendarDays size={15} aria-hidden="true" />}
          value={period}
          onValueChange={setPeriod}
          options={[
            {
              value: "week",
              label: live ? "7 hari terakhir" : "4 – 10 Nov 2026",
            },
            { value: "today", label: live ? "Hari ini" : "Hari ini, 10 Nov" },
            { value: "yesterday", label: "Kemarin" },
            { value: "month", label: "Bulan ini" },
            { value: "custom", label: "Pilih tanggal" },
          ]}
        />
      </div>
      {period === "custom" && (
        <>
          <Input
            aria-label="Tanggal mulai"
            type="date"
            max={end}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <span>—</span>
          <Input
            aria-label="Tanggal akhir"
            type="date"
            min={start}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </>
      )}
    </div>
  );
  const metrics = (
    <div className="metrics" aria-busy={live && reportPending}>
      <Metric
        label="Penjualan neto"
        value={reportMoney(net)}
        icon={Wallet}
        foot={`${orderCount === undefined ? "—" : number(orderCount)} transaksi dalam periode`}
        accent
      />
      <Metric
        label="Total pesanan"
        value={orderCount === undefined ? "—" : number(orderCount)}
        icon={ShoppingBag}
        foot={`${live ? (overview?.branches.reduce((n, b) => n + b.completed, 0) ?? "—") : orders.filter((o) => o.status === "Selesai").length} pesanan selesai`}
      />
      <Metric
        label="Estimasi laba operasional"
        value={reportMoney(profit)}
        icon={ChartNoAxesCombined}
        foot={`Setelah HPP & pengeluaran`}
      />
      <Metric
        label="Rata-rata transaksi"
        value={reportMoney(orderCount ? Math.round(gross / orderCount) : 0)}
        icon={ReceiptText}
        foot="Penjualan bruto ÷ transaksi"
      />
    </div>
  );
  if (page === "login")
    return (
      <div className="login-screen">
        <div className="login-brand">
          <div className="brand-icon">
            <Flame />
          </div>
          <h1>
            Dunia Corndog<span>Pencatatan keuangan dan operasional usaha.</span>
          </h1>
          <Corndog id="login" />
        </div>
        <form
          className="login-form wrap"
          id="main-content"
          tabIndex={-1}
          onSubmit={(e) => {
            e.preventDefault();
            setRole(loginRole);
            go(loginRole === "owner" ? "dashboard" : "pos");
            notify("Berhasil masuk ke mode demo.");
          }}
        >
          <span className="eyebrow">Ruang usaha Dunia Corndog</span>
          <h2>Masuk ke ruang usaha</h2>
          <p>Pilih peran untuk membuka tampilan owner atau kasir.</p>
          <Alert role="note" className="notice">
            <AlertDescription>
              <Info size={17} />
              Login simulasi — gunakan email dan kata sandi apa pun.
            </AlertDescription>
          </Alert>
          <Field label="Masuk sebagai">
            <BusinessSelect
              value={loginRole}
              onValueChange={setLoginRole}
              options={[
                { value: "owner", label: "Owner" },
                { value: "cashier", label: "Kasir" },
              ]}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              required
              placeholder="nama@duniacorndog.example"
              autoComplete="email"
            />
          </Field>
          <Field label="Kata sandi">
            <Input
              type="password"
              required
              minLength={4}
              placeholder="Minimal 4 karakter"
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit">
            Masuk ke ruang usaha <ArrowRight size={17} />
          </Button>
          <small>Frontend demo · Tidak ada autentikasi server</small>
        </form>
      </div>
    );
  const sidebarContent = (
    <>
      <a
        className="brand"
        href="/dashboard"
        aria-label="Dunia Corndog — Ringkasan"
        onClick={(e) => {
          e.preventDefault();
          go("dashboard");
        }}
      >
        <div className="brand-icon">
          <Flame size={25} />
        </div>
        <span>
          Dunia
          <span>
            Corndog<span className="brand-period">.</span>
          </span>
        </span>
      </a>
      <ScrollArea type="auto" className="sidebar-scroll">
        <nav aria-label="Menu utama">
          {nav.map((n, i) => {
            const Icon = n.icon;
            return (
              <div key={n.id}>
                {(i === 0 || nav[i - 1].group !== n.group) && (
                  <div className="nav-label">{n.group}</div>
                )}
                <Button
                  variant="ghost"
                  type="button"
                  className={`nav-item ${page === n.id ? "active" : ""}`}
                  aria-current={page === n.id ? "page" : undefined}
                  onClick={() => go(n.id)}
                >
                  <Icon size={19} />
                  <span>{n.label}</span>
                  {n.id === "inventory" && low.length > 0 && (
                    <em>{low.length}</em>
                  )}
                  {n.id === "dashboard" && page === "dashboard" && <i />}
                </Button>
              </div>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="sidebar-bottom">
        <Button
          variant="ghost"
          type="button"
          className="help-link"
          onClick={() => setModal("help")}
        >
          <HelpCircle size={17} />
          Panduan & bantuan
          <ArrowUpRight size={15} />
        </Button>
        <Button
          variant="ghost"
          type="button"
          className="profile"
          onClick={() => setModal("profile")}
        >
          <span className="avatar">AP</span>
          <span>
            <b>Andi Pratama</b>
            <small>Pemilik usaha</small>
          </span>
          <MoreHorizontal size={18} />
        </Button>
      </div>
    </>
  );
  return (
    <div
      className={`app-shell ${cashier ? "cashier-shell" : ""} ${!sidebarOpen ? "sidebar-collapsed" : ""} ${sidebarMotion ? "sidebar-motion" : ""}`}
    >
      <aside
        id="desktop-sidebar"
        className="sidebar"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        {sidebarContent}
      </aside>
      <aside
        className="sidebar-rail"
        aria-label="Sidebar ringkas"
        aria-hidden={sidebarOpen || cashier}
        inert={sidebarOpen || cashier}
      >
        <a
          className="rail-brand"
          href="/dashboard"
          aria-label="Dunia Corndog — Ringkasan"
          title="Dunia Corndog"
          onClick={(event) => {
            event.preventDefault();
            go("dashboard");
          }}
        >
          <div className="brand-icon">
            <Flame size={25} />
          </div>
        </a>
        <TooltipProvider delayDuration={200}>
          <ScrollArea type="auto" className="rail-scroll">
            <nav aria-label="Menu utama ringkas" className="rail-nav">
              {nav.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div className="rail-nav-item" key={item.id}>
                    {index > 0 && nav[index - 1].group !== item.group && (
                      <div className="rail-divider" role="separator" />
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className={`nav-item rail-nav-button ${page === item.id ? "active" : ""}`}
                          aria-label={item.label}
                          aria-current={page === item.id ? "page" : undefined}
                          onClick={() => go(item.id)}
                        >
                          <Icon size={19} />
                          {item.id === "inventory" && low.length > 0 && (
                            <span
                              className="rail-stock-dot"
                              aria-hidden="true"
                            />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        sideOffset={12}
                        className="sidebar-tooltip"
                      >
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </nav>
          </ScrollArea>
        </TooltipProvider>
      </aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="mobile-sidebar">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigasi ruang usaha</SheetTitle>
            <SheetDescription>
              Pilih halaman operasional Dunia Corndog.
            </SheetDescription>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {!cashier && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="desktop-sidebar-toggle icon-button"
                aria-label={sidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
                title={sidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
                aria-controls="desktop-sidebar"
                aria-expanded={sidebarOpen}
                onClick={toggleSidebar}
              >
                {sidebarOpen ? (
                  <PanelLeftClose size={19} />
                ) : (
                  <PanelLeftOpen size={19} />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              type="button"
              className="mobile-menu icon-button"
              aria-label="Buka navigasi"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </Button>
            {cashier ? (
              <Button
                variant="ghost"
                type="button"
                className="back-owner"
                onClick={() => {
                  setRole("owner");
                  go("dashboard");
                }}
              >
                <PanelLeftClose size={17} /> Kembali ke owner
              </Button>
            ) : (
              <>
                <span>Workspace</span>
                <ChevronRight size={14} />
                <b>{title}</b>
              </>
            )}
          </div>
          <div className="topbar-right">
            <span
              className="demo-tag"
              title={
                connected?.stale
                  ? "Gagal memperbarui; data terakhir ditampilkan"
                  : undefined
              }
            >
              <span />
              {live ? "Terhubung" : "Mode demo"}
            </span>
            <span className="topbar-divider" />
            <Button
              variant="ghost"
              type="button"
              className="notification-button icon-button"
              aria-label="Buka notifikasi"
              onClick={() => {
                setRead(true);
                go("notifications");
              }}
            >
              <Bell size={19} />
              {!read && <i />}
            </Button>
            <span className="avatar avatar-small">AP</span>
          </div>
        </header>
        <ScrollArea
          key={page}
          type="auto"
          className="content-scroll"
          role="region"
          aria-label={`Konten ${title}`}
        >
          <main id="main-content" tabIndex={-1} className="app-content wrap">
            {!online && (
              <Alert className="offline">
                <AlertDescription>
                  <TriangleAlert size={17} />
                  Anda offline. Pembayaran dan perubahan stok dinonaktifkan.
                </AlertDescription>
              </Alert>
            )}
            {!cashier && (
              <div className="page-heading">
                <div
                  className={
                    page === "inventory" ? "inventory-heading-copy" : undefined
                  }
                >
                  <div className="eyebrow">
                    {page === "dashboard"
                      ? live
                        ? new Date().toLocaleDateString("id-ID", {
                            timeZone: "Asia/Jakarta",
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "Selasa, 10 November 2026"
                      : "Dunia Corndog / Ruang usaha"}
                  </div>
                  {page === "inventory" ? (
                    <div className="inventory-title-row">
                      <h1>{title}</h1>
                      {connected && (
                        <div className="heading-actions">
                          <InventoryToolsShell
                            ref={inventoryTools}
                            connected={connected}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <h1>{page === "dashboard" ? "Ringkasan usaha" : title}</h1>
                  )}
                  <p>
                    {
                      (
                        {
                          dashboard:
                            "Pantau penjualan, persediaan, dan performa cabang.",
                          reports:
                            "Tinjau pendapatan, biaya, dan transaksi setiap cabang.",
                          catalog:
                            "Kelola menu, harga, dan ketersediaan penjualan.",
                          inventory:
                            "Kelola persediaan bahan, produksi, dan perpindahan stok.",
                          expenses:
                            "Catat biaya operasional sesuai cabang dan periode.",
                          branches:
                            "Atur status cabang dan pantau penugasan kasir.",
                          users:
                            "Kelola akses kasir dan tinjau kas setiap shift.",
                          settings:
                            "Atur identitas bisnis dan preferensi ruang usaha.",
                          notifications:
                            "Tinjau peringatan stok dan tindak lanjut operasional.",
                        } as Record<string, string>
                      )[page]
                    }
                  </p>
                </div>
                {page !== "inventory" && (
                  <div className="heading-actions">
                    {page === "dashboard" || page === "reports" ? (
                      <Button variant="outline" onClick={exportCSV}>
                        <Download size={16} />
                        Ekspor laporan
                      </Button>
                    ) : page === "catalog" ? (
                      <Button
                        onClick={() => {
                          setEditingProduct(null);

                          setModal("product");
                        }}
                      >
                        <Plus size={17} />
                        Tambah isian
                      </Button>
                    ) : page === "expenses" ? (
                      <Button onClick={() => setModal("expense")}>
                        <Plus size={17} />
                        Catat pengeluaran
                      </Button>
                    ) : page === "branches" ? (
                      <Button onClick={() => setModal("branch")}>
                        <Plus size={17} />
                        Tambah cabang
                      </Button>
                    ) : page === "users" ? (
                      <Button
                        onClick={() => {
                          setEditingStaff(null);
                          setModal("user");
                        }}
                      >
                        <Plus size={17} />
                        Tambah anggota
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            )}
            {["dashboard", "reports", "expenses", "inventory"].includes(
              page,
            ) && (
              <div className="filter-row">
                {filters}
                <span className="last-updated">
                  <span className="tiny-dot" />
                  <span className="last-updated-label">
                    {connected
                      ? reportEnabled
                        ? reportPending
                          ? overview
                            ? "Memperbarui laporan…"
                            : "Memuat laporan…"
                          : reportUpdatedAt
                            ? `Laporan diperbarui ${new Date(reportUpdatedAt).toLocaleTimeString("id-ID")}`
                            : "Laporan belum tersedia"
                        : `Diperbarui ${new Date(connected.updatedAt).toLocaleTimeString("id-ID")}`
                      : "Data contoh · 10 Nov 2026"}{" "}
                  </span>
                  <Button
                    variant="ghost"
                    type="button"
                    aria-label="Segarkan tampilan"
                    className="icon-button"
                    onClick={() =>
                      connected
                        ? void connected
                            .refresh()
                            .catch(() => notify("Gagal memperbarui data."))
                        : notify(
                            "Data demo lokal ditampilkan. Belum tersambung ke server.",
                          )
                    }
                  >
                    <RefreshCw size={13} />
                  </Button>
                </span>
              </div>
            )}
            {live && reportEnabled && reportPending && (
              <p className="sr-only" role="status">
                {overview
                  ? "Memperbarui laporan; angka terakhir tetap ditampilkan."
                  : "Memuat laporan…"}
              </p>
            )}
            {live && reportEnabled && reportError && (
              <div className="report-feedback" role="alert">
                Gagal memuat laporan.{" "}
                {overview
                  ? "Angka terakhir ditampilkan."
                  : "Angka laporan belum tersedia."}{" "}
                <Button variant="outline" onClick={retryReport}>
                  Coba lagi laporan
                </Button>
              </div>
            )}
            {page === "dashboard" && (
              <>
                {metrics}
                <div className="dashboard-charts">
                  <Card className="panel sales-panel">
                    <CardHeader className="panel-heading">
                      <div>
                        <h2>Tren penjualan</h2>
                        <p>
                          Penjualan neto per hari · maksimal 7 hari terakhir
                          dalam periode
                        </p>
                      </div>
                      <div className="chart-legend">
                        <span />
                        Penjualan neto
                      </div>
                    </CardHeader>
                    <SalesTrend
                      from={from}
                      to={to}
                      pending={live && reportPending && !overview}
                      unavailable={!!reportError && !overview}
                      data={
                        live
                          ? overview?.daily || []
                          : (() => {
                              const dates = Array.from(
                                new Set([
                                  ...orders.map((o) => o.date),
                                  ...data.orders
                                    .filter(
                                      (o) =>
                                        o.refunded &&
                                        o.refundDate &&
                                        (branch === "all" ||
                                          o.branch === branch) &&
                                        inRange(o.refundDate),
                                    )
                                    .map((o) => o.refundDate!),
                                ]),
                              );
                              return dates.map((date) => {
                                const gross = orders
                                    .filter((o) => o.date === date)
                                    .reduce((n, o) => n + o.total, 0),
                                  refunds = data.orders
                                    .filter(
                                      (o) =>
                                        o.refunded &&
                                        o.refundDate === date &&
                                        (branch === "all" ||
                                          o.branch === branch),
                                    )
                                    .reduce((n, o) => n + o.total, 0);
                                return {
                                  date,
                                  gross,
                                  refunds,
                                  net: gross - refunds,
                                };
                              });
                            })()
                      }
                    />
                    <div className="chart-footer">
                      <span>
                        <span className="tiny-dot" />
                        Data penjualan seluruh metode pembayaran
                      </span>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => go("reports")}
                      >
                        Detail laporan <ArrowUpRight size={14} />
                      </Button>
                    </div>
                  </Card>
                  <Card className="panel branch-panel">
                    <CardHeader className="panel-heading">
                      <div>
                        <h2>Performa cabang</h2>
                        <p>Kontribusi penjualan tiap cabang</p>
                      </div>
                      <Store size={18} />
                    </CardHeader>
                    {data.branches
                      .filter((b) => branch === "all" || b.id === branch)
                      .map((b, i) => {
                        const branchReport = overview?.branches.find(
                          (row) => row.id === b.id,
                        );
                        const sum = live
                          ? branchReport?.gross || 0
                          : orders
                              .filter((o) => o.branch === b.id)
                              .reduce((n, o) => n + o.total, 0);
                        return (
                          <div className="branch-performance" key={b.id}>
                            <div className="branch-perf-title">
                              <span className={`branch-symbol symbol-${i}`}>
                                <Store size={19} />
                              </span>
                              <span>
                                <b>{b.name}</b>
                                <small>
                                  {live
                                    ? !overview
                                      ? "—"
                                      : branchReport?.count || 0
                                    : orders.filter((o) => o.branch === b.id)
                                        .length}{" "}
                                  transaksi
                                </small>
                              </span>
                              <ArrowUpRight size={17} />
                            </div>
                            <strong>{reportMoney(sum)}</strong>
                            <div className="progress">
                              <div
                                style={{
                                  width: `${gross ? (sum / gross) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className="branch-percent">
                              {live && !overview
                                ? "—"
                                : gross
                                  ? ((sum / gross) * 100).toFixed(1) + "%"
                                  : "0%"}
                              dari penjualan bruto
                            </span>
                          </div>
                        );
                      })}
                    <Button
                      variant="ghost"
                      type="button"
                      className="text-link"
                      onClick={() => go("branches")}
                    >
                      Kelola semua cabang <ArrowRight size={15} />
                    </Button>
                  </Card>
                </div>
                <div className="dashboard-bottom">
                  <Card className="panel">
                    <CardHeader className="panel-heading">
                      <div>
                        <h2>Menu terlaris</h2>
                        <p>Berdasarkan jumlah porsi terjual</p>
                      </div>
                      <Button
                        variant="ghost"
                        type="button"
                        className="icon-button"
                        aria-label="Lihat katalog"
                        onClick={() => go("catalog")}
                      >
                        <ArrowUpRight size={18} />
                      </Button>
                    </CardHeader>
                    {best.slice(0, 3).map((p, i) => (
                      <div className="best-item" key={p.name}>
                        <span className="rank">0{i + 1}</span>
                        <div className={`food-thumb ${p.color}`}>
                          <Corndog id={`best${i}`} kind={p.color} />
                        </div>
                        <div className="best-info">
                          <b>{p.name}</b>
                          <small>{p.qty} porsi terjual</small>
                        </div>
                        <b>{money(p.amount)}</b>
                      </div>
                    ))}
                    {!best.length &&
                      (live && !overview ? (
                        <p className="report-feedback">
                          Menu terlaris belum tersedia.
                        </p>
                      ) : (
                        <Empty />
                      ))}
                  </Card>
                  <Card className="panel stock-alert-panel">
                    <CardHeader className="panel-heading">
                      <div>
                        <h2>
                          Perlu perhatian{" "}
                          <span className="count-pill">{low.length}</span>
                        </h2>
                        <p>Cek stok sebelum kehabisan</p>
                      </div>
                      <TriangleAlert size={19} />
                    </CardHeader>
                    {low.slice(0, 3).map((s) => (
                      <div className="stock-alert" key={s.id}>
                        <div className="stock-alert-icon">
                          <Boxes size={19} />
                        </div>
                        <div>
                          <b>{s.name}</b>
                          <small>
                            {branchName(s.branch)} · min. {number(s.min)}{" "}
                            {s.unit}
                          </small>
                        </div>
                        <span>
                          <b>
                            {number(s.qty)} {s.unit}
                          </b>
                          <small>Stok menipis</small>
                        </span>
                      </div>
                    ))}
                    {!low.length && (
                      <div className="empty">
                        <CheckCircle2 />
                        <b>Semua stok aman.</b>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      type="button"
                      className="stock-alert-link"
                      onClick={() => go("inventory")}
                    >
                      Periksa persediaan <ArrowRight size={15} />
                    </Button>
                  </Card>
                </div>
                <Card className="panel transactions-panel">
                  <CardHeader className="panel-heading">
                    <div>
                      <h2>Transaksi terbaru</h2>
                      <p>Riwayat pesanan dalam periode terpilih</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => go("orders")}
                    >
                      Lihat semua <ArrowRight size={15} />
                    </Button>
                  </CardHeader>
                  <OrderTable
                    branchName={branchName}
                    onSelect={openOrder}
                    items={filteredOrders.slice(0, 4)}
                    compact
                  />
                </Card>
              </>
            )}
            {page === "reports" && (
              <FilterTabs
                value={financialTab}
                onValueChange={setFinancialTab}
                options={["Ringkasan", "Transaksi"]}
                label="Bagian laporan keuangan"
                className="finance-tabs"
                icons={{
                  Ringkasan: <ChartNoAxesCombined size={17} />,
                  Transaksi: <ReceiptText size={17} />,
                }}
              >
                {financialTab === "Ringkasan" ? (
                  live && !overview ? (
                    <>
                      {metrics}
                      <p className="report-feedback" role="status">
                        {reportError
                          ? "Laporan belum tersedia. Silakan coba lagi."
                          : "Memuat rincian laporan…"}
                      </p>
                    </>
                  ) : (
                    <>
                      {metrics}
                      <div className="two-col">
                        <Card className="panel">
                          <CardHeader className="panel-heading">
                            <div>
                              <h2>Ringkasan laba operasional</h2>
                              <p>Sesuai cabang dan periode yang dipilih</p>
                            </div>
                            <Wallet size={20} />
                          </CardHeader>
                          <div className="report-lines">
                            {[
                              ["Penjualan bruto", gross],
                              ["Refund", -refunds],
                              ["Penjualan neto", net],
                              ["Harga pokok penjualan (HPP)", -cogs],
                              ["Pengeluaran operasional", -opex],
                              ...(connected
                                ? [
                                    [
                                      "Kerugian stok",
                                      -(serverTotals?.stockLoss || 0),
                                    ],
                                  ]
                                : []),
                              ["Estimasi laba operasional", profit],
                              ...(connected
                                ? [
                                    [
                                      "Arus kas tercatat",
                                      serverTotals?.cashFlow || 0,
                                    ],
                                  ]
                                : []),
                            ].map(([label, value], index) => (
                              <div
                                key={label}
                                className={
                                  label === "Penjualan neto" ||
                                  label === "Estimasi laba operasional"
                                    ? "report-total"
                                    : ""
                                }
                              >
                                <span>{label}</span>
                                <b>{money(Number(value))}</b>
                              </div>
                            ))}
                          </div>
                          <Alert role="note" className="notice">
                            <AlertDescription>
                              <Info size={18} />
                              <span>
                                Estimasi manajerial; belum termasuk penyusutan,
                                kewajiban, dan biaya di luar pencatatan.
                                Pembelian persediaan bukan pengeluaran
                                operasional.
                              </span>
                            </AlertDescription>
                          </Alert>
                        </Card>
                        {live && overview ? (
                          <ReportPayments data={overview} />
                        ) : (
                          <Card className="panel">
                            <CardHeader className="panel-heading">
                              <div>
                                <h2>Metode pembayaran</h2>
                                <p>Distribusi penerimaan bruto</p>
                              </div>
                              <CreditCard size={20} />
                            </CardHeader>
                            {["QRIS", "Tunai", "Transfer"].map(
                              (methodName, index) => {
                                const amount = orders
                                  .filter(
                                    (order) => order.method === methodName,
                                  )
                                  .reduce((sum, order) => sum + order.total, 0);
                                return (
                                  <div
                                    className="payment-report"
                                    key={methodName}
                                  >
                                    <div>
                                      <span
                                        className={`payment-dot dot-${index}`}
                                      />
                                      <b>{methodName}</b>
                                      <span>{money(amount)}</span>
                                    </div>
                                    <div className="progress">
                                      <div
                                        style={{
                                          width: `${gross ? (amount / gross) * 100 : 0}%`,
                                        }}
                                      />
                                    </div>
                                    <small>
                                      {gross
                                        ? ((amount / gross) * 100).toFixed(1)
                                        : 0}
                                      % ·{" "}
                                      {
                                        orders.filter(
                                          (order) =>
                                            order.method === methodName,
                                        ).length
                                      }{" "}
                                      transaksi
                                    </small>
                                  </div>
                                );
                              },
                            )}
                            <Alert role="note" className="notice">
                              <AlertDescription>
                                <Info size={17} />
                                QRIS dan transfer merupakan pencatatan manual.
                              </AlertDescription>
                            </Alert>
                          </Card>
                        )}
                      </div>
                      {overview && <ReportBreakdowns data={overview} />}
                    </>
                  )
                ) : (
                  <>
                    <div className="mini-summary">
                      <span>
                        <ReceiptText size={19} />
                        <b>{orderCount ?? "—"}</b> transaksi
                      </span>
                      <span>
                        Penjualan neto <b>{reportMoney(net)}</b>
                      </span>
                      <span>
                        Refund <b>{reportMoney(refunds)}</b>
                      </span>
                    </div>
                    <FilterTabs
                      value={tab}
                      onValueChange={setTab}
                      options={["Semua", "Tunai", "QRIS", "Transfer", "Refund"]}
                      label="Filter metode transaksi"
                      icons={{
                        Semua: <SlidersHorizontal size={17} />,
                        Tunai: <Banknote size={17} />,
                        QRIS: <QrCode size={17} />,
                        Transfer: <ArrowLeftRight size={17} />,
                        Refund: <RotateCcw size={17} />,
                      }}
                    >
                      <Card className="panel">
                        <div className="list-toolbar">
                          <label className="search-box">
                            <Search size={16} />
                            <Input
                              aria-label="Cari transaksi atau kasir"
                              maxLength={100}
                              placeholder="Cari transaksi atau kasir…"
                              value={search}
                              onChange={(event) =>
                                setSearch(event.target.value)
                              }
                            />
                          </label>
                        </div>
                        {connected ? (
                          <OwnerTransactions
                            key={`${from}:${to}:${branch}:${tab}:${search}`}
                            connection={connected}
                            from={from}
                            to={to}
                            branch={branch}
                            method={tab}
                            search={search}
                            renderTable={(items) => (
                              <OrderTable
                                branchName={branchName}
                                onSelect={openOrder}
                                items={items}
                              />
                            )}
                          />
                        ) : (
                          <>
                            <OrderTable
                              branchName={branchName}
                              onSelect={openOrder}
                              items={filteredOrders}
                            />
                            <div className="table-footer">
                              Menampilkan {filteredOrders.length} transaksi ·
                              Data demo
                            </div>
                          </>
                        )}
                      </Card>
                    </FilterTabs>
                  </>
                )}
              </FilterTabs>
            )}
            {page === "catalog" && (
              <CatalogPage
                products={data.products}
                connected={!!connected}
                onEdit={editProduct}
                onToggle={toggleProduct}
              />
            )}
            {page === "inventory" && (
              <InventoryPage
                data={data}
                stocks={stocks}
                branch={branch}
                online={online}
                connected={connected}
                onAction={openModal}
                onStartCount={beginCount}
                branchName={branchName}
              />
            )}
            {page === "expenses" && (
              <>
                {connected && (
                  <Card className="panel inventory-tools">
                    <details>
                      <summary>Koreksi pengeluaran</summary>
                      <p>
                        Pilih tombol Koreksi pada riwayat pengeluaran untuk
                        mencatat koreksi.
                      </p>
                    </details>
                  </Card>
                )}
                <div
                  className="metrics three"
                  aria-busy={live && reportPending}
                >
                  <Metric
                    label="Pengeluaran operasional"
                    value={reportMoney(opex)}
                    icon={Wallet}
                    foot={`${expenseCount ?? "—"} pencatatan pada periode ini`}
                    accent
                  />
                  <Metric
                    label="Kategori pengeluaran"
                    value={
                      expenseCategories === undefined
                        ? "—"
                        : String(expenseCategories)
                    }
                    icon={ClipboardList}
                    foot="Sewa, utilitas, dan operasional"
                  />
                  <Metric
                    label="Rata-rata pengeluaran"
                    value={reportMoney(
                      expenseCount ? Math.round(opex / expenseCount) : 0,
                    )}
                    icon={ReceiptText}
                    foot="Per pencatatan"
                  />
                </div>
                {connected ? (
                  <ExpenseHistory
                    connected={connected}
                    from={from}
                    to={to}
                    branch={branch}
                  />
                ) : (
                  <Card className="panel">
                    <CardHeader className="panel-heading">
                      <h2>Riwayat pengeluaran</h2>
                      <Badge tone="neutral">Operasional</Badge>
                    </CardHeader>
                    <div className="table-scroll">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Keterangan</TableHead>
                            <TableHead>Cabang</TableHead>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Pembayaran</TableHead>
                            <TableHead>Jumlah</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {costs.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell>
                                <b>{e.name}</b>
                                <small>{e.category}</small>
                              </TableCell>
                              <TableCell>{branchName(e.branch)}</TableCell>
                              <TableCell>{e.date}</TableCell>
                              <TableCell>{e.method}</TableCell>
                              <TableCell>
                                <b>{money(e.amount)}</b>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {!costs.length && <Empty />}
                    </div>
                  </Card>
                )}
                <Alert role="note" className="notice">
                  <AlertDescription>
                    <Info size={17} />
                    Pembelian bahan dicatat melalui Stok masuk, terpisah dari
                    pengeluaran operasional.
                  </AlertDescription>
                </Alert>
              </>
            )}
            {page === "branches" && (
              <div className="branch-grid">
                {data.branches.map((b, i) => (
                  <Card className="panel branch-card" key={b.id}>
                    <div className="branch-card-top">
                      <span className={`branch-symbol symbol-${i}`}>
                        <Store size={23} />
                      </span>
                      <Badge>{b.active ? "Aktif" : "Nonaktif"}</Badge>
                    </div>
                    <span className="eyebrow">
                      Cabang {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2>{b.name}</h2>
                    <p>{b.address}</p>
                    <div className="branch-detail">
                      <Users size={17} />
                      {
                        data.users.filter((u) => u.branch === b.id && u.active)
                          .length
                      }{" "}
                      kasir ditugaskan
                    </div>
                    <div className="branch-detail">
                      <Clock size={17} />
                      {data.shifts.some((s) => s.branch === b.id && s.open)
                        ? "Shift sedang aktif"
                        : "Tidak ada shift aktif"}
                    </div>
                    <div className="branch-card-bottom">
                      <StatusActionButton
                        size="default"
                        active={b.active}
                        name={b.name}
                        kind="cabang"
                        description={
                          b.active
                            ? "tidak dapat digunakan untuk membuka shift baru. Data cabang dan riwayat transaksi tetap tersimpan."
                            : "akan tersedia kembali untuk operasional dan pembukaan shift."
                        }
                        beforeConfirm={() => {
                          if (
                            b.active &&
                            data.shifts.some((s) => s.branch === b.id && s.open)
                          ) {
                            notify(
                              "Tutup shift aktif sebelum menonaktifkan cabang.",
                            );
                            return false;
                          }
                          return true;
                        }}
                        onConfirm={() => {
                          if (connected)
                            return mutate(
                              `/branches/${b.id}`,
                              {
                                name: b.name,
                                address: b.address,
                                active: !b.active,
                              },
                              "PATCH",
                            );
                          setData((d) => ({
                            ...d,
                            branches: d.branches.map((x) =>
                              x.id === b.id ? { ...x, active: !x.active } : x,
                            ),
                          }));
                        }}
                      />
                      <Button
                        variant="ghost"
                        type="button"
                        className="text-link"
                        onClick={() => {
                          setBranch(b.id);
                          go("dashboard");
                        }}
                      >
                        Lihat performa <ArrowUpRight size={15} />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {page === "users" && (
              <>
                <Card className="panel">
                  <CardHeader className="panel-heading">
                    <div>
                      <h2>Tim kasir</h2>
                      <p>Akses dan penugasan cabang</p>
                    </div>
                    <Users size={20} />
                  </CardHeader>
                  <PaginatedList items={data.users}>
                    {(pageItems) => (
                      <div className="table-scroll">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nama anggota</TableHead>
                              <TableHead>Username</TableHead>
                              <TableHead>Penugasan</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageItems.map((u) => (
                              <TableRow key={u.id}>
                                <TableCell>
                                  <span className="user-cell">
                                    <span className="avatar">
                                      {u.name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .slice(0, 2)
                                        .join("")}
                                    </span>
                                    <b>{u.name}</b>
                                  </span>
                                </TableCell>
                                <TableCell>{u.username || "—"}</TableCell>
                                <TableCell>
                                  {(u.branches || [u.branch])
                                    .map(branchName)
                                    .join(", ")}
                                </TableCell>
                                <TableCell>
                                  <Badge>
                                    {u.active ? "Aktif" : "Nonaktif"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="row-actions">
                                    <Button
                                      size="sm"
                                      variant="soft"
                                      onClick={() => {
                                        setEditingStaff(u.id);
                                        setModal("user");
                                      }}
                                    >
                                      <Pencil aria-hidden="true" /> Edit
                                    </Button>
                                    <StatusActionButton
                                      active={u.active}
                                      name={u.name}
                                      kind="akun staf"
                                      description={
                                        u.active
                                          ? "akan kehilangan akses login kasir dan sesi aktifnya dicabut. Riwayat transaksi tetap tersimpan."
                                          : "dapat login kembali menggunakan username dan password yang sudah diatur."
                                      }
                                      beforeConfirm={() => {
                                        if (
                                          u.active &&
                                          data.shifts.some(
                                            (s) =>
                                              s.cashier === u.name && s.open,
                                          )
                                        ) {
                                          notify(
                                            "Tutup shift anggota sebelum menonaktifkan akun.",
                                          );
                                          return false;
                                        }
                                        return true;
                                      }}
                                      onConfirm={() => {
                                        if (connected)
                                          return mutate(
                                            `/staff/${u.id}`,
                                            {
                                              name: u.name,
                                              username: u.username,
                                              branches: u.branches || [
                                                u.branch,
                                              ],
                                              active: !u.active,
                                            },
                                            "PATCH",
                                          );
                                        setData((d) => ({
                                          ...d,
                                          users: d.users.map((x) =>
                                            x.id === u.id
                                              ? { ...x, active: !x.active }
                                              : x,
                                          ),
                                        }));
                                      }}
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </PaginatedList>
                </Card>
                {connected ? (
                  <ShiftMonitor connected={connected} />
                ) : (
                  <Card className="panel">
                    <CardHeader className="panel-heading">
                      <div>
                        <h2>Monitor shift</h2>
                        <p>Kasir aktif dan rekonsiliasi kas</p>
                      </div>
                      <Clock size={20} />
                    </CardHeader>
                    <div className="table-scroll">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Kasir</TableHead>
                            <TableHead>Cabang</TableHead>
                            <TableHead>Kas awal</TableHead>
                            <TableHead>Kas aktual</TableHead>
                            <TableHead>Selisih</TableHead>
                            <TableHead>Status</TableHead>
                            {connected && <TableHead>Aksi</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.shifts.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>
                                <b>{s.cashier}</b>
                              </TableCell>
                              <TableCell>{branchName(s.branch)}</TableCell>
                              <TableCell>{money(s.opening)}</TableCell>
                              <TableCell>
                                {s.actual === undefined ? "—" : money(s.actual)}
                              </TableCell>
                              <TableCell>
                                {s.difference === undefined
                                  ? "—"
                                  : money(s.difference)}
                              </TableCell>
                              <TableCell>
                                <Badge>{s.open ? "Aktif" : "Ditutup"}</Badge>
                              </TableCell>
                              {connected && (
                                <TableCell>
                                  {s.open && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setClosingShift(s)}
                                    >
                                      <LogOut aria-hidden="true" /> Tutup shift
                                    </Button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}
              </>
            )}
            {page === "settings" && (
              <div className="settings-grid">
                <Card className="panel settings-panel">
                  <h2>Profil usaha</h2>
                  <p>Identitas yang tampil di ruang usaha dan struk.</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      if (connected) {
                        void mutate(
                          "/business",
                          { name: String(f.get("business")) },
                          "PATCH",
                        ).catch(() => {});
                        return;
                      }
                      setData((d) => ({
                        ...d,
                        business: String(f.get("business")),
                      }));
                      notify("Profil usaha demo diperbarui.");
                    }}
                  >
                    <Field label="Nama bisnis">
                      <Input
                        name="business"
                        required
                        defaultValue={data.business}
                      />
                    </Field>
                    <Field label="Zona waktu">
                      <Input value="Asia/Jakarta (WIB)" readOnly />
                    </Field>
                    <Field label="Mata uang">
                      <Input value="IDR — Rupiah Indonesia" readOnly />
                    </Field>
                    <Button type="submit">Simpan perubahan</Button>
                  </form>
                </Card>
                <Card className="panel settings-panel">
                  <h2>{live ? "Koneksi & sesi" : "Ruang review frontend"}</h2>
                  <p>
                    {live
                      ? "Data disimpan di PostgreSQL melalui API Express. Akun kasir dikelola melalui Tim & shift."
                      : "Data tersimpan lokal di browser ini. Gunakan reset untuk kembali ke skenario awal."}
                  </p>
                  <Alert role="note" className="notice">
                    <AlertDescription>
                      <Info size={19} />
                      {live
                        ? "Pembayaran QRIS dan transfer tetap dikonfirmasi manual. Semua perubahan membutuhkan koneksi server."
                        : "Belum ada database, autentikasi, pembayaran, sinkronisasi, atau kontrol akses server."}
                    </AlertDescription>
                  </Alert>
                  <Button
                    style={live ? { display: "none" } : undefined}
                    variant="outline"
                    hidden={live}
                    disabled={live}
                    onClick={() => setModal("reset")}
                  >
                    <RefreshCw size={16} />
                    Reset data demo
                  </Button>
                  <Button variant="ghost" onClick={() => go("login")}>
                    <LogOut size={16} />
                    {live ? "Keluar" : "Lihat halaman login"}
                  </Button>
                </Card>
              </div>
            )}
            {connected?.stale && (
              <p className="notice" role="alert">
                Koneksi refresh gagal. Data terakhir ditampilkan.
              </p>
            )}
            {connected && page === "notifications" && (
              <OwnerRequests
                connected={connected}
                onOrder={(id) => {
                  void connected
                    .request<Order>(`/owner/orders/${id}`)
                    .then(openOrder)
                    .catch((e) => notify(e.message));
                }}
              />
            )}
            {page === "notifications" && (
              <Card className="panel">
                <CardHeader className="panel-heading">
                  <h2>Perlu perhatian Anda</h2>
                  <Badge tone="neutral">{low.length} notifikasi</Badge>
                </CardHeader>
                {low.map((s) => (
                  <Button
                    variant="ghost"
                    type="button"
                    className="notification-row"
                    key={s.id}
                    onClick={() => {
                      setBranch(s.branch);
                      go("inventory");
                    }}
                  >
                    <span className="stock-alert-icon">
                      <TriangleAlert size={21} />
                    </span>
                    <span>
                      <b>Stok {s.name.toLowerCase()} menipis</b>
                      <small>
                        {branchName(s.branch)} · Tersisa {number(s.qty)}{" "}
                        {s.unit}, minimum {number(s.min)} {s.unit}.
                      </small>
                    </span>
                    <ChevronRight size={18} />
                  </Button>
                ))}
                {!low.length && <Empty text="Semua sudah beres." />}
              </Card>
            )}
            {cashier && (
              <>
                <div className="cashier-header">
                  <div>
                    <div className="eyebrow">
                      Dunia Corndog / Kasir tablet · Web preview
                    </div>
                    <h1>
                      {page === "pos" ? "Buat pesanan baru" : "Antrean pesanan"}
                    </h1>
                    <p>
                      {cashShift
                        ? `${cashShift.cashier} · Shift aktif sejak 09.00 WIB`
                        : "Belum ada shift aktif. Buka shift untuk melayani pesanan."}
                    </p>
                  </div>
                  <div className="button-group">
                    <BusinessSelect
                      label="Cabang kasir demo"
                      value={cashBranch}
                      onValueChange={setCashBranch}
                      options={data.branches
                        .filter((b) => b.active)
                        .map((b) => ({ value: b.id, label: b.name }))}
                    />
                    <Button
                      variant="outline"
                      onClick={() => go(page === "pos" ? "queue" : "pos")}
                    >
                      {page === "pos" ? (
                        <>
                          <Clock size={17} />
                          Antrean (
                          {
                            cashOrders.filter(
                              (o) => !o.refunded && o.status !== "Selesai",
                            ).length
                          }
                          )
                        </>
                      ) : (
                        <>
                          <Plus size={17} />
                          Pesanan baru
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setModal(cashShift ? "close-shift" : "open-shift")
                      }
                    >
                      {cashShift ? "Tutup shift" : "Buka shift"}
                    </Button>
                  </div>
                </div>
                {!cashShift && (
                  <Alert role="note" className="notice">
                    <AlertDescription>
                      <Clock size={18} />
                      Buka shift terlebih dahulu untuk menerima pembayaran demo.
                    </AlertDescription>
                  </Alert>
                )}
                {page === "pos" ? (
                  <div className="pos-layout">
                    <section className="cashier-menu">
                      <div className="pos-toolbar">
                        <label className="search-box">
                          <Search size={18} />
                          <Input
                            aria-label="Cari menu kasir"
                            placeholder="Cari ukuran atau isian…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </label>
                      </div>
                      <p className="menu-flow-hint">
                        Pilih ukuran, lalu tentukan kategori, isian, dan
                        topping.
                      </p>
                      <div className="pos-menu-grid">
                        {MENU_SIZES.filter(
                          (size) =>
                            size.toLowerCase().includes(search.toLowerCase()) ||
                            data.products.some(
                              (p) =>
                                p.prices[size] &&
                                p.name
                                  .toLowerCase()
                                  .includes(search.toLowerCase()),
                            ),
                        ).map((size) => {
                          const available = data.products.filter(
                            (p) => p.active && p.stock > 0 && p.prices[size],
                          );
                          return (
                            <Button
                              variant="ghost"
                              type="button"
                              className="pos-menu-card panel"
                              data-menu-size={size}
                              key={size}
                              disabled={!available.length}
                              onClick={() => openSize(size)}
                            >
                              <div className="menu-visual gold">
                                <Corndog id={`pos-${size}`} kind="gold" />
                                {!available.length && <Badge>Habis</Badge>}
                              </div>
                              <div className="menu-info">
                                <h2 className="item-title">{size}</h2>
                                <span>{available.length} pilihan isian</span>
                                <div>
                                  <b>
                                    {available.length
                                      ? `Dari ${money(Math.min(...available.map((p) => p.prices[size]!)))}`
                                      : "Belum tersedia"}
                                  </b>
                                  <span className="add-icon">
                                    <Plus size={19} />
                                  </span>
                                </div>
                              </div>
                            </Button>
                          );
                        })}
                      </div>
                    </section>
                    <Card className="cart-panel panel">
                      <CardHeader className="panel-heading">
                        <div>
                          <h2>Pesanan saat ini</h2>
                          <p>{branchName(cashBranch)} · Draft lokal</p>
                        </div>
                        <span className="cart-count">
                          {cart.reduce((s, l) => s + l.qty, 0)}
                        </span>
                      </CardHeader>
                      <div className="cart-items">
                        {!cart.length ? (
                          <div className="cart-empty">
                            <ShoppingBag size={42} />
                            <h2>Pesanan masih kosong</h2>
                            <p>
                              Pilih menu untuk
                              <br />
                              menambah item pesanan.
                            </p>
                          </div>
                        ) : (
                          cart.map((l) => (
                            <div className="cart-line" key={l.key}>
                              <div>
                                <b>{l.name}</b>
                                <Button
                                  variant="ghost"
                                  type="button"
                                  className="icon-button"
                                  aria-label={`Hapus ${l.name}`}
                                  onClick={() =>
                                    setCart((c) =>
                                      c.filter((x) => x.key !== l.key),
                                    )
                                  }
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                              <small>
                                {lineOptions(l)}
                                {l.note && ` · Catatan: ${l.note}`}
                              </small>
                              {l.note && <small>Catatan: {l.note}</small>}
                              <div>
                                <div className="stepper small">
                                  <Button
                                    variant="ghost"
                                    type="button"
                                    aria-label="Kurangi jumlah"
                                    onClick={() =>
                                      setCart((c) =>
                                        c.flatMap((x) =>
                                          x.key === l.key
                                            ? x.qty > 1
                                              ? [{ ...x, qty: x.qty - 1 }]
                                              : []
                                            : [x],
                                        ),
                                      )
                                    }
                                  >
                                    <Minus size={13} />
                                  </Button>
                                  <span>{l.qty}</span>
                                  <Button
                                    variant="ghost"
                                    type="button"
                                    aria-label="Tambah jumlah"
                                    onClick={() =>
                                      setCart((c) =>
                                        c.map((x) =>
                                          x.key === l.key
                                            ? { ...x, qty: x.qty + 1 }
                                            : x,
                                        ),
                                      )
                                    }
                                  >
                                    <Plus size={13} />
                                  </Button>
                                </div>
                                <b>{money(l.price * l.qty)}</b>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="cart-bottom">
                        <div>
                          <span>Subtotal</span>
                          <span>{money(cartTotal)}</span>
                        </div>
                        <div className="cart-total">
                          <b>Total pembayaran</b>
                          <strong>{money(cartTotal)}</strong>
                        </div>
                        <Button
                          disabled={!cart.length || !cashShift || !online}
                          onClick={() => {
                            setMethod("Tunai");
                            setReceived("");
                            setVerified(false);
                            setModal("payment");
                          }}
                        >
                          Lanjut pembayaran <ArrowRight size={18} />
                        </Button>
                        <small>
                          <Info size={12} />
                          Simulasi · Tidak ada pembayaran sungguhan
                        </small>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <div className="queue-grid">
                    {["Antrean", "Diproses", "Siap", "Selesai"].map((s, i) => (
                      <section className="queue-column" key={s}>
                        <h2>
                          <span className={`queue-dot q-${i}`} />
                          {s}
                          <span>
                            {
                              cashOrders.filter(
                                (o) => o.status === s && !o.refunded,
                              ).length
                            }
                          </span>
                        </h2>
                        {cashOrders
                          .filter((o) => o.status === s && !o.refunded)
                          .slice()
                          .reverse()
                          .map((o) => (
                            <Card className="panel queue-card" key={o.id}>
                              <div>
                                <b>#{o.number || o.id}</b>
                                <small>{o.time}</small>
                              </div>
                              {o.lines.map((l) => (
                                <p key={l.key}>
                                  <b>{l.qty}×</b> {l.name}
                                  <small>
                                    {lineOptions(l)}
                                    {l.note ? ` · ${l.note}` : ""}
                                  </small>
                                </p>
                              ))}
                              {i < 3 ? (
                                <Button
                                  disabled={!online}
                                  variant={i === 2 ? "default" : "outline"}
                                  onClick={() =>
                                    setData((d) => ({
                                      ...d,
                                      orders: d.orders.map((x) =>
                                        x.id === o.id
                                          ? {
                                              ...x,
                                              status: [
                                                "Antrean",
                                                "Diproses",
                                                "Siap",
                                                "Selesai",
                                              ][i + 1],
                                            }
                                          : x,
                                      ),
                                    }))
                                  }
                                >
                                  {
                                    [
                                      "Mulai proses",
                                      "Tandai siap",
                                      "Selesaikan pesanan",
                                    ][i]
                                  }
                                  <ArrowRight size={15} />
                                </Button>
                              ) : (
                                <Badge>Selesai</Badge>
                              )}
                            </Card>
                          ))}
                      </section>
                    ))}
                  </div>
                )}
              </>
            )}
            <footer className="footer">
              <span>© 2026 Dunia Corndog</span>
              <span>
                {live
                  ? "Data tersimpan di PostgreSQL"
                  : "Frontend review · Semua data adalah simulasi"}
              </span>
            </footer>
          </main>
        </ScrollArea>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <Button
            variant="ghost"
            type="button"
            aria-label="Tutup notifikasi"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </Button>
        </div>
      )}
      <Dialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        title={`${size} Corndog`}
        description="Pilih kategori dan isian, lalu lengkapi topping pesanan."
      >
        <form className="menu-customization" onSubmit={addItem}>
          <Field label="Kategori">
            <div className="choice-grid">
              {MENU_CATEGORIES.map((category) => (
                <Button
                  key={category}
                  variant="ghost"
                  type="button"
                  aria-pressed={menuCategory === category}
                  className={`choice ${menuCategory === category ? "chosen" : ""}`}
                  onClick={() => chooseCategory(category)}
                >
                  {category}
                  {menuCategory === category && <Check size={15} />}
                </Button>
              ))}
            </div>
          </Field>
          <Field label="Isian">
            <div className="choice-grid">
              {fillings.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  type="button"
                  disabled={!p.active || !p.stock}
                  aria-pressed={product?.id === p.id}
                  className={`choice ${product?.id === p.id ? "chosen" : ""}`}
                  onClick={() => {
                    setProduct(p);
                    setPaidToppings((old) =>
                      p.potatoNoodleAllowed
                        ? old
                        : old.filter(
                            (name) => name !== "Kentang" && name !== "Mie",
                          ),
                    );
                    setQty(1);
                  }}
                >
                  {p.name}
                  <small>
                    {p.active && p.stock
                      ? money(p.prices[size]!)
                      : "Tidak tersedia"}
                  </small>
                  {product?.id === p.id && <Check size={15} />}
                </Button>
              ))}
            </div>
            {!fillings.length && (
              <p className="menu-empty">
                Belum ada isian {menuCategory.toLowerCase()} untuk ukuran {size}
                .
              </p>
            )}
          </Field>
          {product && (
            <>
              <Field label="Topping include · gratis">
                <div className="choice-grid">
                  {INCLUDED_TOPPINGS[menuCategory].map((name) => (
                    <Button
                      key={name}
                      variant="ghost"
                      type="button"
                      aria-pressed={toppings.includes(name)}
                      className={`choice ${toppings.includes(name) ? "chosen" : ""}`}
                      onClick={() =>
                        setToppings((old) =>
                          old.includes(name)
                            ? old.filter((t) => t !== name)
                            : [...old, name],
                        )
                      }
                    >
                      {name}
                      <small>Gratis</small>
                      {toppings.includes(name) && <Check size={15} />}
                    </Button>
                  ))}
                </div>
              </Field>
              <Field label="Extra topping · berbayar, opsional">
                <div className="choice-grid">
                  {[
                    ...EXTRA_TOPPINGS[menuCategory],
                    ...(product.potatoNoodleAllowed ? ["Kentang", "Mie"] : []),
                  ].map((name) => (
                    <Button
                      key={name}
                      variant="ghost"
                      type="button"
                      aria-pressed={paidToppings.includes(name)}
                      className={`choice ${paidToppings.includes(name) ? "chosen" : ""}`}
                      onClick={() =>
                        setPaidToppings((old) =>
                          old.includes(name)
                            ? old.filter((t) => t !== name)
                            : [...old, name],
                        )
                      }
                    >
                      {name}
                      <small>+{money(EXTRA_PRICE)}</small>
                      {paidToppings.includes(name) && <Check size={15} />}
                    </Button>
                  ))}
                </div>
              </Field>
            </>
          )}
          <Field label="Catatan pelanggan">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Contoh: saus dipisah"
            />
          </Field>
          <div className="customize-price">
            Harga per porsi <b>{money(customizationPrice)}</b>
          </div>
          <div className="dialog-actions">
            <div className="stepper">
              <Button
                variant="ghost"
                type="button"
                aria-label="Kurangi porsi"
                disabled={qty === 1}
                onClick={() => setQty((q) => q - 1)}
              >
                <Minus size={16} />
              </Button>
              {qty}
              <Button
                variant="ghost"
                type="button"
                aria-label="Tambah porsi"
                disabled={!product || qty >= product.stock}
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus size={16} />
              </Button>
            </div>
            <Button type="submit" disabled={!product}>
              Tambah · {money(customizationPrice * qty)}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={!!receipt}
        onOpenChange={(o) => !o && setReceipt(null)}
        title="Pesanan berhasil dicatat"
        description="Bukti transaksi simulasi. Tidak ada uang yang diproses."
      >
        {receipt && (
          <>
            <div className="receipt">
              <div className="receipt-check">
                <CheckCheck size={29} />
              </div>
              <h2>{data.business}</h2>
              <p>
                {branchName(receipt.branch)} · #{receipt.id}
              </p>
              <small>
                {receipt.date} · {receipt.time} WIB
              </small>
              <div className="receipt-lines">
                {receipt.lines.map((l) => (
                  <div key={l.key}>
                    <span>
                      {l.qty}× {l.name}
                      <small>
                        {lineOptions(l)}
                        {l.note && ` · Catatan: ${l.note}`}
                      </small>
                    </span>
                    <b>{money(l.qty * l.price)}</b>
                  </div>
                ))}
              </div>
              <div className="receipt-total">
                <span>Total</span>
                <b>{money(receipt.total)}</b>
              </div>
              <div className="receipt-payment">
                <span>
                  {receipt.method} · {money(receipt.received)}
                </span>
                <span>Kembalian {money(receipt.received - receipt.total)}</span>
              </div>
              <Badge tone="success">Lunas · Demo</Badge>
            </div>
            <Button className="full-width" onClick={() => setReceipt(null)}>
              Buat pesanan berikutnya <Plus size={17} />
            </Button>
          </>
        )}
      </Dialog>
      <Dialog
        open={!!modal}
        onOpenChange={(o) => {
          if (!o) setModal("");
        }}
        title={
          (
            {
              order: "Detail transaksi",
              refund: "Refund seluruh transaksi",
              payment: "Selesaikan pembayaran",
              expense: "Catat pengeluaran",
              branch: "Tambah cabang",
              user: editingStaff ? "Edit anggota tim" : "Tambah anggota tim",
              product: editingProduct
                ? "Edit isian corndog"
                : "Tambah isian corndog",
              "stock-in": "Penerimaan stok",
              production: "Catat produksi",
              transfer: "Transfer antar cabang",
              waste: "Catat bahan terbuang",
              count: "Hitung stok fisik",
              "open-shift": "Buka shift kasir",
              "close-shift": "Tutup & rekonsiliasi shift",
              help: "Panduan review",
              profile: "Profil pengguna",
              reset: "Reset data demo",
            } as Record<string, string>
          )[modal] || "Detail"
        }
      >
        {modal === "order" && selected && (
          <>
            <div className="order-detail-top">
              <div>
                <b>#{selected.number || selected.id}</b>
                <small>
                  {selected.date} · {selected.time} WIB
                </small>
              </div>
              <Badge>{selected.refunded ? "Refund" : selected.status}</Badge>
            </div>
            <div className="detail-pairs">
              <span>
                Cabang<b>{branchName(selected.branch)}</b>
              </span>
              <span>
                Kasir<b>{selected.cashier}</b>
              </span>
              <span>
                Pembayaran<b>{selected.method}</b>
              </span>
            </div>
            <div className="receipt-lines">
              {selected.lines.map((l) => (
                <div key={l.key}>
                  <span>
                    {l.qty}× {l.name}
                    <small>
                      {lineOptions(l)}
                      {l.note && ` · Catatan: ${l.note}`}
                    </small>
                  </span>
                  <b>{money(l.qty * l.price)}</b>
                </div>
              ))}
            </div>
            <div className="receipt-total">
              <span>Total</span>
              <b>{money(selected.total)}</b>
            </div>
            {selected.refunded ? (
              <Alert role="note" className="notice">
                <AlertDescription>
                  <Info size={18} />
                  Refund: {selected.refundReason} · {selected.refundDate}. Tidak
                  ada pemulihan stok.
                </AlertDescription>
              </Alert>
            ) : (
              <Button
                variant="danger-outline"
                className="full-width"
                onClick={() => setModal("refund")}
              >
                <ArrowDownRight aria-hidden="true" /> Refund penuh transaksi
              </Button>
            )}
          </>
        )}
        {modal === "payment" && (
          <form onSubmit={checkout}>
            <div className="payment-total">
              <span>Total yang dibayar</span>
              <strong>{money(cartTotal)}</strong>
            </div>
            <div className="payment-choices">
              {[
                { m: "Tunai", i: Banknote },
                { m: "QRIS", i: Smartphone },
                { m: "Transfer", i: CreditCard },
              ].map(({ m, i: I }) => (
                <Button
                  variant="ghost"
                  type="button"
                  key={m}
                  className={method === m ? "chosen" : ""}
                  onClick={() => {
                    setMethod(m);
                    setVerified(false);
                  }}
                >
                  <I size={22} />
                  {m}
                </Button>
              ))}
            </div>
            {method === "Tunai" ? (
              <>
                <Field label="Uang diterima (Rp)">
                  <Input
                    type="number"
                    required
                    min={cartTotal}
                    step="1"
                    value={received}
                    onChange={(e) => setReceived(e.target.value)}
                    placeholder="Masukkan nominal tunai"
                    autoFocus
                  />
                </Field>
                <div className="quick-cash">
                  {[
                    cartTotal,
                    ...[50000, 100000, 200000].filter((n) => n > cartTotal),
                  ].map((n) => (
                    <Button
                      variant="ghost"
                      type="button"
                      key={n}
                      onClick={() => setReceived(String(n))}
                    >
                      {n === cartTotal ? "Uang pas" : money(n)}
                    </Button>
                  ))}
                </div>
                <div className="change-row">
                  <span>Kembalian</span>
                  <b>{money(Math.max(0, Number(received) - cartTotal))}</b>
                </div>
                {received && Number(received) < cartTotal && (
                  <div className="field-error">
                    Uang tunai masih kurang{" "}
                    {money(cartTotal - Number(received))}.
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="manual-payment">
                  <Smartphone size={35} />
                  <b>{method} manual</b>
                  <p>
                    Periksa bukti penerimaan dana pada perangkat Anda. Prototipe
                    ini tidak terhubung ke payment gateway.
                  </p>
                </div>
                <div className="checkbox-row">
                  <Checkbox
                    id="payment-verified"
                    checked={verified}
                    onCheckedChange={(value) => setVerified(value === true)}
                  />
                  <Label htmlFor="payment-verified">
                    Saya sudah memeriksa dan menerima pembayaran (simulasi).
                  </Label>
                </div>
              </>
            )}
            <Button
              type="submit"
              className="full-width"
              disabled={
                !online ||
                !cashShift ||
                (method === "Tunai" && Number(received) < cartTotal) ||
                (method !== "Tunai" && !verified)
              }
            >
              <CheckCircle2 size={18} />
              Konfirmasi pembayaran demo
            </Button>
          </form>
        )}
        {[
          "expense",
          "branch",
          "user",
          "product",
          "refund",
          "stock-in",
          "production",
          "transfer",
          "waste",
          "count",
          "open-shift",
          "close-shift",
        ].includes(modal) && (
          <form onSubmit={submitForm}>
            {["expense", "branch", "user"].includes(modal) && (
              <Field label={modal === "expense" ? "Keterangan" : "Nama"}>
                <Input
                  name="name"
                  required
                  placeholder={
                    modal === "expense"
                      ? "Contoh: listrik outlet"
                      : "Masukkan nama"
                  }
                  maxLength={100}
                  defaultValue={
                    modal === "user"
                      ? data.users.find((u) => u.id === editingStaff)?.name
                      : undefined
                  }
                />
              </Field>
            )}
            {modal === "user" && (
              <>
                <Field label="Username kasir">
                  <Input
                    name="username"
                    required
                    minLength={3}
                    maxLength={50}
                    pattern="[a-zA-Z0-9._-]+"
                    autoComplete="off"
                    autoCapitalize="none"
                    defaultValue={
                      data.users.find((u) => u.id === editingStaff)?.username
                    }
                    placeholder="Contoh: kasir.dipatiukur"
                  />
                </Field>
                <Field
                  label={
                    editingStaff
                      ? "Password baru (kosongkan jika tetap)"
                      : "Password kasir"
                  }
                >
                  <Input
                    name="password"
                    type="password"
                    required={!editingStaff}
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder="Minimal 10 karakter"
                  />
                </Field>
                <fieldset className="staff-branches">
                  <legend>Penugasan cabang</legend>
                  {data.branches
                    .filter((b) => b.active)
                    .map((b) => (
                      <div className="checkbox-row" key={b.id}>
                        <Checkbox
                          id={`staff-${b.id}`}
                          name="staff-branch"
                          value={b.id}
                          defaultChecked={(
                            data.users.find((u) => u.id === editingStaff)
                              ?.branches || [
                              data.users.find((u) => u.id === editingStaff)
                                ?.branch || data.branches[0]?.id,
                            ]
                          ).includes(b.id)}
                        />
                        <Label htmlFor={`staff-${b.id}`}>{b.name}</Label>
                      </div>
                    ))}
                </fieldset>
                {editingStaff && (
                  <p className="menu-flow-hint">
                    Perubahan akun akan mengeluarkan kasir dari sesi sebelumnya.
                    Password lama tidak ditampilkan.
                  </p>
                )}
              </>
            )}
            {modal === "branch" && (
              <Field label="Alamat cabang">
                <Textarea
                  name="address"
                  required
                  placeholder="Alamat lengkap cabang"
                />
              </Field>
            )}
            {modal === "expense" && (
              <Field label="Cabang">
                <BusinessSelect
                  name="branch"
                  options={data.branches
                    .filter((b) => b.active)
                    .map((b) => ({ value: b.id, label: b.name }))}
                />
              </Field>
            )}
            {modal === "expense" && (
              <Field label="Kategori">
                <BusinessSelect
                  name="category"
                  options={(modal === "expense"
                    ? [
                        "Utilitas",
                        "Sewa",
                        "Transportasi",
                        "Operasional lainnya",
                      ]
                    : [...MENU_CATEGORIES]
                  ).map((s) => ({ value: s, label: s }))}
                />
              </Field>
            )}
            {["stock-in", "production", "transfer", "waste", "count"].includes(
              modal,
            ) && (
              <Field label="Item & cabang">
                <BusinessSelect
                  name="item"
                  required
                  options={stocks
                    .filter(
                      (s) =>
                        modal !== "production" ||
                        s.category === "Produk siap jual",
                    )
                    .map((s) => ({
                      value: s.id,
                      label:
                        s.name +
                        " · " +
                        branchName(s.branch) +
                        " (" +
                        number(s.qty) +
                        " " +
                        s.unit +
                        ")",
                    }))}
                />
              </Field>
            )}
            {connected && ["stock-in", "count"].includes(modal) && (
              <Field label="Biaya per satuan stok masuk (Rp)">
                <Input
                  name="unit-cost"
                  type="number"
                  min={0}
                  step="0.0001"
                  required={modal === "stock-in"}
                  placeholder="Wajib untuk penambahan stok"
                />
              </Field>
            )}
            {connected && modal === "refund" && (
              <>
                <Field label="Metode pengembalian dana">
                  <BusinessSelect
                    name="refund-method"
                    options={["Tunai", "QRIS", "Transfer"].map((s) => ({
                      value: s,
                      label: s,
                    }))}
                  />
                </Field>
                <Field label="Referensi pengembalian dana">
                  <Input
                    name="refund-reference"
                    required
                    maxLength={150}
                    placeholder="Nomor bukti atau catatan pengembalian"
                  />
                </Field>
              </>
            )}
            {connected && modal === "refund" && selected && (
              <RefundRestock orderId={selected.id} connected={connected} />
            )}
            {connected && ["expense", "stock-in", "refund"].includes(modal) && (
              <Field label="Sumber uang untuk pembayaran tunai">
                <BusinessSelect
                  name="funding-shift"
                  options={[
                    { value: "external", label: "Di luar laci kasir" },
                    ...data.shifts
                      .filter((s) => s.open)
                      .map((s) => ({
                        value: s.id,
                        label: `Laci ${s.cashier} · ${branchName(s.branch)}`,
                      })),
                  ]}
                />
              </Field>
            )}
            {modal === "transfer" && (
              <Field label="Cabang tujuan">
                <BusinessSelect
                  name="target"
                  options={data.branches
                    .filter((b) => b.active)
                    .map((b) => ({ value: b.id, label: b.name }))}
                />
              </Field>
            )}
            {modal === "production" && (
              <Alert role="note" className="notice">
                <AlertDescription>
                  <ChefHat size={18} />
                  Per pcs: 50 g tepung premix + 30 g mozzarella. Hasil menambah
                  stok siap jual. Ini simulasi kuantitas, belum menghitung
                  valuasi.
                </AlertDescription>
              </Alert>
            )}
            {modal === "stock-in" && (
              <Alert role="note" className="notice">
                <AlertDescription>
                  <Info size={17} />
                  {live
                    ? "Penerimaan menambah stok dan nilai persediaan. Pembelian dicatat terpisah dari pengeluaran operasional."
                    : "Simulasi penerimaan kuantitas dengan biaya demo tetap. Pembelian belum memengaruhi laporan arus kas."}
                </AlertDescription>
              </Alert>
            )}
            {modal === "close-shift" && cashShift && (
              <div className="shift-summary">
                <span>
                  Kas awal <b>{money(cashShift.opening)}</b>
                </span>
                <span>
                  Penjualan tunai neto{" "}
                  <b>
                    {money(
                      cashOrders
                        .filter((o) => o.method === "Tunai" && !o.refunded)
                        .reduce((s, o) => s + o.total, 0),
                    )}
                  </b>
                </span>
                <span>
                  Kas harapan{" "}
                  <b>
                    {money(
                      cashShift.opening +
                        cashOrders
                          .filter((o) => o.method === "Tunai" && !o.refunded)
                          .reduce((s, o) => s + o.total, 0),
                    )}
                  </b>
                </span>
              </div>
            )}
            {[
              "expense",
              "stock-in",
              "production",
              "transfer",
              "waste",
              "count",
              "open-shift",
              "close-shift",
            ].includes(modal) && (
              <Field
                label={
                  modal === "expense"
                    ? "Jumlah pengeluaran (Rp)"
                    : modal === "open-shift"
                      ? "Kas awal (Rp)"
                      : modal === "close-shift"
                        ? "Kas aktual di laci (Rp)"
                        : modal === "count"
                          ? "Jumlah hasil hitung fisik (satuan dasar)"
                          : "Jumlah (satuan dasar item)"
                }
              >
                <Input
                  name="amount"
                  type="number"
                  required
                  min={
                    ["count", "open-shift", "close-shift", "product"].includes(
                      modal,
                    )
                      ? 0
                      : 1
                  }
                  step={
                    ["stock-in", "transfer", "waste", "count"].includes(modal)
                      ? "0.001"
                      : "1"
                  }
                  placeholder="0"
                />
              </Field>
            )}
            {(modal === "expense" || (connected && modal === "stock-in")) && (
              <Field label="Metode pembayaran">
                <BusinessSelect
                  name="method"
                  options={["Transfer", "Tunai", "QRIS"].map((s) => ({
                    value: s,
                    label: s,
                  }))}
                />
              </Field>
            )}
            {[
              "refund",
              "transfer",
              "waste",
              "count",
              "production",
              "stock-in",
            ].includes(modal) && (
              <Field label="Alasan / catatan">
                <Textarea
                  name="reason"
                  required
                  minLength={5}
                  placeholder="Jelaskan alasan pencatatan (minimal 5 karakter)"
                />
              </Field>
            )}
            {modal === "refund" && (
              <Alert role="note" className="notice">
                <AlertDescription>
                  <TriangleAlert size={19} />
                  {live
                    ? `Refund ${money(selected?.total || 0)} dicatat setelah pengembalian dana dilakukan manual. Stok tidak kembali kecuali komponen pemulihan dipilih.`
                    : `Refund demo ${money(selected?.total || 0)}. Stok tidak dikembalikan karena makanan yang telah dibuat tidak dapat dipulihkan. Tidak ada transfer uang sungguhan.`}
                </AlertDescription>
              </Alert>
            )}
            {modal === "product" && (
              <ProductFields
                key={editingProduct || "new"}
                product={data.products.find((p) => p.id === editingProduct)}
                live={live}
              />
            )}
            <div className="dialog-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModal("")}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant={modal === "refund" ? "destructive" : "default"}
                disabled={!online || busy}
              >
                {busy
                  ? "Menyimpan…"
                  : modal === "refund"
                    ? "Konfirmasi refund"
                    : modal === "close-shift"
                      ? "Konfirmasi tutup shift"
                      : modal === "waste"
                        ? "Catat waste"
                        : modal === "count"
                          ? "Konfirmasi stok opname"
                          : live
                            ? "Simpan"
                            : "Simpan simulasi"}{" "}
                <Check size={16} />
              </Button>
            </div>
          </form>
        )}
        {modal === "help" && (
          <div className="help-content">
            <p>
              <b>1. Jelajahi ruang owner.</b> Ubah filter cabang dan tanggal,
              buka detail transaksi, lalu ekspor CSV.
            </p>
            <p>
              <b>2. Coba mode kasir.</b> Pilih menu, kustomisasi, tambahkan ke
              keranjang, dan simulasikan pembayaran.
            </p>
            <p>
              <b>3. Pantau perubahan.</b> Pesanan demo masuk antrean, transaksi,
              dan ringkasan owner.
            </p>
            <p>
              <b>4. Ulangi skenario.</b> Reset data dari halaman Pengaturan.
            </p>
            <Alert role="note" className="notice">
              <AlertDescription>
                <Info size={18} />
                Kasir saat ini berupa preview web responsif, belum aplikasi
                Expo. Semua data hanya ada di browser ini.
              </AlertDescription>
            </Alert>
          </div>
        )}
        {modal === "profile" && (
          <div className="profile-dialog">
            <span className="avatar">AP</span>
            <h2>Andi Pratama</h2>
            <p>Owner · {data.business}</p>
            <Button
              variant="outline"
              onClick={() => {
                setModal("");
                setCart([]);
                go("login");
              }}
            >
              <LogOut size={16} />
              Keluar dari demo
            </Button>
          </div>
        )}
        {modal === "reset" && (
          <>
            <p>
              Seluruh perubahan demo pada browser ini akan diganti dengan data
              awal. Aksi ini hanya memengaruhi prototipe lokal.
            </p>
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => setModal("")}>
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setData(seed());
                  setCart([]);
                  setReceipt(null);
                  setBranch("all");
                  setModal("");
                  notify("Data demo dikembalikan ke kondisi awal.");
                }}
              >
                Reset data demo
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
