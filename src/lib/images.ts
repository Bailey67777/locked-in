/** Resize a picked image into a small "medium" JPEG and a tiny square thumbnail (both data URLs). */

export type ProcessedPhoto = { medium: string; thumb: string };

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      /* fall through */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

function draw(src: ImageBitmap | HTMLImageElement, w: number, h: number, sx: number, sy: number, sw: number, sh: number, quality: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("No canvas");
  g.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function processPhoto(file: File, mediumMax = 720, thumbSize = 96): Promise<ProcessedPhoto> {
  const src = await loadBitmap(file);
  const W = src.width;
  const H = src.height;
  const scale = Math.min(1, mediumMax / Math.max(W, H));
  const mw = Math.max(1, Math.round(W * scale));
  const mh = Math.max(1, Math.round(H * scale));
  const medium = draw(src, mw, mh, 0, 0, W, H, 0.78);
  const side = Math.min(W, H);
  const thumb = draw(src, thumbSize, thumbSize, (W - side) / 2, (H - side) / 2, side, side, 0.7);
  if ("close" in src) src.close();
  return { medium, thumb };
}

/** A banner-sized JPEG (data URL): wide enough to look sharp on a laptop, small enough for the database. */
export async function processBanner(file: File, maxWidth = 1600): Promise<string> {
  const src = await loadBitmap(file);
  const scale = Math.min(1, maxWidth / src.width);
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const out = draw(src, w, h, 0, 0, src.width, src.height, 0.8);
  if ("close" in src) src.close();
  return out;
}
