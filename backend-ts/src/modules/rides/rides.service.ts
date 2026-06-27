/** Ride service with realtime dispatch + push notifications. Mirrors `rides.py`. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RealtimeService } from '../../realtime/realtime.service';
import {
  clean,
  genPin,
  haversineKm,
  iso,
  newId,
  now,
  round,
} from '../../common/utils';
import { Ride } from '../../db/schemas/ride.schema';
import { Driver } from '../../db/schemas/driver.schema';
import { User } from '../../db/schemas/user.schema';
import { FareConfig } from '../../db/schemas/fare-config.schema';
import { CancelDto, CreateRideDto, TipDto, VerifyPinDto } from './rides.dto';

@Injectable()
export class RidesService {
  private readonly logger = new Logger('fifthdigit.rides');

  constructor(
    private readonly realtime: RealtimeService,
    @InjectModel(Ride.name) private readonly rideModel: Model<Ride>,
    @InjectModel(Driver.name) private readonly driverModel: Model<Driver>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(FareConfig.name)
    private readonly fareConfigModel: Model<FareConfig>,
  ) {}

  private calcFare(
    rideType: string,
    distanceKm: number | null | undefined,
    cfg: any,
  ): number {
    if (rideType === 'local') {
      return round(
        cfg.base_fare + cfg.per_km * Math.max(distanceKm || 0, 1),
        2,
      );
    }
    if (rideType === 'poochari') return cfg.poochari_fare;
    if (rideType === 'radhakund') return cfg.radhakund_fare;
    if (rideType === 'combined') return cfg.combined_fare;
    throw new BadRequestException('Unknown ride type');
  }

  /** Online + KYC-approved drivers within dispatch radius (all online if no coords). */
  private async eligibleDriversForRide(
    ride: any,
    cfg: any,
  ): Promise<{ user_id: string; distance_km: number | null }[]> {
    const dispatchRadius = Number(cfg?.dispatch_radius_km ?? 5.0);
    const drivers = await this.driverModel
      .find({ online: true, kyc_status: 'approved' })
      .lean();
    const out: { user_id: string; distance_km: number | null }[] = [];
    const pk = ride.pickup || {};
    const pkLat = pk.lat;
    const pkLng = pk.lng;
    for (const d of drivers as any[]) {
      if (
        pkLat == null ||
        pkLng == null ||
        d.current_lat == null ||
        d.current_lng == null
      ) {
        out.push({ user_id: d.user_id, distance_km: null });
        continue;
      }
      const dist = haversineKm(pkLat, pkLng, d.current_lat, d.current_lng);
      if (dist <= dispatchRadius) {
        out.push({ user_id: d.user_id, distance_km: dist });
      }
    }
    // Sort by distance (None last)
    out.sort((a, b) => {
      const an = a.distance_km == null ? 1 : 0;
      const bn = b.distance_km == null ? 1 : 0;
      if (an !== bn) return an - bn;
      return (a.distance_km || 0) - (b.distance_km || 0);
    });
    return out;
  }

  private async pushUsers(
    userIds: string[],
    title: string,
    body: string,
    data: Record<string, any>,
  ): Promise<void> {
    if (!userIds.length) return;
    const docs = await this.userModel
      .find({ id: { $in: userIds } })
      .limit(500)
      .lean();
    const tokens = (docs as any[])
      .map((d) => d.expo_push_token)
      .filter((t) => t);
    if (tokens.length) await this.realtime.pushExpo(tokens, title, body, data);
  }

  async createRide(req: CreateRideDto, user: any) {
    const cfg = (await this.fareConfigModel.findOne({ id: 'default' }).lean()) || {};
    const fare = this.calcFare(req.type, req.distance_km, cfg);
    const commission = round((fare * (cfg as any).commission_pct) / 100, 2);
    // Sticky per-passenger PIN; backfill if missing (legacy accounts).
    let pin = user.ride_pin;
    if (!pin) {
      pin = genPin();
      await this.userModel.updateOne(
        { id: user.id },
        { $set: { ride_pin: pin } },
      );
    }
    let scheduledAt: Date | null = null;
    if (req.scheduled_at) {
      const parsed = new Date(req.scheduled_at.replace('Z', '+00:00'));
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid scheduled_at');
      }
      scheduledAt = parsed;
    }

    const ride: any = {
      id: newId(),
      passenger_id: user.id,
      passenger_name: user.name || user.phone,
      passenger_phone: user.phone,
      driver_id: null,
      driver_name: null,
      driver_phone: null,
      driver_vehicle_no: null,
      type: req.type,
      pickup: req.pickup ?? null,
      drop: req.drop ?? null,
      distance_km: req.distance_km ?? null,
      fare,
      commission,
      driver_earning: round(fare - commission, 2),
      tip: 0.0,
      payment_method: req.payment_method,
      status: scheduledAt ? 'scheduled' : 'requested',
      pin,
      scheduled_at: scheduledAt,
      notes: req.notes ?? null,
      audit_log: [{ at: iso(now()), event: 'created', by: user.id }],
      created_at: now(),
      accepted_at: null,
      started_at: null,
      completed_at: null,
      cancelled_at: null,
      cancel_reason: null,
      cancelled_by: null,
    };
    await this.rideModel.create(ride);
    this.logger.log(
      `Ride created id=${ride.id} type=${req.type} fare=${fare} ` +
        `passenger=${user.id} status=${ride.status}`,
    );

    // Live dispatch to eligible drivers if immediate (not scheduled)
    if (!scheduledAt) {
      const eligible = await this.eligibleDriversForRide(ride, cfg);
      const driverIds = eligible.map((d) => d.user_id);
      this.realtime.broadcast(driverIds, {
        type: 'ride_requested',
        ride: clean(ride),
      });
      const bodyTxt =
        `New ${req.type} ride • ₹${fare}` +
        (req.distance_km ? ` • ${round(req.distance_km, 1)} km` : '');
      await this.pushUsers(driverIds, 'New ride request', bodyTxt, {
        ride_id: ride.id,
        type: 'ride_requested',
      });
      this.logger.log(
        `Ride dispatched id=${ride.id} eligibleDrivers=${driverIds.length}`,
      );
    }
    return clean(ride);
  }

  async myRides(user: any) {
    const q =
      user.role === 'passenger'
        ? { passenger_id: user.id }
        : { driver_id: user.id };
    const rides = await this.rideModel
      .find(q)
      .sort({ created_at: -1 })
      .limit(100)
      .lean();
    return { rides: (rides as any[]).map((r) => clean(r)) };
  }

  async getRide(rideId: string, user: any) {
    const ride = await this.rideModel.findOne({ id: rideId }).lean();
    if (!ride) throw new NotFoundException('Ride not found');
    if (
      user.role !== 'admin' &&
      ![ride.passenger_id, ride.driver_id].includes(user.id)
    ) {
      throw new ForbiddenException('Forbidden');
    }
    const out: any = clean(ride);
    if (user.role === 'driver' && (ride as any).status === 'requested') {
      out.pin = null;
    }
    // Driver's last known location for passenger view (after accept)
    if (
      user.role === 'passenger' &&
      (ride as any).driver_id &&
      ['accepted', 'started'].includes((ride as any).status)
    ) {
      const drv = await this.driverModel
        .findOne({ user_id: (ride as any).driver_id })
        .lean();
      if (drv && (drv as any).current_lat != null) {
        out.driver_location = {
          lat: (drv as any).current_lat,
          lng: (drv as any).current_lng,
          heading: (drv as any).heading,
          speed: (drv as any).speed,
        };
      }
    }
    // Passenger's last known location for driver view (after accept)
    if (
      user.role === 'driver' &&
      ['accepted', 'started'].includes((ride as any).status)
    ) {
      if ((ride as any).passenger_lat != null) {
        out.passenger_location = {
          lat: (ride as any).passenger_lat,
          lng: (ride as any).passenger_lng,
        };
      }
    }
    return out;
  }

  async acceptRide(rideId: string, user: any) {
    const driver = await this.driverModel
      .findOne({ user_id: user.id })
      .lean();
    if (!driver || (driver as any).kyc_status !== 'approved') {
      throw new ForbiddenException('KYC not approved');
    }
    const ride = await this.rideModel
      .findOne({ id: rideId, status: 'requested', driver_id: null })
      .lean();
    if (!ride) throw new ConflictException('Ride no longer available');
    const audit = ((ride as any).audit_log || []).concat([
      { at: iso(now()), event: 'accepted', by: user.id },
    ]);
    await this.rideModel.updateOne(
      { id: rideId, driver_id: null },
      {
        $set: {
          driver_id: user.id,
          driver_name: user.name || user.phone,
          driver_phone: user.phone,
          driver_vehicle_no: (driver as any).vehicle_no,
          status: 'accepted',
          accepted_at: now(),
          audit_log: audit,
        },
      },
    );
    const fresh = await this.rideModel.findOne({ id: rideId }).lean();

    const passengerId = (fresh as any).passenger_id;
    const out = clean(fresh) as any;
    this.realtime.sendToUser(passengerId, { type: 'ride_accepted', ride: out });
    await this.pushUsers(
      [passengerId],
      'Driver assigned 🛺',
      `${out.driver_name} is heading your way. PIN: ${out.pin}`,
      { ride_id: rideId, type: 'ride_accepted' },
    );
    // Notify other drivers that this ride is gone
    const otherDrivers = await this.driverModel
      .find({ online: true, kyc_status: 'approved' })
      .lean();
    const others = (otherDrivers as any[])
      .map((d) => d.user_id)
      .filter((u) => u && u !== user.id);
    this.realtime.broadcast(others, { type: 'ride_taken', ride_id: rideId });
    this.logger.log(`Ride accepted id=${rideId} driver=${user.id}`);
    return out;
  }

  async verifyPin(rideId: string, req: VerifyPinDto, user: any) {
    const ride = await this.rideModel
      .findOne({ id: rideId, driver_id: user.id })
      .lean();
    if (!ride) throw new NotFoundException('Ride not found');
    if ((ride as any).status !== 'accepted') {
      throw new BadRequestException(
        `Cannot start from status ${(ride as any).status}`,
      );
    }
    if (req.pin !== (ride as any).pin) {
      this.logger.warn(
        `PIN verification failed ride=${rideId} driver=${user.id}`,
      );
      throw new BadRequestException('Incorrect PIN');
    }
    const audit = ((ride as any).audit_log || []).concat([
      { at: iso(now()), event: 'started', by: user.id },
    ]);
    await this.rideModel.updateOne(
      { id: rideId },
      { $set: { status: 'started', started_at: now(), audit_log: audit } },
    );
    this.realtime.sendToUser((ride as any).passenger_id, {
      type: 'ride_started',
      ride_id: rideId,
    });
    await this.pushUsers(
      [(ride as any).passenger_id],
      'Ride started 🚦',
      'Have a safe journey!',
      { ride_id: rideId, type: 'ride_started' },
    );
    this.logger.log(`Ride started id=${rideId} driver=${user.id}`);
    return { ok: true, status: 'started' };
  }

  async completeRide(rideId: string, user: any) {
    const ride = await this.rideModel
      .findOne({ id: rideId, driver_id: user.id })
      .lean();
    if (!ride) throw new NotFoundException('Ride not found');
    if ((ride as any).status !== 'started') {
      throw new BadRequestException(
        `Cannot complete from ${(ride as any).status}`,
      );
    }
    const audit = ((ride as any).audit_log || []).concat([
      { at: iso(now()), event: 'completed', by: user.id },
    ]);
    await this.rideModel.updateOne(
      { id: rideId },
      { $set: { status: 'completed', completed_at: now(), audit_log: audit } },
    );
    await this.driverModel.updateOne(
      { user_id: user.id },
      { $inc: { earnings_total: (ride as any).driver_earning } },
    );
    this.realtime.sendToUser((ride as any).passenger_id, {
      type: 'ride_completed',
      ride_id: rideId,
      fare: (ride as any).fare,
    });
    await this.pushUsers(
      [(ride as any).passenger_id],
      'Ride completed 🙏',
      `Total fare ₹${Math.round((ride as any).fare)}. Thank you for choosing FifthDigit!`,
      { ride_id: rideId, type: 'ride_completed' },
    );
    this.logger.log(
      `Ride completed id=${rideId} driver=${user.id} ` +
        `fare=${(ride as any).fare} earning=${(ride as any).driver_earning}`,
    );
    return { ok: true, status: 'completed' };
  }

  async addTip(rideId: string, req: TipDto, user: any) {
    if (![10, 20, 50].includes(req.amount)) {
      throw new BadRequestException('Tip must be 10, 20 or 50');
    }
    const ride = await this.rideModel
      .findOne({ id: rideId, passenger_id: user.id })
      .lean();
    if (!ride) throw new NotFoundException('Ride not found');
    if ((ride as any).status !== 'requested' || (ride as any).driver_id) {
      throw new BadRequestException(
        'Tips can only be added while still searching for a driver',
      );
    }
    const cfg = (await this.fareConfigModel.findOne({ id: 'default' }).lean()) || {};
    const tipTotal = Number((ride as any).tip || 0) + Number(req.amount);
    const newFare = round(Number((ride as any).fare) + Number(req.amount), 2);
    const newCommission = round(
      (newFare * ((cfg as any).commission_pct ?? 10)) / 100,
      2,
    );
    const newEarning = round(newFare - newCommission, 2);
    const audit = ((ride as any).audit_log || []).concat([
      { at: iso(now()), event: 'tip_added', by: user.id, amount: req.amount },
    ]);
    await this.rideModel.updateOne(
      { id: rideId },
      {
        $set: {
          fare: newFare,
          commission: newCommission,
          driver_earning: newEarning,
          tip: tipTotal,
          audit_log: audit,
        },
      },
    );
    const fresh = await this.rideModel.findOne({ id: rideId }).lean();
    const eligible = await this.eligibleDriversForRide(fresh, cfg);
    const driverIds = eligible.map((d) => d.user_id);
    this.realtime.broadcast(driverIds, {
      type: 'ride_requested',
      ride: clean(fresh),
      boosted: true,
    });
    await this.pushUsers(
      driverIds,
      `₹${Math.trunc(tipTotal)} tip added 💰`,
      `Boosted fare ₹${Math.round(newFare)} • ${(ride as any).type || 'ride'}`,
      { ride_id: rideId, type: 'ride_requested' },
    );
    this.logger.log(
      `Tip added ride=${rideId} amount=${req.amount} newFare=${newFare} ` +
        `rebroadcast=${driverIds.length}`,
    );
    return clean(fresh);
  }

  async cancelRide(rideId: string, req: CancelDto, user: any) {
    const ride = await this.rideModel.findOne({ id: rideId }).lean();
    if (!ride) throw new NotFoundException('Ride not found');
    if (![ride.passenger_id, ride.driver_id].includes(user.id)) {
      throw new ForbiddenException('Not your ride');
    }
    if (['completed', 'cancelled'].includes((ride as any).status)) {
      throw new BadRequestException(`Already ${(ride as any).status}`);
    }
    const audit = ((ride as any).audit_log || []).concat([
      {
        at: iso(now()),
        event: 'cancelled',
        by: user.id,
        role: user.role,
        reason: req.reason,
      },
    ]);
    await this.rideModel.updateOne(
      { id: rideId },
      {
        $set: {
          status: 'cancelled',
          cancelled_at: now(),
          cancel_reason: req.reason,
          cancelled_by: user.role,
          audit_log: audit,
        },
      },
    );
    const otherId =
      user.role === 'passenger'
        ? (ride as any).driver_id
        : (ride as any).passenger_id;
    if (otherId) {
      this.realtime.sendToUser(otherId, {
        type: 'ride_cancelled',
        ride_id: rideId,
        by: user.role,
        reason: req.reason,
      });
      await this.pushUsers(
        [otherId],
        'Ride cancelled',
        `Cancelled by ${user.role}: ${req.reason}`,
        { ride_id: rideId, type: 'ride_cancelled' },
      );
    }
    this.logger.log(
      `Ride cancelled id=${rideId} by=${user.role} user=${user.id} ` +
        `reason="${req.reason}"`,
    );
    return { ok: true };
  }
}
