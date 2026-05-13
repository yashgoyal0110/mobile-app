import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, RefreshControl, TouchableOpacity, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { TText } from "../../src/components/TText";
import { TInput } from "../../src/components/TInput";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { colors, radius, spacing, shadows } from "../../src/theme";

const FARE_FIELDS = [
  { key: "base_fare", label: "Local base fare (₹)", icon: "play" as const },
  { key: "per_km", label: "Local per km (₹)", icon: "trending-up" as const },
  { key: "poochari_fare", label: "Poochari Parikrama (₹)", icon: "compass" as const },
  { key: "radhakund_fare", label: "Radhakund Parikrama (₹)", icon: "compass" as const },
  { key: "combined_fare", label: "Combined Parikrama (₹)", icon: "award" as const },
  { key: "commission_pct", label: "Admin commission (%)", icon: "percent" as const },
  { key: "cancellation_fee", label: "Cancellation fee (₹)", icon: "x-circle" as const },
  { key: "boundary_radius_km", label: "City boundary (km)", icon: "map" as const },
  { key: "dispatch_radius_km", label: "Driver dispatch radius (km)", icon: "radio" as const },
  { key: "surge_pct", label: "Surge multiplier (%)", icon: "zap" as const },
];

type Tab = "fares" | "landmarks";

export default function AdminConfig() {
  const [tab, setTab] = useState<Tab>("fares");
  const [cfg, setCfg] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [landmarkModal, setLandmarkModal] = useState<{ open: boolean; editing?: any }>({ open: false });

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
      FARE_FIELDS.forEach((f) => {
        if (typeof cfg[f.key] === "number") payload[f.key] = cfg[f.key];
      });
      await api("/admin/config/fare", { method: "PATCH", body: payload });
      Alert.alert("Saved", "Configuration updated successfully");
      load();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeLandmark = async (lid: string, name: string) => {
    Alert.alert("Delete landmark?", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await api(`/admin/landmarks/${lid}`, { method: "DELETE" });
            load();
          } catch (e: any) {
            Alert.alert("Failed", e.message);
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-config-screen">
      <View style={styles.headerWrap}>
        <TText variant="caption" muted>CONFIGURATION</TText>
        <TText variant="h2">App Settings</TText>
        <TText variant="bodySm" muted style={{ marginTop: 4 }}>
          Changes apply immediately to new rides
        </TText>
        <View style={styles.tabs}>
          <TabBtn label="Fares" active={tab === "fares"} onPress={() => setTab("fares")} icon="dollar-sign" testID="admin-tab-fares-btn" />
          <TabBtn label={`Landmarks (${(cfg.landmarks || []).length})`} active={tab === "landmarks"} onPress={() => setTab("landmarks")} icon="map-pin" testID="admin-tab-landmarks-btn" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        {tab === "fares" ? (
          <>
            <Card>
              {FARE_FIELDS.map((f) => (
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
              label="Save fare changes"
              onPress={save}
              loading={saving}
              testID="admin-fare-save-btn"
              icon={<Feather name="save" size={16} color={colors.textInverse} />}
              style={{ marginTop: spacing.lg }}
            />
          </>
        ) : (
          <>
            <Card style={{ marginBottom: spacing.md, backgroundColor: colors.infoBg, borderColor: colors.info + "30" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="info" size={18} color={colors.info} />
                <TText variant="bodySm" color={colors.info} style={{ marginLeft: 8, flex: 1 }}>
                  Landmarks help passengers discover places quickly. Coordinates must be inside the service area.
                </TText>
              </View>
            </Card>

            {(cfg.landmarks || []).map((lm: any) => (
              <Card key={lm.id} style={{ marginBottom: 10, flexDirection: "row", alignItems: "center" }}>
                <View style={styles.lmIcon}>
                  <Feather name="map-pin" size={16} color={colors.primaryDark} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <TText variant="body" weight="700">{lm.name}</TText>
                  <TText variant="caption" muted>
                    {Number(lm.lat).toFixed(4)}, {Number(lm.lng).toFixed(4)}
                  </TText>
                </View>
                <TouchableOpacity onPress={() => setLandmarkModal({ open: true, editing: lm })} testID={`landmark-edit-${lm.id}`} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="edit-2" size={18} color={colors.primaryDark} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeLandmark(lm.id, lm.name)} testID={`landmark-del-${lm.id}`} style={{ marginLeft: 14 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="trash-2" size={18} color={colors.error} />
                </TouchableOpacity>
              </Card>
            ))}

            <TButton
              label="Add new landmark"
              variant="outline"
              onPress={() => setLandmarkModal({ open: true })}
              testID="admin-add-landmark-btn"
              icon={<Feather name="plus" size={16} color={colors.text} />}
              style={{ marginTop: spacing.lg }}
            />
          </>
        )}
      </ScrollView>

      <LandmarkModal
        state={landmarkModal}
        onClose={() => setLandmarkModal({ open: false })}
        onSaved={() => { setLandmarkModal({ open: false }); load(); }}
      />
    </SafeAreaView>
  );
}

function TabBtn({ label, active, onPress, icon, testID }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Feather name={icon} size={14} color={active ? colors.primaryDark : colors.textMuted} />
      <TText variant="bodySm" weight={active ? "700" : "500"} color={active ? colors.primaryDark : colors.textMuted} style={{ marginLeft: 6 }}>
        {label}
      </TText>
    </TouchableOpacity>
  );
}

function LandmarkModal({ state, onClose, onSaved }: any) {
  const { open, editing } = state;
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setName(editing?.name || "");
    setLat(editing?.lat != null ? String(editing.lat) : "");
    setLng(editing?.lng != null ? String(editing.lng) : "");
  }, [editing, open]);

  const save = async () => {
    const latN = Number(lat); const lngN = Number(lng);
    if (!name.trim() || isNaN(latN) || isNaN(lngN)) {
      Alert.alert("Invalid", "Please enter a name and valid coordinates");
      return;
    }
    setSaving(true);
    try {
      if (editing?.id) {
        await api(`/admin/landmarks/${editing.id}`, {
          method: "PATCH",
          body: { name: name.trim(), lat: latN, lng: lngN },
        });
      } else {
        await api("/admin/landmarks", {
          method: "POST",
          body: { name: name.trim(), lat: latN, lng: lngN },
        });
      }
      onSaved();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={{ padding: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <TText variant="h3">{editing?.id ? "Edit landmark" : "New landmark"}</TText>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: spacing.lg }}>
              <TInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Daan Ghati Mandir" testID="landmark-name-input" />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TInput label="Latitude" value={lat} onChangeText={(v) => setLat(v.replace(/[^\d.\-]/g, ""))} keyboardType="decimal-pad" placeholder="27.4985" testID="landmark-lat-input" />
                </View>
                <View style={{ flex: 1 }}>
                  <TInput label="Longitude" value={lng} onChangeText={(v) => setLng(v.replace(/[^\d.\-]/g, ""))} keyboardType="decimal-pad" placeholder="77.4615" testID="landmark-lng-input" />
                </View>
              </View>
              <TButton label={editing?.id ? "Update" : "Add"} onPress={save} loading={saving} testID="landmark-save-btn" />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { padding: spacing.lg, paddingBottom: 0 },
  tabs: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  tabBtn: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  tabBtnActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary + "40" },
  row: { flexDirection: "row", alignItems: "flex-start" },
  fieldIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginTop: 28,
  },
  lmIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadows.lg },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 10 },
});
