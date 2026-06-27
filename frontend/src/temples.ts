/**
 * Shared metadata + helpers for the Temples module.
 * Open/closed status is computed client-side in IST so it stays correct
 * regardless of the device timezone.
 */
import { colors } from "./theme";

export interface DarshanSlot {
  label?: string;
  open: string;   // "HH:MM"
  close: string;  // "HH:MM"
}

export interface AartiTiming {
  name: string;
  time: string;   // "HH:MM"
}

export type CrowdLevel = "low" | "moderate" | "high" | "very_high";

export interface Temple {
  id: string;
  name: string;
  deity?: string;
  description?: string;
  address: string;
  area?: string;
  lat?: number;
  lng?: number;
  contact_phone?: string | null;
  darshan_slots?: DarshanSlot[];
  aarti_timings?: AartiTiming[];
  crowd_level?: CrowdLevel | null;
  crowd_updated_at?: string | null;
  entry_info?: string | null;
  special_note?: string | null;
  photos?: string[];
  verified?: boolean;
  featured?: boolean;
  distance_km?: number | null;
}

export const CROWD_META: Record<CrowdLevel, { label: string; bg: string; fg: string }> = {
  low: { label: "Low crowd", bg: colors.successBg, fg: colors.success },
  moderate: { label: "Moderate", bg: colors.warningBg, fg: "#A36B00" },
  high: { label: "High crowd", bg: "#FDE7D8", fg: colors.primaryDark },
  very_high: { label: "Very high", bg: colors.errorBg, fg: colors.error },
};

export const CROWD_OPTIONS: { key: CrowdLevel; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "moderate", label: "Moderate" },
  { key: "high", label: "High" },
  { key: "very_high", label: "Very High" },
];

/** Current time in IST as minutes-since-midnight. */
function nowMinutesIST(): number {
  // Convert "now" to IST (UTC+5:30) regardless of device tz.
  const utcMs = Date.now() + new Date().getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + 5.5 * 60 * 60000);
  return ist.getHours() * 60 + ist.getMinutes();
}

function toMinutes(hhmm: string): number {
  const [h, m] = (hhmm || "0:0").split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function fmt(hhmm: string): string {
  const mins = toMinutes(hhmm);
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function slotLabel(s: DarshanSlot): string {
  return `${fmt(s.open)} – ${fmt(s.close)}`;
}

export function fmtTime(hhmm: string): string {
  return fmt(hhmm);
}

export interface OpenStatus {
  open: boolean;
  label: string;          // "Open now", "Opens 4:00 PM", "Closed today"
  tint: string;
  bg: string;
}

/** Compute open/closed using the temple's darshan slots (IST). */
export function openStatus(slots?: DarshanSlot[]): OpenStatus {
  if (!slots || slots.length === 0) {
    return { open: false, label: "Timings not set", tint: colors.textMuted, bg: colors.bgAlt };
  }
  const cur = nowMinutesIST();
  // Open now?
  for (const s of slots) {
    if (cur >= toMinutes(s.open) && cur < toMinutes(s.close)) {
      return { open: true, label: `Open now · till ${fmt(s.close)}`, tint: colors.success, bg: colors.successBg };
    }
  }
  // Next opening today
  const upcoming = slots
    .map((s) => toMinutes(s.open))
    .filter((m) => m > cur)
    .sort((a, b) => a - b);
  if (upcoming.length > 0) {
    const next = upcoming[0];
    const h = Math.floor(next / 60), m = next % 60;
    return { open: false, label: `Opens ${fmt(`${h}:${m}`)}`, tint: colors.warning, bg: colors.warningBg };
  }
  return { open: false, label: "Closed for today", tint: colors.error, bg: colors.errorBg };
}
