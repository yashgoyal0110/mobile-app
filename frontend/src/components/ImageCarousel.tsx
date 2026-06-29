/**
 * Swipeable image gallery for detail screens (stays, temples).
 * Horizontal paging + dot indicators + counter, and tap-to-zoom full screen.
 * Falls back to an icon when there are no photos. No extra dependencies —
 * uses a paging ScrollView measured via onLayout so it fills its container.
 */
import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { TText } from "./TText";
import { colors, radius, spacing } from "../theme";

type FeatherName = ComponentProps<typeof Feather>["name"];

interface Props {
  photos?: string[];
  height?: number;
  fallbackIcon?: FeatherName;
  rounded?: boolean;
  children?: React.ReactNode; // overlay content (e.g. a "featured" badge)
}

export function ImageCarousel({
  photos,
  height = 200,
  fallbackIcon = "image",
  rounded = true,
  children,
}: Props) {
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const list = (photos || []).filter(Boolean);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!w) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / w);
    if (i !== idx) setIdx(i);
  };

  return (
    <View
      style={[styles.wrap, { height }, rounded && styles.rounded]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {list.length === 0 ? (
        <View style={[styles.center, { height }]}>
          <Feather name={fallbackIcon} size={44} color={colors.primaryDark} />
        </View>
      ) : w > 0 ? (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            testID="image-carousel"
          >
            {list.map((uri, i) => (
              <TouchableOpacity key={i} activeOpacity={0.95} onPress={() => setZoom(i)} style={{ width: w, height }}>
                <Image source={{ uri }} style={{ width: w, height }} contentFit="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {list.length > 1 && (
            <>
              <View style={styles.counter}>
                <TText variant="caption" color="#fff">{idx + 1}/{list.length}</TText>
              </View>
              <View style={styles.dots} pointerEvents="none">
                {list.map((_, i) => (
                  <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
                ))}
              </View>
            </>
          )}
        </>
      ) : null}

      {children}

      {/* Full-screen zoom */}
      <Modal visible={zoom !== null} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomBg} onPress={() => setZoom(null)}>
          {zoom !== null && (
            <Image source={{ uri: list[zoom] }} style={styles.zoomImg} contentFit="contain" />
          )}
          <TText variant="caption" color="#ffffffaa" style={{ marginTop: spacing.lg }}>
            {zoom !== null && list.length > 1 ? `${zoom + 1} / ${list.length} · ` : ""}Tap to close
          </TText>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.primaryLight, overflow: "hidden", position: "relative" },
  rounded: { borderRadius: radius.lg },
  center: { width: "100%", alignItems: "center", justifyContent: "center" },
  counter: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  dots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  dotActive: { width: 18, backgroundColor: "#fff" },
  zoomBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  zoomImg: { width: "100%", height: "72%" },
});
