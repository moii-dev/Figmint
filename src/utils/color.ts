export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export const normalizeHexColor = (color: string) =>
  HEX_COLOR_PATTERN.test(color) ? color.toUpperCase() : '#0D99FF';

export const hexToRgb = (color: string) => {
  const hex = normalizeHexColor(color).slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
};

export const rgbToHsv = (color: string): HsvColor => {
  const { r, g, b } = hexToRgb(color);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  if (hue < 0) hue += 360;
  return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
};

export const hsvToHex = ({ h, s, v }: HsvColor) => {
  const normalizedHue = ((h % 360) + 360) % 360;
  const chroma = clamp(v) * clamp(s);
  const segment = normalizedHue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = clamp(v) - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment < 1) [red, green, blue] = [chroma, x, 0];
  else if (segment < 2) [red, green, blue] = [x, chroma, 0];
  else if (segment < 3) [red, green, blue] = [0, chroma, x];
  else if (segment < 4) [red, green, blue] = [0, x, chroma];
  else if (segment < 5) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
};

export const shouldUseDarkForeground = (color: string) => {
  const { r, g, b } = hexToRgb(color);
  return r * 0.299 + g * 0.587 + b * 0.114 > 170;
};
