import React, { useCallback, useState } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, Switch, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { TText } from "../../src/components/TText";
import { TInput } from "../../src/components/TInput";
import { TButton } from "../../src/components/TButton";
import { ImagePickerField } from "../../src/components/ImagePickerField";
import { api } from "../../src/api";
import { notify, confirmDialog } from "../../src/utils/dialog";
import { colors, radius, spacing, shadows } from "../../src/theme";
import { Stay, STAY_TYPES, AMENITIES, stayTypeLabel, priceLabel } from "../../src/stays";
import { PhotoItem, photoItemsFromUrls, resolvePhotos } from "../../src/uploads";

type Filter = "all" | "pending" | "verified";

const EMPTY_FORM = {
  name: "", type: "dharamshala", area: "", address: "",
  contact_phone: "", whatsapp: "", description: "",
  price_min: "", price_max: "", donation_based: false,
  capacity: "", room_types: "", amenities: [] as string[],
  verified: true, available: true, featured: false,
  photos: [] as PhotoItem[],
};

export default function AdminStays() {
  const router = useRouter();
  const [stays, setStays] = useState<Stay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ stays: Stay[] }>("/admin/stays");
      setStays(res.stays || []);
    } catch (e: any) {
      notify("Could not load stays", e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = stays.filter((s) =>
    filter === "all" ? true : filter === "pending" ? !s.verified : s.verified
  );
  const pendingCount = stays.filter((s) => !s.verified).length;

  const openAdd = () => { setEditingId(null); setForm({ ...EMPTY_FORM }); setModalOpen(true); };

  const openEdit = (s: Stay) => {
    setEditingId(s.id);
    setForm({
      name: s.name || "", type: s.type || "dharamshala", area: s.area || "", address: s.address || "",
      contact_phone: s.contact_phone || "", whatsapp: s.whatsapp || "", description: s.description || "",
      price_min: s.price_min != null ? String(s.price_min) : "",
      price_max: s.price_max != null ? String(s.price_max) : "",
      donation_based: !!s.donation_based,
      capacity: s.capacity != null ? String(s.capacity) : "",
      room_types: (s.room_types || []).join(", "),
      amenities: s.amenities || [],
      verified: !!s.verified, available: s.available !== false, featured: !!s.featured,
      photos: photoItemsFromUrls(s.photos),
    });
    setModalOpen(true);
  };

  const toggleAmenity = (key: string) =>
    setForm((f) => ({ ...f, amenities: f.amenities.includes(key) ? f.amenities.filter((a) => a !== key) : [...f.amenities, key] }));

  const save = async () => {
    if (!form.name.trim() || !form.address.trim() || !form.contact_phone.trim()) {
      notify("Missing fields", "Name, address and contact phone are required.");
      return;
    }
    if (form.photos.length === 0) {
      notify("Add a photo", "Please add at least one photo of the stay.");
      return;
    }
    const payload: any = {
      name: form.name.trim(),
      type: form.type,
      area: form.area.trim() || null,
      address: form.address.trim(),
      contact_phone: form.contact_phone.trim(),
      whatsapp: form.whatsapp.trim() || null,
      description: form.description.trim() || null,
      donation_based: form.donation_based,
      price_min: form.donation_based || !form.price_min ? null : Number(form.price_min),
      price_max: form.donation_based || !form.price_max ? null : Number(form.price_max),
      capacity: form.capacity ? Number(form.capacity) : null,
      room_types: form.room_types.split(",").map((r) => r.trim()).filter(Boolean),
      amenities: form.amenities,
      verified: form.verified,
      available: form.available,
      featured: form.featured,
    };
    setSaving(true);
    try {
      // Upload any newly-picked images first; abort the save if upload fails.
      payload.photos = await resolvePhotos(form.photos, "stay", 1);
      if (editingId) await api(`/admin/stays/${editingId}`, { method: "PATCH", body: payload });
      else await api("/admin/stays", { method: "POST", body: payload });
      setModalOpen(false);
      await load();
    } catch (e: any) {
      notify("Save failed", e?.message);
    } finally {
      setSaving(false);
    }
  };

  const quickPatch = async (s: Stay, patch: any) => {
    try {
      await api(`/admin/stays/${s.id}`, { method: "PATCH", body: patch });
      await load();
    } catch (e: any) {
      notify("Update failed", e?.message);
    }
  };

  const remove = (s: Stay) =>
    confirmDialog("Delete stay?", `"${s.name}" will be permanently removed.`, async () => {
      try { await api(`/admin/stays/${s.id}`, { method: "DELETE" }); await load(); }
      catch (e: any) { notify("Delete failed", e?.message); }
    }, { confirmLabel: "Delete", destructive: true });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-stays-screen">
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TText variant="bodyLg" weight="700">Dharamshalas & Stays</TText>
          <TText variant="caption" muted>{stays.length} listed · {pendingCount} pending</TText>
        </View>
        <TouchableOpacity onPress={openAdd} style={[styles.iconBtn, { backgroundColor: colors.primary }]} testID="admin-stay-add">
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(["all", "pending", "verified"] as Filter[]).map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.fChip, filter === f && styles.fChipActive]}>
            <TText variant="bodySm" weight="700" color={filter === f ? "#fff" : colors.textMuted}>
              {f === "all" ? "All" : f === "pending" ? `Pending (${pendingCount})` : "Verified"}
            </TText>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {filtered.length === 0 && (
            <View style={styles.empty}>
              <Feather name="home" size={36} color={colors.textSubtle} />
              <TText variant="bodyLg" weight="700" style={{ marginTop: 10 }}>Nothing here</TText>
              <TText variant="bodySm" muted>Tap + to add a dharamshala or guest house.</TText>
            </View>
          )}
          {filtered.map((s) => (
            <View key={s.id} style={styles.row} testID={`admin-stay-${s.id}`}>
              <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", flex: 1 }} onPress={() => openEdit(s)} activeOpacity={0.85}>
                <View style={styles.rowIcon}><Feather name="home" size={18} color={colors.primaryDark} /></View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <TText variant="body" weight="700" numberOfLines={1}>{s.name}</TText>
                  <TText variant="caption" muted numberOfLines={1}>
                    {stayTypeLabel(s.type)}{s.area ? ` · ${s.area}` : ""} · {priceLabel(s)}
                  </TText>
                  <View style={styles.badgeRow}>
                    <Badge label={s.verified ? "Verified" : "Pending"} bg={s.verified ? colors.successBg : colors.warningBg} fg={s.verified ? colors.success : "#A36B00"} />
                    <Badge label={s.available !== false ? "Available" : "Full"} bg={s.available !== false ? colors.infoBg : colors.errorBg} fg={s.available !== false ? colors.info : colors.error} />
                    {s.featured && <Badge label="Featured" bg={colors.primaryLight} fg={colors.primaryDark} />}
                  </View>
                </View>
              </TouchableOpacity>
              <View style={styles.rowActions}>
                {!s.verified && (
                  <TouchableOpacity onPress={() => quickPatch(s, { verified: true })} style={[styles.actChip, { backgroundColor: colors.successBg }]} testID={`admin-stay-verify-${s.id}`}>
                    <Feather name="check" size={15} color={colors.success} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => quickPatch(s, { available: !(s.available !== false) })} style={[styles.actChip, { backgroundColor: colors.bgAlt }]}>
                  <Feather name={s.available !== false ? "toggle-right" : "toggle-left"} size={15} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(s)} style={[styles.actChip, { backgroundColor: colors.errorBg }]} testID={`admin-stay-delete-${s.id}`}>
                  <Feather name="trash-2" size={15} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add / Edit modal */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <TText variant="h3">{editingId ? "Edit stay" : "Add stay"}</TText>
              <TouchableOpacity onPress={() => setModalOpen(false)}><Feather name="x" size={22} color={colors.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
              <TInput label="Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Shri Giriraj Dharamshala" testID="stay-form-name" />

              <ImagePickerField
                label="Photos"
                required
                value={form.photos}
                onChange={(photos) => setForm({ ...form, photos })}
                max={6}
                hint="Add at least 1 photo. First photo is the cover."
                testID="stay-form-photos"
              />

              <TText variant="bodySm" muted style={{ marginBottom: 6 }}>Type</TText>
              <View style={styles.chipWrap}>
                {STAY_TYPES.map((t) => (
                  <TouchableOpacity key={t.key} onPress={() => setForm({ ...form, type: t.key })} style={[styles.selChip, form.type === t.key && styles.selChipActive]}>
                    <Feather name={t.icon} size={13} color={form.type === t.key ? "#fff" : colors.textMuted} style={{ marginRight: 5 }} />
                    <TText variant="bodySm" weight="600" color={form.type === t.key ? "#fff" : colors.textMuted}>{t.label}</TText>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: spacing.md }} />
              <TInput label="Area" value={form.area} onChangeText={(v) => setForm({ ...form, area: v })} placeholder="Daan Ghati / Jatipura / Radha Kund" />
              <TInput label="Address *" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} placeholder="Full address" multiline />
              <TInput label="Contact phone *" value={form.contact_phone} onChangeText={(v) => setForm({ ...form, contact_phone: v })} keyboardType="phone-pad" placeholder="10-digit number" testID="stay-form-phone" />
              <TInput label="WhatsApp (optional)" value={form.whatsapp} onChangeText={(v) => setForm({ ...form, whatsapp: v })} keyboardType="phone-pad" placeholder="defaults to contact phone" />

              <View style={styles.switchRow}>
                <TText variant="body" weight="600">Donation based (no fixed price)</TText>
                <Switch value={form.donation_based} onValueChange={(v) => setForm({ ...form, donation_based: v })} trackColor={{ true: colors.primary }} />
              </View>
              {!form.donation_based && (
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><TInput label="Price min ₹" value={form.price_min} onChangeText={(v) => setForm({ ...form, price_min: v })} keyboardType="numeric" placeholder="400" /></View>
                  <View style={{ flex: 1 }}><TInput label="Price max ₹" value={form.price_max} onChangeText={(v) => setForm({ ...form, price_max: v })} keyboardType="numeric" placeholder="1200" /></View>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><TInput label="Capacity (rooms/beds)" value={form.capacity} onChangeText={(v) => setForm({ ...form, capacity: v })} keyboardType="numeric" placeholder="60" /></View>
              </View>
              <TInput label="Room types (comma separated)" value={form.room_types} onChangeText={(v) => setForm({ ...form, room_types: v })} placeholder="Single, Double, Family" />

              <TText variant="bodySm" muted style={{ marginBottom: 6 }}>Facilities</TText>
              <View style={styles.chipWrap}>
                {AMENITIES.map((a) => {
                  const on = form.amenities.includes(a.key);
                  return (
                    <TouchableOpacity key={a.key} onPress={() => toggleAmenity(a.key)} style={[styles.selChip, on && styles.selChipActive]}>
                      <Feather name={a.icon} size={13} color={on ? "#fff" : colors.textMuted} style={{ marginRight: 5 }} />
                      <TText variant="bodySm" weight="600" color={on ? "#fff" : colors.textMuted}>{a.label}</TText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ height: spacing.md }} />
              <TInput label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Short description for pilgrims" multiline />

              <View style={styles.switchRow}>
                <TText variant="body" weight="600">Verified (visible to pilgrims)</TText>
                <Switch value={form.verified} onValueChange={(v) => setForm({ ...form, verified: v })} trackColor={{ true: colors.success }} />
              </View>
              <View style={styles.switchRow}>
                <TText variant="body" weight="600">Available</TText>
                <Switch value={form.available} onValueChange={(v) => setForm({ ...form, available: v })} trackColor={{ true: colors.info }} />
              </View>
              <View style={styles.switchRow}>
                <TText variant="body" weight="600">Featured</TText>
                <Switch value={form.featured} onValueChange={(v) => setForm({ ...form, featured: v })} trackColor={{ true: colors.primary }} />
              </View>

              <TButton label={editingId ? "Save changes" : "Add stay"} onPress={save} loading={saving} testID="stay-form-save" style={{ marginTop: spacing.md }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <TText variant="caption" color={fg}>{label}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgAlt },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  fChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  fChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  empty: { alignItems: "center", paddingTop: spacing.xxl, gap: 2 },
  row: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadows.sm,
  },
  rowIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  rowActions: { gap: 6, marginLeft: 8 },
  actChip: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: "92%",
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.sm },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selChip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  selChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
});
