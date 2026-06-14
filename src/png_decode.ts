// png_decode.ts - PNG decoder for pi-emote Sixel renderer.
// Wing: pi-emote | Topic: image-decode | Updated: 2026-06-14
// Pure TS, zero deps. Uses node:zlib inflate. Outputs RGBA. Supports 8-bit, color types 0/2/3/4/6.
import { inflateSync } from "node:zlib";

export interface DecodedPng {
  width: number;
  height: number;
  rgba: Uint8Array;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function decodePng(buffer: Uint8Array): DecodedPng {
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== PNG_SIG[i]) throw new Error("Invalid PNG signature");
  }
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat: number[] = [];
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;

  while (offset + 8 <= buffer.length) {
    const length = readU32(buffer, offset);
    const type = String.fromCharCode(buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7]);
    const dataStart = offset + 8;
    const data = buffer.subarray(dataStart, dataStart + length);
    offset = dataStart + length + 4;

    if (type === "IHDR") {
      width = readU32(data, 0);
      height = readU32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      trns = data;
    } else if (type === "IDAT") {
      for (let i = 0; i < data.length; i++) idat.push(data[i]);
    } else if (type === "IEND") {
      break;
    }
  }

  if (interlace !== 0) throw new Error("Interlaced PNG not supported");
  if (bitDepth !== 8) throw new Error("Only 8-bit PNG supported, got " + bitDepth);

  const compressed = Uint8Array.from(idat);
  const raw = inflateSync(compressed);

  const channels = channelsFor(colorType);
  const bpp = channels;
  const stride = width * bpp;
  const unfiltered = new Uint8Array(stride * height);
  const prevLine = new Uint8Array(stride);

  let rawPos = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawPos];
    rawPos++;
    const srcLine = raw.subarray(rawPos, rawPos + stride);
    rawPos += stride;
    const dstLine = unfiltered.subarray(y * stride, (y + 1) * stride);
    unfilterLine(filterType, srcLine, prevLine, dstLine, bpp, stride);
    for (let i = 0; i < stride; i++) prevLine[i] = dstLine[i];
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = y * stride + x * bpp;
      const di = (y * width + x) * 4;
      if (colorType === 0) {
        const v = unfiltered[si];
        rgba[di] = v; rgba[di + 1] = v; rgba[di + 2] = v;
        rgba[di + 3] = (trns && trns.length >= 2 && v === trns[1]) ? 0 : 255;
      } else if (colorType === 2) {
        rgba[di] = unfiltered[si];
        rgba[di + 1] = unfiltered[si + 1];
        rgba[di + 2] = unfiltered[si + 2];
        let a = 255;
        if (trns && trns.length >= 6 && unfiltered[si] === trns[1] && unfiltered[si + 1] === trns[3] && unfiltered[si + 2] === trns[5]) a = 0;
        rgba[di + 3] = a;
      } else if (colorType === 3) {
        const pidx = unfiltered[si];
        rgba[di] = palette![pidx * 3];
        rgba[di + 1] = palette![pidx * 3 + 1];
        rgba[di + 2] = palette![pidx * 3 + 2];
        rgba[di + 3] = (trns && pidx < trns.length) ? trns[pidx] : 255;
      } else if (colorType === 4) {
        const v = unfiltered[si];
        rgba[di] = v; rgba[di + 1] = v; rgba[di + 2] = v;
        rgba[di + 3] = unfiltered[si + 1];
      } else if (colorType === 6) {
        rgba[di] = unfiltered[si];
        rgba[di + 1] = unfiltered[si + 1];
        rgba[di + 2] = unfiltered[si + 2];
        rgba[di + 3] = unfiltered[si + 3];
      }
    }
  }

  return { width, height, rgba };
}

function channelsFor(colorType: number): number {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 3) return 1;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error("Unsupported color type " + colorType);
}

function readU32(b: Uint8Array, o: number): number {
  return (b[o] * 0x1000000) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
}

function unfilterLine(type: number, src: Uint8Array, prev: Uint8Array, dst: Uint8Array, bpp: number, stride: number): void {
  if (type === 0) {
    for (let i = 0; i < stride; i++) dst[i] = src[i];
  } else if (type === 1) {
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? dst[i - bpp] : 0;
      dst[i] = (src[i] + left) & 0xff;
    }
  } else if (type === 2) {
    for (let i = 0; i < stride; i++) dst[i] = (src[i] + prev[i]) & 0xff;
  } else if (type === 3) {
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? dst[i - bpp] : 0;
      dst[i] = (src[i] + ((left + prev[i]) >> 1)) & 0xff;
    }
  } else if (type === 4) {
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? dst[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      dst[i] = (src[i] + paeth(left, up, upLeft)) & 0xff;
    }
  } else {
    throw new Error("Unknown filter type " + type);
  }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
