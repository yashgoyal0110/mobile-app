/**
 * FifthDigit design tokens — polished ride-booking-app palette.
 *
 * Saffron primary (Govardhan identity) + Uber-style deep ink "dark" hero
 * surfaces + clean off-white background + crisp borders. Used app-wide.
 */
export const colors = {
  // Primary — energetic saffron, used for CTAs, brand surfaces, callouts
  primary: "#F26B1F",
  primaryLight: "#FFF1E6",
  primaryLighter: "#FFE3CD",
  primaryDark: "#C24E0A",

  // Dark — used for hero banners / cards (Uber/Ola/Rapido-style)
  dark: "#0E0F12",
  darkSurface: "#1A1B20",
  darkBorder: "#2A2C32",
  darkMuted: "#9CA0A8",

  // Surfaces
  bg: "#F7F6F2",
  bgAlt: "#EEEDE7",
  surface: "#FFFFFF",
  surfaceAlt: "#FAFAF6",

  // Text
  text: "#0E0F12",
  textMuted: "#5F6469",
  textSubtle: "#8A8F95",
  textInverse: "#FFFFFF",

  // Borders
  border: "#EEEDE6",
  borderStrong: "#D8D6CC",

  // Status
  success: "#1E8E3E",
  successBg: "#E7F4EA",
  error: "#D93025",
  errorBg: "#FCE8E6",
  warning: "#F2A60C",
  warningBg: "#FEF3D8",
  info: "#1A73E8",
  infoBg: "#E8F0FE",

  // Brand accents
  parikrama: "#A35A28",
  parikramaBg: "#FFF5E1",
  online: "#1E8E3E",
  offline: "#9AA0A6",
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
  md: 14,
  lg: 20,
  xl: 28,
  pill: 9999,
  sheet: 28,
};

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  // Subtle dark glow used on hero cards
  glowPrimary: {
    shadowColor: "#F26B1F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const typography = {
  // Display — used for big standalone numbers (fare, OTP digits)
  display: { fontSize: 40, lineHeight: 48, fontWeight: "800" as const, color: colors.text, letterSpacing: -1 },
  h1: { fontSize: 30, lineHeight: 38, fontWeight: "800" as const, color: colors.text, letterSpacing: -0.6 },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: "800" as const, color: colors.text, letterSpacing: -0.4 },
  h3: { fontSize: 18, lineHeight: 26, fontWeight: "700" as const, color: colors.text },
  bodyLg: { fontSize: 17, lineHeight: 24, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "500" as const, color: colors.text },
  bodySm: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const, color: colors.text },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: "700" as const, color: colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase" as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "700" as const, color: colors.text, letterSpacing: 0.3 },
};

export const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  requested: { bg: colors.warningBg, fg: "#A36B00", label: "Searching driver" },
  scheduled: { bg: colors.infoBg, fg: colors.info, label: "Scheduled" },
  accepted: { bg: colors.primaryLight, fg: colors.primaryDark, label: "Driver assigned" },
  started: { bg: colors.successBg, fg: colors.success, label: "On the way" },
  completed: { bg: colors.successBg, fg: colors.success, label: "Completed" },
  cancelled: { bg: colors.errorBg, fg: colors.error, label: "Cancelled" },
};

/** Quick helper for tinted alpha overlays (e.g., overlays on dark images). */
export const alpha = (hex: string, a: number) => {
  // expects #RRGGBB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};
