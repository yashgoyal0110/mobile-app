/**
 * App constants / env-driven config. Mirrors the Python `app/config.py`.
 *
 * This module is imported very early (app.module.ts pulls MONGO_URL/DB_NAME
 * into MongooseModule.forRoot), before Nest's ConfigModule runs. So we load
 * `.env` right here — exactly like Python's `config.py` calling load_dotenv —
 * to guarantee `process.env` is populated before any value below is read.
 */
import * as dotenv from 'dotenv';
dotenv.config();

function envFloat(key: string, fallback: number): number {
  const v = process.env[key];
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const JWT_SECRET =
  process.env.JWT_SECRET || 'fifthdigit-dev-secret-change-in-prod';
export const JWT_ALG = 'HS256' as const;
export const JWT_EXPIRE_DAYS = 30;

export const ADMIN_PHONES = (process.env.ADMIN_PHONES || '9999999999')
  .split(',')
  .map((p) => p.trim());

export const MOCK_OTP = process.env.MOCK_OTP || '123456';

// Geo provider config - swap to google later by switching this
export const GEO_PROVIDER = process.env.GEO_PROVIDER || 'osm'; // 'osm' or 'google'
export const NOMINATIM_URL =
  process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
export const OSRM_URL =
  process.env.OSRM_URL || 'https://router.project-osrm.org';
export const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY || '';

// Govardhan bounding box: roughly 27.42-27.58 N, 77.40-77.55 E
export const REGION_BBOX = {
  south: envFloat('REGION_SOUTH', 27.4),
  north: envFloat('REGION_NORTH', 27.6),
  west: envFloat('REGION_WEST', 77.38),
  east: envFloat('REGION_EAST', 77.58),
};
export const REGION_CENTER = { lat: 27.4985, lng: 77.4615 };
export const USER_AGENT = 'FifthDigit/1.0 (govardhan-e-rickshaw)';

export const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
export const DB_NAME = process.env.DB_NAME || 'fifthdigit';
export const PORT = Number(process.env.PORT || 3002);
