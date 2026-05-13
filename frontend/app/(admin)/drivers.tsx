import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { TText } from "../../src/components/TText";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { colors, radius, spacing } from "../../src/theme";

const FILTERS = [
  { id: "all", label: "All", val: undefined },
  { id: "pending", label: "Pending", val: "pending" },
  { id: "approved", label: "Approved", val: "approved" },
  { id: "rejected", label: "Rejected", val: "rejected" },
];

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const f = FILTERS.find((x) => x.id === filter)?.val;
      const qs = f ? `?status_filter=${f}` : "";
      const r = await api<{ drivers: any[] }>(`/admin/drivers${qs}`);
      setDrivers(r.drivers || []);
    } catch {}
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const approve = async (id: string) => {
    try {
      await api(`/admin/drivers/${id}/approve`, { method: "POST" });
      load();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    }
  };
  const reject = async (id: string) => {
    Alert.alert("Reject driver?", "They'll need to re-submit KYC", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/admin/drivers/${id}/reject`, { method: "POST", body: { reason: "Documents not verified" } });
            load();
          } catch (e: any) {
            Alert.alert("Failed", e.message);
          }
        },
      },
    ]);
  };

  const statusColor = (s: string) =>
    s === "approved" ? colors.success :
    s === "pending" ? colors.warning :
    s === "rejected" ? colors.error : colors.textMuted;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-drivers-screen">
      <View style={styles.header}>
        <TText variant="h2">Drivers</TText>
        <TText variant="bodySm" muted>{drivers.length} drivers</TText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[styles.chip, filter === f.id && { backgroundColor: colors.primary }]}
            testID={`admin-driver-filter-${f.id}`}
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
        {drivers.length === 0 ? (
          <Card flat style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <Feather name="inbox" size={28} color={colors.textMuted} />
            <TText variant="bodyLg" weight="700" style={{ marginTop: 8 }}>No drivers in this list</TText>
          </Card>
        ) : (
          drivers.map((d) => (
            <Card key={d.id} style={{ marginBottom: spacing.md }} testID={`admin-driver-${d.user_id}`}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.avatar}><Feather name="user" size={20} color={colors.primaryDark} /></View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <TText variant="bodyLg" weight="700">{d.user?.name || "Unnamed driver"}</TText>
                  <TText variant="bodySm" muted>+91 {d.user?.phone}</TText>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(d.kyc_status) + "20" }]}>
                  <TText variant="caption" color={statusColor(d.kyc_status)}>{(d.kyc_status || "").replace("_", " ").toUpperCase()}</TText>
                </View>
              </View>
              <View style={styles.kvRow}>
                <KV label="Vehicle" val={d.vehicle_no || "—"} />
                <KV label="UPI" val={d.upi_id || "—"} />
                <KV label="Aadhar" val={d.aadhar_number ? `**** ${d.aadhar_number.slice(-4)}` : "—"} />
              </View>
              {d.kyc_status === "pending" && (
                <View style={{ flexDirection: "row", gap: 12, marginTop: spacing.md }}>
                  <TButton label="Reject" variant="outline" onPress={() => reject(d.user_id)} fullWidth={false} style={{ flex: 1 }} testID={`admin-reject-${d.user_id}`} />
                  <TButton label="Approve" onPress={() => approve(d.user_id)} fullWidth={false} style={{ flex: 1 }} testID={`admin-approve-${d.user_id}`} />
                </View>
              )}
              {d.kyc_status === "approved" && (
                <View style={styles.approvedRow}>
                  <Feather name="check-circle" size={14} color={colors.success} />
                  <TText variant="caption" color={colors.success} style={{ marginLeft: 6 }}>
                    {d.online ? "Online & taking rides" : "Offline"}
                  </TText>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function KV({ label, val }: any) {
  return (
    <View style={{ flex: 1 }}>
      <TText variant="caption" muted>{label}</TText>
      <TText variant="bodySm" weight="600" style={{ marginTop: 2 }} numberOfLines={1}>{val}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: 0 },
  filterRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  kvRow: { flexDirection: "row", marginTop: spacing.md, gap: 12 },
  approvedRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
