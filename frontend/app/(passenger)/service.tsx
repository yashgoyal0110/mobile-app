import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TText } from "../../src/components/TText";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import MapPicker, { LatLng } from "../../src/components/MapPicker";
import LocationSearchSheet from "../../src/components/LocationSearchSheet";
import { api } from "../../src/api";
import { colors, radius, spacing, shadows } from "../../src/theme";

const PARIKRAMA = {
  poochari: { name: "Poochari Parikrama", km: 12, desc: "Around the holy Poochari ka Lota route" },
  radhakund: { name: "Radhakund Parikrama", km: 7, desc: "Sacred Radha Kund & Shyam Kund circuit" },
  combined: { name: "Combined Parikrama", km: 19, desc: "Full Poochari + Radhakund yatra" },
};

const MAX_SCHEDULE_HOURS = 24;
const MIN_SCHEDULE_MINUTES = 30;

export default function ServiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type: string }>();
  const type = (params.type as "local" | "poochari" | "radhakund" | "combined") || "local";
  const [config, setConfig] = useState<any>(null);
  const [region, setRegion] = useState<{ bbox: any; center: any } | null>(null);
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [drop, setDrop] = useState<LatLng | null>(null);
  const [sheet, setSheet] = useState<"pickup" | "drop" | null>(null);
  const [polyline, setPolyline] = useState<[number, number][] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance_km: number; duration_min: number; source: string } | null>(null);
  const [routing, setRouting] = useState(false);
  const [payment, setPayment] = useState<"upi" | "cash">("cash");
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date>(() => new Date(Date.now() + 60 * 60 * 1000));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<any>("/config/fare", { auth: false }).then(setConfig).catch(() => {});
    api<any>("/geo/region", { auth: false }).then(setRegion).catch(() => {});
  }, []);

  useEffect(() => {
    if (type !== "local" || !pickup || !drop) {
      setPolyline(null);
      setRouteInfo(null);
      return;
    }
    let cancelled = false;
    setRouting(true);
    api<any>(
      `/geo/route?from_lat=${pickup.lat}&from_lng=${pickup.lng}&to_lat=${drop.lat}&to_lng=${drop.lng}`,
      { auth: false }
    )
      .then((r) => {
        if (cancelled) return;
        setRouteInfo({ distance_km: r.distance_km, duration_min: r.duration_min, source: r.source });
        setPolyline(r.polyline);
      })
      .catch(() => {})
      .finally(() => !cancelled && setRouting(false));
    return () => { cancelled = true; };
  }, [pickup, drop, type]);

  const distance = routeInfo?.distance_km ?? 0;
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
    if (type === "local" && pickup && drop && Math.abs(pickup.lat - drop.lat) < 0.0005 && Math.abs(pickup.lng - drop.lng) < 0.0005) {
      Alert.alert("Same location", "Pickup and drop are too close");
      return;
    }
    if (scheduleLater) {
      const now = new Date();
      const diffMin = (scheduledAt.getTime() - now.getTime()) / (1000 * 60);
      if (diffMin < MIN_SCHEDULE_MINUTES) {
        Alert.alert("Too soon", `Schedule at least ${MIN_SCHEDULE_MINUTES} minutes from now`);
        return;
      }
      if (diffMin > MAX_SCHEDULE_HOURS * 60) {
        Alert.alert("Too far", `Schedule within ${MAX_SCHEDULE_HOURS} hours from now`);
        return;
      }
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

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 180 }}>
        {type === "local" ? (
          <>
            {/* PICKUP / DROP fields — primary entry point */}
            <Card style={{ marginBottom: spacing.md, padding: 0 }}>
              <RouteField
                icon="map-pin"
                color={colors.success}
                label="PICKUP"
                value={pickup?.name}
                placeholder="Where should we pick you up?"
                onPress={() => setSheet("pickup")}
                onClear={pickup ? () => setPickup(null) : undefined}
                testID="service-pickup-field"
              />
              <View style={styles.fieldDivider} />
              <RouteField
                icon="navigation"
                color={colors.error}
                label="DROP"
                value={drop?.name}
                placeholder="Where to?"
                onPress={() => setSheet("drop")}
                onClear={drop ? () => setDrop(null) : undefined}
                testID="service-drop-field"
              />
            </Card>

            {/* Route preview map */}
            {pickup && drop && (
              <Card style={{ padding: 0, overflow: "hidden", marginBottom: spacing.md }}>
                <MapPicker
                  pickup={pickup}
                  drop={drop}
                  mode={"pickup"}
                  onChange={() => { /* read-only preview ignores taps */ }}
                  bbox={region?.bbox}
                  center={region?.center}
                  polyline={polyline}
                  height={220}
                />
                <View style={styles.previewBar}>
                  <View style={styles.previewPill}>
                    <Feather name="map" size={13} color={colors.primaryDark} />
                    <TText variant="bodySm" weight="700" color={colors.primaryDark} style={{ marginLeft: 6 }}>
                      {routing ? "Calculating…" : `${distance} km`}
                    </TText>
                  </View>
                  {routeInfo && (
                    <View style={styles.previewPill}>
                      <Feather name="clock" size={13} color={colors.primaryDark} />
                      <TText variant="bodySm" weight="700" color={colors.primaryDark} style={{ marginLeft: 6 }}>
                        ~{Math.max(1, Math.round(routeInfo.duration_min))} min
                      </TText>
                    </View>
                  )}
                  {routeInfo?.source === "fallback" && (
                    <TText variant="caption" muted>approx</TText>
                  )}
                </View>
              </Card>
            )}
          </>
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
              <TText variant="bodySm" muted>Schedule up to 24 hours ahead</TText>
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
            <SchedulePicker value={scheduledAt} onChange={setScheduledAt} />
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
          disabled={type === "local" && (!pickup || !drop)}
          testID="service-confirm-button"
          icon={<Feather name="check-circle" size={18} color={colors.textInverse} />}
        />
      </View>

      <LocationSearchSheet
        visible={!!sheet}
        mode={sheet || "pickup"}
        initial={sheet === "pickup" ? pickup : drop}
        landmarks={config?.landmarks || []}
        region={region}
        onClose={() => setSheet(null)}
        onSelect={(coord) => {
          if (sheet === "pickup") setPickup(coord);
          else if (sheet === "drop") setDrop(coord);
        }}
      />
    </SafeAreaView>
  );
}

function RouteField({ icon, color, label, value, placeholder, onPress, onClear, testID }: any) {
  return (
    <TouchableOpacity style={styles.field} onPress={onPress} testID={testID} activeOpacity={0.85}>
      <View style={[styles.fieldIcon, { backgroundColor: color + "22" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TText variant="caption" muted>{label}</TText>
        {value ? (
          <TText variant="body" weight="600" numberOfLines={1} style={{ marginTop: 2 }}>{value}</TText>
        ) : (
          <TText variant="body" muted numberOfLines={1} style={{ marginTop: 2 }}>{placeholder}</TText>
        )}
      </View>
      {onClear ? (
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ) : (
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

function SchedulePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  // Quick chips: Today / Tomorrow + time slot buttons
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = value.toDateString() === now.toDateString();
  const isTomorrow = value.toDateString() === tomorrow.toDateString();

  const setDay = (which: "today" | "tomorrow") => {
    const base = which === "today" ? new Date(now) : new Date(tomorrow);
    base.setHours(value.getHours(), value.getMinutes(), 0, 0);
    if (which === "today") {
      // ensure at least 30 min from now
      if (base.getTime() < now.getTime() + 30 * 60 * 1000) {
        base.setTime(now.getTime() + 30 * 60 * 1000);
      }
    }
    onChange(clamp(base));
  };

  const adjustMin = (delta: number) => {
    const next = new Date(value.getTime() + delta * 60 * 1000);
    onChange(clamp(next));
  };

  const clamp = (d: Date) => {
    const minT = now.getTime() + MIN_SCHEDULE_MINUTES * 60 * 1000;
    const maxT = now.getTime() + MAX_SCHEDULE_HOURS * 60 * 60 * 1000;
    const t = Math.max(minT, Math.min(maxT, d.getTime()));
    return new Date(t);
  };

  // For web: use native datetime-local input
  const onWebChange = (val: string) => {
    if (!val) return;
    const d = new Date(val);
    if (!isNaN(d.getTime())) onChange(clamp(d));
  };

  const toLocalInputValue = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const minInput = toLocalInputValue(new Date(now.getTime() + MIN_SCHEDULE_MINUTES * 60 * 1000));
  const maxInput = toLocalInputValue(new Date(now.getTime() + MAX_SCHEDULE_HOURS * 60 * 60 * 1000));

  return (
    <View style={styles.schedRow}>
      <TText variant="bodySm" muted>Pickup at</TText>
      <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>
        {value.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
      </TText>

      {/* Web: native datetime input for precise selection */}
      {Platform.OS === "web" && (
        <View style={{ marginTop: spacing.md }}>
          {/* @ts-ignore */}
          <input
            type="datetime-local"
            value={toLocalInputValue(value)}
            min={minInput}
            max={maxInput}
            onChange={(e: any) => onWebChange(e.target.value)}
            style={{
              padding: 10,
              fontSize: 14,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              color: colors.text,
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </View>
      )}

      <View style={styles.chipRow}>
        <TouchableOpacity style={[styles.dayChip, isToday && styles.dayChipActive]} onPress={() => setDay("today")} testID="service-day-today">
          <TText variant="bodySm" weight={isToday ? "700" : "500"} color={isToday ? colors.primaryDark : colors.text}>Today</TText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dayChip, isTomorrow && styles.dayChipActive]} onPress={() => setDay("tomorrow")} testID="service-day-tomorrow">
          <TText variant="bodySm" weight={isTomorrow ? "700" : "500"} color={isTomorrow ? colors.primaryDark : colors.text}>Tomorrow</TText>
        </TouchableOpacity>
      </View>

      <View style={styles.adjRow}>
        <TouchableOpacity style={styles.adjBtn} onPress={() => adjustMin(-30)} testID="service-sched-minus30">
          <Feather name="minus" size={12} color={colors.text} />
          <TText variant="bodySm" weight="600">30m</TText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adjBtn} onPress={() => adjustMin(30)} testID="service-sched-plus30">
          <Feather name="plus" size={12} color={colors.text} />
          <TText variant="bodySm" weight="600">30m</TText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adjBtn} onPress={() => adjustMin(60)} testID="service-sched-plus1h">
          <Feather name="plus" size={12} color={colors.text} />
          <TText variant="bodySm" weight="600">1h</TText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adjBtn} onPress={() => adjustMin(180)} testID="service-sched-plus3h">
          <Feather name="plus" size={12} color={colors.text} />
          <TText variant="bodySm" weight="600">3h</TText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adjBtn} onPress={() => adjustMin(360)} testID="service-sched-plus6h">
          <Feather name="plus" size={12} color={colors.text} />
          <TText variant="bodySm" weight="600">6h</TText>
        </TouchableOpacity>
      </View>

      <TText variant="caption" muted style={{ marginTop: 8 }}>
        Pickup must be 30 min to 24 hours from now
      </TText>
    </View>
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
  field: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: spacing.md },
  fieldDivider: { height: 1, backgroundColor: colors.border, marginLeft: 60 },
  fieldIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  previewBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    flexWrap: "wrap",
  },
  previewPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
  },
  parikramaIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  totalLine: { height: 1, backgroundColor: colors.border, marginTop: spacing.md },
  payRow: { flexDirection: "row", gap: 12, marginTop: spacing.md },
  payChip: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  toggle: { width: 48, height: 26, borderRadius: 13, backgroundColor: colors.border, justifyContent: "center", padding: 2 },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface, ...shadows.sm },
  schedRow: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md },
  chipRow: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  dayChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dayChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary + "40" },
  adjRow: { flexDirection: "row", gap: 6, marginTop: spacing.md, flexWrap: "wrap" },
  adjBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: spacing.lg, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
});
