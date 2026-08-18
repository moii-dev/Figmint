import React, { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';

interface ColorPickerPopoverProps {
  color: string;
  opacity?: number;
  label?: string;
  onChangeColor: (color: string) => void;
  onChangeOpacity?: (opacity: number) => void;
  onClose: () => void;
}

const RECENT_COLORS_KEY = 'figmint_recent_colors_v1';
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const PALETTE = [
  '#111827', '#334155', '#64748b', '#cbd5e1', '#f8fafc', '#ffffff',
  '#ff4d6d', '#ff7a45', '#f5b942', '#22c55e', '#14b8a6', '#0d99ff',
  '#4f6df5', '#7c5cff', '#a855f7', '#e447c5', '#ec4899', '#84cc16',
];

const checkerboardStyle = {
  backgroundColor: '#ffffff',
  backgroundImage:
    'linear-gradient(45deg, #d8dee8 25%, transparent 25%), linear-gradient(-45deg, #d8dee8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d8dee8 75%), linear-gradient(-45deg, transparent 75%, #d8dee8 75%)',
  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
  backgroundSize: '12px 12px',
};

const getNativeColor = (color: string) => HEX_COLOR_PATTERN.test(color) ? color : '#0d99ff';

const shouldUseDarkCheck = (color: string) => {
  const hex = color.replace('#', '');
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 170;
};

export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  color,
  opacity = 1,
  label = 'Color',
  onChangeColor,
  onChangeOpacity,
  onClose,
}) => {
  const [hexInput, setHexInput] = useState(color.toUpperCase());
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_COLORS_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string').slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(color.toUpperCase());
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
      const next = [nextColor.toUpperCase(), ...current.filter((item) => item.toLowerCase() !== nextColor.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next));
      } catch {
        // Recent colors are optional when browser storage is unavailable.
      }
      return next;
    });
  };

  const commitColor = (nextColor: string) => {
    setHexInput(nextColor.toUpperCase());
    onChangeColor(nextColor);
    rememberColor(nextColor);
  };

  const handleHexChange = (value: string) => {
    const clean = `#${value.replace('#', '').slice(0, 6)}`.toUpperCase();
    setHexInput(clean);
    if (HEX_COLOR_PATTERN.test(clean)) {
      onChangeColor(clean);
      rememberColor(clean);
    }
  };

  return (
    <div
      ref={popoverRef}
      id="color-picker-popover"
      className="absolute right-0 top-full mt-2 w-[calc(88vw-24px)] max-w-[272px] overflow-hidden rounded-2xl border border-[#dfe4ec] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18),0_2px_8px_rgba(15,23,42,0.08)] z-50 text-[#202124] select-none"
    >
      <div className="flex items-center justify-between border-b border-[#edf0f4] px-3.5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#eef7ff] text-[#0d99ff]">
            <Palette size={14} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#25272b]">{label}</div>
            <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#9aa1ad]">Solid paint</div>
          </div>
        </div>
        <div className="font-mono text-[10px] font-semibold text-[#68707d]">{Math.round(opacity * 100)}%</div>
      </div>

      <div className="p-3.5">
        <label
          className="group relative mb-3 block h-16 cursor-pointer overflow-hidden rounded-xl border border-black/10 shadow-inner"
          style={checkerboardStyle}
          title="Open system color picker"
        >
          <span
            className="absolute inset-0 transition-transform duration-200 group-hover:scale-[1.02]"
            style={{ backgroundColor: getNativeColor(color), opacity }}
          />
          <span className="absolute bottom-2 left-2 rounded-md bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
            Click to choose
          </span>
          <input
            type="color"
            value={getNativeColor(color)}
            onChange={(event) => commitColor(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label} system color picker`}
          />
        </label>

        <div className="mb-3 grid grid-cols-[1fr_72px] gap-2">
          <label className="rounded-lg border border-[#e2e7ee] bg-[#f7f8fa] px-2 py-1.5 focus-within:border-[#0d99ff] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0d99ff]/10">
            <span className="block text-[8px] font-bold uppercase tracking-[0.13em] text-[#9aa1ad]">Hex</span>
            <input
              type="text"
              value={hexInput.replace('#', '')}
              onChange={(event) => handleHexChange(event.target.value)}
              className="mt-0.5 w-full bg-transparent font-mono text-[11px] font-semibold uppercase text-[#30343a] outline-none"
              placeholder="FFFFFF"
              maxLength={6}
              aria-label={`${label} hex value`}
            />
          </label>

          {onChangeOpacity && (
            <label className="rounded-lg border border-[#e2e7ee] bg-[#f7f8fa] px-2 py-1.5 focus-within:border-[#0d99ff] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0d99ff]/10">
              <span className="block text-[8px] font-bold uppercase tracking-[0.13em] text-[#9aa1ad]">Alpha</span>
              <span className="mt-0.5 flex items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(opacity * 100)}
                  onChange={(event) => onChangeOpacity(Math.max(0, Math.min(100, Number(event.target.value))) / 100)}
                  className="w-full bg-transparent text-right font-mono text-[11px] font-semibold text-[#30343a] outline-none"
                  aria-label={`${label} opacity`}
                />
                <span className="ml-0.5 text-[9px] text-[#9aa1ad]">%</span>
              </span>
            </label>
          )}
        </div>

        {onChangeOpacity && (
          <div className="mb-3 rounded-xl border border-[#edf0f4] bg-[#fafbfc] px-2.5 py-2">
            <div className="mb-1.5 flex items-center justify-between text-[9px] font-semibold text-[#7b8492]">
              <span>Transparency</span>
              <span className="font-mono">{Math.round(opacity * 100)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={opacity}
              onChange={(event) => onChangeOpacity(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#0d99ff]"
              style={{ background: `linear-gradient(90deg, transparent, ${getNativeColor(color)})` }}
              aria-label={`${label} transparency slider`}
            />
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#8d95a2]">Color library</span>
            <span className="text-[9px] text-[#b0b6c0]">18 presets</span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {PALETTE.map((swatch) => {
              const isSelected = swatch.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => commitColor(swatch)}
                  title={swatch}
                  aria-label={`Use color ${swatch}`}
                  aria-pressed={isSelected}
                  className={`relative flex h-7 w-full items-center justify-center rounded-md border transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    isSelected ? 'border-[#0d99ff] ring-2 ring-[#0d99ff]/20' : 'border-black/10'
                  }`}
                  style={{ backgroundColor: swatch }}
                >
                  {isSelected && <Check size={11} className={shouldUseDarkCheck(swatch) ? 'text-[#111827]' : 'text-white'} />}
                </button>
              );
            })}
          </div>
        </div>

        {recentColors.length > 0 && (
          <div className="mt-3 border-t border-[#edf0f4] pt-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#8d95a2]">Recent</span>
              <div className="flex gap-1.5">
                {recentColors.map((recentColor) => (
                  <button
                    key={recentColor}
                    type="button"
                    onClick={() => commitColor(recentColor)}
                    className="h-5 w-5 rounded-full border border-black/10 shadow-sm transition-transform hover:scale-110"
                    style={{ backgroundColor: recentColor }}
                    title={recentColor}
                    aria-label={`Use recent color ${recentColor}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
