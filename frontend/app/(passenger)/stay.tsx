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
import { Stay, stayTypeLabel, AMENITY_MAP, priceLabel } from "../../src/stays";

export default function StayDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stay, setStay] = useState<Stay | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api<Stay>(`/stays/${id}`, { auth: false });
      setStay(res);
    } catch {
      notify("Unavailable", "This stay could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const call = () => {
    if (!stay?.contact_phone) return;
    Linking.openURL(`tel:${stay.contact_phone}`).catch(() => notify("Could not open dialer"));
  };

  const whatsapp = () => {
    const num = (stay?.whatsapp || stay?.contact_phone || "").replace(/[^0-9]/g, "");
    if (!num) return;
    const phone = num.length === 10 ? `91${num}` : num; // assume India if 10-digit
    const text = encodeURIComponent(`Jai Shri Radhe 🙏 I found "${stay?.name}" on TirthRide and would like to ask about a room.`);
    const url = `whatsapp://send?phone=${phone}&text=${text}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://wa.me/${phone}?text=${text}`).catch(() => notify("WhatsApp not installed"))
    );
  };

  const directions = () => {
    if (!stay) return;
    if (stay.lat != null && stay.lng != null) {
      const url = Platform.select({
        ios: `maps://?daddr=${stay.lat},${stay.lng}`,
        android: `geo:0,0?q=${stay.lat},${stay.lng}(${encodeURIComponent(stay.name)})`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${stay.lat},${stay.lng}`,
      });
      Linking.openURL(url!).catch(() =>
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${stay.lat},${stay.lng}`)
      );
    } else {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stay.address)}`;
      Linking.openURL(url).catch(() => notify("Could not open maps"));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }
  if (!stay) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}><TText muted>Stay not found.</TText></View>
      </SafeAreaView>
    );
  }

  const amenities = stay.amenities || [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="passenger-stay-detail">
      <Header onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero image / placeholder */}
        <View style={styles.hero}>
          {stay.photos && stay.photos.length > 0 ? (
            <Image source={{ uri: stay.photos[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Feather name="home" size={48} color={colors.primaryDark} />
          )}
          {stay.featured && (
            <View style={styles.featuredBadge}>
              <Feather name="star" size={11} color="#fff" />
              <TText variant="caption" color="#fff" style={{ marginLeft: 4 }}>FEATURED</TText>
            </View>
          )}
        </View>

        {/* Title block */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <TText variant="h2">{stay.name}</TText>
            <TText variant="bodySm" muted style={{ marginTop: 4 }}>
              {stayTypeLabel(stay.type)}{stay.area ? ` · ${stay.area}` : ""}
            </TText>
          </View>
          <View style={styles.verifiedTag}>
            <Feather name="check-circle" size={13} color={colors.success} />
            <TText variant="caption" color={colors.success} style={{ marginLeft: 4 }}>VERIFIED</TText>
          </View>
        </View>

        {/* Key facts */}
        <View style={styles.factsRow}>
          <Fact icon="tag" label="Price" value={priceLabel(stay)} />
          {stay.capacity != null && <Fact icon="users" label="Capacity" value={`${stay.capacity}`} />}
          {stay.distance_km != null && <Fact icon="map-pin" label="Distance" value={`${stay.distance_km} km`} />}
          <Fact icon={stay.available ? "check" : "x"} label="Status" value={stay.available ? "Available" : "Full"} tint={stay.available ? colors.success : colors.error} />
        </View>

        {stay.description ? (
          <Card style={{ marginTop: spacing.lg }}>
            <TText variant="body">{stay.description}</TText>
          </Card>
        ) : null}

        {/* Address */}
        <SectionTitle icon="map-pin" title="Address" />
        <Card flat>
          <TText variant="body">{stay.address}</TText>
          <TouchableOpacity onPress={directions} style={styles.inlineLink}>
            <Feather name="navigation" size={14} color={colors.primary} />
            <TText variant="bodySm" weight="700" color={colors.primary} style={{ marginLeft: 6 }}>Get Directions</TText>
          </TouchableOpacity>
        </Card>

        {/* Room types */}
        {stay.room_types && stay.room_types.length > 0 && (
          <>
            <SectionTitle icon="grid" title="Room Types" />
            <View style={styles.tagWrap}>
              {stay.room_types.map((rt) => (
                <View key={rt} style={styles.roomTag}>
                  <TText variant="bodySm" weight="600">{rt}</TText>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Amenities */}
        {amenities.length > 0 && (
          <>
            <SectionTitle icon="check-square" title="Facilities" />
            <View style={styles.amenityGrid}>
              {amenities.map((key) => {
                const a = AMENITY_MAP[key];
                if (!a) return null;
                return (
                  <View key={key} style={styles.amenityItem}>
                    <View style={styles.amenityIcon}>
                      <Feather name={a.icon} size={16} color={colors.primaryDark} />
                    </View>
                    <TText variant="bodySm" weight="600" style={{ flex: 1 }}>{a.label}</TText>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky contact actions */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={[styles.actionBtn, styles.callBtn]} onPress={call} activeOpacity={0.85} testID="stay-call">
          <Feather name="phone" size={18} color="#fff" />
          <TText variant="body" weight="700" color="#fff" style={{ marginLeft: 8 }}>Call</TText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.waBtn]} onPress={whatsapp} activeOpacity={0.85} testID="stay-whatsapp">
          <Feather name="message-circle" size={18} color="#fff" />
          <TText variant="body" weight="700" color="#fff" style={{ marginLeft: 8 }}>WhatsApp</TText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} testID="stay-back">
        <Feather name="arrow-left" size={20} color={colors.text} />
      </TouchableOpacity>
      <TText variant="bodyLg" weight="700">Stay Details</TText>
      <View style={{ width: 40 }} />
    </View>
  );
}

function Fact({ icon, label, value, tint }: any) {
  return (
    <View style={styles.fact}>
      <Feather name={icon} size={15} color={tint || colors.primaryDark} />
      <TText variant="bodySm" weight="700" style={{ marginTop: 4 }} color={tint}>{value}</TText>
      <TText variant="caption" muted>{label}</TText>
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
    height: 180, borderRadius: radius.lg, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  featuredBadge: {
    position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center",
    backgroundColor: colors.primaryDark, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
  },
  verifiedTag: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.successBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
  },
  factsRow: {
    flexDirection: "row", marginTop: spacing.lg, backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md,
  },
  fact: { flex: 1, alignItems: "center", gap: 1 },
  sectionTitle: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.sm },
  inlineLink: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roomTag: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
  },
  amenityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  amenityItem: {
    flexDirection: "row", alignItems: "center", width: "47%",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 10,
  },
  amenityIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginRight: 8,
  },
  actionBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", gap: 12, padding: spacing.md, paddingBottom: spacing.lg,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    ...shadows.lg,
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: radius.pill,
  },
  callBtn: { backgroundColor: colors.primary },
  waBtn: { backgroundColor: "#25D366" },
});
