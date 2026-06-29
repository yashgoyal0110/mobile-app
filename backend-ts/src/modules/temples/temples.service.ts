/** Temple darshan info — timings, aarti, crowd. Mirrors Python `app/routes/temples.py`. */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { clean, haversineKm, newId, now, round } from '../../common/utils';
import { Temple } from '../../db/schemas/temple.schema';
import { StorageService } from '../uploads/storage.service';
import { TempleDto, TempleUpdateDto } from './temples.dto';

@Injectable()
export class TemplesService {
  private readonly logger = new Logger('fifthdigit.temples');

  constructor(
    @InjectModel(Temple.name) private readonly templeModel: Model<Temple>,
    private readonly storage: StorageService,
  ) {}

  private withDistance(t: any, lat?: number, lng?: number): any {
    const out: any = clean(t);
    if (lat != null && lng != null && t.lat != null && t.lng != null) {
      out.distance_km = round(haversineKm(lat, lng, t.lat, t.lng), 2);
    }
    return out;
  }

  // ---------- Public (pilgrim) ----------
  async listTemples(opts: { q?: string; lat?: number; lng?: number }) {
    const query: any = { verified: true };
    if (opts.q) {
      const rx = { $regex: opts.q, $options: 'i' };
      query.$or = [
        { name: rx },
        { area: rx },
        { deity: rx },
        { address: rx },
      ];
    }
    const temples = await this.templeModel.find(query).limit(500).lean();
    const out = (temples as any[]).map((t) =>
      this.withDistance(t, opts.lat, opts.lng),
    );
    if (opts.lat != null && opts.lng != null) {
      out.sort((a, b) => {
        const an = a.distance_km == null ? 1 : 0;
        const bn = b.distance_km == null ? 1 : 0;
        if (an !== bn) return an - bn;
        return (a.distance_km || 0) - (b.distance_km || 0);
      });
    } else {
      out.sort((a, b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')),
      );
      out.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    }
    return { temples: out, count: out.length };
  }

  async getTemple(templeId: string, lat?: number, lng?: number) {
    const t = await this.templeModel
      .findOne({ id: templeId, verified: true })
      .lean();
    if (!t) throw new NotFoundException('Temple not found');
    return this.withDistance(t, lat, lng);
  }

  // ---------- Admin (manage) ----------
  async adminListTemples(verified?: boolean) {
    const query: any = {};
    if (verified != null) query.verified = verified;
    const temples = await this.templeModel
      .find(query)
      .sort({ created_at: -1 })
      .limit(500)
      .lean();
    return { temples: (temples as any[]).map((t) => clean(t)) };
  }

  async adminCreateTemple(req: TempleDto) {
    // Atomicity gate: confirm every photo is really uploaded before we create.
    const photos = await this.storage.verifyImages(req.photos, 'temple', {
      min: 1,
    });
    const ts = now();
    const doc: any = {
      id: newId(),
      name: req.name,
      deity: req.deity ?? null,
      description: req.description ?? null,
      address: req.address,
      area: req.area ?? null,
      lat: req.lat ?? null,
      lng: req.lng ?? null,
      contact_phone: req.contact_phone ?? null,
      darshan_slots: req.darshan_slots ?? [],
      aarti_timings: req.aarti_timings ?? [],
      crowd_level: req.crowd_level ?? null,
      entry_info: req.entry_info ?? null,
      special_note: req.special_note ?? null,
      photos,
      verified: req.verified ?? false,
      featured: req.featured ?? false,
      created_at: ts,
      updated_at: ts,
      crowd_updated_at: req.crowd_level ? ts : null,
    };
    await this.templeModel.create(doc);
    this.logger.log(`Temple created id=${doc.id} name="${doc.name}"`);
    return clean(doc);
  }

  async adminUpdateTemple(templeId: string, req: TempleUpdateDto) {
    const updates: Record<string, any> = { ...req };
    if ('photos' in updates) {
      updates.photos = await this.storage.verifyImages(
        updates.photos,
        'temple',
        { min: 1 },
      );
    }
    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    if ('crowd_level' in updates) {
      updates.crowd_updated_at = updates.crowd_level ? now() : null;
    }
    updates.updated_at = now();
    const res = await this.templeModel.updateOne(
      { id: templeId },
      { $set: updates },
    );
    if (res.matchedCount === 0) throw new NotFoundException('Temple not found');
    const fresh = await this.templeModel.findOne({ id: templeId }).lean();
    this.logger.log(
      `Temple updated id=${templeId} fields=[${Object.keys(updates)
        .filter((k) => k !== 'updated_at')
        .join(',')}]`,
    );
    return clean(fresh);
  }

  async adminDeleteTemple(templeId: string) {
    const res = await this.templeModel.deleteOne({ id: templeId });
    if (res.deletedCount === 0) throw new NotFoundException('Temple not found');
    this.logger.log(`Temple deleted id=${templeId}`);
    return { ok: true };
  }
}
