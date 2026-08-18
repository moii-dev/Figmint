import { CanvasElement, Point, Rect, SnapGuide } from '../types/figma';

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

/**
 * Smart snapping: calculates snap lines when dragging or resizing elements
 */
export function calculateSnapping(
  activeRect: Rect,
  otherElements: CanvasElement[],
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

  for (const other of otherElements) {
    if (!other.visible) continue;
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

/**
 * Export helpers: Generates an SVG string representation of elements
 */
export function generateSvgString(elements: CanvasElement[], targetBox?: Rect): string {
  const box = targetBox || getBoundingBox(elements) || { x: 0, y: 0, width: 800, height: 600 };
  const padding = 20;
  const viewBox = `${box.x - padding} ${box.y - padding} ${box.width + padding * 2} ${box.height + padding * 2}`;

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${box.width + padding * 2}" height="${box.height + padding * 2}">\n`;
  svgContent += `<style>text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }</style>\n`;

  for (const el of elements) {
    if (!el.visible) continue;
    const fillStyle = hexToRgba(el.fill, el.fillOpacity);
    const strokeStyle = el.strokeWidth > 0 ? hexToRgba(el.stroke, el.strokeOpacity) : 'none';
    const strokeDash = el.strokeStyle === 'dashed' ? 'stroke-dasharray="6,4"' : el.strokeStyle === 'dotted' ? 'stroke-dasharray="2,3"' : '';
    const transform = el.rotation ? `transform="rotate(${el.rotation} ${el.x + el.width / 2} ${el.y + el.height / 2})"` : '';
    const opacityAttr = el.opacity < 1 ? `opacity="${el.opacity}"` : '';

    if (el.type === 'frame' || el.type === 'rectangle') {
      const rx = el.cornerRadius || 0;
      svgContent += `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${rx}" ry="${rx}" fill="${fillStyle}" stroke="${strokeStyle}" stroke-width="${el.strokeWidth}" ${strokeDash} ${transform} ${opacityAttr} />\n`;
    } else if (el.type === 'ellipse') {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const rx = el.width / 2;
      const ry = el.height / 2;
      svgContent += `  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fillStyle}" stroke="${strokeStyle}" stroke-width="${el.strokeWidth}" ${strokeDash} ${transform} ${opacityAttr} />\n`;
    } else if (el.type === 'triangle') {
      const p1 = `${el.x + el.width / 2},${el.y}`;
      const p2 = `${el.x + el.width},${el.y + el.height}`;
      const p3 = `${el.x},${el.y + el.height}`;
      svgContent += `  <polygon points="${p1} ${p2} ${p3}" fill="${fillStyle}" stroke="${strokeStyle}" stroke-width="${el.strokeWidth}" ${strokeDash} ${transform} ${opacityAttr} />\n`;
    } else if (el.type === 'text') {
      const fontSize = el.fontSize || 14;
      const fontWeight = el.fontWeight || 400;
      svgContent += `  <text x="${el.x}" y="${el.y + fontSize}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fillStyle}" ${transform} ${opacityAttr}>${el.textContent || ''}</text>\n`;
    } else if (el.type === 'line') {
      svgContent += `  <line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${fillStyle}" stroke-width="${Math.max(1, el.strokeWidth)}" ${strokeDash} ${transform} ${opacityAttr} />\n`;
    }
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
