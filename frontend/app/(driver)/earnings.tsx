import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, RefreshControl, TextInput, TouchableOpacity, Modal } from "react-native";
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

const SUGGEST_TYPES = [
  { id: "local-base", label: "Local — Base fare" },
  { id: "local-per-km", label: "Local — Per km" },
  { id: "poochari", label: "Poochari Parikrama" },
  { id: "radhakund", label: "Radhakund Parikrama" },
  { id: "combined", label: "Combined Parikrama" },
];

export default function Earnings() {
  const { driver } = useAuth();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [stype, setStype] = useState("local-base");
  const [samount, setSamount] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const d = await api<any>("/drivers/earnings");
      setData(d);
      const s = await api<{ suggestions: any[] }>("/suggestions");
      setSuggestions(s.suggestions || []);
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

  const submitSuggestion = async () => {
    const n = Number(samount);
    if (!n) { Alert.alert("Enter an amount"); return; }
    try {
      await api("/suggestions", { method: "POST", body: { ride_type: stype, amount: n } });
      setSuggestOpen(false);
      setSamount("");
      Alert.alert("Submitted", "Other drivers can now vote on your suggestion.");
      load();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    }
  };

  const vote = async (id: string, v: "up" | "down") => {
    try {
      await api(`/suggestions/${id}/vote`, { method: "POST", body: { vote: v } });
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

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.sm }}>
          <TText variant="h3">Fare suggestions</TText>
          <TouchableOpacity onPress={() => setSuggestOpen(true)} testID="driver-suggest-fare-btn">
            <TText variant="bodySm" color={colors.primary} weight="700">+ Suggest</TText>
          </TouchableOpacity>
        </View>
        <TText variant="bodySm" muted style={{ marginBottom: spacing.md }}>
          Vote on drivers' fare proposals. Admin reviews top voted.
        </TText>

        {suggestions.length === 0 ? (
          <Card flat style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <Feather name="message-square" size={24} color={colors.textMuted} />
            <TText variant="bodySm" muted style={{ marginTop: 8 }}>No active suggestions</TText>
          </Card>
        ) : (
          suggestions.map((s) => (
            <Card key={s.id} style={{ marginBottom: spacing.md }} testID={`suggestion-${s.id}`}>
              <TText variant="caption" muted>{SUGGEST_TYPES.find((t) => t.id === s.ride_type)?.label || s.ride_type}</TText>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <View>
                  <TText variant="bodyLg" weight="700">₹{s.amount}</TText>
                  <TText variant="bodySm" muted>By {s.driver_name}</TText>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity style={styles.voteBtn} onPress={() => vote(s.id, "up")} testID={`vote-up-${s.id}`}>
                    <Feather name="thumbs-up" size={14} color={colors.success} />
                    <TText variant="bodySm" weight="700" style={{ marginLeft: 4 }}>{s.votes_up}</TText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.voteBtn} onPress={() => vote(s.id, "down")} testID={`vote-down-${s.id}`}>
                    <Feather name="thumbs-down" size={14} color={colors.error} />
                    <TText variant="bodySm" weight="700" style={{ marginLeft: 4 }}>{s.votes_down}</TText>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))
        )}

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

      {/* Suggest modal */}
      <Modal visible={suggestOpen} transparent animationType="slide" onRequestClose={() => setSuggestOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={{ padding: spacing.lg }}>
              <TText variant="h3">Suggest a fare</TText>
              <View style={{ marginTop: spacing.md }}>
                {SUGGEST_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setStype(t.id)}
                    style={[styles.typeRow, stype === t.id && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                    testID={`suggest-type-${t.id}`}
                  >
                    <TText variant="body">{t.label}</TText>
                    {stype === t.id && <Feather name="check" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.bigInputWrap, { marginTop: spacing.md }]}>
                <TText variant="h2">₹</TText>
                <TextInput
                  value={samount}
                  onChangeText={(v) => setSamount(v.replace(/\D/g, ""))}
                  placeholder="0"
                  keyboardType="number-pad"
                  style={styles.bigInput}
                  testID="suggest-amount-input"
                />
              </View>
              <TButton label="Submit suggestion" onPress={submitSuggestion} testID="suggest-confirm-btn" style={{ marginTop: spacing.lg }} />
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
  voteBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 10 },
  bigInputWrap: { flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.bg },
  bigInput: { flex: 1, fontSize: 32, fontWeight: "700", color: colors.text, paddingVertical: 0, marginLeft: 8 },
  typeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
});
