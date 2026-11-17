import { memo } from "react";
import { View, StyleSheet } from "react-native";
import type { PublicOrder } from "@dc/contracts";
import { colors as c } from "@dc/design-tokens";
import { Text } from "../components/typography";
import { Button, money, s } from "../components/ui";
export const OrderCard = memo(function OrderCard({
  order,
  queue,
  online,
  busy,
  onAdvance,
  onReport,
}: {
  order: PublicOrder;
  queue: boolean;
  online: boolean;
  busy: boolean;
  onAdvance: (order: PublicOrder) => void;
  onReport: (order: PublicOrder) => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Text style={styles.cardTitle}>{order.number}</Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: order.refunded
                ? "#FCECEE"
                : order.status === "Siap" || order.status === "Selesai"
                  ? "#EAF2EC"
                  : "#F5F1E8",
            },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "500",
              color: order.refunded
                ? c.redDark
                : order.status === "Siap" || order.status === "Selesai"
                  ? c.green
                  : c.muted,
            }}
          >
            {order.refunded ? "Refund" : order.status}
          </Text>
        </View>
      </View>
      <Text style={[s.muted, { marginTop: 6 }]}>
        {new Date(order.createdAt).toLocaleString("id-ID")} · {order.cashier}
      </Text>
      {order.lines.map((line, i) => (
        <View key={i} style={{ marginTop: 14 }}>
          <Text style={{ fontWeight: "500", color: c.ink }}>
            {line.quantity}× {line.size} {line.name}
          </Text>
          <Text style={s.muted}>
            {[line.category, ...line.modifiers, line.note]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      ))}
      <View style={[s.row, { marginTop: 16 }]}>
        <Text style={{ fontWeight: "600", color: c.ink }}>
          {money(order.total)}
        </Text>
        {queue ? (
          <Button disabled={!online || busy} onPress={() => onAdvance(order)}>
            {
              (
                {
                  Antrean: "Mulai proses",
                  Diproses: "Tandai siap",
                  Siap: "Selesaikan",
                } as Record<string, string>
              )[order.status]
            }
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={order.refunded || !online}
            onPress={() => onReport(order)}
          >
            Ajukan refund
          </Button>
        )}
      </View>
    </View>
  );
});
const styles = StyleSheet.create({
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: c.ink,
    letterSpacing: -0.4,
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
});
