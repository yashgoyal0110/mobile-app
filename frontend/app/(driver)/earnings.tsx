import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, RefreshControl, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { TText } from "../../src/components/TText";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, radius, spacing } from "../../src/theme";

export default function Earnings() {
  const { driver } = useAuth();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api<any>("/drivers/earnings");
      setData(d);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const withdraw = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      Alert.alert("Enter amount");
      return;
    }
    try {
      await api("/drivers/withdraw", { method: "POST", body: { amount: n } });
      setWithdrawOpen(false);
      setAmount("");
      Alert.alert("Withdrawal requested", "Admin will process the UPI transfer soon.");
      load();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-earnings-screen">
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        <TText variant="h2">Earnings</TText>
        <TText variant="bodySm" muted style={{ marginTop: 4 }}>{driver?.upi_id || "Add UPI in KYC to withdraw"}</TText>

        <Card style={{ marginTop: spacing.lg, backgroundColor: colors.primaryLight, borderColor: colors.primary + "40" }}>
          <TText variant="caption" color={colors.primaryDark}>WITHDRAWABLE BALANCE</TText>
          <TText variant="h1" color={colors.primaryDark} style={{ marginTop: 4 }}>
            ₹{Math.round((data?.balance) ?? 0)}
          </TText>
          <View style={styles.split}>
            <View style={{ flex: 1 }}>
              <TText variant="caption" muted>EARNED</TText>
              <TText variant="h3">₹{Math.round((data?.total) ?? 0)}</TText>
            </View>
            <View style={{ flex: 1 }}>
              <TText variant="caption" muted>WITHDRAWN</TText>
              <TText variant="h3">₹{Math.round((data?.withdrawn) ?? 0)}</TText>
            </View>
          </View>
          <TButton
            label="Withdraw to UPI"
            onPress={() => setWithdrawOpen(true)}
            disabled={!data || data.balance <= 0}
            testID="driver-withdraw-btn"
            icon={<Feather name="send" size={16} color={colors.textInverse} />}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <TText variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Recent completed</TText>
        {(data?.completed_rides || []).slice(0, 5).map((r: any) => (
          <Card key={r.id} style={{ marginBottom: spacing.md }} flat>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View>
                <TText variant="bodyLg" weight="700">{labelFor(r.type)}</TText>
                <TText variant="bodySm" muted>{new Date(r.completed_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</TText>
                <View style={{ marginTop: 6 }}>
                  <StatusPill status={r.status} />
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <TText variant="h3" color={colors.success}>+₹{r.driver_earning}</TText>
                <TText variant="caption" muted>From ₹{r.fare} fare</TText>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Withdraw modal */}
      <Modal visible={withdrawOpen} transparent animationType="slide" onRequestClose={() => setWithdrawOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={{ padding: spacing.lg }}>
              <TText variant="h3">Withdraw to UPI</TText>
              <TText variant="bodySm" muted style={{ marginTop: 4 }}>{driver?.upi_id}</TText>
              <View style={{ marginTop: spacing.md }}>
                <TText variant="bodySm" muted>Amount</TText>
                <View style={styles.bigInputWrap}>
                  <TText variant="h2">₹</TText>
                  <TextInput
                    value={amount}
                    onChangeText={(v) => setAmount(v.replace(/\D/g, ""))}
                    placeholder="0"
                    keyboardType="number-pad"
                    style={styles.bigInput}
                    testID="withdraw-amount-input"
                  />
                </View>
                <TText variant="bodySm" muted style={{ marginTop: 8 }}>Available: ₹{Math.round(data?.balance ?? 0)}</TText>
              </View>
              <TButton label="Request withdrawal" onPress={withdraw} testID="withdraw-confirm-btn" style={{ marginTop: spacing.lg }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function labelFor(t: string) {
  return ({ local: "Local Ride", poochari: "Poochari Parikrama", radhakund: "Radhakund Parikrama", combined: "Combined Parikrama" } as any)[t] || t;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  split: { flexDirection: "row", marginTop: spacing.md, gap: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 10 },
  bigInputWrap: { flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.bg },
  bigInput: { flex: 1, fontSize: 32, fontWeight: "700", color: colors.text, paddingVertical: 0, marginLeft: 8 },
});
