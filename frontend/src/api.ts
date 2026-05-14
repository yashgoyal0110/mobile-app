import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Resolve the API base URL.
 *
 * Reason for the transform: the public preview hostname
 * (`tirthride-preview.preview.emergentagent.com`) is fronted by a Cloudflare
 * ingress that issues a 307 redirect to the internal hostname
 * (`tirthride-preview.internal.preview.emergentagent.com`). Web browsers (and
 * curl with -L) follow this redirect cleanly. However, React Native's fetch
 * on Android sometimes drops the POST body / required headers on cross-origin
 * 307s, surfacing as the generic "Network request failed" error.
 *
 * To make the APK build robust we hit the internal hostname directly on native
 * platforms. The internal hostname is publicly reachable. Web continues to use
 * the original URL so cookies & CSP behave normally.
 */
function resolveBase(): string {
  const raw = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
  if (!raw) return "/api";
  // Only swap on native (Android/iOS APK / Expo Go). Web works fine via redirect.
  if (Platform.OS !== "web" && raw.includes(".preview.emergentagent.com") && !raw.includes(".internal.")) {
    return raw.replace(".preview.emergentagent.com", ".internal.preview.emergentagent.com") + "/api";
  }
  return raw + "/api";
}

const BASE = resolveBase();

const TOKEN_KEY = "tirth_token";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(t: string | null): Promise<void> {
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

const DEFAULT_TIMEOUT_MS = 20000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean; timeoutMs?: number } = {}
): Promise<T> {
  const { method = "GET", body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (auth) {
    const t = await getToken();
    if (t) {
      headers["X-Auth-Token"] = t;
      headers.Authorization = `Bearer ${t}`;
    }
  }
  const url = `${BASE}${path}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(
      url,
      { method, headers, body: body ? JSON.stringify(body) : undefined },
      timeoutMs
    );
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Request timed out. Please check your internet connection.");
    }
    // RN's generic "Network request failed". Surface URL to help debug.
    throw new Error(`Network error reaching server. ${e?.message || ""}`);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export { BASE };
