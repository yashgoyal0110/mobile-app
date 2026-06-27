import React, { useCallback, useEffect, useState } from "react";
import {
  View, StyleSheet, TouchableOpacity, RefreshControl,
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
import { Temple, openStatus, CROWD_META } from "../../src/temples";

export default function TemplesScreen() {
  const router = useRouter();
  const [temples, setTemples] = useState<Temple[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        let granted = status === "granted";
        if (!granted) granted = (await Location.requestForegroundPermissionsAsync()).status === "granted";
        if (!granted) return;
        const pos = await Location.getLastKnownPositionAsync();
        if (pos) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {}
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (coords) { params.set("lat", String(coords.lat)); params.set("lng", String(coords.lng)); }
      const res = await api<{ temples: Temple[] }>(`/temples?${params.toString()}`, { auth: false });
      setTemples(res.temples || []);
    } catch {
      setTemples([]);
    } finally {
      setLoading(false);
    }
  }, [q, coords]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="passenger-temples-screen">
      <View style={styles.header}>
        <TText variant="caption" muted>DARSHAN & AARTI TIMINGS</TText>
        <TText variant="h2" style={{ marginTop: 2 }}>Temples of Govardhan</TText>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          testID="temples-search"
          value={q}
          onChangeText={setQ}
          placeholder="Search temple, deity or area"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => setQ("")}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={temples}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="map-pin" size={40} color={colors.textSubtle} />
              <TText variant="bodyLg" weight="700" style={{ marginTop: spacing.md }}>No temples found</TText>
              <TText variant="bodySm" muted align="center" style={{ marginTop: 4 }}>Try a different search.</TText>
            </View>
          }
          renderItem={({ item }) => (
            <TempleCard temple={item} onPress={() => router.push({ pathname: "/(passenger)/temple", params: { id: item.id } })} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function TempleCard({ temple, onPress }: { temple: Temple; onPress: () => void }) {
  const status = openStatus(temple.darshan_slots);
  const crowd = temple.crowd_level ? CROWD_META[temple.crowd_level] : null;
  const hasPhoto = temple.photos && temple.photos.length > 0;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.card} testID={`temple-card-${temple.id}`}>
      <View style={styles.cardImage}>
        {hasPhoto ? (
          <Image source={{ uri: temple.photos![0] }} style={styles.imageFill} contentFit="cover" />
        ) : (
          <Feather name="home" size={26} color={colors.parikrama} />
        )}
        {temple.featured && (
          <View style={styles.featuredBadge}>
            <Feather name="star" size={10} color="#fff" />
            <TText variant="caption" color="#fff" style={{ marginLeft: 3 }}>POPULAR</TText>
          </View>
        )}
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <TText variant="bodyLg" weight="700" numberOfLines={1}>{temple.name}</TText>
        {!!temple.deity && <TText variant="caption" muted numberOfLines={1} style={{ marginTop: 2 }}>{temple.deity}</TText>}
        <View style={styles.metaRow}>
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <View style={[styles.dot, { backgroundColor: status.tint }]} />
            <TText variant="caption" color={status.tint}>{status.label}</TText>
          </View>
        </View>
        <View style={styles.metaRow}>
          {crowd && (
            <View style={[styles.metaPill, { backgroundColor: crowd.bg }]}>
              <Feather name="users" size={11} color={crowd.fg} />
              <TText variant="caption" color={crowd.fg} style={{ marginLeft: 4 }}>{crowd.label}</TText>
            </View>
          )}
          {temple.distance_km != null && (
            <View style={[styles.metaPill, { backgroundColor: colors.infoBg }]}>
              <Feather name="map-pin" size={11} color={colors.info} />
              <TText variant="caption" color={colors.info} style={{ marginLeft: 4 }}>{temple.distance_km} km</TText>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: 12 },
  empty: { alignItems: "center", paddingTop: spacing.xxl },
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadows.sm,
  },
  cardImage: {
    width: 64, height: 64, borderRadius: radius.md,
    backgroundColor: "#FFF5E1", alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  imageFill: { width: "100%", height: "100%" },
  featuredBadge: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.parikrama, paddingVertical: 2,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  statusPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  metaPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
});
