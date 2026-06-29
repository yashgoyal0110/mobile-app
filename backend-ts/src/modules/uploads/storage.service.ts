/**
 * Google Cloud Storage wrapper for image uploads.
 *
 * Flow (keeps the backend off the upload hot-path):
 *   1. Client asks for a signed PUT URL (`signUpload`) — one per image.
 *   2. Client uploads bytes directly to GCS (client retries on failure).
 *   3. Client submits the create request with the returned public URLs.
 *   4. The resource service calls `verifyImages(...)` BEFORE persisting — it
 *      confirms every object actually exists, is an image, and is within the
 *      size cap. If any check fails the create is rejected, so a resource is
 *      never stored with missing/broken images.
 *
 * Verification is fast (parallel HEADs) and resilient (short, bounded retries
 * on transient errors). When no bucket is configured the service is "disabled":
 * existence checks are skipped so local dev / tests still work, but the caller's
 * minimum-count requirement is still enforced.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Storage, type Bucket } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import {
  ALLOWED_IMAGE_TYPES,
  GCS_BUCKET,
  GCS_CREDENTIALS_JSON,
  GCS_MAKE_PUBLIC,
  GCS_MAX_IMAGE_MB,
  GCS_PROJECT_ID,
  GCS_PUBLIC_BASE_URL,
  GCS_SIGNED_READ_TTL_SEC,
  GCS_SIGNED_UPLOAD_TTL_SEC,
} from '../../config/constants';

export type UploadPurpose =
  | 'stay'
  | 'temple'
  | 'driver_kyc'
  | 'driver_profile';

/** Purposes whose objects should be world-readable (shown in the app). */
const PUBLIC_PURPOSES = new Set<UploadPurpose>([
  'stay',
  'temple',
  'driver_profile',
]);

export interface SignedUpload {
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger('fifthdigit.storage');
  private storage?: Storage;
  private bucket?: Bucket;
  private warnedDisabled = false;

  constructor() {
    if (!GCS_BUCKET) {
      this.logger.warn(
        'GCS_BUCKET not set — image storage disabled (existence checks skipped).',
      );
      return;
    }
    try {
      const opts: Record<string, any> = {};
      if (GCS_PROJECT_ID) opts.projectId = GCS_PROJECT_ID;
      if (GCS_CREDENTIALS_JSON) {
        opts.credentials = JSON.parse(GCS_CREDENTIALS_JSON);
        if (!opts.projectId && opts.credentials.project_id) {
          opts.projectId = opts.credentials.project_id;
        }
      }
      this.storage = new Storage(opts);
      this.bucket = this.storage.bucket(GCS_BUCKET);
      this.logger.log(`GCS image storage enabled (bucket=${GCS_BUCKET}).`);
    } catch (e: any) {
      this.logger.error(`Failed to init GCS storage: ${e?.message || e}`);
    }
  }

  get enabled(): boolean {
    return !!this.bucket;
  }

  // ---------- public URL helpers ----------
  publicUrl(objectKey: string): string {
    if (GCS_PUBLIC_BASE_URL) return `${GCS_PUBLIC_BASE_URL}/${objectKey}`;
    return `https://storage.googleapis.com/${GCS_BUCKET}/${objectKey}`;
  }

  /**
   * Resolve a stored value (full URL or bare key) to its object key, or null if
   * it does not belong to our bucket (i.e. an external/unknown URL).
   */
  keyFromValue(value: string): string | null {
    const v = (value || '').trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) return v.replace(/^\/+/, ''); // bare key
    const candidates = [
      GCS_PUBLIC_BASE_URL ? `${GCS_PUBLIC_BASE_URL}/` : '',
      `https://storage.googleapis.com/${GCS_BUCKET}/`,
      `https://${GCS_BUCKET}.storage.googleapis.com/`,
    ].filter(Boolean);
    for (const base of candidates) {
      if (v.startsWith(base)) {
        return decodeURIComponent(v.slice(base.length).split('?')[0]);
      }
    }
    return null;
  }

  // ---------- signing ----------
  signUpload(purpose: UploadPurpose, contentType: string): Promise<SignedUpload> {
    this.assertEnabled();
    const ext = ALLOWED_IMAGE_TYPES[contentType.toLowerCase()];
    if (!ext) {
      throw new BadRequestException(
        `Unsupported image type "${contentType}". Allowed: ${Object.keys(
          ALLOWED_IMAGE_TYPES,
        ).join(', ')}`,
      );
    }
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const objectKey = `${purpose}/${yyyy}/${mm}/${uuidv4()}.${ext}`;
    const expiresMs = Date.now() + GCS_SIGNED_UPLOAD_TTL_SEC * 1000;

    return this.retry(async () => {
      const [uploadUrl] = await this.bucket!.file(objectKey).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: expiresMs,
        contentType,
      });
      return {
        objectKey,
        uploadUrl,
        publicUrl: this.publicUrl(objectKey),
        method: 'PUT' as const,
        headers: { 'Content-Type': contentType },
        expiresAt: new Date(expiresMs).toISOString(),
      };
    });
  }

  /** Short-lived signed GET URL — used to view private objects (e.g. KYC docs). */
  signRead(value: string): Promise<string> {
    this.assertEnabled();
    const key = this.keyFromValue(value);
    if (!key) throw new BadRequestException('Not a storage object');
    const expiresMs = Date.now() + GCS_SIGNED_READ_TTL_SEC * 1000;
    return this.retry(async () => {
      const [url] = await this.bucket!.file(key).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresMs,
      });
      return url;
    });
  }

  // ---------- verification (the atomicity gate) ----------
  /**
   * Verify every supplied image exists in the bucket and is a valid image.
   * Returns the normalised public URLs to store. Throws BadRequest if the
   * minimum count isn't met or any object is missing/invalid — so the caller
   * can abort the create and never persist a half-uploaded resource.
   */
  async verifyImages(
    values: string[] | undefined,
    purpose: UploadPurpose,
    opts: { min?: number } = {},
  ): Promise<string[]> {
    const list = (values || []).map((v) => (v || '').trim()).filter(Boolean);
    const min = opts.min ?? 0;
    if (list.length < min) {
      throw new BadRequestException(
        `At least ${min} image${min === 1 ? '' : 's'} required`,
      );
    }

    if (!this.enabled) {
      if (!this.warnedDisabled) {
        this.warnedDisabled = true;
        this.logger.warn(
          'Storage disabled — skipping image existence checks (dev mode).',
        );
      }
      return list;
    }

    const maxBytes = GCS_MAX_IMAGE_MB * 1024 * 1024;
    const normalized = await Promise.all(
      list.map(async (value) => {
        const key = this.keyFromValue(value);
        if (!key) {
          throw new BadRequestException(
            `Image must be uploaded through the app before saving: ${value}`,
          );
        }
        const meta = await this.statObject(key);
        if (!meta.exists) {
          throw new BadRequestException(`Uploaded image not found: ${key}`);
        }
        if (meta.contentType && !meta.contentType.startsWith('image/')) {
          throw new BadRequestException(`Not an image: ${key}`);
        }
        if (meta.size != null && meta.size > maxBytes) {
          throw new BadRequestException(
            `Image too large (max ${GCS_MAX_IMAGE_MB} MB): ${key}`,
          );
        }
        if (GCS_MAKE_PUBLIC && PUBLIC_PURPOSES.has(purpose)) {
          await this.tryMakePublic(key);
        }
        return this.publicUrl(key);
      }),
    );
    return normalized;
  }

  /** Verify a single required image and return its normalised URL. */
  async verifyOne(value: string, purpose: UploadPurpose): Promise<string> {
    const [out] = await this.verifyImages([value], purpose, { min: 1 });
    return out;
  }

  /** Best-effort delete (e.g. cleaning up replaced photos). Never throws. */
  async deleteByValue(value: string): Promise<void> {
    if (!this.enabled) return;
    const key = this.keyFromValue(value);
    if (!key) return;
    try {
      await this.bucket!.file(key).delete({ ignoreNotFound: true });
    } catch (e: any) {
      this.logger.warn(`Failed to delete ${key}: ${e?.message || e}`);
    }
  }

  /**
   * Delete objects that were in `oldValues` but are no longer in `keepValues`
   * (i.e. images removed/replaced during an edit). Best-effort; never throws.
   * Call AFTER the DB update succeeds.
   */
  async deleteRemoved(oldValues: string[] = [], keepValues: string[] = []): Promise<void> {
    if (!this.enabled) return;
    const keep = new Set(
      keepValues.map((v) => this.keyFromValue(v)).filter(Boolean) as string[],
    );
    const removed = (oldValues || []).filter((v) => {
      const k = this.keyFromValue(v);
      return k && !keep.has(k);
    });
    await Promise.all(removed.map((v) => this.deleteByValue(v)));
  }

  // ---------- internals ----------
  private async statObject(
    key: string,
  ): Promise<{ exists: boolean; size?: number; contentType?: string }> {
    return this.retry(
      async () => {
        try {
          const [md] = await this.bucket!.file(key).getMetadata();
          return {
            exists: true,
            size: md.size != null ? Number(md.size) : undefined,
            contentType: md.contentType,
          };
        } catch (e: any) {
          if (e?.code === 404) return { exists: false };
          throw e; // transient → retried
        }
      },
      3,
      150,
    );
  }

  private async tryMakePublic(key: string): Promise<void> {
    try {
      await this.bucket!.file(key).makePublic();
    } catch (e: any) {
      // Uniform bucket-level access buckets reject object ACLs (400/412); that's
      // fine — public read is granted at the bucket level instead.
      this.logger.debug(`makePublic skipped for ${key}: ${e?.message || e}`);
    }
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new BadRequestException(
        'Image storage is not configured on the server',
      );
    }
  }

  private async retry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 150): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e: any) {
        lastErr = e;
        // Don't waste retries on deterministic client errors.
        if (e instanceof BadRequestException) throw e;
        if (i < attempts - 1) {
          await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
        }
      }
    }
    this.logger.error(`GCS operation failed after ${attempts} attempts: ${lastErr?.message || lastErr}`);
    throw new BadRequestException('Image storage temporarily unavailable, please retry');
  }
}
