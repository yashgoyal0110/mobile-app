import React, { useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { TText } from "../src/components/TText";
import { colors, spacing } from "../src/theme";

export default function Splash() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/role-select");
    else if (user.role === "passenger") router.replace("/(passenger)/home");
    else if (user.role === "driver") router.replace("/(driver)/home");
    else router.replace("/(admin)/dashboard");
  }, [user, loading, router]);

  return (
    <View style={styles.bg} testID="splash-screen">
      <View style={styles.center}>
        <View style={styles.logo}>
          <Feather name="navigation" size={40} color="#FFFFFF" />
        </View>
        <TText variant="caption" color="#FFE0A8" align="center" style={{ letterSpacing: 4, marginTop: spacing.lg }}>
          GOVARDHAN · MATHURA
        </TText>
        <TText variant="h1" align="center" color={colors.textInverse} style={{ fontSize: 52, lineHeight: 60, marginTop: 8 }}>
          TirthRide
        </TText>
        <TText variant="bodyLg" align="center" color="#FFE0A8" style={{ marginTop: 8 }}>
          Sacred journeys, simple rides
        </TText>
        <ActivityIndicator color="#FFE0A8" size="large" style={{ marginTop: spacing.xl }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#1A2421", justifyContent: "center", padding: spacing.xl },
  center: { alignItems: "center" },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
