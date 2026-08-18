import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Smartphone, Laptop, Maximize } from 'lucide-react';
import { useCanvas } from '../context/CanvasContext';
import { CanvasElement } from '../types/figma';
import { hexToRgba, getTrianglePoints } from '../utils/geometry';

export const PresentationMode: React.FC = () => {
  const { elements, presentationMode, setPresentationMode } = useCanvas();

  // Find all frames
  const frames = elements.filter((el) => el.type === 'frame');
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);

  if (!presentationMode) return null;

  const currentFrame = frames[activeFrameIndex] || frames[0];

  const handlePrev = () => {
    if (frames.length === 0) return;
    setActiveFrameIndex((prev) => (prev > 0 ? prev - 1 : frames.length - 1));
  };

  const handleNext = () => {
    if (frames.length === 0) return;
    setActiveFrameIndex((prev) => (prev < frames.length - 1 ? prev + 1 : 0));
  };

  // Get children of current frame
  const frameChildren = currentFrame
    ? elements.filter((el) => el.parentId === currentFrame.id && el.visible)
    : [];

  const renderChildElement = (el: CanvasElement) => {
    // Relative coordinates to frame
    const relX = el.x - currentFrame.x;
    const relY = el.y - currentFrame.y;
    const fillStyle = hexToRgba(el.fill, el.fillOpacity);
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
              backgroundColor: fillStyle,
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
              backgroundColor: fillStyle,
              borderWidth: `${el.strokeWidth}px`,
              borderColor: strokeStyle,
              boxShadow: boxShadowStyle,
            }}
          />
        )}

        {el.type === 'triangle' && (
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${el.width} ${el.height}`}>
            <polygon
              points={getTrianglePoints(el.width, el.height)}
              fill={fillStyle}
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
              color: el.fill,
              textAlign: el.textAlign || 'left',
            }}
          >
            {el.textContent || ''}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] z-50 flex flex-col items-center justify-center animate-in fade-in duration-200">
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
              className="p-1 rounded-full hover:bg-[#333] transition-colors cursor-pointer text-gray-300 hover:text-white"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <button
          onClick={() => setPresentationMode(false)}
          title="Exit Presentation (Esc)"
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
              backgroundColor: currentFrame.fill,
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
