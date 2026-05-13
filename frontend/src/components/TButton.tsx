import React from "react";
import { TouchableOpacity, ActivityIndicator, StyleSheet, View, ViewStyle, TextStyle } from "react-native";
import { TText } from "./TText";
import { colors, radius, spacing } from "../theme";

interface Props {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger";
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  small?: boolean;
}

export function TButton({ label, onPress, variant = "primary", loading, disabled, testID, style, icon, fullWidth = true, small }: Props) {
  const bg =
    variant === "primary" ? colors.primary :
    variant === "secondary" ? colors.primaryLight :
    variant === "danger" ? colors.error :
    "transparent";
  const fg =
    variant === "primary" ? colors.textInverse :
    variant === "secondary" ? colors.primaryDark :
    variant === "danger" ? colors.textInverse :
    colors.text;
  const borderColor = variant === "outline" ? colors.border : "transparent";

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor },
        small && { paddingVertical: 10 },
        (disabled || loading) && { opacity: 0.55 },
        !fullWidth && { alignSelf: "flex-start", paddingHorizontal: 24 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <TText variant={small ? "bodySm" : "body"} weight="700" color={fg} style={icon ? { marginLeft: 8 } : undefined}>
            {label}
          </TText>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
});
