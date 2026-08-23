import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Play,
  Download,
  FileJson,
  RotateCcw,
  HelpCircle,
  FolderOpen,
  Check,
  PanelLeft,
  PanelRight,
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  AlertTriangle,
  Github,
  Info,
  ExternalLink,
  X,
} from 'lucide-react';
import { useCanvas } from '../context/CanvasContext';
import { FigmintLogo } from './FigmintLogo';

interface NavbarProps {
  onOpenShortcuts: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenShortcuts, isInspectorOpen, onToggleInspector }) => {
  const {
    currentProject,
    setDocumentName,
    openDashboard,
    zoom,
    setZoom,
    zoomReset,
    zoomToFit,
    setPresentationMode,
    isLeftSidebarOpen,
    setIsLeftSidebarOpen,
    exportAll,
    importJson,
    resetCanvas,
    saveStatus,
    saveError,
    saveWarning,
  } = useCanvas();

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(currentProject?.title || 'Untitled');
  const [isMainMenuOpen, setIsMainMenuOpen] = useState(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  useEffect(() => {
    if (currentProject) {
      setTempName(currentProject.title);
    }
  }, [currentProject?.title]);

  useEffect(() => {
    if (!isAboutOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAboutOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isAboutOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const mainMenuRef = useRef<HTMLDivElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(e.target as Node)) {
        setIsZoomMenuOpen(false);
      }
      if (mainMenuRef.current && !mainMenuRef.current.contains(e.target as Node)) {
        setIsMainMenuOpen(false);
      }
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        importJson(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
    <header
      id="figma-navbar"
      className="h-11 flex-none bg-white border-b border-[#e6e6e6] flex items-center justify-between px-2 sm:px-3 text-[#333333] z-40 select-none gap-1"
    >
      {/* Left: Home / Back to Files + Figma Logo + Document Title ▾ + Sidebar Toggle */}
      <div className="flex items-center gap-1 min-w-0">
        {/* Back to Home / Dashboard Button */}
        <button
          onClick={openDashboard}
          title="Back to Files (Home Dashboard)"
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#f8fafc] hover:bg-[#e2e8f0] text-gray-700 font-semibold text-xs border border-[#e2e8f0] transition-colors cursor-pointer mr-0.5"
        >
          <ArrowLeft size={13} />
          <span className="hidden sm:inline">Files</span>
        </button>

        {/* Figmint brand and main menu */}
        <div className="relative" ref={mainMenuRef}>
          <button
            onClick={() => setIsMainMenuOpen(!isMainMenuOpen)}
            title="Main Menu"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f1f5f9] transition-colors cursor-pointer"
          >
            <FigmintLogo size={20} />
          </button>

          {/* Main Menu Dropdown */}
          {isMainMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-[#e2e8f0] rounded-xl shadow-2xl py-1.5 z-50 text-xs text-[#222222]">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                File & Actions
              </div>

              <button
                onClick={() => {
                  openDashboard();
                  setIsMainMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                <FolderOpen size={14} />
                <span>Back to Files / Dashboard</span>
              </button>

              <button
                onClick={() => {
                  resetCanvas();
                  setIsMainMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Reset to Sample Frame</span>
              </button>

              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setIsMainMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                <FolderOpen size={14} />
                <span>Import JSON Design...</span>
              </button>

              <div className="h-[1px] bg-[#e2e8f0] my-1" />

              <button
                onClick={() => {
                  exportAll('png', 2);
                  setIsMainMenuOpen(false);
                }}
                className="group w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Download size={14} /> Export PNG (2x)
                </span>
                <span className="text-[10px] text-gray-400 group-hover:text-white font-mono transition-colors">PNG</span>
              </button>

              <button
                onClick={() => {
                  exportAll('svg');
                  setIsMainMenuOpen(false);
                }}
                className="group w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Download size={14} /> Export SVG
                </span>
                <span className="text-[10px] text-gray-400 group-hover:text-white font-mono transition-colors">SVG</span>
              </button>

              <button
                onClick={() => {
                  exportAll('json');
                  setIsMainMenuOpen(false);
                }}
                className="group w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FileJson size={14} /> Export Project File
                </span>
                <span className="text-[10px] text-gray-400 group-hover:text-white font-mono transition-colors">JSON</span>
              </button>

              <div className="h-[1px] bg-[#e2e8f0] my-1" />

              <button
                onClick={() => {
                  onOpenShortcuts();
                  setIsMainMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                <HelpCircle size={14} />
                <span>Keyboard Shortcuts (Cmd+/)</span>
              </button>
              <button
                onClick={() => {
                  setIsAboutOpen(true);
                  setIsMainMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                <Info size={14} />
                <span>About Figmint</span>
              </button>
              <a
                href="https://github.com/Moii-gh/Figmint"
                target="_blank"
                rel="noreferrer"
                onClick={() => setIsMainMenuOpen(false)}
                className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5"><Github size={14} /> GitHub repository</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Editable Title */}
        <div className="flex items-center min-w-0 max-w-[38vw] sm:max-w-[260px]">
          {isEditingName ? (
            <input
              type="text"
              autoFocus
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={() => {
                if (tempName.trim()) setDocumentName(tempName.trim());
                setIsEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (tempName.trim()) setDocumentName(tempName.trim());
                  setIsEditingName(false);
                }
              }}
              className="bg-white border border-[#0d99ff] rounded px-2 py-0.5 text-xs text-[#111111] font-semibold outline-none text-left"
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              title="Click to rename file"
              className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md hover:bg-[#f1f5f9] text-xs font-semibold text-[#222222] transition-colors cursor-pointer min-w-0"
            >
              <span className="truncate">{currentProject?.title || 'Untitled'}</span>
              <ChevronDown size={13} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* Honest auto-save state with a recovery action when browser storage fails. */}
        {saveStatus === 'error' ? (
          <button
            type="button"
            onClick={() => exportAll('json')}
            title={`${saveError || 'The project could not be saved.'} Export a backup copy.`}
            aria-label="Save failed. Export a backup copy"
            className="ml-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <AlertTriangle size={12} />
            <span className="hidden lg:inline">Save failed · Export backup</span>
          </button>
        ) : (
          <div
            role="status"
            aria-live="polite"
            title={saveWarning || undefined}
            className={`ml-1 flex items-center gap-1 text-[10px] font-medium ${
              saveWarning ? 'text-amber-600' : 'text-gray-400'
            }`}
          >
            {saveStatus === 'loading' || saveStatus === 'saving' ? (
              <LoaderCircle size={11} className="animate-spin text-gray-400" />
            ) : saveWarning ? (
              <AlertTriangle size={11} />
            ) : (
              <CheckCircle2 size={11} className="text-emerald-500" />
            )}
            <span className="hidden sm:inline">
              {saveStatus === 'loading'
                ? 'Loading…'
                : saveStatus === 'saving'
                  ? 'Saving…'
                  : saveWarning
                    ? 'Saved locally'
                    : 'Saved'}
            </span>
          </div>
        )}

        {/* Sidebar Toggle Icon Button */}
        <button
          onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
          title="Toggle Left Sidebar"
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ml-1 ${
            isLeftSidebarOpen
              ? 'text-[#222222] hover:bg-[#f1f5f9]'
              : 'text-gray-400 hover:bg-[#f1f5f9]'
          }`}
        >
          <PanelLeft size={16} />
        </button>
      </div>

      {/* Right: Avatar ▾, Design/Prototype Tabs, Zoom ▾, Play ▶ */}
      <div className="flex items-center gap-1 sm:gap-2.5 flex-none">
        {/* User Avatar with Dropdown */}
        <div className="relative hidden md:block" ref={avatarMenuRef}>
          <button
            onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
            className="flex items-center gap-1 p-1 rounded-md hover:bg-[#f1f5f9] transition-colors cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-[#0d99ff] text-white flex items-center justify-center text-xs font-bold shadow-xs">
              U
            </div>
            <ChevronDown size={11} className="text-gray-500" />
          </button>

          {isAvatarMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#e2e8f0] rounded-xl shadow-xl py-1 z-50 text-xs text-[#222222]">
              <div className="px-3 py-2 border-b border-[#e2e8f0]">
                <div className="font-semibold text-gray-800">Design Workspace</div>
                <div className="text-[11px] text-gray-500">Local Multi-Project</div>
              </div>
              <button
                onClick={() => {
                  openDashboard();
                  setIsAvatarMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                All Projects
              </button>
              <button
                onClick={() => {
                  onOpenShortcuts();
                  setIsAvatarMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                Keyboard Shortcuts
              </button>
            </div>
          )}
        </div>

        {/* Zoom Selector Dropdown */}
        <div className="relative" ref={zoomMenuRef}>
          <button
            onClick={() => setIsZoomMenuOpen(!isZoomMenuOpen)}
            className="h-7 px-2 rounded-md hover:bg-[#f1f5f9] flex items-center gap-1 text-xs font-medium text-gray-700 transition-colors cursor-pointer"
          >
            <span>{Math.round(zoom * 100)}%</span>
            <ChevronDown size={11} className="text-gray-500" />
          </button>

          {isZoomMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#e2e8f0] rounded-xl shadow-2xl py-1 z-50 text-xs text-[#222222]">
              {[0.5, 0.78, 1.0, 1.5, 2.0].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setZoom(level);
                    setIsZoomMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-[#0d99ff] hover:text-white text-gray-700 transition-colors cursor-pointer"
                >
                  <span>{Math.round(level * 100)}%</span>
                  {Math.round(zoom * 100) === Math.round(level * 100) && <Check size={13} />}
                </button>
              ))}
              <div className="h-[1px] bg-[#e2e8f0] my-1" />
              <button
                onClick={() => {
                  zoomToFit();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-[#0d99ff] hover:text-white text-gray-700 transition-colors cursor-pointer"
              >
                Zoom to Fit (Shift+1)
              </button>
              <button
                onClick={() => {
                  zoomReset();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-[#0d99ff] hover:text-white text-gray-700 transition-colors cursor-pointer"
              >
                Zoom to 100% (Shift+0)
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onToggleInspector}
          title="Toggle properties panel"
          aria-label="Toggle properties panel"
          aria-pressed={isInspectorOpen}
          className={`w-7 h-7 rounded-md items-center justify-center transition-colors cursor-pointer flex xl:hidden ${
            isInspectorOpen ? 'bg-[#0d99ff]/10 text-[#0d99ff]' : 'text-gray-600 hover:bg-[#f1f5f9]'
          }`}
        >
          <PanelRight size={16} />
        </button>

        {/* Present / Play Button (▷) */}
        <button
          onClick={() => setPresentationMode(true)}
          title="Present (Cmd+Alt+P)"
          className="w-7 h-7 rounded-md bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#222222] flex items-center justify-center transition-colors cursor-pointer border border-[#e2e8f0]"
        >
          <Play size={13} className="fill-[#333333] text-[#333333] ml-0.5" />
        </button>
      </div>
    </header>
    {isAboutOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4 backdrop-blur-xs" onPointerDown={(event) => { if (event.target === event.currentTarget) setIsAboutOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="about-figmint-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-[#dfe5ec] bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-[#e6e6e6] p-5">
            <div className="flex items-center gap-3">
              <FigmintLogo size={42} />
              <div><h2 id="about-figmint-title" className="text-base font-bold text-gray-900">Figmint Open Studio</h2><p className="text-[11px] text-gray-500">Figma-inspired independent design editor</p></div>
            </div>
            <button onClick={() => setIsAboutOpen(false)} aria-label="Close about dialog" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={17} /></button>
          </div>
          <div className="space-y-4 p-5">
            <p className="text-sm leading-relaxed text-gray-600">Create vector interfaces with reusable components, Auto Layout and design tokens. Your projects stay in this browser and no account is required.</p>
            <div className="grid grid-cols-3 gap-2">
              {['Free', 'Open source', 'Local-first'].map((label) => <div key={label} className="rounded-xl bg-[#f4f8fb] px-2 py-2 text-center text-[10px] font-bold text-[#3f5368] ring-1 ring-inset ring-[#e1e8ef]">{label}</div>)}
            </div>
            <a href="https://github.com/Moii-gh/Figmint" target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-semibold text-white hover:bg-black"><Github size={15} /> View source on GitHub <ExternalLink size={12} /></a>
            <p className="text-center text-[10px] text-gray-400">MIT licensed · Independent project · Not affiliated with Figma</p>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
