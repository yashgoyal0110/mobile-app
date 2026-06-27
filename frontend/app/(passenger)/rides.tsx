import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { TText } from "../../src/components/TText";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { api } from "../../src/api";
import { colors, radius, spacing } from "../../src/theme";
import { getSavedStays, removeSavedStay, SavedStay } from "../../src/savedStays";
import { stayTypeLabel } from "../../src/stays";

type Tab = "rides" | "stays";

export default function MyTrips() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("rides");
  const [rides, setRides] = useState<any[]>([]);
  const [stays, setStays] = useState<SavedStay[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ rides: any[] }>("/rides/mine");
      setRides(r.rides || []);
    } catch {}
    setStays(await getSavedStays());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unsaveStay = async (id: string) => {
    await removeSavedStay(id);
    setStays(await getSavedStays());
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="passenger-trips-screen">
      <View style={styles.header}>
        <TText variant="h2">My Trips</TText>
        <TText variant="bodySm" muted style={{ marginTop: 4 }}>Your rides & saved stays</TText>
      </View>

      {/* Segmented control */}
      <View style={styles.segment}>
        <Segment label={`Rides${rides.length ? ` (${rides.length})` : ""}`} active={tab === "rides"} onPress={() => setTab("rides")} testID="trips-tab-rides" />
        <Segment label={`Stays${stays.length ? ` (${stays.length})` : ""}`} active={tab === "stays"} onPress={() => setTab("stays")} testID="trips-tab-stays" />
      </View>

      {tab === "rides" ? (
        <FlatList
          contentContainerStyle={styles.list}
          data={rides}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`ride-row-${item.id}`}
              onPress={() => router.push({ pathname: "/(passenger)/booking", params: { id: item.id } })}
              activeOpacity={0.85}
              style={{ marginBottom: spacing.md }}
            >
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <TText variant="caption" muted>{new Date(item.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</TText>
                    <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>{rideLabel(item.type)}</TText>
                    {item.pickup && item.drop && (
                      <TText variant="bodySm" muted style={{ marginTop: 4 }}>{item.pickup.name} → {item.drop.name}</TText>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <TText variant="h3">₹{item.fare}</TText>
                    <View style={{ marginTop: 4 }}><StatusPill status={item.status} /></View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <Empty icon="navigation" title="No rides yet" subtitle="Book a parikrama or local ride from Home" cta="Book a ride" onPress={() => router.push("/(passenger)/ride")} />
          )}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={stays}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`saved-stay-${item.id}`}
              onPress={() => router.push({ pathname: "/(passenger)/stay", params: { id: item.id } })}
              activeOpacity={0.85}
              style={{ marginBottom: spacing.md }}
            >
              <Card style={{ flexDirection: "row", alignItems: "center", padding: spacing.sm }}>
                <View style={styles.stayThumb}>
                  {item.photo ? (
                    <Image source={{ uri: item.photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Feather name="home" size={22} color={colors.primaryDark} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <TText variant="bodyLg" weight="700" numberOfLines={1}>{item.name}</TText>
                  <TText variant="caption" muted style={{ marginTop: 2 }}>
                    {stayTypeLabel(item.type)}{item.area ? ` · ${item.area}` : ""}
                  </TText>
                  <TText variant="bodySm" weight="700" color={colors.primaryDark} style={{ marginTop: 4 }}>{savedPrice(item)}</TText>
                </View>
                <TouchableOpacity onPress={() => unsaveStay(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} testID={`unsave-${item.id}`}>
                  <Feather name="x" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <Empty icon="home" title="No saved stays yet" subtitle="Stays you open appear here for quick access" cta="Browse stays" onPress={() => router.push("/(passenger)/stays")} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Segment({ label, active, onPress, testID }: any) {
  return (
    <TouchableOpacity style={[styles.segBtn, active && styles.segBtnActive]} onPress={onPress} activeOpacity={0.85} testID={testID}>
      <TText variant="bodySm" weight="700" color={active ? colors.primaryDark : colors.textMuted}>{label}</TText>
    </TouchableOpacity>
  );
}

function Empty({ icon, title, subtitle, cta, onPress }: any) {
  return (
    <View style={{ alignItems: "center", marginTop: 80 }}>
      <View style={styles.emptyIcon}><Feather name={icon} size={32} color={colors.primaryDark} /></View>
      <TText variant="h3" style={{ marginTop: spacing.md }}>{title}</TText>
      <TText variant="bodySm" muted align="center" style={{ marginTop: 6, paddingHorizontal: spacing.xl }}>{subtitle}</TText>
      <TouchableOpacity style={styles.emptyCta} onPress={onPress} activeOpacity={0.85}>
        <TText variant="bodySm" weight="700" color="#fff">{cta}</TText>
      </TouchableOpacity>
    </View>
  );
}

function rideLabel(t: string) {
  return ({ local: "Local Ride", poochari: "Poochari Parikrama", radhakund: "Radhakund Parikrama", combined: "Combined Parikrama" } as any)[t] || t;
}

function savedPrice(s: SavedStay): string {
  if (s.donation_based) return "Donation based";
  if (s.price_min != null && s.price_max != null) return `₹${s.price_min}–${s.price_max}`;
  if (s.price_min != null) return `From ₹${s.price_min}`;
  return "On request";
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  segment: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segBtnActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary + "40" },
  list: { padding: spacing.lg, paddingBottom: 80 },
  stayThumb: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  emptyCta: { marginTop: spacing.lg, backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: radius.pill },
});
