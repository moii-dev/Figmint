import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Copy,
  Edit2,
  FolderOpen,
  Clock,
  LayoutGrid,
  List,
  Smartphone,
  Monitor,
  Layers,
  ChevronRight,
  SlidersHorizontal,
  Github,
  ExternalLink,
} from 'lucide-react';
import { useCanvas } from '../context/CanvasContext';
import { CanvasElement, DesignToken } from '../types/figma';
import { hexToRgba, getTrianglePoints } from '../utils/geometry';
import { getWorldRect } from '../utils/hierarchy';
import { SvgGradientDefs } from './SvgGradientDefs';
import { getSvgGradientId, getVisibleGradients } from '../utils/gradient';
import { resolveElementTokens } from '../utils/tokens';
import { FigmintLogo } from './FigmintLogo';

export const Dashboard: React.FC = () => {
  const {
    projects,
    openProject,
    createNewProject,
    duplicateProject,
    renameProject,
    deleteProject,
  } = useCanvas();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeNav, setActiveNav] = useState<'recents' | 'all' | 'drafts'>('recents');
  const [sortBy, setSortBy] = useState<'updated' | 'title'>('updated');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Filter & Sort Projects
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        if (!searchQuery) return true;
        return p.title.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => {
        if (sortBy === 'updated') return b.updatedAt - a.updatedAt;
        return a.title.localeCompare(b.title);
      });
  }, [projects, searchQuery, sortBy]);

  const formatRelativeTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  // Render a live mini thumbnail of project elements
  const renderThumbnail = (elements: CanvasElement[], tokens: DesignToken[] = []) => {
    if (!elements || elements.length === 0) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#f8fafc] text-gray-400">
          <Layers size={24} className="opacity-40 mb-1" />
          <span className="text-[10px] font-mono">Blank Canvas</span>
        </div>
      );
    }

    // Find main frame or bounds
    const renderedElements = elements.map((element) => resolveElementTokens(element, tokens));
    const mainFrame = renderedElements.find((el) => el.type === 'frame') || renderedElements[0];
    const frameW = mainFrame.width || 400;
    const frameH = mainFrame.height || 600;
    const padding = 20;

    return (
      <div className="w-full h-full bg-[#f1f5f9] flex items-center justify-center p-2 overflow-hidden select-none">
        <svg
          viewBox={`${mainFrame.x - padding} ${mainFrame.y - padding} ${frameW + padding * 2} ${frameH + padding * 2}`}
          className="w-full h-full max-h-[160px] object-contain drop-shadow-sm pointer-events-none"
        >
          {renderedElements.map((el) => {
            if (!el.visible) return null;
            const fillStyle = hexToRgba(el.fill, el.fillOpacity);
            const strokeStyle = el.strokeWidth > 0 ? hexToRgba(el.stroke, el.strokeOpacity) : 'none';
            const gradients = getVisibleGradients(el);
            const paints = [
              { id: 'solid', paint: fillStyle, opacity: 1 },
              ...[...gradients].reverse().map((gradient) => ({
                id: gradient.id,
                paint: `url(#${getSvgGradientId('dashboard', el.id, gradient.id)})`,
                opacity: gradient.opacity,
              })),
            ];

            const worldRect = getWorldRect(el, renderedElements);
            const posX = worldRect.x;
            const posY = worldRect.y;

            if (['frame', 'rectangle', 'component', 'instance'].includes(el.type)) {
              return (
                <g key={el.id} opacity={el.opacity}>
                  <SvgGradientDefs element={el} prefix="dashboard" />
                  {paints.map((paint) => (
                    <rect
                      key={paint.id}
                      x={posX}
                      y={posY}
                      width={el.width}
                      height={el.height}
                      rx={el.cornerRadius || 0}
                      fill={paint.paint}
                      opacity={paint.opacity}
                    />
                  ))}
                  <rect x={posX} y={posY} width={el.width} height={el.height} rx={el.cornerRadius || 0} fill="none" stroke={strokeStyle} strokeWidth={el.strokeWidth} />
                </g>
              );
            }
            if (el.type === 'ellipse') {
              return (
                <g key={el.id} opacity={el.opacity}>
                  <SvgGradientDefs element={el} prefix="dashboard" />
                  {paints.map((paint) => (
                    <ellipse
                      key={paint.id}
                      cx={posX + el.width / 2}
                      cy={posY + el.height / 2}
                      rx={el.width / 2}
                      ry={el.height / 2}
                      fill={paint.paint}
                      opacity={paint.opacity}
                    />
                  ))}
                  <ellipse cx={posX + el.width / 2} cy={posY + el.height / 2} rx={el.width / 2} ry={el.height / 2} fill="none" stroke={strokeStyle} strokeWidth={el.strokeWidth} />
                </g>
              );
            }
            if (el.type === 'triangle') {
              const points = getTrianglePoints(el.width, el.height)
                .split(' ')
                .map((p) => {
                  const [px, py] = p.split(',').map(Number);
                  return `${posX + px},${posY + py}`;
                })
                .join(' ');
              return (
                <g key={el.id} opacity={el.opacity}>
                  <SvgGradientDefs element={el} prefix="dashboard" />
                  {paints.map((paint) => (
                    <polygon key={paint.id} points={points} fill={paint.paint} opacity={paint.opacity} />
                  ))}
                  <polygon points={points} fill="none" stroke={strokeStyle} strokeWidth={el.strokeWidth} />
                </g>
              );
            }
            if (el.type === 'text') {
              return (
                <g key={el.id} opacity={el.opacity}>
                  <SvgGradientDefs element={el} prefix="dashboard" />
                  {paints.map((paint) => (
                    <text
                      key={paint.id}
                      x={posX}
                      y={posY + (el.fontSize || 14)}
                      fontSize={el.fontSize || 14}
                      fontWeight={el.fontWeight || 500}
                      fill={paint.paint}
                      opacity={paint.opacity}
                    >
                      {el.textContent || ''}
                    </text>
                  ))}
                  {el.strokeWidth > 0 && (
                    <text
                      x={posX}
                      y={posY + (el.fontSize || 14)}
                      fontSize={el.fontSize || 14}
                      fontWeight={el.fontWeight || 500}
                      fill="none"
                      stroke={strokeStyle}
                      strokeWidth={el.strokeWidth}
                      paintOrder="stroke fill"
                    >
                      {el.textContent || ''}
                    </text>
                  )}
                </g>
              );
            }
            return null;
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-[#f8fafc] text-[#1e293b] overflow-hidden select-none font-sans">
      {/* 1. Left Navigation Sidebar (Figma Home UI3) */}
      <aside className="hidden w-64 bg-white border-r border-[#e2e8f0] md:flex flex-col h-full z-20 flex-none">
        {/* User / Workspace Header */}
        <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FigmintLogo size={32} />
            <div>
              <div className="text-xs font-bold text-gray-900 leading-tight">Figmint Open Studio</div>
              <div className="text-[11px] text-gray-500">
                Local Workspace • {projects.length} {projects.length === 1 ? 'file' : 'files'}
              </div>
            </div>
          </div>
        </div>

        {/* Primary Action: + New Design File Button */}
        <div className="p-3">
          <button
            onClick={() => createNewProject('Untitled Design', 'blank')}
            className="w-full bg-[#0d99ff] hover:bg-[#0284c7] text-white py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>New design file</span>
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-2 space-y-1 text-xs font-medium">
          <button
            onClick={() => setActiveNav('recents')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
              activeNav === 'recents'
                ? 'bg-[#e5f2ff] text-[#0d99ff] font-semibold'
                : 'text-gray-600 hover:bg-[#f1f5f9] hover:text-gray-900'
            }`}
          >
            <Clock size={15} />
            <span>Recents</span>
          </button>

          <button
            onClick={() => setActiveNav('all')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
              activeNav === 'all'
                ? 'bg-[#e5f2ff] text-[#0d99ff] font-semibold'
                : 'text-gray-600 hover:bg-[#f1f5f9] hover:text-gray-900'
            }`}
          >
            <FolderOpen size={15} />
            <span>All Projects</span>
          </button>

          <button
            onClick={() => setActiveNav('drafts')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
              activeNav === 'drafts'
                ? 'bg-[#e5f2ff] text-[#0d99ff] font-semibold'
                : 'text-gray-600 hover:bg-[#f1f5f9] hover:text-gray-900'
            }`}
          >
            <Layers size={15} />
            <span>Drafts</span>
          </button>
        </nav>

        {/* Quick Starter Templates */}
        <div className="p-3 border-t border-[#e2e8f0]">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Starter Templates
          </div>
          <div className="space-y-1.5">
            <button
              onClick={() => createNewProject('iPhone 16 App', 'mobile')}
              className="w-full text-left p-2 rounded-lg bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#e2e8f0] flex items-center gap-2 text-xs text-gray-700 transition-colors cursor-pointer"
            >
              <Smartphone size={14} className="text-[#0d99ff]" />
              <span>Mobile App Screen</span>
            </button>
            <button
              onClick={() => createNewProject('Desktop Web App', 'desktop')}
              className="w-full text-left p-2 rounded-lg bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#e2e8f0] flex items-center gap-2 text-xs text-gray-700 transition-colors cursor-pointer"
            >
              <Monitor size={14} className="text-[#6366f1]" />
              <span>Desktop Web Canvas</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Dashboard Content */}
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto custom-scrollbar">
        {/* Top Search & Filter Bar */}
        <header className="min-h-14 border-b border-[#e2e8f0] bg-white px-3 sm:px-6 py-2 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between sticky top-0 z-10">
          {/* Search Box */}
          <div className="flex items-center bg-[#f1f5f9] rounded-xl px-3 py-1.5 w-full sm:w-80 border border-transparent focus-within:border-[#0d99ff] focus-within:bg-white transition-all">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files and projects..."
              className="w-full bg-transparent text-xs text-gray-800 placeholder-gray-400 outline-none"
            />
          </div>

          {/* View controls & Sorting */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            {/* Sort Toggle */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <SlidersHorizontal size={13} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-gray-700 font-medium outline-none cursor-pointer"
              >
                <option value="updated">Last modified</option>
                <option value="title">Alphabetical</option>
              </select>
            </div>

            {/* Grid / List Layout toggle */}
            <div className="flex items-center bg-[#f1f5f9] p-0.5 rounded-lg border border-[#e2e8f0]">
              <button
                onClick={() => setViewLayout('grid')}
                aria-label="Grid view"
                aria-pressed={viewLayout === 'grid'}
                className={`p-1 rounded ${viewLayout === 'grid' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-400'}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewLayout('list')}
                aria-label="List view"
                aria-pressed={viewLayout === 'list'}
                className={`p-1 rounded ${viewLayout === 'list' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-400'}`}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          <section className="relative overflow-hidden rounded-2xl bg-[#111827] px-5 py-5 text-white shadow-lg sm:px-7">
            <div className="absolute -right-10 -top-20 h-48 w-48 rounded-full bg-[#0d99ff]/20 blur-3xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3.5">
                <FigmintLogo size={44} className="flex-none" />
                <div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {['Free', 'Open source', 'Local-first'].map((label) => <span key={label} className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#b8c7d9]">{label}</span>)}
                  </div>
                  <h1 className="text-lg font-bold sm:text-xl">Design freely. Keep every file yours.</h1>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#a9b8c9]">A Figma-inspired independent editor with reusable components, Auto Layout and real design tokens — running entirely in your browser.</p>
                </div>
              </div>
              <a href="https://github.com/Moii-gh/Figmint" target="_blank" rel="noreferrer" className="flex flex-none items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-[#e9f7f2]"><Github size={15} /> Source code <ExternalLink size={12} /></a>
            </div>
          </section>

          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {activeNav === 'recents' ? 'Recently edited' : activeNav === 'all' ? 'All Files' : 'Drafts'}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {filteredProjects.length} {filteredProjects.length === 1 ? 'project file' : 'project files'} in workspace
              </p>
            </div>

            {/* Quick Create Button */}
            <button
              onClick={() => createNewProject('Untitled Design', 'blank')}
              className="bg-white hover:bg-[#f8fafc] text-gray-800 border border-[#e2e8f0] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>New File</span>
            </button>
          </div>

          {/* Projects Grid */}
          {viewLayout === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {/* Card 0: "+ New Blank Canvas" */}
              <button
                type="button"
                onClick={() => createNewProject('Untitled Design', 'blank')}
                className="group h-56 rounded-2xl border-2 border-dashed border-[#cbd5e1] hover:border-[#0d99ff] focus-visible:border-[#0d99ff] focus-visible:ring-2 focus-visible:ring-[#0d99ff]/25 bg-white hover:bg-[#f0f9ff]/40 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all shadow-xs hover:shadow-md outline-none"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#e5f2ff] text-[#0d99ff] group-hover:scale-110 flex items-center justify-center mb-3 transition-transform">
                  <Plus size={22} />
                </div>
                <div className="font-semibold text-xs text-gray-900 group-hover:text-[#0d99ff]">
                  Create new file
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  Start with a clean infinite vector canvas
                </div>
              </button>

              {/* Project Cards */}
              {filteredProjects.map((project) => {
                const isMenuOpen = menuOpenId === project.id;
                const isEditing = editingId === project.id;

                return (
                  <div
                    key={project.id}
                    className="group relative bg-white rounded-2xl border border-[#e2e8f0] hover:border-[#0d99ff] shadow-xs hover:shadow-lg transition-all overflow-hidden flex flex-col h-56"
                  >
                    {/* Thumbnail Container */}
                    <button
                      type="button"
                      onClick={() => openProject(project.id)}
                      aria-label={`Open ${project.title}`}
                      className="flex-1 w-full relative bg-[#f1f5f9] border-b border-[#e2e8f0] overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0d99ff]"
                    >
                      {renderThumbnail(project.elements, project.tokens)}

                      {/* Hover Open Overlay */}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="bg-white text-gray-900 font-semibold text-xs px-3 py-1.5 rounded-full shadow-md flex items-center gap-1">
                          Open File <ChevronRight size={13} />
                        </span>
                      </div>
                    </button>

                    {/* Card Footer: Title & Actions */}
                    <div className="p-3 bg-white flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingTitle}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={() => {
                              if (editingTitle.trim()) renameProject(project.id, editingTitle.trim());
                              setEditingId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (editingTitle.trim()) renameProject(project.id, editingTitle.trim());
                                setEditingId(null);
                              }
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="bg-white text-xs font-semibold border border-[#0d99ff] rounded px-1.5 py-0.5 outline-none w-full"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => openProject(project.id)}
                            className="block w-full truncate text-left text-xs font-semibold text-gray-900 group-hover:text-[#0d99ff] focus-visible:text-[#0d99ff] outline-none transition-colors"
                          >
                            {project.title}
                          </button>
                        )}
                        <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 font-medium">
                          <span>{formatRelativeTime(project.updatedAt)}</span>
                          <span>•</span>
                          <span>{project.elements.length} layers</span>
                        </div>
                      </div>

                      {/* 3-Dots Context Menu Button */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(isMenuOpen ? null : project.id);
                          }}
                          className="w-7 h-7 rounded-lg hover:bg-[#f1f5f9] text-gray-400 hover:text-gray-800 flex items-center justify-center transition-colors cursor-pointer"
                          aria-label={`Actions for ${project.title}`}
                        >
                          <MoreVertical size={14} />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 bottom-full mb-1 w-44 bg-white border border-[#e2e8f0] rounded-xl shadow-xl py-1 z-30 text-xs text-gray-700"
                          >
                            <button
                              onClick={() => {
                                openProject(project.id);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#0d99ff] hover:text-white cursor-pointer"
                            >
                              <FolderOpen size={13} /> Open
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(project.id);
                                setEditingTitle(project.title);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#0d99ff] hover:text-white cursor-pointer"
                            >
                              <Edit2 size={13} /> Rename
                            </button>
                            <button
                              onClick={() => {
                                duplicateProject(project.id);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#0d99ff] hover:text-white cursor-pointer"
                            >
                              <Copy size={13} /> Duplicate
                            </button>
                            <div className="h-[1px] bg-[#e2e8f0] my-1" />
                            <button
                              onClick={() => {
                                deleteProject(project.id);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-red-50 text-red-600 cursor-pointer"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View Layout */
            <div className="bg-white rounded-2xl border border-[#e2e8f0] divide-y divide-[#e2e8f0] overflow-hidden shadow-xs">
              {filteredProjects.map((project) => (
                <article
                  key={project.id}
                  className="p-3.5 flex items-center justify-between hover:bg-[#f8fafc] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => openProject(project.id)}
                    aria-label={`Open ${project.title}`}
                    className="flex flex-1 items-center gap-3 text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#0d99ff]/30"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#f1f5f9] border border-[#e2e8f0] flex items-center justify-center text-gray-500">
                      <Layers size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-900">{project.title}</div>
                      <div className="text-[11px] text-gray-400">
                        {project.elements.length} layers • Edited {formatRelativeTime(project.updatedAt)}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateProject(project.id);
                      }}
                      title="Duplicate"
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(project.id);
                      }}
                      title="Delete"
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
