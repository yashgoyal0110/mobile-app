import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { TText } from "../../src/components/TText";
import { TInput } from "../../src/components/TInput";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { notify, confirmDialog } from "../../src/utils/dialog";
import { colors, radius, spacing } from "../../src/theme";

export default function DriverProfile() {
  const router = useRouter();
  const { user, driver, signOut, refresh } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("/users/me", { method: "PATCH", body: { name } });
      await refresh();
      notify("Saved");
    } catch (e: any) {
      notify("Failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    confirmDialog(
      "Sign out?",
      "You'll need OTP to log back in",
      async () => {
        await signOut();
        router.replace("/role-select");
      },
      { confirmLabel: "Sign out", destructive: true }
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-profile-screen">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        <View style={styles.heroHeader}>
          <View style={styles.bigAvatar}>
            <Feather name="truck" size={32} color={colors.primaryDark} />
          </View>
          <TText variant="h2" align="center" style={{ marginTop: spacing.md }}>{user?.name || "Driver"}</TText>
          <TText variant="bodySm" muted align="center">+91 {user?.phone}</TText>
          {driver?.vehicle_no && (
            <View style={styles.vehiclePill}>
              <Feather name="truck" size={12} color={colors.primaryDark} />
              <TText variant="caption" color={colors.primaryDark} style={{ marginLeft: 4 }}>{driver.vehicle_no}</TText>
            </View>
          )}
        </View>

        <Card style={{ marginTop: spacing.xl }}>
          <TText variant="caption" muted>PROFILE</TText>
          <View style={{ marginTop: spacing.md }}>
            <TInput label="Full name" value={name} onChangeText={setName} testID="driver-profile-name" />
            <TButton label="Save" onPress={save} loading={saving} testID="driver-profile-save" />
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }} flat>
          <Row icon="shield" label="KYC status" value={(driver?.kyc_status || "").replace("_", " ").toUpperCase()} />
          <Row icon="credit-card" label="UPI ID" value={driver?.upi_id || "—"} />
          <Row icon="truck" label="Vehicle" value={driver?.vehicle_no || "—"} />
          <Row icon="hash" label="Aadhar" value={driver?.aadhar_number ? `**** **** ${driver.aadhar_number.slice(-4)}` : "—"} />
        </Card>

        <TButton
          label="Sign out"
          variant="outline"
          onPress={logout}
          icon={<Feather name="log-out" size={16} color={colors.text} />}
          testID="driver-profile-signout"
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value }: any) {
  return (
    <View style={styles.row}>
      <Feather name={icon} size={18} color={colors.textMuted} />
      <TText variant="body" muted style={{ flex: 1, marginLeft: spacing.md }}>{label}</TText>
      <TText variant="bodySm" weight="600">{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  heroHeader: { alignItems: "center", paddingTop: spacing.lg },
  bigAvatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  vehiclePill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 4, backgroundColor: colors.primaryLight, borderRadius: radius.pill, marginTop: 10 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
});
