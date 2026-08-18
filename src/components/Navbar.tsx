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
  ArrowLeft,
  Cloud,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { useCanvas } from '../context/CanvasContext';

interface NavbarProps {
  onOpenShortcuts: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenShortcuts }) => {
  const {
    currentProject,
    setDocumentName,
    openDashboard,
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomToFit,
    presentationMode,
    setPresentationMode,
    appMode,
    setAppMode,
    isLeftSidebarOpen,
    setIsLeftSidebarOpen,
    exportAll,
    importJson,
    resetCanvas,
  } = useCanvas();

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(currentProject?.title || 'Untitled');
  const [isMainMenuOpen, setIsMainMenuOpen] = useState(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);

  useEffect(() => {
    if (currentProject) {
      setTempName(currentProject.title);
    }
  }, [currentProject?.title]);

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
    <header
      id="figma-navbar"
      className="h-11 bg-white border-b border-[#e6e6e6] flex items-center justify-between px-3 text-[#333333] z-40 select-none"
    >
      {/* Left: Home / Back to Files + Figma Logo + Document Title ▾ + Sidebar Toggle */}
      <div className="flex items-center gap-1.5">
        {/* Back to Home / Dashboard Button */}
        <button
          onClick={openDashboard}
          title="Back to Files (Home Dashboard)"
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#f8fafc] hover:bg-[#e2e8f0] text-gray-700 font-semibold text-xs border border-[#e2e8f0] transition-colors cursor-pointer mr-1"
        >
          <ArrowLeft size={13} />
          <span>Files</span>
        </button>

        {/* Figma Multi-color Logo Button */}
        <div className="relative" ref={mainMenuRef}>
          <button
            onClick={() => setIsMainMenuOpen(!isMainMenuOpen)}
            title="Main Menu"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f1f5f9] transition-colors cursor-pointer"
          >
            {/* Authentic Figma Logo Shapes */}
            <svg width="18" height="26" viewBox="0 0 38 57" fill="none" className="w-4 h-5">
              <path
                d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z"
                fill="#1ABCFE"
              />
              <path
                d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z"
                fill="#0ACF83"
              />
              <path
                d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z"
                fill="#FF7262"
              />
              <path
                d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z"
                fill="#F24E1E"
              />
              <path
                d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z"
                fill="#A259FF"
              />
            </svg>
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
                className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Download size={14} /> Export PNG (2x)
                </span>
                <span className="text-[10px] text-gray-400 font-mono">PNG</span>
              </button>

              <button
                onClick={() => {
                  exportAll('svg');
                  setIsMainMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Download size={14} /> Export SVG
                </span>
                <span className="text-[10px] text-gray-400 font-mono">SVG</span>
              </button>

              <button
                onClick={() => {
                  exportAll('json');
                  setIsMainMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#0d99ff] hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FileJson size={14} /> Export Project File
                </span>
                <span className="text-[10px] text-gray-400 font-mono">JSON</span>
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
        <div className="flex items-center">
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
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[#f1f5f9] text-xs font-semibold text-[#222222] transition-colors cursor-pointer"
            >
              <span>{currentProject?.title || 'Untitled'}</span>
              <ChevronDown size={13} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* Auto-saved badge */}
        <div className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400 font-medium ml-1">
          <CheckCircle2 size={11} className="text-emerald-500" />
          <span>Saved</span>
        </div>

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
      <div className="flex items-center gap-2.5">
        {/* User Avatar with Dropdown */}
        <div className="relative" ref={avatarMenuRef}>
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

        {/* Design / Prototype Mode Segmented Pill */}
        <div className="flex items-center bg-[#f1f5f9] p-0.5 rounded-lg border border-[#e2e8f0]">
          <button
            onClick={() => setAppMode('design')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              appMode === 'design'
                ? 'bg-white text-[#111111] shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Design
          </button>
          <button
            onClick={() => setAppMode('prototype')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              appMode === 'prototype'
                ? 'bg-white text-[#111111] shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Prototype
          </button>
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
  );
};
