import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, RefreshControl, TouchableOpacity, Modal, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
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
  const [selected, setSelected] = useState<any | null>(null);
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const f = FILTERS.find((x) => x.id === filter)?.val;
      const qs = f ? `?status_filter=${f}` : "";
      const r = await api<{ drivers: any[] }>(`/admin/drivers${qs}`);
      setDrivers(r.drivers || []);
      // Keep the open detail sheet in sync after a reload.
      setSelected((cur) => (cur ? r.drivers?.find((d) => d.user_id === cur.user_id) || null : null));
    } catch {}
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const approve = async (userId: string) => {
    setActing(true);
    try {
      await api(`/admin/drivers/${userId}/approve`, { method: "POST" });
      await load();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setActing(false);
    }
  };

  const reject = (userId: string) => {
    Alert.alert("Reject driver?", "They'll need to re-submit KYC", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          setActing(true);
          try {
            await api(`/admin/drivers/${userId}/reject`, { method: "POST", body: { reason: "Documents not verified" } });
            await load();
          } catch (e: any) {
            Alert.alert("Failed", e.message);
          } finally {
            setActing(false);
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

      {/* Filters — fixed-height row (no vertical stretch) */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[styles.chip, filter === f.id && styles.chipActive]}
            testID={`admin-driver-filter-${f.id}`}
          >
            <TText variant="bodySm" weight="700" color={filter === f.id ? colors.textInverse : colors.text}>
              {f.label}
            </TText>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        {drivers.length === 0 ? (
          <Card flat style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <Feather name="inbox" size={28} color={colors.textMuted} />
            <TText variant="bodyLg" weight="700" style={{ marginTop: 8 }}>No drivers in this list</TText>
          </Card>
        ) : (
          drivers.map((d) => (
            <TouchableOpacity key={d.id} activeOpacity={0.85} onPress={() => setSelected(d)} testID={`admin-driver-${d.user_id}`}>
              <Card style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <TText variant="bodyLg" weight="700" numberOfLines={1}>{d.user?.name || "Unnamed driver"}</TText>
                    <TText variant="bodySm" muted>+91 {d.user?.phone}</TText>
                    <TText variant="caption" muted style={{ marginTop: 2 }}>{d.vehicle_no || "No vehicle"}</TText>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor(d.kyc_status) + "20", marginTop: 8 }]}>
                      <TText variant="caption" color={statusColor(d.kyc_status)}>{(d.kyc_status || "").replace("_", " ").toUpperCase()}</TText>
                    </View>
                  </View>
                  {/* Profile photo, top-right */}
                  <Thumb url={d.doc_urls?.profile_photo} size={64} />
                </View>
                <View style={styles.tapHint}>
                  <Feather name="eye" size={13} color={colors.primary} />
                  <TText variant="caption" color={colors.primary} style={{ marginLeft: 5 }}>Tap to view details</TText>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Detail sheet */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <TText variant="h3" numberOfLines={1}>{selected.user?.name || "Unnamed driver"}</TText>
                    <TText variant="bodySm" muted>+91 {selected.user?.phone}</TText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(selected.kyc_status) + "20" }]}>
                    <TText variant="caption" color={statusColor(selected.kyc_status)}>{(selected.kyc_status || "").replace("_", " ").toUpperCase()}</TText>
                  </View>
                  <TouchableOpacity onPress={() => setSelected(null)} style={{ marginLeft: 10 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Documents */}
                <TText variant="caption" muted style={{ marginTop: spacing.md, marginBottom: 8 }}>DOCUMENTS</TText>
                <View style={styles.docRow}>
                  <DocThumb label="Profile" url={selected.doc_urls?.profile_photo} onPress={setZoom} />
                  <DocThumb label="Aadhar" url={selected.doc_urls?.aadhar_photo} onPress={setZoom} />
                  <DocThumb label="Vehicle RC" url={selected.doc_urls?.rc_photo} onPress={setZoom} />
                </View>

                {/* Details */}
                <TText variant="caption" muted style={{ marginTop: spacing.lg, marginBottom: 8 }}>SUBMITTED DETAILS</TText>
                <Card flat>
                  <DetailRow label="Aadhar number" value={selected.aadhar_number || "—"} />
                  <DetailRow label="Vehicle number" value={selected.vehicle_no || "—"} />
                  <DetailRow label="Vehicle type" value={selected.vehicle_type || "—"} />
                  <DetailRow label="UPI ID" value={selected.upi_id || "—"} />
                  <DetailRow label="Submitted" value={selected.submitted_at ? new Date(selected.submitted_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"} last />
                  {selected.kyc_status === "rejected" && selected.rejection_reason ? (
                    <View style={{ marginTop: spacing.sm }}>
                      <TText variant="caption" color={colors.error}>REASON</TText>
                      <TText variant="bodySm" color={colors.error}>{selected.rejection_reason}</TText>
                    </View>
                  ) : null}
                </Card>

                {selected.kyc_status === "approved" && (
                  <View style={styles.onlineRow}>
                    <Feather name="check-circle" size={14} color={colors.success} />
                    <TText variant="caption" color={colors.success} style={{ marginLeft: 6 }}>
                      {selected.online ? "Online & taking rides" : "Approved · currently offline"}
                    </TText>
                  </View>
                )}

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 12, marginTop: spacing.lg }}>
                  {selected.kyc_status !== "rejected" && (
                    <TButton label="Reject" variant="outline" onPress={() => reject(selected.user_id)} loading={acting} fullWidth={false} style={{ flex: 1 }} testID="admin-detail-reject" />
                  )}
                  {selected.kyc_status !== "approved" && (
                    <TButton label="Approve" onPress={() => approve(selected.user_id)} loading={acting} fullWidth={false} style={{ flex: 1 }} testID="admin-detail-approve" />
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Full-screen image zoom */}
      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoom(null)}>
          <TText variant="bodySm" color="#fff" style={{ marginBottom: spacing.md }}>{zoom?.label}</TText>
          {zoom && <Image source={{ uri: zoom.url }} style={styles.zoomImage} contentFit="contain" />}
          <TText variant="caption" color="#ffffffaa" style={{ marginTop: spacing.lg }}>Tap anywhere to close</TText>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Thumb({ url, size }: { url?: string; size: number }) {
  return (
    <View style={[styles.thumb, { width: size, height: size, borderRadius: radius.md }]}>
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Feather name="user" size={size * 0.4} color={colors.primaryDark} />
      )}
    </View>
  );
}

function DocThumb({ label, url, onPress }: { label: string; url?: string; onPress: (z: { url: string; label: string }) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        style={styles.docThumb}
        activeOpacity={url ? 0.85 : 1}
        onPress={() => url && onPress({ url, label })}
        testID={`admin-doc-${label}`}
      >
        {url ? (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Feather name="image" size={20} color={colors.textSubtle} />
        )}
        {url && (
          <View style={styles.zoomBadge}>
            <Feather name="maximize-2" size={11} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
      <TText variant="caption" muted align="center" style={{ marginTop: 4 }}>{label}</TText>
    </View>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailDivider]}>
      <TText variant="bodySm" muted>{label}</TText>
      <TText variant="bodySm" weight="600" style={{ flex: 1, textAlign: "right", marginLeft: spacing.md }} numberOfLines={1}>{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  chip: {
    paddingHorizontal: 14, height: 34, justifyContent: "center", borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  thumb: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", overflow: "hidden", marginLeft: spacing.md },
  tapHint: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  // sheet
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: "90%" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.md },
  sheetHeader: { flexDirection: "row", alignItems: "center" },
  docRow: { flexDirection: "row", gap: 10 },
  docThumb: {
    height: 96, borderRadius: radius.md, backgroundColor: colors.bgAlt,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  zoomBadge: { position: "absolute", right: 5, bottom: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  detailDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  onlineRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  zoomBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  zoomImage: { width: "100%", height: "70%" },
});
