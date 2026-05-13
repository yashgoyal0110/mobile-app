/**
 * Modal sheet that asks user to rate the ride (1-5 stars + optional comment)
 * and optionally file a complaint. Shown after ride completion to both
 * passenger and driver.
 */
import React, { useEffect, useState } from "react";
import { Modal, View, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "./TText";
import { TButton } from "./TButton";
import { api } from "../api";
import { colors, radius, spacing, shadows } from "../theme";

const COMPLAINT_CATEGORIES: { id: string; label: string; icon: any }[] = [
  { id: "rash_driving", label: "Rash driving", icon: "alert-triangle" },
  { id: "rude_behaviour", label: "Rude behaviour", icon: "frown" },
  { id: "overcharge", label: "Overcharging", icon: "dollar-sign" },
  { id: "vehicle_unsafe", label: "Unsafe vehicle", icon: "shield-off" },
  { id: "no_show", label: "Did not show up", icon: "x-circle" },
  { id: "wrong_route", label: "Wrong route taken", icon: "map" },
  { id: "payment_issue", label: "Payment issue", icon: "credit-card" },
  { id: "lost_item", label: "Lost item", icon: "package" },
  { id: "other", label: "Other", icon: "more-horizontal" },
];

interface Props {
  visible: boolean;
  rideId: string;
  targetName?: string;
  targetRole: "driver" | "passenger";
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function RateRideModal({ visible, rideId, targetName, targetRole, onClose, onSubmitted }: Props) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [showComplaint, setShowComplaint] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setStars(0);
      setComment("");
      setShowComplaint(false);
      setCategory(null);
      setDescription("");
    }
  }, [visible]);

  const submit = async () => {
    if (stars < 1) {
      Alert.alert("Please rate", "Tap stars to rate your experience");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/rides/${rideId}/rate`, {
        method: "POST",
        body: { stars, comment: comment.trim() || undefined },
      });
      if (showComplaint && category && description.trim()) {
        await api(`/rides/${rideId}/complaint`, {
          method: "POST",
          body: { category, description: description.trim(), against: targetRole },
        });
      }
      onSubmitted?.();
      onClose();
    } catch (e: any) {
      Alert.alert("Could not submit", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const skip = async () => {
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView
              style={{ width: "100%" }}
              contentContainerStyle={{ padding: spacing.lg }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.iconHero}>
                <Feather name="star" size={28} color={colors.parikrama} />
              </View>
              <TText variant="h2" align="center" style={{ marginTop: spacing.md }}>
                Rate your {targetRole}
              </TText>
              {targetName ? (
                <TText variant="body" muted align="center" style={{ marginTop: 4 }}>
                  How was your experience with {targetName}?
                </TText>
              ) : null}

              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setStars(n)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    testID={`rate-star-${n}`}
                  >
                    <Feather
                      name="star"
                      size={36}
                      color={n <= stars ? colors.parikrama : colors.border}
                      style={n <= stars ? styles.starFilled : undefined}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {stars > 0 && (
                <TText variant="caption" muted align="center">
                  {["", "Bad", "Poor", "Okay", "Good", "Excellent"][stars]}
                </TText>
              )}

              <View style={styles.commentBox}>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Share a quick comment (optional)"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={styles.commentInput}
                  testID="rate-comment-input"
                />
              </View>

              <TouchableOpacity
                style={styles.complaintToggle}
                onPress={() => setShowComplaint(!showComplaint)}
                testID="rate-complaint-toggle"
              >
                <Feather name={showComplaint ? "chevron-up" : "alert-circle"} size={16} color={colors.error} />
                <TText variant="bodySm" weight="700" color={colors.error} style={{ marginLeft: 8 }}>
                  {showComplaint ? "Hide complaint form" : "Report an issue"}
                </TText>
              </TouchableOpacity>

              {showComplaint && (
                <View style={styles.complaintCard}>
                  <TText variant="caption" muted style={{ marginBottom: 8 }}>WHAT WENT WRONG</TText>
                  <View style={styles.catGrid}>
                    {COMPLAINT_CATEGORIES.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.catChip, category === c.id && styles.catChipActive]}
                        onPress={() => setCategory(c.id)}
                        testID={`complaint-cat-${c.id}`}
                      >
                        <Feather name={c.icon} size={12} color={category === c.id ? colors.error : colors.textMuted} />
                        <TText
                          variant="caption"
                          weight={category === c.id ? "700" : "500"}
                          color={category === c.id ? colors.error : colors.text}
                          style={{ marginLeft: 4 }}
                        >
                          {c.label}
                        </TText>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Tell us what happened"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={[styles.commentInput, { marginTop: spacing.md, minHeight: 80 }]}
                    testID="complaint-description-input"
                  />
                </View>
              )}

              <TButton
                label="Submit"
                onPress={submit}
                loading={submitting}
                disabled={stars < 1 || (showComplaint && (!category || description.trim().length < 5))}
                testID="rate-submit-btn"
                style={{ marginTop: spacing.lg }}
                icon={<Feather name="send" size={16} color={colors.textInverse} />}
              />
              <TouchableOpacity style={styles.skipBtn} onPress={skip} testID="rate-skip-btn">
                <TText variant="bodySm" muted>Skip for now</TText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    ...shadows.lg,
  },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 10 },
  iconHero: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.parikrama + "22",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: spacing.lg, marginBottom: 4 },
  starFilled: {},
  commentBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
  },
  commentInput: { padding: 12, minHeight: 60, fontSize: 14, color: colors.text, textAlignVertical: "top" },
  complaintToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    paddingVertical: 8,
  },
  complaintCard: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error + "30" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  catChipActive: { backgroundColor: colors.errorBg, borderColor: colors.error },
  skipBtn: { alignItems: "center", padding: spacing.md, marginTop: 4 },
});
