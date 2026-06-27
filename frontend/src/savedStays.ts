/**
 * Lightweight "recently viewed stays" list, persisted locally.
 *
 * Stays aren't booked through the backend (contact is via call / WhatsApp),
 * so we keep a device-local record of the stays a yatri has opened. This powers
 * the "Stays" section of the My Trips tab so the app isn't ride-centric.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Stay } from "./stays";

const KEY = "saved_stays_v1";
const MAX = 20;

export interface SavedStay {
  id: string;
  name: string;
  type: string;
  area?: string;
  photo?: string;
  contact_phone?: string;
  price_min?: number | null;
  price_max?: number | null;
  donation_based?: boolean;
  savedAt: number;
}

export async function getSavedStays(): Promise<SavedStay[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedStay[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Record (or bump to top) a stay the user just opened. */
export async function recordStayView(stay: Stay): Promise<void> {
  try {
    const list = await getSavedStays();
    const entry: SavedStay = {
      id: stay.id,
      name: stay.name,
      type: stay.type,
      area: stay.area,
      photo: stay.photos && stay.photos.length > 0 ? stay.photos[0] : undefined,
      contact_phone: stay.contact_phone,
      price_min: stay.price_min,
      price_max: stay.price_max,
      donation_based: stay.donation_based,
      savedAt: Date.now(),
    };
    const next = [entry, ...list.filter((s) => s.id !== stay.id)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort; ignore storage failures
  }
}

export async function removeSavedStay(id: string): Promise<void> {
  try {
    const list = await getSavedStays();
    await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((s) => s.id !== id)));
  } catch {
    // ignore
  }
}
