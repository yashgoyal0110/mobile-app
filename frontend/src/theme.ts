/**
 * TirthRide design tokens — mapped from /app/design_guidelines.json
 */
export const colors = {
  primary: "#E68A00",
  primaryLight: "#FFF4E5",
  primaryDark: "#B36B00",
  bg: "#FAFAF5",
  surface: "#FFFFFF",
  text: "#1A2421",
  textMuted: "#5C6B66",
  textInverse: "#FFFFFF",
  border: "#EAEAE3",
  success: "#287D3C",
  successBg: "#E8F5E9",
  error: "#DA3633",
  errorBg: "#FFEBEE",
  warning: "#F57C00",
  warningBg: "#FFF9C4",
  parikrama: "#8D4E24",
  online: "#4CAF50",
  offline: "#9E9E9E",
  info: "#1565C0",
  infoBg: "#E3F2FD",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 9999,
  sheet: 24,
};

export const shadows = {
  sm: {
    shadowColor: "#1A2421",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#1A2421",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const typography = {
  h1: { fontSize: 32, lineHeight: 40, fontWeight: "800" as const, color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: "700" as const, color: colors.text, letterSpacing: -0.3 },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: "600" as const, color: colors.text },
  bodyLg: { fontSize: 18, lineHeight: 26, fontWeight: "500" as const, color: colors.text },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const, color: colors.text },
  bodySm: { fontSize: 14, lineHeight: 20, fontWeight: "500" as const, color: colors.text },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const, color: colors.textMuted, letterSpacing: 0.5, textTransform: "uppercase" as const },
};

export const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  requested: { bg: colors.warningBg, fg: "#F57F17", label: "Searching driver" },
  scheduled: { bg: colors.infoBg, fg: colors.info, label: "Scheduled" },
  accepted: { bg: colors.infoBg, fg: colors.info, label: "Driver assigned" },
  started: { bg: colors.primaryLight, fg: colors.primaryDark, label: "On the way" },
  completed: { bg: colors.successBg, fg: colors.success, label: "Completed" },
  cancelled: { bg: colors.errorBg, fg: colors.error, label: "Cancelled" },
};
