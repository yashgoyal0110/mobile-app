import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
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
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const cfg = await api<any>("/config/fare", { auth: false });
      setConfig(cfg);
      const r = await api<{ rides: any[] }>("/rides/mine");
      const all = r.rides || [];
      const active = all.find((x) => ["requested", "accepted", "started", "scheduled"].includes(x.status));
      setActiveRide(active || null);
      setRecentRides(all.filter((x) => x.status === "completed").slice(0, 3));
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = (type: string) => router.push({ pathname: "/(passenger)/service", params: { type } });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="passenger-home-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <TText variant="caption" muted>JAI SHRI RADHE 🙏</TText>
            <TText variant="h2" style={{ marginTop: 2 }} numberOfLines={1}>
              {greeting}, {user?.name?.split(" ")[0] || "Yatri"}
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
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: "/(passenger)/booking", params: { id: activeRide.id } })}
          >
            <View style={styles.activeBanner}>
              <View style={styles.activeIcon}>
                <Feather name="navigation" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <TText variant="caption" color="#fff" style={{ opacity: 0.85 }}>ACTIVE RIDE</TText>
                <TText variant="bodyLg" weight="700" color="#fff">{labelFor(activeRide.type)}</TText>
                <View style={{ marginTop: 6 }}>
                  <StatusPill status={activeRide.status} />
                </View>
              </View>
              <Feather name="chevron-right" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {/* Big "Where to?" search prompt — Uber style */}
        <TouchableOpacity
          testID="passenger-home-where-to"
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
          <QuickTile
            icon="map-pin"
            label="Local Ride"
            color={colors.primary}
            bg={colors.primaryLight}
            onPress={() => open("local")}
            testID="passenger-home-quick-local"
          />
          <QuickTile
            icon="compass"
            label="Parikrama"
            color={colors.parikrama}
            bg="#FFF8E1"
            onPress={() => open("combined")}
            testID="passenger-home-quick-parikrama"
          />
          <QuickTile
            icon="calendar"
            label="Schedule"
            color={colors.info}
            bg={colors.infoBg}
            onPress={() => open("local")}
            testID="passenger-home-quick-schedule"
          />
        </View>

        <TText variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          Parikrama Packages
        </TText>

        <View style={styles.parikramaRow}>
          <ParikramaTile
            title="Poochari"
            subtitle="12 km · Poochari ka Lota route"
            km={12}
            price={config?.poochari_fare}
            color={colors.primaryLight}
            iconColor={colors.primaryDark}
            onPress={() => open("poochari")}
            testID="passenger-home-poochari-tile"
          />
          <ParikramaTile
            title="Radhakund"
            subtitle="7 km · Radha & Shyam Kund"
            km={7}
            price={config?.radhakund_fare}
            color={colors.successBg}
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
                <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>Combined Parikrama</TText>
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

        {/* Stay discovery promo */}
        <TouchableOpacity
          testID="passenger-home-stays"
          activeOpacity={0.85}
          onPress={() => router.push("/(passenger)/stays")}
        >
          <Card style={{ marginTop: spacing.xl, backgroundColor: colors.dark, borderColor: colors.darkBorder }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={[styles.bigIcon, { backgroundColor: colors.primary }]}>
                <Feather name="home" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <TText variant="caption" color={colors.primary}>STAY NEAR THE TEMPLES</TText>
                <TText variant="bodyLg" weight="700" color="#fff" style={{ marginTop: 4 }}>
                  Dharamshala & Guest Houses
                </TText>
                <TText variant="bodySm" color={colors.darkMuted} style={{ marginTop: 2 }}>
                  Verified pilgrim stays · Call or WhatsApp
                </TText>
              </View>
              <Feather name="chevron-right" size={22} color="#fff" />
            </View>
          </Card>
        </TouchableOpacity>

        {/* Temple darshan promo */}
        <TouchableOpacity
          testID="passenger-home-temples"
          activeOpacity={0.85}
          onPress={() => router.push("/(passenger)/temples")}
        >
          <Card style={{ marginTop: spacing.md, backgroundColor: "#FFF8E1", borderColor: "#F0E0B4" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={[styles.bigIcon, { backgroundColor: "#FFE082" }]}>
                <Feather name="clock" size={22} color={colors.parikrama} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <TText variant="caption" color={colors.parikrama}>DARSHAN & AARTI TIMINGS</TText>
                <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>Temples of Govardhan</TText>
                <TText variant="bodySm" muted style={{ marginTop: 2 }}>
                  Live open/closed · crowd · directions
                </TText>
              </View>
              <Feather name="chevron-right" size={22} color={colors.parikrama} />
            </View>
          </Card>
        </TouchableOpacity>

        {recentRides.length > 0 && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.md }}>
              <TText variant="h3">Recent Rides</TText>
              <TouchableOpacity onPress={() => router.push("/(passenger)/rides")} testID="passenger-home-see-all">
                <TText variant="bodySm" weight="700" color={colors.primary}>See all</TText>
              </TouchableOpacity>
            </View>
            {recentRides.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.recentRow}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: "/(passenger)/booking", params: { id: r.id } })}
              >
                <View style={[styles.recentIcon, { backgroundColor: colors.successBg }]}>
                  <Feather name="check-circle" size={16} color={colors.success} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <TText variant="body" weight="600" numberOfLines={1}>{labelFor(r.type)}</TText>
                  <TText variant="caption" muted>
                    {new Date(r.completed_at || r.created_at).toLocaleDateString([], { month: "short", day: "numeric" })} · ₹{r.fare}
                  </TText>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </>
        )}

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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.lg },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  activeBanner: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: "#1A2421",
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    ...shadows.md,
  },
  activeIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  whereTo: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  whereToIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: "center", justifyContent: "center",
  },
  nowChip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.bg,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.pill,
  },
  quickRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  quickTile: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  quickIconBox: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  parikramaRow: { flexDirection: "row", gap: 12 },
  parikramaTile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bigIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  parikramaPrice: { marginTop: spacing.md },
  starRow: { flexDirection: "row", alignItems: "center" },
  recentRow: {
    flexDirection: "row", alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 8,
  },
  recentIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
