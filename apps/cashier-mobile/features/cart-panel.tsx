import { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors as c } from "@dc/design-tokens";
import { Text } from "../components/typography";
import { AddedItem, Touch } from "../components/motion";
import { Stepper } from "../components/stepper";
import { Button, money, s } from "../components/ui";
import type { CartLine } from "./cart-line";
export const CartPanel = memo(function CartPanel({
  cart,
  landscape,
  branchName,
  total,
  online,
  currentShift,
  pending,
  onRemove,
  onQuantity,
  onCheckout,
}: {
  cart: CartLine[];
  landscape: boolean;
  branchName?: string;
  total: number;
  online: boolean;
  currentShift: boolean;
  pending: boolean;
  onRemove: (key: string) => void;
  onQuantity: (key: string, quantity: number) => void;
  onCheckout: () => void;
}) {
  return (
    <>
      <View style={[s.row, styles.cartHeader]}>
        <View>
          {landscape && (
            <>
              <Text style={styles.cardTitle}>Pesanan saat ini</Text>
            </>
          )}
          <Text style={s.muted}>{branchName}</Text>
        </View>
        <Text style={styles.count}>
          {cart.reduce((n, l) => n + l.quantity, 0)}
        </Text>
      </View>
      {!cart.length ? (
        <View style={styles.cartEmpty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bag-handle-outline" size={30} color={c.muted} />
          </View>
          <Text style={styles.cardTitle}>Pesanan masih kosong</Text>
        </View>
      ) : (
        cart.map((line) => (
          <AddedItem key={line.key} style={styles.cartLine}>
            <View style={s.row}>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: "600",
                  color: c.ink,
                }}
              >
                {line.size} · {line.name}
              </Text>
              <Touch
                disabled={pending}
                accessibilityRole="button"
                accessibilityLabel={`Hapus ${line.name}`}
                onPress={() => onRemove(line.key)}
                style={s.stepButton}
              >
                <Ionicons name="trash-outline" size={18} color={c.muted} />
              </Touch>
            </View>
            <Text style={s.muted}>
              {line.category}
              {line.modifiers.length ? ` · ${line.modifiers.join(", ")}` : ""}
            </Text>
            {!!line.note && <Text style={s.muted}>Catatan: {line.note}</Text>}
            <View style={[s.row, { marginTop: 12 }]}>
              <Stepper
                value={line.quantity}
                min={1}
                disabled={pending}
                onChange={(quantity) => onQuantity(line.key, quantity)}
              />
              <Text style={{ fontWeight: "600", color: c.ink }}>
                {money(line.unitPrice * line.quantity)}
              </Text>
            </View>
          </AddedItem>
        ))
      )}
      <View style={[s.row, styles.cartTotal]}>
        <Text style={styles.cardTitle}>Total</Text>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "600",
            color: c.ink,
            fontVariant: ["tabular-nums"],
          }}
        >
          {money(total)}
        </Text>
      </View>
      <Button
        disabled={!online || !currentShift || !cart.length || pending}
        onPress={onCheckout}
      >
        Lanjut pembayaran
      </Button>
    </>
  );
});
const styles = StyleSheet.create({
  cartHeader: {
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingBottom: 20,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: c.ink,
    letterSpacing: -0.4,
  },
  count: {
    minWidth: 34,
    textAlign: "center",
    backgroundColor: c.ink,
    color: c.cream,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  cartEmpty: { alignItems: "center", paddingVertical: 42, gap: 10 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#F5F3EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  cartLine: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  cartTotal: { marginTop: 20, marginBottom: 20, paddingTop: 8 },
});
