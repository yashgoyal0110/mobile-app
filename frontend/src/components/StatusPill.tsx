import React from "react";
import { View, StyleSheet } from "react-native";
import { TText } from "./TText";
import { STATUS_STYLE, radius, colors } from "../theme";

export function StatusPill({ status, testID }: { status: string; testID?: string }) {
  const s = STATUS_STYLE[status] || { bg: colors.border, fg: colors.text, label: status };
  return (
    <View testID={testID} style={[styles.pill, { backgroundColor: s.bg }]}>
      <TText variant="caption" color={s.fg}>
        {s.label}
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
});
