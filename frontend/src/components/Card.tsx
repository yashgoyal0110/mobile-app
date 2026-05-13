import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, radius, shadows, spacing } from "../theme";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  flat?: boolean;
  testID?: string;
}
export function Card({ children, style, flat, testID }: Props) {
  return (
    <View testID={testID} style={[styles.card, !flat && shadows.sm, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
