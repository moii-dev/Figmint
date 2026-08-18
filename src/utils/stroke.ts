import type { CSSProperties } from 'react';
import type { CanvasElement } from '../types/figma';

export interface EllipseStrokeGeometry {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export const getEllipseStrokeGeometry = (element: CanvasElement): EllipseStrokeGeometry => {
  const width = Math.max(0, element.width);
  const height = Math.max(0, element.height);
  const strokeWidth = Math.max(0, element.strokeWidth);
  const radiusOffset = element.strokeAlign === 'inside'
    ? -strokeWidth / 2
    : element.strokeAlign === 'outside'
      ? strokeWidth / 2
      : 0;

  return {
    cx: width / 2,
    cy: height / 2,
    rx: Math.max(0, width / 2 + radiusOffset),
    ry: Math.max(0, height / 2 + radiusOffset),
  };
};

export const getCssStrokeOverlayStyle = (
  element: CanvasElement,
  strokeColor: string
): CSSProperties => {
  const width = Math.max(0, element.strokeWidth);
  const offset = element.strokeAlign === 'outside'
    ? width
    : element.strokeAlign === 'center'
      ? width / 2
      : 0;

  return {
    position: 'absolute',
    inset: `${-offset}px`,
    boxSizing: 'border-box',
    borderWidth: `${width}px`,
    borderColor: strokeColor,
    borderStyle: element.strokeStyle === 'dashed'
      ? 'dashed'
      : element.strokeStyle === 'dotted'
        ? 'dotted'
        : 'solid',
    borderRadius: element.type === 'ellipse'
      ? '50%'
      : `${Math.max(0, (element.cornerRadius || 0) + offset)}px`,
    pointerEvents: 'none',
  };
};
