import React, { useEffect } from "react";
import { View, StyleSheet, ImageBackground, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth";
import { TText } from "../src/components/TText";
import { colors, spacing } from "../src/theme";

export default function Splash() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (!user) router.replace("/role-select");
      else if (user.role === "passenger") router.replace("/(passenger)/home");
      else if (user.role === "driver") router.replace("/(driver)/home");
      else router.replace("/(admin)/dashboard");
    }, 900);
    return () => clearTimeout(t);
  }, [user, loading, router]);

  return (
    <ImageBackground
      testID="splash-bg"
      source={{
        uri: "https://images.unsplash.com/photo-1765298409890-45d17b3ac8f9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHw0fHxpbmRpYW4lMjB0ZW1wbGUlMjBzdW5zZXR8ZW58MHx8fHwxNzc4NjU0NTUyfDA&ixlib=rb-4.1.0&q=85",
      }}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.center}>
          <TText variant="caption" color="#FFE0A8" align="center" style={{ letterSpacing: 4 }}>
            GOVARDHAN · MATHURA
          </TText>
          <TText variant="h1" align="center" color={colors.textInverse} style={{ fontSize: 56, lineHeight: 64, marginTop: 8 }}>
            TirthRide
          </TText>
          <TText variant="bodyLg" align="center" color="#FFE0A8" style={{ marginTop: 8 }}>
            Sacred journeys, simple rides
          </TText>
          <ActivityIndicator color="#FFE0A8" size="large" style={{ marginTop: spacing.xl }} />
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.xl },
  center: { alignItems: "center" },
});
