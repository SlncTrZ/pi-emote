// test_sixel.ts - Standalone test: PNG emote -> Sixel sequence.
// Wing: pi-emote | Topic: test | Updated: 2026-06-14
// Chay: npx tsx test_sixel.ts  (hoac pi -p "read test_sixel.ts")
// Output: in ra escape sequence sixel de Anh test tren Windows Terminal.
import { readFileSync } from "node:fs";
import { decodePng } from "./src/png_decode.js";
import { quantizeWu } from "./src/wu_quantizer.js";
import { encodeSixel } from "./src/sixel_packer.js";

const PNG_PATH = "./emotes/default/idle/idle.png";
const MAX_COLORS = 256;

function run() {
  const buf = readFileSync(PNG_PATH);
  console.error("[INFO] PNG size: " + buf.length + " bytes");

  const decoded = decodePng(new Uint8Array(buf));
  console.error("[INFO] Decoded: " + decoded.width + "x" + decoded.height + ", rgba=" + decoded.rgba.length);

  const quant = quantizeWu(decoded.rgba, decoded.width, decoded.height, MAX_COLORS);
  console.error("[INFO] Quantized: palette=" + quant.palette.length + ", transparent=" + quant.transparentIndex);

  const sixel = encodeSixel(quant.indexed, decoded.width, decoded.height, quant.palette, quant.transparentIndex);
  console.error("[INFO] Sixel sequence: " + sixel.length + " chars");

  // In ra sixel sequence len stdout (de WT render)
  process.stdout.write("\n=== SIXEL TEST ===\n");
  process.stdout.write(sixel);
  process.stdout.write("\n=== END ===\n");
}

try {
  run();
} catch (e) {
  console.error("[ERROR] " + (e instanceof Error ? e.stack : String(e)));
  process.exit(1);
}
