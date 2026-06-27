import React from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../src/components/TText";
import { colors, radius, spacing, shadows } from "../src/theme";

const ROLES = [
  { id: "passenger", title: "I'm a Traveller", subtitle: "Parikrama, darshan, stays & rides for yatris", icon: "user" as const, color: colors.primary, bg: colors.primaryLight },
  { id: "driver", title: "I'm a Driver", subtitle: "Earn from your e-rickshaw with FifthDigit", icon: "navigation" as const, color: colors.parikrama, bg: colors.parikramaBg },
  { id: "admin", title: "Admin Portal", subtitle: "Manage fares, drivers & complaints", icon: "shield" as const, color: colors.info, bg: colors.infoBg },
];

export default function RoleSelect() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="role-select-screen">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Dark hero */}
        <View style={styles.hero}>
          {/* Decorative blobs */}
          <View style={styles.blobA} />
          <View style={styles.blobB} />

          <View style={styles.brandRow}>
            <View style={styles.logoDot}>
              <TText variant="h2" color="#fff">🪈</TText>
            </View>
            <TText variant="caption" color={colors.primary} style={{ marginLeft: 10 }}>
             WELCOME TO BRAJ
            </TText>
          </View>

          <TText variant="display" color={colors.textInverse} style={{ marginTop: spacing.lg }}>
            FifthDigit
          </TText>
          <TText variant="bodyLg" color={colors.darkMuted} style={{ marginTop: 6 }}>
            Come full circle · sacred journeys
          </TText>

          <View style={styles.heroChips}>
            <View style={styles.chip}>
              <Feather name="compass" size={12} color={colors.primary} />
              <TText variant="caption" color="#fff" style={{ marginLeft: 6 }}>Parikrama</TText>
            </View>
            <View style={styles.chip}>
              <Feather name="map-pin" size={12} color={colors.primary} />
              <TText variant="caption" color="#fff" style={{ marginLeft: 6 }}>Local rides</TText>
            </View>
            <View style={styles.chip}>
              <Feather name="clock" size={12} color={colors.primary} />
              <TText variant="caption" color="#fff" style={{ marginLeft: 6 }}>Schedule ahead</TText>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <TText variant="h2" style={{ marginBottom: 4 }}>Get started</TText>
          <TText variant="bodySm" muted style={{ marginBottom: spacing.lg }}>
            Choose how you want to use FifthDigit
          </TText>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.id}
              testID={`role-select-${r.id}`}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: "/login", params: { role: r.id } })}
            >
              <View style={[styles.iconBubble, { backgroundColor: r.bg }]}>
                <Feather name={r.icon} size={22} color={r.color} />
              </View>
              <View style={{ flex: 1 }}>
                <TText variant="bodyLg" weight="700">{r.title}</TText>
                <TText variant="bodySm" muted style={{ marginTop: 2 }}>{r.subtitle}</TText>
              </View>
              <View style={styles.cardArrow}>
                <Feather name="arrow-right" size={18} color={colors.text} />
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: spacing.xl }} />
          <TText variant="caption" muted align="center">By continuing you agree to FifthDigit T&C</TText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  scroll: { flexGrow: 1, backgroundColor: colors.bg },
  hero: {
    backgroundColor: colors.dark,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    overflow: "hidden",
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  blobA: {
    position: "absolute",
    top: -60, right: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: colors.primary,
    opacity: 0.15,
  },
  blobB: {
    position: "absolute",
    bottom: -80, left: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  logoDot: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    ...shadows.glowPrimary,
  },
  heroChips: {
    flexDirection: "row",
    marginTop: spacing.lg,
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.darkSurface,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  body: { padding: spacing.lg, paddingTop: spacing.xl, backgroundColor: colors.bg, flex: 1 },
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
    width: 52, height: 52, borderRadius: 26,
    justifyContent: "center", alignItems: "center",
    marginRight: spacing.md,
  },
  cardArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgAlt,
    alignItems: "center", justifyContent: "center",
  },
});
