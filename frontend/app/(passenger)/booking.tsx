import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Linking,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { TText } from "../../src/components/TText";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import MapPicker from "../../src/components/MapPicker";
import RateRideModal from "../../src/components/RateRideModal";
import { api } from "../../src/api";
import { useRealtime, useRealtimeEvent } from "../../src/realtime";
import { colors, radius, spacing, shadows } from "../../src/theme";

const STEPS = ["requested", "accepted", "started", "completed"];
const CANCEL_REASONS = [
  "Changed my plan",
  "Driver is taking too long",
  "Found alternate transport",
  "Wrong location selected",
  "Other",
];

// E-rickshaw average speed for ETA estimation (km/h)
const AVG_SPEED_KMPH = 22;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default function BookingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { send, isOpen } = useRealtime();
  const [ride, setRide] = useState<any>(null);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number; heading?: number | null } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rated, setRated] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [secsSearching, setSecsSearching] = useState(0);
  const requestedAtRef = useRef<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await api<any>(`/rides/${id}`);
      setRide(r);
      if (r.driver_location) setDriverLoc(r.driver_location);
      if (r.status === "requested" && !requestedAtRef.current) {
        requestedAtRef.current = new Date(r.created_at).getTime();
      }
      if (r.status === "completed" && r.driver_id && !rated) {
        setRateOpen(true);
      }
    } catch (e: any) {
      Alert.alert("Could not load", e.message);
    }
  }, [id, rated]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // safety net polling
    return () => clearInterval(t);
  }, [load]);

  // Realtime
  useRealtimeEvent("ride_accepted", (ev) => {
    if (ev.ride?.id === id) setRide(ev.ride);
  });
  useRealtimeEvent("ride_started", (ev) => { if (ev.ride_id === id) load(); });
  useRealtimeEvent("ride_completed", (ev) => { if (ev.ride_id === id) load(); });
  useRealtimeEvent("ride_cancelled", (ev) => { if (ev.ride_id === id) load(); });
  useRealtimeEvent("driver_location", (ev) => {
    if (ev.ride_id === id) {
      setDriverLoc({ lat: ev.lat, lng: ev.lng, heading: ev.heading });
    }
  });

  // Pulsing dot animation while searching
  useEffect(() => {
    if (ride?.status !== "requested") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ride?.status, pulseAnim]);

  // Searching seconds counter
  useEffect(() => {
    if (ride?.status !== "requested") return;
    const startedAt = requestedAtRef.current || Date.now();
    const t = setInterval(() => setSecsSearching(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [ride?.status]);

  // Stream passenger location to driver while ride is accepted/started
  useEffect(() => {
    if (!ride || !["accepted", "started"].includes(ride.status)) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 8, timeInterval: 5000 },
          (pos) => {
            if (cancelled) return;
            if (isOpen()) {
              send({ type: "location", lat: pos.coords.latitude, lng: pos.coords.longitude });
            }
          }
        );
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (sub) sub.remove();
    };
  }, [ride?.status, ride?.id, isOpen, send]);

  const addTip = async (amount: 10 | 20 | 50) => {
    if (!id || tipping) return;
    setTipping(true);
    try {
      const r = await api<any>(`/rides/${id}/tip`, { method: "POST", body: { amount } });
      setRide(r);
    } catch (e: any) {
      Alert.alert("Could not add tip", e.message);
    } finally {
      setTipping(false);
    }
  };

  const doCancel = async () => {
    if (!reason) {
      Alert.alert("Choose a reason");
      return;
    }
    setCancelling(true);
    try {
      await api(`/rides/${id}/cancel`, { method: "POST", body: { reason } });
      setCancelOpen(false);
      load();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setCancelling(false);
    }
  };

  const callDriver = () => {
    if (ride?.driver_phone) {
      Linking.openURL(`tel:${ride.driver_phone}`).catch(() => {});
    }
  };

  if (!ride) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const stepIdx = ride.status === "scheduled" ? -1 : STEPS.indexOf(ride.status);
  const isCancelled = ride.status === "cancelled";
  const isCompleted = ride.status === "completed";
  const isSearching = ride.status === "requested";

  // Compute ETA
  let etaMin: number | null = null;
  let etaKm: number | null = null;
  if (driverLoc && ride.pickup && (ride.status === "accepted")) {
    etaKm = haversineKm(driverLoc, ride.pickup);
    etaMin = Math.max(1, Math.ceil((etaKm / AVG_SPEED_KMPH) * 60));
  } else if (driverLoc && ride.drop && ride.status === "started") {
    etaKm = haversineKm(driverLoc, ride.drop);
    etaMin = Math.max(1, Math.ceil((etaKm / AVG_SPEED_KMPH) * 60));
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="booking-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(passenger)/home")} testID="booking-back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <TText variant="caption" muted>RIDE {ride.id.slice(0, 8).toUpperCase()}</TText>
          <TText variant="h3">{labelFor(ride.type)}</TText>
        </View>
        <StatusPill status={ride.status} testID="booking-status-pill" />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}>
        {/* SEARCHING state — Uber-style searching card with pulse */}
        {isSearching && (
          <View style={styles.searchCard}>
            <View style={styles.searchIconWrap}>
              <Animated.View
                style={[
                  styles.searchPulse,
                  {
                    transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.8] }) }],
                    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                  },
                ]}
              />
              <View style={styles.searchIcon}>
                <Feather name="search" size={28} color="#fff" />
              </View>
            </View>
            <TText variant="h2" color="#fff" style={{ marginTop: spacing.md }}>Finding a driver…</TText>
            <TText variant="bodySm" color="rgba(255,255,255,0.85)" align="center" style={{ marginTop: 4 }}>
              Notifying nearby e-rickshaws • {secsSearching}s
            </TText>

            {/* Tip nudge after 30s */}
            {secsSearching >= 30 && (
              <View style={styles.tipNudge}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Feather name="zap" size={16} color={colors.warning} />
                  <TText variant="bodySm" weight="700" color="#fff" style={{ marginLeft: 6 }}>
                    Boost your ride to get a driver faster
                  </TText>
                </View>
                <TText variant="caption" color="rgba(255,255,255,0.8)" style={{ marginTop: 4 }}>
                  Tip drivers — they see your higher fare instantly
                </TText>
                <View style={styles.tipRow}>
                  <TipChip label="+₹10" onPress={() => addTip(10)} disabled={tipping} testID="booking-tip-10" />
                  <TipChip label="+₹20" onPress={() => addTip(20)} disabled={tipping} testID="booking-tip-20" />
                  <TipChip label="+₹50" onPress={() => addTip(50)} disabled={tipping} testID="booking-tip-50" />
                </View>
                {(ride.tip || 0) > 0 && (
                  <TText variant="caption" color={colors.warning} style={{ marginTop: 8 }}>
                    Total tip added: ₹{ride.tip} • Fare ₹{ride.fare}
                  </TText>
                )}
              </View>
            )}
          </View>
        )}

        {ride.status === "scheduled" && (
          <Card style={{ marginBottom: spacing.md, backgroundColor: colors.infoBg, borderColor: colors.info + "40" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name="clock" size={20} color={colors.info} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <TText variant="bodyLg" weight="700" color={colors.info}>Scheduled</TText>
                <TText variant="bodySm" color={colors.info}>
                  Pickup at {new Date(ride.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </TText>
                <TText variant="caption" color={colors.info} style={{ marginTop: 4 }}>
                  Driver details shared 30 min before
                </TText>
              </View>
            </View>
          </Card>
        )}

        {/* DRIVER ASSIGNED — driver card + live map */}
        {ride.driver_id && !isCancelled && (
          <Card style={{ marginBottom: spacing.md }} testID="booking-driver-card">
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.driverAvatar}>
                <Feather name="user" size={22} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <TText variant="bodyLg" weight="700">{ride.driver_name}</TText>
                <TText variant="bodySm" muted>{ride.driver_vehicle_no || "Vehicle details pending"}</TText>
                {etaMin !== null && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <Feather name="clock" size={11} color={colors.success} />
                    <TText variant="caption" weight="700" color={colors.success} style={{ marginLeft: 4 }}>
                      {etaMin} min away • {etaKm?.toFixed(1)} km
                    </TText>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={callDriver} style={styles.callBtn} testID="booking-call-driver">
                <Feather name="phone" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* LIVE TRACKING MAP */}
        {ride.driver_id && ride.pickup && driverLoc && ["accepted", "started"].includes(ride.status) && (
          <Card style={{ padding: 0, overflow: "hidden", marginBottom: spacing.md }}>
            <MapPicker
              pickup={ride.pickup}
              drop={ride.drop || null}
              mode="pickup"
              onChange={() => {}}
              height={260}
              driverLocation={driverLoc}
              trackingOnly
            />
            <View style={styles.mapBar}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <TText variant="bodySm" weight="700" color={colors.primaryDark} style={{ marginLeft: 8, flex: 1 }}>
                {ride.status === "started" ? "On the way to drop" : "Driver is on the way"}
              </TText>
              {etaMin !== null && (
                <View style={styles.etaPill}>
                  <Feather name="clock" size={11} color={colors.primaryDark} />
                  <TText variant="bodySm" weight="700" color={colors.primaryDark} style={{ marginLeft: 4 }}>
                    {etaMin} min
                  </TText>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* PIN — show in accepted state, prominent */}
        {ride.status === "accepted" && ride.pin && (
          <Card style={[styles.pinCard, shadows.md]} testID="booking-pin-card">
            <TText variant="caption" color={colors.primaryDark}>SHARE THIS PIN WITH DRIVER</TText>
            <View style={styles.pinRow}>
              {String(ride.pin).split("").map((d: string, i: number) => (
                <View key={i} style={styles.pinBox}>
                  <TText variant="h1" color={colors.primary}>{d}</TText>
                </View>
              ))}
            </View>
            <TText variant="bodySm" muted align="center" style={{ marginTop: 8 }}>
              Driver enters this PIN to start your ride
            </TText>
          </Card>
        )}

        {/* Timeline */}
        {!isCancelled && (
          <Card style={{ marginBottom: spacing.md }}>
            <TText variant="caption" muted>RIDE PROGRESS</TText>
            <View style={{ marginTop: spacing.md }}>
              {STEPS.map((s, i) => (
                <TimelineNode
                  key={s}
                  label={STEP_LABELS[s]}
                  active={i <= stepIdx && stepIdx >= 0}
                  current={i === stepIdx}
                  last={i === STEPS.length - 1}
                />
              ))}
            </View>
          </Card>
        )}

        {isCancelled && (
          <Card style={{ marginBottom: spacing.md, backgroundColor: colors.errorBg, borderColor: colors.error + "40" }}>
            <TText variant="bodyLg" weight="700" color={colors.error}>Ride Cancelled</TText>
            <TText variant="bodySm" muted style={{ marginTop: 4 }}>
              By {ride.cancelled_by} · {ride.cancel_reason || "No reason"}
            </TText>
          </Card>
        )}

        {/* Fare summary */}
        <Card>
          <TText variant="caption" muted>FARE SUMMARY</TText>
          <View style={styles.row}><TText variant="body" muted>Ride fare</TText><TText variant="body" weight="600">₹{(ride.fare - (ride.tip || 0)).toFixed(0)}</TText></View>
          {(ride.tip || 0) > 0 && (
            <View style={styles.row}><TText variant="body" muted>Driver tip</TText><TText variant="body" weight="600" color={colors.success}>+₹{ride.tip}</TText></View>
          )}
          <View style={styles.divider} />
          <View style={styles.row}><TText variant="bodyLg" weight="700">Total</TText><TText variant="h3" color={colors.primaryDark}>₹{ride.fare}</TText></View>
          <View style={styles.row}><TText variant="bodySm" muted>Payment</TText><TText variant="bodySm" weight="600">{ride.payment_method === "upi" ? "UPI" : "Cash"}</TText></View>
          {ride.distance_km ? <View style={styles.row}><TText variant="bodySm" muted>Distance</TText><TText variant="bodySm" weight="600">{ride.distance_km} km</TText></View> : null}
        </Card>
      </ScrollView>

      {!isCancelled && !isCompleted && (
        <View style={styles.footer}>
          <TButton
            label="Cancel Ride"
            variant="outline"
            onPress={() => setCancelOpen(true)}
            testID="booking-cancel-button"
            icon={<Feather name="x" size={18} color={colors.text} />}
          />
        </View>
      )}

      {isCompleted && (
        <View style={styles.footer}>
          <TButton
            label="Book Another Ride"
            onPress={() => router.replace("/(passenger)/home")}
            testID="booking-book-another"
          />
        </View>
      )}

      <Modal visible={cancelOpen} animationType="slide" transparent onRequestClose={() => setCancelOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={{ padding: spacing.lg }}>
              <TText variant="h3">Why are you cancelling?</TText>
              <TText variant="bodySm" muted style={{ marginTop: 4 }}>This helps us improve service</TText>
              <View style={{ marginTop: spacing.lg }}>
                {CANCEL_REASONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    testID={`cancel-reason-${r.replace(/\s+/g, "-").toLowerCase()}`}
                    style={[styles.reason, reason === r && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                    onPress={() => setReason(r)}
                  >
                    <TText variant="body">{r}</TText>
                    {reason === r && <Feather name="check" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ marginTop: spacing.lg }}>
                <TButton label="Confirm Cancellation" variant="danger" onPress={doCancel} loading={cancelling} testID="cancel-confirm-btn" />
                <View style={{ height: 8 }} />
                <TButton label="Keep Ride" variant="outline" onPress={() => setCancelOpen(false)} testID="cancel-keep-btn" />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <RateRideModal
        visible={rateOpen}
        rideId={String(id || "")}
        targetName={ride.driver_name}
        targetRole="driver"
        onClose={() => { setRateOpen(false); setRated(true); }}
        onSubmitted={() => setRated(true)}
      />
    </SafeAreaView>
  );
}

function TipChip({ label, onPress, disabled, testID }: { label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  return (
    <TouchableOpacity
      style={[styles.tipChip, disabled && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      testID={testID}
    >
      <TText variant="bodySm" weight="700" color={colors.text}>{label}</TText>
    </TouchableOpacity>
  );
}

const STEP_LABELS: Record<string, string> = {
  requested: "Looking for driver",
  accepted: "Driver assigned",
  started: "Ride in progress",
  completed: "Ride completed",
};

function TimelineNode({ label, active, current, last }: { label: string; active: boolean; current: boolean; last: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <View style={{ alignItems: "center", width: 24 }}>
        <View style={[
          styles.tlDot,
          { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
          current && { transform: [{ scale: 1.2 }] },
        ]} />
        {!last && <View style={[styles.tlLine, { backgroundColor: active ? colors.primary : colors.border }]} />}
      </View>
      <View style={{ flex: 1, paddingLeft: 12, paddingBottom: last ? 0 : 22 }}>
        <TText variant="body" weight={active ? "700" : "500"} muted={!active}>{label}</TText>
        {current && <TText variant="bodySm" color={colors.primary} style={{ marginTop: 2 }}>In progress</TText>}
      </View>
    </View>
  );
}

function labelFor(t: string) {
  return ({ local: "Local Ride", poochari: "Poochari Parikrama", radhakund: "Radhakund Parikrama", combined: "Combined Parikrama" } as any)[t] || t;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  searchCard: {
    backgroundColor: "#1A2421",
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
    ...shadows.md,
  },
  searchIconWrap: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  searchPulse: {
    position: "absolute",
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary,
  },
  searchIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  tipNudge: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  tipRow: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  tipChip: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  pinCard: { marginBottom: spacing.md, backgroundColor: colors.primaryLight, alignItems: "center", borderColor: colors.primary + "40" },
  pinRow: { flexDirection: "row", marginTop: spacing.md, gap: 8 },
  pinBox: {
    width: 52, height: 60, backgroundColor: colors.surface, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.primary,
  },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", ...shadows.sm },
  mapBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  etaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tlDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  tlLine: { flex: 1, width: 2, minHeight: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  divider: { height: 1, backgroundColor: colors.border, marginTop: spacing.md },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 10 },
  reason: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
});
