/** Dharamshala / Guest-house stay discovery. Mirrors Python `app/routes/stays.py`. */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { clean, haversineKm, newId, now, round } from '../../common/utils';
import { Stay } from '../../db/schemas/stay.schema';
import { AMENITY_KEYS, StayDto, StayUpdateDto } from './stays.dto';

@Injectable()
export class StaysService {
  private readonly logger = new Logger('fifthdigit.stays');

  constructor(
    @InjectModel(Stay.name) private readonly stayModel: Model<Stay>,
  ) {}

  private withDistance(stay: any, lat?: number, lng?: number): any {
    const out: any = clean(stay);
    if (
      lat != null &&
      lng != null &&
      stay.lat != null &&
      stay.lng != null
    ) {
      out.distance_km = round(haversineKm(lat, lng, stay.lat, stay.lng), 2);
    }
    return out;
  }

  private validateAmenities(amenities?: string[]): string[] | undefined {
    if (amenities == null) return undefined;
    const bad = amenities.filter((a) => !AMENITY_KEYS.has(a));
    if (bad.length) {
      throw new BadRequestException(`Unknown amenities: ${bad.join(', ')}`);
    }
    return amenities;
  }

  // ---------- Public (pilgrim) ----------
  async listStays(opts: {
    type?: string;
    amenity?: string;
    q?: string;
    max_price?: number;
    available_only?: boolean;
    lat?: number;
    lng?: number;
  }) {
    const query: any = { verified: true };
    if (opts.type) query.type = opts.type;
    if (opts.available_only) query.available = true;
    if (opts.amenity) {
      const keys = opts.amenity
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a);
      if (keys.length) query.amenities = { $all: keys };
    }
    if (opts.max_price != null) {
      query.$or = [
        { donation_based: true },
        { price_min: { $lte: opts.max_price } },
      ];
    }
    if (opts.q) {
      const rx = { $regex: opts.q, $options: 'i' };
      (query.$and ||= []).push({
        $or: [{ name: rx }, { area: rx }, { address: rx }],
      });
    }

    const stays = await this.stayModel.find(query).limit(500).lean();
    const out = (stays as any[]).map((s) =>
      this.withDistance(s, opts.lat, opts.lng),
    );
    if (opts.lat != null && opts.lng != null) {
      out.sort((a, b) => {
        const an = a.distance_km == null ? 1 : 0;
        const bn = b.distance_km == null ? 1 : 0;
        if (an !== bn) return an - bn;
        return (a.distance_km || 0) - (b.distance_km || 0);
      });
    } else {
      // featured first, then newest (created_at is an ISO string after clean)
      out.sort((a, b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')),
      );
      out.sort(
        (a, b) => Number(!!b.featured) - Number(!!a.featured),
      );
    }
    return { stays: out, count: out.length };
  }

  async getStay(stayId: string, lat?: number, lng?: number) {
    const stay = await this.stayModel
      .findOne({ id: stayId, verified: true })
      .lean();
    if (!stay) throw new NotFoundException('Stay not found');
    return this.withDistance(stay, lat, lng);
  }

  // ---------- Admin (manage) ----------
  async adminListStays(verified?: boolean) {
    const query: any = {};
    if (verified != null) query.verified = verified;
    const stays = await this.stayModel
      .find(query)
      .sort({ created_at: -1 })
      .limit(500)
      .lean();
    return { stays: (stays as any[]).map((s) => clean(s)) };
  }

  async adminCreateStay(req: StayDto) {
    this.validateAmenities(req.amenities);
    const ts = now();
    const doc: any = {
      id: newId(),
      name: req.name,
      type: req.type ?? 'dharamshala',
      description: req.description ?? null,
      address: req.address,
      area: req.area ?? null,
      lat: req.lat ?? null,
      lng: req.lng ?? null,
      contact_phone: req.contact_phone,
      whatsapp: req.whatsapp || req.contact_phone,
      price_min: req.price_min ?? null,
      price_max: req.price_max ?? null,
      donation_based: req.donation_based ?? false,
      room_types: req.room_types ?? [],
      capacity: req.capacity ?? null,
      amenities: req.amenities ?? [],
      photos: req.photos ?? [],
      verified: req.verified ?? false,
      available: req.available ?? true,
      featured: req.featured ?? false,
      created_at: ts,
      updated_at: ts,
    };
    await this.stayModel.create(doc);
    this.logger.log(`Stay created id=${doc.id} name="${doc.name}"`);
    return clean(doc);
  }

  async adminUpdateStay(stayId: string, req: StayUpdateDto) {
    const updates: Record<string, any> = { ...req };
    if ('amenities' in updates) this.validateAmenities(updates.amenities);
    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    updates.updated_at = now();
    const res = await this.stayModel.updateOne(
      { id: stayId },
      { $set: updates },
    );
    if (res.matchedCount === 0) throw new NotFoundException('Stay not found');
    const fresh = await this.stayModel.findOne({ id: stayId }).lean();
    this.logger.log(
      `Stay updated id=${stayId} fields=[${Object.keys(updates)
        .filter((k) => k !== 'updated_at')
        .join(',')}]`,
    );
    return clean(fresh);
  }

  async adminDeleteStay(stayId: string) {
    const res = await this.stayModel.deleteOne({ id: stayId });
    if (res.deletedCount === 0) throw new NotFoundException('Stay not found');
    this.logger.log(`Stay deleted id=${stayId}`);
    return { ok: true };
  }
}
