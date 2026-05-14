/**
 * Realtime WebSocket + push notifications hook.
 *
 * Maintains a single WebSocket connection to /api/ws while a user is signed in.
 * Auto-reconnects with backoff. Exposes a subscribe() API for routes to listen
 * to specific event types. Also registers an Expo push token with the backend
 * for offline notifications.
 */
import React, { createContext, useContext, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useAuth } from "./auth";
import { api } from "./api";

type Listener = (event: any) => void;

interface RealtimeCtx {
  send: (msg: any) => void;
  subscribe: (eventType: string, fn: Listener) => () => void;
  isOpen: () => boolean;
}

const Ctx = createContext<RealtimeCtx>({
  send: () => {},
  subscribe: () => () => {},
  isOpen: () => false,
});

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function wsUrlFor(token: string): string | null {
  let base = process.env.EXPO_PUBLIC_BACKEND_URL || "";
  if (!base) return null;
  base = base.replace(/\/$/, "");
  // Always use the public Cloudflare-fronted hostname. The "internal"
  // hostname is on a private IP and not reachable from external devices.
  const url = base.replace(/^http/, "ws");
  return `${url}/api/ws?token=${encodeURIComponent(token)}`;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Ride alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#E5944D",
  });
}

async function registerPushAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // simulators can't get tokens
    await ensureAndroidChannel();
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== "granted") {
      const ask = await Notifications.requestPermissionsAsync();
      status = ask.status;
    }
    if (status !== "granted") return null;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants as any).easConfig?.projectId ||
      undefined;
    const tok = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return tok.data;
  } catch (e) {
    return null;
  }
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<Listener>>>(new Map());
  const reconnectTimerRef = useRef<any>(null);
  const backoffRef = useRef(1000);
  const shouldRunRef = useRef(false);

  const subscribe = useCallback((eventType: string, fn: Listener) => {
    const set = listenersRef.current.get(eventType) || new Set();
    set.add(fn);
    listenersRef.current.set(eventType, set);
    return () => {
      const s = listenersRef.current.get(eventType);
      if (s) s.delete(fn);
    };
  }, []);

  const send = useCallback((msg: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(msg));
      } catch {}
    }
  }, []);

  const isOpen = useCallback(() => wsRef.current?.readyState === WebSocket.OPEN, []);

  const dispatch = useCallback((event: any) => {
    if (!event || !event.type) return;
    listenersRef.current.get(event.type)?.forEach((fn) => {
      try {
        fn(event);
      } catch {}
    });
    listenersRef.current.get("*")?.forEach((fn) => {
      try {
        fn(event);
      } catch {}
    });
  }, []);

  const open = useCallback(() => {
    if (!token || !shouldRunRef.current) return;
    const url = wsUrlFor(token);
    if (!url) return;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        backoffRef.current = 1000;
      };
      ws.onmessage = (ev) => {
        try {
          dispatch(JSON.parse(ev.data));
        } catch {}
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        wsRef.current = null;
        if (!shouldRunRef.current) return;
        reconnectTimerRef.current = setTimeout(() => {
          backoffRef.current = Math.min(15000, backoffRef.current * 1.8);
          open();
        }, backoffRef.current);
      };
    } catch {}
  }, [token, dispatch]);

  // Manage connection lifecycle
  useEffect(() => {
    shouldRunRef.current = !!token;
    if (!token) {
      // cleanup
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      return;
    }
    open();

    // Periodic ping to keep connection alive
    const pingTimer = setInterval(() => {
      send({ type: "ping" });
    }, 25000);

    return () => {
      shouldRunRef.current = false;
      clearInterval(pingTimer);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
  }, [token, open, send]);

  // Register push token once signed in
  useEffect(() => {
    if (!token) return;
    (async () => {
      const pushToken = await registerPushAsync();
      if (!pushToken) return;
      try {
        await api("/users/push-token", {
          method: "POST",
          body: { token: pushToken, platform: Platform.OS },
        });
      } catch {}
    })();
  }, [token]);

  return <Ctx.Provider value={{ send, subscribe, isOpen }}>{children}</Ctx.Provider>;
}

export function useRealtime() {
  return useContext(Ctx);
}

/** Subscribe to a single realtime event type, scoped to the lifetime of a component. */
export function useRealtimeEvent(eventType: string, handler: Listener) {
  const { subscribe } = useRealtime();
  useEffect(() => {
    return subscribe(eventType, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType]);
}
