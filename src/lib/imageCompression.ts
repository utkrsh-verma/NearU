/**
 * Client-side image compression before upload.
 * Enforces allowed formats, resizes large camera-roll photos to max 960px width,
 * and exports a lightweight WebP/JPEG data URL for fast mobile uploads.
 */

const ALLOWED_INPUT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_RAW_INPUT_BYTES = 12 * 1024 * 1024; // 12MB raw source limit
const TARGET_MAX_DIMENSION = 960;

export async function compressProfilePhoto(file: File): Promise<string> {
  if (!ALLOWED_INPUT_TYPES.has(file.type)) {
    throw new Error('Please select a JPG, PNG, or WebP photo.');
  }
  if (file.size > MAX_RAW_INPUT_BYTES) {
    throw new Error('Photo is too large. Please pick an image under 12 MB.');
  }

  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read the selected image file.'));
      el.src = bitmapUrl;
    });

    const scale = Math.min(
      1,
      TARGET_MAX_DIMENSION / Math.max(img.width || 1, img.height || 1)
    );
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser image processing is unavailable.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Prefer WebP when supported; fall back to JPEG
    let output = canvas.toDataURL('image/webp', 0.82);
    if (!output.startsWith('data:image/webp')) {
      output = canvas.toDataURL('image/jpeg', 0.84);
    }
    return output;
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
