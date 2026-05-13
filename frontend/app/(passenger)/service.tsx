import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TText } from "../../src/components/TText";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { colors, radius, spacing, shadows } from "../../src/theme";

const PARIKRAMA = {
  poochari: { name: "Poochari Parikrama", km: 12, desc: "Around the holy Poochari ka Lota route" },
  radhakund: { name: "Radhakund Parikrama", km: 7, desc: "Sacred Radha Kund & Shyam Kund circuit" },
  combined: { name: "Combined Parikrama", km: 19, desc: "Full Poochari + Radhakund yatra" },
};

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default function ServiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type: string }>();
  const type = (params.type as "local" | "poochari" | "radhakund" | "combined") || "local";
  const [config, setConfig] = useState<any>(null);
  const [pickup, setPickup] = useState<any>(null);
  const [drop, setDrop] = useState<any>(null);
  const [payment, setPayment] = useState<"upi" | "cash">("cash");
  const [pickerFor, setPickerFor] = useState<null | "pickup" | "drop">(null);
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<any>("/config/fare", { auth: false }).then(setConfig).catch(() => {});
  }, []);

  const distance = pickup && drop ? +haversine(pickup, drop).toFixed(2) : 0;
  let fare = 0;
  if (config) {
    if (type === "local") fare = +(config.base_fare + config.per_km * Math.max(distance, 1)).toFixed(2);
    if (type === "poochari") fare = config.poochari_fare;
    if (type === "radhakund") fare = config.radhakund_fare;
    if (type === "combined") fare = config.combined_fare;
  }

  const submit = async () => {
    if (type === "local" && (!pickup || !drop)) {
      Alert.alert("Missing details", "Choose pickup and drop locations");
      return;
    }
    if (type === "local" && pickup?.id === drop?.id) {
      Alert.alert("Same location", "Pickup and drop cannot be the same");
      return;
    }
    setSubmitting(true);
    try {
      const body: any = {
        type,
        payment_method: payment,
        pickup,
        drop,
        distance_km: type === "local" ? distance : (PARIKRAMA as any)[type]?.km,
      };
      if (scheduleLater) body.scheduled_at = scheduledAt.toISOString();
      const ride = await api<any>("/rides", { method: "POST", body });
      router.replace({ pathname: "/(passenger)/booking", params: { id: ride.id } });
    } catch (e: any) {
      Alert.alert("Could not create ride", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const adjustSchedule = (mins: number) => {
    setScheduledAt(new Date(scheduledAt.getTime() + mins * 60 * 1000));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="service-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="service-back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <TText variant="h3" style={{ marginLeft: spacing.md }}>
          {type === "local" ? "Local Ride" : (PARIKRAMA as any)[type]?.name}
        </TText>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        {type === "local" ? (
          <Card style={{ marginBottom: spacing.md }}>
            <TText variant="caption" muted>YOUR ROUTE</TText>
            <View style={{ marginTop: spacing.md }}>
              <RoutePicker
                icon="map-pin"
                color={colors.success}
                label="Pickup"
                value={pickup?.name || "Choose pickup point"}
                onPress={() => setPickerFor("pickup")}
                testID="service-pickup-btn"
              />
              <View style={styles.routeDivider} />
              <RoutePicker
                icon="navigation"
                color={colors.error}
                label="Drop"
                value={drop?.name || "Choose drop point"}
                onPress={() => setPickerFor("drop")}
                testID="service-drop-btn"
              />
            </View>
            {pickup && drop && (
              <View style={styles.distanceBar}>
                <Feather name="map" size={14} color={colors.primaryDark} />
                <TText variant="bodySm" weight="600" color={colors.primaryDark} style={{ marginLeft: 6 }}>
                  ~{distance} km
                </TText>
              </View>
            )}
          </Card>
        ) : (
          <Card style={{ marginBottom: spacing.md, backgroundColor: colors.primaryLight }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.parikramaIcon}>
                <Feather name="compass" size={22} color={colors.primaryDark} />
              </View>
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <TText variant="bodyLg" weight="700">{(PARIKRAMA as any)[type]?.name}</TText>
                <TText variant="bodySm" muted>{(PARIKRAMA as any)[type]?.desc}</TText>
                <TText variant="bodySm" muted style={{ marginTop: 4 }}>{(PARIKRAMA as any)[type]?.km} km route</TText>
              </View>
            </View>
          </Card>
        )}

        <Card style={{ marginBottom: spacing.md }}>
          <TText variant="caption" muted>PAYMENT METHOD</TText>
          <View style={styles.payRow}>
            <PayChip selected={payment === "cash"} icon="dollar-sign" label="Cash" onPress={() => setPayment("cash")} testID="service-pay-cash" />
            <PayChip selected={payment === "upi"} icon="smartphone" label="UPI" onPress={() => setPayment("upi")} testID="service-pay-upi" />
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <TText variant="bodyLg" weight="600">Ride later?</TText>
              <TText variant="bodySm" muted>Driver assigned 30 min before pickup</TText>
            </View>
            <TouchableOpacity
              testID="service-schedule-toggle"
              style={[styles.toggle, scheduleLater && { backgroundColor: colors.primary }]}
              onPress={() => setScheduleLater(!scheduleLater)}
            >
              <View style={[styles.knob, scheduleLater && { transform: [{ translateX: 22 }] }]} />
            </TouchableOpacity>
          </View>
          {scheduleLater && (
            <View style={styles.schedRow}>
              <TText variant="bodySm" muted>Pickup at</TText>
              <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>
                {scheduledAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              </TText>
              <View style={styles.schedBtns}>
                <TouchableOpacity style={styles.schedBtn} onPress={() => adjustSchedule(-30)} testID="service-sched-minus">
                  <TText variant="bodySm" weight="600">-30 min</TText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.schedBtn} onPress={() => adjustSchedule(30)} testID="service-sched-plus">
                  <TText variant="bodySm" weight="600">+30 min</TText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.schedBtn} onPress={() => adjustSchedule(60)} testID="service-sched-plus-hour">
                  <TText variant="bodySm" weight="600">+1 hr</TText>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>

        <Card>
          <TText variant="caption" muted>FARE BREAKDOWN</TText>
          {type === "local" ? (
            <>
              <Row label="Base fare" value={`₹${config?.base_fare ?? 0}`} />
              <Row label={`Distance (${Math.max(distance, 1)} km × ₹${config?.per_km ?? 0})`} value={`₹${(config?.per_km * Math.max(distance, 1) || 0).toFixed(0)}`} />
            </>
          ) : (
            <Row label={`${(PARIKRAMA as any)[type]?.name} (fixed)`} value={`₹${fare}`} />
          )}
          <View style={styles.totalLine} />
          <Row label={<TText variant="bodyLg" weight="700">Total</TText>} value={<TText variant="h3" color={colors.primaryDark}>₹{fare.toFixed(0)}</TText>} />
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <TButton
          label={scheduleLater ? "Schedule Ride" : "Confirm & Find Driver"}
          onPress={submit}
          loading={submitting}
          testID="service-confirm-button"
          icon={<Feather name="check-circle" size={18} color={colors.textInverse} />}
        />
      </View>

      <Modal visible={!!pickerFor} animationType="slide" transparent onRequestClose={() => setPickerFor(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <TText variant="h3">
                Choose {pickerFor === "pickup" ? "pickup" : "drop"} point
              </TText>
              <TouchableOpacity onPress={() => setPickerFor(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={config?.landmarks || []}
              keyExtractor={(item: any) => item.id}
              renderItem={({ item }: any) => (
                <TouchableOpacity
                  testID={`landmark-${item.id}`}
                  style={styles.landmark}
                  onPress={() => {
                    if (pickerFor === "pickup") setPickup(item);
                    else setDrop(item);
                    setPickerFor(null);
                  }}
                >
                  <View style={styles.landmarkIcon}>
                    <Feather name="map-pin" size={16} color={colors.primaryDark} />
                  </View>
                  <TText variant="body" style={{ flex: 1, marginLeft: 12 }}>{item.name}</TText>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 50 }} />}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, value }: any) {
  return (
    <View style={styles.row}>
      {typeof label === "string" ? <TText variant="body" muted>{label}</TText> : label}
      {typeof value === "string" ? <TText variant="body" weight="600">{value}</TText> : value}
    </View>
  );
}

function RoutePicker({ icon, color, label, value, onPress, testID }: any) {
  return (
    <TouchableOpacity style={styles.picker} onPress={onPress} testID={testID} activeOpacity={0.8}>
      <View style={[styles.pickerIcon, { backgroundColor: color + "22" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TText variant="caption" muted>{label}</TText>
        <TText variant="body" weight="500" numberOfLines={1} style={{ marginTop: 2 }}>{value}</TText>
      </View>
      <Feather name="chevron-down" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function PayChip({ selected, icon, label, onPress, testID }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.payChip, selected && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
    >
      <Feather name={icon} size={16} color={selected ? colors.primaryDark : colors.textMuted} />
      <TText variant="bodySm" weight="700" color={selected ? colors.primaryDark : colors.textMuted} style={{ marginLeft: 8 }}>
        {label}
      </TText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  picker: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  pickerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  routeDivider: { height: 1, backgroundColor: colors.border, marginLeft: 44, marginVertical: 4 },
  distanceBar: {
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  parikramaIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  totalLine: { height: 1, backgroundColor: colors.border, marginTop: spacing.md },
  payRow: { flexDirection: "row", gap: 12, marginTop: spacing.md },
  payChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggle: { width: 48, height: 26, borderRadius: 13, backgroundColor: colors.border, justifyContent: "center", padding: 2 },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface, ...shadows.sm },
  schedRow: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md },
  schedBtns: { flexDirection: "row", gap: 8, marginTop: spacing.md, flexWrap: "wrap" },
  schedBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  footer: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "75%", paddingBottom: spacing.xl },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 10 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  landmark: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: spacing.lg },
  landmarkIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
});
