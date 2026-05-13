import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { TText } from "../../src/components/TText";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, radius, spacing, shadows } from "../../src/theme";

export default function PassengerHome() {
  const router = useRouter();
  const { user } = useAuth();
  const [config, setConfig] = useState<any>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const cfg = await api<any>("/config/fare", { auth: false });
      setConfig(cfg);
      const r = await api<{ rides: any[] }>("/rides/mine");
      const active = (r.rides || []).find((x) =>
        ["requested", "accepted", "started", "scheduled"].includes(x.status)
      );
      setActiveRide(active || null);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = (type: string) => router.push({ pathname: "/(passenger)/service", params: { type } });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="passenger-home-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <TText variant="caption" muted>JAI SHRI RADHE</TText>
            <TText variant="h2" style={{ marginTop: 2 }}>
              Namaste, {user?.name || "Yatri"} 🙏
            </TText>
            <TText variant="bodySm" muted style={{ marginTop: 4 }}>
              Where would you like to go today?
            </TText>
          </View>
          <TouchableOpacity
            testID="passenger-home-profile-btn"
            style={styles.avatar}
            onPress={() => router.push("/(passenger)/profile")}
          >
            <Feather name="user" size={20} color={colors.primaryDark} />
          </TouchableOpacity>
        </View>

        {activeRide && (
          <TouchableOpacity
            testID="passenger-home-active-ride"
            style={styles.activeBanner}
            onPress={() => router.push({ pathname: "/(passenger)/booking", params: { id: activeRide.id } })}
          >
            <View style={{ flex: 1 }}>
              <TText variant="caption" color={colors.primaryDark}>ACTIVE RIDE</TText>
              <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>
                {labelFor(activeRide.type)}
              </TText>
              <View style={{ marginTop: 8 }}>
                <StatusPill status={activeRide.status} />
              </View>
            </View>
            <Feather name="chevron-right" size={24} color={colors.primaryDark} />
          </TouchableOpacity>
        )}

        <TText variant="h3" style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
          Local Ride
        </TText>
        <TouchableOpacity
          testID="passenger-home-local-tile"
          style={styles.localTile}
          activeOpacity={0.85}
          onPress={() => open("local")}
        >
          <ImageBackground
            source={{
              uri: "https://images.unsplash.com/photo-1662101910918-0d2fb2d00efd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwxfHxpbmRpYW4lMjBlLXJpY2tzaGF3fGVufDB8fHx8MTc3ODY1NDU1Mnww&ixlib=rb-4.1.0&q=85",
            }}
            style={styles.localBg}
            imageStyle={{ borderRadius: radius.lg }}
          >
            <View style={styles.localOverlay}>
              <View>
                <TText variant="caption" color="#FFE0A8">WITHIN GOVARDHAN</TText>
                <TText variant="h2" color={colors.textInverse} style={{ marginTop: 4 }}>
                  Book a local e-rickshaw
                </TText>
                <TText variant="bodySm" color="#FFE0A8" style={{ marginTop: 4 }}>
                  Choose your pickup & drop in Jatipura, Radhakund, Anyor…
                </TText>
              </View>
              <View style={styles.localCta}>
                <TText variant="bodySm" weight="700" color={colors.primaryDark}>Book now</TText>
                <Feather name="arrow-right" size={16} color={colors.primaryDark} />
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>

        <TText variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          Parikrama Packages
        </TText>

        <View style={styles.parikramaRow}>
          <ParikramaTile
            title="Poochari Parikrama"
            km={12}
            price={config?.poochari_fare}
            color={colors.primaryLight}
            iconColor={colors.primaryDark}
            onPress={() => open("poochari")}
            testID="passenger-home-poochari-tile"
          />
          <ParikramaTile
            title="Radhakund Parikrama"
            km={7}
            price={config?.radhakund_fare}
            color="#E8F5E9"
            iconColor={colors.success}
            onPress={() => open("radhakund")}
            testID="passenger-home-radhakund-tile"
          />
        </View>

        <TouchableOpacity
          testID="passenger-home-combined-tile"
          activeOpacity={0.85}
          onPress={() => open("combined")}
        >
          <Card style={{ marginTop: spacing.md, backgroundColor: "#FFF8E1", borderColor: "#F0E0B4" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={[styles.bigIcon, { backgroundColor: "#FFE082" }]}>
                <Feather name="award" size={22} color={colors.parikrama} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={styles.starRow}>
                  <Feather name="star" size={12} color={colors.parikrama} />
                  <TText variant="caption" color={colors.parikrama} style={{ marginLeft: 4 }}>
                    MOST POPULAR
                  </TText>
                </View>
                <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>
                  Combined Parikrama
                </TText>
                <TText variant="bodySm" muted style={{ marginTop: 2 }}>
                  Poochari + Radhakund · 19 km
                </TText>
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

function ParikramaTile({ title, km, price, color, iconColor, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={[styles.parikramaTile, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.bigIcon, { backgroundColor: "#FFFFFF80" }]}>
        <Feather name="compass" size={20} color={iconColor} />
      </View>
      <TText variant="bodyLg" weight="700" style={{ marginTop: spacing.md }}>{title}</TText>
      <TText variant="bodySm" muted style={{ marginTop: 2 }}>{km} km route</TText>
      <View style={styles.parikramaPrice}>
        <TText variant="h3" color={iconColor}>₹{price ?? "—"}</TText>
      </View>
    </TouchableOpacity>
  );
}

function labelFor(t: string) {
  return ({ local: "Local Ride", poochari: "Poochari Parikrama", radhakund: "Radhakund Parikrama", combined: "Combined Parikrama" } as any)[t] || t;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  activeBanner: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary + "40",
  },
  localTile: { borderRadius: radius.lg, overflow: "hidden", ...shadows.md },
  localBg: { height: 180 },
  localOverlay: {
    flex: 1,
    backgroundColor: "rgba(26,36,33,0.55)",
    padding: spacing.lg,
    borderRadius: radius.lg,
    justifyContent: "space-between",
  },
  localCta: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  parikramaRow: { flexDirection: "row", gap: 12 },
  parikramaTile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bigIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  parikramaPrice: { marginTop: spacing.md },
  starRow: { flexDirection: "row", alignItems: "center" },
});
