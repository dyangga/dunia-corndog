import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors as c } from "@dc/design-tokens";
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import { PortalHost } from "@rn-primitives/portal";
import { SelectPortal } from "./select-portal";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { FontReady, Text } from "./typography";
import { EASE_OUT, Touch } from "./motion";
import { Ionicons } from "@expo/vector-icons";
export function Button({
  children,
  onPress,
  disabled,
  variant = "solid",
  label,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  variant?: "solid" | "outline" | "ghost";
  label?: string;
}) {
  return (
    <Touch
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        variant === "solid"
          ? s.solid
          : variant === "outline"
            ? s.outline
            : s.ghost,
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text
        style={[s.buttonText, { color: variant === "solid" ? c.cream : c.ink }]}
      >
        {children}
      </Text>
    </Touch>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  const fontReady = useContext(FontReady);
  return (
    <View style={{ gap: 8, marginBottom: 18 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          s.input,
          fontReady && { fontFamily: "HostRegular" },
          focused && { borderColor: c.ink },
          props.style,
        ]}
      />
    </View>
  );
}
export function Choice({
  title,
  subtitle,
  selected,
  onPress,
  disabled,
  columns = 3,
  multiple = true,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  columns?: 1 | 2 | 3;
  multiple?: boolean;
  compact?: boolean;
}) {
  return (
    <Touch
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ""}`}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.choice,
        columns === 1 && { width: "100%" },
        columns === 2 && { width: "48.5%" },
        compact && { minHeight: 48, paddingVertical: 8, borderRadius: 10 },
        selected && s.selected,
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text
        style={[s.choiceTitle, compact && { fontSize: 12, lineHeight: 17 }]}
      >
        {title}
      </Text>
      {subtitle && <Text style={s.choiceSub}>{subtitle}</Text>}
      {selected && (
        <Ionicons style={s.check} name="checkmark" size={14} color="#87601D" />
      )}
    </Touch>
  );
}
export function ModalFrame({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  illustration,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  illustration?: ReactNode;
}) {
  const portalName = useId();
  const selectClose = useRef<(() => void) | null>(null);
  const registerClose = useCallback((close: () => void) => {
    selectClose.current = close;
    return () => {
      if (selectClose.current === close) selectClose.current = null;
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    // The select handles Escape on keydown; RN Web Modal handles keyup.
    // Consume that matching keyup so one key closes only the select menu.
    let selectEscape = false;
    const down = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectClose.current) selectEscape = true;
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectEscape) {
        selectEscape = false;
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener("keydown", down, true);
    document.addEventListener("keyup", up, true);
    return () => {
      document.removeEventListener("keydown", down, true);
      document.removeEventListener("keyup", up, true);
    };
  }, []);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const portalRef = useCallback((node: ComponentRef<typeof View> | null) => {
    if (Platform.OS === "web")
      setPortalContainer(node as unknown as HTMLElement | null);
  }, []);
  const reduced = useReducedMotion();
  const [present, setPresent] = useState(open);
  const progress = useSharedValue(0);
  const generation = useRef(0);
  const lastContent = useRef({ title, description, children, footer });
  useEffect(() => {
    if (open) lastContent.current = { title, description, children, footer };
  }, [open, title, description, children, footer]);
  useEffect(() => {
    const token = ++generation.current;
    const finishClose = () => {
      if (generation.current === token) setPresent(false);
    };
    if (open) setPresent(true);
    progress.set(
      withTiming(
        open ? 1 : 0,
        {
          duration: reduced ? 120 : open ? 220 : 160,
          easing: EASE_OUT,
          reduceMotion: ReduceMotion.Never,
        },
        (finished) => {
          if (finished && !open) scheduleOnRN(finishClose);
        },
      ),
    );
  }, [open, reduced, progress]);
  const backdrop = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const panel = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [
      { translateY: reduced ? 0 : (1 - progress.get()) * 14 },
      { scale: reduced ? 1 : 0.98 + progress.get() * 0.02 },
    ],
  }));
  const content = open
    ? { title, description, children, footer }
    : lastContent.current;
  return (
    <Modal
      visible={open || present}
      transparent
      animationType="none"
      onRequestClose={() => {
        if (selectClose.current) selectClose.current();
        else onClose();
      }}
      statusBarTranslucent
    >
      <SelectPortal.Provider
        value={{
          hostName: portalName,
          container: portalContainer,
          registerClose,
        }}
      >
        <View
          ref={portalRef}
          collapsable={false}
          style={{ flex: 1 }}
          pointerEvents={open ? "auto" : "none"}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(29,27,24,0.42)" },
              backdrop,
            ]}
          />
          <Pressable
            accessible={false}
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={s.overlay} pointerEvents="box-none">
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={s.modalKeyboard}
              pointerEvents="box-none"
            >
              <Animated.View style={[s.modal, panel]}>
                <View style={s.modalHeader}>
                  {!!illustration && (
                    <View style={s.modalIllustration}>{illustration}</View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.eyebrow}>
                      {illustration ? "PESANAN BARU" : "DUNIA CORNDOG · KASIR"}
                    </Text>
                    <Text
                      accessibilityRole="header"
                      style={[s.modalTitle, !!illustration && { fontSize: 23 }]}
                    >
                      {content.title}
                    </Text>
                    {!!content.description && (
                      <Text style={s.description}>{content.description}</Text>
                    )}
                  </View>
                  <Touch
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Tutup dialog"
                    hitSlop={4}
                    style={s.close}
                  >
                    <Ionicons name="close" size={21} color={c.ink} />
                  </Touch>
                </View>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  style={{ flexShrink: 1 }}
                  contentContainerStyle={s.modalBody}
                >
                  {content.children}
                </ScrollView>
                {!!content.footer && (
                  <View style={s.modalFooter}>{content.footer}</View>
                )}
              </Animated.View>
            </KeyboardAvoidingView>
          </SafeAreaView>
          <PortalHost name={portalName} />
        </View>
      </SelectPortal.Provider>
    </Modal>
  );
}

export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={[s.notice, error && { backgroundColor: "#FCECEE" }]}
    >
      <Text
        style={{
          color: error ? c.redDark : c.muted,
          fontSize: 14,
          lineHeight: 21,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={s.heading}>
      {children}
    </Text>
  );
}
export const money = (n: number) =>
  "Rp" + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  label: { fontSize: 14, fontWeight: "500", color: c.ink },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: c.ink,
    backgroundColor: c.surface,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  solid: { backgroundColor: c.ink },
  outline: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  ghost: { backgroundColor: "transparent" },
  buttonText: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  choice: {
    width: "31.5%",
    minHeight: 52,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 20,
    backgroundColor: c.surface,
  },
  selected: { backgroundColor: "#FFF7E6", borderColor: "#A47124" },
  choiceTitle: {
    fontSize: 13,
    color: c.ink,
    lineHeight: 18,
    fontWeight: "500",
  },
  choiceSub: { fontSize: 12, color: c.muted, marginTop: 3 },
  check: { position: "absolute", right: 5, top: 8 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 22 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: c.muted,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: c.ink,
    marginBottom: 10,
  },
  heading: {
    fontSize: 32,
    fontWeight: "600",
    letterSpacing: -1.1,
    color: c.ink,
    marginBottom: 8,
  },
  description: { fontSize: 14, color: c.muted, lineHeight: 21, marginTop: 8 },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalKeyboard: { width: "100%", maxWidth: 560, maxHeight: "94%" },
  modal: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 24,
    maxHeight: "100%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 24,
    gap: 12,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "600",
    color: c.ink,
    letterSpacing: -0.7,
  },
  modalIllustration: {
    width: 54,
    height: 66,
    borderRadius: 16,
    backgroundColor: "#FFF3D6",
    alignItems: "center",
    justifyContent: "center",
  },
  close: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#F5F4F1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
  },
  modalBody: { paddingHorizontal: 24, paddingBottom: 24 },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: c.border,
    padding: 20,
    backgroundColor: "#FCFBF8",
    gap: 12,
  },
  notice: {
    borderRadius: 12,
    backgroundColor: c.cream,
    padding: 14,
    marginVertical: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    backgroundColor: c.surface,
    padding: 22,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  muted: { fontSize: 14, color: c.muted, lineHeight: 21 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
  },
  stepButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    fontVariant: ["tabular-nums"],
    fontSize: 16,
    minWidth: 24,
    textAlign: "center",
    color: c.ink,
  },
});
