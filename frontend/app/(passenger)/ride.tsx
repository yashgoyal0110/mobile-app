import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { TText } from "../../src/components/TText";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { colors, radius, spacing } from "../../src/theme";

/**
 * E-Rickshaw booking hub — the full ride interface (local rides + parikrama
 * packages). Reached from the Home hub's "E-Rickshaw" option.
 */
export default function RideHub() {
  const router = useRouter();
  const [config, setConfig] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setConfig(await api<any>("/config/fare", { auth: false }));
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = (type: string) => router.push({ pathname: "/(passenger)/service", params: { type } });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="passenger-ride-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="ride-back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <TText variant="h3" style={{ marginLeft: spacing.md }}>E-Rickshaw</TText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Big "Where to?" search prompt — Uber style */}
        <TouchableOpacity
          testID="ride-where-to"
          style={styles.whereTo}
          activeOpacity={0.85}
          onPress={() => open("local")}
        >
          <View style={styles.whereToIcon}>
            <Feather name="search" size={20} color={colors.text} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <TText variant="bodyLg" weight="700">Where to?</TText>
            <TText variant="caption" muted style={{ marginTop: 2 }}>Local rides within Govardhan</TText>
          </View>
          <View style={styles.nowChip}>
            <Feather name="clock" size={12} color={colors.text} />
            <TText variant="caption" weight="600" style={{ marginLeft: 4 }}>Now</TText>
          </View>
        </TouchableOpacity>

        {/* Quick service tiles */}
        <View style={styles.quickRow}>
          <QuickTile icon="map-pin" label="Local Ride" color={colors.primary} bg={colors.primaryLight} onPress={() => open("local")} testID="ride-quick-local" />
          <QuickTile icon="compass" label="Parikrama" color={colors.parikrama} bg="#FFF8E1" onPress={() => open("combined")} testID="ride-quick-parikrama" />
          <QuickTile icon="calendar" label="Schedule" color={colors.info} bg={colors.infoBg} onPress={() => open("local")} testID="ride-quick-schedule" />
        </View>

        <TText variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          Parikrama Packages
        </TText>

        <View style={styles.parikramaRow}>
          <ParikramaTile
            title="Poochari"
            subtitle="12 km · Poochari ka Lota route"
            price={config?.poochari_fare}
            color={colors.primaryLight}
            iconColor={colors.primaryDark}
            onPress={() => open("poochari")}
            testID="ride-poochari-tile"
          />
          <ParikramaTile
            title="Radhakund"
            subtitle="7 km · Radha & Shyam Kund"
            price={config?.radhakund_fare}
            color={colors.successBg}
            iconColor={colors.success}
            onPress={() => open("radhakund")}
            testID="ride-radhakund-tile"
          />
        </View>

        <TouchableOpacity testID="ride-combined-tile" activeOpacity={0.85} onPress={() => open("combined")}>
          <Card style={{ marginTop: spacing.md, backgroundColor: "#FFF8E1", borderColor: "#F0E0B4" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={[styles.bigIcon, { backgroundColor: "#FFE082" }]}>
                <Feather name="award" size={22} color={colors.parikrama} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={styles.starRow}>
                  <Feather name="star" size={12} color={colors.parikrama} />
                  <TText variant="caption" color={colors.parikrama} style={{ marginLeft: 4 }}>MOST POPULAR</TText>
                </View>
                <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>Combined Parikrama</TText>
                <TText variant="bodySm" muted style={{ marginTop: 2 }}>Poochari + Radhakund · 21 km</TText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <TText variant="h3">₹{config?.combined_fare ?? "—"}</TText>
                <TText variant="caption" muted>per rickshaw</TText>
              </View>
            </View>
          </Card>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickTile({ icon, label, color, bg, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={[styles.quickTile, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.quickIconBox, { backgroundColor: "#FFFFFF80" }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <TText variant="bodySm" weight="700" style={{ marginTop: spacing.sm }}>{label}</TText>
    </TouchableOpacity>
  );
}

function ParikramaTile({ title, subtitle, price, color, iconColor, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={[styles.parikramaTile, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.bigIcon, { backgroundColor: "#FFFFFF80" }]}>
        <Feather name="compass" size={20} color={iconColor} />
      </View>
      <TText variant="bodyLg" weight="700" style={{ marginTop: spacing.md }}>{title}</TText>
      <TText variant="caption" muted style={{ marginTop: 2 }} numberOfLines={2}>{subtitle}</TText>
      <View style={{ marginTop: spacing.md }}>
        <TText variant="h3" color={iconColor}>₹{price ?? "—"}</TText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  whereTo: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  whereToIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  nowChip: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  quickRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  quickTile: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.lg, alignItems: "center" },
  quickIconBox: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  parikramaRow: { flexDirection: "row", gap: 12 },
  parikramaTile: { flex: 1, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  bigIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  starRow: { flexDirection: "row", alignItems: "center" },
});
