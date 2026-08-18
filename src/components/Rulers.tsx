import React, { useRef, useEffect } from 'react';
import { useCanvas } from '../context/CanvasContext';

interface RulersProps {
  containerWidth: number;
  containerHeight: number;
}

export const Rulers: React.FC<RulersProps> = ({ containerWidth, containerHeight }) => {
  const { zoom, pan, elements, selectedIds } = useCanvas();
  const topRulerRef = useRef<HTMLCanvasElement>(null);
  const leftRulerRef = useRef<HTMLCanvasElement>(null);

  const selectedElement = elements.find((el) => selectedIds.includes(el.id));

  // Render Top Horizontal Ruler
  useEffect(() => {
    const canvas = topRulerRef.current;
    if (!canvas || containerWidth <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = containerWidth;
    const height = 22;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Background & border
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e6e6e6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();

    // Determine tick intervals based on zoom
    let step = 100;
    if (zoom < 0.2) step = 500;
    else if (zoom < 0.5) step = 200;
    else if (zoom > 2) step = 50;
    else if (zoom > 4) step = 20;

    const minWorldX = Math.floor((-pan.x) / (zoom * step)) * step;
    const maxWorldX = Math.ceil((width - pan.x) / (zoom * step)) * step;

    // Draw Selected Element Highlight Range
    if (selectedElement) {
      const selStartX = selectedElement.x * zoom + pan.x;
      const selEndX = (selectedElement.x + selectedElement.width) * zoom + pan.x;

      ctx.fillStyle = 'rgba(13, 153, 255, 0.15)';
      ctx.fillRect(Math.max(0, selStartX), 0, Math.max(2, selEndX - selStartX), height);

      // Top indicator bar
      ctx.fillStyle = '#0d99ff';
      ctx.fillRect(Math.max(0, selStartX), height - 2, Math.max(2, selEndX - selStartX), 2);
    }

    // Draw major & minor ticks
    ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let worldX = minWorldX; worldX <= maxWorldX; worldX += step) {
      const screenX = Math.round(worldX * zoom + pan.x) + 0.5;
      if (screenX < 0 || screenX > width) continue;

      // Major tick line
      ctx.strokeStyle = '#cccccc';
      ctx.beginPath();
      ctx.moveTo(screenX, height - 8);
      ctx.lineTo(screenX, height);
      ctx.stroke();

      // Number label
      const isSelectedBound = selectedElement && (
        Math.round(worldX) === Math.round(selectedElement.x) ||
        Math.round(worldX) === Math.round(selectedElement.x + selectedElement.width)
      );

      ctx.fillStyle = isSelectedBound ? '#0d99ff' : '#888888';
      if (isSelectedBound) {
        ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      } else {
        ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      }

      ctx.fillText(worldX.toString(), screenX, 3);

      // Minor intermediate ticks (every 10 or 50)
      const minorStep = step / 5;
      for (let m = 1; m < 5; m++) {
        const minorWorldX = worldX + m * minorStep;
        const minorScreenX = Math.round(minorWorldX * zoom + pan.x) + 0.5;
        if (minorScreenX >= 0 && minorScreenX <= width) {
          ctx.strokeStyle = '#e0e0e0';
          ctx.beginPath();
          ctx.moveTo(minorScreenX, height - 4);
          ctx.lineTo(minorScreenX, height);
          ctx.stroke();
        }
      }
    }

    // Specifically draw selected element bounds if they aren't on exact step multiples
    if (selectedElement) {
      const startX = selectedElement.x;
      const endX = selectedElement.x + selectedElement.width;

      [startX, endX].forEach((boundX) => {
        const screenX = Math.round(boundX * zoom + pan.x) + 0.5;
        if (screenX >= 0 && screenX <= width) {
          // Blue marker line
          ctx.strokeStyle = '#0d99ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(screenX, 0);
          ctx.lineTo(screenX, height);
          ctx.stroke();

          // Blue text
          ctx.fillStyle = '#0d99ff';
          ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(Math.round(boundX).toString(), screenX, 3);
        }
      });
    }
  }, [containerWidth, zoom, pan, selectedElement]);

  // Render Left Vertical Ruler
  useEffect(() => {
    const canvas = leftRulerRef.current;
    if (!canvas || containerHeight <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = 22;
    const height = containerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Background & border
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e6e6e6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width - 0.5, 0);
    ctx.lineTo(width - 0.5, height);
    ctx.stroke();

    // Determine tick intervals
    let step = 100;
    if (zoom < 0.2) step = 500;
    else if (zoom < 0.5) step = 200;
    else if (zoom > 2) step = 50;
    else if (zoom > 4) step = 20;

    const minWorldY = Math.floor((-pan.y) / (zoom * step)) * step;
    const maxWorldY = Math.ceil((height - pan.y) / (zoom * step)) * step;

    // Draw Selected Element Highlight Range
    if (selectedElement) {
      const selStartY = selectedElement.y * zoom + pan.y;
      const selEndY = (selectedElement.y + selectedElement.height) * zoom + pan.y;

      ctx.fillStyle = 'rgba(13, 153, 255, 0.15)';
      ctx.fillRect(0, Math.max(0, selStartY), width, Math.max(2, selEndY - selStartY));

      // Right indicator bar
      ctx.fillStyle = '#0d99ff';
      ctx.fillRect(width - 2, Math.max(0, selStartY), 2, Math.max(2, selEndY - selStartY));
    }

    // Draw major & minor ticks
    ctx.font = '8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let worldY = minWorldY; worldY <= maxWorldY; worldY += step) {
      const screenY = Math.round(worldY * zoom + pan.y) + 0.5;
      if (screenY < 0 || screenY > height) continue;

      // Major tick line
      ctx.strokeStyle = '#cccccc';
      ctx.beginPath();
      ctx.moveTo(width - 8, screenY);
      ctx.lineTo(width, screenY);
      ctx.stroke();

      // Number label (rotated 90 deg or compact text)
      ctx.save();
      ctx.translate(width - 10, screenY);
      ctx.rotate(-Math.PI / 2);

      const isSelectedBound = selectedElement && (
        Math.round(worldY) === Math.round(selectedElement.y) ||
        Math.round(worldY) === Math.round(selectedElement.y + selectedElement.height)
      );

      ctx.fillStyle = isSelectedBound ? '#0d99ff' : '#888888';
      if (isSelectedBound) {
        ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      } else {
        ctx.font = '8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      }
      ctx.textAlign = 'center';
      ctx.fillText(worldY.toString(), 0, 0);
      ctx.restore();

      // Minor intermediate ticks
      const minorStep = step / 5;
      for (let m = 1; m < 5; m++) {
        const minorWorldY = worldY + m * minorStep;
        const minorScreenY = Math.round(minorWorldY * zoom + pan.y) + 0.5;
        if (minorScreenY >= 0 && minorScreenY <= height) {
          ctx.strokeStyle = '#e0e0e0';
          ctx.beginPath();
          ctx.moveTo(width - 4, minorScreenY);
          ctx.lineTo(width, minorScreenY);
          ctx.stroke();
        }
      }
    }

    // Specifically draw selected element bounds
    if (selectedElement) {
      const startY = selectedElement.y;
      const endY = selectedElement.y + selectedElement.height;

      [startY, endY].forEach((boundY) => {
        const screenY = Math.round(boundY * zoom + pan.y) + 0.5;
        if (screenY >= 0 && screenY <= height) {
          // Blue marker line
          ctx.strokeStyle = '#0d99ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, screenY);
          ctx.lineTo(width, screenY);
          ctx.stroke();

          // Blue text label
          ctx.save();
          ctx.translate(width - 10, screenY);
          ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = '#0d99ff';
          ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(Math.round(boundY).toString(), 0, 0);
          ctx.restore();
        }
      });
    }
  }, [containerHeight, zoom, pan, selectedElement]);

  return (
    <>
      {/* Top-Left Corner Box */}
      <div
        className="absolute top-0 left-0 w-[22px] h-[22px] bg-[#f5f5f5] border-r border-b border-[#e6e6e6] z-30 flex items-center justify-center text-[9px] text-gray-400 font-mono select-none"
      >
        px
      </div>

      {/* Top Horizontal Ruler */}
      <canvas
        ref={topRulerRef}
        className="absolute top-0 left-[22px] h-[22px] z-20 pointer-events-none"
        style={{ width: `${containerWidth - 22}px`, height: '22px' }}
      />

      {/* Left Vertical Ruler */}
      <canvas
        ref={leftRulerRef}
        className="absolute top-[22px] left-0 w-[22px] z-20 pointer-events-none"
        style={{ width: '22px', height: `${containerHeight - 22}px` }}
      />
    </>
  );
};
