import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Dimensions, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { LineChart, BarChart } from "react-native-chart-kit";
import { TText } from "../../src/components/TText";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { colors, radius, spacing, shadows } from "../../src/theme";

const SCREEN_W = Dimensions.get("window").width;
const CHART_W = Math.max(280, Math.min(SCREEN_W - 32, 480));

const chartConfig = {
  backgroundColor: colors.surface,
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (op = 1) => `rgba(229, 148, 77, ${op})`,
  labelColor: (op = 1) => `rgba(76, 67, 56, ${op})`,
  propsForBackgroundLines: { stroke: colors.border, strokeDasharray: "" as any },
  propsForDots: { r: "4", strokeWidth: "2", stroke: colors.primary },
  style: { borderRadius: 16 },
};

const revenueChartConfig = {
  ...chartConfig,
  color: (op = 1) => `rgba(42, 143, 71, ${op})`,
  propsForDots: { r: "4", strokeWidth: "2", stroke: "#2A8F47" },
};

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [topRoutes, setTopRoutes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState<7 | 14 | 30>(7);

  const load = useCallback(async () => {
    const [s, t, l, tr] = await Promise.allSettled([
      api<any>("/admin/dashboard"),
      api<any>(`/admin/reports/timeseries?days=${days}`),
      api<any>("/admin/reports/leaderboard?limit=5"),
      api<any>("/admin/reports/top-routes?limit=5"),
    ]);
    if (s.status === "fulfilled") setStats(s.value);
    if (t.status === "fulfilled") setSeries(t.value.series || []);
    if (l.status === "fulfilled") setLeaders(l.value.leaderboard || []);
    if (tr.status === "fulfilled") setTopRoutes(tr.value.routes || []);
  }, [days]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const labels = series.map((p) =>
    new Date(p.date + "T00:00:00Z").toLocaleDateString([], { day: "2-digit", month: "short" })
  );
  // Show only every 2nd label if more than 10 to avoid overlap
  const trimmedLabels = labels.length > 10 ? labels.map((l, i) => (i % Math.ceil(labels.length / 7) === 0 ? l : "")) : labels;
  const ridesSeries = series.map((p) => p.rides || 0);
  const revenueSeries = series.map((p) => p.revenue || 0);
  const maxRides = Math.max(1, ...ridesSeries);
  const maxRev = Math.max(1, ...revenueSeries);

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
          <Metric label="OPEN COMPLAINTS" value={stats?.open_complaints ?? "—"} icon="alert-circle" color={colors.error} />
          <Metric label="REVENUE (₹)" value={stats?.platform_revenue ?? "—"} icon="trending-up" color={colors.parikrama} />
        </View>

        <Card style={{ marginTop: spacing.md, backgroundColor: colors.primaryLight, borderColor: colors.primary + "30" }}>
          <TText variant="caption" color={colors.primaryDark}>PLATFORM REVENUE</TText>
          <TText variant="h1" color={colors.primaryDark} style={{ marginTop: 4 }}>₹{stats?.platform_revenue ?? "—"}</TText>
          <TText variant="bodySm" muted style={{ marginTop: 4 }}>
            From {stats?.total_fare_processed ? `₹${stats.total_fare_processed} ` : ""}total fare processed
          </TText>
        </Card>

        {/* Time range chips */}
        <View style={styles.rangeRow}>
          <TText variant="caption" muted>REPORTS</TText>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[7, 14, 30].map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDays(d as any)}
                style={[styles.rangeChip, days === d && styles.rangeChipActive]}
                testID={`admin-range-${d}`}
              >
                <TText variant="caption" weight={days === d ? "700" : "500"} color={days === d ? colors.primaryDark : colors.text}>
                  {d}d
                </TText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Rides per day chart */}
        <Card style={{ marginTop: spacing.md, padding: spacing.md }}>
          <View style={styles.chartHeader}>
            <Feather name="bar-chart-2" size={16} color={colors.primary} />
            <TText variant="bodyLg" weight="700" style={{ marginLeft: 8, flex: 1 }}>Rides per day</TText>
            <TText variant="caption" muted>peak: {maxRides}</TText>
          </View>
          {series.length > 0 && (
            <BarChart
              data={{ labels: trimmedLabels, datasets: [{ data: ridesSeries }] }}
              width={CHART_W}
              height={180}
              yAxisLabel=""
              yAxisSuffix=""
              fromZero
              chartConfig={chartConfig}
              showValuesOnTopOfBars={false}
              withInnerLines={false}
              style={{ marginVertical: 8, borderRadius: radius.md, marginLeft: -16 }}
            />
          )}
        </Card>

        {/* Revenue per day chart */}
        <Card style={{ marginTop: spacing.md, padding: spacing.md }}>
          <View style={styles.chartHeader}>
            <Feather name="trending-up" size={16} color={colors.success} />
            <TText variant="bodyLg" weight="700" style={{ marginLeft: 8, flex: 1 }}>Revenue (₹)</TText>
            <TText variant="caption" muted>peak: ₹{maxRev}</TText>
          </View>
          {series.length > 0 && (
            <LineChart
              data={{ labels: trimmedLabels, datasets: [{ data: revenueSeries }] }}
              width={CHART_W}
              height={180}
              yAxisLabel="₹"
              yAxisSuffix=""
              fromZero
              chartConfig={revenueChartConfig}
              bezier
              withInnerLines={false}
              style={{ marginVertical: 8, borderRadius: radius.md, marginLeft: -16 }}
            />
          )}
        </Card>

        {/* Driver leaderboard */}
        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.chartHeader}>
            <Feather name="award" size={16} color={colors.parikrama} />
            <TText variant="bodyLg" weight="700" style={{ marginLeft: 8 }}>Top Drivers</TText>
          </View>
          {leaders.length === 0 ? (
            <TText variant="bodySm" muted style={{ marginTop: 8 }}>No completed rides yet</TText>
          ) : (
            leaders.map((d, i) => (
              <View key={d.driver_id || i} style={styles.leaderRow}>
                <View style={[styles.rank, { backgroundColor: i === 0 ? "#FFD180" : colors.bg }]}>
                  <TText variant="caption" weight="700">{i + 1}</TText>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <TText variant="body" weight="700" numberOfLines={1}>{d.name || d.driver_id?.slice(0, 8)}</TText>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                    <TText variant="caption" muted>{d.trips} trips</TText>
                    {d.avg_rating ? (
                      <>
                        <TText variant="caption" muted style={{ marginHorizontal: 6 }}>·</TText>
                        <Feather name="star" size={10} color={colors.parikrama} />
                        <TText variant="caption" weight="600" style={{ marginLeft: 2 }}>{d.avg_rating.toFixed(1)}</TText>
                      </>
                    ) : null}
                  </View>
                </View>
                <TText variant="body" weight="700" color={colors.success}>₹{d.earnings}</TText>
              </View>
            ))
          )}
        </Card>

        {/* Top routes */}
        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.chartHeader}>
            <Feather name="map" size={16} color={colors.info} />
            <TText variant="bodyLg" weight="700" style={{ marginLeft: 8 }}>Popular routes</TText>
          </View>
          {topRoutes.length === 0 ? (
            <TText variant="bodySm" muted style={{ marginTop: 8 }}>Local routes will appear after rides complete</TText>
          ) : (
            topRoutes.map((r, i) => (
              <View key={i} style={styles.routeRow}>
                <View style={styles.routeIcon}>
                  <Feather name="trending-up" size={14} color={colors.info} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <TText variant="bodySm" weight="700" numberOfLines={1}>{r.pickup}  →  {r.drop}</TText>
                  <TText variant="caption" muted>{r.count} trips · ₹{r.fare} total</TText>
                </View>
              </View>
            ))
          )}
        </Card>

        <TText variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Quick actions</TText>
        <Action icon="user-check" label="Driver approvals" desc={`${stats?.pending_approvals ?? 0} pending`} onPress={() => router.push("/(admin)/drivers")} testID="admin-quick-drivers" />
        <Action icon="dollar-sign" label="Update config" desc="Fares, landmarks, dispatch radius" onPress={() => router.push("/(admin)/fares")} testID="admin-quick-fares" />
        <Action icon="file-text" label="Ride audit & complaints" desc={`${stats?.open_complaints ?? 0} open complaints`} onPress={() => router.push("/(admin)/audit")} testID="admin-quick-audit" />
        <Action icon="home" label="Dharamshalas & stays" desc="Add, verify & manage pilgrim stays" onPress={() => router.push("/(admin)/stays")} testID="admin-quick-stays" />
        <Action icon="map-pin" label="Temples & darshan" desc="Timings, aarti & crowd updates" onPress={() => router.push("/(admin)/temples")} testID="admin-quick-temples" />
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
  rangeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl },
  rangeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rangeChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary + "40" },
  chartHeader: { flexDirection: "row", alignItems: "center" },
  leaderRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 },
  rank: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  routeRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 },
  routeIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.infoBg, alignItems: "center", justifyContent: "center" },
});
