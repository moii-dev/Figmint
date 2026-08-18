import { CanvasElement, LinearGradientFill } from '../types/figma';
import { clamp, hexToRgb, normalizeHexColor } from './color';

const GRADIENT_COLORS = [
  '#8B5CF6',
  '#06B6D4',
  '#FF4D8D',
  '#FFB648',
  '#0D99FF',
  '#10B981',
  '#F43F5E',
  '#F97316',
] as const;

const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '-');

export const colorWithOpacity = (color: string, opacity = 1) => {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${clamp(opacity)})`;
};

export const redistributeGradientStops = (stops: LinearGradientFill['stops']) =>
  stops.map((stop, index) => ({
    ...stop,
    position: stops.length <= 1 ? 0 : (index / (stops.length - 1)) * 100,
  }));

export const createLinearGradient = (index = 0, baseColor?: string): LinearGradientFill => {
  const firstColor = baseColor ? normalizeHexColor(baseColor) : GRADIENT_COLORS[index % GRADIENT_COLORS.length];
  const secondColor = GRADIENT_COLORS[(index + (baseColor ? 0 : 1)) % GRADIENT_COLORS.length];
  return {
    id: `gradient-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'linear',
    angle: (135 + index * 30) % 360,
    opacity: 1,
    visible: true,
    stops: [
      { color: firstColor, position: 0, opacity: 1 },
      { color: secondColor, position: 100, opacity: 1 },
    ],
  };
};

export const collapseGradientLayers = (
  gradients: LinearGradientFill[] | undefined
): LinearGradientFill | undefined => {
  if (!gradients?.length) return undefined;
  const first = gradients[0];
  const stops = gradients.flatMap((gradient) =>
    gradient.stops.map((stop) => ({
      ...stop,
      opacity: clamp(stop.opacity) * clamp(gradient.opacity),
    }))
  );

  return {
    ...first,
    opacity: 1,
    visible: gradients.some((gradient) => gradient.visible),
    stops: redistributeGradientStops(stops),
  };
};

export const addGradientColor = (gradient: LinearGradientFill): LinearGradientFill => ({
  ...gradient,
  visible: true,
  stops: redistributeGradientStops([
    ...gradient.stops,
    {
      color: GRADIENT_COLORS[gradient.stops.length % GRADIENT_COLORS.length],
      position: 100,
      opacity: 1,
      visible: true,
    },
  ]),
});

export const removeGradientColor = (gradient: LinearGradientFill, stopIndex: number) => ({
  ...gradient,
  stops: redistributeGradientStops(
    gradient.stops.filter((_, index) => index !== stopIndex)
  ),
});

export const getVisibleGradients = (element: CanvasElement) => {
  const gradient = collapseGradientLayers(
    (element.gradients || []).filter((item) => item.visible && item.opacity > 0)
  );
  return gradient && gradient.stops.some((stop) => stop.visible !== false) ? [gradient] : [];
};

export const getRenderableGradientStops = (gradient: LinearGradientFill) => {
  const visibleStops = gradient.stops.filter((stop) => stop.visible !== false);
  if (visibleStops.length === 0) return [];
  if (visibleStops.length === 1) {
    return [
      { ...visibleStops[0], position: 0 },
      { ...visibleStops[0], position: 100 },
    ];
  }
  return redistributeGradientStops(visibleStops);
};

export const gradientToCss = (gradient: LinearGradientFill) => {
  const stops = getRenderableGradientStops(gradient)
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
            const stops = getRenderableGradientStops(gradient)
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
