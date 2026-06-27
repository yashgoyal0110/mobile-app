/**
 * Raw WebSocket endpoint handler. Mirrors Python `app/routes/ws.py`.
 *
 * The Expo client opens a plain `new WebSocket('.../api/ws?token=...')` and
 * exchanges bare JSON messages keyed by `type` (`ping`, `location`) — NOT the
 * `{event,data}` envelope a Nest WebSocketGateway expects. So we attach our own
 * `ws` server to the HTTP server's `upgrade` event (wired in main.ts) and drive
 * the protocol directly, preserving the exact contract.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { WebSocket } from 'ws';
import { JwtService } from '../common/jwt.service';
import { RealtimeService } from './realtime.service';
import { User } from '../db/schemas/user.schema';
import { Driver } from '../db/schemas/driver.schema';
import { Ride } from '../db/schemas/ride.schema';

@Injectable()
export class WsHandler {
  private readonly logger = new Logger('tirthride.ws');

  constructor(
    private readonly jwt: JwtService,
    private readonly realtime: RealtimeService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Driver.name) private readonly driverModel: Model<Driver>,
    @InjectModel(Ride.name) private readonly rideModel: Model<Ride>,
  ) {}

  /** Called for every new socket. `token` comes from the `?token=` query. */
  async handleConnection(ws: WebSocket, token: string | null): Promise<void> {
    const payload = token ? this.jwt.verify(token) : null;
    if (!payload || !payload.sub) {
      ws.close(4401);
      return;
    }
    const userId = payload.sub;
    const user = await this.userModel.findOne({ id: userId }).lean();
    if (!user) {
      ws.close(4404);
      return;
    }

    this.realtime.connect(userId, ws);
    // Greeting
    this.realtime.sendToUser(userId, {
      type: 'hello',
      user_id: userId,
      role: user.role,
    });

    ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      this.onMessage(ws, userId, user.role, msg).catch((e) =>
        this.logger.warn(`WS error for ${userId}: ${e}`),
      );
    });

    ws.on('close', () => this.realtime.disconnect(userId, ws));
    ws.on('error', (e) => {
      this.logger.warn(`WS error for ${userId}: ${e}`);
      this.realtime.disconnect(userId, ws);
    });
  }

  private async onMessage(
    ws: WebSocket,
    userId: string,
    role: string | undefined,
    msg: any,
  ): Promise<void> {
    const mtype = msg?.type;
    if (mtype === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }
    if (mtype !== 'location') return;

    const lat = msg.lat;
    const lng = msg.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    const heading = msg.heading;
    const speed = msg.speed;

    if (role === 'driver') {
      await this.driverModel.updateOne(
        { user_id: userId },
        { $set: { current_lat: lat, current_lng: lng, heading, speed } },
      );
      const active = await this.rideModel
        .findOne({
          driver_id: userId,
          status: { $in: ['accepted', 'started'] },
        })
        .lean();
      if (active && active.passenger_id) {
        this.realtime.sendToUser(active.passenger_id, {
          type: 'driver_location',
          ride_id: active.id,
          lat,
          lng,
          heading,
          speed,
        });
      }
    } else if (role === 'passenger') {
      const active = await this.rideModel
        .findOne({
          passenger_id: userId,
          status: { $in: ['accepted', 'started'] },
        })
        .lean();
      if (active && active.driver_id) {
        await this.rideModel.updateOne(
          { id: active.id },
          { $set: { passenger_lat: lat, passenger_lng: lng } },
        );
        this.realtime.sendToUser(active.driver_id, {
          type: 'passenger_location',
          ride_id: active.id,
          lat,
          lng,
        });
      }
    }
  }
}
