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
} from 'lucide-react';
import { useCanvas } from '../context/CanvasContext';
import { CanvasElement, ShapeType } from '../types/figma';

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
    addElement,
    activeLeftTab,
    setActiveLeftTab,
    isLeftSidebarOpen,
    collapsedFrames,
    toggleFrameCollapsed,
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
      case 'text':
        return <Type size={13} className="text-gray-500" />;
      default:
        return <Square size={13} className="text-gray-500" />;
    }
  };

  // Top level frames and canvas-root elements
  const rootElements = elements.filter((el) => !el.parentId);
  const frames = elements.filter((el) => el.type === 'frame');

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
    if (targetElement.type === 'frame') {
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

    if (targetElement.type === 'frame' && dropPosition === 'inside') {
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

  // Sample UI Component Assets to spawn onto canvas
  const assetComponents = [
    {
      id: 'asset-button-primary',
      name: 'Primary Action Button',
      type: 'rectangle' as ShapeType,
      width: 240,
      height: 48,
      fill: '#0d99ff',
      fillOpacity: 1,
      cornerRadius: 12,
    },
    {
      id: 'asset-card',
      name: 'Glass Container Card',
      type: 'rectangle' as ShapeType,
      width: 320,
      height: 160,
      fill: '#ffffff',
      fillOpacity: 1,
      cornerRadius: 16,
    },
    {
      id: 'asset-avatar',
      name: 'Profile Avatar',
      type: 'ellipse' as ShapeType,
      width: 48,
      height: 48,
      fill: '#6366f1',
      fillOpacity: 1,
      cornerRadius: 0,
    },
    {
      id: 'asset-tag',
      name: 'Pill Badge',
      type: 'rectangle' as ShapeType,
      width: 100,
      height: 28,
      fill: '#e0f2fe',
      fillOpacity: 1,
      cornerRadius: 14,
    },
  ];

  const spawnAsset = (asset: typeof assetComponents[0]) => {
    const activeFrame = elements.find((el) => el.type === 'frame');
    const posX = activeFrame ? 24 : 120;
    const posY = activeFrame ? 24 : 120;

    const newEl: CanvasElement = {
      id: `asset-${Date.now()}`,
      name: asset.name,
      type: asset.type,
      x: posX,
      y: posY,
      width: asset.width,
      height: asset.height,
      rotation: 0,
      fill: asset.fill,
      fillOpacity: asset.fillOpacity,
      stroke: '#cbd5e1',
      strokeWidth: asset.fill === '#ffffff' ? 1 : 0,
      strokeOpacity: 1,
      strokeStyle: 'solid',
      strokeAlign: 'inside',
      cornerRadius: asset.cornerRadius,
      individualCorners: false,
      opacity: 1,
      visible: true,
      locked: false,
      parentId: activeFrame ? activeFrame.id : null,
    };
    addElement(newEl);
  };

  const renderLayerItem = (el: CanvasElement, depth = 0) => {
    const isSelected = selectedIds.includes(el.id);
    const isEditing = editingId === el.id;
    const isFrame = el.type === 'frame';
    const isCollapsed = collapsedFrames[el.id];
    const isDropTarget = dropTargetId === el.id;

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

            {!el.parentId && frames.length > 0 && el.type !== 'frame' && (
              <button
                onClick={() => {
                  reparentLayer(el.id, frames[0].id);
                  setContextMenuId(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#0d99ff] hover:text-white cursor-pointer"
              >
                <FolderInput size={13} /> Move into {frames[0].name}
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
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Component Library
            </div>
            <div className="space-y-2">
              {assetComponents.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => spawnAsset(asset)}
                  className="w-full text-left p-2.5 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#0d99ff] hover:shadow-sm transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-semibold text-gray-800 group-hover:text-[#0d99ff]">
                      {asset.name}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {asset.width} × {asset.height}
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-[#f1f5f9] group-hover:bg-[#0d99ff] group-hover:text-white flex items-center justify-center text-gray-500 transition-colors">
                    <Plus size={13} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeLeftTab === 'variables' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar text-xs">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Design Tokens
            </div>

            <div>
              <div className="font-semibold text-gray-700 mb-1.5">Color Tokens</div>
              <div className="space-y-1.5">
                {[
                  { name: 'Primary / Brand', color: '#0d99ff' },
                  { name: 'Background / Canvas', color: '#f5f5f5' },
                  { name: 'Surface / Card', color: '#ffffff' },
                  { name: 'Text / Primary', color: '#111111' },
                ].map((token) => (
                  <div
                    key={token.name}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border border-black/10"
                        style={{ backgroundColor: token.color }}
                      />
                      <span className="text-[11px] text-gray-700 font-medium">{token.name}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">{token.color}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="font-semibold text-gray-700 mb-1.5">Corner Radius</div>
              <div className="grid grid-cols-3 gap-1.5">
                {['sm (4px)', 'md (8px)', 'lg (16px)'].map((r) => (
                  <div
                    key={r}
                    className="p-1.5 rounded bg-[#f8fafc] border border-[#e2e8f0] text-center text-[10px] text-gray-600 font-mono"
                  >
                    {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
