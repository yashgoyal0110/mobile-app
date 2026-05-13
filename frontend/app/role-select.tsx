import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, ImageBackground, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../src/components/TText";
import { colors, radius, spacing, shadows } from "../src/theme";

const ROLES = [
  { id: "passenger", title: "I'm a Passenger", subtitle: "Book parikrama & local e-rickshaw rides", icon: "user" as const, color: colors.primary },
  { id: "driver", title: "I'm a Driver", subtitle: "Earn from your e-rickshaw with TirthRide", icon: "truck" as const, color: colors.parikrama },
  { id: "admin", title: "Admin Portal", subtitle: "Manage fares, drivers & audit logs", icon: "shield" as const, color: colors.text },
];

export default function RoleSelect() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="role-select-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <ImageBackground
          source={{
            uri: "https://images.unsplash.com/photo-1769939280538-2c37aeb5dcca?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwzfHxpbmRpYW4lMjB0ZW1wbGUlMjBzdW5zZXR8ZW58MHx8fHwxNzc4NjU0NTUyfDA&ixlib=rb-4.1.0&q=85",
          }}
          style={styles.hero}
          imageStyle={{ borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          <View style={styles.heroOverlay}>
            <TText variant="caption" color="#FFE0A8">WELCOME TO</TText>
            <TText variant="h1" color={colors.textInverse} style={{ fontSize: 44, marginTop: 4 }}>TirthRide</TText>
            <TText variant="body" color="#FFE0A8" style={{ marginTop: 8 }}>
              E-rickshaws for Govardhan parikrama & local rides
            </TText>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <TText variant="h3" style={{ marginBottom: spacing.lg }}>Continue as</TText>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.id}
              testID={`role-select-${r.id}`}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: "/login", params: { role: r.id } })}
            >
              <View style={[styles.iconBubble, { backgroundColor: r.color + "20" }]}>
                <Feather name={r.icon} size={24} color={r.color} />
              </View>
              <View style={{ flex: 1 }}>
                <TText variant="bodyLg" weight="700">{r.title}</TText>
                <TText variant="bodySm" muted style={{ marginTop: 2 }}>{r.subtitle}</TText>
              </View>
              <Feather name="chevron-right" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  hero: { height: 260, justifyContent: "flex-end" },
  heroOverlay: {
    backgroundColor: "rgba(0,0,0,0.45)",
    flex: 1,
    padding: spacing.xl,
    justifyContent: "flex-end",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  body: { flex: 1, padding: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
});
