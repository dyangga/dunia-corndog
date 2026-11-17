import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  FlatList,
  View,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as Network from "expo-network";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ApiError,
  type CatalogProduct,
  type Catalog,
  type CheckoutInput,
  type PublicOrder,
  type PublicShift,
  type MenuSize,
} from "@dc/contracts";
import { SizeMenu } from "./size-menu";
import { CartPanel } from "./cart-panel";
import { OrderCard } from "./order-card";
import { CustomizeDialog } from "./customize-dialog";
import type { CartLine } from "./cart-line";
import { Text } from "../components/typography";
import { AddedItem, feedback } from "../components/motion";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors as c } from "@dc/design-tokens";
import { useSession } from "../lib/session";
import {
  Button,
  Choice,
  Field,
  Heading,
  ModalFrame,
  Notice,
  money,
  s,
} from "../components/ui";
const EMPTY_PRODUCTS: CatalogProduct[] = [];
type Pending = { key: string; body: CheckoutInput };
export default function Cashier() {
  const { user, request, logout } = useSession();
  const qc = useQueryClient();
  const width = useWindowDimensions().width;
  const insets = useSafeAreaInsets();
  const landscape = width >= 900;
  const network = Network.useNetworkState();
  const online =
    network.isConnected !== false && network.isInternetReachable !== false;
  const [branch, setBranch] = useState(user!.branches[0]?.id || ""),
    [screen, setScreen] = useState("pos"),
    [cart, setCart] = useState<CartLine[]>([]),
    [pending, setPending] = useState<Pending | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [size, setSize] = useState<MenuSize | null>(null),
    [customizeKey, setCustomizeKey] = useState(0),
    [payment, setPayment] = useState(false),
    [method, setMethod] = useState<"Tunai" | "QRIS" | "Transfer">("Tunai"),
    [received, setReceived] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [reference, setReference] = useState(""),
    [receipt, setReceipt] = useState<PublicOrder | null>(null),
    [shiftModal, setShiftModal] = useState<"open" | "close" | null>(null),
    [cash, setCash] = useState(""),
    [showCart, setShowCart] = useState(false),
    [reportOrder, setReportOrder] = useState<PublicOrder | null>(null),
    [reportMessage, setReportMessage] = useState(""),
    [stockReport, setStockReport] = useState(false);
  const loadedKey = useRef("");
  const draftKey = `dc.draft.${user!.id}.${branch}`,
    pendingKey = `dc.pending.${user!.id}.${branch}`;
  const shift = useQuery({
    refetchInterval: 20000,
    queryKey: ["shift"],
    queryFn: () => request<PublicShift | null>("/shifts/current"),
    enabled: online,
  });
  useEffect(() => {
    if (shift.data && shift.data.branchId !== branch)
      setBranch(shift.data.branchId);
  }, [shift.data]);
  const catalog = useQuery({
    refetchInterval: 20000,
    queryKey: ["catalog", branch],
    queryFn: () => request<Catalog>(`/catalog?branchId=${branch}`),
    enabled: !!branch && online,
  });
  const orders = useInfiniteQuery({
    queryKey: ["orders", branch, screen],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      request<{ items: PublicOrder[]; nextCursor: string | null }>(
        `/orders?branchId=${branch}&limit=25&active=${screen === "queue"}${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    getNextPageParam: (last) => last.nextCursor || undefined,
    refetchInterval: screen === "queue" ? 20000 : false,
    enabled: !!branch && online && (screen === "queue" || screen === "history"),
  });
  const priorityQueue = useQuery({
    queryKey: ["orders", branch, "priority"],
    queryFn: () =>
      request<{ items: PublicOrder[]; nextCursor: string | null }>(
        `/orders?branchId=${branch}&limit=100&active=true`,
      ),
    refetchInterval: 20000,
    enabled: !!branch && online && screen === "pos",
  });
  const priorityOrder = useMemo(() => {
    const statusPriority: Record<string, number> = {
      Siap: 0,
      Diproses: 1,
      Antrean: 2,
    };
    return [...(priorityQueue.data?.items || [])]
      .filter(
        (order) =>
          !order.refunded &&
          !["Selesai", "Dibatalkan"].includes(order.status),
      )
      .sort(
        (a, b) =>
          (statusPriority[a.status] ?? 3) - (statusPriority[b.status] ?? 3) ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )[0];
  }, [priorityQueue.data]);
  const stocks = useQuery({
    refetchInterval: 20000,
    queryKey: ["stock", branch],
    queryFn: () =>
      request<
        {
          id: string;
          name: string;
          quantity: string;
          unit: string;
          minimum: string;
        }[]
      >(`/inventory?branchId=${branch}`),
    enabled: !!branch && online && screen === "stock",
  });
  useEffect(() => {
    let active = true;
    loadedKey.current = "";
    setCart([]);
    setPending(null);
    void Promise.all([
      AsyncStorage.getItem(draftKey),
      AsyncStorage.getItem(pendingKey),
    ])
      .then(([draft, operation]) => {
        if (!active) return;
        if (draft) setCart(JSON.parse(draft));
        if (operation) {
          setPending(JSON.parse(operation));
          setMessage(
            "Ada checkout yang belum dipastikan. Periksa hasil sebelum membuat transaksi baru.",
          );
        }
        loadedKey.current = draftKey;
      })
      .catch(() => {
        if (active) setMessage("Draft gagal dipulihkan.");
      });
    return () => {
      active = false;
    };
  }, [draftKey, pendingKey]);
  useEffect(() => {
    if (loadedKey.current === draftKey) {
      const timer = setTimeout(() => {
        void AsyncStorage.setItem(draftKey, JSON.stringify(cart));
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [cart, draftKey]);
  const total = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const currentShift = shift.data?.branchId === branch ? shift.data : null;
  const closeCustomize = useCallback(() => setSize(null), []);
  const openSize = useCallback((next: MenuSize) => {
    setCustomizeKey((key) => key + 1);
    setSize(next);
  }, []);
  const addLine = useCallback(
    (line: CartLine, available: number) => {
      if (pending) return false;
      const existing = cart
        .filter((l) => l.skuId === line.skuId)
        .reduce((n, l) => n + l.quantity, 0);
      if (existing + line.quantity > available) {
        setMessage("Jumlah melebihi ketersediaan.");
        return false;
      }
      setCart((old) =>
        old.some((l) => l.key === line.key)
          ? old.map((l) =>
              l.key === line.key
                ? { ...l, quantity: l.quantity + line.quantity }
                : l,
            )
          : [...old, line],
      );
      feedback("add");
      setMessage("");
      return true;
    },
    [cart, pending],
  );
  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["catalog"] }),
      qc.invalidateQueries({ queryKey: ["orders"] }),
      qc.invalidateQueries({ queryKey: ["shift"] }),
      qc.invalidateQueries({ queryKey: ["stock"] }),
    ]);
  }, [qc]);
  const advanceOrder = useCallback(
    async (order: PublicOrder) => {
      setBusy(true);
      try {
        await request(`/orders/${order.id}/status`, {
          method: "PATCH",
          body: {
            status: (
              {
                Antrean: "Diproses",
                Diproses: "Siap",
                Siap: "Selesai",
              } as Record<string, string>
            )[order.status],
          },
        });
        await refresh();
      } catch (e) {
        setMessage((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [request, refresh],
  );
  const reportRefund = useCallback((order: PublicOrder) => {
    setReportMessage("");
    setReportOrder(order);
  }, []);
  async function acceptOrder(order: PublicOrder) {
    await AsyncStorage.multiRemove([draftKey, pendingKey]);
    setCart([]);
    setPending(null);
    setPayment(false);
    setShowCart(false);
    setReceipt(order);
    feedback("success");
    setReceived("");
    setConfirmed(false);
    setMessage("");
    await refresh();
  }
  async function sendCheckout(operation: Pending) {
    setBusy(true);
    setMessage("");
    try {
      const result = await request<PublicOrder>("/checkout", {
        method: "POST",
        body: operation.body,
        key: operation.key,
      });
      await acceptOrder(result);
    } catch (e) {
      const error = e as ApiError;
      if (error.status >= 400 && error.status < 500) {
        await AsyncStorage.removeItem(pendingKey);
        setPending(null);
      }
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    if (!currentShift || !online || !cart.length || pending) return;
    const body: CheckoutInput = {
      shiftId: currentShift.id,
      lines: cart.map((l) => ({
        skuId: l.skuId,
        quantity: l.quantity,
        modifierIds: l.modifierIds,
        note: l.note,
      })),
      expectedTotal: total,
      payment: {
        method,
        cashReceived: method === "Tunai" ? Number(received) : undefined,
        confirmed: method !== "Tunai" && confirmed,
        reference,
      },
    };
    const operation = { key: Crypto.randomUUID(), body };
    setBusy(true);
    try {
      await AsyncStorage.setItem(pendingKey, JSON.stringify(operation));
      setPending(operation);
    } catch {
      setBusy(false);
      setMessage(
        "Tidak dapat menyimpan kunci checkout. Transaksi belum dikirim.",
      );
      return;
    }
    await sendCheckout(operation);
  }
  async function checkPending() {
    if (!pending) return;
    setBusy(true);
    try {
      const status = await request<{
        found: boolean;
        result: PublicOrder | null;
      }>(`/operations/checkout/${pending.key}`);
      if (status.found && status.result) await acceptOrder(status.result);
      else
        setMessage(
          "Hasil belum tercatat. Gunakan “Kirim ulang checkout” dengan kunci yang sama.",
        );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function shiftAction() {
    setBusy(true);
    try {
      const path =
        shiftModal === "open"
          ? "/shifts/open"
          : `/shifts/${currentShift?.id}/close`;
      const body =
        shiftModal === "open"
          ? { branchId: branch, opening: Number(cash) }
          : { actual: Number(cash) };
      await request(path, { method: "POST", body, key: Crypto.randomUUID() });
      setShiftModal(null);
      setCash("");
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reviewPrices() {
    const fresh = await catalog.refetch();
    if (!fresh.data) return;
    setCart((old) =>
      old.map((line) => {
        const p = fresh.data.products.find((p) => p.id === line.productId),
          s = p?.skus.find((s) => s.id === line.skuId);
        if (!s) return line;
        return {
          ...line,
          unitPrice:
            s.price +
            line.modifierIds.reduce(
              (n, id) =>
                n + (fresh.data.modifiers.find((m) => m.id === id)?.price || 0),
              0,
            ),
        };
      }),
    );
    setMessage(
      "Harga diperbarui. Periksa total dan pilihan sebelum membayar kembali.",
    );
  }
  const isOrderScreen = screen === "queue" || screen === "history";
  const visibleOrders = useMemo(() => {
    const items = orders.data?.pages.flatMap((page) => page.items) || [];
    return screen === "queue"
      ? items.filter(
          (order) =>
            !order.refunded &&
            !["Selesai", "Dibatalkan"].includes(order.status),
        )
      : items;
  }, [orders.data, screen]);
  const renderOrder = useCallback(
    ({ item }: { item: PublicOrder }) => (
      <OrderCard
        order={item}
        queue={screen === "queue"}
        online={online}
        busy={busy}
        onAdvance={advanceOrder}
        onReport={reportRefund}
      />
    ),
    [screen, online, busy, advanceOrder, reportRefund],
  );
  const removeLine = useCallback(
    (key: string) => setCart((old) => old.filter((line) => line.key !== key)),
    [],
  );
  const changeQuantity = useCallback(
    (key: string, quantity: number) =>
      setCart((old) =>
        old.map((line) => (line.key === key ? { ...line, quantity } : line)),
      ),
    [],
  );
  const openPayment = useCallback(() => {
    setPayment(true);
    setShowCart(false);
  }, []);
  const cartBody = (
    <CartPanel
      cart={cart}
      landscape={false}
      branchName={user!.branches.find((b) => b.id === branch)?.name}
      total={total}
      online={online}
      currentShift={!!currentShift}
      pending={!!pending}
      onRemove={removeLine}
      onQuantity={changeQuantity}
      onCheckout={openPayment}
    />
  );
  if (!user!.branches.length)
    return (
      <SafeAreaView style={[s.screen, { padding: 24 }]}>
        <Heading>Belum ada penugasan</Heading>
        <Notice>Minta owner mengatur cabang akun Anda.</Notice>
        <Button onPress={() => void logout()}>Keluar</Button>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.screen} edges={["top", "left", "right"]}>
      <View
        style={[
          styles.topControls,
          {
            flexDirection: landscape ? "row" : "column-reverse",
            alignItems: landscape ? "center" : "stretch",
            paddingHorizontal: landscape ? 28 : 16,
          },
        ]}
      >
        <View
          style={[
            styles.navigation,
            landscape
              ? { flex: 1 }
              : { alignSelf: "center", width: "100%" },
          ]}
        >
          {[
            ["pos", "Kasir", "grid-outline"],
            ["queue", "Antrean", "receipt-outline"],
            ["history", "Riwayat", "time-outline"],
            ["stock", "Stok", "cube-outline"],
          ].map(([id, label, icon]) => (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: screen === id }}
              onPress={() => setScreen(id)}
              style={[
                styles.navTab,
                width < 600 && {
                  flexDirection: "column",
                  gap: 4,
                  paddingHorizontal: 8,
                },
                screen === id && { backgroundColor: c.ink },
              ]}
            >
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={screen === id ? c.cream : c.muted}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: screen === id ? c.cream : c.muted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View
          style={[
            styles.operator,
            landscape && { alignSelf: "center", maxWidth: 440 },
          ]}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[s.muted, { flexShrink: 1 }]}
          >
            {user!.name}
          </Text>
          <View
            style={[
              styles.shiftBadge,
              { backgroundColor: currentShift ? "#EAF2EC" : "#EFEEEA" },
            ]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: currentShift ? c.green : c.muted },
              ]}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: "500",
                color: currentShift ? c.green : c.muted,
              }}
            >
              {currentShift ? "Shift aktif" : "Belum membuka shift"}
            </Text>
          </View>
          <Button
            variant="outline"
            disabled={!online || !!pending}
            onPress={() => {
              setCash("");
              setShiftModal(currentShift ? "close" : "open");
            }}
          >
            {currentShift ? "Tutup shift" : "Buka shift"}
          </Button>
        </View>
      </View>
      <FlatList<PublicOrder>
        key={screen}
        style={{ flex: 1 }}
        data={isOrderScreen ? visibleOrders : []}
        keyExtractor={orderKey}
        renderItem={renderOrder}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        ItemSeparatorComponent={OrderSeparator}
        ListFooterComponent={
          isOrderScreen ? (
            <>
              {orders.isError && <Notice error>{orders.error.message}</Notice>}
              {orders.hasNextPage && (
                <Button
                  variant="outline"
                  disabled={orders.isFetchingNextPage}
                  onPress={() => void orders.fetchNextPage()}
                >
                  Muat transaksi berikutnya
                </Button>
              )}
              {orders.data?.pages[0]?.items.length === 0 && (
                <Notice>Belum ada transaksi.</Notice>
              )}
            </>
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: landscape ? 28 : 16,
          paddingBottom:
            screen === "pos" && !landscape
              ? 300 + insets.bottom
              : 36 + insets.bottom,
          width: "100%",
          maxWidth: 1600,
          alignSelf: "center",
        }}
        ListHeaderComponent={
          <>
            {user!.branches.length > 1 && (
              <View style={s.choices}>
                {user!.branches.map((b) => (
                  <Choice
                    key={b.id}
                    title={b.name}
                    selected={branch === b.id}
                    disabled={!!currentShift || !!pending || !!cart.length}
                    onPress={() => setBranch(b.id)}
                  />
                ))}
              </View>
            )}
            {!online && (
              <Notice error>
                Offline. Draft tetap tersimpan; checkout dan perubahan
                dinonaktifkan.
              </Notice>
            )}
            {!!message && <Notice error>{message}</Notice>}
            {catalog.isError && (
              <Notice error>
                Katalog gagal diperbarui. Data terakhir ditampilkan:{" "}
                {catalog.error.message}
              </Notice>
            )}
            {pending && (
              <View style={s.card}>
                <Text style={styles.cardTitle}>Checkout belum dipastikan</Text>
                <Text style={[s.muted, { marginVertical: 12 }]}>
                  Periksa hasil atau kirim ulang permintaan yang sama. Jangan
                  membuat transaksi baru.
                </Text>
                <Button
                  disabled={!online || busy}
                  onPress={() => void checkPending()}
                >
                  Periksa hasil checkout
                </Button>
                <Button
                  variant="outline"
                  disabled={!online || busy}
                  onPress={() => void sendCheckout(pending)}
                >
                  Kirim ulang checkout
                </Button>
              </View>
            )}
            {screen === "pos" && (
              <View
                style={{
                  flexDirection: landscape ? "row" : "column",
                  gap: 24,
                  alignItems: "flex-start",
                }}
              >
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    width: landscape ? undefined : "100%",
                  }}
                >
                  {catalog.isPending ? (
                    <ActivityIndicator color={c.ink} />
                  ) : (
                    <SizeMenu
                      products={catalog.data?.products || EMPTY_PRODUCTS}
                      width={width}
                      pending={!!pending}
                      onSelect={openSize}
                    />
                  )}
                </View>
                {landscape && (
                  <View style={styles.landscapeCartAction}>
                    <PriorityOrderCard
                      order={priorityOrder}
                      loading={priorityQueue.isFetching}
                      online={online}
                      error={priorityQueue.isError}
                      count={priorityQueue.data?.items.length || 0}
                      busy={busy}
                      onAdvance={advanceOrder}
                    />
                    <Button onPress={() => setShowCart(true)}>
                      Lihat pesanan ({cart.reduce((n, l) => n + l.quantity, 0)})
                      {" · "}
                      {money(total)}
                    </Button>
                  </View>
                )}
              </View>
            )}
            {screen === "stock" && (
              <>
                <Button
                  variant="outline"
                  disabled={!online}
                  onPress={() => {
                    setReportMessage("");
                    setStockReport(true);
                  }}
                >
                  Laporkan masalah stok
                </Button>
                {(stocks.data || []).map((item) => (
                  <View
                    style={[s.card, s.row, { marginTop: 12 }]}
                    key={item.id}
                  >
                    <View
                      style={[s.row, { flex: 1, justifyContent: "flex-start" }]}
                    >
                      <View style={styles.stockIcon}>
                        <Ionicons
                          name="cube-outline"
                          size={20}
                          color={c.muted}
                        />
                      </View>
                      <Text
                        style={{ flex: 1, color: c.ink, fontWeight: "500" }}
                      >
                        {item.name}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontWeight: "600",
                        color:
                          Number(item.quantity) < Number(item.minimum)
                            ? c.redDark
                            : c.ink,
                      }}
                    >
                      {Number(item.quantity)} {item.unit}
                    </Text>
                  </View>
                ))}
                {stocks.isError && (
                  <Notice error>{stocks.error.message}</Notice>
                )}
              </>
            )}
          </>
        }
      />
      {!landscape && screen === "pos" && (
        <View
          style={[
            styles.cartDock,
            { paddingBottom: Math.max(16, insets.bottom) },
          ]}
        >
          <PriorityOrderCard
            order={priorityOrder}
            loading={priorityQueue.isFetching}
            online={online}
            error={priorityQueue.isError}
            count={priorityQueue.data?.items.length || 0}
            busy={busy}
            onAdvance={advanceOrder}
          />
          <Button onPress={() => setShowCart(true)}>
            Lihat pesanan ({cart.reduce((n, l) => n + l.quantity, 0)}) ·{" "}
            {money(total)}
          </Button>
        </View>
      )}
      <ModalFrame
        open={showCart}
        title="Pesanan saat ini"
        onClose={() => setShowCart(false)}
      >
        {cartBody}
      </ModalFrame>
      <CustomizeDialog
        key={customizeKey}
        size={size}
        catalog={catalog.data}
        pending={!!pending}
        onClose={closeCustomize}
        onAdd={addLine}
      />
      <ModalFrame
        open={payment}
        title="Selesaikan pembayaran"
        onClose={() => {
          if (!busy) setPayment(false);
        }}
        footer={
          <Button
            disabled={
              !online ||
              busy ||
              !!pending ||
              (method === "Tunai" ? Number(received) < total : !confirmed)
            }
            onPress={() => void checkout()}
          >
            {busy ? "Memastikan transaksi…" : `Konfirmasi · ${money(total)}`}
          </Button>
        }
      >
        <View style={[s.row, { marginBottom: 24 }]}>
          <Text style={s.muted}>Total pembayaran</Text>
          <Text style={{ fontSize: 30, fontWeight: "600", color: c.ink }}>
            {money(total)}
          </Text>
        </View>
        <View style={s.choices}>
          {(["Tunai", "QRIS", "Transfer"] as const).map((m) => (
            <Choice
              key={m}
              title={m}
              selected={method === m}
              onPress={() => {
                setMethod(m);
                setConfirmed(false);
              }}
            />
          ))}
        </View>
        {method === "Tunai" ? (
          <>
            <Field
              label="Uang diterima (Rp)"
              value={received}
              onChangeText={setReceived}
              keyboardType="number-pad"
            />
            <Button
              variant="outline"
              onPress={() => setReceived(String(total))}
            >
              Uang pas
            </Button>
            <Text style={[s.muted, { marginTop: 16 }]}>
              Kembalian {money(Math.max(0, Number(received) - total))}
            </Text>
          </>
        ) : (
          <>
            <Notice>
              {method} manual. Periksa penerimaan dana sebelum mengonfirmasi.
            </Notice>
            <Field
              label="Referensi pembayaran (opsional)"
              value={reference}
              onChangeText={setReference}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmed }}
              onPress={() => setConfirmed(!confirmed)}
              style={[s.row, { justifyContent: "flex-start", minHeight: 48 }]}
            >
              <Ionicons
                name={confirmed ? "checkbox" : "square-outline"}
                size={24}
                color={c.ink}
              />
              <Text style={[s.muted, { flex: 1 }]}>
                Saya sudah memeriksa dan menerima pembayaran.
              </Text>
            </Pressable>
          </>
        )}
        {!!message && <Notice error>{message}</Notice>}
        {message.includes("Harga") && (
          <Button
            variant="outline"
            disabled={busy}
            onPress={() => void reviewPrices()}
          >
            Tinjau harga terbaru
          </Button>
        )}
      </ModalFrame>
      <ModalFrame
        open={!!receipt}
        title="Pesanan berhasil dicatat"
        onClose={() => setReceipt(null)}
        footer={
          <Button onPress={() => setReceipt(null)}>
            Buat pesanan berikutnya
          </Button>
        }
      >
        {receipt && (
          <>
            <AddedItem style={styles.successBadge}>
              <Ionicons
                name="checkmark"
                size={48}
                color={c.green}
                style={{ alignSelf: "center" }}
              />
            </AddedItem>
            <Text style={[styles.cardTitle, { textAlign: "center" }]}>
              {receipt.number}
            </Text>
            <Text style={[s.muted, { textAlign: "center", marginBottom: 24 }]}>
              Lunas · {new Date(receipt.createdAt).toLocaleString("id-ID")}
            </Text>
            {receipt.lines.map((line, i) => (
              <View style={styles.cartLine} key={i}>
                <Text style={{ fontWeight: "500", color: c.ink }}>
                  {line.quantity}× {line.size} {line.name}
                </Text>
                <Text style={s.muted}>
                  {[line.category, ...line.modifiers, line.note]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <Text style={{ marginTop: 8, color: c.ink }}>
                  {money(line.unitPrice * line.quantity)}
                </Text>
              </View>
            ))}
            <Text style={[styles.cardTitle, { marginTop: 20 }]}>
              Total {money(receipt.total)}
            </Text>
            <Text style={s.muted}>
              {receipt.method} · Diterima {money(receipt.received)} · Kembalian{" "}
              {money(receipt.received - receipt.total)}
            </Text>
          </>
        )}
      </ModalFrame>
      <ModalFrame
        open={!!shiftModal}
        title={
          shiftModal === "open" ? "Buka shift" : "Tutup & rekonsiliasi shift"
        }
        onClose={() => setShiftModal(null)}
        footer={
          <Button
            disabled={!online || busy || cash === "" || Number(cash) < 0}
            onPress={() => void shiftAction()}
          >
            {busy
              ? "Menyimpan…"
              : shiftModal === "open"
                ? "Buka shift"
                : "Tutup shift"}
          </Button>
        }
      >
        {shiftModal === "close" && (
          <Notice>
            Kas harapan {money(currentShift?.expected || 0)}. Hitung uang fisik
            sebelum menutup shift.
          </Notice>
        )}
        <Field
          label={
            shiftModal === "open" ? "Kas awal (Rp)" : "Kas aktual di laci (Rp)"
          }
          value={cash}
          onChangeText={setCash}
          keyboardType="number-pad"
        />
        {!!message && <Notice error>{message}</Notice>}
      </ModalFrame>
      <ModalFrame
        open={!!reportOrder || stockReport}
        title={stockReport ? "Laporkan masalah stok" : "Ajukan refund ke owner"}
        onClose={() => {
          setReportOrder(null);
          setStockReport(false);
        }}
        footer={
          <Button
            disabled={!online || busy || reportMessage.trim().length < 5}
            onPress={async () => {
              setBusy(true);
              try {
                await request("/requests", {
                  method: "POST",
                  body: {
                    branchId: branch,
                    kind: stockReport ? "STOCK" : "REFUND",
                    orderId: reportOrder?.id,
                    message: reportMessage,
                  },
                });
                setReportOrder(null);
                setStockReport(false);
                setMessage("Laporan terkirim ke owner.");
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Kirim ke owner
          </Button>
        }
      >
        <Field
          label="Alasan / keterangan"
          value={reportMessage}
          onChangeText={setReportMessage}
          multiline
          maxLength={500}
        />
        <Notice>
          Owner akan meninjau permintaan. Tidak ada perubahan stok atau
          pengembalian dana otomatis.
        </Notice>
      </ModalFrame>
    </SafeAreaView>
  );
}
function orderKey(order: PublicOrder) {
  return order.id;
}
function PriorityOrderCard({
  order,
  loading,
  online,
  error,
  count,
  busy,
  onAdvance,
}: {
  order?: PublicOrder;
  loading: boolean;
  online: boolean;
  error: boolean;
  count: number;
  busy: boolean;
  onAdvance: (order: PublicOrder) => Promise<void>;
}) {
  const actionLabel = order
    ? (
        {
          Antrean: "Mulai proses",
          Diproses: "Tandai siap",
          Siap: "Selesaikan",
        } as Record<string, string>
      )[order.status]
    : undefined;
  return (
    <View style={styles.priorityCard}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.priorityEyebrow}>ANTREAN PRIORITAS</Text>
          {order ? (
            <View
              style={[s.row, { justifyContent: "flex-start", marginTop: 6 }]}
            >
              <Text style={styles.priorityNumber}>{order.number}</Text>
              <Text
                style={[
                  styles.priorityStatus,
                  order.status === "Siap"
                    ? styles.priorityStatusReady
                    : styles.priorityStatusWaiting,
                ]}
              >
                {order.status}
              </Text>
            </View>
          ) : (
            <Text style={styles.priorityEmpty}>
              {loading
                ? "Memuat antrean…"
                : error
                  ? "Antrean gagal dimuat"
                  : !online
                    ? "Menunggu koneksi"
                    : count === 0
                      ? "Belum ada pesanan aktif"
                      : "Antrean belum tersedia"}
            </Text>
          )}
        </View>
        {order && (
          <Ionicons
            name={order.status === "Siap" ? "checkmark-circle" : "time-outline"}
            size={19}
            color={order.status === "Siap" ? c.green : c.muted}
          />
        )}
      </View>
      {order && (
        <>
          <Text numberOfLines={2} style={styles.priorityItems}>
            {order.lines
              .map((line) => `${line.quantity}× ${line.size} ${line.name}`)
              .join(" · ")}
          </Text>
          <Text style={styles.priorityMeta}>
            {order.lines.reduce((sum, line) => sum + line.quantity, 0)} item ·
            {" "}
            Masuk{" "}
            {new Date(order.createdAt).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </>
      )}
      {order && actionLabel && (
        <View style={{ marginTop: 12 }}>
          <Button
            variant="outline"
            disabled={!online || busy}
            onPress={() => void onAdvance(order)}
          >
            {busy ? "Memperbarui…" : actionLabel}
          </Button>
        </View>
      )}
    </View>
  );
}
function OrderSeparator() {
  return <View style={{ height: 12 }} />;
}
const styles = StyleSheet.create({
  topControls: { justifyContent: "space-between", gap: 12, paddingTop: 16 },
  operator: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 8,
    maxWidth: "100%",
    flexShrink: 1,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  shiftBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 99,
  },
  navigation: {
    flexDirection: "row",
    gap: 5,
    padding: 6,
    alignSelf: "stretch",
    maxWidth: 520,
    backgroundColor: "#EEECE6",
    borderRadius: 16,
  },
  navTab: {
    flexDirection: "row",
    gap: 7,
    minHeight: 48,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: c.ink,
    letterSpacing: -0.4,
  },
  cartLine: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  cartDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  landscapeCartAction: {
    width: "36%",
    alignSelf: "flex-end",
  },
  priorityCard: {
    width: "100%",
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    backgroundColor: c.surface,
    marginBottom: 12,
  },
  priorityEyebrow: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "600",
    color: c.muted,
  },
  priorityNumber: { fontSize: 18, fontWeight: "600", color: c.ink },
  priorityStatus: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "600",
  },
  priorityStatusReady: { color: c.green, backgroundColor: "#EAF2EC" },
  priorityStatusWaiting: { color: "#8A6425", backgroundColor: c.cream },
  priorityItems: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: c.ink,
  },
  priorityMeta: { marginTop: 5, fontSize: 11, color: c.muted },
  priorityEmpty: { marginTop: 6, fontSize: 13, color: c.muted },
  stockIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F5F3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  successBadge: {
    alignSelf: "center",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EAF2EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
});
