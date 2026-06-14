// render_sixel.ts - Sixel protocol renderer for pi-emote.
// Wing: pi-emote | Topic: sixel-render | Updated: 2026-06-14
// Extends BaseImageRenderer. Pipeline: decode PNG -> nearest downscale -> Wu quantize (no dither) -> Sixel DCS.
// Optimized for pixel-art: nearest-color mapping keeps edges sharp. cursorAdvances=true -> iTerm layout path.
import { BaseImageRenderer } from "./render_image.js";
import type { ImageDims } from "./render_image.js";
import { getCellDimensions } from "@earendil-works/pi-tui";
import { decodePng } from "./png_decode.js";
import { quantizeWu } from "./wu_quantizer.js";
import { encodeSixel } from "./sixel_packer.js";

export class SixelRenderer extends BaseImageRenderer {
  protected cursorAdvances = true;

  protected encode(base64: string, _dims: ImageDims, _rows: number, yOffset: number): string | null {
    try {
      const pngBuffer = Buffer.from(base64, "base64");
      const decoded = decodePng(new Uint8Array(pngBuffer));
      const { width: srcW, height: srcH, rgba } = decoded;

      const cellDims = getCellDimensions();
      const targetW = Math.max(1, Math.round(this.size * cellDims.widthPx));
      const targetH = Math.max(1, Math.round(srcH * (targetW / srcW)));

      const scaled = nearestDownscale(rgba, srcW, srcH, targetW, targetH);
      const quant = quantizeWu(scaled, targetW, targetH, 256);

      let finalIndexed = quant.indexed;
      let finalH = targetH;
      if (yOffset > 0) {
        const padded = new Uint8Array(targetW * (yOffset + targetH));
        const tIdx = quant.transparentIndex >= 0 ? quant.transparentIndex : 0;
        for (let i = 0; i < targetW * yOffset; i++) padded[i] = tIdx;
        padded.set(quant.indexed, targetW * yOffset);
        finalIndexed = padded;
        finalH = yOffset + targetH;
      }

      return encodeSixel(finalIndexed, targetW, finalH, quant.palette, quant.transparentIndex);
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.currentFrame = null;
  }
}

function nearestDownscale(src: Uint8Array, srcW: number, srcH: number, dstW: number, dstH: number): Uint8Array {
  const dst = new Uint8Array(dstW * dstH * 4);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor(y * srcH / dstH));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor(x * srcW / dstW));
      const si = (sy * srcW + sx) * 4;
      const di = (y * dstW + x) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }
  return dst;
}
