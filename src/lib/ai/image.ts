/** Accepted photo types (all supported by Gemini image input). */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Inline request payloads must stay small; larger originals are downscaled first. */
const MAX_INLINE_BYTES = 7 * 1024 * 1024;
const MAX_DIMENSION = 1600;

export type ImageCheck = { ok: true } | { ok: false; error: string };

export function checkImageFile(file: File): ImageCheck {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'Choose a JPEG, PNG, WebP or HEIC photo.' };
  }
  if (file.size === 0) return { ok: false, error: 'That file is empty.' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'Choose a photo smaller than 10 MB.' };
  return { ok: true };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The photo could not be read.'));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Downscales to at most 1600 px on the long edge (JPEG) to keep uploads small.
 * Metadata such as GPS EXIF is not carried over by canvas re-encoding.
 * Falls back to the original file if the browser cannot decode it (e.g. HEIC
 * outside Safari), provided it is small enough to send inline.
 */
export async function prepareImageForUpload(file: File): Promise<{ mimeType: string; base64: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('encode-failed');
    return { mimeType: 'image/jpeg', base64: await blobToBase64(blob) };
  } catch {
    if (file.size > MAX_INLINE_BYTES) {
      throw new Error('This photo could not be resized in your browser and is too large to send. Try a JPEG under 7 MB.');
    }
    return { mimeType: file.type, base64: await blobToBase64(file) };
  }
}
