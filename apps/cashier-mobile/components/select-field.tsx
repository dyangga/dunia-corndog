import {
  memo,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  FlatList,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import * as Select from "@rn-primitives/select";
import { Ionicons } from "@expo/vector-icons";
import { colors as c } from "@dc/design-tokens";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { FontReady, Text } from "./typography";
import { EASE_OUT } from "./motion";
import { SelectPortal } from "./select-portal";

export type SelectOption = {
  value: string;
  label: string;
  detail?: string;
  disabled?: boolean;
};
const ENTER = FadeIn.duration(120).easing(EASE_OUT);
const FULL_WINDOW = {
  position: "absolute" as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export const SelectField = memo(function SelectField({
  label,
  accessibilityLabel = label,
  value,
  options,
  placeholder = "Pilih…",
  disabled = false,
  onChange,
}: {
  label: string;
  accessibilityLabel?: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const fontReady = useContext(FontReady);
  const portal = useContext(SelectPortal);
  const reduced = useReducedMotion();
  const height = useWindowDimensions().height;
  const [open, setOpen] = useState(false);
  const [triggerWidth, setTriggerWidth] = useState(0);
  const trigger = useRef<ComponentRef<typeof Select.Trigger>>(null);
  const selected = options.find((option) => option.value === value);
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      if (open) trigger.current?.open();
    });
    return () => sub.remove();
  }, [open]);
  useEffect(() => {
    if (open) return portal?.registerClose(() => trigger.current?.close());
  }, [open, portal?.registerClose]);
  function select(next: Select.Option) {
    if (disabled || !next || next.value === value) return;
    const option = options.find((option) => option.value === next.value);
    if (option && !option.disabled) onChange(option.value);
  }
  return (
    <Select.Root
      value={
        selected ? { value: selected.value, label: selected.label } : undefined
      }
      onValueChange={select}
      disabled={disabled}
      onOpenChange={setOpen}
      style={styles.field}
    >
      <Text style={styles.label}>{label}</Text>
      <Select.Trigger
        ref={trigger}
        accessibilityLabel={accessibilityLabel}
        {...(Platform.OS === "web"
          ? {}
          : { accessibilityValue: { text: selected?.label || placeholder } })}
        disabled={disabled}
        onPressIn={Keyboard.dismiss}
        onLayout={(e) => setTriggerWidth(e.nativeEvent.layout.width)}
        style={{
          ...styles.trigger,
          ...(open ? styles.triggerOpen : {}),
          ...(disabled ? { opacity: 0.4 } : {}),
          ...(Platform.OS === "web"
            ? {
                outlineWidth: 0,
                textAlign: "left",
                display: "flex",
                fontFamily: fontReady ? "HostMedium" : undefined,
                fontSize: 14,
                color: selected ? c.ink : c.muted,
              }
            : {}),
        }}
      >
        <View pointerEvents="none" style={{ flex: 1, gap: 2 }}>
          <Select.Value
            placeholder={placeholder}
            {...(Platform.OS === "web" ? {} : { numberOfLines: 1 })}
            style={{
              fontSize: 14,
              fontFamily: fontReady ? "HostMedium" : undefined,
              color: selected ? c.ink : c.muted,
            }}
          >
            {selected?.label}
          </Select.Value>
          {!!selected?.detail && (
            <Text style={styles.detail}>{selected.detail}</Text>
          )}
        </View>
        <View
          pointerEvents="none"
          style={[styles.chevron, open && { backgroundColor: "#EAE7DF" }]}
        >
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={15}
            color={c.muted}
          />
        </View>
      </Select.Trigger>
      <Select.Portal hostName={portal?.hostName} container={portal?.container}>
        <View pointerEvents="box-none" style={{ ...FULL_WINDOW, zIndex: 1000 }}>
          <Select.Overlay accessible={false} style={FULL_WINDOW} />
          <Select.Content
            position="popper"
            side="bottom"
            sideOffset={6}
            align="start"
            insets={{ top: 24, bottom: 24, left: 16, right: 16 }}
            style={{
              ...styles.menu,
              width: triggerWidth || undefined,
              maxHeight: Math.min(320, height - 96),
            }}
          >
            <Animated.View
              entering={reduced || Platform.OS === "web" ? undefined : ENTER}
            >
              <Select.Viewport>
                {Platform.OS !== "web" && options.length > 30 ? (
                  <Select.Group>
                    <FlatList
                      data={options}
                      keyExtractor={optionKey}
                      extraData={value}
                      renderItem={({ item }) => (
                        <MenuOption
                          option={item}
                          selected={value === item.value}
                        />
                      )}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      initialNumToRender={8}
                      maxToRenderPerBatch={8}
                      windowSize={5}
                      style={{
                        height: Math.min(306, height - 110),
                        flexGrow: 0,
                      }}
                      contentContainerStyle={{ padding: 6 }}
                      ItemSeparatorComponent={OptionSeparator}
                    />
                  </Select.Group>
                ) : (
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                    style={{
                      maxHeight: Math.min(306, height - 110),
                      flexGrow: 0,
                    }}
                    contentContainerStyle={{ padding: 6, gap: 2 }}
                  >
                    <Select.Group style={{ gap: 2 }}>
                      {options.map((option) => (
                        <MenuOption
                          key={option.value}
                          option={option}
                          selected={value === option.value}
                        />
                      ))}
                    </Select.Group>
                  </ScrollView>
                )}
              </Select.Viewport>
            </Animated.View>
          </Select.Content>
        </View>
      </Select.Portal>
    </Select.Root>
  );
});

const MenuOption = memo(function MenuOption({
  option,
  selected,
}: {
  option: SelectOption;
  selected: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const fontReady = useContext(FontReady);
  return (
    <Select.Item
      value={option.value}
      label={option.label}
      disabled={option.disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...styles.option,
        ...(focused ? { backgroundColor: "#F5F4EF" } : {}),
        ...(selected ? { backgroundColor: "#FFF3D6" } : {}),
        ...(option.disabled ? { opacity: 0.4 } : {}),
        ...(Platform.OS === "web" ? { outlineWidth: 0, display: "flex" } : {}),
      }}
    >
      <Select.ItemText
        numberOfLines={2}
        style={{
          ...styles.optionLabel,
          fontFamily: fontReady ? "HostMedium" : undefined,
          fontWeight: fontReady ? "normal" : "500",
        }}
      />
      {!!option.detail && <Text style={styles.detail}>{option.detail}</Text>}
      <View style={{ width: 16 }}>
        <Select.ItemIndicator>
          <Ionicons name="checkmark" size={16} color={c.ink} />
        </Select.ItemIndicator>
      </View>
    </Select.Item>
  );
});

function optionKey(option: SelectOption) {
  return option.value;
}
function OptionSeparator() {
  return <View style={{ height: 2 }} />;
}
const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 12, fontWeight: "600", color: c.muted },
  trigger: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    borderWidth: 1,
    borderColor: "#E4E0D6",
    borderRadius: 12,
    backgroundColor: c.surface,
  },
  triggerOpen: { borderColor: c.ink },
  chevron: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F4F0",
  },
  detail: {
    fontSize: 12,
    lineHeight: 17,
    color: c.muted,
    fontVariant: ["tabular-nums"],
  },
  menu: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E0D6",
    overflow: "hidden",
    boxShadow: "0px 8px 24px rgba(41,41,41,0.12)",
    zIndex: 100,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    color: c.ink,
    lineHeight: 20,
    fontWeight: "500",
  },
});
