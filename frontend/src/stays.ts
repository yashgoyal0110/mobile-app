/**
 * Shared metadata for the Dharamshala / Guest-house module.
 * Keep amenity keys in sync with backend AMENITY_KEYS (app/models.py).
 */
import type { ComponentProps } from "react";
import { Feather } from "@expo/vector-icons";

type FeatherName = ComponentProps<typeof Feather>["name"];

export interface Stay {
  id: string;
  name: string;
  type: StayTypeKey;
  description?: string;
  address: string;
  area?: string;
  lat?: number;
  lng?: number;
  contact_phone: string;
  whatsapp?: string;
  price_min?: number | null;
  price_max?: number | null;
  donation_based?: boolean;
  room_types?: string[];
  capacity?: number | null;
  amenities?: string[];
  photos?: string[];
  verified?: boolean;
  available?: boolean;
  featured?: boolean;
  distance_km?: number | null;
}

export type StayTypeKey = "dharamshala" | "guesthouse" | "ashram" | "lodge" | "hotel";

export const STAY_TYPES: { key: StayTypeKey; label: string; icon: FeatherName }[] = [
  { key: "dharamshala", label: "Dharamshala", icon: "home" },
  { key: "guesthouse", label: "Guest House", icon: "briefcase" },
  { key: "ashram", label: "Ashram", icon: "feather" },
  { key: "lodge", label: "Lodge", icon: "key" },
  { key: "hotel", label: "Hotel", icon: "coffee" },
];

export function stayTypeLabel(key?: string): string {
  return STAY_TYPES.find((t) => t.key === key)?.label || "Stay";
}

export const AMENITIES: { key: string; label: string; icon: FeatherName }[] = [
  { key: "parking", label: "Parking", icon: "truck" },
  { key: "food", label: "Bhojanalaya / Food", icon: "coffee" },
  { key: "ac", label: "AC Rooms", icon: "wind" },
  { key: "hot_water", label: "Hot Water", icon: "droplet" },
  { key: "wifi", label: "Wi-Fi", icon: "wifi" },
  { key: "lift", label: "Lift", icon: "chevrons-up" },
  { key: "family_rooms", label: "Family Rooms", icon: "users" },
  { key: "elderly_friendly", label: "Senior Friendly", icon: "heart" },
  { key: "wheelchair", label: "Wheelchair Access", icon: "user-check" },
  { key: "locker", label: "Lockers", icon: "lock" },
  { key: "power_backup", label: "Power Backup", icon: "zap" },
];

export const AMENITY_MAP: Record<string, { label: string; icon: FeatherName }> = Object.fromEntries(
  AMENITIES.map((a) => [a.key, { label: a.label, icon: a.icon }])
);

/** Human-readable price line. */
export function priceLabel(s: Stay): string {
  if (s.donation_based) return "Donation based";
  if (s.price_min != null && s.price_max != null) return `₹${s.price_min}–${s.price_max}`;
  if (s.price_min != null) return `From ₹${s.price_min}`;
  return "On request";
}
