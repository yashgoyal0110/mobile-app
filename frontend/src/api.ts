import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Base URL for the backend API. Always use the public Cloudflare-fronted
 * hostname — the device must reach it from anywhere on the internet. The
 * "internal" hostname resolves to a private IP only reachable from inside
 * Emergent's cluster, so it cannot be used by the APK.
 */
const RAW_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
const BASE = RAW_BASE ? RAW_BASE + "/api" : "/api";

const TOKEN_KEY = "tirth_token";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(t: string | null): Promise<void> {
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

const DEFAULT_TIMEOUT_MS = 45000;
const MAX_RETRIES = 2;

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

function sanitizeBody(body: any): string | undefined {
  if (!body) return undefined;
  return JSON.stringify(body);
}

let lastError: { url?: string; status?: number; message?: string; at?: string } | null = null;

export function getLastApiError() {
  return lastError;
}

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean; timeoutMs?: number; retries?: number } = {}
): Promise<T> {
  const { method = "GET", body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS, retries = MAX_RETRIES } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Client": `tirthride-${Platform.OS}-${Constants.expoConfig?.version || "1.0"}`,
  };
  if (auth) {
    const t = await getToken();
    if (t) {
      headers["X-Auth-Token"] = t;
      headers.Authorization = `Bearer ${t}`;
    }
  }
  const url = `${BASE}${path}`;
  const sBody = sanitizeBody(body);

  let attempt = 0;
  let lastException: any = null;
  while (attempt <= retries) {
    attempt += 1;
    try {
      const res = await fetchWithTimeout(url, { method, headers, body: sBody }, timeoutMs);
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (!res.ok) {
        const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
        lastError = {
          url,
          status: res.status,
          message: typeof msg === "string" ? msg : JSON.stringify(msg),
          at: new Date().toISOString(),
        };
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }
      lastError = null;
      return data as T;
    } catch (e: any) {
      lastException = e;
      const isAbort = e?.name === "AbortError";
      const isNetwork = !isAbort && /network|fetch|failed|unable/i.test(String(e?.message || ""));
      lastError = {
        url,
        message: isAbort ? "Timeout" : String(e?.message || e),
        at: new Date().toISOString(),
      };
      // Don't retry HTTP errors (4xx/5xx) — only retry on raw network/timeouts
      const httpStatusMatched = /^HTTP \d/.test(String(e?.message || ""));
      if (!(isAbort || isNetwork) || httpStatusMatched) {
        throw e;
      }
      if (attempt > retries) break;
      // backoff: 600ms, 1200ms
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }

  // Final error after retries
  if (lastException) {
    const isAbort = lastException?.name === "AbortError";
    const baseMsg = isAbort
      ? "Request timed out after retrying."
      : `Could not reach the server. ${lastException?.message || ""}`;
    throw new Error(`${baseMsg}\nURL: ${url}`);
  }
  throw new Error("Unknown error");
}

export { BASE };
