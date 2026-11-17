import { useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  cubicBezier,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const PRESS_EASING = cubicBezier(0.23, 1, 0.32, 1);
const ITEM_ENTER = FadeInDown.duration(150)
  .easing(EASE_OUT)
  .reduceMotion(ReduceMotion.System);
const ITEM_FADE = FadeIn.duration(120).reduceMotion(ReduceMotion.System);
const ITEM_EXIT = FadeOut.duration(100).reduceMotion(ReduceMotion.System);

// Only press-in/out changes React state; Reanimated interpolates on the UI runtime.
export function Touch({
  style,
  children,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      pressRetentionOffset={16}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[
        style,
        {
          transform: [{ scale: pressed && !disabled && !reduced ? 0.97 : 1 }],
          transitionProperty: "transform",
          transitionDuration: reduced ? 0 : 120,
          transitionTimingFunction: PRESS_EASING,
        },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function AddedItem({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? ITEM_FADE : ITEM_ENTER}
      exiting={ITEM_EXIT}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export function feedback(kind: "add" | "success") {
  if (Platform.OS === "web") return;
  void (
    kind === "success"
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  ).catch(() => {});
}
