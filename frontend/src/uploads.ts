/**
 * Image upload pipeline (client side).
 *
 * Flow: pick image(s) locally → on submit, ask the backend for signed PUT URLs
 * (`/uploads/sign`) → upload bytes straight to GCS with retry → hand the
 * returned public URLs to the create/update request. The backend verifies every
 * URL exists before persisting, so a resource is never saved with missing
 * images. Uploads happen at submit time so nothing is stored for an abandoned
 * form.
 */
import * as ImagePicker from "expo-image-picker";
import { api } from "./api";

export interface PickedImage {
  uri: string;
  contentType: string;
}

/** A photo slot in a form: either already uploaded (url) or freshly picked (local). */
export interface PhotoItem {
  key: string;
  url?: string;
  local?: PickedImage;
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const EXT_CT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

let keySeq = 0;
export function newPhotoKey(): string {
  keySeq += 1;
  return `p_${Date.now()}_${keySeq}`;
}

function normalizeContentType(asset: ImagePicker.ImagePickerAsset): string {
  let ct = (asset.mimeType || "").toLowerCase();
  if (ct === "image/jpg") ct = "image/jpeg";
  if (!ALLOWED.includes(ct)) {
    const ext = (asset.uri.split("?")[0].split(".").pop() || "").toLowerCase();
    ct = EXT_CT[ext] || "";
  }
  return ct;
}

export async function pickImages(max = 1): Promise<PickedImage[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error("Photo library permission is required to add images.");
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsMultipleSelection: max > 1,
    selectionLimit: max,
    quality: 0.7,
  });
  if (res.canceled) return [];
  const picked = res.assets
    .map((a) => ({ uri: a.uri, contentType: normalizeContentType(a) }))
    .filter((p) => !!p.contentType);
  if (picked.length < res.assets.length) {
    throw new Error("Some images were an unsupported format (use JPG, PNG or WEBP).");
  }
  return picked;
}

/** Take a photo with the camera (handy for KYC docs). */
export async function captureImage(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error("Camera permission is required.");
  }
  const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
  if (res.canceled) return null;
  const a = res.assets[0];
  const ct = normalizeContentType(a);
  if (!ct) throw new Error("Unsupported image format (use JPG, PNG or WEBP).");
  return { uri: a.uri, contentType: ct };
}

async function putWithRetry(
  uploadUrl: string,
  headers: Record<string, string>,
  blob: Blob,
  attempts = 3,
): Promise<void> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(uploadUrl, { method: "PUT", headers, body: blob });
      if (r.ok) return;
      lastErr = new Error(`Upload failed (HTTP ${r.status})`);
    } catch (e) {
      lastErr = e;
    }
    if (i < attempts - 1) await new Promise((res) => setTimeout(res, 400 * (i + 1)));
  }
  throw lastErr || new Error("Upload failed");
}

/** Upload picked images to GCS (parallel) and return their public URLs in order. */
export async function uploadImages(
  purpose: "stay" | "temple" | "driver_kyc" | "driver_profile",
  images: PickedImage[],
): Promise<string[]> {
  if (images.length === 0) return [];
  const { uploads } = await api<{ uploads: any[] }>("/uploads/sign", {
    method: "POST",
    body: { purpose, files: images.map((i) => ({ contentType: i.contentType })) },
    retries: 2,
  });
  if (!uploads || uploads.length !== images.length) {
    throw new Error("Could not prepare image upload. Please retry.");
  }
  await Promise.all(
    images.map(async (img, idx) => {
      const u = uploads[idx];
      const resp = await fetch(img.uri);
      const blob = await resp.blob();
      await putWithRetry(u.uploadUrl, u.headers, blob);
    }),
  );
  return uploads.map((u) => u.publicUrl);
}

/**
 * Resolve a form's photo list to final URLs: keeps already-uploaded ones and
 * uploads any freshly-picked images. Order is preserved. Throws if `min` isn't
 * met so the caller can abort the save before hitting the API.
 */
export async function resolvePhotos(
  items: PhotoItem[],
  purpose: "stay" | "temple" | "driver_kyc" | "driver_profile",
  min = 0,
): Promise<string[]> {
  if (items.length < min) {
    throw new Error(`Please add at least ${min} image${min === 1 ? "" : "s"}.`);
  }
  const pending = items.filter((i) => i.local).map((i) => i.local!);
  const uploaded = await uploadImages(purpose, pending);
  const out: string[] = [];
  let k = 0;
  for (const it of items) {
    if (it.url) out.push(it.url);
    else out.push(uploaded[k++]);
  }
  return out;
}

/** Build initial PhotoItems from already-stored URLs (edit mode). */
export function photoItemsFromUrls(urls?: string[]): PhotoItem[] {
  return (urls || []).map((url) => ({ key: newPhotoKey(), url }));
}
