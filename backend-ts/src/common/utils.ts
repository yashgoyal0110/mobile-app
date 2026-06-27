/**
 * Common utilities. Mirrors the Python `app/utils.py` plus the haversine
 * helper that lived in `app/realtime.py`.
 */
import { v4 as uuidv4 } from 'uuid';

export function now(): Date {
  return new Date();
}

export function iso(dt: Date | string | null | undefined): string | null {
  if (!dt) return null;
  if (dt instanceof Date) return dt.toISOString();
  // Already a string (e.g. read back from a lean query that kept it a string)
  return dt;
}

export function newId(): string {
  return uuidv4();
}

export function genPin(): string {
  return Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
}

/**
 * Remove Mongo internals (`_id`, `__v`) and stringify Date values to ISO.
 * Mirrors Python `clean()`. Operates on a plain object (use `.lean()` results
 * or `doc.toObject()`), returns a shallow-cleaned copy. Recurses into nested
 * objects/arrays so embedded Date values (e.g. inside audit_log) also serialize.
 */
export function clean<T = any>(doc: any): T {
  if (doc == null) return doc;
  return cleanValue(doc, true) as T;
}

function cleanValue(value: any, isRoot = false): any {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((v) => cleanValue(v));
  }
  if (value && typeof value === 'object') {
    // Skip non-plain objects we don't want to traverse (e.g. ObjectId) —
    // they only legitimately appear as `_id`, which we drop anyway.
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '_id' || k === '__v') continue;
      out[k] = cleanValue(v);
    }
    return out;
  }
  return value;
}

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371.0;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLng - aLng);
  const la1 = toRad(aLat);
  const la2 = toRad(bLat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Round to n decimal places (matches Python round() for our use). */
export function round(value: number, digits = 2): number {
  const f = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Mask a phone number for logs (PII): keep last 4 digits, e.g. ******1234. */
export function maskPhone(phone?: string | null): string {
  if (!phone) return 'unknown';
  const s = String(phone);
  if (s.length <= 4) return s;
  return '*'.repeat(s.length - 4) + s.slice(-4);
}
