import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { TText } from "../../src/components/TText";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { api } from "../../src/api";
import { colors, radius, spacing } from "../../src/theme";

const FILTERS = [
  { id: "all", label: "All", val: undefined },
  { id: "requested", label: "Requested", val: "requested" },
  { id: "accepted", label: "Accepted", val: "accepted" },
  { id: "started", label: "Ongoing", val: "started" },
  { id: "completed", label: "Completed", val: "completed" },
  { id: "cancelled", label: "Cancelled", val: "cancelled" },
];

export default function AdminAudit() {
  const [filter, setFilter] = useState("all");
  const [rides, setRides] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const f = FILTERS.find((x) => x.id === filter)?.val;
      const qs = f ? `?status_filter=${f}` : "";
      const r = await api<{ rides: any[] }>(`/admin/audit/rides${qs}`);
      setRides(r.rides || []);
    } catch {}
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-audit-screen">
      <View style={styles.header}>
        <TText variant="h2">Ride Audit Log</TText>
        <TText variant="bodySm" muted>Government-grade ride tracking</TText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[styles.chip, filter === f.id && { backgroundColor: colors.primary }]}
            testID={`admin-audit-filter-${f.id}`}
          >
            <TText variant="bodySm" weight="700" color={filter === f.id ? colors.textInverse : colors.text}>
              {f.label}
            </TText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        {rides.length === 0 ? (
          <Card flat style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <Feather name="search" size={28} color={colors.textMuted} />
            <TText variant="bodyLg" weight="700" style={{ marginTop: 8 }}>No rides found</TText>
          </Card>
        ) : (
          rides.map((r) => (
            <TouchableOpacity key={r.id} onPress={() => setExpanded(expanded === r.id ? null : r.id)} activeOpacity={0.85}>
              <Card style={{ marginBottom: spacing.md }} testID={`audit-ride-${r.id}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <TText variant="caption" muted>RIDE {r.id.slice(0, 8).toUpperCase()}</TText>
                    <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>{labelFor(r.type)}</TText>
                    <TText variant="bodySm" muted style={{ marginTop: 2 }}>
                      {new Date(r.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </TText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <TText variant="h3">₹{r.fare}</TText>
                    <View style={{ marginTop: 4 }}><StatusPill status={r.status} /></View>
                  </View>
                </View>

                {expanded === r.id && (
                  <View style={styles.expanded}>
                    <KV label="Passenger" val={`${r.passenger_name} (+91 ${r.passenger_phone})`} />
                    <KV label="Driver" val={r.driver_id ? `${r.driver_name} (+91 ${r.driver_phone})` : "Not assigned"} />
                    <KV label="Vehicle" val={r.driver_vehicle_no || "—"} />
                    {r.pickup && <KV label="Pickup" val={r.pickup.name} />}
                    {r.drop && <KV label="Drop" val={r.drop.name} />}
                    <KV label="Payment" val={(r.payment_method || "").toUpperCase()} />
                    <KV label="Commission" val={`₹${r.commission} (${(r.commission / r.fare * 100).toFixed(1)}%)`} />
                    {r.cancel_reason && <KV label="Cancel reason" val={`${r.cancel_reason} (by ${r.cancelled_by})`} />}
                    <TText variant="caption" muted style={{ marginTop: 12 }}>EVENT TIMELINE</TText>
                    {(r.audit_log || []).map((ev: any, i: number) => (
                      <View key={i} style={styles.event}>
                        <View style={[styles.evtDot, { backgroundColor: colors.primary }]} />
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <TText variant="bodySm" weight="600">{ev.event.toUpperCase()}{ev.reason ? ` · ${ev.reason}` : ""}</TText>
                          <TText variant="caption" muted>{new Date(ev.at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}{ev.role ? ` · by ${ev.role}` : ""}</TText>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function KV({ label, val }: any) {
  return (
    <View style={styles.kvRow}>
      <TText variant="caption" muted style={{ width: 110 }}>{label}</TText>
      <TText variant="bodySm" weight="600" style={{ flex: 1 }}>{val}</TText>
    </View>
  );
}

function labelFor(t: string) {
  return ({ local: "Local Ride", poochari: "Poochari Parikrama", radhakund: "Radhakund Parikrama", combined: "Combined Parikrama" } as any)[t] || t;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: 0 },
  filterRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  expanded: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  kvRow: { flexDirection: "row", paddingVertical: 4 },
  event: { flexDirection: "row", alignItems: "flex-start", marginTop: 8 },
  evtDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
