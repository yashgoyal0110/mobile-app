import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { TText } from "../../src/components/TText";
import { TInput } from "../../src/components/TInput";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { colors, radius, spacing } from "../../src/theme";

const FIELDS = [
  { key: "base_fare", label: "Local base fare (₹)", icon: "play" as const },
  { key: "per_km", label: "Local per km (₹)", icon: "trending-up" as const },
  { key: "poochari_fare", label: "Poochari Parikrama (₹)", icon: "compass" as const },
  { key: "radhakund_fare", label: "Radhakund Parikrama (₹)", icon: "compass" as const },
  { key: "combined_fare", label: "Combined Parikrama (₹)", icon: "award" as const },
  { key: "commission_pct", label: "Admin commission (%)", icon: "percent" as const },
  { key: "cancellation_fee", label: "Cancellation fee (₹)", icon: "x-circle" as const },
  { key: "boundary_radius_km", label: "City boundary (km)", icon: "map" as const },
];

export default function AdminFares() {
  const [cfg, setCfg] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<any>("/config/fare", { auth: false });
      setCfg(data);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const update = (key: string, val: string) => {
    setCfg((c: any) => ({ ...c, [key]: val === "" ? "" : Number(val) }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {};
      FIELDS.forEach((f) => {
        if (typeof cfg[f.key] === "number") payload[f.key] = cfg[f.key];
      });
      await api("/admin/config/fare", { method: "PATCH", body: payload });
      Alert.alert("Saved", "Fare config updated successfully");
      load();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-fares-screen">
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        <TText variant="caption" muted>CONFIGURATION</TText>
        <TText variant="h2">Fare & Commission</TText>
        <TText variant="bodySm" muted style={{ marginTop: 4 }}>
          All amounts are in ₹. Changes apply immediately to new rides.
        </TText>

        <Card style={{ marginTop: spacing.lg }}>
          {FIELDS.map((f) => (
            <View key={f.key} style={styles.row}>
              <View style={styles.fieldIcon}>
                <Feather name={f.icon} size={16} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <TInput
                  label={f.label}
                  value={String(cfg[f.key] ?? "")}
                  onChangeText={(v) => update(f.key, v.replace(/[^\d.]/g, ""))}
                  keyboardType="decimal-pad"
                  testID={`admin-fare-${f.key}`}
                />
              </View>
            </View>
          ))}
        </Card>

        <TButton
          label="Save changes"
          onPress={save}
          loading={saving}
          testID="admin-fare-save-btn"
          icon={<Feather name="save" size={16} color={colors.textInverse} />}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: "row", alignItems: "flex-start" },
  fieldIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginTop: 28,
  },
});
