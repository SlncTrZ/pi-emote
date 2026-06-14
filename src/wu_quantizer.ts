// wu_quantizer.ts - Xiaolin Wu color quantizer.
// Wing: pi-emote | Topic: color-quantize | Updated: 2026-06-14
// Pure TS port of Wu's algorithm (Graphics Gems II). Outputs palette + indexed image.
// Transparent source pixels skipped; transparent palette entry appended if any exist.
// Optimized for pixel-art: nearest-color mapping (no dither) keeps edges sharp.

export interface QuantizeResult {
  palette: Array<[number, number, number]>;
  indexed: Uint8Array;
  transparentIndex: number;
}

const SIDE = 32;
const S = SIDE + 1;

interface Cube { r0: number; r1: number; g0: number; g1: number; b0: number; b1: number; }

export function quantizeWu(rgba: Uint8Array, width: number, height: number, maxColors: number): QuantizeResult {
  const nPixels = width * height;
  const idx = (r: number, g: number, b: number) => (r * S + g) * S + b;

  const wt = new Float64Array(S * S * S);
  const mr = new Float64Array(S * S * S);
  const mg = new Float64Array(S * S * S);
  const mb = new Float64Array(S * S * S);
  const m2 = new Float64Array(S * S * S);

  let hasTransparent = false;

  for (let i = 0; i < nPixels; i++) {
    const o = i * 4;
    const a = rgba[o + 3];
    if (a < 8) { hasTransparent = true; continue; }
    const R = (rgba[o] >> 3) + 1;
    const G = (rgba[o + 1] >> 3) + 1;
    const B = (rgba[o + 2] >> 3) + 1;
    const k = idx(R, G, B);
    wt[k] += 1;
    mr[k] += rgba[o];
    mg[k] += rgba[o + 1];
    mb[k] += rgba[o + 2];
    m2[k] += rgba[o] * rgba[o] + rgba[o + 1] * rgba[o + 1] + rgba[o + 2] * rgba[o + 2];
  }

  prefixSum3d(wt, idx);
  prefixSum3d(mr, idx);
  prefixSum3d(mg, idx);
  prefixSum3d(mb, idx);
  prefixSum3d(m2, idx);

  const cubes: Cube[] = [{ r0: 1, r1: SIDE, g0: 1, g1: SIDE, b0: 1, b1: SIDE }];

  while (cubes.length < maxColors) {
    let bestCube = -1;
    let bestCut = -1;
    let bestPos = 0;
    let bestGain = 0;

    for (let ci = 0; ci < cubes.length; ci++) {
      for (let axis = 0; axis < 3; axis++) {
        const result = bestCutOnAxis(cubes[ci], axis, wt, mr, mg, mb, m2, idx);
        if (result && result.gain > bestGain) {
          bestGain = result.gain;
          bestCube = ci;
          bestCut = axis;
          bestPos = result.pos;
        }
      }
    }

    if (bestCube < 0) break;

    const cube = cubes[bestCube];
    const lo = bestCut === 0 ? cube.r0 : bestCut === 1 ? cube.g0 : cube.b0;
    const hi = bestCut === 0 ? cube.r1 : bestCut === 1 ? cube.g1 : cube.b1;
    const c1 = makeSubCube(cube, bestCut, lo, bestPos);
    const c2 = makeSubCube(cube, bestCut, bestPos + 1, hi);
    cubes.splice(bestCube, 1, c1, c2);
  }

  const palette: Array<[number, number, number]> = [];
  const transparentIndex = hasTransparent ? cubes.length : -1;

  for (const cube of cubes) {
    const vol = boxVol(cube, wt, idx);
    if (vol <= 0) {
      palette.push([0, 0, 0]);
      continue;
    }
    palette.push([
      Math.floor(boxVol(cube, mr, idx) / vol),
      Math.floor(boxVol(cube, mg, idx) / vol),
      Math.floor(boxVol(cube, mb, idx) / vol),
    ]);
  }
  if (hasTransparent) palette.push([0, 0, 0]);

  const indexed = new Uint8Array(nPixels);
  for (let i = 0; i < nPixels; i++) {
    const o = i * 4;
    if (rgba[o + 3] < 8) {
      indexed[i] = transparentIndex;
      continue;
    }
    const R = (rgba[o] >> 3) + 1;
    const G = (rgba[o + 1] >> 3) + 1;
    const B = (rgba[o + 2] >> 3) + 1;
    for (let ci = 0; ci < cubes.length; ci++) {
      const c = cubes[ci];
      if (R >= c.r0 && R <= c.r1 && G >= c.g0 && G <= c.g1 && B >= c.b0 && B <= c.b1) {
        indexed[i] = ci;
        break;
      }
    }
  }

  return { palette, indexed, transparentIndex };
}

function prefixSum3d(arr: Float64Array, idx: (r: number, g: number, b: number) => number): void {
  for (let r = 1; r <= SIDE; r++)
    for (let g = 1; g <= SIDE; g++)
      for (let b = 1; b <= SIDE; b++)
        arr[idx(r, g, b)] += arr[idx(r, g, b - 1)];
  for (let r = 1; r <= SIDE; r++)
    for (let g = 1; g <= SIDE; g++)
      for (let b = 1; b <= SIDE; b++)
        arr[idx(r, g, b)] += arr[idx(r, g - 1, b)];
  for (let r = 1; r <= SIDE; r++)
    for (let g = 1; g <= SIDE; g++)
      for (let b = 1; b <= SIDE; b++)
        arr[idx(r, g, b)] += arr[idx(r - 1, g, b)];
}

function boxVol(cube: Cube, arr: Float64Array, idx: (r: number, g: number, b: number) => number): number {
  return arr[idx(cube.r1, cube.g1, cube.b1)]
    - arr[idx(cube.r0 - 1, cube.g1, cube.b1)]
    - arr[idx(cube.r1, cube.g0 - 1, cube.b1)]
    - arr[idx(cube.r1, cube.g1, cube.b0 - 1)]
    + arr[idx(cube.r0 - 1, cube.g0 - 1, cube.b1)]
    + arr[idx(cube.r0 - 1, cube.g1, cube.b0 - 1)]
    + arr[idx(cube.r1, cube.g0 - 1, cube.b0 - 1)]
    - arr[idx(cube.r0 - 1, cube.g0 - 1, cube.b0 - 1)];
}

function bestCutOnAxis(cube: Cube, axis: number, wt: Float64Array, mr: Float64Array, mg: Float64Array, mb: Float64Array, m2: Float64Array, idx: (r: number, g: number, b: number) => number): { pos: number; gain: number } | null {
  const lo = axis === 0 ? cube.r0 : axis === 1 ? cube.g0 : cube.b0;
  const hi = axis === 0 ? cube.r1 : axis === 1 ? cube.g1 : cube.b1;
  if (hi <= lo) return null;

  const totalWt = boxVol(cube, wt, idx);
  if (totalWt <= 0) return null;
  const mrT = boxVol(cube, mr, idx);
  const mgT = boxVol(cube, mg, idx);
  const mbT = boxVol(cube, mb, idx);
  const base = (mrT * mrT + mgT * mgT + mbT * mbT) / totalWt;

  let bestGain = 0;
  let bestPos = lo;

  for (let pos = lo; pos < hi; pos++) {
    const loCube = makeSubCube(cube, axis, lo, pos);
    const hiCube = makeSubCube(cube, axis, pos + 1, hi);
    const wLo = boxVol(loCube, wt, idx);
    const wHi = boxVol(hiCube, wt, idx);
    if (wLo <= 0 || wHi <= 0) continue;

    const mrLo = boxVol(loCube, mr, idx);
    const mgLo = boxVol(loCube, mg, idx);
    const mbLo = boxVol(loCube, mb, idx);
    const mrHi = boxVol(hiCube, mr, idx);
    const mgHi = boxVol(hiCube, mg, idx);
    const mbHi = boxVol(hiCube, mb, idx);

    const gain = (mrLo * mrLo + mgLo * mgLo + mbLo * mbLo) / wLo
               + (mrHi * mrHi + mgHi * mgHi + mbHi * mbHi) / wHi
               - base;

    if (gain > bestGain) {
      bestGain = gain;
      bestPos = pos;
    }
  }

  if (bestGain <= 0) return null;
  return { pos: bestPos, gain: bestGain };
}

function makeSubCube(cube: Cube, axis: number, lo: number, hi: number): Cube {
  return {
    r0: axis === 0 ? lo : cube.r0,
    r1: axis === 0 ? hi : cube.r1,
    g0: axis === 1 ? lo : cube.g0,
    g1: axis === 1 ? hi : cube.g1,
    b0: axis === 2 ? lo : cube.b0,
    b1: axis === 2 ? hi : cube.b1,
  };
}
