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
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { api } from "./api";

// Downscale anything wider than this before upload (keeps uploads fast/small).
const MAX_WIDTH = 1600;

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

let keySeq = 0;
export function newPhotoKey(): string {
  keySeq += 1;
  return `p_${Date.now()}_${keySeq}`;
}

/**
 * Normalise + downscale a picked asset: resize to <= MAX_WIDTH and re-encode as
 * JPEG (~0.7 quality). Output is always image/jpeg, so uploads stay small and
 * the content-type is always accepted by the backend.
 */
async function processImage(asset: ImagePicker.ImagePickerAsset): Promise<PickedImage> {
  const actions =
    asset.width && asset.width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [];
  const out = await manipulateAsync(asset.uri, actions, {
    compress: 0.7,
    format: SaveFormat.JPEG,
  });
  return { uri: out.uri, contentType: "image/jpeg" };
}

/**
 * Pick one image from the library with the built-in editor enabled, so the user
 * can crop / rotate / zoom (adjust) before upload. Returns a single, downscaled
 * image. (Editing requires single selection, so photos are added one at a time.)
 */
export async function pickImages(_max = 1): Promise<PickedImage[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error("Photo library permission is required to add images.");
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: true,
    quality: 1, // re-compressed in processImage
  });
  if (res.canceled) return [];
  return [await processImage(res.assets[0])];
}

/** Take a photo with the camera (with editor), handy for KYC docs. */
export async function captureImage(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error("Camera permission is required.");
  }
  const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1 });
  if (res.canceled) return null;
  return processImage(res.assets[0]);
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
