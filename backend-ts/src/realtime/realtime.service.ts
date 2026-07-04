/**
 * WebSocket realtime connection manager + event broadcasting + Expo push.
 * Mirrors Python `app/realtime.py`.
 *
 * Maintains a set of WebSocket connections keyed by user_id. Each ride
 * lifecycle event publishes a payload to the relevant users (passenger and
 * assigned driver) as well as the broader drivers pool when a new ride is
 * requested. Also pushes to mobile devices via Expo's free push service.
 */
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { WebSocket } from 'ws';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger('fifthdigit.realtime');

  // user_id -> set of WebSocket
  private readonly conns = new Map<string, Set<WebSocket>>();
  // online drivers' ids (kyc_approved && online toggled on)
  private readonly onlineDrivers = new Set<string>();

  connect(userId: string, ws: WebSocket): void {
    let set = this.conns.get(userId);
    if (!set) {
      set = new Set();
      this.conns.set(userId, set);
    }
    set.add(ws);
  }

  disconnect(userId: string, ws: WebSocket): void {
    const set = this.conns.get(userId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) this.conns.delete(userId);
    }
  }

  isConnected(userId: string): boolean {
    return this.conns.has(userId);
  }

  sendToUser(userId: string, payload: any): void {
    const sockets = Array.from(this.conns.get(userId) ?? []);
    const data = JSON.stringify(payload);
    for (const ws of sockets) {
      try {
        // 1 === WebSocket.OPEN
        if (ws.readyState === 1) {
          ws.send(data);
        } else {
          this.disconnect(userId, ws);
        }
      } catch (e) {
        this.logger.warn(`WS send to ${userId} failed: ${e}`);
        this.disconnect(userId, ws);
      }
    }
  }

  broadcast(userIds: string[], payload: any): void {
    for (const uid of userIds) this.sendToUser(uid, payload);
  }

  markOnline(driverUserId: string): void {
    this.onlineDrivers.add(driverUserId);
  }

  markOffline(driverUserId: string): void {
    this.onlineDrivers.delete(driverUserId);
  }

  getOnlineDrivers(): Set<string> {
    return new Set(this.onlineDrivers);
  }

  /** Send a batch push notification via Expo. Free service, no API key. */
  async pushExpo(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const valid = tokens.filter(
      (t) => t && t.startsWith('ExponentPushToken'),
    );
    if (valid.length === 0) return;
    const messages = valid.map((t) => ({
      to: t,
      sound: 'default',
      title,
      body,
      data: data || {},
      priority: 'high',
      channelId: 'default',
    }));
    try {
      const r = await axios.post(EXPO_PUSH_URL, messages, {
        headers: { Accept: 'application/json' },
        timeout: 10000,
        validateStatus: () => true,
      });
      if (r.status >= 300) {
        this.logger.warn(
          `Expo push non-2xx: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`,
        );
      } else {
        this.logger.debug(
          `Expo push sent count=${valid.length} title="${title}"`,
        );
      }
    } catch (e) {
      this.logger.warn(`Expo push failed: ${e}`);
    }
  }
}
