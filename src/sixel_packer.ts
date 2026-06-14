// sixel_packer.ts - Sixel DCS encoder for pi-emote.
// Wing: pi-emote | Topic: sixel-encode | Updated: 2026-06-14

const ESC = String.fromCharCode(27);

export function encodeSixel(
  indexed: Uint8Array,
  width: number,
  height: number,
  palette: Array<[number, number, number]>,
  transparentIndex: number,
): string {
  const nColors = palette.length;
  const out: string[] = [];

  out.push(ESC + "P0;1;q");
  out.push('"1;1;' + width + ";" + height);

  for (let i = 0; i < nColors; i++) {
    if (i === transparentIndex) continue;
    const c = palette[i];
    out.push("#" + i + ";2;" + Math.round(c[0] * 100 / 255) + ";" + Math.round(c[1] * 100 / 255) + ";" + Math.round(c[2] * 100 / 255));
  }

  const nBands = Math.ceil(height / 6);

  for (let band = 0; band < nBands; band++) {
    const yStart = band * 6;
    const bandH = Math.min(6, height - yStart);

    for (let ci = 0; ci < nColors; ci++) {
      if (ci === transparentIndex) continue;

      let hasAny = false;
      const chars: number[] = [];
      let prev = -1;
      let run = 0;

      for (let x = 0; x < width; x++) {
        let bits = 0;
        for (let dy = 0; dy < bandH; dy++) {
          if (indexed[(yStart + dy) * width + x] === ci) bits |= (1 << dy);
        }
        const ch = 0x3f + bits;
        if (bits !== 0) hasAny = true;
        if (ch === prev) {
          run++;
        } else {
          if (run > 0) flushRun(chars, prev, run);
          prev = ch;
          run = 1;
        }
      }
      if (run > 0) flushRun(chars, prev, run);

      if (hasAny) {
        out.push("#" + ci);
        let s = "";
        for (let k = 0; k < chars.length; k++) s += String.fromCharCode(chars[k]);
        out.push(s);
        out.push("$");
      }
    }
    out.push("-");
  }

  out.push(ESC + String.fromCharCode(92));
  return out.join("");
}

function flushRun(out: number[], ch: number, count: number): void {
  if (count <= 3) {
    for (let i = 0; i < count; i++) out.push(ch);
  } else {
    out.push(0x21);
    const digits = String(count);
    for (let i = 0; i < digits.length; i++) out.push(digits.charCodeAt(i));
    out.push(ch);
  }
}
