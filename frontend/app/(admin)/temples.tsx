import React, { useCallback, useState } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, Switch, KeyboardAvoidingView, Platform, TextInput,
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
import { Temple, DarshanSlot, AartiTiming, CROWD_OPTIONS, CrowdLevel, openStatus } from "../../src/temples";
import { PhotoItem, photoItemsFromUrls, resolvePhotos } from "../../src/uploads";

type Filter = "all" | "pending" | "verified";

interface Form {
  name: string; deity: string; area: string; address: string;
  contact_phone: string; description: string; entry_info: string; special_note: string;
  darshan_slots: DarshanSlot[]; aarti_timings: AartiTiming[];
  crowd_level: CrowdLevel | null; verified: boolean; featured: boolean;
  photos: PhotoItem[];
  prasad_items: { id?: string; name: string; price: string; description: string; available: boolean }[];
}

const EMPTY_FORM: Form = {
  name: "", deity: "", area: "", address: "",
  contact_phone: "", description: "", entry_info: "", special_note: "",
  darshan_slots: [{ label: "", open: "05:00", close: "12:00" }],
  aarti_timings: [], crowd_level: null, verified: true, featured: false,
  photos: [],
  prasad_items: [],
};

export default function AdminTemples() {
  const router = useRouter();
  const [temples, setTemples] = useState<Temple[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ temples: Temple[] }>("/admin/temples");
      setTemples(res.temples || []);
    } catch (e: any) {
      notify("Could not load temples", e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = temples.filter((t) => filter === "all" ? true : filter === "pending" ? !t.verified : t.verified);
  const pendingCount = temples.filter((t) => !t.verified).length;

  const openAdd = () => { setEditingId(null); setForm({ ...EMPTY_FORM, darshan_slots: [{ label: "", open: "05:00", close: "12:00" }] }); setModalOpen(true); };

  const openEdit = (t: Temple) => {
    setEditingId(t.id);
    setForm({
      name: t.name || "", deity: t.deity || "", area: t.area || "", address: t.address || "",
      contact_phone: t.contact_phone || "", description: t.description || "",
      entry_info: t.entry_info || "", special_note: t.special_note || "",
      darshan_slots: (t.darshan_slots || []).map((s) => ({ label: s.label || "", open: s.open, close: s.close })),
      aarti_timings: (t.aarti_timings || []).map((a) => ({ name: a.name, time: a.time })),
      crowd_level: t.crowd_level || null, verified: !!t.verified, featured: !!t.featured,
      photos: photoItemsFromUrls(t.photos),
      prasad_items: ((t as any).prasad_items || []).map((p: any) => ({
        id: p.id,
        name: p.name || "",
        price: p.price != null ? String(p.price) : "",
        description: p.description || "",
        available: p.available !== false,
      })),
    });
    setModalOpen(true);
  };

  // --- slot / aarti row helpers ---
  const setSlot = (i: number, patch: Partial<DarshanSlot>) =>
    setForm((f) => ({ ...f, darshan_slots: f.darshan_slots.map((s, idx) => idx === i ? { ...s, ...patch } : s) }));
  const addSlot = () => setForm((f) => ({ ...f, darshan_slots: [...f.darshan_slots, { label: "", open: "16:00", close: "21:00" }] }));
  const delSlot = (i: number) => setForm((f) => ({ ...f, darshan_slots: f.darshan_slots.filter((_, idx) => idx !== i) }));

  const setAarti = (i: number, patch: Partial<AartiTiming>) =>
    setForm((f) => ({ ...f, aarti_timings: f.aarti_timings.map((a, idx) => idx === i ? { ...a, ...patch } : a) }));
  const addAarti = () => setForm((f) => ({ ...f, aarti_timings: [...f.aarti_timings, { name: "", time: "06:00" }] }));
  const delAarti = (i: number) => setForm((f) => ({ ...f, aarti_timings: f.aarti_timings.filter((_, idx) => idx !== i) }));

  // --- prasad item helpers ---
  const setPrasad = (i: number, patch: Partial<Form["prasad_items"][number]>) =>
    setForm((f) => ({ ...f, prasad_items: f.prasad_items.map((p, idx) => idx === i ? { ...p, ...patch } : p) }));
  const addPrasad = () => setForm((f) => ({ ...f, prasad_items: [...f.prasad_items, { name: "", price: "", description: "", available: true }] }));
  const delPrasad = (i: number) => setForm((f) => ({ ...f, prasad_items: f.prasad_items.filter((_, idx) => idx !== i) }));

  const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

  const save = async () => {
    if (!form.name.trim() || !form.address.trim()) {
      notify("Missing fields", "Name and address are required.");
      return;
    }
    if (form.photos.length === 0) {
      notify("Add a photo", "Please add at least one photo of the temple.");
      return;
    }
    const slots = form.darshan_slots.filter((s) => s.open && s.close);
    for (const s of slots) {
      if (!HHMM.test(s.open) || !HHMM.test(s.close)) {
        notify("Invalid time", `Darshan times must be 24h HH:MM (got ${s.open}–${s.close}).`);
        return;
      }
    }
    const aartis = form.aarti_timings.filter((a) => a.name.trim() && a.time);
    for (const a of aartis) {
      if (!HHMM.test(a.time)) { notify("Invalid time", `Aarti time must be HH:MM (got ${a.time}).`); return; }
    }
    const payload: any = {
      name: form.name.trim(), deity: form.deity.trim() || null, area: form.area.trim() || null,
      address: form.address.trim(), contact_phone: form.contact_phone.trim() || null,
      description: form.description.trim() || null, entry_info: form.entry_info.trim() || null,
      special_note: form.special_note.trim() || null,
      darshan_slots: slots.map((s) => ({ label: s.label?.trim() || null, open: s.open, close: s.close })),
      aarti_timings: aartis.map((a) => ({ name: a.name.trim(), time: a.time })),
      prasad_items: form.prasad_items
        .filter((p) => p.name.trim() && p.price !== "" && Number(p.price) >= 0)
        .map((p) => ({ id: p.id, name: p.name.trim(), price: Number(p.price), description: p.description.trim() || null, available: p.available })),
      crowd_level: form.crowd_level, verified: form.verified, featured: form.featured,
    };
    setSaving(true);
    try {
      // Upload any newly-picked images first; abort the save if upload fails.
      payload.photos = await resolvePhotos(form.photos, "temple", 1);
      if (editingId) await api(`/admin/temples/${editingId}`, { method: "PATCH", body: payload });
      else await api("/admin/temples", { method: "POST", body: payload });
      setModalOpen(false);
      await load();
    } catch (e: any) {
      notify("Save failed", e?.message);
    } finally {
      setSaving(false);
    }
  };

  const quickPatch = async (t: Temple, patch: any) => {
    try { await api(`/admin/temples/${t.id}`, { method: "PATCH", body: patch }); await load(); }
    catch (e: any) { notify("Update failed", e?.message); }
  };

  const remove = (t: Temple) =>
    confirmDialog("Delete temple?", `"${t.name}" will be permanently removed.`, async () => {
      try { await api(`/admin/temples/${t.id}`, { method: "DELETE" }); await load(); }
      catch (e: any) { notify("Delete failed", e?.message); }
    }, { confirmLabel: "Delete", destructive: true });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-temples-screen">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TText variant="bodyLg" weight="700">Temples & Darshan</TText>
          <TText variant="caption" muted>{temples.length} listed · {pendingCount} pending</TText>
        </View>
        <TouchableOpacity onPress={openAdd} style={[styles.iconBtn, { backgroundColor: colors.primary }]} testID="admin-temple-add">
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

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
              <Feather name="map-pin" size={36} color={colors.textSubtle} />
              <TText variant="bodyLg" weight="700" style={{ marginTop: 10 }}>Nothing here</TText>
              <TText variant="bodySm" muted>Tap + to add a temple.</TText>
            </View>
          )}
          {filtered.map((t) => {
            const st = openStatus(t.darshan_slots);
            return (
              <View key={t.id} style={styles.row} testID={`admin-temple-${t.id}`}>
                <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", flex: 1 }} onPress={() => openEdit(t)} activeOpacity={0.85}>
                  <View style={styles.rowIcon}><Feather name="home" size={18} color={colors.parikrama} /></View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <TText variant="body" weight="700" numberOfLines={1}>{t.name}</TText>
                    <TText variant="caption" muted numberOfLines={1}>
                      {t.deity || "—"}{t.area ? ` · ${t.area}` : ""}
                    </TText>
                    <View style={styles.badgeRow}>
                      <Badge label={t.verified ? "Verified" : "Pending"} bg={t.verified ? colors.successBg : colors.warningBg} fg={t.verified ? colors.success : "#A36B00"} />
                      <Badge label={st.label} bg={st.bg} fg={st.tint} />
                      {t.featured && <Badge label="Popular" bg={colors.primaryLight} fg={colors.primaryDark} />}
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={styles.rowActions}>
                  {!t.verified && (
                    <TouchableOpacity onPress={() => quickPatch(t, { verified: true })} style={[styles.actChip, { backgroundColor: colors.successBg }]} testID={`admin-temple-verify-${t.id}`}>
                      <Feather name="check" size={15} color={colors.success} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => remove(t)} style={[styles.actChip, { backgroundColor: colors.errorBg }]} testID={`admin-temple-delete-${t.id}`}>
                    <Feather name="trash-2" size={15} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add / Edit modal */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <TText variant="h3">{editingId ? "Edit temple" : "Add temple"}</TText>
              <TouchableOpacity onPress={() => setModalOpen(false)}><Feather name="x" size={22} color={colors.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
              <TInput label="Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Daan Ghati Mandir" testID="temple-form-name" />

              <ImagePickerField
                label="Photos"
                required
                value={form.photos}
                onChange={(photos) => setForm({ ...form, photos })}
                max={6}
                hint="Add at least 1 photo. First photo is the cover."
                testID="temple-form-photos"
              />

              <TInput label="Deity" value={form.deity} onChangeText={(v) => setForm({ ...form, deity: v })} placeholder="Shri Giriraj Ji" />
              <TInput label="Area" value={form.area} onChangeText={(v) => setForm({ ...form, area: v })} placeholder="Daan Ghati / Jatipura" />
              <TInput label="Address *" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} placeholder="Full address" multiline />
              <TInput label="Contact phone (optional)" value={form.contact_phone} onChangeText={(v) => setForm({ ...form, contact_phone: v })} keyboardType="phone-pad" />

              {/* Darshan slots */}
              <View style={styles.sectionHead}>
                <TText variant="label">DARSHAN SLOTS (24h)</TText>
                <TouchableOpacity onPress={addSlot} style={styles.addBtn} testID="temple-add-slot">
                  <Feather name="plus" size={14} color={colors.primaryDark} />
                  <TText variant="caption" color={colors.primaryDark} style={{ marginLeft: 4 }}>Add slot</TText>
                </TouchableOpacity>
              </View>
              {form.darshan_slots.map((s, i) => (
                <View key={i} style={styles.slotEditRow}>
                  <TimeField value={s.open} onChange={(v) => setSlot(i, { open: v })} />
                  <TText variant="bodySm" muted>to</TText>
                  <TimeField value={s.close} onChange={(v) => setSlot(i, { close: v })} />
                  <TextInput
                    value={s.label || ""}
                    onChangeText={(v) => setSlot(i, { label: v })}
                    placeholder="label"
                    placeholderTextColor={colors.textMuted}
                    style={styles.labelField}
                  />
                  <TouchableOpacity onPress={() => delSlot(i)} style={styles.delBtn}>
                    <Feather name="x" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Aarti timings */}
              <View style={styles.sectionHead}>
                <TText variant="label">AARTI TIMINGS</TText>
                <TouchableOpacity onPress={addAarti} style={styles.addBtn} testID="temple-add-aarti">
                  <Feather name="plus" size={14} color={colors.primaryDark} />
                  <TText variant="caption" color={colors.primaryDark} style={{ marginLeft: 4 }}>Add aarti</TText>
                </TouchableOpacity>
              </View>
              {form.aarti_timings.length === 0 && (
                <TText variant="caption" muted style={{ marginBottom: 8 }}>No aarti timings added.</TText>
              )}
              {form.aarti_timings.map((a, i) => (
                <View key={i} style={styles.slotEditRow}>
                  <TextInput
                    value={a.name}
                    onChangeText={(v) => setAarti(i, { name: v })}
                    placeholder="Mangala Aarti"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.labelField, { flex: 2 }]}
                  />
                  <TimeField value={a.time} onChange={(v) => setAarti(i, { time: v })} />
                  <TouchableOpacity onPress={() => delAarti(i)} style={styles.delBtn}>
                    <Feather name="x" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Prasad items */}
              <View style={styles.sectionHead}>
                <TText variant="label">PRASAD ITEMS (for ordering)</TText>
                <TouchableOpacity onPress={addPrasad} style={styles.addBtn} testID="temple-add-prasad">
                  <Feather name="plus" size={14} color={colors.primaryDark} />
                  <TText variant="caption" color={colors.primaryDark} style={{ marginLeft: 4 }}>Add item</TText>
                </TouchableOpacity>
              </View>
              {form.prasad_items.length === 0 && (
                <TText variant="caption" muted style={{ marginBottom: 8 }}>No prasad items. Add items pilgrims can order & pay for.</TText>
              )}
              {form.prasad_items.map((p, i) => (
                <View key={i} style={styles.prasadEdit}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <TextInput
                      value={p.name}
                      onChangeText={(v) => setPrasad(i, { name: v })}
                      placeholder="Laddu Prasad"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.labelField, { flex: 2 }]}
                    />
                    <TextInput
                      value={p.price}
                      onChangeText={(v) => setPrasad(i, { price: v.replace(/[^0-9]/g, "") })}
                      placeholder="₹ price"
                      keyboardType="numeric"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.labelField, { width: 84 }]}
                    />
                    <TouchableOpacity onPress={() => delPrasad(i)} style={styles.delBtn}>
                      <Feather name="x" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={p.description}
                    onChangeText={(v) => setPrasad(i, { description: v })}
                    placeholder="Short description (optional)"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.labelField, { marginTop: 8 }]}
                  />
                </View>
              ))}

              {/* Crowd level */}
              <TText variant="label" style={{ marginTop: spacing.md, marginBottom: 8 }}>CROWD LEVEL (optional)</TText>
              <View style={styles.chipWrap}>
                <TouchableOpacity onPress={() => setForm({ ...form, crowd_level: null })} style={[styles.selChip, !form.crowd_level && styles.selChipActive]}>
                  <TText variant="bodySm" weight="600" color={!form.crowd_level ? "#fff" : colors.textMuted}>None</TText>
                </TouchableOpacity>
                {CROWD_OPTIONS.map((c) => (
                  <TouchableOpacity key={c.key} onPress={() => setForm({ ...form, crowd_level: c.key })} style={[styles.selChip, form.crowd_level === c.key && styles.selChipActive]}>
                    <TText variant="bodySm" weight="600" color={form.crowd_level === c.key ? "#fff" : colors.textMuted}>{c.label}</TText>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: spacing.md }} />
              <TInput label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="About the temple" multiline />
              <TInput label="Entry & info" value={form.entry_info} onChangeText={(v) => setForm({ ...form, entry_info: v })} placeholder="Free entry. Rules, fees..." multiline />
              <TInput label="Special note (festival/temporary)" value={form.special_note} onChangeText={(v) => setForm({ ...form, special_note: v })} placeholder="Heavy crowd on Ekadashi — arrive early" multiline />

              <View style={styles.switchRow}>
                <TText variant="body" weight="600">Verified (visible to pilgrims)</TText>
                <Switch value={form.verified} onValueChange={(v) => setForm({ ...form, verified: v })} trackColor={{ true: colors.success }} />
              </View>
              <View style={styles.switchRow}>
                <TText variant="body" weight="600">Featured / Popular</TText>
                <Switch value={form.featured} onValueChange={(v) => setForm({ ...form, featured: v })} trackColor={{ true: colors.primary }} />
              </View>

              <TButton label={editingId ? "Save changes" : "Add temple"} onPress={save} loading={saving} testID="temple-form-save" style={{ marginTop: spacing.md }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="HH:MM"
      placeholderTextColor={colors.textMuted}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      style={styles.timeField}
    />
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
  rowIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFF5E1", alignItems: "center", justifyContent: "center" },
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
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, marginBottom: spacing.sm },
  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  slotEditRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  prasadEdit: { marginBottom: 12, padding: 10, borderRadius: radius.md, backgroundColor: colors.bgAlt },
  timeField: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: colors.text, width: 64, textAlign: "center",
  },
  labelField: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: colors.text,
  },
  delBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.errorBg },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
});
