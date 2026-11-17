import { createContext, useContext } from "react";
import { Text as NativeText, StyleSheet, type TextProps } from "react-native";

export const FontReady = createContext(false);

export function Text({ style, ...props }: TextProps) {
  const ready = useContext(FontReady);
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const number = weight === "bold" ? 700 : Number(weight || 400);
  const family =
    number >= 700
      ? "HostBold"
      : number >= 600
        ? "HostSemibold"
        : number >= 500
          ? "HostMedium"
          : "HostRegular";
  return (
    <NativeText
      {...props}
      style={[
        ready && { fontFamily: family, fontWeight: "normal" },
        style,
        ready && { fontWeight: "normal" },
      ]}
    />
  );
}
