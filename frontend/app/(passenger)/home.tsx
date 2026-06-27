import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { TText } from "../../src/components/TText";
import { StatusPill } from "../../src/components/StatusPill";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, radius, spacing, shadows } from "../../src/theme";
import { Stay, stayTypeLabel, priceLabel } from "../../src/stays";
import { Temple, openStatus } from "../../src/temples";

export default function PassengerHome() {
  const router = useRouter();
  const { user } = useAuth();
  const [config, setConfig] = useState<any>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [stays, setStays] = useState<Stay[]>([]);
  const [temples, setTemples] = useState<Temple[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [cfg, mine, st, tp] = await Promise.allSettled([
      api<any>("/config/fare", { auth: false }),
      api<{ rides: any[] }>("/rides/mine"),
      api<{ stays: Stay[] }>("/stays?limit=8", { auth: false }),
      api<{ temples: Temple[] }>("/temples?limit=8", { auth: false }),
    ]);
    if (cfg.status === "fulfilled") setConfig(cfg.value);
    if (mine.status === "fulfilled") {
      const all = mine.value.rides || [];
      setActiveRide(all.find((x) => ["requested", "accepted", "started", "scheduled"].includes(x.status)) || null);
    }
    if (st.status === "fulfilled") setStays((st.value.stays || []).slice(0, 8));
    if (tp.status === "fulfilled") setTemples((tp.value.temples || []).slice(0, 8));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const ride = (type: string) => router.push({ pathname: "/(passenger)/service", params: { type } });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="passenger-home-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={13} color={colors.primary} />
              <TText variant="caption" color={colors.primaryDark} style={{ marginLeft: 4 }}>GOVARDHAN · MATHURA</TText>
            </View>
            <TText variant="h2" style={{ marginTop: 4 }} numberOfLines={1}>
              {greeting}, {user?.name?.split(" ")[0] || "Yatri"} 🙏
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

        {/* Search */}
        <TouchableOpacity
          testID="passenger-home-search"
          style={styles.search}
          activeOpacity={0.85}
          onPress={() => router.push("/(passenger)/temples")}
        >
          <Feather name="search" size={18} color={colors.textMuted} />
          <TText variant="body" muted style={{ marginLeft: 10, flex: 1 }}>Search temples, stays, parikrama…</TText>
        </TouchableOpacity>

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
                <TText variant="bodyLg" weight="700" color="#fff">{rideLabel(activeRide.type)}</TText>
                <View style={{ marginTop: 6 }}><StatusPill status={activeRide.status} /></View>
              </View>
              <Feather name="chevron-right" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {/* Category grid */}
        <View style={styles.categoryRow}>
          <CategoryTile icon="navigation" label="Local Ride" color={colors.primary} bg={colors.primaryLight} onPress={() => ride("local")} testID="cat-local" />
          <CategoryTile icon="compass" label="Parikrama" color={colors.parikrama} bg="#FFF3DC" onPress={() => router.push("/(passenger)/ride")} testID="cat-parikrama" />
          <CategoryTile icon="sunrise" label="Temples" color="#C77800" bg="#FFF8E1" onPress={() => router.push("/(passenger)/temples")} testID="cat-temples" />
          <CategoryTile icon="home" label="Stays" color={colors.success} bg={colors.successBg} onPress={() => router.push("/(passenger)/stays")} testID="cat-stays" />
        </View>

        {/* Hero promo — combined parikrama */}
        <TouchableOpacity testID="passenger-home-promo" activeOpacity={0.9} onPress={() => ride("combined")}>
          <View style={styles.promo}>
            <View style={styles.promoBlob} />
            <View style={{ flex: 1 }}>
              <View style={styles.promoBadge}>
                <Feather name="star" size={11} color={colors.dark} />
                <TText variant="caption" color={colors.dark} style={{ marginLeft: 4 }}>MOST POPULAR</TText>
              </View>
              <TText variant="h2" color="#fff" style={{ marginTop: 10 }}>Combined Parikrama</TText>
              <TText variant="bodySm" color={colors.darkMuted} style={{ marginTop: 4 }}>Poochari + Radhakund · 21 km by e-rickshaw</TText>
              <View style={styles.promoCta}>
                <TText variant="bodySm" weight="700" color={colors.dark}>Book from ₹{config?.combined_fare ?? "—"}</TText>
                <Feather name="arrow-right" size={15} color={colors.dark} style={{ marginLeft: 6 }} />
              </View>
            </View>
            <TText style={styles.promoEmoji}>🛺</TText>
          </View>
        </TouchableOpacity>

        {/* Popular parikrama */}
        <SectionHeader title="Popular Parikrama" actionLabel="All rides" onAction={() => router.push("/(passenger)/ride")} testID="sec-parikrama" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          <ParikramaCard title="Poochari" km={12} price={config?.poochari_fare} tint={colors.primaryDark} bg={colors.primaryLight} onPress={() => ride("poochari")} testID="pk-poochari" />
          <ParikramaCard title="Radhakund" km={7} price={config?.radhakund_fare} tint={colors.success} bg={colors.successBg} onPress={() => ride("radhakund")} testID="pk-radhakund" />
          <ParikramaCard title="Combined" km={21} price={config?.combined_fare} tint={colors.parikrama} bg="#FFF3DC" onPress={() => ride("combined")} testID="pk-combined" />
        </ScrollView>

        {/* Temples */}
        {temples.length > 0 && (
          <>
            <SectionHeader title="Temples & Darshan" actionLabel="See all" onAction={() => router.push("/(passenger)/temples")} testID="sec-temples" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {temples.map((t) => (
                <DiscoveryCard
                  key={t.id}
                  testID={`home-temple-${t.id}`}
                  photo={t.photos?.[0]}
                  fallbackIcon="sunrise"
                  title={t.name}
                  subtitle={t.deity || t.area || "Govardhan"}
                  pill={openStatus(t.darshan_slots)}
                  onPress={() => router.push({ pathname: "/(passenger)/temple", params: { id: t.id } })}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* Stays */}
        {stays.length > 0 && (
          <>
            <SectionHeader title="Stays for Yatris" actionLabel="See all" onAction={() => router.push("/(passenger)/stays")} testID="sec-stays" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {stays.map((s) => (
                <DiscoveryCard
                  key={s.id}
                  testID={`home-stay-${s.id}`}
                  photo={s.photos?.[0]}
                  fallbackIcon="home"
                  title={s.name}
                  subtitle={`${stayTypeLabel(s.type)}${s.area ? ` · ${s.area}` : ""}`}
                  footer={priceLabel(s)}
                  onPress={() => router.push({ pathname: "/(passenger)/stay", params: { id: s.id } })}
                />
              ))}
            </ScrollView>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CategoryTile({ icon, label, color, bg, onPress, testID }: any) {
  return (
    <TouchableOpacity style={styles.category} onPress={onPress} activeOpacity={0.85} testID={testID}>
      <View style={[styles.categoryIcon, { backgroundColor: bg }]}>
        <Feather name={icon} size={24} color={color} />
      </View>
      <TText variant="bodySm" weight="600" align="center" style={{ marginTop: 8 }}>{label}</TText>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, actionLabel, onAction, testID }: any) {
  return (
    <View style={styles.sectionHeader}>
      <TText variant="h3">{title}</TText>
      {actionLabel && (
        <TouchableOpacity onPress={onAction} testID={testID}>
          <TText variant="bodySm" weight="700" color={colors.primary}>{actionLabel}</TText>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ParikramaCard({ title, km, price, tint, bg, onPress, testID }: any) {
  return (
    <TouchableOpacity style={[styles.pkCard, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.85} testID={testID}>
      <View style={[styles.pkIcon, { backgroundColor: "#FFFFFF90" }]}>
        <Feather name="compass" size={20} color={tint} />
      </View>
      <TText variant="bodyLg" weight="700" style={{ marginTop: spacing.md }}>{title}</TText>
      <TText variant="caption" muted style={{ marginTop: 2 }}>{km} km route</TText>
      <View style={styles.pkPrice}>
        <TText variant="h3" color={tint}>₹{price ?? "—"}</TText>
        <View style={[styles.pkGo, { backgroundColor: tint }]}>
          <Feather name="arrow-right" size={14} color="#fff" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DiscoveryCard({ photo, fallbackIcon, title, subtitle, pill, footer, onPress, testID }: any) {
  return (
    <TouchableOpacity style={styles.discCard} onPress={onPress} activeOpacity={0.85} testID={testID}>
      <View style={styles.discImage}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Feather name={fallbackIcon} size={30} color={colors.primaryDark} />
        )}
        {pill && (
          <View style={[styles.discPill, { backgroundColor: pill.bg }]}>
            <TText variant="caption" color={pill.tint} numberOfLines={1}>{pill.open ? "Open now" : pill.label}</TText>
          </View>
        )}
      </View>
      <TText variant="body" weight="700" numberOfLines={1} style={{ marginTop: 8 }}>{title}</TText>
      <TText variant="caption" muted numberOfLines={1} style={{ marginTop: 2 }}>{subtitle}</TText>
      {footer && <TText variant="bodySm" weight="700" color={colors.primaryDark} style={{ marginTop: 6 }}>{footer}</TText>}
    </TouchableOpacity>
  );
}

function rideLabel(t: string) {
  return ({ local: "Local Ride", poochari: "Poochari Parikrama", radhakund: "Radhakund Parikrama", combined: "Combined Parikrama" } as any)[t] || t;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxl },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  locationRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  search: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    ...shadows.sm,
  },
  activeBanner: {
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    padding: spacing.md, backgroundColor: "#1A2421", borderRadius: radius.lg,
    flexDirection: "row", alignItems: "center", ...shadows.md,
  },
  activeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  categoryRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  category: { flex: 1, alignItems: "center" },
  categoryIcon: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  promo: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    backgroundColor: colors.dark, borderRadius: radius.lg,
    padding: spacing.lg, overflow: "hidden", ...shadows.md,
  },
  promoBlob: { position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: colors.primary, opacity: 0.18 },
  promoBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  promoCta: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "#FFE0A8", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, marginTop: spacing.md },
  promoEmoji: { fontSize: 52, lineHeight: 60, marginLeft: 8 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  rail: { paddingHorizontal: spacing.lg, gap: 12 },
  pkCard: { width: 150, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  pkIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  pkPrice: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  pkGo: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  discCard: { width: 170 },
  discImage: {
    width: 170, height: 110, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  discPill: { position: "absolute", left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, maxWidth: 150 },
});
