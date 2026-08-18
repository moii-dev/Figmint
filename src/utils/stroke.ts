import type { CSSProperties } from 'react';
import type { CanvasElement } from '../types/figma';

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

