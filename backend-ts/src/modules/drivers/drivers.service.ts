/** Driver service. Mirrors Python `app/routes/drivers.py`. */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RealtimeService } from '../../realtime/realtime.service';
import { clean, newId, now } from '../../common/utils';
import { Driver } from '../../db/schemas/driver.schema';
import { Ride } from '../../db/schemas/ride.schema';
import { User } from '../../db/schemas/user.schema';
import { Withdrawal } from '../../db/schemas/withdrawal.schema';
import { StorageService } from '../uploads/storage.service';
import { KycDto, LocationDto, OnlineDto, WithdrawDto } from './drivers.dto';

@Injectable()
export class DriversService {
  private readonly logger = new Logger('fifthdigit.drivers');

  constructor(
    private readonly realtime: RealtimeService,
    private readonly storage: StorageService,
    @InjectModel(Driver.name) private readonly driverModel: Model<Driver>,
    @InjectModel(Ride.name) private readonly rideModel: Model<Ride>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Withdrawal.name)
    private readonly withdrawalModel: Model<Withdrawal>,
  ) {}

  async submitKyc(req: KycDto, user: any) {
    const driver = await this.driverModel.findOne({ user_id: user.id }).lean();
    if (!driver) throw new NotFoundException('Driver record missing');
    // Once approved, details are locked — the admin must re-open (reject) KYC
    // before the driver can change anything.
    if ((driver as any).kyc_status === 'approved') {
      throw new ForbiddenException(
        'Your KYC is already approved. Please contact the admin to change your details.',
      );
    }
    const updates: any = { ...req };
    // Atomicity gate: all three documents must be uploaded, else don't submit.
    updates.profile_photo = await this.storage.verifyOne(
      req.profile_photo,
      'driver_profile',
    );
    updates.aadhar_photo = await this.storage.verifyOne(
      req.aadhar_photo,
      'driver_kyc',
    );
    updates.rc_photo = await this.storage.verifyOne(req.rc_photo, 'driver_kyc');
    updates.kyc_status = 'pending';
    updates.submitted_at = now();
    await this.driverModel.updateOne(
      { user_id: user.id },
      { $set: updates },
    );
    if (req.name) {
      await this.userModel.updateOne(
        { id: user.id },
        { $set: { name: req.name } },
      );
    }
    // Clean up any documents that were replaced during a re-submit (best-effort).
    const d = driver as any;
    await this.storage.deleteRemoved(
      [d.profile_photo, d.aadhar_photo, d.rc_photo].filter(Boolean),
      [updates.profile_photo, updates.aadhar_photo, updates.rc_photo],
    );
    const fresh = await this.driverModel.findOne({ user_id: user.id }).lean();
    this.logger.log(
      `KYC submitted driver=${user.id} vehicle=${req.vehicle_no}`,
    );
    return clean(fresh);
  }

  async setOnline(req: OnlineDto, user: any) {
    const driver = await this.driverModel.findOne({ user_id: user.id }).lean();
    if (!driver) throw new NotFoundException('Driver record missing');
    if (req.online && (driver as any).kyc_status !== 'approved') {
      throw new ForbiddenException(
        'Complete KYC and get admin approval to go online',
      );
    }
    await this.driverModel.updateOne(
      { user_id: user.id },
      { $set: { online: req.online, last_seen_at: now() } },
    );
    if (req.online) this.realtime.markOnline(user.id);
    else this.realtime.markOffline(user.id);
    this.logger.log(
      `Driver ${req.online ? 'online' : 'offline'} driver=${user.id}`,
    );
    return { online: req.online };
  }

  async updateLocation(req: LocationDto, user: any) {
    // High-frequency: debug only.
    this.logger.debug(
      `Driver location driver=${user.id} lat=${req.lat} lng=${req.lng}`,
    );
    await this.driverModel.updateOne(
      { user_id: user.id },
      {
        $set: {
          current_lat: req.lat,
          current_lng: req.lng,
          heading: req.heading,
          speed: req.speed,
          last_seen_at: now(),
        },
      },
    );
    const active = await this.rideModel
      .findOne({
        driver_id: user.id,
        status: { $in: ['accepted', 'started'] },
      })
      .lean();
    if (active && (active as any).passenger_id) {
      this.realtime.sendToUser((active as any).passenger_id, {
        type: 'driver_location',
        ride_id: (active as any).id,
        lat: req.lat,
        lng: req.lng,
      });
    }
    return { ok: true };
  }

  async incomingRides(user: any) {
    const driver = await this.driverModel.findOne({ user_id: user.id }).lean();
    if (
      !driver ||
      !(driver as any).online ||
      (driver as any).kyc_status !== 'approved'
    ) {
      return { rides: [] };
    }
    const rides = await this.rideModel
      .find({ status: 'requested', driver_id: null })
      .sort({ created_at: -1 })
      .limit(20)
      .lean();
    return { rides: (rides as any[]).map((r) => clean(r)) };
  }

  async earnings(user: any) {
    const driver = await this.driverModel.findOne({ user_id: user.id }).lean();
    if (!driver) throw new NotFoundException('Driver not found');
    const balance =
      ((driver as any).earnings_total || 0) -
      ((driver as any).earnings_withdrawn || 0);
    const rides = await this.rideModel
      .find({ driver_id: user.id, status: 'completed' })
      .sort({ completed_at: -1 })
      .limit(50)
      .lean();
    return {
      total: (driver as any).earnings_total || 0,
      withdrawn: (driver as any).earnings_withdrawn || 0,
      balance,
      completed_rides: (rides as any[]).map((r) => clean(r)),
    };
  }

  async withdraw(req: WithdrawDto, user: any) {
    const driver = await this.driverModel.findOne({ user_id: user.id }).lean();
    if (!driver) throw new NotFoundException('Driver not found');
    const balance =
      ((driver as any).earnings_total || 0) -
      ((driver as any).earnings_withdrawn || 0);
    if (req.amount <= 0 || req.amount > balance) {
      throw new BadRequestException(
        `Amount must be between 0 and ${balance}`,
      );
    }
    const w: any = {
      id: newId(),
      driver_id: user.id,
      amount: req.amount,
      upi_id: (driver as any).upi_id,
      status: 'requested',
      requested_at: now(),
    };
    await this.withdrawalModel.create(w);
    await this.driverModel.updateOne(
      { user_id: user.id },
      { $inc: { earnings_withdrawn: req.amount } },
    );
    this.logger.log(
      `Withdrawal requested id=${w.id} driver=${user.id} amount=${req.amount}`,
    );
    return clean(w);
  }
}
