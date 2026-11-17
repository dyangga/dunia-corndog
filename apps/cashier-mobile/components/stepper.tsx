import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors as c } from "@dc/design-tokens";
import { Touch } from "./motion";
import { Text } from "./typography";
import { s } from "./ui";
export function Stepper({
  value,
  min,
  max = 999,
  onChange,
  disabled = false,
}: {
  value: number;
  min: number;
  max?: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.stepper}>
      <Touch
        accessibilityRole="button"
        accessibilityLabel="Kurangi jumlah"
        disabled={disabled || value <= min}
        onPress={() => onChange(value - 1)}
        style={s.stepButton}
      >
        <Ionicons
          name="remove"
          size={18}
          color={disabled || value <= min ? c.border : c.ink}
        />
      </Touch>
      <Text style={s.stepValue}>{value}</Text>
      <Touch
        accessibilityRole="button"
        accessibilityLabel="Tambah jumlah"
        disabled={disabled || value >= max}
        onPress={() => onChange(value + 1)}
        style={s.stepButton}
      >
        <Ionicons
          name="add"
          size={18}
          color={disabled || value >= max ? c.border : c.ink}
        />
      </Touch>
    </View>
  );
}
