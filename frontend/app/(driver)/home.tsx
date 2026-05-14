import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { TText } from "../../src/components/TText";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { useRealtime, useRealtimeEvent } from "../../src/realtime";
import { colors, radius, spacing, shadows } from "../../src/theme";
import { startRideAlert, stopRideAlert, disposeRideAlert } from "../../src/utils/rideAlert";

const COUNTDOWN_SECS = 20;

export default function DriverHome() {
  const router = useRouter();
  const { user, driver, refresh } = useAuth();
  const { send, isOpen } = useRealtime();
  const [incoming, setIncoming] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [modalRide, setModalRide] = useState<any>(null);
  const [secsLeft, setSecsLeft] = useState(COUNTDOWN_SECS);
  const dismissedIds = useRef<Set<string>>(new Set());
  const pulseAnim = useRef(new Animated.Value(0)).current;

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

  // Slow polling safety net while online
  useEffect(() => {
    if (!driver?.online) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [driver?.online, load]);

  // Open ride alert modal whenever a new request lands (and isn't already dismissed)
  const openAlert = useCallback((ride: any) => {
    if (!ride || dismissedIds.current.has(ride.id)) return;
    setModalRide(ride);
    setSecsLeft(COUNTDOWN_SECS);
    startRideAlert(COUNTDOWN_SECS * 1000);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }, []);

  useRealtimeEvent("ride_requested", (ev) => {
    if (!driver?.online) return;
    setIncoming((prev) => {
      if (prev.some((r) => r.id === ev.ride.id)) return prev;
      return [ev.ride, ...prev];
    });
    openAlert(ev.ride);
  });
  useRealtimeEvent("ride_taken", (ev) => {
    setIncoming((prev) => prev.filter((r) => r.id !== ev.ride_id));
    if (modalRide?.id === ev.ride_id) closeAlert(false);
  });

  // Countdown for modal
  useEffect(() => {
    if (!modalRide) return;
    const t = setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) {
          closeAlert(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalRide?.id]);

  // Pulse animation for online dot + alert card
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
      ])
    ).start();
  }, [pulseAnim]);

  // Cleanup audio on unmount
  useEffect(() => () => {
    disposeRideAlert();
  }, []);

  // Live driver location streaming — 3s cadence while online
  useEffect(() => {
    if (!driver?.online) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
          (pos) => {
            if (cancelled) return;
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const heading = pos.coords.heading ?? null;
            const speed = pos.coords.speed ?? null;
            if (isOpen()) {
              send({ type: "location", lat, lng, heading, speed });
            } else {
              api("/drivers/location", { method: "POST", body: { lat, lng, heading, speed } }).catch(() => {});
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

  const closeAlert = (dismiss: boolean) => {
    stopRideAlert();
    if (modalRide && dismiss) dismissedIds.current.add(modalRide.id);
    setModalRide(null);
  };

  const toggleOnline = async () => {
    if (driver?.kyc_status !== "approved") {
      Alert.alert(
        "Complete KYC",
        driver?.kyc_status === "pending"
          ? "Your KYC is under review. Please wait for admin approval."
          : driver?.kyc_status === "rejected"
          ? "Your KYC was rejected. Please re-submit documents."
          : "Please complete your KYC and submit for approval."
      );
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
    stopRideAlert();
    try {
      await api(`/rides/${rideId}/accept`, { method: "POST" });
      setModalRide(null);
      router.push({ pathname: "/(driver)/ride", params: { id: rideId } });
    } catch (e: any) {
      Alert.alert("Could not accept", e.message);
      load();
    }
  };

  const kycPending = driver?.kyc_status !== "approved";
  const balance = Math.round((driver?.earnings_total ?? 0) - (driver?.earnings_withdrawn ?? 0));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-home-screen">
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <TText variant="caption" muted>NAMASTE</TText>
            <TText variant="h2" style={{ marginTop: 2 }} numberOfLines={1}>{user?.name || "Driver"}</TText>
            <TText variant="bodySm" muted>{driver?.vehicle_no || "Add vehicle in KYC"}</TText>
          </View>
          <TouchableOpacity
            testID="driver-home-profile-btn"
            style={styles.avatar}
            onPress={() => router.push("/(driver)/profile")}
          >
            <Feather name="user" size={20} color={colors.primaryDark} />
          </TouchableOpacity>
        </View>

        {/* Hero status card — Uber-style */}
        <View style={[styles.hero, driver?.online ? styles.heroOn : styles.heroOff]}>
          <View style={styles.heroTop}>
            <View style={styles.heroIconWrap}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  driver?.online && {
                    transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.8] }) }],
                    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                  },
                ]}
              />
              <View style={[styles.heroIcon, driver?.online ? { backgroundColor: colors.success } : { backgroundColor: colors.textMuted }]}>
                <Feather name="zap" size={26} color="#fff" />
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <TText variant="h3" color={driver?.online ? "#fff" : colors.text}>
                {driver?.online ? "You're online" : "You're offline"}
              </TText>
              <TText variant="bodySm" color={driver?.online ? "rgba(255,255,255,0.85)" : colors.textMuted} style={{ marginTop: 2 }}>
                {driver?.online ? "Receiving ride requests around you" : "Go online to start earning"}
              </TText>
            </View>
          </View>

          <TouchableOpacity
            testID="driver-status-toggle"
            onPress={toggleOnline}
            disabled={toggling}
            activeOpacity={0.85}
            style={[styles.statusBtn, driver?.online ? styles.statusBtnOn : styles.statusBtnOff]}
          >
            <Feather name={driver?.online ? "power" : "play"} size={16} color={driver?.online ? colors.success : "#fff"} />
            <TText variant="bodyLg" weight="700" color={driver?.online ? colors.success : "#fff"} style={{ marginLeft: 8 }}>
              {driver?.online ? "Go Offline" : "Go Online"}
            </TText>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: colors.primaryLight }]}>
              <Feather name="dollar-sign" size={16} color={colors.primaryDark} />
            </View>
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
              <TText variant="caption" muted>BALANCE</TText>
              <TText variant="h3" color={colors.primaryDark}>₹{balance}</TText>
            </View>
          </View>
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: colors.successBg }]}>
              <Feather name="shield" size={16} color={colors.success} />
            </View>
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
              <TText variant="caption" muted>KYC</TText>
              <TText variant="bodyLg" weight="700" numberOfLines={1}>
                {(driver?.kyc_status || "—").replace("_", " ").toUpperCase()}
              </TText>
            </View>
          </View>
        </View>

        {kycPending && (
          <TouchableOpacity onPress={() => router.push("/(driver)/kyc")} testID="driver-kyc-banner" activeOpacity={0.85}>
            <Card
              style={[
                styles.kycBanner,
                {
                  backgroundColor:
                    driver?.kyc_status === "pending" ? colors.warningBg :
                    driver?.kyc_status === "rejected" ? colors.errorBg : colors.infoBg,
                  borderColor: (driver?.kyc_status === "rejected" ? colors.error : driver?.kyc_status === "pending" ? colors.warning : colors.info) + "40",
                },
              ]}
            >
              <Feather
                name={driver?.kyc_status === "rejected" ? "x-circle" : driver?.kyc_status === "pending" ? "clock" : "alert-circle"}
                size={20}
                color={driver?.kyc_status === "rejected" ? colors.error : driver?.kyc_status === "pending" ? colors.warning : colors.info}
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <TText
                  variant="bodyLg"
                  weight="700"
                  color={driver?.kyc_status === "rejected" ? colors.error : driver?.kyc_status === "pending" ? colors.warning : colors.info}
                >
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
            activeOpacity={0.85}
          >
            <Card style={{ marginTop: spacing.md, backgroundColor: colors.primaryLight, borderColor: colors.primary + "40" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={[styles.bigIcon, { backgroundColor: colors.primary }]}>
                  <Feather name="navigation" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <TText variant="caption" color={colors.primaryDark}>ACTIVE RIDE</TText>
                  <TText variant="bodyLg" weight="700">{labelFor(active.type)}</TText>
                  <TText variant="bodySm" muted>{active.passenger_name} · ₹{active.fare}</TText>
                </View>
                <Feather name="chevron-right" size={20} color={colors.primaryDark} />
              </View>
            </Card>
          </TouchableOpacity>
        )}

        <TText variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          Incoming requests {driver?.online ? `(${incoming.length})` : ""}
        </TText>

        {!driver?.online ? (
          <Card flat style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <View style={styles.emptyIcon}>
              <Feather name="moon" size={28} color={colors.textMuted} />
            </View>
            <TText variant="bodyLg" weight="700" style={{ marginTop: spacing.md }}>You're offline</TText>
            <TText variant="bodySm" muted align="center" style={{ marginTop: 4 }}>
              Tap "Go Online" above to start receiving ride requests
            </TText>
          </Card>
        ) : incoming.length === 0 ? (
          <Card flat style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
              <Feather name="search" size={28} color={colors.primaryDark} />
            </View>
            <TText variant="bodyLg" weight="700" style={{ marginTop: spacing.md }}>Looking for riders nearby</TText>
            <TText variant="bodySm" muted align="center" style={{ marginTop: 4 }}>
              New requests appear instantly with a sound alert
            </TText>
          </Card>
        ) : (
          incoming.map((r) => (
            <Card key={r.id} style={{ marginBottom: spacing.md }} testID={`incoming-ride-${r.id}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <View style={styles.tagRow}>
                    <View style={[styles.tag, { backgroundColor: colors.warningBg }]}>
                      <TText variant="caption" color={colors.warning}>NEW</TText>
                    </View>
                    {(r.tip || 0) > 0 && (
                      <View style={[styles.tag, { backgroundColor: colors.successBg, marginLeft: 6 }]}>
                        <TText variant="caption" color={colors.success}>+₹{r.tip} TIP</TText>
                      </View>
                    )}
                  </View>
                  <TText variant="bodyLg" weight="700" style={{ marginTop: 6 }}>{labelFor(r.type)}</TText>
                  {r.pickup && r.drop && (
                    <TText variant="bodySm" muted style={{ marginTop: 4 }} numberOfLines={2}>
                      {r.pickup.name} → {r.drop.name}
                    </TText>
                  )}
                  <TText variant="bodySm" muted style={{ marginTop: 2 }}>
                    {r.payment_method?.toUpperCase()}{r.distance_km ? ` · ${r.distance_km} km` : ""}
                  </TText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <TText variant="h2" color={colors.primaryDark}>₹{r.fare}</TText>
                  <TText variant="caption" color={colors.success}>You earn ₹{r.driver_earning}</TText>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 12, marginTop: spacing.md }}>
                <TButton label="Pass" variant="outline" onPress={() => setIncoming((p) => p.filter((x) => x.id !== r.id))} testID={`pass-ride-${r.id}`} fullWidth={false} style={{ flex: 1 }} />
                <TButton
                  label="Accept"
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

      {/* Full-screen incoming ride modal with countdown ring */}
      <IncomingRideModal
        ride={modalRide}
        secs={secsLeft}
        max={COUNTDOWN_SECS}
        onAccept={() => modalRide && accept(modalRide.id)}
        onDismiss={() => closeAlert(true)}
      />
    </SafeAreaView>
  );
}

function IncomingRideModal({ ride, secs, max, onAccept, onDismiss }: any) {
  if (!ride) return null;
  const pct = Math.max(0, Math.min(1, secs / max));
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <View style={{ alignItems: "center", marginTop: spacing.md }}>
            <View style={modalStyles.ringWrap}>
              <View style={[modalStyles.ring, { borderColor: colors.primaryLight }]} />
              <View
                style={[
                  modalStyles.ringFill,
                  {
                    transform: [{ rotate: `${(1 - pct) * 360}deg` }],
                  },
                ]}
              />
              <View style={modalStyles.ringInner}>
                <TText variant="h1" color={colors.primaryDark}>{secs}</TText>
                <TText variant="caption" muted>seconds</TText>
              </View>
            </View>
            <View style={modalStyles.tagRow}>
              <View style={[modalStyles.tag, { backgroundColor: colors.warningBg }]}>
                <TText variant="caption" color={colors.warning}>NEW RIDE</TText>
              </View>
              {(ride.tip || 0) > 0 && (
                <View style={[modalStyles.tag, { backgroundColor: colors.successBg, marginLeft: 6 }]}>
                  <TText variant="caption" color={colors.success}>+₹{ride.tip} TIP</TText>
                </View>
              )}
            </View>
            <TText variant="h2" style={{ marginTop: spacing.md }}>{labelFor(ride.type)}</TText>
            <TText variant="bodySm" muted style={{ marginTop: 2 }}>
              {ride.payment_method?.toUpperCase()}{ride.distance_km ? ` · ${ride.distance_km} km` : ""}
            </TText>
          </View>

          {ride.pickup && ride.drop && (
            <View style={modalStyles.route}>
              <View style={modalStyles.routeRow}>
                <View style={[modalStyles.routeDot, { backgroundColor: colors.success }]} />
                <TText variant="bodySm" weight="600" style={{ marginLeft: 10, flex: 1 }} numberOfLines={1}>{ride.pickup.name}</TText>
              </View>
              <View style={modalStyles.routeLine} />
              <View style={modalStyles.routeRow}>
                <View style={[modalStyles.routeDot, { backgroundColor: colors.error }]} />
                <TText variant="bodySm" weight="600" style={{ marginLeft: 10, flex: 1 }} numberOfLines={1}>{ride.drop.name}</TText>
              </View>
            </View>
          )}

          <View style={modalStyles.fareCard}>
            <View>
              <TText variant="caption" muted>FARE</TText>
              <TText variant="h1" color={colors.primaryDark}>₹{ride.fare}</TText>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <TText variant="caption" muted>YOU EARN</TText>
              <TText variant="h3" color={colors.success}>₹{ride.driver_earning}</TText>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: spacing.md }}>
            <TButton label="Pass" variant="outline" onPress={onDismiss} fullWidth={false} style={{ flex: 1 }} testID="ride-alert-pass" />
            <TButton
              label="Accept Ride"
              onPress={onAccept}
              fullWidth={false}
              style={{ flex: 2 }}
              icon={<Feather name="check-circle" size={18} color={colors.textInverse} />}
              testID="ride-alert-accept"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function labelFor(t: string) {
  return ({ local: "Local Ride", poochari: "Poochari Parikrama", radhakund: "Radhakund Parikrama", combined: "Combined Parikrama" } as any)[t] || t;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  heroOn: { backgroundColor: "#2A6F3D" },
  heroOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  heroTop: { flexDirection: "row", alignItems: "center" },
  heroIconWrap: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  heroIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  pulseRing: {
    position: "absolute",
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  statusBtn: {
    marginTop: spacing.md,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, borderRadius: radius.pill,
  },
  statusBtnOn: { backgroundColor: "#fff" },
  statusBtnOff: { backgroundColor: colors.primary },
  statsRow: { flexDirection: "row", gap: 12, marginTop: spacing.lg },
  stat: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  kycBanner: { marginTop: spacing.md, flexDirection: "row", alignItems: "center" },
  bigIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  tagRow: { flexDirection: "row", alignItems: "center" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.sm },
  ringWrap: { width: 110, height: 110, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 8,
  },
  ringFill: {
    position: "absolute",
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 8,
    borderColor: "transparent",
    borderTopColor: colors.primary,
    borderRightColor: colors.primary,
  },
  ringInner: { alignItems: "center", justifyContent: "center" },
  tagRow: { flexDirection: "row", marginTop: spacing.md },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  route: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
  },
  routeRow: { flexDirection: "row", alignItems: "center" },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 2, height: 14, backgroundColor: colors.border, marginLeft: 4, marginVertical: 4 },
  fareCard: {
    marginTop: spacing.md,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },
});
