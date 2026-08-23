import React from 'react';
import { CanvasElement, TransformHandle } from '../types/figma';

interface TransformOverlayProps {
  element: CanvasElement;
  zoom: number;
  onHandlePointerDown: (e: React.PointerEvent, handle: TransformHandle) => void;
  onRadiusHandlePointerDown: (e: React.PointerEvent, cornerIndex?: number) => void;
  isResizing?: boolean;
  isDragging?: boolean;
  showRadiusHandles?: boolean;
}

export const TransformOverlay: React.FC<TransformOverlayProps> = ({
  element,
  zoom,
  onHandlePointerDown,
  onRadiusHandlePointerDown,
  showRadiusHandles = true,
}) => {
  const { width, height, cornerRadius, type } = element;
  const isShapeWithRadius = ['rectangle', 'frame', 'component', 'instance'].includes(type) && width > 40 && height > 40;
  const accentColor = type === 'component' || type === 'instance' ? '#9747ff' : '#0d99ff';

  // Calculate inner radius handles position
  const currentRadius = cornerRadius || 0;
  const maxAllowedRadius = Math.min(width, height) / 2;
  const clampedRadius = Math.min(currentRadius, maxAllowedRadius);
  const handleOffset = Math.max(12, Math.min(clampedRadius + 8, maxAllowedRadius - 6));

  const handles: { type: TransformHandle; x: number; y: number; cursor: string }[] = [
    { type: 'tl', x: 0, y: 0, cursor: 'nwse-resize' },
    { type: 't', x: width / 2, y: 0, cursor: 'ns-resize' },
    { type: 'tr', x: width, y: 0, cursor: 'nesw-resize' },
    { type: 'r', x: width, y: height / 2, cursor: 'ew-resize' },
    { type: 'br', x: width, y: height, cursor: 'nwse-resize' },
    { type: 'b', x: width / 2, y: height, cursor: 'ns-resize' },
    { type: 'bl', x: 0, y: height, cursor: 'nesw-resize' },
    { type: 'l', x: 0, y: height / 2, cursor: 'ew-resize' },
  ];

  return (
    <div
      id={`transform-overlay-${element.id}`}
      className="absolute inset-0 pointer-events-none"
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {/* Figma Selection Bounding Box Border */}
      <div
        className="absolute inset-0 border pointer-events-none z-20"
        style={{
          borderWidth: `${Math.max(1, 1.5 / zoom)}px`,
          borderColor: accentColor,
        }}
      />

      {/* Top Center Title Tag for Frame (Figma UI3 style) */}
      <div
        className="absolute -top-7 left-1/2 -translate-x-1/2 font-semibold text-[11px] font-sans px-2 py-0.5 pointer-events-none whitespace-nowrap z-30 select-none"
        style={{ color: accentColor, transform: `scale(${Math.max(0.7, 1 / zoom)})`, transformOrigin: 'bottom center' }}
      >
        {element.name}
      </div>

      {/* Bottom Center Dynamic Dimension Badge (e.g., 402 × 874) in Figma UI3 pill */}
      <div
        className="absolute left-1/2 -bottom-7 -translate-x-1/2 text-white text-[11px] font-mono font-medium px-2 py-0.5 rounded-full shadow-md pointer-events-none whitespace-nowrap z-30 flex items-center gap-1 select-none"
        style={{ backgroundColor: accentColor, transform: `scale(${Math.max(0.7, 1 / zoom)})`, transformOrigin: 'top center' }}
      >
        <span>{Math.round(width)}</span>
        <span className="opacity-75">×</span>
        <span>{Math.round(height)}</span>
      </div>

      {/* 8-point Resize Handles */}
      {handles.map((h) => {
        const size = Math.max(6, 8 / zoom);
        return (
          <div
            key={h.type}
            onPointerDown={(e) => onHandlePointerDown(e, h.type)}
            aria-label={`Resize ${h.type}`}
            className="absolute bg-white border rounded-[1px] pointer-events-auto hover:scale-125 transition-transform z-30 shadow-xs"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${h.x}px`,
              top: `${h.y}px`,
              transform: 'translate(-50%, -50%)',
              cursor: h.cursor,
              borderColor: accentColor,
            }}
          />
        );
      })}

      {/* Interactive Figma Inner Corner Radius Handles */}
      {showRadiusHandles && isShapeWithRadius && (
        <>
          <div
            onPointerDown={(e) => onRadiusHandlePointerDown(e, 0)}
            title="Adjust corner radius"
            className="absolute w-2.5 h-2.5 rounded-full bg-white border pointer-events-auto hover:scale-125 transition-all shadow-xs z-30 cursor-nwse-resize"
            style={{
              left: `${handleOffset}px`,
              top: `${handleOffset}px`,
              transform: 'translate(-50%, -50%)',
              borderColor: accentColor,
            }}
          />
          <div
            onPointerDown={(e) => onRadiusHandlePointerDown(e, 1)}
            title="Adjust corner radius"
            className="absolute w-2.5 h-2.5 rounded-full bg-white border pointer-events-auto hover:scale-125 transition-all shadow-xs z-30 cursor-nesw-resize"
            style={{
              left: `${width - handleOffset}px`,
              top: `${handleOffset}px`,
              transform: 'translate(-50%, -50%)',
              borderColor: accentColor,
            }}
          />
          <div
            onPointerDown={(e) => onRadiusHandlePointerDown(e, 2)}
            title="Adjust corner radius"
            className="absolute w-2.5 h-2.5 rounded-full bg-white border pointer-events-auto hover:scale-125 transition-all shadow-xs z-30 cursor-nwse-resize"
            style={{
              left: `${width - handleOffset}px`,
              top: `${height - handleOffset}px`,
              transform: 'translate(-50%, -50%)',
              borderColor: accentColor,
            }}
          />
          <div
            onPointerDown={(e) => onRadiusHandlePointerDown(e, 3)}
            title="Adjust corner radius"
            className="absolute w-2.5 h-2.5 rounded-full bg-white border pointer-events-auto hover:scale-125 transition-all shadow-xs z-30 cursor-nesw-resize"
            style={{
              left: `${handleOffset}px`,
              top: `${height - handleOffset}px`,
              transform: 'translate(-50%, -50%)',
              borderColor: accentColor,
            }}
          />
        </>
      )}
    </div>
  );
};
