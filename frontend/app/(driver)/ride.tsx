import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, TextInput, TouchableOpacity, Modal, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TText } from "../../src/components/TText";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import MapPicker from "../../src/components/MapPicker";
import RateRideModal from "../../src/components/RateRideModal";
import { useRealtimeEvent } from "../../src/realtime";
import { api } from "../../src/api";
import { colors, radius, spacing, shadows } from "../../src/theme";

const REASONS = ["Passenger not responding", "Vehicle issue", "Address incorrect", "Emergency", "Other"];

export default function DriverRide() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ride, setRide] = useState<any>(null);
  const [paxLoc, setPaxLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rateOpen, setRateOpen] = useState(false);
  const [rated, setRated] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await api<any>(`/rides/${id}`);
      setRide(r);
      if (r.passenger_location) setPaxLoc(r.passenger_location);
      if (r.status === "completed" && r.passenger_id && !rated) {
        setRateOpen(true);
      }
    } catch (e: any) {
      Alert.alert("Could not load", e.message);
    }
  }, [id, rated]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  useRealtimeEvent("passenger_location", (ev) => {
    if (ev.ride_id === id) setPaxLoc({ lat: ev.lat, lng: ev.lng });
  });
  useRealtimeEvent("ride_cancelled", (ev) => { if (ev.ride_id === id) load(); });

  const callPassenger = () => {
    if (ride?.passenger_phone) {
      Linking.openURL(`tel:${ride.passenger_phone}`).catch(() => {});
    }
  };

  const verifyPin = async () => {
    if (pinInput.length !== 4) {
      Alert.alert("Enter the 4-digit PIN");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/rides/${id}/verify-pin`, { method: "POST", body: { pin: pinInput } });
      await load();
    } catch (e: any) {
      Alert.alert("Incorrect PIN", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const complete = async () => {
    Alert.alert("Complete ride?", "Confirm passenger has been dropped off", [
      { text: "Not yet", style: "cancel" },
      {
        text: "Complete",
        onPress: async () => {
          try {
            await api(`/rides/${id}/complete`, { method: "POST" });
            await load();
          } catch (e: any) {
            Alert.alert("Failed", e.message);
          }
        },
      },
    ]);
  };

  const doCancel = async () => {
    if (!reason) {
      Alert.alert("Pick a reason");
      return;
    }
    try {
      await api(`/rides/${id}/cancel`, { method: "POST", body: { reason } });
      setCancelOpen(false);
      load();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    }
  };

  if (!ride) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <TText variant="body">Loading...</TText>
        </View>
      </SafeAreaView>
    );
  }

  const isDone = ride.status === "completed" || ride.status === "cancelled";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-ride-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(driver)/home")} testID="driver-ride-back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <TText variant="caption" muted>RIDE {ride.id.slice(0, 8).toUpperCase()}</TText>
          <TText variant="h3">{labelFor(ride.type)}</TText>
        </View>
        <StatusPill status={ride.status} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        <Card>
          <TText variant="caption" muted>PASSENGER</TText>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.md }}>
            <View style={styles.avatar}><Feather name="user" size={20} color={colors.primaryDark} /></View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <TText variant="bodyLg" weight="700">{ride.passenger_name}</TText>
              <TText variant="bodySm" muted>+91 {ride.passenger_phone}</TText>
            </View>
            <TouchableOpacity onPress={callPassenger} style={styles.callBtn} testID="driver-call-passenger">
              <Feather name="phone" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Live passenger location map (after accept) */}
        {paxLoc && ride.pickup && ["accepted", "started"].includes(ride.status) && (
          <Card style={{ padding: 0, overflow: "hidden", marginTop: spacing.md }}>
            <MapPicker
              pickup={ride.pickup}
              drop={ride.drop || null}
              mode="pickup"
              onChange={() => {}}
              height={220}
              driverLocation={paxLoc}
              trackingOnly
            />
            <View style={styles.mapBar}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <TText variant="bodySm" weight="700" color={colors.primaryDark} style={{ marginLeft: 8, flex: 1 }}>
                {ride.status === "started" ? "Passenger is in your e-rickshaw" : "Passenger waiting at pickup"}
              </TText>
            </View>
          </Card>
        )}

        {ride.pickup && ride.drop && (
          <Card style={{ marginTop: spacing.md }}>
            <TText variant="caption" muted>ROUTE</TText>
            <View style={{ marginTop: spacing.md }}>
              <View style={styles.routeItem}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <TText variant="body" weight="600" style={{ marginLeft: 12 }}>{ride.pickup.name}</TText>
              </View>
              <View style={[styles.routeLine]} />
              <View style={styles.routeItem}>
                <View style={[styles.dot, { backgroundColor: colors.error }]} />
                <TText variant="body" weight="600" style={{ marginLeft: 12 }}>{ride.drop.name}</TText>
              </View>
            </View>
          </Card>
        )}

        {ride.status === "accepted" && (
          <Card style={{ marginTop: spacing.md, backgroundColor: colors.primaryLight, borderColor: colors.primary + "40" }}>
            <TText variant="caption" color={colors.primaryDark}>ENTER PASSENGER'S PIN TO START</TText>
            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.md }}>
              <TextInput
                value={pinInput}
                onChangeText={(v) => setPinInput(v.replace(/\D/g, "").slice(0, 4))}
                keyboardType="number-pad"
                placeholder="0000"
                placeholderTextColor={colors.textMuted}
                style={styles.pinInput}
                maxLength={4}
                testID="driver-pin-input"
              />
            </View>
            <TButton
              label="Start ride"
              onPress={verifyPin}
              loading={submitting}
              disabled={pinInput.length !== 4}
              testID="driver-start-ride"
              icon={<Feather name="play" size={16} color={colors.textInverse} />}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {ride.status === "started" && (
          <Card style={{ marginTop: spacing.md, backgroundColor: colors.successBg, borderColor: colors.success + "40" }}>
            <TText variant="caption" color={colors.success}>RIDE IN PROGRESS</TText>
            <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>Drive safe, take blessed paths 🙏</TText>
            <TButton
              label="Mark ride complete"
              onPress={complete}
              testID="driver-complete-ride"
              icon={<Feather name="check-circle" size={16} color={colors.textInverse} />}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        <Card style={{ marginTop: spacing.md }}>
          <TText variant="caption" muted>EARNINGS</TText>
          <View style={styles.row}><TText variant="body" muted>Ride fare</TText><TText variant="body" weight="600">₹{ride.fare}</TText></View>
          <View style={styles.row}><TText variant="body" muted>Platform commission</TText><TText variant="body" weight="600" color={colors.error}>-₹{ride.commission}</TText></View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <TText variant="bodyLg" weight="700">You earn</TText>
            <TText variant="h3" color={colors.success}>₹{ride.driver_earning}</TText>
          </View>
          <TText variant="caption" muted style={{ marginTop: 8 }}>{ride.payment_method === "upi" ? "UPI · to your registered ID" : "Cash · collect from passenger"}</TText>
        </Card>

        {ride.status === "cancelled" && (
          <Card style={{ marginTop: spacing.md, backgroundColor: colors.errorBg, borderColor: colors.error + "40" }}>
            <TText variant="bodyLg" weight="700" color={colors.error}>Ride Cancelled</TText>
            <TText variant="bodySm" muted style={{ marginTop: 4 }}>
              By {ride.cancelled_by} · {ride.cancel_reason}
            </TText>
          </Card>
        )}
      </ScrollView>

      {!isDone && (
        <View style={styles.footer}>
          <TButton label="Cancel ride" variant="outline" onPress={() => setCancelOpen(true)} testID="driver-cancel-ride" />
        </View>
      )}

      <Modal visible={cancelOpen} transparent animationType="slide" onRequestClose={() => setCancelOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={{ padding: spacing.lg }}>
              <TText variant="h3">Cancellation reason</TText>
              {REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setReason(r)}
                  style={[styles.reason, reason === r && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                  testID={`driver-cancel-reason-${r.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <TText variant="body">{r}</TText>
                  {reason === r && <Feather name="check" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
              <View style={{ marginTop: spacing.md }}>
                <TButton label="Confirm cancellation" variant="danger" onPress={doCancel} testID="driver-cancel-confirm" />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <RateRideModal
        visible={rateOpen}
        rideId={String(id || "")}
        targetName={ride.passenger_name}
        targetRole="passenger"
        onClose={() => { setRateOpen(false); setRated(true); }}
        onSubmitted={() => setRated(true)}
      />
    </SafeAreaView>
  );
}

function labelFor(t: string) {
  return ({ local: "Local Ride", poochari: "Poochari Parikrama", radhakund: "Radhakund Parikrama", combined: "Combined Parikrama" } as any)[t] || t;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", ...shadows.sm },
  mapBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  routeItem: { flexDirection: "row", alignItems: "center" },
  routeLine: { width: 2, height: 18, backgroundColor: colors.border, marginLeft: 5, marginVertical: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 12 },
  pinInput: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.primaryDark,
    letterSpacing: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    textAlign: "center",
    borderWidth: 2,
    borderColor: colors.primary,
    minWidth: 200,
  },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 10 },
  reason: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
});
