import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Animated, Easing, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth";
import { TText } from "../src/components/TText";
import { colors, radius, spacing } from "../src/theme";
import { shlokaOfTheDay } from "../src/shlokas";

const NATIVE = Platform.OS !== "web";
const MIN_SPLASH_MS = 2600;
const ROAD = 220; // diameter of the parikrama road
const DASHES = 12;

/**
 * FifthDigit — brand splash.
 *
 * Meaning over motion: an e-rickshaw circles the parikrama road around the
 * temple (the daily round / "come full circle"), and a Sanskrit shloka rotates
 * once per day. Built on RN's Animated API (no Reanimated / babel plugin).
 */
export default function Splash() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);
  const shloka = useMemo(() => shlokaOfTheDay(), []);

  const intro = useRef(new Animated.Value(0)).current; // scene entrance
  const roadSpin = useRef(new Animated.Value(0)).current; // lane markings drift
  const riderSpin = useRef(new Animated.Value(0)).current; // rickshaw parikrama
  const glow = useRef(new Animated.Value(0)).current; // temple halo breathing
  const textIn = useRef(new Animated.Value(0)).current; // wordmark + shloka
  const press = useRef(new Animated.Value(0)).current; // tap feedback

  useEffect(() => {
    Animated.sequence([
      Animated.spring(intro, { toValue: 1, friction: 7, tension: 55, useNativeDriver: NATIVE }),
      Animated.timing(textIn, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }),
    ]).start();

    Animated.loop(
      Animated.timing(roadSpin, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: NATIVE })
    ).start();
    Animated.loop(
      Animated.timing(riderSpin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: NATIVE })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(glow, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      ])
    ).start();

    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, [intro, roadSpin, riderSpin, glow, textIn]);

  const go = useCallback(() => {
    if (loading) return;
    if (!user) router.replace("/role-select");
    else if (user.role === "passenger") router.replace("/(passenger)/home");
    else if (user.role === "driver") router.replace("/(driver)/home");
    else router.replace("/(admin)/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && minElapsed) go();
  }, [loading, minElapsed, go]);

  const onPress = () => {
    Animated.sequence([
      Animated.timing(press, { toValue: 1, duration: 110, useNativeDriver: NATIVE }),
      Animated.spring(press, { toValue: 0, friction: 4, tension: 90, useNativeDriver: NATIVE }),
    ]).start();
    if (!loading) go();
  };

  const roadRotate = roadSpin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const riderRotate = riderSpin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const riderUpright = riderSpin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });
  const sceneScale = Animated.multiply(
    intro.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
    press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] })
  );
  const haloScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  const haloOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] });

  return (
    <Pressable style={styles.bg} onPress={onPress} testID="splash-screen">
      {/* warm horizon glow */}
      <View style={styles.horizon} />

      <View style={styles.center}>
        <TText variant="caption" color={colors.primary} align="center" style={styles.kicker}>
          श्री गोवर्धन धाम · GOVARDHAN
        </TText>

        {/* Parikrama scene */}
        <Animated.View style={[styles.scene, { opacity: intro, transform: [{ scale: sceneScale }] }]}>
          {/* breathing halo */}
          <Animated.View style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />

          {/* road band */}
          <View style={styles.road} />

          {/* lane markings drift around the road */}
          <Animated.View style={[styles.layer, { transform: [{ rotate: roadRotate }] }]}>
            {Array.from({ length: DASHES }).map((_, i) => (
              <View key={i} style={[styles.spoke, { transform: [{ rotate: `${(360 / DASHES) * i}deg` }] }]}>
                <View style={styles.dash} />
              </View>
            ))}
          </Animated.View>

          {/* e-rickshaw doing the parikrama */}
          <Animated.View style={[styles.layer, { transform: [{ rotate: riderRotate }] }]}>
            <Animated.View style={[styles.rider, { transform: [{ rotate: riderUpright }] }]}>
              <TText style={styles.riderEmoji}>🛺</TText>
            </Animated.View>
          </Animated.View>

          {/* temple core */}
          <View style={styles.core}>
            <TText style={styles.coreEmoji}>🛕</TText>
          </View>
        </Animated.View>

        {/* Wordmark */}
        <Animated.View
          style={{
            alignItems: "center",
            opacity: textIn,
            transform: [{ translateY: textIn.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }}
        >
          <View style={styles.wordmarkRow}>
            <TText style={styles.wordmark}>Fifth</TText>
            <TText style={[styles.wordmark, styles.wordmarkAccent]}>Digit</TText>
          </View>
          <TText variant="bodyLg" color={colors.darkMuted} align="center" style={{ marginTop: 4 }}>
            Come full circle
          </TText>
        </Animated.View>
      </View>

      {/* Daily shloka */}
      <Animated.View
        style={[
          styles.shlokaCard,
          { opacity: textIn, transform: [{ translateY: textIn.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
        ]}
      >
        <View style={styles.shlokaHead}>
          <View style={styles.shlokaDot} />
          <TText variant="caption" color={colors.primary} style={{ letterSpacing: 1.5 }}>
            आज का श्लोक · SHLOKA OF THE DAY
          </TText>
        </View>
        <TText align="center" color="#FFFFFF" style={styles.shlokaSa}>{shloka.sa}</TText>
        <TText align="center" color={colors.darkMuted} style={styles.shlokaTr}>{shloka.tr}</TText>
        <TText align="center" color="#E8E2D6" style={styles.shlokaEn}>“{shloka.en}”</TText>
        <TText align="center" variant="caption" color={colors.parikrama} style={{ marginTop: 8 }}>
          — {shloka.src}
        </TText>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: textIn }]}>
        <View style={styles.fDot} />
        <TText variant="caption" color={colors.darkMuted} style={{ letterSpacing: 2 }}>TAP TO BEGIN</TText>
        <View style={styles.fDot} />
      </Animated.View>
    </Pressable>
  );
}

const CORE = 92;

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#0B0C0E", alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  horizon: { position: "absolute", bottom: -120, width: 460, height: 460, borderRadius: 230, backgroundColor: colors.primary, opacity: 0.1 },
  center: { alignItems: "center" },
  kicker: { letterSpacing: 2, marginBottom: spacing.lg },
  scene: { width: ROAD, height: ROAD, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  halo: { position: "absolute", width: ROAD + 60, height: ROAD + 60, borderRadius: (ROAD + 60) / 2, backgroundColor: colors.primary },
  road: {
    position: "absolute",
    width: ROAD,
    height: ROAD,
    borderRadius: ROAD / 2,
    borderWidth: 14,
    borderColor: "#23201C",
  },
  layer: { position: "absolute", width: ROAD, height: ROAD, alignItems: "center" },
  spoke: { position: "absolute", width: ROAD, height: ROAD, alignItems: "center" },
  dash: { position: "absolute", top: 4, width: 10, height: 3, borderRadius: 2, backgroundColor: "#FFD79A", opacity: 0.7 },
  rider: {
    position: "absolute",
    top: -13,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  riderEmoji: { fontSize: 22, lineHeight: 26 },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 12,
  },
  coreEmoji: { fontSize: 44, lineHeight: 50 },
  wordmarkRow: { flexDirection: "row" },
  wordmark: { fontSize: 42, lineHeight: 48, fontWeight: "800", color: "#FFFFFF", letterSpacing: -1 },
  wordmarkAccent: { color: colors.primary },
  shlokaCard: {
    position: "absolute",
    bottom: 92,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(242,107,31,0.22)",
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  shlokaHead: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  shlokaDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary, marginRight: 8 },
  shlokaSa: { fontSize: 18, lineHeight: 28, fontWeight: "700" },
  shlokaTr: { fontSize: 12, lineHeight: 16, fontStyle: "italic", marginTop: 6 },
  shlokaEn: { fontSize: 13, lineHeight: 19, marginTop: 10 },
  footer: { position: "absolute", bottom: 40, flexDirection: "row", alignItems: "center", gap: 10 },
  fDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.darkMuted, opacity: 0.6 },
});
