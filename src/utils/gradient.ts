import { CanvasElement, LinearGradientFill } from '../types/figma';
import { clamp, hexToRgb, normalizeHexColor } from './color';

const GRADIENT_PRESETS = [
  ['#8B5CF6', '#06B6D4'],
  ['#FF4D8D', '#FFB648'],
  ['#0D99FF', '#7C3AED'],
  ['#10B981', '#38BDF8'],
  ['#F43F5E', '#8B5CF6'],
  ['#F97316', '#EC4899'],
] as const;

const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '-');

export const colorWithOpacity = (color: string, opacity = 1) => {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${clamp(opacity)})`;
};

export const createLinearGradient = (index = 0): LinearGradientFill => {
  const colors = GRADIENT_PRESETS[index % GRADIENT_PRESETS.length];
  return {
    id: `gradient-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'linear',
    angle: (135 + index * 30) % 360,
    opacity: 0.82,
    visible: true,
    stops: [
      { color: colors[0], position: 0, opacity: 1 },
      { color: colors[1], position: 100, opacity: 1 },
    ],
  };
};

export const getVisibleGradients = (element: CanvasElement) =>
  (element.gradients || []).filter((gradient) => gradient.visible && gradient.opacity > 0);

export const gradientToCss = (gradient: LinearGradientFill) => {
  const stops = gradient.stops
    .map(
      (stop) =>
        `${colorWithOpacity(normalizeHexColor(stop.color), clamp(stop.opacity) * clamp(gradient.opacity))} ${clamp(stop.position, 0, 100)}%`
    )
    .join(', ');
  return `linear-gradient(${gradient.angle}deg, ${stops})`;
};

export const getElementCssFill = (element: CanvasElement) => {
  const gradients = getVisibleGradients(element);
  return {
    backgroundColor: colorWithOpacity(element.fill, element.fillOpacity),
    backgroundImage: gradients.length
      ? gradients
          .map((gradient) => {
            const stops = gradient.stops
              .map(
                (stop) =>
                  `${colorWithOpacity(stop.color, clamp(stop.opacity) * clamp(gradient.opacity))} ${clamp(stop.position, 0, 100)}%`
              )
              .join(', ');
            return `linear-gradient(${gradient.angle}deg, ${stops})`;
          })
          .join(', ')
      : undefined,
  };
};

export const getSvgGradientCoordinates = (angle: number) => {
  const radians = (((angle % 360) + 360) % 360) * (Math.PI / 180);
  const dx = Math.sin(radians) * 50;
  const dy = -Math.cos(radians) * 50;
  const format = (value: number) => `${Math.round(value * 10000) / 10000}%`;
  return {
    x1: format(50 - dx),
    y1: format(50 - dy),
    x2: format(50 + dx),
    y2: format(50 + dy),
  };
};

export const getSvgGradientId = (prefix: string, elementId: string, gradientId: string) =>
  safeId(`${prefix}-${elementId}-${gradientId}`);
