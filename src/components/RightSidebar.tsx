import React, { useState } from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalSpaceAround,
  AlignHorizontalSpaceAround,
  AlignJustify,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Download,
  Link,
  Unlink,
  RotateCw,
  Droplet,
  Square,
  X,
} from 'lucide-react';
import { useCanvas } from '../context/CanvasContext';
import { CanvasElement, ShapeType } from '../types/figma';
import { ColorPickerPopover } from './ColorPickerPopover';

interface RightSidebarProps {
  onOpenShortcuts: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ onOpenShortcuts, isOpen, onClose }) => {
  const {
    elements,
    selectedIds,
    updateElement,
    alignSelected,
    exportSelected,
  } = useCanvas();

  const [activeColorPicker, setActiveColorPicker] = useState<'fill' | 'stroke' | 'shadow' | null>(null);
  const [aspectLocked, setAspectLocked] = useState(false);
  const [isStrokeOpen, setIsStrokeOpen] = useState(true);
  const [isEffectsOpen, setIsEffectsOpen] = useState(true);
  const [isExportOpen, setIsExportOpen] = useState(true);

  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));
  const primaryElement = selectedElements[0] as CanvasElement | undefined;

  if (!primaryElement) {
    return (
      <aside
        id="figma-right-sidebar"
        className={`absolute inset-y-0 right-0 w-[min(288px,88vw)] bg-white border-l border-[#e6e6e6] flex-col h-full text-[#333333] z-30 select-none shadow-xl xl:shadow-none xl:relative xl:w-72 xl:flex-none ${isOpen ? 'flex' : 'hidden xl:flex'}`}
      >
        <div className="p-3 border-b border-[#e6e6e6] flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">Document</span>
          <button onClick={onClose} aria-label="Close properties panel" className="p-1 rounded-md hover:bg-gray-100 xl:hidden">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400">
          <div className="w-10 h-10 rounded-2xl bg-[#f5f5f5] flex items-center justify-center mb-2 text-gray-400">
            <Square size={20} />
          </div>
          <p className="text-xs font-semibold text-gray-700 mb-0.5">Nothing selected</p>
          <p className="text-[11px] text-gray-400">
            Select an element on canvas to edit its properties
          </p>
        </div>
        {/* Help button */}
        <div className="p-3 flex justify-end">
          <button
            onClick={onOpenShortcuts}
            title="Keyboard shortcuts & help"
            className="w-7 h-7 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-gray-600 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer border border-[#e2e8f0]"
          >
            ?
          </button>
        </div>
      </aside>
    );
  }

  const isShape = ['rectangle', 'frame'].includes(primaryElement.type);

  const handleUpdate = (changes: Partial<CanvasElement>) => {
    updateElement(primaryElement.id, changes);
  };

  const getTypeName = (type: ShapeType) => {
    switch (type) {
      case 'frame':
        return 'Frame';
      case 'rectangle':
        return 'Rectangle';
      case 'ellipse':
        return 'Ellipse';
      case 'triangle':
        return 'Polygon';
      case 'text':
        return 'Text';
      case 'line':
        return 'Line';
      default:
        return 'Layer';
    }
  };

  return (
    <aside
      id="figma-right-sidebar"
      className={`absolute inset-y-0 right-0 w-[min(288px,88vw)] bg-white border-l border-[#e6e6e6] flex-col h-full text-[#333333] z-30 select-none custom-scrollbar overflow-y-auto shadow-xl xl:shadow-none xl:relative xl:w-72 xl:flex-none ${isOpen ? 'flex' : 'hidden xl:flex'}`}
    >
      {/* 1. Header Toolbar */}
      <div className="p-2.5 border-b border-[#e6e6e6] flex items-center justify-between bg-white sticky top-0 z-20">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-800">
            <span>{getTypeName(primaryElement.type)}</span>
          </div>
        </div>

        <button onClick={onClose} aria-label="Close properties panel" className="p-1 rounded-md hover:bg-gray-100 xl:hidden">
          <X size={16} />
        </button>
      </div>

      <div className="p-3 space-y-4 text-xs">
        {/* 2. Position Section */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
            Position
          </div>

          {/* Alignment buttons toolbar (6 icons) */}
          <div className="flex items-center justify-between bg-[#f8fafc] p-1 rounded-lg border border-[#e2e8f0]">
            <button
              onClick={() => alignSelected('left')}
              title="Align Left"
              className="p-1 rounded hover:bg-white text-gray-600 hover:text-black transition-colors cursor-pointer"
            >
              <AlignLeft size={14} />
            </button>
            <button
              onClick={() => alignSelected('center')}
              title="Align Horizontal Center"
              className="p-1 rounded hover:bg-white text-gray-600 hover:text-black transition-colors cursor-pointer"
            >
              <AlignCenter size={14} />
            </button>
            <button
              onClick={() => alignSelected('right')}
              title="Align Right"
              className="p-1 rounded hover:bg-white text-gray-600 hover:text-black transition-colors cursor-pointer"
            >
              <AlignRight size={14} />
            </button>
            <button
              onClick={() => alignSelected('top')}
              title="Align Top"
              className="p-1 rounded hover:bg-white text-gray-600 hover:text-black transition-colors cursor-pointer"
            >
              <AlignVerticalSpaceAround size={14} />
            </button>
            <button
              onClick={() => alignSelected('middle')}
              title="Align Vertical Center"
              className="p-1 rounded hover:bg-white text-gray-600 hover:text-black transition-colors cursor-pointer"
            >
              <AlignJustify size={14} />
            </button>
            <button
              onClick={() => alignSelected('bottom')}
              title="Align Bottom"
              className="p-1 rounded hover:bg-white text-gray-600 hover:text-black transition-colors cursor-pointer"
            >
              <AlignHorizontalSpaceAround size={14} />
            </button>
          </div>

          {/* X and Y coordinates */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center bg-[#f8fafc] border border-[#e2e8f0] focus-within:border-[#0d99ff] focus-within:bg-white rounded-lg px-2 py-1">
              <span className="text-gray-400 font-mono text-[11px] mr-1.5 select-none">X</span>
              <input
                aria-label="X position"
                type="number"
                value={Math.round(primaryElement.x)}
                onChange={(e) => handleUpdate({ x: Number(e.target.value) })}
                className="w-full bg-transparent text-xs font-mono text-gray-800 outline-none"
              />
            </div>

            <div className="flex items-center bg-[#f8fafc] border border-[#e2e8f0] focus-within:border-[#0d99ff] focus-within:bg-white rounded-lg px-2 py-1">
              <span className="text-gray-400 font-mono text-[11px] mr-1.5 select-none">Y</span>
              <input
                aria-label="Y position"
                type="number"
                value={Math.round(primaryElement.y)}
                onChange={(e) => handleUpdate({ y: Number(e.target.value) })}
                className="w-full bg-transparent text-xs font-mono text-gray-800 outline-none"
              />
            </div>
          </div>

          {/* Rotation & Flip Controls */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center bg-[#f8fafc] border border-[#e2e8f0] focus-within:border-[#0d99ff] focus-within:bg-white rounded-lg px-2 py-1">
              <span className="text-gray-400 font-mono text-[11px] mr-1.5 select-none">∠</span>
              <input
                aria-label="Rotation"
                type="number"
                value={Math.round(primaryElement.rotation || 0)}
                onChange={(e) => handleUpdate({ rotation: Number(e.target.value) % 360 })}
                className="w-full bg-transparent text-xs font-mono text-gray-800 outline-none"
              />
              <span className="text-gray-400 text-[10px]">°</span>
            </div>

            <div className="flex items-center justify-around bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-1 py-0.5">
              <button
                onClick={() => handleUpdate({ rotation: ((primaryElement.rotation || 0) + 90) % 360 })}
                title="Rotate 90°"
                className="p-1 rounded hover:bg-white text-gray-600 transition-colors cursor-pointer"
              >
                <RotateCw size={13} />
              </button>
              <button
                onClick={() => handleUpdate({ rotation: ((primaryElement.rotation || 0) + 180) % 360 })}
                title="Rotate 180°"
                className="p-1 rounded hover:bg-white text-gray-600 transition-colors cursor-pointer font-bold text-xs"
              >
                ⇋
              </button>
            </div>
          </div>
        </div>

        <div className="h-[1px] bg-[#e6e6e6]" />

        {/* 3. Layout Section */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
            Layout
          </div>

          {/* Width & Height with aspect ratio lock */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center bg-[#f8fafc] border border-[#e2e8f0] focus-within:border-[#0d99ff] focus-within:bg-white rounded-lg px-2 py-1">
              <span className="text-gray-400 font-mono text-[11px] mr-1.5 select-none">W</span>
              <input
                aria-label="Width"
                type="number"
                min="1"
                value={Math.round(primaryElement.width)}
                onChange={(e) => {
                  const newW = Math.max(1, Number(e.target.value));
                  if (aspectLocked && primaryElement.width > 0) {
                    const ratio = primaryElement.height / primaryElement.width;
                    handleUpdate({ width: newW, height: Math.round(newW * ratio) });
                  } else {
                    handleUpdate({ width: newW });
                  }
                }}
                className="w-full bg-transparent text-xs font-mono text-gray-800 outline-none"
              />
            </div>

            <button
              onClick={() => setAspectLocked(!aspectLocked)}
              title={aspectLocked ? 'Constrain proportions (locked)' : 'Constrain proportions (unlocked)'}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                aspectLocked
                  ? 'bg-[#0d99ff]/10 border-[#0d99ff] text-[#0d99ff]'
                  : 'bg-[#f8fafc] border-[#e2e8f0] text-gray-400 hover:text-gray-700'
              }`}
            >
              {aspectLocked ? <Link size={13} /> : <Unlink size={13} />}
            </button>

            <div className="flex-1 flex items-center bg-[#f8fafc] border border-[#e2e8f0] focus-within:border-[#0d99ff] focus-within:bg-white rounded-lg px-2 py-1">
              <span className="text-gray-400 font-mono text-[11px] mr-1.5 select-none">H</span>
              <input
                aria-label="Height"
                type="number"
                min="1"
                value={Math.round(primaryElement.height)}
                onChange={(e) => {
                  const newH = Math.max(1, Number(e.target.value));
                  if (aspectLocked && primaryElement.height > 0) {
                    const ratio = primaryElement.width / primaryElement.height;
                    handleUpdate({ height: newH, width: Math.round(newH * ratio) });
                  } else {
                    handleUpdate({ height: newH });
                  }
                }}
                className="w-full bg-transparent text-xs font-mono text-gray-800 outline-none"
              />
            </div>
          </div>

          {/* Frame-specific: Clip content checkbox */}
          {primaryElement.type === 'frame' && (
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={primaryElement.clipContent || false}
                onChange={(e) => handleUpdate({ clipContent: e.target.checked })}
                className="rounded text-[#0d99ff] focus:ring-[#0d99ff] accent-[#0d99ff]"
              />
              <span className="font-medium">Clip content</span>
            </label>
          )}
        </div>

        <div className="h-[1px] bg-[#e6e6e6]" />

        {/* 4. Appearance Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
              Appearance
            </span>
            <div className="flex items-center gap-1 text-gray-400">
              <Droplet size={13} />
            </div>
          </div>

          {/* Opacity & Corner Radius */}
          <div className="grid grid-cols-2 gap-2">
            {/* Opacity */}
            <div className="flex items-center bg-[#f8fafc] border border-[#e2e8f0] focus-within:border-[#0d99ff] focus-within:bg-white rounded-lg px-2 py-1">
              <input
                aria-label="Layer opacity"
                type="number"
                min="0"
                max="100"
                value={Math.round((primaryElement.opacity !== undefined ? primaryElement.opacity : 1) * 100)}
                onChange={(e) => handleUpdate({ opacity: Math.max(0, Math.min(100, Number(e.target.value))) / 100 })}
                className="w-full bg-transparent text-xs font-mono text-gray-800 outline-none"
              />
              <span className="text-gray-400 text-[10px]">%</span>
            </div>

            {/* Corner Radius */}
            {isShape ? (
              <div className="flex items-center bg-[#f8fafc] border border-[#e2e8f0] focus-within:border-[#0d99ff] focus-within:bg-white rounded-lg px-2 py-1">
                <span className="text-gray-400 font-mono text-[10px] mr-1.5 select-none">⌒</span>
                <input
                  aria-label="Corner radius"
                  type="number"
                  min="0"
                  value={primaryElement.cornerRadius || 0}
                  onChange={(e) => handleUpdate({ cornerRadius: Math.max(0, Number(e.target.value)) })}
                  className="w-full bg-transparent text-xs font-mono text-gray-800 outline-none"
                />
              </div>
            ) : (
              <div />
            )}
          </div>

        </div>

        <div className="h-[1px] bg-[#e6e6e6]" />

        {/* 5. Fill Section */}
        <div className="space-y-2 relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
              Fill
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveColorPicker(activeColorPicker === 'fill' ? null : 'fill')}
                aria-label="Open fill color picker"
                className="w-5 h-5 rounded hover:bg-[#f1f5f9] flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Fill Row */}
          <div className="flex items-center gap-2 bg-[#f8fafc] p-1.5 rounded-lg border border-[#e2e8f0]">
            {/* Swatch */}
            <button
              onClick={() => setActiveColorPicker(activeColorPicker === 'fill' ? null : 'fill')}
              aria-label="Edit fill color"
              className="w-6 h-6 rounded-md border border-black/15 shadow-xs flex-shrink-0 cursor-pointer"
              style={{ backgroundColor: primaryElement.fill, opacity: primaryElement.fillOpacity }}
            />

            {/* Hex Input */}
            <input
              aria-label="Fill color hex"
              type="text"
              value={primaryElement.fill.toUpperCase().replace('#', '')}
              onChange={(e) => {
                const hex = e.target.value.replace('#', '');
                if (hex.length <= 6) {
                  handleUpdate({ fill: `#${hex}` });
                }
              }}
              className="w-20 bg-transparent text-xs font-mono font-medium text-gray-800 outline-none uppercase"
            />

            {/* Opacity */}
            <div className="flex items-center ml-auto">
              <input
                aria-label="Fill opacity"
                type="number"
                min="0"
                max="100"
                value={Math.round(primaryElement.fillOpacity * 100)}
                onChange={(e) => handleUpdate({ fillOpacity: Math.max(0, Math.min(100, Number(e.target.value))) / 100 })}
                className="w-10 bg-transparent text-xs font-mono text-right text-gray-800 outline-none"
              />
              <span className="text-gray-400 text-[10px] ml-0.5">%</span>
            </div>

            {/* Visibility toggle */}
            <button
              onClick={() => handleUpdate({ fillOpacity: primaryElement.fillOpacity === 0 ? 1 : 0 })}
              aria-label={primaryElement.fillOpacity === 0 ? 'Show fill' : 'Hide fill'}
              className="text-gray-400 hover:text-gray-700 p-0.5"
            >
              {primaryElement.fillOpacity === 0 ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>

          {/* Fill Popover */}
          {activeColorPicker === 'fill' && (
            <ColorPickerPopover
              color={primaryElement.fill}
              opacity={primaryElement.fillOpacity}
              onChangeColor={(fill) => handleUpdate({ fill })}
              onChangeOpacity={(fillOpacity) => handleUpdate({ fillOpacity })}
              onClose={() => setActiveColorPicker(null)}
            />
          )}
        </div>

        <div className="h-[1px] bg-[#e6e6e6]" />

        {/* 6. Stroke Section (Collapsible) */}
        <div className="space-y-2 relative">
          <div
            onClick={() => setIsStrokeOpen(!isStrokeOpen)}
            className="flex items-center justify-between cursor-pointer group"
          >
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider group-hover:text-black">
              Stroke
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUpdate({ strokeWidth: (primaryElement.strokeWidth || 0) + 1 });
              }}
              className="w-5 h-5 rounded hover:bg-[#f1f5f9] flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
              aria-label="Increase stroke width"
            >
              <Plus size={13} />
            </button>
          </div>

          {isStrokeOpen && (
            <div className="flex items-center gap-2 bg-[#f8fafc] p-1.5 rounded-lg border border-[#e2e8f0]">
              <button
                onClick={() => setActiveColorPicker(activeColorPicker === 'stroke' ? null : 'stroke')}
                aria-label="Edit stroke color"
                className="w-6 h-6 rounded-md border border-black/15 shadow-xs flex-shrink-0 cursor-pointer"
                style={{ backgroundColor: primaryElement.stroke, opacity: primaryElement.strokeOpacity }}
              />

              <input
                aria-label="Stroke color hex"
                type="text"
                value={primaryElement.stroke.toUpperCase().replace('#', '')}
                onChange={(e) => {
                  const hex = e.target.value.replace('#', '');
                  if (hex.length <= 6) {
                    handleUpdate({ stroke: `#${hex}` });
                  }
                }}
                className="w-20 bg-transparent text-xs font-mono font-medium text-gray-800 outline-none uppercase"
              />

              <div className="flex items-center ml-auto">
                <span className="text-gray-400 text-[10px] mr-1 font-mono">W:</span>
                <input
                  aria-label="Stroke width"
                  type="number"
                  min="0"
                  max="40"
                  value={primaryElement.strokeWidth}
                  onChange={(e) => handleUpdate({ strokeWidth: Math.max(0, Number(e.target.value)) })}
                  className="w-8 bg-transparent text-xs font-mono text-right text-gray-800 outline-none"
                />
              </div>
            </div>
          )}

          {activeColorPicker === 'stroke' && (
            <ColorPickerPopover
              color={primaryElement.stroke}
              opacity={primaryElement.strokeOpacity}
              onChangeColor={(stroke) => handleUpdate({ stroke })}
              onChangeOpacity={(strokeOpacity) => handleUpdate({ strokeOpacity })}
              onClose={() => setActiveColorPicker(null)}
            />
          )}
        </div>

        <div className="h-[1px] bg-[#e6e6e6]" />

        {/* 7. Effects Section (Drop Shadow / Blur) */}
        <div className="space-y-2">
          <div
            onClick={() => setIsEffectsOpen(!isEffectsOpen)}
            className="flex items-center justify-between cursor-pointer group"
          >
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider group-hover:text-black">
              Effects
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!primaryElement.shadow) {
                  handleUpdate({
                    shadow: { x: 0, y: 10, blur: 20, spread: 0, color: '#000000', opacity: 0.15 },
                  });
                }
              }}
              className="w-5 h-5 rounded hover:bg-[#f1f5f9] flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
              aria-label="Add drop shadow"
            >
              <Plus size={13} />
            </button>
          </div>

          {isEffectsOpen && primaryElement.shadow && (
            <div className="p-2 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">Drop Shadow</span>
                <button
                  onClick={() => handleUpdate({ shadow: undefined })}
                  aria-label="Remove drop shadow"
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <div>
                  <span className="text-gray-400 font-mono">X</span>
                  <input
                    aria-label="Shadow X offset"
                    type="number"
                    value={primaryElement.shadow.x}
                    onChange={(e) => handleUpdate({ shadow: { ...primaryElement.shadow!, x: Number(e.target.value) } })}
                    className="w-full bg-white border border-[#e2e8f0] rounded text-center py-0.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-gray-400 font-mono">Y</span>
                  <input
                    aria-label="Shadow Y offset"
                    type="number"
                    value={primaryElement.shadow.y}
                    onChange={(e) => handleUpdate({ shadow: { ...primaryElement.shadow!, y: Number(e.target.value) } })}
                    className="w-full bg-white border border-[#e2e8f0] rounded text-center py-0.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-gray-400 font-mono">Blur</span>
                  <input
                    aria-label="Shadow blur"
                    type="number"
                    min="0"
                    value={primaryElement.shadow.blur}
                    onChange={(e) => handleUpdate({ shadow: { ...primaryElement.shadow!, blur: Number(e.target.value) } })}
                    className="w-full bg-white border border-[#e2e8f0] rounded text-center py-0.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-gray-400 font-mono">Spread</span>
                  <input
                    aria-label="Shadow spread"
                    type="number"
                    value={primaryElement.shadow.spread}
                    onChange={(e) => handleUpdate({ shadow: { ...primaryElement.shadow!, spread: Number(e.target.value) } })}
                    className="w-full bg-white border border-[#e2e8f0] rounded text-center py-0.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-[1px] bg-[#e6e6e6]" />

        {/* 8. Export Section */}
        <div className="space-y-2">
          <div
            onClick={() => setIsExportOpen(!isExportOpen)}
            className="flex items-center justify-between cursor-pointer group"
          >
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider group-hover:text-black">
              Export
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                exportSelected('png', 2);
              }}
              className="w-5 h-5 rounded hover:bg-[#f1f5f9] flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
              aria-label="Quick export PNG"
            >
              <Plus size={13} />
            </button>
          </div>

          {isExportOpen && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                onClick={() => exportSelected('png', 2)}
                className="flex-1 py-1.5 px-2 bg-[#f8fafc] hover:bg-[#0d99ff] hover:text-white border border-[#e2e8f0] rounded-lg font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Download size={12} />
                <span>PNG (2x)</span>
              </button>
              <button
                onClick={() => exportSelected('svg')}
                className="flex-1 py-1.5 px-2 bg-[#f8fafc] hover:bg-[#0d99ff] hover:text-white border border-[#e2e8f0] rounded-lg font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Download size={12} />
                <span>SVG</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Help Button */}
      <div className="mt-auto p-3 flex justify-end">
        <button
          onClick={onOpenShortcuts}
          title="Keyboard shortcuts & help"
          className="w-7 h-7 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-gray-600 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer border border-[#e2e8f0] shadow-xs"
        >
          ?
        </button>
      </div>
    </aside>
  );
};
