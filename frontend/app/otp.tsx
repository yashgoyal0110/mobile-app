import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, TextInput, TouchableOpacity, Alert, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../src/components/TText";
import { TInput } from "../src/components/TInput";
import { TButton } from "../src/components/TButton";
import { api } from "../src/api";
import { useAuth } from "../src/auth";
import { colors, radius, spacing } from "../src/theme";

type Step = "otp" | "name";

export default function OtpScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ phone: string; role: string; dev: string }>();
  const phone = String(params.phone || "");
  const role = (params.role as "passenger" | "driver" | "admin") || "passenger";
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<Step>("otp");
  const [name, setName] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(30);
  const refs = useRef<TextInput[]>([]);

  useEffect(() => {
    const t = setInterval(() => setResendIn((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d !== "")) verify(next.join(""));
  };

  const verify = async (otp: string, providedName?: string) => {
    setLoading(true);
    try {
      const body: any = { phone, role, otp };
      const useName = (providedName ?? name).trim();
      if (useName) body.name = useName;
      const res = await api<any>("/auth/verify-otp", { method: "POST", body, auth: false });

      if (res.requires_name) {
        // Backend asks for a name (new signup or legacy account without name)
        setIsNewUser(!!res.is_new_user);
        setOtpValue(otp);
        setStep("name");
        setLoading(false);
        return;
      }

      await signIn(res.access_token, res.user);
      if (res.user.role === "passenger") router.replace("/(passenger)/home");
      else if (res.user.role === "driver") router.replace("/(driver)/home");
      else router.replace("/(admin)/dashboard");
    } catch (e: any) {
      Alert.alert("Verification failed", e.message || "Invalid OTP");
      setDigits(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const submitName = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert("Please enter your full name", "Minimum 2 characters");
      return;
    }
    if (!/^[A-Za-z][A-Za-z .'-]{1,49}$/.test(trimmed)) {
      Alert.alert("Invalid name", "Name should only contain letters, spaces, dots, hyphens or apostrophes — no numbers or special characters.");
      return;
    }
    await verify(otpValue, trimmed);
  };

  const resend = async () => {
    if (resendIn > 0) return;
    try {
      await api("/auth/send-otp", { method: "POST", body: { phone, role }, auth: false });
      setResendIn(30);
      Alert.alert("OTP sent again");
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="otp-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => (step === "name" ? setStep("otp") : router.back())}
              testID="otp-back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.body}>
            {step === "otp" ? (
              <>
                <TText variant="h1">Verify OTP</TText>
                <TText variant="body" muted style={{ marginTop: 6 }}>
                  Enter the 6-digit code sent to +91 {phone}
                </TText>

                <View style={styles.otpRow}>
                  {digits.map((d, i) => (
                    <TextInput
                      key={i}
                      ref={(r) => { if (r) refs.current[i] = r; }}
                      value={d}
                      onChangeText={(v) => setDigit(i, v)}
                      onKeyPress={({ nativeEvent }) => {
                        if (nativeEvent.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
                      }}
                      keyboardType="number-pad"
                      maxLength={1}
                      style={[styles.otpBox, d ? styles.otpBoxFilled : null]}
                      editable={!loading}
                      testID={`otp-input-${i}`}
                      autoFocus={i === 0}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                <TButton
                  label={loading ? "Verifying..." : "Verify & Continue"}
                  onPress={() => verify(digits.join(""))}
                  disabled={digits.some((d) => !d) || loading}
                  loading={loading}
                  testID="otp-verify-button"
                />

                <View style={styles.resend}>
                  {resendIn > 0 ? (
                    <TText variant="bodySm" muted>Resend OTP in {resendIn}s</TText>
                  ) : (
                    <TouchableOpacity onPress={resend} testID="otp-resend">
                      <TText variant="bodySm" color={colors.primary} weight="600">Resend OTP</TText>
                    </TouchableOpacity>
                  )}
                </View>

                {params.dev ? (
                  <View style={styles.devHint}>
                    <Feather name="key" size={14} color={colors.info} />
                    <TText variant="bodySm" color={colors.info} style={{ marginLeft: 6 }}>
                      Your OTP is {params.dev} (sticky per account)
                    </TText>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.welcomeBadge}>
                  <Feather name="user-plus" size={14} color={colors.primaryDark} />
                  <TText variant="caption" color={colors.primaryDark} style={{ marginLeft: 6 }}>
                    {isNewUser ? "NEW ACCOUNT" : "COMPLETE PROFILE"}
                  </TText>
                </View>
                <TText variant="h1" style={{ marginTop: spacing.md }}>
                  {isNewUser ? "Welcome to TirthRide 🙏" : "One quick thing"}
                </TText>
                <TText variant="body" muted style={{ marginTop: 6 }}>
                  {isNewUser
                    ? "Tell us your name so drivers know who they're picking up"
                    : "We need your name to continue"}
                </TText>

                <View style={{ marginTop: spacing.xl }}>
                  <TInput
                    label="Full name"
                    value={name}
                    onChangeText={(v) => setName(v.replace(/[^A-Za-z .'\-]/g, ""))}
                    placeholder="e.g. Rohan Sharma"
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={submitName}
                    autoFocus
                    testID="onboarding-name-input"
                    maxLength={50}
                  />
                </View>

                <TButton
                  label="Continue"
                  onPress={submitName}
                  loading={loading}
                  disabled={name.trim().length < 2}
                  testID="onboarding-continue-button"
                  icon={<Feather name="arrow-right" size={18} color={colors.textInverse} />}
                />

                <View style={styles.hintBox}>
                  <Feather name="lock" size={14} color={colors.textMuted} />
                  <TText variant="bodySm" muted style={{ marginLeft: 8, flex: 1 }}>
                    Your name is only shared with the driver assigned to your ride.
                  </TText>
                </View>
              </>
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
  otpRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xl, marginBottom: spacing.xl },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  otpBoxFilled: { borderColor: colors.primary, borderWidth: 2 },
  resend: { alignItems: "center", marginTop: spacing.lg },
  devHint: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.infoBg,
    borderRadius: radius.md,
  },
  welcomeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  hintBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
