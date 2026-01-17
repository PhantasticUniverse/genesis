/**
 * Canvas Recorder
 * Supports GIF and WebM video export
 */

export interface RecorderConfig {
  fps: number;
  quality: number; // 0-1 for video quality
  width: number;
  height: number;
}

const DEFAULT_CONFIG: RecorderConfig = {
  fps: 30,
  quality: 0.8,
  width: 512,
  height: 512,
};

export interface FrameCapture {
  imageData: ImageData;
  timestamp: number;
}

/**
 * Simple frame capturer that stores frames for later processing
 */
export class FrameCapturer {
  private frames: FrameCapture[] = [];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: RecorderConfig;
  private startTime: number = 0;
  private isCapturing: boolean = false;

  constructor(
    sourceCanvas: HTMLCanvasElement,
    config: Partial<RecorderConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create an offscreen canvas for capturing
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.config.width;
    this.canvas.height = this.config.height;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
  }

  start(): void {
    this.frames = [];
    this.startTime = performance.now();
    this.isCapturing = true;
  }

  captureFrame(sourceCanvas: HTMLCanvasElement): void {
    if (!this.isCapturing) return;

    // Draw source canvas to our capture canvas (with scaling)
    this.ctx.drawImage(
      sourceCanvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
      0,
      0,
      this.config.width,
      this.config.height,
    );

    const imageData = this.ctx.getImageData(
      0,
      0,
      this.config.width,
      this.config.height,
    );
    const timestamp = performance.now() - this.startTime;

    this.frames.push({ imageData, timestamp });
  }

  stop(): FrameCapture[] {
    this.isCapturing = false;
    return this.frames;
  }

  getFrameCount(): number {
    return this.frames.length;
  }

  isRecording(): boolean {
    return this.isCapturing;
  }
}

/**
 * Simple GIF encoder (LZW-based)
 * Encodes frames into a GIF file
 */
export class GIFEncoder {
  private width: number;
  private height: number;
  private frames: Uint8Array[] = [];
  private delays: number[] = [];
  private colorTable: Uint8Array | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Add a frame to the GIF
   */
  addFrame(imageData: ImageData, delay: number = 100): void {
    // Quantize colors to 256-color palette
    const { indices, palette } = this.quantize(imageData);

    if (!this.colorTable) {
      this.colorTable = palette;
    }

    this.frames.push(indices);
    this.delays.push(Math.round(delay / 10)); // GIF delay is in 1/100th seconds
  }

  /**
   * Build the GIF and return as Blob
   */
  build(): Blob {
    const chunks: Uint8Array[] = [];

    // GIF Header
    chunks.push(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])); // GIF89a

    // Logical Screen Descriptor
    chunks.push(this.createLogicalScreenDescriptor());

    // Global Color Table
    if (this.colorTable) {
      chunks.push(this.colorTable);
    }

    // Application Extension for looping
    chunks.push(this.createLoopExtension());

    // Add each frame
    for (let i = 0; i < this.frames.length; i++) {
      // Graphics Control Extension
      chunks.push(this.createGraphicsControlExtension(this.delays[i]));

      // Image Descriptor
      chunks.push(this.createImageDescriptor());

      // Image Data (LZW encoded)
      chunks.push(this.encodeFrame(this.frames[i]));
    }

    // GIF Trailer
    chunks.push(new Uint8Array([0x3b]));

    return new Blob(chunks, { type: "image/gif" });
  }

  private createLogicalScreenDescriptor(): Uint8Array {
    const desc = new Uint8Array(7);
    // Width (little-endian)
    desc[0] = this.width & 0xff;
    desc[1] = (this.width >> 8) & 0xff;
    // Height (little-endian)
    desc[2] = this.height & 0xff;
    desc[3] = (this.height >> 8) & 0xff;
    // Packed field: Global Color Table Flag = 1, Color Resolution = 7, Sort = 0, Size = 7
    desc[4] = 0xf7; // 1 111 0 111
    // Background color index
    desc[5] = 0;
    // Pixel aspect ratio
    desc[6] = 0;
    return desc;
  }

  private createLoopExtension(): Uint8Array {
    // NETSCAPE2.0 application extension for infinite loop
    return new Uint8Array([
      0x21,
      0xff,
      0x0b, // Extension introducer
      0x4e,
      0x45,
      0x54,
      0x53,
      0x43,
      0x41,
      0x50,
      0x45, // "NETSCAPE"
      0x32,
      0x2e,
      0x30, // "2.0"
      0x03,
      0x01,
      0x00,
      0x00, // Loop count = 0 (infinite)
      0x00, // Block terminator
    ]);
  }

  private createGraphicsControlExtension(delay: number): Uint8Array {
    return new Uint8Array([
      0x21,
      0xf9,
      0x04, // Extension introducer
      0x00, // Packed: disposal = 0, user input = 0, transparency = 0
      delay & 0xff,
      (delay >> 8) & 0xff, // Delay time
      0x00, // Transparent color index
      0x00, // Block terminator
    ]);
  }

  private createImageDescriptor(): Uint8Array {
    return new Uint8Array([
      0x2c, // Image separator
      0x00,
      0x00, // Left position
      0x00,
      0x00, // Top position
      this.width & 0xff,
      (this.width >> 8) & 0xff, // Width
      this.height & 0xff,
      (this.height >> 8) & 0xff, // Height
      0x00, // Packed: no local color table
    ]);
  }

  /**
   * Quantize 24-bit color to 256-color palette
   */
  private quantize(imageData: ImageData): {
    indices: Uint8Array;
    palette: Uint8Array;
  } {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const pixelCount = width * height;

    // Build color histogram using 5-5-5 RGB quantization
    const colorCounts = new Map<number, number>();
    for (let i = 0; i < pixelCount; i++) {
      const offset = i * 4;
      // Quantize to 5 bits per channel
      const r = data[offset] >> 3;
      const g = data[offset + 1] >> 3;
      const b = data[offset + 2] >> 3;
      const key = (r << 10) | (g << 5) | b;
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }

    // Get top 256 colors
    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 256);

    // Build palette (256 colors * 3 bytes = 768 bytes)
    const palette = new Uint8Array(768);
    const colorMap = new Map<number, number>();

    for (let i = 0; i < sortedColors.length; i++) {
      const [key] = sortedColors[i];
      const r = ((key >> 10) & 0x1f) << 3;
      const g = ((key >> 5) & 0x1f) << 3;
      const b = (key & 0x1f) << 3;
      palette[i * 3] = r;
      palette[i * 3 + 1] = g;
      palette[i * 3 + 2] = b;
      colorMap.set(key, i);
    }

    // Fill remaining palette slots with black
    for (let i = sortedColors.length; i < 256; i++) {
      palette[i * 3] = 0;
      palette[i * 3 + 1] = 0;
      palette[i * 3 + 2] = 0;
    }

    // Map each pixel to palette index
    const indices = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const offset = i * 4;
      const r = data[offset] >> 3;
      const g = data[offset + 1] >> 3;
      const b = data[offset + 2] >> 3;
      const key = (r << 10) | (g << 5) | b;

      if (colorMap.has(key)) {
        indices[i] = colorMap.get(key)!;
      } else {
        // Find nearest color (simple distance)
        let minDist = Infinity;
        let bestIdx = 0;
        for (const [pKey, pIdx] of colorMap) {
          const pr = (pKey >> 10) & 0x1f;
          const pg = (pKey >> 5) & 0x1f;
          const pb = pKey & 0x1f;
          const dist = Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb);
          if (dist < minDist) {
            minDist = dist;
            bestIdx = pIdx;
          }
        }
        indices[i] = bestIdx;
      }
    }

    return { indices, palette };
  }

  /**
   * LZW encode a frame
   */
  private encodeFrame(indices: Uint8Array): Uint8Array {
    const minCodeSize = 8;
    const clearCode = 256;
    const endCode = 257;

    // Initialize code table
    let codeTable = new Map<string, number>();
    for (let i = 0; i < 256; i++) {
      codeTable.set(String(i), i);
    }

    let nextCode = 258;
    let codeSize = minCodeSize + 1;
    const maxCode = (1 << 12) - 1; // Max 12-bit codes

    const output: number[] = [];
    let bitBuffer = 0;
    let bitCount = 0;

    const writeBits = (code: number, bits: number) => {
      bitBuffer |= code << bitCount;
      bitCount += bits;
      while (bitCount >= 8) {
        output.push(bitBuffer & 0xff);
        bitBuffer >>= 8;
        bitCount -= 8;
      }
    };

    // Write clear code
    writeBits(clearCode, codeSize);

    let sequence = String(indices[0]);

    for (let i = 1; i < indices.length; i++) {
      const pixel = String(indices[i]);
      const combined = sequence + "," + pixel;

      if (codeTable.has(combined)) {
        sequence = combined;
      } else {
        // Output code for sequence
        writeBits(codeTable.get(sequence)!, codeSize);

        // Add new sequence to table
        if (nextCode <= maxCode) {
          codeTable.set(combined, nextCode++);
          if (nextCode > 1 << codeSize && codeSize < 12) {
            codeSize++;
          }
        } else {
          // Table full, reset
          writeBits(clearCode, codeSize);
          codeTable = new Map<string, number>();
          for (let j = 0; j < 256; j++) {
            codeTable.set(String(j), j);
          }
          nextCode = 258;
          codeSize = minCodeSize + 1;
        }

        sequence = pixel;
      }
    }

    // Output final sequence
    writeBits(codeTable.get(sequence)!, codeSize);
    writeBits(endCode, codeSize);

    // Flush remaining bits
    if (bitCount > 0) {
      output.push(bitBuffer & 0xff);
    }

    // Pack into sub-blocks (max 255 bytes each)
    const blocks: number[] = [minCodeSize];
    let pos = 0;
    while (pos < output.length) {
      const blockSize = Math.min(255, output.length - pos);
      blocks.push(blockSize);
      for (let i = 0; i < blockSize; i++) {
        blocks.push(output[pos + i]);
      }
      pos += blockSize;
    }
    blocks.push(0); // Block terminator

    return new Uint8Array(blocks);
  }
}

/**
 * High-level recording interface
 */
export interface Recorder {
  start(): void;
  captureFrame(canvas: HTMLCanvasElement): void;
  stop(): void;
  isRecording(): boolean;
  getFrameCount(): number;
  exportGIF(): Promise<Blob>;
  downloadGIF(filename?: string): Promise<void>;
}

export function createRecorder(config: Partial<RecorderConfig> = {}): Recorder {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const capturer = new FrameCapturer(document.createElement("canvas"), cfg);
  let frames: FrameCapture[] = [];

  return {
    start() {
      capturer.start();
    },

    captureFrame(canvas: HTMLCanvasElement) {
      capturer.captureFrame(canvas);
    },

    stop() {
      frames = capturer.stop();
    },

    isRecording() {
      return capturer.isRecording();
    },

    getFrameCount() {
      return capturer.isRecording() ? capturer.getFrameCount() : frames.length;
    },

    async exportGIF(): Promise<Blob> {
      if (frames.length === 0) {
        throw new Error("No frames captured");
      }

      const encoder = new GIFEncoder(cfg.width, cfg.height);

      // Calculate delay based on timestamps
      for (let i = 0; i < frames.length; i++) {
        const delay =
          i < frames.length - 1
            ? frames[i + 1].timestamp - frames[i].timestamp
            : 1000 / cfg.fps;
        encoder.addFrame(frames[i].imageData, delay);
      }

      return encoder.build();
    },

    async downloadGIF(filename = "genesis-recording.gif") {
      const blob = await this.exportGIF();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  };
}

/**
 * Simple screenshot function
 */
export function takeScreenshot(
  canvas: HTMLCanvasElement,
  filename = "genesis-screenshot.png",
): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, "image/png");
}
