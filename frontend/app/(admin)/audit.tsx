import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { TText } from "../../src/components/TText";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { api } from "../../src/api";
import { colors, radius, spacing, shadows } from "../../src/theme";

const RIDE_FILTERS = [
  { id: "all", label: "All", val: undefined },
  { id: "requested", label: "Requested", val: "requested" },
  { id: "accepted", label: "Accepted", val: "accepted" },
  { id: "started", label: "Ongoing", val: "started" },
  { id: "completed", label: "Completed", val: "completed" },
  { id: "cancelled", label: "Cancelled", val: "cancelled" },
];
const COMPLAINT_FILTERS = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

type Tab = "rides" | "complaints";

export default function AdminAudit() {
  const [tab, setTab] = useState<Tab>("rides");
  const [rideFilter, setRideFilter] = useState("all");
  const [compFilter, setCompFilter] = useState("open");
  const [rides, setRides] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolveOpen, setResolveOpen] = useState<{ id: string; complaint: any } | null>(null);

  const loadRides = useCallback(async () => {
    const f = RIDE_FILTERS.find((x) => x.id === rideFilter)?.val;
    const qs = f ? `?status_filter=${f}` : "";
    try {
      const r = await api<{ rides: any[] }>(`/admin/audit/rides${qs}`);
      setRides(r.rides || []);
    } catch {}
  }, [rideFilter]);

  const loadComplaints = useCallback(async () => {
    try {
      const r = await api<{ complaints: any[] }>(`/admin/complaints?status_filter=${compFilter}`);
      setComplaints(r.complaints || []);
    } catch {}
  }, [compFilter]);

  const load = useCallback(async () => {
    if (tab === "rides") await loadRides();
    else await loadComplaints();
  }, [tab, loadRides, loadComplaints]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-audit-screen">
      <View style={styles.header}>
        <TText variant="h2">Audit & Complaints</TText>
        <TText variant="bodySm" muted>Government-grade tracking</TText>
        <View style={styles.tabsRow}>
          <TopTab label="Rides" active={tab === "rides"} onPress={() => setTab("rides")} icon="navigation" testID="admin-audit-tab-rides" />
          <TopTab
            label={`Complaints (${complaints.filter((c) => c.status === "open").length || ""})`}
            active={tab === "complaints"}
            onPress={() => setTab("complaints")}
            icon="alert-circle"
            testID="admin-audit-tab-complaints"
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(tab === "rides" ? RIDE_FILTERS : COMPLAINT_FILTERS).map((f: any) => {
          const active = tab === "rides" ? rideFilter === f.id : compFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => (tab === "rides" ? setRideFilter(f.id) : setCompFilter(f.id))}
              style={[styles.chip, active && { backgroundColor: colors.primary }]}
              testID={`admin-audit-filter-${f.id}`}
            >
              <TText variant="bodySm" weight="700" color={active ? colors.textInverse : colors.text}>
                {f.label}
              </TText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        {tab === "rides" ? (
          rides.length === 0 ? (
            <Empty icon="search" label="No rides found" />
          ) : (
            rides.map((r) => (
              <RideCard key={r.id} ride={r} expanded={expanded === r.id} onPress={() => setExpanded(expanded === r.id ? null : r.id)} />
            ))
          )
        ) : (
          complaints.length === 0 ? (
            <Empty icon="check-circle" label={`No ${compFilter === "open" ? "open" : compFilter} complaints`} />
          ) : (
            complaints.map((c) => (
              <ComplaintCard
                key={c.id}
                complaint={c}
                onResolve={() => setResolveOpen({ id: c.id, complaint: c })}
              />
            ))
          )
        )}
      </ScrollView>

      <ResolveModal
        state={resolveOpen}
        onClose={() => setResolveOpen(null)}
        onSaved={() => { setResolveOpen(null); loadComplaints(); }}
      />
    </SafeAreaView>
  );
}

function TopTab({ label, active, onPress, icon, testID }: any) {
  return (
    <TouchableOpacity onPress={onPress} testID={testID} style={[styles.topTab, active && styles.topTabActive]} activeOpacity={0.85}>
      <Feather name={icon} size={14} color={active ? colors.primaryDark : colors.textMuted} />
      <TText variant="bodySm" weight={active ? "700" : "500"} color={active ? colors.primaryDark : colors.text} style={{ marginLeft: 6 }}>
        {label}
      </TText>
    </TouchableOpacity>
  );
}

function Empty({ icon, label }: any) {
  return (
    <Card flat style={{ alignItems: "center", paddingVertical: spacing.xl }}>
      <Feather name={icon} size={28} color={colors.textMuted} />
      <TText variant="bodyLg" weight="700" style={{ marginTop: 8 }}>{label}</TText>
    </Card>
  );
}

function RideCard({ ride, expanded, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Card style={{ marginBottom: spacing.md }} testID={`audit-ride-${ride.id}`}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <TText variant="caption" muted>RIDE {ride.id.slice(0, 8).toUpperCase()}</TText>
            <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>{labelFor(ride.type)}</TText>
            <TText variant="bodySm" muted style={{ marginTop: 2 }}>
              {new Date(ride.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </TText>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <TText variant="h3">₹{ride.fare}</TText>
            <View style={{ marginTop: 4 }}><StatusPill status={ride.status} /></View>
          </View>
        </View>
        {expanded && (
          <View style={styles.expanded}>
            <KV label="Passenger" val={`${ride.passenger_name} (+91 ${ride.passenger_phone})`} />
            <KV label="Driver" val={ride.driver_id ? `${ride.driver_name} (+91 ${ride.driver_phone})` : "Not assigned"} />
            <KV label="Vehicle" val={ride.driver_vehicle_no || "—"} />
            {ride.pickup && <KV label="Pickup" val={ride.pickup.name} />}
            {ride.drop && <KV label="Drop" val={ride.drop.name} />}
            <KV label="Payment" val={(ride.payment_method || "").toUpperCase()} />
            <KV label="Commission" val={`₹${ride.commission} (${(ride.commission / ride.fare * 100).toFixed(1)}%)`} />
            {ride.cancel_reason && <KV label="Cancel reason" val={`${ride.cancel_reason} (by ${ride.cancelled_by})`} />}
            <TText variant="caption" muted style={{ marginTop: 12 }}>EVENT TIMELINE</TText>
            {(ride.audit_log || []).map((ev: any, i: number) => (
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
  );
}

function ComplaintCard({ complaint, onResolve }: any) {
  const statusColor =
    complaint.status === "open" ? colors.warning :
    complaint.status === "resolved" ? colors.success : colors.error;
  return (
    <Card style={{ marginBottom: spacing.md }} testID={`audit-complaint-${complaint.id}`}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <TText variant="caption" muted>COMPLAINT {complaint.id.slice(0, 8).toUpperCase()}</TText>
          <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>{categoryLabel(complaint.category)}</TText>
          <TText variant="bodySm" style={{ marginTop: 4 }} numberOfLines={3}>{complaint.description}</TText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20", borderColor: statusColor + "60" }]}>
          <TText variant="caption" weight="700" color={statusColor}>{complaint.status.toUpperCase()}</TText>
        </View>
      </View>
      <View style={styles.complaintMeta}>
        <Feather name="user" size={12} color={colors.textMuted} />
        <TText variant="caption" muted style={{ marginLeft: 4 }}>
          Filed by {complaint.by_role} · Against {complaint.against || "—"}
        </TText>
      </View>
      {complaint.ride && (
        <View style={styles.complaintMeta}>
          <Feather name="navigation" size={12} color={colors.textMuted} />
          <TText variant="caption" muted style={{ marginLeft: 4 }}>
            Ride: {complaint.ride.passenger_name} → {complaint.ride.driver_name || "no driver"} · ₹{complaint.ride.fare}
          </TText>
        </View>
      )}
      <View style={styles.complaintMeta}>
        <Feather name="clock" size={12} color={colors.textMuted} />
        <TText variant="caption" muted style={{ marginLeft: 4 }}>
          {new Date(complaint.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
        </TText>
      </View>
      {complaint.resolution && (
        <View style={styles.resolutionBox}>
          <Feather name="check" size={12} color={colors.success} />
          <TText variant="caption" style={{ marginLeft: 6, flex: 1 }}>{complaint.resolution}</TText>
        </View>
      )}
      {complaint.status === "open" && (
        <TouchableOpacity onPress={onResolve} style={styles.resolveBtn} testID={`admin-complaint-resolve-${complaint.id}`}>
          <Feather name="edit-3" size={14} color={colors.primaryDark} />
          <TText variant="bodySm" weight="700" color={colors.primaryDark} style={{ marginLeft: 6 }}>
            Resolve or reject
          </TText>
        </TouchableOpacity>
      )}
    </Card>
  );
}

function ResolveModal({ state, onClose, onSaved }: any) {
  const [resolution, setResolution] = useState("");
  const [decision, setDecision] = useState<"resolved" | "rejected">("resolved");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (state) {
      setResolution("");
      setDecision("resolved");
    }
  }, [state]);

  const save = async () => {
    if (resolution.trim().length < 5) {
      Alert.alert("Add notes", "Please describe what action you took");
      return;
    }
    setSaving(true);
    try {
      await api(`/admin/complaints/${state.id}`, {
        method: "PATCH",
        body: { resolution: resolution.trim(), status: decision },
      });
      onSaved();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!state} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={{ padding: spacing.lg }}>
            <TText variant="h3">Resolve complaint</TText>
            <TText variant="bodySm" muted style={{ marginTop: 4 }}>
              {state?.complaint && categoryLabel(state.complaint.category)}
            </TText>
            <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.md }}>
              <TouchableOpacity
                onPress={() => setDecision("resolved")}
                style={[styles.decBtn, decision === "resolved" && { borderColor: colors.success, backgroundColor: colors.successBg }]}
                testID="admin-complaint-decision-resolved"
              >
                <Feather name="check-circle" size={16} color={decision === "resolved" ? colors.success : colors.textMuted} />
                <TText variant="bodySm" weight="700" color={decision === "resolved" ? colors.success : colors.text} style={{ marginLeft: 8 }}>Resolved</TText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDecision("rejected")}
                style={[styles.decBtn, decision === "rejected" && { borderColor: colors.error, backgroundColor: colors.errorBg }]}
                testID="admin-complaint-decision-rejected"
              >
                <Feather name="x-circle" size={16} color={decision === "rejected" ? colors.error : colors.textMuted} />
                <TText variant="bodySm" weight="700" color={decision === "rejected" ? colors.error : colors.text} style={{ marginLeft: 8 }}>Reject</TText>
              </TouchableOpacity>
            </View>
            <View style={styles.resInputBox}>
              <TextInput
                value={resolution}
                onChangeText={setResolution}
                placeholder="Action taken / reason"
                placeholderTextColor={colors.textMuted}
                multiline
                style={styles.resInput}
                testID="admin-complaint-resolution-input"
              />
            </View>
            <TButton label="Submit" onPress={save} loading={saving} testID="admin-complaint-save-btn" style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function categoryLabel(c: string) {
  const map: Record<string, string> = {
    rash_driving: "Rash driving",
    rude_behaviour: "Rude behaviour",
    overcharge: "Overcharging",
    vehicle_unsafe: "Unsafe vehicle",
    no_show: "Did not show up",
    wrong_route: "Wrong route taken",
    payment_issue: "Payment issue",
    lost_item: "Lost item",
    other: "Other",
  };
  return map[c] || c;
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
  tabsRow: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  topTab: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  topTabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary + "40" },
  filterRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  expanded: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  kvRow: { flexDirection: "row", paddingVertical: 4 },
  event: { flexDirection: "row", alignItems: "flex-start", marginTop: 8 },
  evtDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  complaintMeta: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  resolutionBox: { flexDirection: "row", alignItems: "flex-start", padding: 10, borderRadius: radius.sm, backgroundColor: colors.successBg, marginTop: 10 },
  resolveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 10, marginTop: 10, borderRadius: radius.pill, backgroundColor: colors.primaryLight },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadows.lg },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 10 },
  decBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  resInputBox: { marginTop: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  resInput: { padding: 12, minHeight: 80, color: colors.text, fontSize: 14, textAlignVertical: "top" },
});
