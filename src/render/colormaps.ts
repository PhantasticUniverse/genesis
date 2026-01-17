/**
 * Colormaps for CA Visualization
 * Scientific and artistic color schemes for rendering cellular automata
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export type ColormapFunction = (value: number) => RGB;

export interface Colormap {
  name: string;
  fn: ColormapFunction;
}

/**
 * Linear interpolation between two colors
 */
function lerp(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/**
 * Create a colormap from a list of color stops
 */
function createGradientColormap(stops: RGB[]): ColormapFunction {
  return (value: number) => {
    const v = Math.max(0, Math.min(1, value));
    const n = stops.length - 1;
    const idx = v * n;
    const i = Math.floor(idx);
    const t = idx - i;

    if (i >= n) return stops[n];
    return lerp(stops[i], stops[i + 1], t);
  };
}

// Classic grayscale
export const grayscale: ColormapFunction = (value: number) => {
  const v = Math.round(Math.max(0, Math.min(1, value)) * 255);
  return { r: v, g: v, b: v };
};

// Classic green on black (Game of Life style)
export const classic: ColormapFunction = (value: number) => {
  const v = Math.max(0, Math.min(1, value));
  return {
    r: Math.round(v * 100),
    g: Math.round(v * 255),
    b: Math.round(v * 100),
  };
};

// Viridis - perceptually uniform, colorblind-friendly
const viridisStops: RGB[] = [
  { r: 68, g: 1, b: 84 },
  { r: 72, g: 40, b: 120 },
  { r: 62, g: 74, b: 137 },
  { r: 49, g: 104, b: 142 },
  { r: 38, g: 130, b: 142 },
  { r: 31, g: 158, b: 137 },
  { r: 53, g: 183, b: 121 },
  { r: 109, g: 205, b: 89 },
  { r: 180, g: 222, b: 44 },
  { r: 253, g: 231, b: 37 },
];
export const viridis = createGradientColormap(viridisStops);

// Plasma - perceptually uniform, warm colors
const plasmaStops: RGB[] = [
  { r: 13, g: 8, b: 135 },
  { r: 75, g: 3, b: 161 },
  { r: 125, g: 3, b: 168 },
  { r: 168, g: 34, b: 150 },
  { r: 203, g: 70, b: 121 },
  { r: 229, g: 107, b: 93 },
  { r: 248, g: 148, b: 65 },
  { r: 253, g: 195, b: 40 },
  { r: 240, g: 249, b: 33 },
];
export const plasma = createGradientColormap(plasmaStops);

// Inferno - perceptually uniform, fire-like
const infernoStops: RGB[] = [
  { r: 0, g: 0, b: 4 },
  { r: 40, g: 11, b: 84 },
  { r: 101, g: 21, b: 110 },
  { r: 159, g: 42, b: 99 },
  { r: 212, g: 72, b: 66 },
  { r: 245, g: 125, b: 21 },
  { r: 250, g: 193, b: 39 },
  { r: 252, g: 255, b: 164 },
];
export const inferno = createGradientColormap(infernoStops);

// Magma - perceptually uniform, magma-like
const magmaStops: RGB[] = [
  { r: 0, g: 0, b: 4 },
  { r: 28, g: 16, b: 68 },
  { r: 79, g: 18, b: 123 },
  { r: 129, g: 37, b: 129 },
  { r: 181, g: 54, b: 122 },
  { r: 229, g: 80, b: 100 },
  { r: 251, g: 135, b: 97 },
  { r: 254, g: 194, b: 135 },
  { r: 252, g: 253, b: 191 },
];
export const magma = createGradientColormap(magmaStops);

// Ocean - deep blue to cyan
const oceanStops: RGB[] = [
  { r: 0, g: 7, b: 29 },
  { r: 0, g: 28, b: 71 },
  { r: 0, g: 59, b: 112 },
  { r: 0, g: 103, b: 152 },
  { r: 27, g: 149, b: 182 },
  { r: 107, g: 195, b: 210 },
  { r: 187, g: 233, b: 241 },
];
export const ocean = createGradientColormap(oceanStops);

// Fire - black to red to yellow to white
const fireStops: RGB[] = [
  { r: 0, g: 0, b: 0 },
  { r: 32, g: 0, b: 0 },
  { r: 96, g: 0, b: 0 },
  { r: 160, g: 32, b: 0 },
  { r: 224, g: 96, b: 0 },
  { r: 255, g: 160, b: 32 },
  { r: 255, g: 224, b: 128 },
  { r: 255, g: 255, b: 224 },
];
export const fire = createGradientColormap(fireStops);

// Rainbow - full spectrum
const rainbowStops: RGB[] = [
  { r: 150, g: 0, b: 90 },
  { r: 0, g: 0, b: 200 },
  { r: 0, g: 150, b: 255 },
  { r: 0, g: 255, b: 150 },
  { r: 150, g: 255, b: 0 },
  { r: 255, g: 200, b: 0 },
  { r: 255, g: 0, b: 0 },
];
export const rainbow = createGradientColormap(rainbowStops);

// Twilight - cyclic colormap
const twilightStops: RGB[] = [
  { r: 226, g: 217, b: 226 },
  { r: 166, g: 147, b: 186 },
  { r: 107, g: 94, b: 153 },
  { r: 68, g: 64, b: 126 },
  { r: 50, g: 50, b: 102 },
  { r: 68, g: 64, b: 126 },
  { r: 107, g: 94, b: 153 },
  { r: 166, g: 147, b: 186 },
  { r: 226, g: 217, b: 226 },
];
export const twilight = createGradientColormap(twilightStops);

// Turbo - improved rainbow
const turboStops: RGB[] = [
  { r: 48, g: 18, b: 59 },
  { r: 69, g: 91, b: 205 },
  { r: 42, g: 156, b: 238 },
  { r: 34, g: 208, b: 198 },
  { r: 90, g: 241, b: 142 },
  { r: 172, g: 250, b: 83 },
  { r: 236, g: 225, b: 44 },
  { r: 252, g: 168, b: 35 },
  { r: 237, g: 95, b: 36 },
  { r: 196, g: 37, b: 40 },
  { r: 122, g: 4, b: 3 },
];
export const turbo = createGradientColormap(turboStops);

// Neon - cyberpunk style
const neonStops: RGB[] = [
  { r: 0, g: 0, b: 0 },
  { r: 20, g: 0, b: 40 },
  { r: 60, g: 0, b: 100 },
  { r: 120, g: 0, b: 180 },
  { r: 180, g: 0, b: 255 },
  { r: 255, g: 80, b: 255 },
  { r: 255, g: 180, b: 255 },
];
export const neon = createGradientColormap(neonStops);

// Earth - natural tones
const earthStops: RGB[] = [
  { r: 22, g: 38, b: 25 },
  { r: 67, g: 90, b: 50 },
  { r: 134, g: 155, b: 90 },
  { r: 194, g: 183, b: 143 },
  { r: 230, g: 210, b: 170 },
  { r: 255, g: 245, b: 220 },
];
export const earth = createGradientColormap(earthStops);

// All available colormaps
export const COLORMAPS: Record<string, Colormap> = {
  grayscale: { name: "Grayscale", fn: grayscale },
  classic: { name: "Classic", fn: classic },
  viridis: { name: "Viridis", fn: viridis },
  plasma: { name: "Plasma", fn: plasma },
  inferno: { name: "Inferno", fn: inferno },
  magma: { name: "Magma", fn: magma },
  ocean: { name: "Ocean", fn: ocean },
  fire: { name: "Fire", fn: fire },
  rainbow: { name: "Rainbow", fn: rainbow },
  twilight: { name: "Twilight", fn: twilight },
  turbo: { name: "Turbo", fn: turbo },
  neon: { name: "Neon", fn: neon },
  earth: { name: "Earth", fn: earth },
};

export const DEFAULT_COLORMAP = "viridis";

/**
 * Generate a colormap lookup table (256 entries)
 * Useful for GPU texture-based colormapping
 */
export function generateColormapLUT(colormap: ColormapFunction): Uint8Array {
  const lut = new Uint8Array(256 * 4); // RGBA
  for (let i = 0; i < 256; i++) {
    const color = colormap(i / 255);
    lut[i * 4 + 0] = color.r;
    lut[i * 4 + 1] = color.g;
    lut[i * 4 + 2] = color.b;
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

/**
 * Convert RGB to CSS color string
 */
export function rgbToCSS(rgb: RGB): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Generate colormap preview gradient CSS
 */
export function colormapToGradientCSS(
  colormap: ColormapFunction,
  steps = 10,
): string {
  const colors: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    colors.push(`${rgbToCSS(colormap(t))} ${t * 100}%`);
  }
  return `linear-gradient(to right, ${colors.join(", ")})`;
}
