/**
 * Client-side photo preparation for AI analysis.
 *
 * Phone cameras produce 3–12MB images; vision providers cap inline image
 * payloads (Groq rejects base64 over ~4MB, and every provider gets slower
 * and less accurate with needlessly huge inputs). Downscaling to ~1280px
 * JPEG before upload keeps the payload in the hundreds of kilobytes with
 * no measurable loss for food recognition — and makes uploads fast on
 * mobile data, where most food photos are taken.
 */

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;
// Under this size AND already small enough dimensions, re-encoding buys
// nothing — send the original bytes.
const SKIP_BYTES = 900 * 1024;

async function decodeToBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> decode (some formats/browsers)
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode image')); };
    img.src = url;
  });
}

/**
 * Returns a File ready for upload: JPEG, longest side <= maxDimension.
 * If the browser can't decode the format (e.g. HEIC on some browsers),
 * the original file is returned unchanged — the server still enforces
 * its own size limit, so this is best-effort, never a hard gate.
 */
export async function prepareFoodImage(file, { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = {}) {
  let source;
  try {
    source = await decodeToBitmap(file);
  } catch {
    return file;
  }

  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  if (!width || !height) return file;

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  if (scale === 1 && file.size <= SKIP_BYTES) {
    if (source.close) source.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (source.close) source.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return file;

  const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}
