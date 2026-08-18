import React, { useState, useEffect, useRef } from 'react';
import { Pipette, Check } from 'lucide-react';

interface ColorPickerPopoverProps {
  color: string;
  opacity?: number;
  onChangeColor: (color: string) => void;
  onChangeOpacity?: (opacity: number) => void;
  onClose: () => void;
}

const PALETTE = [
  '#000000', '#1e293b', '#475569', '#94a3b8', '#e2e8f0', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#0d99ff',
  '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#84cc16',
];

export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  color,
  opacity = 1,
  onChangeColor,
  onChangeOpacity,
  onClose,
}) => {
  const [hexInput, setHexInput] = useState(color);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(color);
  }, [color]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleHexChange = (val: string) => {
    let clean = val.trim();
    if (!clean.startsWith('#') && clean.length > 0) {
      clean = '#' + clean;
    }
    setHexInput(clean);
    if (/^#[0-9A-Fa-f]{6}$/.test(clean) || /^#[0-9A-Fa-f]{3}$/.test(clean)) {
      onChangeColor(clean);
    }
  };

  return (
    <div
      ref={popoverRef}
      id="color-picker-popover"
      className="absolute right-0 top-full mt-2 w-64 p-3 bg-white border border-[#e2e8f0] rounded-xl shadow-2xl z-50 text-[#222222] select-none"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#e2e8f0]">
        <span className="text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Color</span>
        <div className="flex items-center gap-1.5">
          <div
            className="w-4 h-4 rounded-full border border-black/10 shadow-xs"
            style={{ backgroundColor: color, opacity }}
          />
          <span className="text-xs font-mono text-gray-700 font-medium">{color.toUpperCase()}</span>
        </div>
      </div>

      {/* Color input trigger & Hex input */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-300 shadow-inner flex-shrink-0">
          <input
            type="color"
            value={color.startsWith('#') && color.length === 7 ? color : '#0d99ff'}
            onChange={(e) => {
              setHexInput(e.target.value);
              onChangeColor(e.target.value);
            }}
            className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0"
          />
          <div
            className="w-full h-full"
            style={{ backgroundColor: color }}
          />
        </div>

        <div className="flex-1 relative">
          <input
            type="text"
            value={hexInput}
            onChange={(e) => handleHexChange(e.target.value)}
            className="w-full bg-[#f8fafc] border border-[#e2e8f0] focus:border-[#0d99ff] focus:bg-white rounded-lg px-2 py-1 text-xs font-mono text-gray-800 outline-none uppercase"
            placeholder="#FFFFFF"
          />
        </div>

        {onChangeOpacity && (
          <div className="w-16 flex items-center bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-1.5 py-1">
            <input
              type="number"
              min="0"
              max="100"
              value={Math.round(opacity * 100)}
              onChange={(e) => onChangeOpacity(Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
              className="w-full bg-transparent text-xs font-mono text-right text-gray-800 outline-none"
            />
            <span className="text-[10px] text-gray-400 ml-0.5">%</span>
          </div>
        )}
      </div>

      {/* Opacity slider */}
      {onChangeOpacity && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>Opacity</span>
            <span className="font-mono">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={(e) => onChangeOpacity(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0d99ff]"
          />
        </div>
      )}

      {/* Preset Swatches Palette */}
      <div>
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Preset Swatches</span>
        <div className="grid grid-cols-6 gap-1.5">
          {PALETTE.map((swatch) => {
            const isSelected = swatch.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={swatch}
                onClick={() => {
                  setHexInput(swatch);
                  onChangeColor(swatch);
                }}
                title={swatch}
                className="w-7 h-7 rounded-md border border-gray-200 hover:scale-110 transition-transform relative flex items-center justify-center cursor-pointer shadow-xs"
                style={{ backgroundColor: swatch }}
              >
                {isSelected && (
                  <Check
                    size={12}
                    className={
                      ['#ffffff', '#e2e8f0', '#84cc16', '#f59e0b', '#86efac'].includes(swatch.toLowerCase())
                        ? 'text-black'
                        : 'text-white'
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
