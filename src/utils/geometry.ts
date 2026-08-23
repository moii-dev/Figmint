import { CanvasElement, DesignToken, Point, Rect, SnapGuide } from '../types/figma';
import { getTopLevelSelectionIds, getWorldRect } from './hierarchy';
import {
  getSvgGradientCoordinates,
  getSvgGradientId,
  getRenderableGradientStops,
  getVisibleGradients,
} from './gradient';
import { resolveElementTokens } from './tokens';

/**
 * Generates an SVG path or points for shapes
 */
export function getTrianglePoints(width: number, height: number): string {
  // Top center, Bottom right, Bottom left
  const p1 = `${width / 2},0`;
  const p2 = `${width},${height}`;
  const p3 = `0,${height}`;
  return `${p1} ${p2} ${p3}`;
}

export function getPolygonPoints(width: number, height: number, sides = 6): string {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;

  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / sides;
    return `${(cx + Math.cos(angle) * rx).toFixed(2)},${(cy + Math.sin(angle) * ry).toFixed(2)}`;
  }).join(' ');
}

export function getDiamondPoints(width: number, height: number): string {
  return `${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`;
}

export function getStarPoints(width: number, height: number, points = 5, innerRatio = 0.4): string {
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(width, height) / 2;
  const innerRadius = outerRadius * innerRatio;
  const step = Math.PI / points;
  let res = '';

  for (let i = 0; i < 2 * points; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = i * step - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    res += `${i === 0 ? '' : ' '}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return res;
}

/**
 * Calculates unified bounding box for a set of elements
 */
export function getBoundingBox(elements: CanvasElement[]): Rect | null {
  if (elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    if (!el.visible) continue;
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  if (minX === Infinity) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getBoundingBoxFromRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Checks if point is inside a rect
 */
export function isPointInRect(pt: Point, rect: Rect): boolean {
  return (
    pt.x >= rect.x &&
    pt.x <= rect.x + rect.width &&
    pt.y >= rect.y &&
    pt.y <= rect.y + rect.height
  );
}

/**
 * Check if rect A intersects rect B (for marquee selection)
 */
export function doRectsIntersect(a: Rect, b: Rect): boolean {
  const aNorm = {
    x: a.width >= 0 ? a.x : a.x + a.width,
    y: a.height >= 0 ? a.y : a.y + a.height,
    width: Math.abs(a.width),
    height: Math.abs(a.height),
  };
  const bNorm = {
    x: b.width >= 0 ? b.x : b.x + b.width,
    y: b.height >= 0 ? b.y : b.y + b.height,
    width: Math.abs(b.width),
    height: Math.abs(b.height),
  };

  return !(
    aNorm.x + aNorm.width < bNorm.x ||
    aNorm.x > bNorm.x + bNorm.width ||
    aNorm.y + aNorm.height < bNorm.y ||
    aNorm.y > bNorm.y + bNorm.height
  );
}

/** Selects nested objects without returning a frame together with its descendants. */
export function getMarqueeSelectionIds(box: Rect, elements: CanvasElement[]): string[] {
  const candidates = elements.filter(
    (element) => element.visible && !element.locked && doRectsIntersect(box, getWorldRect(element, elements))
  );
  const candidateIds = new Set(candidates.map((element) => element.id));
  const containsRect = (outer: Rect, inner: Rect) =>
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height;

  const hierarchyAwareIds = candidates
    .filter((element) => {
      if (!['frame', 'component', 'instance'].includes(element.type)) return true;
      const frameRect = getWorldRect(element, elements);
      const hasSelectedChild = elements.some(
        (child) => child.parentId === element.id && candidateIds.has(child.id)
      );
      return containsRect(box, frameRect) || !hasSelectedChild;
    })
    .map((element) => element.id);

  return getTopLevelSelectionIds(hierarchyAwareIds, elements);
}

/**
 * Smart snapping: calculates snap lines when dragging or resizing elements
 */
export function calculateSnapping(
  activeRect: Rect,
  otherRects: Rect[],
  threshold = 6
): { snappedX: number; snappedY: number; guides: SnapGuide[] } {
  let snappedX = activeRect.x;
  let snappedY = activeRect.y;
  const guides: SnapGuide[] = [];

  const activeCenterX = activeRect.x + activeRect.width / 2;
  const activeRight = activeRect.x + activeRect.width;

  const activeCenterY = activeRect.y + activeRect.height / 2;
  const activeBottom = activeRect.y + activeRect.height;

  let minDeltaX = threshold + 1;
  let minDeltaY = threshold + 1;

  for (const other of otherRects) {
    const otherCenterX = other.x + other.width / 2;
    const otherRight = other.x + other.width;
    const otherCenterY = other.y + other.height / 2;
    const otherBottom = other.y + other.height;

    // X alignment checks (Left, Center, Right)
    const xTargets = [
      { pos: other.x, type: 'left' },
      { pos: otherCenterX, type: 'center' },
      { pos: otherRight, type: 'right' },
    ];

    const currentXPoints = [
      { pos: activeRect.x, offset: 0 },
      { pos: activeCenterX, offset: activeRect.width / 2 },
      { pos: activeRight, offset: activeRect.width },
    ];

    for (const t of xTargets) {
      for (const cur of currentXPoints) {
        const delta = Math.abs(cur.pos - t.pos);
        if (delta < threshold && delta < minDeltaX) {
          minDeltaX = delta;
          snappedX = t.pos - cur.offset;
          for (let index = guides.length - 1; index >= 0; index -= 1) {
            if (guides[index].type === 'x') guides.splice(index, 1);
          }
          guides.push({
            type: 'x',
            position: t.pos,
            start: Math.min(activeRect.y, other.y) - 20,
            end: Math.max(activeBottom, otherBottom) + 20,
          });
        }
      }
    }

    // Y alignment checks (Top, Middle, Bottom)
    const yTargets = [
      { pos: other.y, type: 'top' },
      { pos: otherCenterY, type: 'middle' },
      { pos: otherBottom, type: 'bottom' },
    ];

    const currentYPoints = [
      { pos: activeRect.y, offset: 0 },
      { pos: activeCenterY, offset: activeRect.height / 2 },
      { pos: activeBottom, offset: activeRect.height },
    ];

    for (const t of yTargets) {
      for (const cur of currentYPoints) {
        const delta = Math.abs(cur.pos - t.pos);
        if (delta < threshold && delta < minDeltaY) {
          minDeltaY = delta;
          snappedY = t.pos - cur.offset;
          for (let index = guides.length - 1; index >= 0; index -= 1) {
            if (guides[index].type === 'y') guides.splice(index, 1);
          }
          guides.push({
            type: 'y',
            position: t.pos,
            start: Math.min(activeRect.x, other.x) - 20,
            end: Math.max(activeRight, otherRight) + 20,
          });
        }
      }
    }
  }

  return { snappedX, snappedY, guides };
}

/**
 * Format hex color with opacity to rgba string
 */
export function hexToRgba(hex: string, opacity = 1): string {
  if (!hex) return 'rgba(0,0,0,1)';
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;

  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return 'rgba(0,0,0,1)';

  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Export helpers: Generates an SVG string representation of elements
 */
export function generateSvgString(
  elements: CanvasElement[],
  allElements: CanvasElement[] = elements,
  targetBox?: Rect,
  tokens: DesignToken[] = []
): string {
  const resolvedElements = elements.map((element) => resolveElementTokens(element, tokens));
  const resolvedAllElements = allElements.map((element) => resolveElementTokens(element, tokens));
  const worldRects = resolvedElements
    .filter((element) => element.visible)
    .map((element) => getWorldRect(element, resolvedAllElements));
  const box = targetBox || getBoundingBoxFromRects(worldRects) || { x: 0, y: 0, width: 800, height: 600 };
  const padding = 20;
  const viewBox = `${box.x - padding} ${box.y - padding} ${box.width + padding * 2} ${box.height + padding * 2}`;

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${box.width + padding * 2}" height="${box.height + padding * 2}">\n`;
  svgContent += `<style>text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }</style>\n`;

  for (const el of resolvedElements) {
    if (!el.visible) continue;
    const worldRect = getWorldRect(el, resolvedAllElements);
    const { x, y, width, height } = worldRect;
    const fillStyle = hexToRgba(el.fill, el.fillOpacity);
    const strokeStyle = el.strokeWidth > 0 ? hexToRgba(el.stroke, el.strokeOpacity) : 'none';
    const strokeDash = el.strokeStyle === 'dashed' ? 'stroke-dasharray="6,4"' : el.strokeStyle === 'dotted' ? 'stroke-dasharray="2,3"' : '';
    const transform = el.rotation ? `transform="rotate(${el.rotation} ${x + width / 2} ${y + height / 2})"` : '';
    const gradients = getVisibleGradients(el);
    svgContent += `  <g opacity="${Math.max(0, Math.min(1, el.opacity))}">\n`;

    if (gradients.length) {
      svgContent += `  <defs>\n`;
      for (const gradient of gradients) {
        const id = getSvgGradientId('export', el.id, gradient.id);
        const coordinates = getSvgGradientCoordinates(gradient.angle);
        svgContent += `    <linearGradient id="${id}" x1="${coordinates.x1}" y1="${coordinates.y1}" x2="${coordinates.x2}" y2="${coordinates.y2}">\n`;
        for (const stop of getRenderableGradientStops(gradient)) {
          svgContent += `      <stop offset="${Math.max(0, Math.min(100, stop.position))}%" stop-color="${escapeXml(stop.color)}" stop-opacity="${Math.max(0, Math.min(1, stop.opacity))}" />\n`;
        }
        svgContent += `    </linearGradient>\n`;
      }
      svgContent += `  </defs>\n`;
    }

    const renderShape = (paint: string, layerOpacity: number, outline = false) => {
      const opacity = Math.max(0, Math.min(1, layerOpacity));
      const opacityAttr = opacity < 1 ? `opacity="${opacity}"` : '';
      const fill = outline ? 'none' : paint;
      const stroke = outline ? strokeStyle : 'none';
      const strokeWidth = outline ? el.strokeWidth : 0;
      const dash = outline ? strokeDash : '';

      if (['frame', 'rectangle', 'component', 'instance'].includes(el.type)) {
        const rx = el.cornerRadius || 0;
        return `  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" ry="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dash} ${transform} ${opacityAttr} />\n`;
      }
      if (el.type === 'ellipse') {
        return `  <ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dash} ${transform} ${opacityAttr} />\n`;
      }
      if (el.type === 'triangle') {
        const points = `${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`;
        return `  <polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dash} ${transform} ${opacityAttr} />\n`;
      }
      if (el.type === 'polygon' || el.type === 'diamond') {
        const localPoints = el.type === 'polygon'
          ? getPolygonPoints(width, height)
          : getDiamondPoints(width, height);
        const points = localPoints
          .split(' ')
          .map((point) => {
            const [pointX, pointY] = point.split(',').map(Number);
            return `${x + pointX},${y + pointY}`;
          })
          .join(' ');
        return `  <polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dash} ${transform} ${opacityAttr} />\n`;
      }
      if (el.type === 'star') {
        const points = getStarPoints(width, height)
          .split(' ')
          .map((point) => {
            const [pointX, pointY] = point.split(',').map(Number);
            return `${x + pointX},${y + pointY}`;
          })
          .join(' ');
        return `  <polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${dash} ${transform} ${opacityAttr} />\n`;
      }
      if (el.type === 'text') {
        const fontSize = el.fontSize || 14;
        const fontWeight = el.fontWeight || 400;
        const textAnchor = el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start';
        const textX = el.textAlign === 'center' ? x + width / 2 : el.textAlign === 'right' ? x + width : x;
        const lineHeight = fontSize * (el.lineHeight || 1.2);
        const family = escapeXml(el.fontFamily || '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif');
        const tspans = (el.textContent || '')
          .split('\n')
          .map((line, index) => `<tspan x="${textX}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
          .join('');
        const textFill = outline ? 'none' : paint;
        const textStroke = outline ? strokeStyle : 'none';
        const textStrokeWidth = outline ? el.strokeWidth : 0;
        return `  <text x="${textX}" y="${y + fontSize}" font-size="${fontSize}" font-weight="${fontWeight}" font-family="${family}" text-anchor="${textAnchor}" letter-spacing="${el.letterSpacing || 0}" fill="${textFill}" stroke="${textStroke}" stroke-width="${textStrokeWidth}" paint-order="stroke fill" ${transform} ${opacityAttr}>${tspans}</text>\n`;
      }
      if (el.type === 'line' && !outline) {
        return `  <line x1="${x}" y1="${y}" x2="${x + width}" y2="${y + height}" stroke="${paint}" stroke-width="${Math.max(1, el.strokeWidth)}" ${strokeDash} ${transform} ${opacityAttr} />\n`;
      }
      if (el.type === 'arrow' && !outline) {
        const headSize = Math.max(10, Math.min(24, height * 0.45));
        const midY = y + height / 2;
        const lineEnd = x + Math.max(0, width - headSize);
        return `  <line x1="${x}" y1="${midY}" x2="${lineEnd}" y2="${midY}" stroke="${paint}" stroke-width="${Math.max(2, el.strokeWidth || 3)}" ${strokeDash} ${transform} ${opacityAttr} />\n  <polygon points="${lineEnd},${midY - headSize / 2} ${x + width},${midY} ${lineEnd},${midY + headSize / 2}" fill="${paint}" ${transform} ${opacityAttr} />\n`;
      }
      if (el.type === 'image' && !outline && el.mediaSrc) {
        return `  <image href="${escapeXml(el.mediaSrc)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${el.objectFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}" ${transform} ${opacityAttr} />\n`;
      }
      if (el.type === 'video' && !outline) {
        return `  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${el.cornerRadius || 0}" fill="#111827" ${transform} ${opacityAttr} />\n  <text x="${x + width / 2}" y="${y + height / 2}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="14" ${transform}>Video</text>\n`;
      }
      return '';
    };

    svgContent += renderShape((el.type === 'line' || el.type === 'arrow') && el.strokeWidth > 0 ? strokeStyle : fillStyle, 1);
    if ((el.type !== 'line' && el.type !== 'arrow' && el.type !== 'image' && el.type !== 'video') || el.strokeWidth === 0) {
      for (const gradient of [...gradients].reverse()) {
        svgContent += renderShape(`url(#${getSvgGradientId('export', el.id, gradient.id)})`, gradient.opacity);
      }
    }
    if (!['line', 'arrow', 'image', 'video'].includes(el.type) && el.strokeWidth > 0) {
      svgContent += renderShape('none', 1, true);
    }
    svgContent += `  </g>\n`;
  }

  svgContent += `</svg>`;
  return svgContent;
}

/**
 * Downloads a text file (SVG or JSON)
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads PNG render from SVG string
 */
export function downloadPngFromSvg(svgString: string, filename: string, scale = 2) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);

    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  img.src = url;
}
