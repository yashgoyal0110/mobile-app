import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { TText } from "../../src/components/TText";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { api } from "../../src/api";
import { colors, radius, spacing } from "../../src/theme";

export default function PassengerRides() {
  const router = useRouter();
  const [rides, setRides] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ rides: any[] }>("/rides/mine");
      setRides(r.rides || []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="passenger-rides-screen">
      <View style={styles.header}>
        <TText variant="h2">My Rides</TText>
        <TText variant="bodySm" muted style={{ marginTop: 4 }}>{rides.length} rides total</TText>
      </View>
      <FlatList
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
        data={rides}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`ride-row-${item.id}`}
            onPress={() => router.push({ pathname: "/(passenger)/booking", params: { id: item.id } })}
            activeOpacity={0.85}
            style={{ marginBottom: spacing.md }}
          >
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <TText variant="caption" muted>{new Date(item.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</TText>
                  <TText variant="bodyLg" weight="700" style={{ marginTop: 4 }}>{labelFor(item.type)}</TText>
                  {item.pickup && item.drop && (
                    <TText variant="bodySm" muted style={{ marginTop: 4 }}>
                      {item.pickup.name} → {item.drop.name}
                    </TText>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <TText variant="h3">₹{item.fare}</TText>
                  <View style={{ marginTop: 4 }}>
                    <StatusPill status={item.status} />
                  </View>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <View style={styles.emptyIcon}>
              <Feather name="clock" size={32} color={colors.primaryDark} />
            </View>
            <TText variant="h3" style={{ marginTop: spacing.md }}>No rides yet</TText>
            <TText variant="bodySm" muted style={{ marginTop: 6 }}>Book your first parikrama or local ride</TText>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function labelFor(t: string) {
  return ({ local: "Local Ride", poochari: "Poochari Parikrama", radhakund: "Radhakund Parikrama", combined: "Combined Parikrama" } as any)[t] || t;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: 0 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
});
