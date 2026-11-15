/** Viridis: colour-blind safe, monotonic in lightness, safe on a dark UI. */
export const RAMP = [
  "#440154",
  "#482878",
  "#3e4989",
  "#31688e",
  "#26828e",
  "#1f9e89",
  "#35b779",
  "#6ece58",
  "#b5de2b",
  "#fde725",
];

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const RGB = RAMP.map(hexToRgb);

/** t in [0, 1] → viridis colour. */
export function rampColor(t: number): string {
  const input = Number.isFinite(t) ? t : 0;
  const clamped = Math.min(1, Math.max(0, input));
  const scaled = clamped * (RGB.length - 1);
  const index = Math.min(RGB.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const [r1, g1, b1] = RGB[index];
  const [r2, g2, b2] = RGB[index + 1];
  const mix = (a: number, b: number) => Math.round(a + (b - a) * local);
  return `rgb(${mix(r1, r2)} ${mix(g1, g2)} ${mix(b1, b2)})`;
}

export const RAMP_CSS = `linear-gradient(90deg, ${RAMP.join(", ")})`;
