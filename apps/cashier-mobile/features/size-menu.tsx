import { memo, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SIZES, type CatalogProduct, type MenuSize } from "@dc/contracts";
import { colors as c } from "@dc/design-tokens";
import Corndog from "../components/corndog";
import { Touch } from "../components/motion";
import { Text } from "../components/typography";
import { money, s } from "../components/ui";
export const SizeMenu = memo(function SizeMenu({
  products,
  width,
  pending,
  onSelect,
}: {
  products: CatalogProduct[];
  width: number;
  pending: boolean;
  onSelect: (size: MenuSize) => void;
}) {
  const bySize = useMemo(
    () =>
      SIZES.map((size) =>
        products.flatMap((p) =>
          p.skus.filter((s) => s.size === size && s.available > 0),
        ),
      ),
    [products],
  );
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {SIZES.map((size, index) => {
        const options = bySize[index];
        return (
          <Touch
            key={size}
            accessibilityRole="button"
            accessibilityLabel={`${size} corndog`}
            disabled={!options.length || pending}
            onPress={() => onSelect(size)}
            style={[
              styles.sizeCard,
              {
                width: width >= 600 ? "31.5%" : "100%",
                opacity: !options.length ? 0.4 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.visual,
                {
                  backgroundColor: ["#F7F5F0", "#FFF7E7", "#F7F1EA"][index],
                },
              ]}
            >
              <Text style={styles.cardNumber}>0{index + 1}</Text>
              <View
                style={[
                  styles.visualCircle,
                  {
                    backgroundColor: ["#EDE6D8", "#FFE9AF", "#ECDCC5"][index],
                  },
                ]}
              />
              <View style={{ zIndex: 1 }}>
                <Corndog width={96 + index * 20} height={114 + index * 22} />
              </View>
            </View>
            <View style={{ padding: 16 }}>
              <View style={s.row}>
                <Text
                  style={[
                    styles.sizeTitle,
                    width >= 600 && width < 1180 && { fontSize: 21 },
                  ]}
                >
                  {size}
                </Text>
                <View style={styles.addIcon}>
                  <Ionicons name="add" size={19} color={c.ink} />
                </View>
              </View>
              <Text style={[s.muted, { marginTop: 6 }]}>
                {options.length} pilihan isian
              </Text>
              <View style={[s.row, { marginTop: 20 }]}>
                <Text
                  style={{
                    fontWeight: "600",
                    fontSize: 16,
                    color: c.ink,
                  }}
                >
                  {options.length
                    ? `Dari ${money(Math.min(...options.map((s) => s.price)))}`
                    : "Belum tersedia"}
                </Text>
              </View>
            </View>
          </Touch>
        );
      })}
    </View>
  );
});
const styles = StyleSheet.create({
  sizeCard: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: c.surface,
  },
  visual: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardNumber: {
    position: "absolute",
    top: 15,
    left: 16,
    fontSize: 11,
    letterSpacing: 1,
    color: "#817769",
    fontWeight: "500",
  },
  visualCircle: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 58,
    opacity: 0.65,
  },
  sizeTitle: {
    fontSize: 25,
    fontWeight: "600",
    color: c.ink,
    letterSpacing: -0.8,
  },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1EFE9",
    justifyContent: "center",
    alignItems: "center",
  },
});
