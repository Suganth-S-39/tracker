// Profile photos are resized and re-encoded in the browser before upload: a small square
// (stored inline on the profile, see the calendar_and_profile_photo migration). Re-encoding
// through a canvas also drops photo metadata such as GPS location.

/** Pixels per side. Shown at most 64 CSS px wide, so this stays sharp on 3x screens. */
export const AVATAR_SIZE = 256;

/** Matches the database check (profiles.avatar_data_url, char_length <= 70000). */
export const AVATAR_MAX_LENGTH = 70_000;

/** WebP first (smallest); Safari can't encode it and falls back to JPEG. */
const ENCODINGS = [
  ['image/webp', 0.85],
  ['image/webp', 0.7],
  ['image/jpeg', 0.85],
  ['image/jpeg', 0.7],
  ['image/jpeg', 0.55],
] as const;

/**
 * A center-cropped square photo as a data URL, small enough for the profile. Throws
 * 'avatar_unreadable' when the browser can't decode the file, 'avatar_too_large' if even the
 * smallest encoding doesn't fit (both mapped in strings.errors.byCode).
 */
export async function avatarFromFile(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('avatar_unreadable');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext('2d');
  if (!context || side === 0) {
    bitmap.close();
    throw new Error('avatar_unreadable');
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();

  for (const [type, quality] of ENCODINGS) {
    const url = canvas.toDataURL(type, quality);
    if (url.startsWith(`data:${type};base64,`) && url.length <= AVATAR_MAX_LENGTH) return url;
  }
  throw new Error('avatar_too_large');
}
