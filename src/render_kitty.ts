import { encodeKitty, allocateImageId, deleteKittyImage } from "@earendil-works/pi-tui";
import { BaseImageRenderer } from "./render_image.js";
import type { ImageDims } from "./render_image.js";

/**
 * Kitty graphics protocol renderer.
 * Supports image IDs for in-place replacement and explicit cleanup.
 */
export class KittyRenderer extends BaseImageRenderer {
  readonly imageId: number;
  protected cursorAdvances = false;

  constructor(size: number) {
    super(size);
    this.imageId = allocateImageId();
  }

  protected encode(base64: string, _dims: ImageDims, _rows: number): string | null {
    return encodeKitty(base64, {
      columns: this.size + 1,
      imageId: this.imageId,
      moveCursor: false,
    });
  }

  dispose() {
    process.stdout.write(deleteKittyImage(this.imageId));
    this.currentFrame = null;
  }
}
