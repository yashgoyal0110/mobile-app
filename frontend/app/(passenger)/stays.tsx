import React, { useCallback, useEffect, useState } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { TText } from "../../src/components/TText";
import { api } from "../../src/api";
import { colors, radius, spacing, shadows } from "../../src/theme";
import { Stay, STAY_TYPES, stayTypeLabel, AMENITY_MAP, priceLabel } from "../../src/stays";

const QUICK_AMENITIES = ["parking", "food", "family_rooms", "elderly_friendly"];

export default function StaysScreen() {
  const router = useRouter();
  const [stays, setStays] = useState<Stay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [amenityFilters, setAmenityFilters] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Best-effort device location for proximity sorting; silently ignored if denied.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        let granted = status === "granted";
        if (!granted) {
          const req = await Location.requestForegroundPermissionsAsync();
          granted = req.status === "granted";
        }
        if (!granted) return;
        const pos = await Location.getLastKnownPositionAsync();
        if (pos) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {}
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (amenityFilters.length) params.set("amenity", amenityFilters.join(","));
      if (q.trim()) params.set("q", q.trim());
      if (coords) {
        params.set("lat", String(coords.lat));
        params.set("lng", String(coords.lng));
      }
      const res = await api<{ stays: Stay[] }>(`/stays?${params.toString()}`, { auth: false });
      setStays(res.stays || []);
    } catch {
      setStays([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, amenityFilters, q, coords]);

  // Debounce search + filter changes.
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleAmenity = (key: string) =>
    setAmenityFilters((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="passenger-stays-screen">
      {/* Header */}
      <View style={styles.header}>
        <TText variant="caption" muted>VERIFIED PILGRIM STAYS</TText>
        <TText variant="h2" style={{ marginTop: 2 }}>Dharamshala & Guest Houses</TText>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          testID="stays-search"
          value={q}
          onChangeText={setQ}
          placeholder="Search by name or area"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => setQ("")}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Chip label="All" active={!typeFilter} onPress={() => setTypeFilter(null)} />
        {STAY_TYPES.map((t) => (
          <Chip key={t.key} label={t.label} icon={t.icon} active={typeFilter === t.key} onPress={() => setTypeFilter(typeFilter === t.key ? null : t.key)} />
        ))}
      </ScrollView>

      {/* Amenity quick filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {QUICK_AMENITIES.map((key) => (
          <Chip key={key} label={AMENITY_MAP[key]?.label || key} icon={AMENITY_MAP[key]?.icon} active={amenityFilters.includes(key)} onPress={() => toggleAmenity(key)} subtle />
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={stays}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="home" size={40} color={colors.textSubtle} />
              <TText variant="bodyLg" weight="700" style={{ marginTop: spacing.md }}>No stays found</TText>
              <TText variant="bodySm" muted align="center" style={{ marginTop: 4 }}>
                Try clearing filters or search a different area.
              </TText>
            </View>
          }
          renderItem={({ item }) => (
            <StayCard stay={item} onPress={() => router.push({ pathname: "/(passenger)/stay", params: { id: item.id } })} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Chip({ label, icon, active, onPress, subtle }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, active && (subtle ? styles.chipActiveSubtle : styles.chipActive)]}
    >
      {icon && <Feather name={icon} size={13} color={active ? (subtle ? colors.primaryDark : "#fff") : colors.textMuted} style={{ marginRight: 5 }} />}
      <TText variant="bodySm" weight="700" color={active ? (subtle ? colors.primaryDark : "#fff") : colors.textMuted}>
        {label}
      </TText>
    </TouchableOpacity>
  );
}

function StayCard({ stay, onPress }: { stay: Stay; onPress: () => void }) {
  const hasPhoto = stay.photos && stay.photos.length > 0;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.card} testID={`stay-card-${stay.id}`}>
      <View style={styles.cardImage}>
        {hasPhoto ? (
          <Image source={{ uri: stay.photos![0] }} style={styles.imageFill} contentFit="cover" />
        ) : (
          <Feather name="home" size={26} color={colors.primaryDark} />
        )}
        {stay.featured && (
          <View style={styles.featuredBadge}>
            <Feather name="star" size={10} color="#fff" />
            <TText variant="caption" color="#fff" style={{ marginLeft: 3 }}>FEATURED</TText>
          </View>
        )}
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TText variant="bodyLg" weight="700" numberOfLines={1} style={{ flex: 1 }}>{stay.name}</TText>
          <Feather name="check-circle" size={14} color={colors.success} />
        </View>
        <TText variant="caption" muted style={{ marginTop: 2 }}>
          {stayTypeLabel(stay.type)}{stay.area ? ` · ${stay.area}` : ""}
        </TText>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Feather name="tag" size={11} color={colors.primaryDark} />
            <TText variant="caption" color={colors.primaryDark} style={{ marginLeft: 4 }}>{priceLabel(stay)}</TText>
          </View>
          {stay.distance_km != null && (
            <View style={[styles.metaPill, { backgroundColor: colors.infoBg }]}>
              <Feather name="map-pin" size={11} color={colors.info} />
              <TText variant="caption" color={colors.info} style={{ marginLeft: 4 }}>{stay.distance_km} km</TText>
            </View>
          )}
          {!stay.available && (
            <View style={[styles.metaPill, { backgroundColor: colors.errorBg }]}>
              <TText variant="caption" color={colors.error}>Full</TText>
            </View>
          )}
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, minHeight: 46,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  chipsRow: { paddingHorizontal: spacing.lg, gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipActiveSubtle: { backgroundColor: colors.primaryLight, borderColor: colors.primaryLighter },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: 12 },
  empty: { alignItems: "center", paddingTop: spacing.xxl },
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
    ...shadows.sm,
  },
  cardImage: {
    width: 64, height: 64, borderRadius: radius.md,
    backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  imageFill: { width: "100%", height: "100%", backgroundColor: colors.primaryLighter },
  featuredBadge: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primaryDark, paddingVertical: 2,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" },
  metaPill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill,
  },
});
