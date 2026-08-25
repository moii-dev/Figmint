import React from 'react';
import type { CanvasElement } from '../types/figma';
import { getDiamondPoints, getPolygonPoints, getStarPoints, getTrianglePoints } from '../utils/geometry';

function pointsToClipPath(points: string, width: number, height: number): string {
  const normalized = points.trim().split(/\s+/).map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return `${(x / width) * 100}% ${(y / height) * 100}%`;
  });
  return `polygon(${normalized.join(', ')})`;
}

function getClipPath(element: CanvasElement): string | undefined {
  if (element.type === 'triangle') return pointsToClipPath(getTrianglePoints(element.width, element.height), element.width, element.height);
  if (element.type === 'star') return pointsToClipPath(getStarPoints(element.width, element.height), element.width, element.height);
  if (element.type === 'polygon') return pointsToClipPath(getPolygonPoints(element.width, element.height), element.width, element.height);
  if (element.type === 'diamond') return pointsToClipPath(getDiamondPoints(element.width, element.height), element.width, element.height);
  return undefined;
}

export const ImageFillLayer: React.FC<{ element: CanvasElement; className?: string }> = ({ element, className = '' }) => {
  const fill = element.imageFill;
  if (!fill?.src) return null;
  const clipPath = getClipPath(element);
  const commonStyle: React.CSSProperties = {
    borderRadius: element.type === 'ellipse' ? '50%' : `${element.cornerRadius || 0}px`,
    clipPath,
  };

  if (fill.mode === 'tile') {
    return (
      <div
        aria-label={`Image fill: ${fill.name || element.name}`}
        className={`pointer-events-none absolute inset-0 ${className}`}
        style={{
          ...commonStyle,
          backgroundImage: `url("${fill.src.replace(/"/g, '%22')}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: `${Math.max(5, fill.tileScale * 100)}% auto`,
          backgroundPosition: `${50 + fill.offsetX * 50}% ${50 + fill.offsetY * 50}%`,
        }}
      />
    );
  }

  const objectFit = fill.mode === 'fit' ? 'contain' : 'cover';
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} style={commonStyle}>
      <img
        src={fill.src}
        alt=""
        draggable={false}
        className="h-full w-full select-none"
        style={{
          objectFit,
          transform: fill.mode === 'crop'
            ? `translate(${fill.offsetX * 50}%, ${fill.offsetY * 50}%) rotate(${fill.rotation}deg) scale(${fill.scale})`
            : undefined,
          transformOrigin: 'center',
        }}
      />
    </div>
  );
};
