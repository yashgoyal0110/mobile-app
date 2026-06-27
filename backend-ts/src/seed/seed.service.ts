/**
 * Seed + index bootstrap. Mirrors Python `ensure_seed` / `ensure_indexes`,
 * run from FastAPI's lifespan. Here it runs once on application bootstrap.
 */
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ADMIN_PHONES } from '../config/constants';
import { newId, now } from '../common/utils';
import { FareConfig } from '../db/schemas/fare-config.schema';
import { User } from '../db/schemas/user.schema';
import { Stay } from '../db/schemas/stay.schema';
import { Temple } from '../db/schemas/temple.schema';
import { Driver } from '../db/schemas/driver.schema';
import { Ride } from '../db/schemas/ride.schema';
import { Complaint } from '../db/schemas/complaint.schema';
import {
  DEFAULT_FARE_CONFIG,
  GOVARDHAN_LANDMARKS,
  SAMPLE_STAYS,
  SAMPLE_TEMPLES,
} from './seed-data';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger('fifthdigit');

  constructor(
    @InjectModel(FareConfig.name)
    private readonly fareConfigModel: Model<FareConfig>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Stay.name) private readonly stayModel: Model<Stay>,
    @InjectModel(Temple.name) private readonly templeModel: Model<Temple>,
    @InjectModel(Driver.name) private readonly driverModel: Model<Driver>,
    @InjectModel(Ride.name) private readonly rideModel: Model<Ride>,
    @InjectModel(Complaint.name)
    private readonly complaintModel: Model<Complaint>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Running startup seed + index checks...');
    await this.ensureSeed();
    await this.ensureIndexes();
    this.logger.log('Seed + indexes ready');
  }

  async ensureSeed(): Promise<void> {
    const cfg = await this.fareConfigModel.findOne({ id: 'default' }).lean();
    const defaultCfg: Record<string, any> = { ...DEFAULT_FARE_CONFIG };
    if (!cfg) {
      defaultCfg.id = 'default';
      defaultCfg.landmarks = GOVARDHAN_LANDMARKS;
      defaultCfg.updated_at = now();
      await this.fareConfigModel.create(defaultCfg);
    } else {
      // Backfill any newly-introduced fields without overwriting customised ones
      const missing: Record<string, any> = {};
      for (const [k, v] of Object.entries(defaultCfg)) {
        if (!(k in cfg)) missing[k] = v;
      }
      if (Object.keys(missing).length) {
        await this.fareConfigModel.updateOne(
          { id: 'default' },
          { $set: missing },
        );
      }
    }

    for (const raw of ADMIN_PHONES) {
      const phone = raw.trim();
      const existing = await this.userModel.findOne({ phone }).lean();
      if (!existing) {
        await this.userModel.create({
          id: newId(),
          phone,
          name: 'FifthDigit Admin',
          role: 'admin',
          created_at: now(),
        });
      }
    }

    // Seed sample stays once (Stays tab never empty in a demo).
    for (const stay of SAMPLE_STAYS) {
      const existing = await this.stayModel.findOne({ id: stay.id }).lean();
      if (!existing) {
        await this.stayModel.create({
          ...stay,
          created_at: now(),
          updated_at: now(),
        });
      }
    }

    // Seed sample temples once (Temples tab never empty in a demo).
    for (const temple of SAMPLE_TEMPLES) {
      const existing = await this.templeModel
        .findOne({ id: temple.id })
        .lean();
      if (!existing) {
        await this.templeModel.create({
          ...temple,
          created_at: now(),
          updated_at: now(),
          crowd_updated_at: temple.crowd_level ? now() : null,
        });
      }
    }
  }

  /**
   * Idempotent index creation. Safe to call on every startup.
   *
   * Resilient by design: if an index with the same name already exists with a
   * different spec — e.g. one created by the old Python backend without the same
   * `unique`/options — Mongo raises IndexKeySpecsConflict / IndexOptionsConflict
   * (code 85/86/68). We log a warning and carry on rather than crash the whole
   * app; the existing index still serves queries. Real failures still surface.
   */
  async ensureIndexes(): Promise<void> {
    const M = (m: Model<any>) => m.collection;

    const plan: Array<{
      col: any;
      keys: Record<string, 1 | -1>;
      options?: Record<string, any>;
    }> = [
      { col: M(this.userModel), keys: { id: 1 }, options: { unique: true } },
      { col: M(this.userModel), keys: { phone: 1 } },
      {
        col: M(this.driverModel),
        keys: { user_id: 1 },
        options: { unique: true },
      },
      { col: M(this.driverModel), keys: { online: 1, kyc_status: 1 } },
      { col: M(this.rideModel), keys: { id: 1 }, options: { unique: true } },
      { col: M(this.rideModel), keys: { passenger_id: 1 } },
      { col: M(this.rideModel), keys: { driver_id: 1 } },
      { col: M(this.rideModel), keys: { status: 1, created_at: -1 } },
      { col: M(this.stayModel), keys: { id: 1 }, options: { unique: true } },
      { col: M(this.stayModel), keys: { verified: 1, type: 1 } },
      { col: M(this.stayModel), keys: { area: 1 } },
      { col: M(this.templeModel), keys: { id: 1 }, options: { unique: true } },
      { col: M(this.templeModel), keys: { verified: 1, featured: -1 } },
      { col: M(this.templeModel), keys: { area: 1 } },
      { col: M(this.complaintModel), keys: { status: 1, created_at: -1 } },
    ];

    // Index option/spec conflicts (existing index w/ same name, different spec).
    const CONFLICT_CODES = new Set([85, 86, 68]);
    let created = 0;
    let skipped = 0;
    for (const { col, keys, options } of plan) {
      try {
        await col.createIndex(keys, options);
        created++;
      } catch (e: any) {
        if (CONFLICT_CODES.has(e?.code)) {
          skipped++;
          this.logger.warn(
            `Index ${col.collectionName} ${JSON.stringify(keys)} already ` +
              `exists with a different spec — keeping the existing one (${e.codeName}).`,
          );
        } else {
          throw e;
        }
      }
    }
    this.logger.log(`Indexes ensured (created/ok=${created}, skipped=${skipped})`);
  }
}
