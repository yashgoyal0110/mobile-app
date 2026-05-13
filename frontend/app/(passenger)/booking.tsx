import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TText } from "../../src/components/TText";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import MapPicker from "../../src/components/MapPicker";
import RateRideModal from "../../src/components/RateRideModal";
import { api } from "../../src/api";
import { useRealtimeEvent } from "../../src/realtime";
import { colors, radius, spacing, shadows } from "../../src/theme";

const STEPS = ["requested", "accepted", "started", "completed"];
const CANCEL_REASONS = [
  "Changed my plan",
  "Driver is taking too long",
  "Found alternate transport",
  "Wrong location selected",
  "Other",
];

export default function BookingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ride, setRide] = useState<any>(null);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rated, setRated] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await api<any>(`/rides/${id}`);
      setRide(r);
      if (r.driver_location) setDriverLoc(r.driver_location);
      // Auto-open rating modal once ride is completed (only once)
      if (r.status === "completed" && r.driver_id && !rated) {
        setRateOpen(true);
      }
    } catch (e: any) {
      Alert.alert("Could not load", e.message);
    }
  }, [id, rated]);

  useEffect(() => {
    load();
    // Slow polling as a safety net (WS handles real-time)
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, [load]);

  // Realtime: instant status changes via WS
  useRealtimeEvent("ride_accepted", (ev) => {
    if (ev.ride?.id === id) {
      setRide(ev.ride);
    }
  });
  useRealtimeEvent("ride_started", (ev) => {
    if (ev.ride_id === id) load();
  });
  useRealtimeEvent("ride_completed", (ev) => {
    if (ev.ride_id === id) load();
  });
  useRealtimeEvent("ride_cancelled", (ev) => {
    if (ev.ride_id === id) load();
  });
  useRealtimeEvent("driver_location", (ev) => {
    if (ev.ride_id === id) {
      setDriverLoc({ lat: ev.lat, lng: ev.lng });
    }
  });

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

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
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

        {/* PIN Display */}
        {(ride.status === "accepted") && ride.pin && (
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

        {/* Driver Info */}
        {ride.driver_id && (
          <Card style={{ marginBottom: spacing.md }} testID="booking-driver-card">
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.driverAvatar}>
                <Feather name="user" size={22} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <TText variant="bodyLg" weight="700">{ride.driver_name}</TText>
                <TText variant="bodySm" muted>{ride.driver_vehicle_no || "Vehicle details pending"}</TText>
                <TText variant="caption" color={colors.success} style={{ marginTop: 4 }}>
                  <Feather name="phone" size={11} color={colors.success} /> {ride.driver_phone}
                </TText>
              </View>
            </View>
          </Card>
        )}

        {/* Live driver location map */}
        {ride.driver_id && ride.pickup && driverLoc && ["accepted", "started"].includes(ride.status) && (
          <Card style={{ padding: 0, overflow: "hidden", marginBottom: spacing.md }}>
            <MapPicker
              pickup={{ ...ride.pickup, name: "Pickup" }}
              drop={{ lat: driverLoc.lat, lng: driverLoc.lng, name: "Driver" }}
              mode="pickup"
              onChange={() => {}}
              height={200}
            />
            <View style={styles.mapBar}>
              <Feather name="navigation" size={14} color={colors.primaryDark} />
              <TText variant="bodySm" weight="700" color={colors.primaryDark} style={{ marginLeft: 6 }}>
                Driver is on the way (live)
              </TText>
            </View>
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
          <View style={styles.row}><TText variant="body" muted>Total</TText><TText variant="bodyLg" weight="700">₹{ride.fare}</TText></View>
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
            label="Book Another"
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
  pinCard: { marginBottom: spacing.md, backgroundColor: colors.primaryLight, alignItems: "center", borderColor: colors.primary + "40" },
  pinRow: { flexDirection: "row", marginTop: spacing.md, gap: 8 },
  pinBox: {
    width: 52, height: 60, backgroundColor: colors.surface, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.primary,
  },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  mapBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  tlDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  tlLine: { flex: 1, width: 2, minHeight: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 10 },
  reason: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
});
