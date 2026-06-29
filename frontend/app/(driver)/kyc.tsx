import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { TInput } from "../../src/components/TInput";
import { TButton } from "../../src/components/TButton";
import { Card } from "../../src/components/Card";
import { ImagePickerField } from "../../src/components/ImagePickerField";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, radius, spacing } from "../../src/theme";
import { PhotoItem, resolvePhotos } from "../../src/uploads";

const STEPS = ["Personal", "Vehicle", "UPI"];

// Only pre-fill from a previously stored https URL (skip legacy mock data: URIs).
const prefill = (v?: string): PhotoItem[] =>
  v && /^https?:\/\//.test(v) ? [{ key: "existing", url: v }] : [];

export default function DriverKYC() {
  const { driver, refresh, user } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name || driver?.aadhar_number ? user?.name || "" : "");
  const [aadhar, setAadhar] = useState(driver?.aadhar_number || "");
  const [vehicleNo, setVehicleNo] = useState(driver?.vehicle_no || "");
  const [vehicleType, setVehicleType] = useState("e-rickshaw");
  const [upiId, setUpiId] = useState(driver?.upi_id || "");
  const [profilePhoto, setProfilePhoto] = useState<PhotoItem[]>(prefill(driver?.profile_photo));
  const [aadharPhoto, setAadharPhoto] = useState<PhotoItem[]>(prefill(driver?.aadhar_photo));
  const [rcPhoto, setRcPhoto] = useState<PhotoItem[]>(prefill(driver?.rc_photo));
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name || aadhar.length !== 12 || !vehicleNo || !upiId) {
      Alert.alert("Missing info", "Please fill all fields");
      return;
    }
    if (!/^[A-Za-z][A-Za-z .'-]{1,49}$/.test(name.trim())) {
      Alert.alert("Invalid name", "Name should only contain letters, spaces, dots, hyphens or apostrophes — no numbers or special characters.");
      return;
    }
    if (!/@/.test(upiId)) {
      Alert.alert("Invalid UPI", "UPI ID must be like name@bank");
      return;
    }
    if (profilePhoto.length === 0 || aadharPhoto.length === 0) {
      Alert.alert("Photos needed", "Add your profile photo and Aadhar photo (Step 1).");
      setStep(0);
      return;
    }
    if (rcPhoto.length === 0) {
      Alert.alert("Photo needed", "Add your vehicle RC photo (Step 2).");
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      // Upload all documents first; if any fails, KYC is not submitted.
      const [profileUrl] = await resolvePhotos(profilePhoto, "driver_profile", 1);
      const [aadharUrl] = await resolvePhotos(aadharPhoto, "driver_kyc", 1);
      const [rcUrl] = await resolvePhotos(rcPhoto, "driver_kyc", 1);
      await api("/drivers/kyc", {
        method: "POST",
        body: {
          name,
          aadhar_number: aadhar,
          aadhar_photo: aadharUrl,
          vehicle_no: vehicleNo.toUpperCase(),
          vehicle_type: vehicleType,
          rc_photo: rcUrl,
          profile_photo: profileUrl,
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
                <TText variant="bodyLg" weight="700" color={colors.success}>{"You're verified!"}</TText>
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
              <TInput
                label="Full name (as per Aadhar)"
                value={name}
                onChangeText={(v) => setName(v.replace(/[^A-Za-z .'\-]/g, ""))}
                placeholder="Your full name"
                autoCapitalize="words"
                maxLength={50}
                testID="kyc-name"
              />
              <TInput
                label="Aadhar number"
                value={aadhar}
                onChangeText={(v) => setAadhar(v.replace(/\D/g, "").slice(0, 12))}
                keyboardType="number-pad"
                placeholder="12-digit Aadhar"
                testID="kyc-aadhar"
                maxLength={12}
              />
              <View style={{ height: spacing.sm }} />
              <ImagePickerField
                label="Your photo (selfie)"
                required
                max={1}
                value={profilePhoto}
                onChange={setProfilePhoto}
                hint="Clear face photo for your driver profile."
                testID="kyc-profile-photo"
              />
              <ImagePickerField
                label="Aadhar card photo"
                required
                max={1}
                value={aadharPhoto}
                onChange={setAadharPhoto}
                hint="Used only for verification — kept private."
                testID="kyc-aadhar-photo"
              />
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
              <View style={{ height: spacing.sm }} />
              <ImagePickerField
                label="Vehicle RC photo"
                required
                max={1}
                value={rcPhoto}
                onChange={setRcPhoto}
                hint="Registration certificate of your e-rickshaw."
                testID="kyc-rc-photo"
              />
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
});
