import React, { useEffect, useRef, useState } from 'react';
import { Check, Pipette } from 'lucide-react';
import {
  clamp,
  HEX_COLOR_PATTERN,
  HsvColor,
  hsvToHex,
  normalizeHexColor,
  rgbToHsv,
  shouldUseDarkForeground,
} from '../utils/color';

interface ColorPickerPopoverProps {
  color: string;
  opacity?: number;
  label?: string;
  onChangeColor: (color: string) => void;
  onChangeOpacity?: (opacity: number) => void;
  onClose: () => void;
}

interface EyeDropperConstructor {
  new (): { open: () => Promise<{ sRGBHex: string }> };
}

const RECENT_COLORS_KEY = 'figmint_recent_colors_v1';
const LIBRARY_COLORS = [
  '#ffffff', '#cbd5e1', '#475569', '#111827', '#795548', '#0891b2',
  '#2563eb', '#7c3aed', '#db2777', '#16a34a', '#f59e0b', '#ef4444',
];

const checkerboardStyle = {
  backgroundColor: '#ffffff',
  backgroundImage:
    'linear-gradient(45deg, #d7d7d7 25%, transparent 25%), linear-gradient(-45deg, #d7d7d7 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d7d7d7 75%), linear-gradient(-45deg, transparent 75%, #d7d7d7 75%)',
  backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
  backgroundSize: '10px 10px',
};

export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  color,
  opacity = 1,
  label = 'Color',
  onChangeColor,
  onChangeOpacity,
  onClose,
}) => {
  const [activeView, setActiveView] = useState<'spectrum' | 'library'>('spectrum');
  const [hexInput, setHexInput] = useState(normalizeHexColor(color).slice(1));
  const [hsv, setHsv] = useState<HsvColor>(() => rgbToHsv(color));
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_COLORS_KEY) || '[]');
      return Array.isArray(saved)
        ? saved.filter((item): item is string => typeof item === 'string' && HEX_COLOR_PATTERN.test(item)).slice(0, 6)
        : [];
    } catch {
      return [];
    }
  });
  const popoverRef = useRef<HTMLDivElement>(null);
  const svFieldRef = useRef<HTMLDivElement>(null);

  const nativeColor = normalizeHexColor(color);
  const pureHueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const shadeColors = [0.96, 0.82, 0.68, 0.54, 0.4, 0.26].map((value) =>
    hsvToHex({ h: hsv.h, s: Math.max(0.24, hsv.s), v: value })
  );

  useEffect(() => {
    const next = rgbToHsv(color);
    setHsv((current) => ({ ...next, h: next.s === 0 ? current.h : next.h }));
    setHexInput(normalizeHexColor(color).slice(1));
  }, [color]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const rememberColor = (nextColor: string) => {
    if (!HEX_COLOR_PATTERN.test(nextColor)) return;
    setRecentColors((current) => {
      const normalized = nextColor.toUpperCase();
      const next = [normalized, ...current.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next));
      } catch {
        // Recent colors remain optional when storage is unavailable.
      }
      return next;
    });
  };

  const commitColor = (nextColor: string, remember = true) => {
    const normalized = normalizeHexColor(nextColor);
    const nextHsv = rgbToHsv(normalized);
    setHexInput(normalized.slice(1));
    setHsv((current) => ({ ...nextHsv, h: nextHsv.s === 0 ? current.h : nextHsv.h }));
    onChangeColor(normalized);
    if (remember) rememberColor(normalized);
  };

  const commitHsv = (next: HsvColor) => {
    const nextColor = hsvToHex(next);
    setHsv(next);
    setHexInput(nextColor.slice(1));
    onChangeColor(nextColor);
  };

  const updateSaturationAndValue = (event: React.PointerEvent<HTMLDivElement>) => {
    const field = svFieldRef.current;
    if (!field) return;
    const bounds = field.getBoundingClientRect();
    commitHsv({
      ...hsv,
      s: clamp((event.clientX - bounds.left) / bounds.width),
      v: 1 - clamp((event.clientY - bounds.top) / bounds.height),
    });
  };

  const handleHexChange = (value: string) => {
    const clean = value.replace('#', '').slice(0, 6).toUpperCase();
    setHexInput(clean);
    if (/^[0-9A-F]{6}$/.test(clean)) commitColor(`#${clean}`);
  };

  const handleEyedropper = async () => {
    const EyeDropper = (window as typeof window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;
    if (!EyeDropper) return;
    try {
      const result = await new EyeDropper().open();
      commitColor(result.sRGBHex);
    } catch {
      // Cancelling the native eyedropper is not an error.
    }
  };

  const eyeDropperAvailable = typeof window !== 'undefined' && 'EyeDropper' in window;

  return (
    <div
      ref={popoverRef}
      id="color-picker-popover"
      className="absolute right-0 top-full z-50 mt-2 w-[calc(88vw-24px)] max-w-[268px] overflow-hidden rounded-xl border border-[#d9dee7] bg-white text-[#272a30] shadow-[0_18px_45px_rgba(15,23,42,0.16),0_3px_9px_rgba(15,23,42,0.08)] select-none"
    >
      <div className="flex items-center justify-between border-b border-[#e7eaf0] px-2.5 py-2">
        <span className="text-[10px] font-semibold text-[#3a3d44]">{label}</span>
        <div className="flex rounded-md bg-[#f0f2f5] p-0.5">
          <button
            type="button"
            onClick={() => setActiveView('spectrum')}
            aria-pressed={activeView === 'spectrum'}
            className={`h-6 min-h-0 rounded px-2 text-[9px] font-semibold transition-colors ${
              activeView === 'spectrum'
                ? 'bg-white text-[#262a31] shadow-sm ring-1 ring-black/5'
                : 'text-[#8a919c] hover:text-[#525963]'
            }`}
          >
            Spectrum
          </button>
          <button
            type="button"
            onClick={() => setActiveView('library')}
            aria-pressed={activeView === 'library'}
            className={`h-6 min-h-0 rounded px-2 text-[9px] font-semibold transition-colors ${
              activeView === 'library'
                ? 'bg-white text-[#262a31] shadow-sm ring-1 ring-black/5'
                : 'text-[#8a919c] hover:text-[#525963]'
            }`}
          >
            Library
          </button>
        </div>
      </div>

      <div className="p-2.5">
        {activeView === 'spectrum' ? (
          <div
            ref={svFieldRef}
            role="slider"
            tabIndex={0}
            aria-label={`${label} saturation and brightness`}
            aria-valuetext={`${Math.round(hsv.s * 100)}% saturation, ${Math.round(hsv.v * 100)}% brightness`}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              updateSaturationAndValue(event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) updateSaturationAndValue(event);
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              rememberColor(`#${hexInput}`);
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 0.1 : 0.02;
              if (event.key === 'ArrowLeft') commitHsv({ ...hsv, s: clamp(hsv.s - step) });
              else if (event.key === 'ArrowRight') commitHsv({ ...hsv, s: clamp(hsv.s + step) });
              else if (event.key === 'ArrowUp') commitHsv({ ...hsv, v: clamp(hsv.v + step) });
              else if (event.key === 'ArrowDown') commitHsv({ ...hsv, v: clamp(hsv.v - step) });
              else return;
              event.preventDefault();
            }}
            className="relative h-[156px] cursor-crosshair overflow-hidden rounded-md border border-[#cfd5de] shadow-inner"
            style={{
              backgroundColor: pureHueColor,
              backgroundImage:
                'linear-gradient(to bottom, transparent, #000000), linear-gradient(to right, #ffffff, transparent)',
            }}
          >
            <span
              className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>
        ) : (
          <div className="rounded-md border border-[#e3e7ed] bg-[#f8f9fb] p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[9px] font-semibold text-[#555b65]">Colors</span>
              <span className="text-[8px] text-[#a0a6b0]">12 presets</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {LIBRARY_COLORS.map((swatch) => {
                const isSelected = swatch.toLowerCase() === nativeColor.toLowerCase();
                return (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => commitColor(swatch)}
                    title={swatch}
                    aria-label={`Use color ${swatch}`}
                    aria-pressed={isSelected}
                    className={`relative flex h-7 w-full items-center justify-center rounded border transition-transform hover:scale-105 ${
                      isSelected ? 'border-[#4f46e5] ring-2 ring-[#4f46e5]/20' : 'border-black/10'
                    }`}
                    style={{ backgroundColor: swatch }}
                  >
                    {isSelected && <Check size={10} className={shouldUseDarkForeground(swatch) ? 'text-[#111827]' : 'text-white'} />}
                  </button>
                );
              })}
            </div>

            <div className="mb-1.5 mt-3 flex items-center justify-between">
              <span className="text-[9px] font-semibold text-[#555b65]">Shades</span>
              <span className="font-mono text-[8px] text-[#a0a6b0]">{Math.round(hsv.h)}°</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {shadeColors.map((shade) => (
                <button
                  key={shade}
                  type="button"
                  onClick={() => commitColor(shade)}
                  className="h-6 w-full rounded border border-black/10 transition-transform hover:scale-105"
                  style={{ backgroundColor: shade }}
                  title={shade}
                  aria-label={`Use shade ${shade}`}
                />
              ))}
            </div>

            {recentColors.length > 0 && (
              <>
                <div className="mb-1.5 mt-3 text-[9px] font-semibold text-[#555b65]">Recent</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {recentColors.map((recentColor) => (
                    <button
                      key={recentColor}
                      type="button"
                      onClick={() => commitColor(recentColor)}
                      className="h-6 w-full rounded border border-black/10 transition-transform hover:scale-105"
                      style={{ backgroundColor: recentColor }}
                      title={recentColor}
                      aria-label={`Use recent color ${recentColor}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-2.5 grid grid-cols-[18px_1fr] items-center gap-x-2 gap-y-2">
          <span className="text-center text-[8px] font-bold text-[#9aa1ab]">H</span>
          <label className="relative h-3.5 overflow-hidden rounded-full border border-black/45 bg-[linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]">
            <span
              className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
              style={{ left: `${(hsv.h / 360) * 100}%` }}
            />
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={hsv.h}
              onChange={(event) => commitHsv({ ...hsv, h: Number(event.target.value) })}
              onPointerUp={() => rememberColor(`#${hexInput}`)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label={`${label} hue`}
            />
          </label>

          <span className="text-center text-[8px] font-bold text-[#9aa1ab]">A</span>
          <label className="relative h-3.5 overflow-hidden rounded-full border border-black/45" style={checkerboardStyle}>
            <span className="absolute inset-0" style={{ background: `linear-gradient(90deg, transparent, ${nativeColor})` }} />
            <span
              className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
              style={{ left: `${opacity * 100}%`, backgroundColor: nativeColor }}
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={opacity}
              onChange={(event) => onChangeOpacity?.(Number(event.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label={`${label} opacity`}
            />
          </label>
        </div>

        <div className="mt-2.5 grid grid-cols-[40px_1fr_52px_32px] overflow-hidden rounded-md border border-[#dfe3ea] bg-[#f7f8fa]">
          <div className="flex items-center justify-center border-r border-[#dfe3ea] text-[8px] font-semibold text-[#7f8792]">Hex</div>
          <label className="flex items-center px-1.5">
            <span className="mr-0.5 text-[9px] text-[#a0a6b0]">#</span>
            <input
              value={hexInput}
              onChange={(event) => handleHexChange(event.target.value)}
              maxLength={6}
              className="w-full bg-transparent py-1.5 font-mono text-[9px] font-semibold uppercase text-[#343840] outline-none"
              aria-label={`${label} hex value`}
            />
          </label>
          <label className="flex items-center border-l border-[#dfe3ea] px-1">
            <input
              type="number"
              min="0"
              max="100"
              value={Math.round(opacity * 100)}
              onChange={(event) => onChangeOpacity?.(clamp(Number(event.target.value), 0, 100) / 100)}
              className="w-full bg-transparent text-right font-mono text-[9px] font-semibold text-[#343840] outline-none"
              aria-label={`${label} opacity percentage`}
            />
            <span className="ml-0.5 text-[8px] text-[#a0a6b0]">%</span>
          </label>
          <button
            type="button"
            onClick={handleEyedropper}
            disabled={!eyeDropperAvailable}
            title={eyeDropperAvailable ? 'Pick color from screen' : 'Eyedropper is not supported in this browser'}
            aria-label="Pick color from screen"
            className="flex min-h-0 items-center justify-center border-l border-[#dfe3ea] text-[#737b87] transition-colors hover:bg-[#eef7ff] hover:text-[#0d99ff] disabled:opacity-25"
          >
            <Pipette size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};
