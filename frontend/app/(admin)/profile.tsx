import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { TText } from "../../src/components/TText";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, radius, spacing } from "../../src/theme";

export default function AdminProfile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const w = await api<{ withdrawals: any[] }>("/admin/withdrawals");
      setWithdrawals(w.withdrawals || []);
      const s = await api<{ suggestions: any[] }>("/suggestions");
      setSuggestions(s.suggestions || []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markPaid = async (id: string) => {
    try {
      await api(`/admin/withdrawals/${id}/mark-paid`, { method: "POST" });
      load();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    }
  };

  const applySuggestion = async (id: string) => {
    Alert.alert("Apply this fare suggestion?", "It will become the new active fare", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Apply",
        onPress: async () => {
          try {
            await api(`/admin/suggestions/${id}/apply`, { method: "POST" });
            Alert.alert("Applied");
            load();
          } catch (e: any) {
            Alert.alert("Failed", e.message);
          }
        },
      },
    ]);
  };

  const logout = async () => {
    await signOut();
    router.replace("/role-select");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-profile-screen">
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        <View style={styles.heroHeader}>
          <View style={styles.bigAvatar}>
            <Feather name="shield" size={32} color={colors.primaryDark} />
          </View>
          <TText variant="h2" align="center" style={{ marginTop: spacing.md }}>{user?.name || "TirthRide Admin"}</TText>
          <TText variant="bodySm" muted align="center">+91 {user?.phone}</TText>
        </View>

        <TText variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Withdrawal requests</TText>
        {withdrawals.length === 0 ? (
          <Card flat style={{ alignItems: "center", paddingVertical: spacing.lg }}>
            <TText variant="bodySm" muted>No withdrawal requests</TText>
          </Card>
        ) : (
          withdrawals.map((w) => (
            <Card key={w.id} style={{ marginBottom: spacing.md }} testID={`withdrawal-${w.id}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <TText variant="bodyLg" weight="700">₹{w.amount}</TText>
                  <TText variant="bodySm" muted>{w.upi_id}</TText>
                  <TText variant="caption" muted>{new Date(w.requested_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</TText>
                </View>
                {w.status === "paid" ? (
                  <View style={[styles.badge, { backgroundColor: colors.successBg }]}>
                    <TText variant="caption" color={colors.success}>PAID</TText>
                  </View>
                ) : (
                  <TButton label="Mark paid" small fullWidth={false} onPress={() => markPaid(w.id)} testID={`mark-paid-${w.id}`} />
                )}
              </View>
            </Card>
          ))
        )}

        <TText variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Fare suggestions</TText>
        {suggestions.length === 0 ? (
          <Card flat style={{ alignItems: "center", paddingVertical: spacing.lg }}>
            <TText variant="bodySm" muted>No active suggestions</TText>
          </Card>
        ) : (
          suggestions.map((s) => (
            <Card key={s.id} style={{ marginBottom: spacing.md }} testID={`admin-suggestion-${s.id}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <TText variant="caption" muted>{s.ride_type}</TText>
                  <TText variant="bodyLg" weight="700" style={{ marginTop: 2 }}>₹{s.amount}</TText>
                  <TText variant="bodySm" muted>By {s.driver_name}</TText>
                  <View style={{ flexDirection: "row", marginTop: 6, gap: 12 }}>
                    <TText variant="caption" color={colors.success}>↑ {s.votes_up} up</TText>
                    <TText variant="caption" color={colors.error}>↓ {s.votes_down} down</TText>
                  </View>
                </View>
                <TButton label="Apply" small fullWidth={false} onPress={() => applySuggestion(s.id)} testID={`apply-suggestion-${s.id}`} />
              </View>
            </Card>
          ))
        )}

        <TButton
          label="Sign out"
          variant="outline"
          onPress={logout}
          icon={<Feather name="log-out" size={16} color={colors.text} />}
          testID="admin-signout-btn"
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  heroHeader: { alignItems: "center" },
  bigAvatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
});
