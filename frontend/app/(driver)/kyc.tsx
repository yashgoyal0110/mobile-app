import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { TInput } from "../../src/components/TInput";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, radius, spacing } from "../../src/theme";

const STEPS = ["Personal", "Vehicle", "UPI"];

export default function DriverKYC() {
  const { driver, refresh, user } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name || driver?.aadhar_number ? user?.name || "" : "");
  const [aadhar, setAadhar] = useState(driver?.aadhar_number || "");
  const [vehicleNo, setVehicleNo] = useState(driver?.vehicle_no || "");
  const [vehicleType, setVehicleType] = useState("e-rickshaw");
  const [upiId, setUpiId] = useState(driver?.upi_id || "");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name || aadhar.length !== 12 || !vehicleNo || !upiId) {
      Alert.alert("Missing info", "Please fill all fields");
      return;
    }
    if (!/@/.test(upiId)) {
      Alert.alert("Invalid UPI", "UPI ID must be like name@bank");
      return;
    }
    setSubmitting(true);
    try {
      // Mock photo bytes (small base64) since we don't have image picker installed
      const mockImg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      await api("/drivers/kyc", {
        method: "POST",
        body: {
          name,
          aadhar_number: aadhar,
          aadhar_photo: mockImg,
          vehicle_no: vehicleNo.toUpperCase(),
          vehicle_type: vehicleType,
          rc_photo: mockImg,
          profile_photo: mockImg,
          upi_id: upiId,
        },
      });
      await refresh();
      Alert.alert("Submitted", "Your KYC is under review. Admin will approve shortly.");
      setStep(0);
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = () => {
    const map: any = {
      not_submitted: { color: colors.textMuted, bg: colors.border + "40", label: "Not submitted" },
      pending: { color: colors.warning, bg: colors.warningBg, label: "Under review" },
      approved: { color: colors.success, bg: colors.successBg, label: "Approved" },
      rejected: { color: colors.error, bg: colors.errorBg, label: "Rejected" },
    };
    const s = map[driver?.kyc_status || "not_submitted"];
    return (
      <View style={[styles.badge, { backgroundColor: s.bg }]}>
        <TText variant="caption" color={s.color}>{s.label.toUpperCase()}</TText>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-kyc-screen">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        <View style={styles.header}>
          <View>
            <TText variant="caption" muted>VERIFICATION</TText>
            <TText variant="h2">KYC Documents</TText>
          </View>
          {statusBadge()}
        </View>

        {driver?.kyc_status === "approved" && (
          <Card style={{ marginTop: spacing.md, backgroundColor: colors.successBg, borderColor: colors.success + "40" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name="check-circle" size={22} color={colors.success} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <TText variant="bodyLg" weight="700" color={colors.success}>You're verified!</TText>
                <TText variant="bodySm" muted>Re-submit to update vehicle details (re-verification required)</TText>
              </View>
            </View>
          </Card>
        )}

        <View style={styles.stepRow}>
          {STEPS.map((s, i) => (
            <TouchableOpacity key={s} onPress={() => setStep(i)} style={[styles.stepDot, i <= step && { backgroundColor: colors.primary }]} testID={`kyc-step-${i}`}>
              <TText variant="bodySm" weight="700" color={i <= step ? colors.textInverse : colors.textMuted}>{i + 1}</TText>
            </TouchableOpacity>
          ))}
        </View>
        <TText variant="bodySm" muted align="center" style={{ marginBottom: spacing.lg }}>
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </TText>

        <Card>
          {step === 0 && (
            <>
              <TInput label="Full name (as per Aadhar)" value={name} onChangeText={setName} placeholder="Your full name" testID="kyc-name" />
              <TInput
                label="Aadhar number"
                value={aadhar}
                onChangeText={(v) => setAadhar(v.replace(/\D/g, "").slice(0, 12))}
                keyboardType="number-pad"
                placeholder="12-digit Aadhar"
                testID="kyc-aadhar"
                maxLength={12}
              />
              <View style={styles.upload}>
                <Feather name="upload-cloud" size={28} color={colors.primaryDark} />
                <TText variant="bodySm" weight="600" style={{ marginTop: 6 }}>Aadhar photo (auto-mocked for demo)</TText>
                <TText variant="caption" muted>Real photo upload coming in next release</TText>
              </View>
            </>
          )}
          {step === 1 && (
            <>
              <TInput
                label="Vehicle number"
                value={vehicleNo}
                onChangeText={setVehicleNo}
                placeholder="UP85 AB 1234"
                testID="kyc-vehicle-no"
                autoCapitalize="characters"
              />
              <TInput label="Vehicle type" value={vehicleType} onChangeText={setVehicleType} testID="kyc-vehicle-type" />
              <View style={styles.upload}>
                <Feather name="upload-cloud" size={28} color={colors.primaryDark} />
                <TText variant="bodySm" weight="600" style={{ marginTop: 6 }}>Vehicle RC photo (auto-mocked)</TText>
              </View>
            </>
          )}
          {step === 2 && (
            <>
              <TInput
                label="UPI ID for payouts"
                value={upiId}
                onChangeText={setUpiId}
                placeholder="yourname@upi"
                autoCapitalize="none"
                keyboardType="email-address"
                testID="kyc-upi"
              />
              <Card style={{ backgroundColor: colors.infoBg, borderColor: colors.info + "40", marginTop: spacing.sm }} flat>
                <View style={{ flexDirection: "row" }}>
                  <Feather name="info" size={16} color={colors.info} />
                  <TText variant="bodySm" color={colors.info} style={{ marginLeft: 8, flex: 1 }}>
                    Earnings will be transferred to this UPI. Cash rides stay with you directly.
                  </TText>
                </View>
              </Card>
            </>
          )}
        </Card>

        <View style={{ flexDirection: "row", gap: 12, marginTop: spacing.md }}>
          {step > 0 && (
            <TButton label="Back" variant="outline" onPress={() => setStep(step - 1)} fullWidth={false} style={{ flex: 1 }} testID="kyc-back-btn" />
          )}
          {step < STEPS.length - 1 ? (
            <TButton label="Next" onPress={() => setStep(step + 1)} fullWidth={false} style={{ flex: 1 }} testID="kyc-next-btn" />
          ) : (
            <TButton label="Submit for review" onPress={submit} loading={submitting} fullWidth={false} style={{ flex: 1 }} testID="kyc-submit-btn" />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.lg },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  stepRow: { flexDirection: "row", justifyContent: "center", gap: 14, marginTop: spacing.lg, marginBottom: spacing.md },
  stepDot: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  upload: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary + "60",
    borderStyle: "dashed",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
  },
});
