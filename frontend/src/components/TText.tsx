import React from "react";
import { Text, TextProps, StyleSheet } from "react-native";
import { typography, colors } from "../theme";

type Variant = keyof typeof typography;

interface Props extends TextProps {
  variant?: Variant;
  muted?: boolean;
  color?: string;
  weight?: "400" | "500" | "600" | "700" | "800";
  align?: "left" | "center" | "right";
}

export function TText({ variant = "body", muted, color, weight, align, style, children, ...rest }: Props) {
  const base = typography[variant];
  return (
    <Text
      {...rest}
      style={[
        base,
        muted && { color: colors.textMuted },
        color && { color },
        weight && { fontWeight: weight },
        align && { textAlign: align },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export const styles = StyleSheet.create({});
