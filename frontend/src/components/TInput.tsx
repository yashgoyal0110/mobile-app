import React from "react";
import { View, TextInput, StyleSheet, TextInputProps } from "react-native";
import { TText } from "./TText";
import { colors, radius, spacing } from "../theme";

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  prefix?: string;
  testID?: string;
}

export function TInput({ label, error, prefix, style, testID, ...rest }: Props) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && (
        <TText variant="bodySm" muted style={{ marginBottom: 6 }}>
          {label}
        </TText>
      )}
      <View style={[styles.box, error && { borderColor: colors.error }]}>
        {prefix && (
          <TText variant="body" muted style={{ marginRight: 8 }}>
            {prefix}
          </TText>
        )}
        <TextInput
          testID={testID}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          {...rest}
        />
      </View>
      {error && (
        <TText variant="bodySm" color={colors.error} style={{ marginTop: 4 }}>
          {error}
        </TText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 0,
  },
});
