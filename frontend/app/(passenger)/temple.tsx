import React, { useCallback, useState } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Linking, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { TText } from "../../src/components/TText";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { notify } from "../../src/utils/dialog";
import { colors, radius, spacing, shadows } from "../../src/theme";
import { Temple, openStatus, slotLabel, fmtTime, CROWD_META } from "../../src/temples";

export default function TempleDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [temple, setTemple] = useState<Temple | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setTemple(await api<Temple>(`/temples/${id}`, { auth: false }));
    } catch {
      notify("Unavailable", "This temple could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const directions = () => {
    if (!temple) return;
    if (temple.lat != null && temple.lng != null) {
      const url = Platform.select({
        ios: `maps://?daddr=${temple.lat},${temple.lng}`,
        android: `geo:0,0?q=${temple.lat},${temple.lng}(${encodeURIComponent(temple.name)})`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${temple.lat},${temple.lng}`,
      });
      Linking.openURL(url!).catch(() =>
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${temple.lat},${temple.lng}`)
      );
    } else {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(temple.address)}`)
        .catch(() => notify("Could not open maps"));
    }
  };

  const call = () => {
    if (!temple?.contact_phone) return;
    Linking.openURL(`tel:${temple.contact_phone}`).catch(() => notify("Could not open dialer"));
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.primary} /></View></SafeAreaView>;
  }
  if (!temple) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}><TText muted>Temple not found.</TText></View>
      </SafeAreaView>
    );
  }

  const status = openStatus(temple.darshan_slots);
  const crowd = temple.crowd_level ? CROWD_META[temple.crowd_level] : null;
  const slots = temple.darshan_slots || [];
  const aartis = temple.aarti_timings || [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="passenger-temple-detail">
      <Header onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {temple.photos && temple.photos.length > 0 ? (
            <Image source={{ uri: temple.photos[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Feather name="home" size={48} color={colors.parikrama} />
          )}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <TText variant="h2">{temple.name}</TText>
          {!!temple.deity && <TText variant="bodySm" muted style={{ marginTop: 4 }}>{temple.deity}{temple.area ? ` · ${temple.area}` : ""}</TText>}
        </View>

        {/* Live status row */}
        <View style={styles.statusRow}>
          <View style={[styles.bigStatus, { backgroundColor: status.bg }]}>
            <View style={[styles.dot, { backgroundColor: status.tint }]} />
            <TText variant="bodySm" weight="700" color={status.tint}>{status.label}</TText>
          </View>
          {crowd && (
            <View style={[styles.bigStatus, { backgroundColor: crowd.bg }]}>
              <Feather name="users" size={13} color={crowd.fg} />
              <TText variant="bodySm" weight="700" color={crowd.fg} style={{ marginLeft: 5 }}>{crowd.label}</TText>
            </View>
          )}
        </View>
        {crowd && temple.crowd_updated_at && (
          <TText variant="caption" muted style={{ marginTop: 6 }}>
            Crowd updated {new Date(temple.crowd_updated_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </TText>
        )}

        {!!temple.special_note && (
          <Card style={{ marginTop: spacing.lg, backgroundColor: colors.warningBg, borderColor: "#F0D9A8" }} flat>
            <View style={{ flexDirection: "row" }}>
              <Feather name="alert-triangle" size={16} color="#A36B00" style={{ marginTop: 2 }} />
              <TText variant="bodySm" weight="600" style={{ flex: 1, marginLeft: 8 }} color="#7A5200">{temple.special_note}</TText>
            </View>
          </Card>
        )}

        {!!temple.description && (
          <Card style={{ marginTop: spacing.lg }}>
            <TText variant="body">{temple.description}</TText>
          </Card>
        )}

        {/* Darshan timings */}
        <SectionTitle icon="clock" title="Darshan Timings" />
        {slots.length === 0 ? (
          <TText variant="bodySm" muted>Timings not available.</TText>
        ) : (
          <Card flat style={{ gap: 0 }}>
            {slots.map((s, i) => (
              <View key={i} style={[styles.slotRow, i > 0 && styles.divider]}>
                <View style={styles.slotIcon}><Feather name="sun" size={14} color={colors.parikrama} /></View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <TText variant="body" weight="700">{slotLabel(s)}</TText>
                  {!!s.label && <TText variant="caption" muted>{s.label}</TText>}
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Aarti timings */}
        {aartis.length > 0 && (
          <>
            <SectionTitle icon="bell" title="Aarti Timings" />
            <View style={styles.aartiWrap}>
              {aartis.map((a, i) => (
                <View key={i} style={styles.aartiChip}>
                  <TText variant="caption" muted>{a.name}</TText>
                  <TText variant="bodySm" weight="700" color={colors.primaryDark}>{fmtTime(a.time)}</TText>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Address */}
        <SectionTitle icon="map-pin" title="Location" />
        <Card flat>
          <TText variant="body">{temple.address}</TText>
          {temple.distance_km != null && <TText variant="bodySm" muted style={{ marginTop: 4 }}>{temple.distance_km} km away</TText>}
          <TouchableOpacity onPress={directions} style={styles.inlineLink}>
            <Feather name="navigation" size={14} color={colors.primary} />
            <TText variant="bodySm" weight="700" color={colors.primary} style={{ marginLeft: 6 }}>Get Directions</TText>
          </TouchableOpacity>
        </Card>

        {!!temple.entry_info && (
          <>
            <SectionTitle icon="info" title="Entry & Info" />
            <Card flat><TText variant="body">{temple.entry_info}</TText></Card>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky actions */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.dark, flex: temple.contact_phone ? 1 : 2 }]} onPress={() => router.push("/(passenger)/home")} activeOpacity={0.85}>
          <Feather name="navigation-2" size={18} color="#fff" />
          <TText variant="body" weight="700" color="#fff" style={{ marginLeft: 8 }}>Book Rickshaw</TText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.dirBtn]} onPress={directions} activeOpacity={0.85} testID="temple-directions">
          <Feather name="map" size={18} color="#fff" />
          <TText variant="body" weight="700" color="#fff" style={{ marginLeft: 8 }}>Directions</TText>
        </TouchableOpacity>
        {!!temple.contact_phone && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success, flex: 0.7 }]} onPress={call} activeOpacity={0.85}>
            <Feather name="phone" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} testID="temple-back">
        <Feather name="arrow-left" size={20} color={colors.text} />
      </TouchableOpacity>
      <TText variant="bodyLg" weight="700">Temple Details</TText>
      <View style={{ width: 40 }} />
    </View>
  );
}

function SectionTitle({ icon, title }: any) {
  return (
    <View style={styles.sectionTitle}>
      <Feather name={icon} size={15} color={colors.textMuted} />
      <TText variant="h3" style={{ marginLeft: 8, fontSize: 16 }}>{title}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg },
  hero: {
    height: 180, borderRadius: radius.lg, backgroundColor: "#FFF5E1",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  statusRow: { flexDirection: "row", gap: 8, marginTop: spacing.md, flexWrap: "wrap" },
  bigStatus: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  sectionTitle: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.sm },
  slotRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  slotIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFF5E1", alignItems: "center", justifyContent: "center" },
  aartiWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  aartiChip: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8, minWidth: "30%",
  },
  inlineLink: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  actionBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", gap: 10, padding: spacing.md, paddingBottom: spacing.lg,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, ...shadows.lg,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: radius.pill },
  dirBtn: { backgroundColor: colors.primary, flex: 1 },
});
