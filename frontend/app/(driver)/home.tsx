import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { TText } from "../../src/components/TText";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { useRealtime, useRealtimeEvent } from "../../src/realtime";
import { colors, radius, spacing, shadows } from "../../src/theme";

export default function DriverHome() {
  const router = useRouter();
  const { user, driver, refresh } = useAuth();
  const { send, isOpen } = useRealtime();
  const [incoming, setIncoming] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    await refresh();
    try {
      const r = await api<{ rides: any[] }>("/rides/mine");
      const act = (r.rides || []).find((x) => ["accepted", "started"].includes(x.status));
      setActive(act || null);
    } catch {}
    try {
      const inc = await api<{ rides: any[] }>("/drivers/incoming-rides");
      setIncoming(inc.rides || []);
    } catch {}
  }, [refresh]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Polling fallback (in case WS hiccups)
  useEffect(() => {
    if (!driver?.online) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [driver?.online, load]);

  // Realtime: incoming ride pushed in
  useRealtimeEvent("ride_requested", (ev) => {
    if (!driver?.online) return;
    setIncoming((prev) => {
      if (prev.some((r) => r.id === ev.ride.id)) return prev;
      return [ev.ride, ...prev];
    });
  });
  useRealtimeEvent("ride_taken", (ev) => {
    setIncoming((prev) => prev.filter((r) => r.id !== ev.ride_id));
  });

  // Live driver location streaming while online
  useEffect(() => {
    if (!driver?.online) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 20000 },
          (pos) => {
            if (cancelled) return;
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (isOpen()) {
              send({ type: "location", lat, lng });
            } else {
              api("/drivers/location", { method: "POST", body: { lat, lng } }).catch(() => {});
            }
          }
        );
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (sub) sub.remove();
    };
  }, [driver?.online, isOpen, send]);

  const toggleOnline = async () => {
    if (driver?.kyc_status !== "approved") {
      Alert.alert("Complete KYC", driver?.kyc_status === "pending"
        ? "Your KYC is under review. Please wait for admin approval."
        : driver?.kyc_status === "rejected"
        ? "Your KYC was rejected. Please re-submit documents."
        : "Please complete your KYC and submit for approval.");
      return;
    }
    setToggling(true);
    try {
      await api("/drivers/online", { method: "POST", body: { online: !driver.online } });
      await refresh();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setToggling(false);
    }
  };

  const accept = async (rideId: string) => {
    try {
      await api(`/rides/${rideId}/accept`, { method: "POST" });
      router.push({ pathname: "/(driver)/ride", params: { id: rideId } });
    } catch (e: any) {
      Alert.alert("Could not accept", e.message);
      load();
    }
  };

  const kycPending = driver?.kyc_status !== "approved";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-home-screen">
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <TText variant="caption" muted>NAMASTE,</TText>
            <TText variant="h2" style={{ marginTop: 2 }}>{user?.name || "Driver"}</TText>
            <TText variant="bodySm" muted>{driver?.vehicle_no || "Vehicle pending"}</TText>
          </View>
          <TouchableOpacity
            testID="driver-status-toggle"
            style={[styles.statusToggle, driver?.online ? { backgroundColor: colors.online } : { backgroundColor: colors.offline + "33" }]}
            onPress={toggleOnline}
            disabled={toggling}
            activeOpacity={0.8}
          >
            <View style={[styles.dot, { backgroundColor: driver?.online ? "#fff" : colors.offline }]} />
            <TText variant="bodySm" weight="700" color={driver?.online ? "#fff" : colors.offline} style={{ marginLeft: 8 }}>
              {driver?.online ? "ONLINE" : "OFFLINE"}
            </TText>
          </TouchableOpacity>
        </View>

        {kycPending && (
          <TouchableOpacity onPress={() => router.push("/(driver)/kyc")} testID="driver-kyc-banner">
            <Card style={[styles.kycBanner, {
              backgroundColor: driver?.kyc_status === "pending" ? colors.warningBg :
                              driver?.kyc_status === "rejected" ? colors.errorBg : colors.infoBg,
            }]}>
              <Feather name={driver?.kyc_status === "rejected" ? "x-circle" : driver?.kyc_status === "pending" ? "clock" : "alert-circle"} size={20} color={
                driver?.kyc_status === "rejected" ? colors.error :
                driver?.kyc_status === "pending" ? colors.warning : colors.info
              } />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <TText variant="bodyLg" weight="700" color={
                  driver?.kyc_status === "rejected" ? colors.error :
                  driver?.kyc_status === "pending" ? colors.warning : colors.info
                }>
                  {driver?.kyc_status === "pending" ? "KYC under review" :
                   driver?.kyc_status === "rejected" ? "KYC rejected — re-submit" :
                   "Complete your KYC to start earning"}
                </TText>
                <TText variant="bodySm" muted style={{ marginTop: 2 }}>
                  {driver?.kyc_status === "pending" ? "Admin will approve soon" : "Upload aadhar, RC & UPI details"}
                </TText>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </Card>
          </TouchableOpacity>
        )}

        {active && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/(driver)/ride", params: { id: active.id } })}
            testID="driver-active-ride"
          >
            <Card style={{ marginTop: spacing.md, backgroundColor: colors.primaryLight, borderColor: colors.primary + "40" }}>
              <TText variant="caption" color={colors.primaryDark}>ACTIVE RIDE</TText>
              <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>{labelFor(active.type)}</TText>
              <TText variant="bodySm" muted style={{ marginTop: 2 }}>
                Passenger {active.passenger_name} · ₹{active.fare}
              </TText>
              <TButton label="Open ride" small style={{ marginTop: spacing.md }} onPress={() => router.push({ pathname: "/(driver)/ride", params: { id: active.id } })} testID="driver-open-active-ride" />
            </Card>
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <TText variant="caption" muted>EARNINGS</TText>
            <TText variant="h2" color={colors.primaryDark} style={{ marginTop: 4 }}>
              ₹{Math.round((driver?.earnings_total ?? 0) - (driver?.earnings_withdrawn ?? 0))}
            </TText>
            <TText variant="bodySm" muted>Available</TText>
          </View>
          <View style={styles.stat}>
            <TText variant="caption" muted>STATUS</TText>
            <TText variant="h3" style={{ marginTop: 4 }}>{driver?.kyc_status?.replace("_", " ").toUpperCase() || "—"}</TText>
            <TText variant="bodySm" muted>KYC</TText>
          </View>
        </View>

        <TText variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          Incoming requests {driver?.online ? `(${incoming.length})` : "(go online to see)"}
        </TText>

        {!driver?.online ? (
          <Card flat style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <View style={styles.emptyIcon}>
              <Feather name="zap" size={28} color={colors.primaryDark} />
            </View>
            <TText variant="bodyLg" weight="700" style={{ marginTop: spacing.md }}>You're offline</TText>
            <TText variant="bodySm" muted align="center" style={{ marginTop: 4 }}>
              Go online to start receiving ride requests
            </TText>
          </Card>
        ) : incoming.length === 0 ? (
          <Card flat style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <View style={styles.emptyIcon}>
              <Feather name="search" size={28} color={colors.primaryDark} />
            </View>
            <TText variant="bodyLg" weight="700" style={{ marginTop: spacing.md }}>Searching for riders</TText>
            <TText variant="bodySm" muted align="center" style={{ marginTop: 4 }}>
              New requests will appear here instantly
            </TText>
          </Card>
        ) : (
          incoming.map((r) => (
            <Card key={r.id} style={{ marginBottom: spacing.md }} testID={`incoming-ride-${r.id}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <TText variant="caption" color={colors.warning}>NEW REQUEST</TText>
                  <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>{labelFor(r.type)}</TText>
                  {r.pickup && r.drop && (
                    <TText variant="bodySm" muted style={{ marginTop: 4 }}>{r.pickup.name} → {r.drop.name}</TText>
                  )}
                  <TText variant="bodySm" muted style={{ marginTop: 2 }}>
                    {r.payment_method?.toUpperCase()} · {r.distance_km ? `${r.distance_km} km` : ""}
                  </TText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <TText variant="h2" color={colors.primaryDark}>₹{r.fare}</TText>
                  <TText variant="caption" color={colors.success}>You earn ₹{r.driver_earning}</TText>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 12, marginTop: spacing.md }}>
                <TButton label="Pass" variant="outline" onPress={load} testID={`pass-ride-${r.id}`} fullWidth={false} style={{ flex: 1 }} />
                <TButton
                  label="Accept ride"
                  onPress={() => accept(r.id)}
                  testID={`accept-ride-${r.id}`}
                  fullWidth={false}
                  style={{ flex: 1 }}
                  icon={<Feather name="check" size={16} color={colors.textInverse} />}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function labelFor(t: string) {
  return ({ local: "Local Ride", poochari: "Poochari Parikrama", radhakund: "Radhakund Parikrama", combined: "Combined Parikrama" } as any)[t] || t;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusToggle: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, ...shadows.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  kycBanner: { marginTop: spacing.md, flexDirection: "row", alignItems: "center" },
  statsRow: { flexDirection: "row", gap: 12, marginTop: spacing.lg },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
});
