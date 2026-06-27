/** Ratings & complaints service. Mirrors Python `app/routes/ratings.py`. */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { clean, newId, now, round } from '../../common/utils';
import { Rating } from '../../db/schemas/rating.schema';
import { Ride } from '../../db/schemas/ride.schema';
import { User } from '../../db/schemas/user.schema';
import { Driver } from '../../db/schemas/driver.schema';
import { Complaint } from '../../db/schemas/complaint.schema';
import {
  ComplaintDto,
  RateRideDto,
  ResolveComplaintDto,
} from './ratings.dto';

@Injectable()
export class RatingsService {
  private readonly logger = new Logger('fifthdigit.ratings');

  constructor(
    @InjectModel(Rating.name) private readonly ratingModel: Model<Rating>,
    @InjectModel(Ride.name) private readonly rideModel: Model<Ride>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Driver.name) private readonly driverModel: Model<Driver>,
    @InjectModel(Complaint.name)
    private readonly complaintModel: Model<Complaint>,
  ) {}

  private async recomputeAvgForUser(userId: string): Promise<void> {
    const pipeline: any[] = [
      { $match: { target_user_id: userId } },
      {
        $group: {
          _id: '$target_user_id',
          avg: { $avg: '$stars' },
          count: { $sum: 1 },
        },
      },
    ];
    const rows = await this.ratingModel.aggregate(pipeline);
    const row = rows.length ? rows[0] : null;
    const avg = row ? round(row.avg, 2) : null;
    const count = row ? row.count : 0;
    await this.userModel.updateOne(
      { id: userId },
      { $set: { avg_rating: avg, total_ratings: count } },
    );
    await this.driverModel.updateOne(
      { user_id: userId },
      { $set: { avg_rating: avg, total_ratings: count } },
    );
  }

  async rateRide(rideId: string, req: RateRideDto, user: any) {
    if (req.stars < 1 || req.stars > 5) {
      throw new BadRequestException('Stars must be 1-5');
    }
    const ride = await this.rideModel.findOne({ id: rideId }).lean();
    if (!ride) throw new NotFoundException('Ride not found');
    if (![ride.passenger_id, ride.driver_id].includes(user.id)) {
      throw new ForbiddenException('Not your ride');
    }
    if ((ride as any).status !== 'completed') {
      throw new BadRequestException('Can only rate a completed ride');
    }

    const byRole = user.role;
    let targetUserId: string;
    let targetRole: string;
    if (user.id === (ride as any).passenger_id) {
      targetUserId = (ride as any).driver_id;
      targetRole = 'driver';
    } else {
      targetUserId = (ride as any).passenger_id;
      targetRole = 'passenger';
    }
    if (!targetUserId) {
      throw new BadRequestException('Other party not assigned');
    }

    const existing = await this.ratingModel
      .findOne({ ride_id: rideId, by_user_id: user.id })
      .lean();
    const payload: any = {
      ride_id: rideId,
      by_user_id: user.id,
      by_role: byRole,
      target_user_id: targetUserId,
      target_role: targetRole,
      stars: req.stars,
      comment: (req.comment || '').trim() || null,
      created_at: now(),
    };
    let rating: any;
    if (existing) {
      await this.ratingModel.updateOne(
        { id: (existing as any).id },
        { $set: payload },
      );
      rating = await this.ratingModel
        .findOne({ id: (existing as any).id })
        .lean();
    } else {
      payload.id = newId();
      await this.ratingModel.create(payload);
      rating = payload;
    }

    await this.recomputeAvgForUser(targetUserId);
    this.logger.log(
      `Ride rated ride=${rideId} by=${user.id} target=${targetUserId} ` +
        `stars=${req.stars}${existing ? ' (updated)' : ''}`,
    );
    return clean(rating);
  }

  async listRideRatings(rideId: string, user: any) {
    const ride = await this.rideModel.findOne({ id: rideId }).lean();
    if (!ride) throw new NotFoundException('Ride not found');
    if (
      user.role !== 'admin' &&
      ![ride.passenger_id, ride.driver_id].includes(user.id)
    ) {
      throw new ForbiddenException('Not your ride');
    }
    const rs = await this.ratingModel
      .find({ ride_id: rideId })
      .limit(10)
      .lean();
    return { ratings: (rs as any[]).map((r) => clean(r)) };
  }

  async fileComplaint(rideId: string, req: ComplaintDto, user: any) {
    const ride = await this.rideModel.findOne({ id: rideId }).lean();
    if (!ride) throw new NotFoundException('Ride not found');
    if (![ride.passenger_id, ride.driver_id].includes(user.id)) {
      throw new ForbiddenException('Not your ride');
    }

    let against = req.against;
    if (!against) {
      against = user.role === 'passenger' ? 'driver' : 'passenger';
    }
    const againstUserId =
      against === 'driver'
        ? (ride as any).driver_id
        : (ride as any).passenger_id;

    const c: any = {
      id: newId(),
      ride_id: rideId,
      by_user_id: user.id,
      by_role: user.role,
      against,
      against_user_id: againstUserId,
      category: req.category,
      description: req.description.trim(),
      status: 'open',
      resolution: null,
      created_at: now(),
      resolved_at: null,
      resolved_by: null,
    };
    await this.complaintModel.create(c);
    this.logger.warn(
      `Complaint filed id=${c.id} ride=${rideId} category=${req.category} ` +
        `by=${user.id} against=${against}`,
    );
    return clean(c);
  }

  async userRating(userId: string) {
    const target = await this.userModel.findOne({ id: userId }).lean();
    if (!target) throw new NotFoundException('User not found');
    return {
      user_id: userId,
      avg_rating: (target as any).avg_rating ?? null,
      total_ratings: (target as any).total_ratings || 0,
    };
  }

  // --- Admin: complaints management ---
  async listComplaints(statusFilter = 'open') {
    const q = statusFilter === 'all' ? {} : { status: statusFilter };
    const rows = await this.complaintModel
      .find(q)
      .sort({ created_at: -1 })
      .limit(200)
      .lean();
    const out: any[] = [];
    for (const c of rows as any[]) {
      const item: any = clean(c);
      const ride = await this.rideModel.findOne({ id: c.ride_id }).lean();
      if (ride) {
        item.ride = {
          id: (ride as any).id,
          type: (ride as any).type,
          fare: (ride as any).fare,
          passenger_name: (ride as any).passenger_name,
          driver_name: (ride as any).driver_name,
          status: (ride as any).status,
        };
      }
      out.push(item);
    }
    return { complaints: out };
  }

  async resolveComplaint(cid: string, req: ResolveComplaintDto, user: any) {
    const res = await this.complaintModel.updateOne(
      { id: cid },
      {
        $set: {
          status: req.status,
          resolution: req.resolution,
          resolved_at: now(),
          resolved_by: user.id,
        },
      },
    );
    if (res.matchedCount === 0) {
      throw new NotFoundException('Complaint not found');
    }
    this.logger.log(
      `Complaint resolved id=${cid} status=${req.status} by=${user.id}`,
    );
    return { ok: true };
  }
}
