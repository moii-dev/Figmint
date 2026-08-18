import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';
import { useCanvas } from '../context/CanvasContext';
import { CanvasElement } from '../types/figma';
import { hexToRgba, getStarPoints, getTrianglePoints } from '../utils/geometry';
import { SvgGradientDefs } from './SvgGradientDefs';
import {
  getElementCssFill,
  getSvgGradientId,
  getVisibleGradients,
} from '../utils/gradient';

export const PresentationMode: React.FC = () => {
  const { elements, presentationMode, setPresentationMode } = useCanvas();

  // Find all frames
  const frames = elements.filter((el) => el.type === 'frame');
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const currentFrame = frames[activeFrameIndex] || frames[0];

  const handlePrev = () => {
    if (frames.length === 0) return;
    setActiveFrameIndex((prev) => (prev > 0 ? prev - 1 : frames.length - 1));
  };

  const handleNext = () => {
    if (frames.length === 0) return;
    setActiveFrameIndex((prev) => (prev < frames.length - 1 ? prev + 1 : 0));
  };

  useEffect(() => {
    if (!presentationMode) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPresentationMode(false);
      else if (event.key === 'ArrowLeft' && frames.length > 0) {
        setActiveFrameIndex((prev) => (prev > 0 ? prev - 1 : frames.length - 1));
      } else if (event.key === 'ArrowRight' && frames.length > 0) {
        setActiveFrameIndex((prev) => (prev < frames.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [frames.length, presentationMode, setPresentationMode]);

  if (!presentationMode) return null;

  // Get children of current frame
  const frameChildren = currentFrame
    ? elements.filter((el) => el.parentId === currentFrame.id && el.visible)
    : [];

  const renderChildElement = (el: CanvasElement) => {
    // Children already store coordinates local to their frame.
    const relX = el.x;
    const relY = el.y;
    const fillStyle = hexToRgba(el.fill, el.fillOpacity);
    const fillCss = getElementCssFill(el);
    const visibleGradients = getVisibleGradients(el);
    const svgGradients = [...visibleGradients].reverse();
    const strokeStyle = el.strokeWidth > 0 ? hexToRgba(el.stroke, el.strokeOpacity) : 'transparent';
    const strokeDash = el.strokeStyle === 'dashed' ? '6 4' : el.strokeStyle === 'dotted' ? '2 3' : 'none';

    let boxShadowStyle = 'none';
    if (el.shadow) {
      const s = el.shadow;
      boxShadowStyle = `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${hexToRgba(s.color, s.opacity)}`;
    }

    return (
      <div
        key={el.id}
        className="absolute select-none pointer-events-none"
        style={{
          left: `${relX}px`,
          top: `${relY}px`,
          width: `${el.width}px`,
          height: `${el.height}px`,
          transform: `rotate(${el.rotation || 0}deg)`,
          opacity: el.opacity,
        }}
      >
        {(el.type === 'rectangle' || el.type === 'frame') && (
          <div
            className="w-full h-full"
            style={{
              ...fillCss,
              borderWidth: `${el.strokeWidth}px`,
              borderColor: strokeStyle,
              borderRadius: el.cornerRadius ? `${el.cornerRadius}px` : '0px',
              boxShadow: boxShadowStyle,
            }}
          />
        )}

        {el.type === 'ellipse' && (
          <div
            className="w-full h-full rounded-full"
            style={{
              ...fillCss,
              borderWidth: `${el.strokeWidth}px`,
              borderColor: strokeStyle,
              boxShadow: boxShadowStyle,
            }}
          />
        )}

        {el.type === 'triangle' && (
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${el.width} ${el.height}`}>
            <SvgGradientDefs element={el} prefix="presentation" />
            <polygon
              points={getTrianglePoints(el.width, el.height)}
              fill={fillStyle}
              stroke="none"
            />
            {svgGradients.map((gradient) => (
              <polygon
                key={gradient.id}
                points={getTrianglePoints(el.width, el.height)}
                fill={`url(#${getSvgGradientId('presentation', el.id, gradient.id)})`}
                opacity={gradient.opacity}
                stroke="none"
              />
            ))}
            <polygon
              points={getTrianglePoints(el.width, el.height)}
              fill="none"
              stroke={strokeStyle}
              strokeWidth={el.strokeWidth}
              strokeDasharray={strokeDash}
            />
          </svg>
        )}

        {el.type === 'star' && (
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${el.width} ${el.height}`}>
            <SvgGradientDefs element={el} prefix="presentation" />
            <polygon
              points={getStarPoints(el.width, el.height)}
              fill={fillStyle}
              stroke="none"
            />
            {svgGradients.map((gradient) => (
              <polygon
                key={gradient.id}
                points={getStarPoints(el.width, el.height)}
                fill={`url(#${getSvgGradientId('presentation', el.id, gradient.id)})`}
                opacity={gradient.opacity}
                stroke="none"
              />
            ))}
            <polygon
              points={getStarPoints(el.width, el.height)}
              fill="none"
              stroke={strokeStyle}
              strokeWidth={el.strokeWidth}
              strokeDasharray={strokeDash}
            />
          </svg>
        )}

        {el.type === 'text' && (
          <div
            className="w-full h-full flex items-center break-words whitespace-pre-wrap select-none"
            style={{
              fontSize: `${el.fontSize || 14}px`,
              fontWeight: el.fontWeight || 400,
              fontFamily: el.fontFamily,
              letterSpacing: `${el.letterSpacing || 0}px`,
              lineHeight: el.lineHeight || 1.2,
              color: visibleGradients.length ? 'transparent' : fillStyle,
              textAlign: el.textAlign || 'left',
              backgroundImage: visibleGradients.length
                ? `${fillCss.backgroundImage}, linear-gradient(${fillStyle}, ${fillStyle})`
                : undefined,
              backgroundClip: visibleGradients.length ? 'text' : undefined,
              WebkitBackgroundClip: visibleGradients.length ? 'text' : undefined,
            }}
          >
            {el.textContent || ''}
          </div>
        )}

        {el.type === 'line' && (
          <svg className="w-full h-full overflow-visible">
            <SvgGradientDefs element={el} prefix="presentation" />
            <line
              x1="0"
              y1="0"
              x2={el.width}
              y2={el.height}
              stroke={fillStyle}
              strokeWidth={Math.max(1, el.strokeWidth)}
              strokeDasharray={strokeDash}
            />
            {svgGradients.map((gradient) => (
              <line
                key={gradient.id}
                x1="0"
                y1="0"
                x2={el.width}
                y2={el.height}
                stroke={`url(#${getSvgGradientId('presentation', el.id, gradient.id)})`}
                strokeWidth={Math.max(1, el.strokeWidth)}
                strokeDasharray={strokeDash}
                opacity={gradient.opacity}
              />
            ))}
          </svg>
        )}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Presentation preview"
      className="fixed inset-0 bg-[#0f0f0f] z-50 flex flex-col items-center justify-center animate-in fade-in duration-200"
    >
      {/* Floating Presentation Control Bar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[#1e1e1e]/90 backdrop-blur-md border border-[#383838] rounded-full px-4 py-2 flex items-center gap-3 shadow-2xl z-50 text-white">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-200">
          <Smartphone size={14} className="text-[#0d99ff]" />
          <span>{currentFrame ? currentFrame.name : 'No frames found'}</span>
        </div>

        {frames.length > 1 && (
          <div className="flex items-center gap-1 border-l border-[#383838] pl-2 ml-1">
            <button
              onClick={handlePrev}
              title="Previous Frame"
              aria-label="Previous frame"
              className="p-1 rounded-full hover:bg-[#333] transition-colors cursor-pointer text-gray-300 hover:text-white"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-gray-400 font-mono">
              {activeFrameIndex + 1} / {frames.length}
            </span>
            <button
              onClick={handleNext}
              title="Next Frame"
              aria-label="Next frame"
              className="p-1 rounded-full hover:bg-[#333] transition-colors cursor-pointer text-gray-300 hover:text-white"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <button
          ref={closeButtonRef}
          onClick={() => setPresentationMode(false)}
          title="Exit Presentation (Esc)"
          aria-label="Exit presentation"
          className="ml-2 p-1.5 rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Frame Preview Canvas */}
      {currentFrame ? (
        <div className="relative max-h-[85vh] max-w-[90vw] overflow-auto flex items-center justify-center p-6">
          <div
            id={`presentation-frame-${currentFrame.id}`}
            className="relative overflow-hidden shadow-2xl transition-all duration-300"
            style={{
              width: `${currentFrame.width}px`,
              height: `${currentFrame.height}px`,
              ...getElementCssFill(currentFrame),
              borderRadius: `${currentFrame.cornerRadius || 0}px`,
              borderWidth: `${currentFrame.strokeWidth}px`,
              borderColor: currentFrame.stroke,
              transform: `scale(${Math.min(
                1,
                Math.min(
                  (window.innerWidth * 0.85) / currentFrame.width,
                  (window.innerHeight * 0.8) / currentFrame.height
                )
              )})`,
              transformOrigin: 'center center',
            }}
          >
            {frameChildren.map(renderChildElement)}
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-400">
          <p className="text-sm">No Frames found on canvas.</p>
          <p className="text-xs text-gray-500 mt-1">Create a frame using the Frame Tool (F) first.</p>
        </div>
      )}
    </div>
  );
};
