import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../src/components/TText";
import { TInput } from "../src/components/TInput";
import { TButton } from "../src/components/TButton";
import { api, BASE } from "../src/api";
import { colors, radius, spacing } from "../src/theme";

export default function Login() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role: string }>();
  const role = (params.role as "passenger" | "driver" | "admin") || "passenger";
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const send = async () => {
    if (phone.length !== 10) {
      Alert.alert("Invalid phone", "Please enter your 10-digit Indian phone number");
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ message: string; dev_otp: string }>("/auth/send-otp", {
        method: "POST",
        body: { phone, role },
        auth: false,
      });
      router.push({ pathname: "/otp", params: { phone, role, dev: res.dev_otp } });
    } catch (e: any) {
      Alert.alert("Failed to send OTP", e.message || "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const runConnectionTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const t0 = Date.now();
      await api<any>("/", { auth: false, timeoutMs: 12000, retries: 0 });
      const ms = Date.now() - t0;
      setTestResult(`✅ Server reachable (${ms}ms)\n${BASE}`);
    } catch (e: any) {
      setTestResult(`❌ ${e.message || "Failed"}\nURL: ${BASE}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} testID="login-back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.body}>
            <View style={styles.badge}>
              <Feather name={role === "driver" ? "truck" : role === "admin" ? "shield" : "user"} size={14} color={colors.primaryDark} />
              <TText variant="caption" color={colors.primaryDark} style={{ marginLeft: 6 }}>
                {role.toUpperCase()} LOGIN
              </TText>
            </View>
            <TText variant="h1" style={{ marginTop: spacing.md }}>Enter mobile number</TText>
            <TText variant="body" muted style={{ marginTop: 6 }}>
              We'll send you a 6-digit OTP for verification
            </TText>

            <View style={{ marginTop: spacing.xl }}>
              <TInput
                label="Mobile number"
                prefix="+91"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
                keyboardType="number-pad"
                placeholder="98765 43210"
                testID="login-phone-input"
                returnKeyType="done"
                onSubmitEditing={send}
                maxLength={10}
              />
            </View>

            <TButton
              label="Send OTP"
              onPress={send}
              loading={loading}
              disabled={phone.length !== 10}
              testID="login-send-otp-button"
              icon={<Feather name="arrow-right" size={18} color={colors.textInverse} />}
            />

            <View style={styles.devNote}>
              <Feather name="info" size={14} color={colors.info} />
              <TText variant="bodySm" color={colors.info} style={{ marginLeft: 6, flex: 1 }}>
                {role === "admin"
                  ? "Dev admin: phone 9999999999, OTP 123456"
                  : "Dev mode: use OTP 123456"}
              </TText>
            </View>

            <TouchableOpacity
              onPress={runConnectionTest}
              disabled={testing}
              style={styles.testBtn}
              testID="login-conn-test"
            >
              <Feather name="activity" size={14} color={colors.textMuted} />
              <TText variant="bodySm" muted style={{ marginLeft: 6 }}>
                {testing ? "Testing connection..." : "Test server connection"}
              </TText>
            </TouchableOpacity>
            {testResult && (
              <View style={styles.testResult}>
                <TText variant="caption" style={{ color: testResult.startsWith("✅") ? colors.success : colors.error }}>
                  {testResult}
                </TText>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  header: { padding: spacing.lg },
  body: { flex: 1, paddingHorizontal: spacing.xl, minHeight: 400 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  devNote: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.infoBg,
    borderRadius: radius.md,
  },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  testResult: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
