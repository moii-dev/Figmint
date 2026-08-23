import React, { useState } from 'react';
import {
  FileCode2,
  Boxes,
  Sliders,
  Search,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Square,
  Circle,
  Triangle,
  Star,
  Hexagon,
  Diamond,
  ArrowRight,
  Image,
  Video,
  Type,
  ChevronRight,
  ChevronDown,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Plus,
  FolderInput,
  FolderMinus,
  Component,
  LayoutTemplate,
  Palette,
  Radius,
  MoveHorizontal,
} from 'lucide-react';
import { useCanvas } from '../context/CanvasContext';
import { CanvasElement, ShapeType } from '../types/figma';
import { STARTER_COMPONENTS } from '../data/uiKit';

export const LeftSidebar: React.FC = () => {
  const {
    elements,
    selectedIds,
    selectElement,
    toggleVisibility,
    toggleLock,
    renameElement,
    deleteSelected,
    duplicateSelected,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    reparentLayer,
    activeLeftTab,
    setActiveLeftTab,
    isLeftSidebarOpen,
    collapsedFrames,
    toggleFrameCollapsed,
    tokens,
    createComponentFromSelection,
    createInstance,
    insertStarterComponent,
    addToken,
    updateToken,
    deleteToken,
  } = useCanvas();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'inside' | 'before' | 'after' | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  if (!isLeftSidebarOpen) return null;

  const getShapeIcon = (type: ShapeType) => {
    switch (type) {
      case 'frame':
        return <span className="font-bold text-[#0d99ff] text-xs font-mono">#</span>;
      case 'rectangle':
        return <Square size={13} className="text-gray-500" />;
      case 'ellipse':
        return <Circle size={13} className="text-gray-500" />;
      case 'triangle':
        return <Triangle size={13} className="text-gray-500" />;
      case 'polygon':
        return <Hexagon size={13} className="text-gray-500" />;
      case 'diamond':
        return <Diamond size={13} className="text-gray-500" />;
      case 'star':
        return <Star size={13} className="text-gray-500" />;
      case 'line':
      case 'arrow':
        return <ArrowRight size={13} className="text-gray-500" />;
      case 'image':
        return <Image size={13} className="text-gray-500" />;
      case 'video':
        return <Video size={13} className="text-gray-500" />;
      case 'text':
        return <Type size={13} className="text-gray-500" />;
      case 'component':
        return <span className="text-[12px] font-bold text-[#9747ff]">◆</span>;
      case 'instance':
        return <span className="text-[12px] font-bold text-[#9747ff]">◇</span>;
      default:
        return <Square size={13} className="text-gray-500" />;
    }
  };

  // Top level frames and canvas-root elements
  const rootElements = elements.filter((el) => !el.parentId);
  const frames = elements.filter((el) => el.type === 'frame' || el.type === 'component');
  const localComponents = elements.filter((el) => el.type === 'component');

  const filterItem = (el: CanvasElement) => {
    if (!searchQuery) return true;
    return el.name.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetElement: CanvasElement) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedId || draggedId === targetElement.id) return;

    // Check if target is a frame -> can drop inside
    if (targetElement.type === 'frame' || targetElement.type === 'component') {
      setDropTargetId(targetElement.id);
      setDropPosition('inside');
    } else {
      setDropTargetId(targetElement.id);
      setDropPosition('after');
    }
  };

  const handleDrop = (e: React.DragEvent, targetElement: CanvasElement) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedId || draggedId === targetElement.id) {
      setDraggedId(null);
      setDropTargetId(null);
      setDropPosition(null);
      return;
    }

    if ((targetElement.type === 'frame' || targetElement.type === 'component') && dropPosition === 'inside') {
      // Nest dragged shape into this frame
      reparentLayer(draggedId, targetElement.id);
    } else {
      // Reorder next to target element
      const targetParentId = targetElement.parentId || null;
      const targetIndex = elements.findIndex((el) => el.id === targetElement.id);
      reparentLayer(draggedId, targetParentId, targetIndex);
    }

    setDraggedId(null);
    setDropTargetId(null);
    setDropPosition(null);
  };

  const handleDropToRoot = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedId) return;
    reparentLayer(draggedId, null);
    setDraggedId(null);
    setDropTargetId(null);
    setDropPosition(null);
  };

  const renderLayerItem = (el: CanvasElement, depth = 0) => {
    const isSelected = selectedIds.includes(el.id);
    const isEditing = editingId === el.id;
    const isFrame = ['frame', 'component', 'instance'].includes(el.type);
    const isCollapsed = collapsedFrames[el.id];
    const isDropTarget = dropTargetId === el.id;
    const availableParent = frames.find((frame) => frame.id !== el.id);

    const children = elements.filter((child) => child.parentId === el.id);

    return (
      <div key={el.id} className="select-none relative">
        <div
          id={`layer-item-${el.id}`}
          draggable
          onDragStart={(e) => handleDragStart(e, el.id)}
          onDragOver={(e) => handleDragOver(e, el)}
          onDrop={(e) => handleDrop(e, el)}
          onClick={(e) => {
            selectElement(el.id, e.shiftKey || e.metaKey);
            setContextMenuId(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            selectElement(el.id);
            setContextMenuId(contextMenuId === el.id ? null : el.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingId(el.id);
            setEditingName(el.name);
          }}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          className={`group flex items-center justify-between pr-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
            isDropTarget
              ? dropPosition === 'inside'
                ? 'bg-[#dbeafe] border-2 border-[#0d99ff]'
                : 'border-b-2 border-[#0d99ff]'
              : ''
          } ${
            isSelected
              ? 'bg-[#e5f2ff] text-[#0d99ff] font-medium'
              : 'text-[#333333] hover:bg-[#f1f5f9]'
          }`}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* Frame Collapse Arrow */}
            {isFrame && children.length > 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFrameCollapsed(el.id);
                }}
                className="w-3.5 h-3.5 flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer"
                aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${el.name}`}
              >
                {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
              </button>
            ) : isFrame ? (
              <div className="w-3.5" />
            ) : null}

            {getShapeIcon(el.type)}

            {isEditing ? (
              <input
                type="text"
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => {
                  if (editingName.trim()) renameElement(el.id, editingName.trim());
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingName.trim()) renameElement(el.id, editingName.trim());
                    setEditingId(null);
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="bg-white text-[#111111] border border-[#0d99ff] rounded px-1 text-xs outline-none w-full"
              />
            ) : (
              <span
                className={`truncate flex-1 ${
                  isSelected ? 'text-[#0d99ff] font-semibold' : 'text-[#333333]'
                }`}
              >
                {el.name}
              </span>
            )}
          </div>

          {/* Action icons on hover & right menu */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLock(el.id);
              }}
              title={el.locked ? 'Unlock layer' : 'Lock layer'}
              className={`p-0.5 rounded hover:bg-black/5 ${
                el.locked ? 'opacity-100 text-amber-500' : 'text-gray-400'
              }`}
            >
              {el.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleVisibility(el.id);
              }}
              title={el.visible ? 'Hide layer' : 'Show layer'}
              className={`p-0.5 rounded hover:bg-black/5 ${
                !el.visible ? 'opacity-100 text-gray-400' : 'text-gray-500'
              }`}
            >
              {el.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          </div>
        </div>

        {/* Context Menu */}
        {contextMenuId === el.id && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-6 top-7 w-48 bg-white border border-[#e2e8f0] rounded-xl shadow-xl py-1 z-40 text-xs text-gray-700"
          >
            <button
              onClick={() => {
                bringToFront();
                setContextMenuId(null);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#0d99ff] hover:text-white cursor-pointer"
            >
              <ArrowUp size={13} /> Bring to Front
            </button>
            <button
              onClick={() => {
                sendToBack();
                setContextMenuId(null);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#0d99ff] hover:text-white cursor-pointer"
            >
              <ArrowDown size={13} /> Send to Back
            </button>

            {el.parentId && (
              <button
                onClick={() => {
                  reparentLayer(el.id, null);
                  setContextMenuId(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#0d99ff] hover:text-white text-[#0d99ff] cursor-pointer"
              >
                <FolderMinus size={13} /> Extract from Frame
              </button>
            )}

            {!el.parentId && availableParent && el.type !== 'frame' && (
              <button
                onClick={() => {
                  reparentLayer(el.id, availableParent.id);
                  setContextMenuId(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#0d99ff] hover:text-white cursor-pointer"
              >
                <FolderInput size={13} /> Move into {availableParent.name}
              </button>
            )}

            <div className="h-[1px] bg-[#e2e8f0] my-1" />

            <button
              onClick={() => {
                duplicateSelected();
                setContextMenuId(null);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#0d99ff] hover:text-white cursor-pointer"
            >
              <Copy size={13} /> Duplicate
            </button>
            <button
              onClick={() => {
                deleteSelected();
                setContextMenuId(null);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-red-50 text-red-600 cursor-pointer"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}

        {/* Child items recursively rendered under Parent Frame */}
        {isFrame && !isCollapsed && children.length > 0 && (
          <div className="border-l border-[#e2e8f0] ml-4 pl-1 space-y-0.5 mt-0.5">
            {children.filter(filterItem).map((child) => renderLayerItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      id="figma-left-sidebar"
      className="absolute inset-y-0 left-0 flex h-full w-[min(268px,86vw)] bg-white border-r border-[#e6e6e6] z-30 select-none text-[#333333] shadow-xl xl:shadow-none xl:relative xl:w-[268px] xl:flex-none"
    >
      {/* 1. Far-left narrow vertical icon strip (Figma UI3 style) */}
      <div className="w-11 border-r border-[#e6e6e6] flex flex-col items-center py-2 gap-2 bg-[#fafafa]">
        {/* Layers icon */}
        <button
          onClick={() => setActiveLeftTab('layers')}
          title="Layers"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            activeLeftTab === 'layers'
              ? 'bg-white text-[#0d99ff] shadow-xs border border-[#e2e8f0]'
              : 'text-gray-500 hover:text-[#111111] hover:bg-white/60'
          }`}
        >
          <FileCode2 size={16} />
        </button>

        {/* Assets / Component icon */}
        <button
          onClick={() => setActiveLeftTab('assets')}
          title="Assets & Components"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            activeLeftTab === 'assets'
              ? 'bg-white text-[#0d99ff] shadow-xs border border-[#e2e8f0]'
              : 'text-gray-500 hover:text-[#111111] hover:bg-white/60'
          }`}
        >
          <Boxes size={16} />
        </button>

        {/* Variables / Tokens icon */}
        <button
          onClick={() => setActiveLeftTab('variables')}
          title="Variables & Design Tokens"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            activeLeftTab === 'variables'
              ? 'bg-white text-[#0d99ff] shadow-xs border border-[#e2e8f0]'
              : 'text-gray-500 hover:text-[#111111] hover:bg-white/60'
          }`}
        >
          <Sliders size={16} />
        </button>
      </div>

      {/* 2. Main Sidebar Content Panel (width 230px) */}
      <div className="w-56 flex flex-col h-full bg-white">
        {activeLeftTab === 'layers' && (
          <>
            {/* Search Box */}
            <div className="p-2 border-b border-[#e6e6e6]">
              <div className="flex items-center bg-[#f5f5f5] rounded-lg px-2 py-1 border border-transparent focus-within:border-[#0d99ff] focus-within:bg-white transition-colors">
                <Search size={12} className="text-gray-400 mr-1.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search layers..."
                  className="w-full bg-transparent text-xs text-[#222222] placeholder-gray-400 outline-none"
                />
              </div>
            </div>

            {/* Layers List with Drag to Canvas Root Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropToRoot}
              className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar"
            >
              <div className="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>Layers ({elements.length})</span>
                <span className="text-[10px] text-gray-400 font-normal lowercase">drag to nest</span>
              </div>

              {rootElements.filter(filterItem).map((el) => renderLayerItem(el, 0))}

              {elements.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-400">
                  No layers on canvas.
                </div>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="p-2 border-t border-[#e6e6e6] bg-[#fafafa] flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <button
                  onClick={bringForward}
                  disabled={selectedIds.length === 0}
                  title="Bring Forward"
                  className="p-1 rounded hover:bg-white hover:text-black disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  onClick={sendBackward}
                  disabled={selectedIds.length === 0}
                  title="Send Backward"
                  className="p-1 rounded hover:bg-white hover:text-black disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  onClick={duplicateSelected}
                  disabled={selectedIds.length === 0}
                  title="Duplicate (Cmd+D)"
                  className="p-1 rounded hover:bg-white hover:text-black disabled:opacity-30 cursor-pointer"
                >
                  <Copy size={13} />
                </button>
              </div>

              <button
                onClick={deleteSelected}
                disabled={selectedIds.length === 0}
                title="Delete (Del)"
                className="p-1 rounded hover:bg-red-50 hover:text-red-600 text-gray-400 disabled:opacity-30 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </>
        )}

        {activeLeftTab === 'assets' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-5 custom-scrollbar">
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Local components
                </div>
                <button
                  onClick={createComponentFromSelection}
                  disabled={selectedIds.length === 0}
                  title="Create component (Ctrl+Alt+K)"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[#9747ff] hover:bg-[#f5edff] disabled:opacity-30"
                >
                  <Plus size={13} />
                </button>
              </div>

              {localComponents.length === 0 ? (
                <button
                  onClick={createComponentFromSelection}
                  disabled={selectedIds.length === 0}
                  className="w-full rounded-xl border border-dashed border-[#cdb7ec] bg-[#fbf8ff] p-3 text-left disabled:opacity-60"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6f35b5]">
                    <Component size={14} /> Create your first component
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#8a759f]">
                    Select a frame or layers, then use Ctrl+Alt+K.
                  </p>
                </button>
              ) : (
                <div className="space-y-1.5">
                  {localComponents.map((component) => (
                    <button
                      key={component.id}
                      onClick={() => createInstance(component.id)}
                      className="group flex w-full items-center gap-2.5 rounded-xl border border-[#e5d8f5] bg-white p-2 text-left hover:border-[#9747ff] hover:bg-[#fbf8ff]"
                    >
                      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#f3e8ff] text-[#9747ff]">◆</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-gray-800">{component.name}</div>
                        <div className="text-[10px] text-gray-400">{Math.round(component.width)} × {Math.round(component.height)}</div>
                      </div>
                      <Plus size={13} className="text-[#9747ff] opacity-60 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <LayoutTemplate size={13} /> Figmint starter kit
              </div>
              <div className="grid grid-cols-2 gap-2">
                {STARTER_COMPONENTS.map((asset) => (
                  <button
                    key={asset.kind}
                    onClick={() => insertStarterComponent(asset.kind)}
                    className="group min-h-20 rounded-xl border border-[#e2e8f0] bg-[#fafbfc] p-2 text-left hover:border-[#0d99ff] hover:bg-white hover:shadow-sm"
                  >
                    <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#0d99ff] shadow-xs ring-1 ring-[#e2e8f0] group-hover:bg-[#0d99ff] group-hover:text-white">
                      <Component size={13} />
                    </div>
                    <div className="text-[11px] font-semibold leading-tight text-gray-800">{asset.name}</div>
                    <div className="mt-0.5 text-[9px] leading-tight text-gray-400">{asset.description}</div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeLeftTab === 'variables' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar text-xs">
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Design tokens</div>
              <p className="mt-1 text-[10px] leading-relaxed text-gray-400">Bound values update everywhere, including exports.</p>
            </div>

            {(['color', 'spacing', 'radius'] as const).map((category) => {
              const categoryTokens = tokens.filter((token) => token.category === category);
              const Icon = category === 'color' ? Palette : category === 'radius' ? Radius : MoveHorizontal;
              return (
                <section key={category} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold capitalize text-gray-700"><Icon size={13} />{category}</div>
                    <button onClick={() => addToken(category)} aria-label={`Add ${category} token`} className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-[#e5f2ff] hover:text-[#0d99ff]"><Plus size={13} /></button>
                  </div>
                  {categoryTokens.map((token) => (
                    <div key={token.id} className="group rounded-xl border border-[#e2e8f0] bg-[#fafbfc] p-2">
                      <div className="flex items-center gap-1.5">
                        {category === 'color' && <input type="color" value={String(token.value)} onChange={(event) => updateToken(token.id, { value: event.target.value })} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={`${token.name} color`} />}
                        <input value={token.name} onChange={(event) => updateToken(token.id, { name: event.target.value })} className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-gray-700 outline-none focus:text-[#0d99ff]" aria-label={`${token.name} name`} />
                        <button onClick={() => deleteToken(token.id)} aria-label={`Delete ${token.name}`} className="text-gray-300 opacity-0 hover:text-red-500 group-hover:opacity-100"><Trash2 size={12} /></button>
                      </div>
                      {category === 'color' ? (
                        <input value={String(token.value)} onChange={(event) => updateToken(token.id, { value: event.target.value })} className="mt-1 w-full rounded-md bg-white px-1.5 py-1 font-mono text-[10px] uppercase text-gray-500 ring-1 ring-inset ring-[#e2e8f0] outline-none focus:ring-[#0d99ff]" aria-label={`${token.name} value`} />
                      ) : (
                        <label className="mt-1 flex items-center rounded-md bg-white px-1.5 py-1 ring-1 ring-inset ring-[#e2e8f0] focus-within:ring-[#0d99ff]">
                          <input type="number" min="0" value={Number(token.value)} onChange={(event) => updateToken(token.id, { value: Math.max(0, Number(event.target.value)) })} className="w-full bg-transparent font-mono text-[10px] text-gray-600 outline-none" aria-label={`${token.name} value`} />
                          <span className="text-[9px] text-gray-400">px</span>
                        </label>
                      )}
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
