import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { TText } from "../../src/components/TText";
import { TInput } from "../../src/components/TInput";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, radius, spacing } from "../../src/theme";

export default function PassengerProfile() {
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("/users/me", { method: "PATCH", body: { name } });
      await refresh();
      Alert.alert("Profile updated");
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    Alert.alert("Sign out?", "You'll need to verify your OTP again", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/role-select");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="passenger-profile-screen">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        <View style={styles.heroHeader}>
          <View style={styles.bigAvatar}>
            <Feather name="user" size={36} color={colors.primaryDark} />
          </View>
          <TText variant="h2" align="center" style={{ marginTop: spacing.md }}>
            {user?.name || "Add your name"}
          </TText>
          <TText variant="bodySm" muted align="center" style={{ marginTop: 4 }}>
            +91 {user?.phone}
          </TText>
        </View>

        <Card style={{ marginTop: spacing.xl }}>
          <TText variant="caption" muted>PROFILE</TText>
          <View style={{ marginTop: spacing.md }}>
            <TInput
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              testID="profile-name-input"
            />
            <TButton label="Save changes" onPress={save} loading={saving} testID="profile-save-btn" />
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }} flat>
          <MenuRow icon="phone" label="Phone Number" value={`+91 ${user?.phone}`} />
          <MenuRow icon="shield" label="Verified Passenger" value="Active" />
          <MenuRow icon="info" label="App Version" value="1.0.0" />
        </Card>

        <TButton
          label="Sign out"
          variant="outline"
          onPress={logout}
          icon={<Feather name="log-out" size={16} color={colors.text} />}
          testID="profile-signout-btn"
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({ icon, label, value }: any) {
  return (
    <View style={styles.menuRow}>
      <Feather name={icon} size={18} color={colors.textMuted} />
      <TText variant="body" muted style={{ flex: 1, marginLeft: spacing.md }}>{label}</TText>
      <TText variant="bodySm" weight="600">{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  heroHeader: { alignItems: "center", paddingVertical: spacing.lg },
  bigAvatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  menuRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
});
