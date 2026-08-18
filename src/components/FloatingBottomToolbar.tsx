import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MousePointer2,
  Hand,
  Frame,
  Square,
  Circle,
  Triangle,
  Star,
  Hexagon,
  Diamond,
  ArrowRight,
  FileImage,
  Type,
  PenTool,
  ChevronDown,
  Smartphone,
  Laptop,
  Share2,
  Component,
  Undo2,
  Redo2,
  Grid,
  Magnet,
  Ruler,
} from 'lucide-react';
import { useCanvas } from '../context/CanvasContext';
import { DEVICE_PRESETS } from '../data/presets';

type ShapeTool = 'rectangle' | 'ellipse' | 'triangle' | 'polygon' | 'diamond' | 'star';
type ToolbarDropdown = 'move' | 'frame' | 'shape' | 'pen' | 'text';

const LAST_SHAPE_TOOL_KEY = 'figmint_last_shape_tool';
const SHAPE_TOOLS: ShapeTool[] = ['rectangle', 'ellipse', 'triangle', 'polygon', 'diamond', 'star'];
const DROPDOWN_WIDTHS: Record<ToolbarDropdown, number> = {
  move: 176,
  frame: 288,
  shape: 224,
  pen: 176,
  text: 176,
};
const MENU_ITEM_CLASS =
  'group w-full px-3 py-2 text-left flex items-center justify-between text-[#2f343b] hover:bg-[#0d99ff] hover:text-white focus-visible:bg-[#0d99ff] focus-visible:text-white transition-colors cursor-pointer';
const MENU_META_CLASS =
  'text-[10px] text-[#7b8491] font-mono group-hover:text-white group-focus-visible:text-white transition-colors';

const isShapeTool = (tool: string): tool is ShapeTool => SHAPE_TOOLS.includes(tool as ShapeTool);

export const FloatingBottomToolbar: React.FC = () => {
  const {
    activeTool,
    setTool,
    spawnPresetFrame,
    canUndo,
    canRedo,
    undo,
    redo,
    gridVisible,
    setGridVisible,
    snapToGrid,
    setSnapToGrid,
    rulerVisible,
    setRulerVisible,
    setActiveLeftTab,
    importMediaFiles,
  } = useCanvas();

  const [openDropdown, setOpenDropdown] = useState<ToolbarDropdown | null>(null);
  const [lastShapeTool, setLastShapeTool] = useState<ShapeTool>(() => {
    try {
      const savedTool = localStorage.getItem(LAST_SHAPE_TOOL_KEY);
      return savedTool && isShapeTool(savedTool) ? savedTool : 'rectangle';
    } catch {
      return 'rectangle';
    }
  });
  const [dropdownPosition, setDropdownPosition] = useState<{ left: number; bottom: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const moveDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const frameDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const shapeDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const penDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const textDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(target) &&
        !(target instanceof Element && target.closest('[data-toolbar-dropdown]'))
      ) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isShapeTool(activeTool)) {
      setLastShapeTool(activeTool);
      try {
        localStorage.setItem(LAST_SHAPE_TOOL_KEY, activeTool);
      } catch {
        // The toolbar still works when browser storage is unavailable.
      }
    }
  }, [activeTool]);

  useEffect(() => {
    if (!openDropdown) {
      setDropdownPosition(null);
      return;
    }

    const updatePosition = () => {
      const button = {
        move: moveDropdownButtonRef.current,
        frame: frameDropdownButtonRef.current,
        shape: shapeDropdownButtonRef.current,
        pen: penDropdownButtonRef.current,
        text: textDropdownButtonRef.current,
      }[openDropdown];
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const menuWidth = DROPDOWN_WIDTHS[openDropdown];
      setDropdownPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
        bottom: window.innerHeight - rect.top + 8,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [openDropdown]);

  useEffect(() => {
    const handleMediaShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        mediaInputRef.current?.click();
      }
    };
    window.addEventListener('keydown', handleMediaShortcut);
    return () => window.removeEventListener('keydown', handleMediaShortcut);
  }, []);

  const mobilePresets = DEVICE_PRESETS.filter((p) => p.category === 'mobile');
  const desktopPresets = DEVICE_PRESETS.filter((p) => p.category === 'desktop');
  const socialPresets = DEVICE_PRESETS.filter((p) => p.category === 'social');

  const getActiveShapeIcon = () => {
    switch (lastShapeTool) {
      case 'ellipse':
        return <Circle size={17} />;
      case 'triangle':
        return <Triangle size={17} />;
      case 'polygon':
        return <Hexagon size={17} />;
      case 'diamond':
        return <Diamond size={17} />;
      case 'star':
        return <Star size={17} />;
      case 'rectangle':
      default:
        return <Square size={17} />;
    }
  };

  return (
    <div
      ref={toolbarRef}
      id="figma-floating-toolbar"
      onPointerDown={(event) => event.stopPropagation()}
      className="absolute bottom-2 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 select-none max-w-[calc(100%-12px)]"
    >
      <div className="bg-white/95 backdrop-blur-md border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-1 sm:p-1.5 flex items-center gap-0.5 sm:gap-1 max-w-full overflow-x-auto custom-scrollbar">
        {/* 1. Move / Cursor Tool */}
        <div className="relative">
          <div className="flex items-center rounded-xl overflow-hidden">
            <button
              id="tool-move-btn"
              onClick={() => {
                setTool('select');
                setOpenDropdown(null);
              }}
              title="Move (V)"
              className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === 'select'
                  ? 'bg-[#0d99ff] text-white shadow-sm'
                  : 'text-[#444444] hover:bg-[#f1f5f9] hover:text-[#111111]'
              }`}
            >
              <MousePointer2 size={17} />
            </button>
            <button
              ref={moveDropdownButtonRef}
              onClick={() => setOpenDropdown(openDropdown === 'move' ? null : 'move')}
              aria-label="Choose navigation tool"
              aria-expanded={openDropdown === 'move'}
              aria-haspopup="menu"
              className={`p-1 h-full rounded-r-lg hover:bg-black/5 text-[#555555] transition-colors cursor-pointer ${
                activeTool === 'select' ? 'text-white/80 hover:text-white' : ''
              }`}
            >
              <ChevronDown size={12} />
            </button>
          </div>

        </div>

        {/* 2. Frame Tool (# icon) with presets */}
        <div className="relative">
          <div className="flex items-center rounded-xl overflow-hidden">
            <button
              id="tool-frame-btn"
              onClick={() => {
                setTool('frame');
                setOpenDropdown(null);
              }}
              title="Frame Tool (F)"
              className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === 'frame'
                  ? 'bg-[#0d99ff] text-white shadow-sm'
                  : 'text-[#444444] hover:bg-[#f1f5f9] hover:text-[#111111]'
              }`}
            >
              <Frame size={17} />
            </button>
            <button
              ref={frameDropdownButtonRef}
              onClick={() => setOpenDropdown(openDropdown === 'frame' ? null : 'frame')}
              aria-label="Choose frame preset"
              aria-expanded={openDropdown === 'frame'}
              aria-haspopup="menu"
              className="p-1 h-full rounded-r-lg hover:bg-black/5 text-[#555555] hover:text-[#111111] transition-colors cursor-pointer"
            >
              <ChevronDown size={12} />
            </button>
          </div>
        </div>

        {/* 3. Shape Tools (Rectangle / Ellipse / Triangle) */}
        <div className="relative">
          <div className="flex items-center rounded-xl overflow-hidden">
            <button
              id="tool-shape-btn"
              onClick={() => {
                if (isShapeTool(activeTool)) {
                  setTool('select');
                } else {
                  setTool(lastShapeTool);
                }
                setOpenDropdown(null);
              }}
              title="Shape Tool (R)"
              className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                SHAPE_TOOLS.includes(activeTool as ShapeTool)
                  ? 'bg-[#0d99ff] text-white shadow-sm'
                  : 'text-[#444444] hover:bg-[#f1f5f9] hover:text-[#111111]'
              }`}
            >
              {getActiveShapeIcon()}
            </button>
            <button
              ref={shapeDropdownButtonRef}
              onClick={() => setOpenDropdown(openDropdown === 'shape' ? null : 'shape')}
              aria-label="Choose shape tool"
              aria-expanded={openDropdown === 'shape'}
              aria-haspopup="menu"
              className="p-1 h-full rounded-r-lg hover:bg-black/5 text-[#555555] hover:text-[#111111] transition-colors cursor-pointer"
            >
              <ChevronDown size={12} />
            </button>
          </div>
        </div>

        {/* 4. Pen / Vector Tool */}
        <div className="relative">
          <div className="flex items-center rounded-xl overflow-hidden">
            <button
              id="tool-pen-btn"
              onClick={() => {
                setTool(activeTool === 'line' ? 'select' : 'line');
                setOpenDropdown(null);
              }}
              title="Line Tool (L)"
              className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === 'line' || activeTool === 'arrow'
                  ? 'bg-[#0d99ff] text-white shadow-sm'
                  : 'text-[#444444] hover:bg-[#f1f5f9] hover:text-[#111111]'
              }`}
            >
              <PenTool size={17} />
            </button>
            <button
              ref={penDropdownButtonRef}
              onClick={() => setOpenDropdown(openDropdown === 'pen' ? null : 'pen')}
              aria-label="Choose line tool"
              aria-expanded={openDropdown === 'pen'}
              aria-haspopup="menu"
              className={`p-1 h-full rounded-r-lg hover:bg-black/5 text-[#555555] transition-colors cursor-pointer ${
                activeTool === 'line' || activeTool === 'arrow' ? 'text-white/80 hover:text-white' : ''
              }`}
            >
              <ChevronDown size={12} />
            </button>
          </div>
        </div>

        {/* 5. Text Tool */}
        <div className="relative">
          <div className="flex items-center rounded-xl overflow-hidden">
            <button
              id="tool-text-btn"
              onClick={() => {
                setTool(activeTool === 'text' ? 'select' : 'text');
                setOpenDropdown(null);
              }}
              title="Text Tool (T)"
              className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTool === 'text'
                  ? 'bg-[#0d99ff] text-white shadow-sm'
                  : 'text-[#444444] hover:bg-[#f1f5f9] hover:text-[#111111]'
              }`}
            >
              <Type size={17} />
            </button>
            <button
              ref={textDropdownButtonRef}
              onClick={() => setOpenDropdown(openDropdown === 'text' ? null : 'text')}
              aria-label="Choose text tool"
              aria-expanded={openDropdown === 'text'}
              aria-haspopup="menu"
              className={`p-1 h-full rounded-r-lg hover:bg-black/5 text-[#555555] transition-colors cursor-pointer ${
                activeTool === 'text' ? 'text-white/80 hover:text-white' : ''
              }`}
            >
              <ChevronDown size={12} />
            </button>
          </div>
        </div>

        {/* 6. Resources / Actions / Components */}
        <button
          onClick={() => {
            setActiveLeftTab('assets');
          }}
          title="Components & Assets"
          className="p-2 rounded-xl flex items-center justify-center text-[#444444] hover:bg-[#f1f5f9] hover:text-[#111111] transition-all cursor-pointer"
        >
          <Component size={17} />
        </button>

        <div className="h-5 w-[1px] bg-[#e2e8f0] mx-0.5" />

        {/* Undo / Redo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded-lg text-[#555555] hover:bg-[#f1f5f9] hover:text-[#111111] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Undo2 size={15} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="p-1.5 rounded-lg text-[#555555] hover:bg-[#f1f5f9] hover:text-[#111111] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Redo2 size={15} />
        </button>

        <div className="h-5 w-[1px] bg-[#e2e8f0] mx-0.5" />

        {/* Snapping / Grid toggle */}
        <button
          onClick={() => setSnapToGrid(!snapToGrid)}
          title={`Smart Snapping (${snapToGrid ? 'On' : 'Off'})`}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            snapToGrid ? 'text-[#0d99ff] bg-[#0d99ff]/10' : 'text-[#777777] hover:bg-[#f1f5f9]'
          }`}
        >
          <Magnet size={15} />
        </button>
        <button
          onClick={() => setGridVisible(!gridVisible)}
          title={`Dot Grid (${gridVisible ? 'On' : 'Off'})`}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            gridVisible ? 'text-[#0d99ff] bg-[#0d99ff]/10' : 'text-[#777777] hover:bg-[#f1f5f9]'
          }`}
        >
          <Grid size={15} />
        </button>
        <button
          onClick={() => setRulerVisible(!rulerVisible)}
          title={`Rulers (${rulerVisible ? 'On' : 'Off'})`}
          aria-pressed={rulerVisible}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            rulerVisible ? 'text-[#0d99ff] bg-[#0d99ff]/10' : 'text-[#777777] hover:bg-[#f1f5f9]'
          }`}
        >
          <Ruler size={15} />
        </button>
      </div>
      {openDropdown === 'move' && dropdownPosition && createPortal(
        <div
          data-toolbar-dropdown
          role="menu"
          aria-label="Navigation tools"
          className="fixed w-44 max-w-[calc(100vw-16px)] bg-white border border-[#d8dee7] rounded-xl shadow-xl py-1 z-[60] text-xs"
          style={dropdownPosition}
        >
          <button
            role="menuitem"
            onClick={() => {
              setTool('select');
              setOpenDropdown(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <span className="flex items-center gap-2"><MousePointer2 size={14} /><span className="font-medium">Move</span></span>
            <span className={MENU_META_CLASS}>V</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setTool('hand');
              setOpenDropdown(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <span className="flex items-center gap-2"><Hand size={14} /><span className="font-medium">Hand tool</span></span>
            <span className={MENU_META_CLASS}>H</span>
          </button>
        </div>,
        document.body
      )}
      {openDropdown === 'frame' && dropdownPosition && createPortal(
        <div
          data-toolbar-dropdown
          role="menu"
          aria-label="Device presets"
          className="fixed w-72 max-w-[calc(100vw-16px)] bg-white border border-[#e2e8f0] rounded-xl shadow-2xl p-2 z-[60] text-xs overflow-y-auto custom-scrollbar"
          style={{ ...dropdownPosition, maxHeight: 'min(460px, calc(100vh - 80px))' }}
        >
          <div className="px-2 py-1 text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
            Device Presets
          </div>

          <div className="mt-1">
            <div className="px-2 py-1 text-[11px] font-semibold text-[#0d99ff] flex items-center gap-1.5">
              <Smartphone size={13} /> Phones & Mobile
            </div>
            {mobilePresets.map((preset) => (
              <button
                key={preset.id}
                role="menuitem"
                onClick={() => {
                  spawnPresetFrame(preset);
                  setOpenDropdown(null);
                }}
                className={`${MENU_ITEM_CLASS} rounded-lg px-2 py-1.5`}
              >
                <span className="font-medium truncate">{preset.name}</span>
                <span className={`${MENU_META_CLASS} ml-2 flex-shrink-0`}>
                  {preset.width} × {preset.height}
                </span>
              </button>
            ))}
          </div>

          <div className="h-px bg-[#e2e8f0] my-2" />

          <div>
            <div className="px-2 py-1 text-[11px] font-semibold text-[#10b981] flex items-center gap-1.5">
              <Laptop size={13} /> Desktop & OS
            </div>
            {desktopPresets.map((preset) => (
              <button
                key={preset.id}
                role="menuitem"
                onClick={() => {
                  spawnPresetFrame(preset);
                  setOpenDropdown(null);
                }}
                className={`${MENU_ITEM_CLASS} rounded-lg px-2 py-1.5`}
              >
                <span className="font-medium truncate">{preset.name}</span>
                <span className={`${MENU_META_CLASS} ml-2 flex-shrink-0`}>
                  {preset.width} × {preset.height}
                </span>
              </button>
            ))}
          </div>

          <div className="h-px bg-[#e2e8f0] my-2" />

          <div>
            <div className="px-2 py-1 text-[11px] font-semibold text-[#f59e0b] flex items-center gap-1.5">
              <Share2 size={13} /> Aspect Ratios & Social
            </div>
            {socialPresets.map((preset) => (
              <button
                key={preset.id}
                role="menuitem"
                onClick={() => {
                  spawnPresetFrame(preset);
                  setOpenDropdown(null);
                }}
                className={`${MENU_ITEM_CLASS} rounded-lg px-2 py-1.5`}
              >
                <span className="font-medium truncate">{preset.name}</span>
                <span className={`${MENU_META_CLASS} ml-2 flex-shrink-0`}>
                  {preset.width} × {preset.height}
                </span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
      {openDropdown === 'shape' && dropdownPosition && createPortal(
        <div
          data-toolbar-dropdown
          role="menu"
          aria-label="Shape tools"
          className="fixed w-56 max-w-[calc(100vw-16px)] bg-white border border-[#e2e8f0] rounded-xl shadow-xl py-1 z-[60] text-xs text-[#222222]"
          style={dropdownPosition}
        >
          <button
            role="menuitem"
            onClick={() => {
              setTool('rectangle');
              setOpenDropdown(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <div className="flex items-center gap-2">
              <Square size={14} />
              <span className="font-medium">Rectangle</span>
            </div>
            <span className={MENU_META_CLASS}>R</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setTool('ellipse');
              setOpenDropdown(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <div className="flex items-center gap-2">
              <Circle size={14} />
              <span className="font-medium">Ellipse</span>
            </div>
            <span className={MENU_META_CLASS}>O</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setTool('triangle');
              setOpenDropdown(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <div className="flex items-center gap-2">
              <Triangle size={14} />
              <span className="font-medium">Polygon / Triangle</span>
            </div>
            <span className={MENU_META_CLASS}>—</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setTool('polygon');
              setOpenDropdown(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <div className="flex items-center gap-2">
              <Hexagon size={14} />
              <span className="font-medium">Polygon</span>
            </div>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setTool('diamond');
              setOpenDropdown(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <div className="flex items-center gap-2">
              <Diamond size={14} />
              <span className="font-medium">Diamond</span>
            </div>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setTool('star');
              setOpenDropdown(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <div className="flex items-center gap-2">
              <Star size={14} />
              <span className="font-medium">Star</span>
            </div>
          </button>
          <div className="my-1 h-px bg-[#e2e8f0]" />
          <button
            role="menuitem"
            onClick={() => {
              mediaInputRef.current?.click();
              setOpenDropdown(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <div className="flex items-center gap-2">
              <FileImage size={14} />
              <span className="font-medium">Image / video</span>
            </div>
            <span className={MENU_META_CLASS}>Ctrl+Shift+K</span>
          </button>
        </div>,
        document.body
      )}
      {openDropdown === 'pen' && dropdownPosition && createPortal(
        <div
          data-toolbar-dropdown
          role="menu"
          aria-label="Line tools"
          className="fixed w-44 max-w-[calc(100vw-16px)] bg-white border border-[#d8dee7] rounded-xl shadow-xl py-1 z-[60] text-xs"
          style={dropdownPosition}
        >
          <button
            role="menuitem"
            onClick={() => {
              setTool('line');
              setOpenDropdown(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <span className="flex items-center gap-2"><PenTool size={14} /><span className="font-medium">Line / Vector</span></span>
            <span className={MENU_META_CLASS}>L</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setTool('arrow');
              setOpenDropdown(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <span className="flex items-center gap-2"><ArrowRight size={14} /><span className="font-medium">Arrow</span></span>
            <span className={MENU_META_CLASS}>Shift+L</span>
          </button>
        </div>,
        document.body
      )}
      {openDropdown === 'text' && dropdownPosition && createPortal(
        <div
          data-toolbar-dropdown
          role="menu"
          aria-label="Text tools"
          className="fixed w-44 max-w-[calc(100vw-16px)] bg-white border border-[#d8dee7] rounded-xl shadow-xl py-1 z-[60] text-xs"
          style={dropdownPosition}
        >
          <button
            role="menuitem"
            onClick={() => {
              setTool('text');
              setOpenDropdown(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <span className="flex items-center gap-2"><Type size={14} /><span className="font-medium">Text Box</span></span>
            <span className={MENU_META_CLASS}>T</span>
          </button>
        </div>,
        document.body
      )}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          if (files.length > 0) void importMediaFiles(files);
          event.target.value = '';
        }}
      />
    </div>
  );
};
