import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';
import { useCanvas } from '../context/CanvasContext';
import { CanvasElement, PrototypeInteraction } from '../types/figma';
import {
  hexToRgba,
  getStarPoints,
  getTrianglePoints,
  getPolygonPoints,
  getDiamondPoints,
} from '../utils/geometry';
import { SvgGradientDefs } from './SvgGradientDefs';
import {
  getElementCssFill,
  getSvgGradientId,
  getVisibleGradients,
} from '../utils/gradient';
import { getCssStrokeOverlayStyle } from '../utils/stroke';
import { resolveElementTokens } from '../utils/tokens';
import { getPrototypeStartFrame, matchSmartAnimateLayers } from '../utils/prototype';
import { ImageFillLayer } from './ImageFillLayer';

export const PresentationMode: React.FC = () => {
  const { elements, selectedIds, presentationMode, setPresentationMode, tokens } = useCanvas();

  // Find all frames
  const frames = elements.filter((el) => el.type === 'frame' && !el.parentId && el.visible);
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [overlayFrameId, setOverlayFrameId] = useState<string | null>(null);
  const [activeTransition, setActiveTransition] = useState<{ fromFrameId: string; interaction: PrototypeInteraction; nonce: number } | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const currentFrame = frames.find((frame) => frame.id === activeFrameId) || frames[0];
  const activeFrameIndex = currentFrame ? frames.findIndex((frame) => frame.id === currentFrame.id) : 0;

  const handlePrev = () => {
    if (frames.length === 0) return;
    const next = frames[activeFrameIndex > 0 ? activeFrameIndex - 1 : frames.length - 1];
    if (next) setActiveFrameId(next.id);
  };

  const handleNext = () => {
    if (frames.length === 0) return;
    const next = frames[activeFrameIndex < frames.length - 1 ? activeFrameIndex + 1 : 0];
    if (next) setActiveFrameId(next.id);
  };

  const executeInteraction = (interaction: PrototypeInteraction) => {
    if (interaction.action === 'close-overlay') {
      setOverlayFrameId(null);
      return;
    }
    if (interaction.action === 'back') {
      const previous = history.at(-1);
      if (previous) {
        setHistory((items) => items.slice(0, -1));
        setActiveFrameId(previous);
      }
      return;
    }
    const destination = frames.find((frame) => frame.id === interaction.destinationFrameId);
    if (!destination || !currentFrame) return;
    if (interaction.action === 'open-overlay') {
      setOverlayFrameId(destination.id);
      return;
    }
    setHistory((items) => [...items, currentFrame.id]);
    setActiveTransition({ fromFrameId: currentFrame.id, interaction, nonce: Date.now() });
    setActiveFrameId(destination.id);
  };

  useEffect(() => {
    if (!presentationMode) return;
    const start = getPrototypeStartFrame(elements, selectedIds);
    setActiveFrameId(start?.id || null);
    setHistory([]);
    setOverlayFrameId(null);
    setActiveTransition(null);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPresentationMode(false);
      else if (event.key === 'ArrowLeft' && frames.length > 0) {
        handlePrev();
      } else if (event.key === 'ArrowRight' && frames.length > 0) {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [presentationMode, setPresentationMode]);

  if (!presentationMode) return null;

  // Get children of current frame
  const frameChildren = currentFrame
    ? elements.filter((el) => el.parentId === currentFrame.id && el.visible)
    : [];
  const smartMatches = currentFrame && activeTransition?.interaction.transition === 'smart-animate'
    ? matchSmartAnimateLayers(elements, activeTransition.fromFrameId, currentFrame.id)
    : new Map<string, CanvasElement>();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const transitionAnimation = (() => {
    if (!activeTransition || reducedMotion || activeTransition.interaction.transition === 'instant' || activeTransition.interaction.transition === 'smart-animate') return undefined;
    const interaction = activeTransition.interaction;
    const name = interaction.transition === 'dissolve'
      ? 'figmint-prototype-dissolve'
      : `figmint-prototype-move-${interaction.direction}`;
    return `${name} ${interaction.durationMs}ms ${interaction.easing} both`;
  })();

  const renderChildElement = (el: CanvasElement) => {
    const rawElement = el;
    el = resolveElementTokens(el, tokens);
    // Children already store coordinates local to their frame.
    const relX = el.x;
    const relY = el.y;
    const fillStyle = el.imageFill ? 'transparent' : hexToRgba(el.fill, el.fillOpacity);
    const fillCss: React.CSSProperties = el.imageFill ? { backgroundColor: 'transparent' } : getElementCssFill(el);
    const visibleGradients = getVisibleGradients(el);
    const svgGradients = [...visibleGradients].reverse();
    const strokeStyle = el.strokeWidth > 0 ? hexToRgba(el.stroke, el.strokeOpacity) : 'transparent';
    const strokeDash = el.strokeStyle === 'dashed' ? '6 4' : el.strokeStyle === 'dotted' ? '2 3' : 'none';

    let boxShadowStyle = 'none';
    if (el.shadow) {
      const s = el.shadow;
      boxShadowStyle = `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${hexToRgba(s.color, s.opacity)}`;
    }
    const smartSource = smartMatches.get(rawElement.id);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smartStyle = smartSource && activeTransition && !reducedMotion
      ? {
          '--smart-x': `${smartSource.x - rawElement.x}px`,
          '--smart-y': `${smartSource.y - rawElement.y}px`,
          '--smart-scale-x': String(smartSource.width / Math.max(1, rawElement.width)),
          '--smart-scale-y': String(smartSource.height / Math.max(1, rawElement.height)),
          '--smart-opacity': String(smartSource.opacity),
          animation: `figmint-smart-layer ${activeTransition.interaction.durationMs}ms ${activeTransition.interaction.easing} both`,
        } as React.CSSProperties
      : undefined;

    return (
      <div
        key={el.id}
        data-prototype-hotspot-id={rawElement.id}
        onClick={(event) => {
          const interaction = rawElement.interactions?.find((item) => item.trigger === 'click');
          if (!interaction) return;
          event.stopPropagation();
          executeInteraction(interaction);
        }}
        className={`absolute select-none ${(el.type === 'video' || rawElement.interactions?.length) ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
        style={{
          left: `${relX}px`,
          top: `${relY}px`,
          width: `${el.width}px`,
          height: `${el.height}px`,
          transform: `rotate(${el.rotation || 0}deg)`,
          opacity: el.opacity,
          ...smartStyle,
        }}
      >
        <ImageFillLayer element={el} />
        {(['rectangle', 'frame', 'component', 'instance'].includes(el.type)) && (
          <div
            className="relative w-full h-full"
            style={{
              ...fillCss,
              borderRadius: el.cornerRadius ? `${el.cornerRadius}px` : '0px',
              boxShadow: boxShadowStyle,
            }}
          >
            {el.strokeWidth > 0 && <div style={getCssStrokeOverlayStyle(el, strokeStyle)} />}
          </div>
        )}

        {(['frame', 'component', 'instance'].includes(el.type)) && elements
          .filter((child) => child.parentId === rawElement.id && child.visible)
          .map(renderChildElement)}

        {el.type === 'ellipse' && (
          <div
            className="relative w-full h-full rounded-full"
            style={{
              ...fillCss,
              boxShadow: boxShadowStyle,
            }}
          >
            {el.strokeWidth > 0 && <div style={getCssStrokeOverlayStyle(el, strokeStyle)} />}
          </div>
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

        {(el.type === 'polygon' || el.type === 'diamond') && (
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${el.width} ${el.height}`}>
            <SvgGradientDefs element={el} prefix="presentation" />
            {(() => {
              const points = el.type === 'polygon'
                ? getPolygonPoints(el.width, el.height)
                : getDiamondPoints(el.width, el.height);
              return (
                <>
                  <polygon points={points} fill={fillStyle} stroke="none" />
                  {svgGradients.map((gradient) => (
                    <polygon
                      key={gradient.id}
                      points={points}
                      fill={`url(#${getSvgGradientId('presentation', el.id, gradient.id)})`}
                      opacity={gradient.opacity}
                      stroke="none"
                    />
                  ))}
                  <polygon points={points} fill="none" stroke={strokeStyle} strokeWidth={el.strokeWidth} strokeDasharray={strokeDash} />
                </>
              );
            })()}
          </svg>
        )}

        {el.type === 'image' && (
          <img
            src={el.mediaSrc}
            alt={el.mediaName || el.name}
            draggable={false}
            className="h-full w-full"
            style={{ objectFit: el.objectFit || 'cover', borderRadius: `${el.cornerRadius || 0}px` }}
          />
        )}

        {el.type === 'video' && (
          <video
            src={el.mediaSrc}
            aria-label={el.mediaName || el.name}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full bg-black"
            style={{ objectFit: el.objectFit || 'cover', borderRadius: `${el.cornerRadius || 0}px` }}
          />
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
              WebkitTextStroke: el.strokeWidth > 0 ? `${el.strokeWidth}px ${strokeStyle}` : undefined,
              paintOrder: 'stroke fill',
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
              stroke={el.strokeWidth > 0 ? strokeStyle : fillStyle}
              strokeWidth={Math.max(1, el.strokeWidth)}
              strokeDasharray={strokeDash}
            />
            {el.strokeWidth === 0 && svgGradients.map((gradient) => (
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

        {el.type === 'vector' && el.vectorPath?.length && (
          <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${el.width} ${el.height}`}>
            <path
              d={`${el.vectorPath.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x * el.width} ${point.y * el.height}`).join(' ')}${el.vectorClosed ? ' Z' : ''}`}
              fill={el.vectorClosed ? fillStyle : 'none'}
              stroke={el.strokeWidth > 0 ? strokeStyle : fillStyle}
              strokeWidth={Math.max(1, el.strokeWidth || 2)}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        )}

        {el.type === 'arrow' && (
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${el.width} ${el.height}`}>
            {(() => {
              const color = el.strokeWidth > 0 ? strokeStyle : fillStyle;
              const width = Math.max(2, el.strokeWidth || 3);
              const headSize = Math.max(10, Math.min(24, el.height * 0.45));
              const midY = el.height / 2;
              return (
                <>
                  <line x1="0" y1={midY} x2={Math.max(0, el.width - headSize)} y2={midY} stroke={color} strokeWidth={width} strokeDasharray={strokeDash} />
                  <polygon points={`${Math.max(0, el.width - headSize)},${midY - headSize / 2} ${el.width},${midY} ${Math.max(0, el.width - headSize)},${midY + headSize / 2}`} fill={color} />
                </>
              );
            })()}
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
            key={`${currentFrame.id}-${activeTransition?.nonce || 0}`}
            id={`presentation-frame-${currentFrame.id}`}
            onClick={() => {
              const interaction = currentFrame.interactions?.find((item) => item.trigger === 'click');
              if (interaction) executeInteraction(interaction);
            }}
            className="relative shadow-2xl transition-all duration-300"
            style={{
              width: `${currentFrame.width}px`,
              height: `${currentFrame.height}px`,
              transform: `scale(${Math.min(
                1,
                Math.min(
                  (window.innerWidth * 0.85) / currentFrame.width,
                  (window.innerHeight * 0.8) / currentFrame.height
                )
              )})`,
              transformOrigin: 'center center',
              animation: transitionAnimation,
            }}
          >
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                ...(currentFrame.imageFill ? { backgroundColor: 'transparent' } : getElementCssFill(currentFrame)),
                borderRadius: `${currentFrame.cornerRadius || 0}px`,
              }}
            >
              <ImageFillLayer element={currentFrame} />
              {frameChildren.map(renderChildElement)}
            </div>
            {currentFrame.strokeWidth > 0 && (
              <div
                style={getCssStrokeOverlayStyle(
                  currentFrame,
                  hexToRgba(currentFrame.stroke, currentFrame.strokeOpacity)
                )}
              />
            )}
            {overlayFrameId && (() => {
              const overlay = frames.find((frame) => frame.id === overlayFrameId);
              if (!overlay) return null;
              const children = elements.filter((element) => element.parentId === overlay.id && element.visible);
              return (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/25 p-4" onClick={() => setOverlayFrameId(null)}>
                  <div
                    className="relative overflow-hidden shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      width: `${Math.min(overlay.width, currentFrame.width * 0.9)}px`,
                      height: `${Math.min(overlay.height, currentFrame.height * 0.9)}px`,
                      ...getElementCssFill(overlay),
                      borderRadius: `${overlay.cornerRadius || 0}px`,
                      animation: reducedMotion ? undefined : 'figmint-prototype-dissolve 160ms ease-out both',
                    }}
                  >
                    {children.map(renderChildElement)}
                  </div>
                </div>
              );
            })()}
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
