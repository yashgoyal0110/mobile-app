/**
 * Full-screen location search sheet.
 *
 * Search-first UX similar to Ola/Uber:
 *  - Live debounced search via /api/geo/search (Nominatim, scoped to region)
 *  - "Use my current location" via expo-location + /api/geo/reverse
 *  - Saved landmarks (admin-managed, from /api/config/fare)
 *  - "Pick on map" mode that swaps the list for an interactive Leaflet map
 *
 * Returns the selected LatLng via onSelect callback.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { TText } from "./TText";
import { api } from "../api";
import MapPicker, { LatLng } from "./MapPicker";
import { colors, radius, spacing, shadows } from "../theme";

interface Props {
  visible: boolean;
  mode: "pickup" | "drop";
  initial?: LatLng | null;
  landmarks?: { id: string; name: string; lat: number; lng: number }[];
  region?: { bbox: any; center: any } | null;
  onClose: () => void;
  onSelect: (coord: LatLng) => void;
}

export default function LocationSearchSheet({
  visible,
  mode,
  initial,
  landmarks = [],
  region,
  onClose,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LatLng[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapPin, setMapPin] = useState<LatLng | null>(initial || null);
  const [usingGps, setUsingGps] = useState(false);
  const debounceRef = useRef<any>(null);

  // Reset state when reopened
  useEffect(() => {
    if (visible) {
      setQuery("");
      setResults([]);
      setShowMap(false);
      setMapPin(initial || null);
    }
  }, [visible, initial]);

  // Debounced search as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api<{ results: LatLng[] }>(
          `/geo/search?q=${encodeURIComponent(query.trim())}`,
          { auth: false }
        );
        setResults(r.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query]);

  const useCurrent = useCallback(async () => {
    setUsingGps(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Allow location access to use your current spot.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      let name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      let address = "Current location";
      try {
        const r = await api<any>(`/geo/reverse?lat=${lat}&lng=${lng}`, { auth: false });
        if (r.name) name = r.name;
        if (r.address) address = r.address;
      } catch {}
      onSelect({ lat, lng, name, address });
      onClose();
    } catch (e: any) {
      Alert.alert("Could not get location", e.message || "Try again");
    } finally {
      setUsingGps(false);
    }
  }, [onSelect, onClose]);

  const pick = (item: LatLng) => {
    onSelect(item);
    onClose();
  };

  const confirmMapPin = async () => {
    if (!mapPin) return;
    let { name, address } = mapPin;
    if (!name) {
      try {
        const r = await api<any>(`/geo/reverse?lat=${mapPin.lat}&lng=${mapPin.lng}`, { auth: false });
        name = r.name || `${mapPin.lat.toFixed(4)}, ${mapPin.lng.toFixed(4)}`;
        address = r.address;
      } catch {
        name = `${mapPin.lat.toFixed(4)}, ${mapPin.lng.toFixed(4)}`;
      }
    }
    onSelect({ ...mapPin, name, address });
    onClose();
  };

  const filteredLandmarks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return landmarks;
    return landmarks.filter((l) => l.name.toLowerCase().includes(q));
  }, [query, landmarks]);

  const showLandmarks = filteredLandmarks.length > 0 && (query.trim().length === 0 || results.length === 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="loc-sheet-close">
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <TText variant="h3" style={{ marginLeft: spacing.md, flex: 1 }}>
              {mode === "pickup" ? "Set pickup" : "Set drop"}
            </TText>
          </View>

          {/* Search input */}
          <View style={styles.searchWrap}>
            <View style={styles.searchBox}>
              <View style={[styles.dot, { backgroundColor: mode === "pickup" ? "#2A8F47" : "#D64545" }]} />
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${mode} place, area or landmark`}
                placeholderTextColor={colors.textMuted}
                autoFocus
                returnKeyType="search"
                testID="loc-search-input"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="loc-search-clear">
                  <Feather name="x" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
              {loading && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
              )}
            </View>
          </View>

          {/* Quick actions */}
          {!showMap && (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionChip} onPress={useCurrent} disabled={usingGps} testID="loc-use-current">
                {usingGps ? (
                  <ActivityIndicator size="small" color={colors.primaryDark} />
                ) : (
                  <Feather name="crosshair" size={14} color={colors.primaryDark} />
                )}
                <TText variant="bodySm" weight="700" color={colors.primaryDark} style={{ marginLeft: 6 }}>
                  Use current location
                </TText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionChip} onPress={() => setShowMap(true)} testID="loc-pick-on-map">
                <Feather name="map" size={14} color={colors.primaryDark} />
                <TText variant="bodySm" weight="700" color={colors.primaryDark} style={{ marginLeft: 6 }}>
                  Pick on map
                </TText>
              </TouchableOpacity>
            </View>
          )}

          {/* Body: list OR map */}
          {showMap ? (
            <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
              <MapPicker
                pickup={mode === "pickup" ? mapPin : null}
                drop={mode === "drop" ? mapPin : null}
                mode={mode}
                onChange={(_m, c) => setMapPin(c)}
                bbox={region?.bbox}
                center={region?.center}
                height={420}
              />
              <View style={{ flexDirection: "row", gap: 12, marginTop: spacing.md }}>
                <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => setShowMap(false)} testID="loc-map-back">
                  <TText variant="body" weight="700">Back to search</TText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, !mapPin && { opacity: 0.5 }]}
                  onPress={confirmMapPin}
                  disabled={!mapPin}
                  testID="loc-map-confirm"
                >
                  <Feather name="check" size={16} color={colors.textInverse} />
                  <TText variant="body" weight="700" color={colors.textInverse} style={{ marginLeft: 6 }}>
                    Confirm this point
                  </TText>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={results.length > 0 ? results : []}
              keyExtractor={(_, i) => `r-${i}`}
              ListHeaderComponent={
                <View>
                  {showLandmarks && (
                    <View style={styles.section}>
                      <TText variant="caption" muted style={styles.sectionTitle}>
                        SAVED LANDMARKS
                      </TText>
                      {filteredLandmarks.map((lm) => (
                        <TouchableOpacity
                          key={lm.id}
                          style={styles.row}
                          onPress={() => pick({ lat: lm.lat, lng: lm.lng, name: lm.name })}
                          testID={`loc-landmark-${lm.id}`}
                        >
                          <View style={styles.rowIcon}>
                            <Feather name="map-pin" size={16} color={colors.primaryDark} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <TText variant="body" weight="600">{lm.name}</TText>
                            <TText variant="caption" muted>
                              {lm.lat.toFixed(4)}, {lm.lng.toFixed(4)}
                            </TText>
                          </View>
                          <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {results.length > 0 && (
                    <TText variant="caption" muted style={[styles.sectionTitle, { marginTop: showLandmarks ? spacing.md : 0 }]}>
                      SEARCH RESULTS
                    </TText>
                  )}
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.row} onPress={() => pick(item)} testID={`loc-result-${item.lat}-${item.lng}`}>
                  <View style={[styles.rowIcon, { backgroundColor: "#FFF1E0" }]}>
                    <Feather name="search" size={16} color={colors.parikrama} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <TText variant="body" weight="600" numberOfLines={1}>{item.name}</TText>
                    {item.address ? <TText variant="caption" muted numberOfLines={2}>{item.address}</TText> : null}
                  </View>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              ListEmptyComponent={
                query.trim().length >= 2 && !loading && !showLandmarks ? (
                  <View style={styles.empty}>
                    <Feather name="search" size={32} color={colors.textMuted} />
                    <TText variant="body" muted style={{ marginTop: 10 }} align="center">
                      No matches for "{query}".{"\n"}Try "Pick on map" or "Use current location".
                    </TText>
                  </View>
                ) : null
              }
              contentContainerStyle={{ paddingBottom: 60 }}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    ...shadows.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  input: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 15, color: colors.text },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  section: { marginTop: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.lg, paddingBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: 12 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: 64 },
  empty: { padding: spacing.xl, alignItems: "center" },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  btnOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnPrimary: { backgroundColor: colors.primary },
});
