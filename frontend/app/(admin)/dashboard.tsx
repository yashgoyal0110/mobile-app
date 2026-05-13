import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { TText } from "../../src/components/TText";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { colors, radius, spacing } from "../../src/theme";

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<any>("/admin/dashboard");
      setStats(s);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-dashboard-screen">
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        <View>
          <TText variant="caption" muted>ADMIN CONTROL</TText>
          <TText variant="h1" style={{ marginTop: 2 }}>TirthRide HQ</TText>
          <TText variant="bodySm" muted style={{ marginTop: 4 }}>Govardhan operations dashboard</TText>
        </View>

        <View style={styles.metricGrid}>
          <Metric label="RIDES TODAY" value={stats?.rides_today ?? "—"} icon="navigation" color={colors.primary} />
          <Metric label="TOTAL RIDES" value={stats?.total_rides ?? "—"} icon="repeat" color={colors.info} />
          <Metric label="ACTIVE DRIVERS" value={stats?.active_drivers ?? "—"} icon="users" color={colors.success} />
          <Metric label="PENDING KYC" value={stats?.pending_approvals ?? "—"} icon="clock" color={colors.warning} />
        </View>

        <Card style={{ marginTop: spacing.md, backgroundColor: colors.primaryLight, borderColor: colors.primary + "30" }}>
          <TText variant="caption" color={colors.primaryDark}>PLATFORM REVENUE</TText>
          <TText variant="h1" color={colors.primaryDark} style={{ marginTop: 4 }}>₹{stats?.platform_revenue ?? "—"}</TText>
          <TText variant="bodySm" muted style={{ marginTop: 4 }}>
            From {stats?.total_fare_processed ? `₹${stats.total_fare_processed} ` : ""}total fare processed
          </TText>
        </Card>

        <TText variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Quick actions</TText>
        <Action icon="user-check" label="Driver approvals" desc={`${stats?.pending_approvals ?? 0} pending`} onPress={() => router.push("/(admin)/drivers")} testID="admin-quick-drivers" />
        <Action icon="dollar-sign" label="Update fares" desc="Configure prices & commission" onPress={() => router.push("/(admin)/fares")} testID="admin-quick-fares" />
        <Action icon="file-text" label="Ride audit log" desc="Search & review all rides" onPress={() => router.push("/(admin)/audit")} testID="admin-quick-audit" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, icon, color }: any) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <TText variant="caption" muted style={{ marginTop: 8 }}>{label}</TText>
      <TText variant="h2" style={{ marginTop: 4 }}>{value}</TText>
    </View>
  );
}

function Action({ icon, label, desc, onPress, testID }: any) {
  return (
    <TouchableOpacity onPress={onPress} testID={testID} activeOpacity={0.85}>
      <Card style={{ marginBottom: spacing.md, flexDirection: "row", alignItems: "center" }}>
        <View style={styles.actionIcon}><Feather name={icon} size={20} color={colors.primaryDark} /></View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <TText variant="bodyLg" weight="700">{label}</TText>
          <TText variant="bodySm" muted>{desc}</TText>
        </View>
        <Feather name="chevron-right" size={20} color={colors.textMuted} />
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: spacing.lg },
  metric: {
    width: "47.5%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  actionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
});
