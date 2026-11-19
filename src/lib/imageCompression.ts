/**
 * Client-side image compression before upload.
 * Enforces allowed formats, resizes large camera-roll photos and exports WebP.
 */

const ALLOWED_INPUT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_RAW_INPUT_BYTES = 12 * 1024 * 1024; // 12MB raw source limit
const TARGET_MAX_DIMENSION = 800;
const TARGET_BYTES = 200 * 1024;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Could not compress this image.')),
    'image/webp', quality
  ));
}

export async function compressProfilePhoto(file: File): Promise<File> {
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

    let output = await canvasToBlob(canvas, 0.82);
    for (const quality of [0.74, 0.66, 0.58, 0.5]) {
      if (output.size <= TARGET_BYTES) break;
      output = await canvasToBlob(canvas, quality);
    }
    if (output.size > TARGET_BYTES) {
      throw new Error('This photo could not be compressed below 200 KB. Please choose a simpler image.');
    }
    return new File([output], 'profile-photo.webp', { type: 'image/webp' });
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
