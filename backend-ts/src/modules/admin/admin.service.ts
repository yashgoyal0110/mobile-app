/** Admin service (dashboard, fares, drivers, audit, landmarks). Mirrors `admin.py`. */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { clean, newId, now, round } from '../../common/utils';
import { FareConfig } from '../../db/schemas/fare-config.schema';
import { Driver } from '../../db/schemas/driver.schema';
import { Ride } from '../../db/schemas/ride.schema';
import { User } from '../../db/schemas/user.schema';
import { Complaint } from '../../db/schemas/complaint.schema';
import { Withdrawal } from '../../db/schemas/withdrawal.schema';
import { FareSuggestion } from '../../db/schemas/fare-suggestion.schema';
import { LandmarkDto, LandmarkUpdateDto } from './admin.dto';

const ALLOWED_CFG_FIELDS = new Set([
  'base_fare',
  'per_km',
  'poochari_fare',
  'radhakund_fare',
  'combined_fare',
  'commission_pct',
  'cancellation_fee',
  'boundary_radius_km',
  'dispatch_radius_km',
  'surge_pct',
  'landmarks',
  'city_center',
  'support_phone',
  'support_email',
  'region_bbox',
]);

function utcMidnightToday(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger('fifthdigit.admin');

  constructor(
    @InjectModel(FareConfig.name)
    private readonly fareConfigModel: Model<FareConfig>,
    @InjectModel(Driver.name) private readonly driverModel: Model<Driver>,
    @InjectModel(Ride.name) private readonly rideModel: Model<Ride>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Complaint.name)
    private readonly complaintModel: Model<Complaint>,
    @InjectModel(Withdrawal.name)
    private readonly withdrawalModel: Model<Withdrawal>,
    @InjectModel(FareSuggestion.name)
    private readonly suggestionModel: Model<FareSuggestion>,
  ) {}

  // ---------- Fare / config ----------
  async updateFareConfig(payload: Record<string, any>) {
    const updates: Record<string, any> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (ALLOWED_CFG_FIELDS.has(k)) updates[k] = v;
    }
    updates.updated_at = now();
    await this.fareConfigModel.updateOne({ id: 'default' }, { $set: updates });
    const cfg = await this.fareConfigModel.findOne({ id: 'default' }).lean();
    this.logger.log(
      `Fare config updated fields=[${Object.keys(updates)
        .filter((k) => k !== 'updated_at')
        .join(',')}]`,
    );
    return clean(cfg);
  }

  // ---------- Landmarks CRUD ----------
  async listLandmarks() {
    const cfg = await this.fareConfigModel.findOne({ id: 'default' }).lean();
    return { landmarks: (cfg as any)?.landmarks || [] };
  }

  async addLandmark(req: LandmarkDto) {
    const cfg = await this.fareConfigModel.findOne({ id: 'default' }).lean();
    const landmarks = (cfg as any)?.landmarks || [];
    const newLm = { id: newId(), name: req.name, lat: req.lat, lng: req.lng };
    landmarks.push(newLm);
    await this.fareConfigModel.updateOne(
      { id: 'default' },
      { $set: { landmarks, updated_at: now() } },
    );
    return newLm;
  }

  async updateLandmark(lid: string, req: LandmarkUpdateDto) {
    const cfg = await this.fareConfigModel.findOne({ id: 'default' }).lean();
    const landmarks = (cfg as any)?.landmarks || [];
    let found = false;
    for (const lm of landmarks) {
      if (lm.id === lid) {
        if (req.name != null) lm.name = req.name;
        if (req.lat != null) lm.lat = req.lat;
        if (req.lng != null) lm.lng = req.lng;
        found = true;
        break;
      }
    }
    if (!found) throw new NotFoundException('Landmark not found');
    await this.fareConfigModel.updateOne(
      { id: 'default' },
      { $set: { landmarks, updated_at: now() } },
    );
    return { ok: true };
  }

  async deleteLandmark(lid: string) {
    const cfg = await this.fareConfigModel.findOne({ id: 'default' }).lean();
    const landmarks = ((cfg as any)?.landmarks || []).filter(
      (lm: any) => lm.id !== lid,
    );
    await this.fareConfigModel.updateOne(
      { id: 'default' },
      { $set: { landmarks, updated_at: now() } },
    );
    return { ok: true };
  }

  // ---------- Drivers ----------
  async listDrivers(statusFilter?: string) {
    const q: any = {};
    if (statusFilter) q.kyc_status = statusFilter;
    const drivers = await this.driverModel
      .find(q)
      .sort({ created_at: -1 })
      .limit(100)
      .lean();
    const out: any[] = [];
    for (const d of drivers as any[]) {
      const u = await this.userModel.findOne({ id: d.user_id }).lean();
      const item: any = clean(d);
      item.user = u ? clean(u) : null;
      out.push(item);
    }
    return { drivers: out };
  }

  async approveDriver(driverUserId: string) {
    const res = await this.driverModel.updateOne(
      { user_id: driverUserId },
      { $set: { kyc_status: 'approved', approved_at: now() } },
    );
    if (res.matchedCount === 0) throw new NotFoundException('Driver not found');
    this.logger.log(`Driver KYC approved driver=${driverUserId}`);
    return { ok: true };
  }

  async rejectDriver(driverUserId: string, body: any) {
    const reason = (body || {}).reason || 'Documents not verified';
    const res = await this.driverModel.updateOne(
      { user_id: driverUserId },
      {
        $set: {
          kyc_status: 'rejected',
          rejection_reason: reason,
          online: false,
        },
      },
    );
    if (res.matchedCount === 0) throw new NotFoundException('Driver not found');
    this.logger.warn(
      `Driver KYC rejected driver=${driverUserId} reason="${reason}"`,
    );
    return { ok: true };
  }

  // ---------- Audit / dashboard ----------
  async auditRides(statusFilter?: string, limit = 100) {
    const q: any = {};
    if (statusFilter) q.status = statusFilter;
    const rides = await this.rideModel
      .find(q)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
    return { rides: (rides as any[]).map((r) => clean(r)) };
  }

  async dashboard() {
    const todayStart = utcMidnightToday();
    const totalRides = await this.rideModel.countDocuments({});
    const ridesToday = await this.rideModel.countDocuments({
      created_at: { $gte: todayStart },
    });
    const activeDrivers = await this.driverModel.countDocuments({
      online: true,
      kyc_status: 'approved',
    });
    const pendingApprovals = await this.driverModel.countDocuments({
      kyc_status: 'pending',
    });
    const openComplaints = await this.complaintModel.countDocuments({
      status: 'open',
    });
    const completed = await this.rideModel
      .find({ status: 'completed' })
      .limit(10000)
      .lean();
    const revenue = (completed as any[]).reduce(
      (s, r) => s + (r.commission || 0),
      0,
    );
    const totalFare = (completed as any[]).reduce(
      (s, r) => s + (r.fare || 0),
      0,
    );
    return {
      total_rides: totalRides,
      rides_today: ridesToday,
      active_drivers: activeDrivers,
      pending_approvals: pendingApprovals,
      open_complaints: openComplaints,
      platform_revenue: round(revenue, 2),
      total_fare_processed: round(totalFare, 2),
    };
  }

  // ---------- Reports / charts ----------
  async reportTimeseries(days: number) {
    days = Math.max(1, Math.min(days, 60));
    const today = utcMidnightToday();
    const start = new Date(today.getTime() - (days - 1) * 86400000);
    const pipeline: any[] = [
      { $match: { created_at: { $gte: start } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$created_at' },
          },
          rides: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$commission', 0],
            },
          },
          fare: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$fare', 0],
            },
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
        },
      },
    ];
    const rows = await this.rideModel.aggregate(pipeline);
    const raw: Record<string, any> = {};
    for (const row of rows) raw[row._id] = row;
    const out: any[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86400000)
        .toISOString()
        .slice(0, 10);
      const row = raw[d] || {};
      out.push({
        date: d,
        rides: row.rides || 0,
        completed: row.completed || 0,
        cancelled: row.cancelled || 0,
        revenue: round(row.revenue || 0, 2),
        fare: round(row.fare || 0, 2),
      });
    }
    return { series: out };
  }

  async reportLeaderboard(limit = 10) {
    const pipeline: any[] = [
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$driver_id',
          trips: { $sum: 1 },
          earnings: { $sum: '$driver_earning' },
          fare: { $sum: '$fare' },
        },
      },
      { $sort: { earnings: -1 } },
      { $limit: limit },
    ];
    const rows: any[] = [];
    for (const r of await this.rideModel.aggregate(pipeline)) {
      const driverId = r._id;
      if (!driverId) continue;
      const u = await this.userModel.findOne({ id: driverId }).lean();
      const d = await this.driverModel.findOne({ user_id: driverId }).lean();
      rows.push({
        driver_id: driverId,
        name: (u as any)?.name,
        phone: (u as any)?.phone,
        vehicle_no: (d as any)?.vehicle_no,
        avg_rating: (d as any)?.avg_rating,
        total_ratings: (d as any)?.total_ratings || 0,
        trips: r.trips,
        earnings: round(r.earnings, 2),
        fare: round(r.fare, 2),
      });
    }
    return { leaderboard: rows };
  }

  async reportTopRoutes(limit = 10) {
    const pipeline: any[] = [
      { $match: { status: 'completed', type: 'local' } },
      {
        $group: {
          _id: { pickup: '$pickup.name', drop: '$drop.name' },
          count: { $sum: 1 },
          fare: { $sum: '$fare' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ];
    const out: any[] = [];
    for (const r of await this.rideModel.aggregate(pipeline)) {
      const pid = r._id || {};
      out.push({
        pickup: pid.pickup || 'Unknown',
        drop: pid.drop || 'Unknown',
        count: r.count,
        fare: round(r.fare, 2),
      });
    }
    return { routes: out };
  }

  // ---------- Withdrawals ----------
  async listWithdrawals() {
    const w = await this.withdrawalModel
      .find()
      .sort({ requested_at: -1 })
      .limit(100)
      .lean();
    return { withdrawals: (w as any[]).map((x) => clean(x)) };
  }

  async markWithdrawalPaid(wid: string) {
    await this.withdrawalModel.updateOne(
      { id: wid },
      { $set: { status: 'paid', paid_at: now() } },
    );
    this.logger.log(`Withdrawal marked paid id=${wid}`);
    return { ok: true };
  }

  // ---------- Apply driver suggestion ----------
  async applySuggestion(sid: string) {
    const s = await this.suggestionModel.findOne({ id: sid }).lean();
    if (!s) throw new NotFoundException('Not found');
    const rt = (s as any).ride_type;
    const fieldMap: Record<string, string> = {
      'local-base': 'base_fare',
      'local-per-km': 'per_km',
      poochari: 'poochari_fare',
      radhakund: 'radhakund_fare',
      combined: 'combined_fare',
    };
    const field = fieldMap[rt];
    if (!field) throw new BadRequestException('Unknown ride_type');
    await this.fareConfigModel.updateOne(
      { id: 'default' },
      { $set: { [field]: (s as any).amount, updated_at: now() } },
    );
    await this.suggestionModel.updateOne(
      { id: sid },
      { $set: { status: 'applied' } },
    );
    this.logger.log(
      `Fare suggestion applied id=${sid} field=${field} amount=${(s as any).amount}`,
    );
    return { ok: true };
  }
}
