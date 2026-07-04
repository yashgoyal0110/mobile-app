import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
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
  const status: string = driver?.kyc_status || "not_submitted";
  const locked = status === "approved";

  const [editing, setEditing] = useState(status === "not_submitted");
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name || "");
  const [aadhar, setAadhar] = useState(driver?.aadhar_number || "");
  const [vehicleNo, setVehicleNo] = useState(driver?.vehicle_no || "");
  const [vehicleType, setVehicleType] = useState(driver?.vehicle_type || "e-rickshaw");
  const [upiId, setUpiId] = useState(driver?.upi_id || "");
  const [profilePhoto, setProfilePhoto] = useState<PhotoItem[]>(prefill(driver?.profile_photo));
  const [aadharPhoto, setAadharPhoto] = useState<PhotoItem[]>(prefill(driver?.aadhar_photo));
  const [rcPhoto, setRcPhoto] = useState<PhotoItem[]>(prefill(driver?.rc_photo));
  const [submitting, setSubmitting] = useState(false);

  // Keep the view in sync with the latest KYC status (e.g. after refresh):
  // approved → locked (no form); fresh driver → straight into the form.
  useEffect(() => {
    if (status === "approved") setEditing(false);
    else if (status === "not_submitted") setEditing(true);
  }, [status]);

  const startEditing = () => {
    // Re-seed the form from the latest saved values, then open it.
    setName(user?.name || "");
    setAadhar(driver?.aadhar_number || "");
    setVehicleNo(driver?.vehicle_no || "");
    setVehicleType(driver?.vehicle_type || "e-rickshaw");
    setUpiId(driver?.upi_id || "");
    setProfilePhoto(prefill(driver?.profile_photo));
    setAadharPhoto(prefill(driver?.aadhar_photo));
    setRcPhoto(prefill(driver?.rc_photo));
    setStep(0);
    setEditing(true);
  };

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
      setEditing(false);
      setStep(0);
      await refresh();
      Alert.alert("Submitted ✓", "Your KYC is under review. We'll notify you once the admin approves it.");
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusMeta: any = {
    not_submitted: { color: colors.textMuted, bg: colors.border + "40", label: "Not submitted" },
    pending: { color: "#A36B00", bg: colors.warningBg, label: "Under review" },
    approved: { color: colors.success, bg: colors.successBg, label: "Approved" },
    rejected: { color: colors.error, bg: colors.errorBg, label: "Rejected" },
  };
  const sm = statusMeta[status];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="driver-kyc-screen">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <TText variant="caption" muted>VERIFICATION</TText>
            <TText variant="h2">KYC Documents</TText>
          </View>
          <View style={[styles.badge, { backgroundColor: sm.bg }]}>
            <TText variant="caption" color={sm.color}>{sm.label.toUpperCase()}</TText>
          </View>
        </View>

        {/* ---- Approved: locked ---- */}
        {locked ? (
          <>
            <Card style={{ marginTop: spacing.md, backgroundColor: colors.successBg, borderColor: colors.success + "40" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="check-circle" size={22} color={colors.success} />
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <TText variant="bodyLg" weight="700" color={colors.success}>{"You're verified!"}</TText>
                  <TText variant="bodySm" muted>Your details are locked. Contact the admin to change anything.</TText>
                </View>
              </View>
            </Card>
            <SubmittedSummary driver={driver} name={user?.name} />
          </>
        ) : !editing ? (
          /* ---- Pending / Rejected: confirmation + update option ---- */
          <>
            <Card
              style={{
                marginTop: spacing.md,
                backgroundColor: status === "rejected" ? colors.errorBg : colors.warningBg,
                borderColor: (status === "rejected" ? colors.error : colors.warning) + "40",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <Feather
                  name={status === "rejected" ? "alert-circle" : "clock"}
                  size={22}
                  color={status === "rejected" ? colors.error : "#A36B00"}
                />
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <TText variant="bodyLg" weight="700" color={status === "rejected" ? colors.error : "#A36B00"}>
                    {status === "rejected" ? "KYC rejected" : "Submitted — under review"}
                  </TText>
                  <TText variant="bodySm" muted style={{ marginTop: 2 }}>
                    {status === "rejected"
                      ? driver?.rejection_reason || "Please correct your details and resubmit."
                      : "The admin will review your documents shortly. You can still update your details until then."}
                  </TText>
                </View>
              </View>
            </Card>

            <SubmittedSummary driver={driver} name={user?.name} />

            <TButton
              label={status === "rejected" ? "Update & resubmit" : "Update details"}
              variant={status === "rejected" ? undefined : "outline"}
              onPress={startEditing}
              icon={<Feather name="edit-2" size={16} color={status === "rejected" ? colors.textInverse : colors.text} />}
              style={{ marginTop: spacing.lg }}
              testID="kyc-update-btn"
            />
          </>
        ) : (
          /* ---- Editing: the multi-step form ---- */
          <>
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
              {step > 0 ? (
                <TButton label="Back" variant="outline" onPress={() => setStep(step - 1)} fullWidth={false} style={{ flex: 1 }} testID="kyc-back-btn" />
              ) : status !== "not_submitted" ? (
                <TButton label="Cancel" variant="outline" onPress={() => setEditing(false)} fullWidth={false} style={{ flex: 1 }} testID="kyc-cancel-btn" />
              ) : null}
              {step < STEPS.length - 1 ? (
                <TButton label="Next" onPress={() => setStep(step + 1)} fullWidth={false} style={{ flex: 1 }} testID="kyc-next-btn" />
              ) : (
                <TButton label="Submit for review" onPress={submit} loading={submitting} fullWidth={false} style={{ flex: 1 }} testID="kyc-submit-btn" />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SubmittedSummary({ driver, name }: { driver: any; name?: string }) {
  if (!driver) return null;
  const profile = driver.profile_photo && /^https?:\/\//.test(driver.profile_photo) ? driver.profile_photo : null;
  return (
    <Card style={{ marginTop: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
        <View style={styles.summaryAvatar}>
          {profile ? (
            <Image source={{ uri: profile }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Feather name="user" size={22} color={colors.primaryDark} />
          )}
        </View>
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <TText variant="bodyLg" weight="700">{name || "Driver"}</TText>
          <TText variant="bodySm" muted>{driver.vehicle_no || "—"} · {driver.vehicle_type || "e-rickshaw"}</TText>
        </View>
      </View>
      <SummaryRow label="Aadhar" value={driver.aadhar_number ? `**** **** ${String(driver.aadhar_number).slice(-4)}` : "—"} />
      <SummaryRow label="UPI ID" value={driver.upi_id || "—"} />
      <View style={styles.docChecks}>
        <DocCheck ok={!!driver.aadhar_photo} label="Aadhar photo" />
        <DocCheck ok={!!driver.rc_photo} label="RC photo" />
      </View>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <TText variant="bodySm" muted>{label}</TText>
      <TText variant="bodySm" weight="600">{value}</TText>
    </View>
  );
}

function DocCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.docCheck}>
      <Feather name={ok ? "check-circle" : "circle"} size={14} color={ok ? colors.success : colors.textMuted} />
      <TText variant="caption" color={ok ? colors.success : colors.textMuted} style={{ marginLeft: 5 }}>{label}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  stepRow: { flexDirection: "row", justifyContent: "center", gap: 14, marginTop: spacing.lg, marginBottom: spacing.md },
  stepDot: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  summaryAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  docChecks: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  docCheck: { flexDirection: "row", alignItems: "center" },
});
