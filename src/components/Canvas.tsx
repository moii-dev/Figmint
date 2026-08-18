import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvas } from '../context/CanvasContext';
import { CanvasElement, TransformHandle, Point, Rect, SnapGuide } from '../types/figma';
import { TransformOverlay } from './TransformOverlay';
import { Rulers } from './Rulers';
import { FloatingBottomToolbar } from './FloatingBottomToolbar';
import {
  getTrianglePoints,
  calculateSnapping,
  doRectsIntersect,
  hexToRgba,
  getBoundingBox,
} from '../utils/geometry';
import {
  findFrameAtPoint,
  getWorldPosition,
  getWorldRect,
} from '../utils/hierarchy';

export const Canvas: React.FC = () => {
  const {
    elements,
    selectedIds,
    activeTool,
    zoom,
    pan,
    gridVisible,
    rulerVisible,
    snapToGrid,
    selectElement,
    clearSelection,
    setSelectedIds,
    setPan,
    setZoom,
    setTool,
    updateElement,
    updateElements,
    addElement,
    createShapeAt,
    autoNestOnDrop,
  } = useCanvas();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Interaction State
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize' | 'radius' | 'draw' | 'marquee';
    startX: number;
    startY: number;
    targetParentId?: string | null;
    initialElements?: {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      cornerRadius: number;
      parentId?: string | null;
    }[];
    handle?: TransformHandle;
    drawTool?: string;
    cornerIndex?: number;
  } | null>(null);

  // Marquee Selection Box State
  const [marqueeBox, setMarqueeBox] = useState<Rect | null>(null);

  // Smart Alignment Snap Guides
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  // Inline text editing
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState<string>('');

  // ResizeObserver for viewport dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Spacebar key tracker for Figma pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !isSpacePressed &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  const rulerOffset = rulerVisible ? 22 : 0;

  // Convert Screen (client) coordinates to Canvas World coordinates
  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = clientX - rect.left - rulerOffset;
      const rawY = clientY - rect.top - rulerOffset;
      return {
        x: (rawX - pan.x) / zoom,
        y: (rawY - pan.y) / zoom,
      };
    },
    [pan, zoom, rulerOffset]
  );

  // Canvas Mouse Wheel for Pan & Zoom (Figma-style)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Zooming
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const pointer = screenToWorld(e.clientX, e.clientY);
        setZoom((prevZoom) => {
          const nextZoom = Math.max(0.05, Math.min(5.0, prevZoom * zoomFactor));
          if (!containerRef.current) return nextZoom;
          const rect = containerRef.current.getBoundingClientRect();
          const mouseX = e.clientX - rect.left - rulerOffset;
          const mouseY = e.clientY - rect.top - rulerOffset;
          setPan({
            x: mouseX - pointer.x * nextZoom,
            y: mouseY - pointer.y * nextZoom,
          });
          return nextZoom;
        });
      } else {
        // Panning with trackpad or mouse wheel
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    },
    [screenToWorld, setZoom, setPan, rulerOffset]
  );

  // Canvas Mouse Down (Top-level canvas)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click or Space+Click or Hand tool initiates panning
    if (e.button === 1 || isSpacePressed || activeTool === 'hand') {
      setIsPanning(true);
      setDragState({
        type: 'move',
        startX: e.clientX,
        startY: e.clientY,
      });
      return;
    }

    if (e.button !== 0) return; // Left click only

    const worldPt = screenToWorld(e.clientX, e.clientY);

    // Creation tools (Rectangle, Ellipse, Triangle, Text, Frame, Line)
    if (['frame', 'rectangle', 'ellipse', 'triangle', 'text', 'line'].includes(activeTool)) {
      // Check if clicking inside an existing frame to auto-nest new shape
      let parentFrameId: string | null = null;
      let localPt = { ...worldPt };

      if (activeTool !== 'frame') {
        const targetFrame = findFrameAtPoint(worldPt, elements);
        if (targetFrame) {
          parentFrameId = targetFrame.id;
          const frameWorld = getWorldPosition(targetFrame, elements);
          localPt = {
            x: worldPt.x - frameWorld.x,
            y: worldPt.y - frameWorld.y,
          };
        }
      }

      if (activeTool === 'text') {
        const newText = createShapeAt('text', localPt, { width: 180, height: 32 }, parentFrameId);
        addElement(newText);
        setEditingTextId(newText.id);
        setEditingTextValue(newText.textContent || 'Type something...');
        setTool('select');
        return;
      }

      const initialSize = { width: 1, height: 1 };
      const newShape = createShapeAt(activeTool, localPt, initialSize, parentFrameId);
      addElement(newShape);

      setDragState({
        type: 'draw',
        startX: localPt.x,
        startY: localPt.y,
        targetParentId: parentFrameId,
        initialElements: [
          {
            id: newShape.id,
            x: localPt.x,
            y: localPt.y,
            width: 1,
            height: 1,
            cornerRadius: newShape.cornerRadius || 0,
            parentId: parentFrameId,
          },
        ],
      });
      return;
    }

    // Default select tool: Click on empty canvas clears selection and starts marquee
    clearSelection();
    setEditingTextId(null);
    setDragState({
      type: 'marquee',
      startX: worldPt.x,
      startY: worldPt.y,
    });
  };

  // Element Mouse Down for moving/selecting
  const handleElementMouseDown = (e: React.MouseEvent, element: CanvasElement) => {
    if (isSpacePressed || activeTool === 'hand' || e.button !== 0) return;
    e.stopPropagation();

    if (element.locked) return;

    const isMulti = e.shiftKey;
    const isSelected = selectedIds.includes(element.id);

    let nextSelectedIds = selectedIds;
    if (!isSelected) {
      if (isMulti) {
        nextSelectedIds = [...selectedIds, element.id];
        setSelectedIds(nextSelectedIds);
      } else {
        nextSelectedIds = [element.id];
        setSelectedIds(nextSelectedIds);
      }
    } else if (isMulti) {
      nextSelectedIds = selectedIds.filter((id) => id !== element.id);
      setSelectedIds(nextSelectedIds);
      return;
    }

    const worldPt = screenToWorld(e.clientX, e.clientY);
    const selectedElements = elements.filter((el) => nextSelectedIds.includes(el.id));

    setDragState({
      type: 'move',
      startX: worldPt.x,
      startY: worldPt.y,
      initialElements: selectedElements.map((el) => ({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        cornerRadius: el.cornerRadius || 0,
        parentId: el.parentId || null,
      })),
    });
  };

  // Handle Mouse Down for Transform Resize
  const handleTransformHandleMouseDown = (e: React.MouseEvent, handle: TransformHandle) => {
    e.stopPropagation();
    const primarySelected = elements.find((el) => selectedIds.includes(el.id));
    if (!primarySelected) return;

    const worldPt = screenToWorld(e.clientX, e.clientY);
    setDragState({
      type: 'resize',
      handle,
      startX: worldPt.x,
      startY: worldPt.y,
      initialElements: [
        {
          id: primarySelected.id,
          x: primarySelected.x,
          y: primarySelected.y,
          width: primarySelected.width,
          height: primarySelected.height,
          cornerRadius: primarySelected.cornerRadius || 0,
          parentId: primarySelected.parentId || null,
        },
      ],
    });
  };

  // Handle Mouse Down for Inner Corner Radius Handle
  const handleRadiusHandleMouseDown = (e: React.MouseEvent, cornerIndex = 0) => {
    e.stopPropagation();
    const primarySelected = elements.find((el) => selectedIds.includes(el.id));
    if (!primarySelected) return;

    const worldPt = screenToWorld(e.clientX, e.clientY);
    setDragState({
      type: 'radius',
      cornerIndex,
      startX: worldPt.x,
      startY: worldPt.y,
      initialElements: [
        {
          id: primarySelected.id,
          x: primarySelected.x,
          y: primarySelected.y,
          width: primarySelected.width,
          height: primarySelected.height,
          cornerRadius: primarySelected.cornerRadius || 0,
          parentId: primarySelected.parentId || null,
        },
      ],
    });
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;

    // 1. Panning Mode
    if (isPanning) {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragState((prev) => (prev ? { ...prev, startX: e.clientX, startY: e.clientY } : null));
      return;
    }

    const worldPt = screenToWorld(e.clientX, e.clientY);

    // 2. Marquee Selection Box
    if (dragState.type === 'marquee') {
      const x = Math.min(dragState.startX, worldPt.x);
      const y = Math.min(dragState.startY, worldPt.y);
      const width = Math.abs(worldPt.x - dragState.startX);
      const height = Math.abs(worldPt.y - dragState.startY);
      const box = { x, y, width, height };
      setMarqueeBox(box);

      const intersectingIds = elements
        .filter((el) => {
          if (el.locked) return false;
          const rect = getWorldRect(el, elements);
          return doRectsIntersect(box, rect);
        })
        .map((el) => el.id);

      setSelectedIds(intersectingIds);
      return;
    }

    // 3. Move Elements Mode
    if (dragState.type === 'move' && dragState.initialElements) {
      const dx = worldPt.x - dragState.startX;
      const dy = worldPt.y - dragState.startY;

      let effectiveDx = dx;
      let effectiveDy = dy;

      if (snapToGrid && dragState.initialElements.length > 0) {
        const primary = dragState.initialElements[0];
        const targetRect: Rect = {
          x: primary.x + dx,
          y: primary.y + dy,
          width: primary.width,
          height: primary.height,
        };
        const otherElements = elements.filter(
          (el) => !dragState.initialElements?.some((ie) => ie.id === el.id)
        );
        const { snappedX, snappedY, guides } = calculateSnapping(targetRect, otherElements);
        effectiveDx = snappedX - primary.x;
        effectiveDy = snappedY - primary.y;
        setSnapGuides(guides);
      } else {
        setSnapGuides([]);
      }

      const updates = dragState.initialElements.map((init) => ({
        id: init.id,
        changes: {
          x: Math.round(init.x + effectiveDx),
          y: Math.round(init.y + effectiveDy),
        },
      }));
      updateElements(updates, false);
      return;
    }

    // 4. Drawing a new shape live
    if (dragState.type === 'draw' && dragState.initialElements) {
      const init = dragState.initialElements[0];
      let currentLocalPt = { ...worldPt };

      if (dragState.targetParentId) {
        const parentFrame = elements.find((el) => el.id === dragState.targetParentId);
        if (parentFrame) {
          const pWorld = getWorldPosition(parentFrame, elements);
          currentLocalPt = {
            x: worldPt.x - pWorld.x,
            y: worldPt.y - pWorld.y,
          };
        }
      }

      let width = currentLocalPt.x - init.x;
      let height = currentLocalPt.y - init.y;

      if (e.shiftKey) {
        const maxDim = Math.max(Math.abs(width), Math.abs(height));
        width = width >= 0 ? maxDim : -maxDim;
        height = height >= 0 ? maxDim : -maxDim;
      }

      const normX = width < 0 ? init.x + width : init.x;
      const normY = height < 0 ? init.y + height : init.y;
      const normW = Math.max(4, Math.abs(width));
      const normH = Math.max(4, Math.abs(height));

      updateElement(
        init.id,
        {
          x: Math.round(normX),
          y: Math.round(normY),
          width: Math.round(normW),
          height: Math.round(normH),
        },
        false
      );
      return;
    }

    // 5. Resizing Elements via 8-point handles
    if (dragState.type === 'resize' && dragState.handle && dragState.initialElements) {
      const init = dragState.initialElements[0];
      const h = dragState.handle;
      let { x, y, width, height } = init;
      const dx = worldPt.x - dragState.startX;
      const dy = worldPt.y - dragState.startY;

      if (h.includes('r')) width = init.width + dx;
      if (h.includes('l')) {
        width = init.width - dx;
        x = init.x + dx;
      }
      if (h.includes('b')) height = init.height + dy;
      if (h.includes('t')) {
        height = init.height - dy;
        y = init.y + dy;
      }

      if (e.shiftKey && init.height > 0) {
        const ratio = init.width / init.height;
        if (h === 'r' || h === 'l') height = width / ratio;
        else if (h === 'b' || h === 't') width = height * ratio;
        else {
          const avg = Math.max(width, height * ratio);
          width = avg;
          height = avg / ratio;
        }
      }

      if (width < 6) {
        width = 6;
        if (h.includes('l')) x = init.x + init.width - 6;
      }
      if (height < 6) {
        height = 6;
        if (h.includes('t')) y = init.y + init.height - 6;
      }

      updateElement(
        init.id,
        {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
        },
        false
      );
      return;
    }

    // 6. Corner Radius Drag
    if (dragState.type === 'radius' && dragState.initialElements) {
      const init = dragState.initialElements[0];
      const maxRadius = Math.min(init.width, init.height) / 2;
      const dx = Math.abs(
        worldPt.x -
          (init.x + (dragState.cornerIndex === 1 || dragState.cornerIndex === 2 ? init.width : 0))
      );
      const dy = Math.abs(
        worldPt.y -
          (init.y + (dragState.cornerIndex === 2 || dragState.cornerIndex === 3 ? init.height : 0))
      );
      const dist = Math.min(maxRadius, Math.max(0, Math.sqrt(dx * dx + dy * dy) - 10));

      updateElement(
        init.id,
        {
          cornerRadius: Math.round(dist),
        },
        false
      );
    }
  };

  // Mouse Up (Triggers auto-nesting on drop)
  const handleMouseUp = () => {
    if (dragState) {
      if (dragState.type === 'move' && dragState.initialElements) {
        const movedIds = dragState.initialElements.map((ie) => ie.id);
        // Automatically check if any shape was dropped into a frame or extracted
        autoNestOnDrop(movedIds);
      }
      if (dragState.type === 'draw') {
        setTool('select');
      }
      setDragState(null);
      setMarqueeBox(null);
      setSnapGuides([]);
    }
    setIsPanning(false);
  };

  // Cursor style calculation
  const getCanvasCursor = () => {
    if (isSpacePressed || activeTool === 'hand') return isPanning ? 'grabbing' : 'grab';
    if (['rectangle', 'ellipse', 'triangle', 'frame', 'line'].includes(activeTool))
      return 'crosshair';
    if (activeTool === 'text') return 'text';
    return 'default';
  };

  // Render individual canvas shape (rectangle, ellipse, text, etc.)
  const renderShapeContent = (el: CanvasElement) => {
    const fillStyle = hexToRgba(el.fill, el.fillOpacity);
    const strokeStyle =
      el.strokeWidth > 0 ? hexToRgba(el.stroke, el.strokeOpacity) : 'transparent';
    const strokeDash =
      el.strokeStyle === 'dashed' ? '6 4' : el.strokeStyle === 'dotted' ? '2 3' : 'none';

    let boxShadowStyle = 'none';
    if (el.shadow) {
      const s = el.shadow;
      const shadowColor = hexToRgba(s.color, s.opacity);
      boxShadowStyle = `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${shadowColor}`;
    }

    if (el.type === 'rectangle') {
      return (
        <div
          className="w-full h-full"
          style={{
            backgroundColor: fillStyle,
            borderWidth: `${el.strokeWidth}px`,
            borderColor: strokeStyle,
            borderStyle:
              el.strokeStyle === 'dashed'
                ? 'dashed'
                : el.strokeStyle === 'dotted'
                ? 'dotted'
                : 'solid',
            borderRadius: el.cornerRadius ? `${el.cornerRadius}px` : '0px',
            boxShadow: boxShadowStyle,
          }}
        />
      );
    }

    if (el.type === 'ellipse') {
      return (
        <div
          className="w-full h-full rounded-full"
          style={{
            backgroundColor: fillStyle,
            borderWidth: `${el.strokeWidth}px`,
            borderColor: strokeStyle,
            borderStyle:
              el.strokeStyle === 'dashed'
                ? 'dashed'
                : el.strokeStyle === 'dotted'
                ? 'dotted'
                : 'solid',
            boxShadow: boxShadowStyle,
          }}
        />
      );
    }

    if (el.type === 'triangle') {
      return (
        <svg
          className="w-full h-full overflow-visible"
          viewBox={`0 0 ${el.width} ${el.height}`}
          style={{
            filter: el.shadow
              ? `drop-shadow(${el.shadow.x}px ${el.shadow.y}px ${el.shadow.blur}px ${hexToRgba(
                  el.shadow.color,
                  el.shadow.opacity
                )})`
              : 'none',
          }}
        >
          <polygon
            points={getTrianglePoints(el.width, el.height)}
            fill={fillStyle}
            stroke={strokeStyle}
            strokeWidth={el.strokeWidth}
            strokeDasharray={strokeDash}
          />
        </svg>
      );
    }

    if (el.type === 'text') {
      const isEditing = editingTextId === el.id;
      return (
        <div className="w-full h-full flex items-center">
          {isEditing ? (
            <textarea
              autoFocus
              value={editingTextValue}
              onChange={(e) => setEditingTextValue(e.target.value)}
              onBlur={() => {
                updateElement(el.id, { textContent: editingTextValue });
                setEditingTextId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  updateElement(el.id, { textContent: editingTextValue });
                  setEditingTextId(null);
                }
              }}
              className="w-full h-full bg-transparent border border-[#0d99ff] rounded px-1 text-black outline-none resize-none overflow-hidden"
              style={{
                fontSize: `${el.fontSize || 14}px`,
                fontWeight: el.fontWeight || 400,
                color: el.fill,
                textAlign: el.textAlign || 'left',
              }}
            />
          ) : (
            <div
              className="w-full break-words whitespace-pre-wrap select-none leading-normal"
              style={{
                fontSize: `${el.fontSize || 14}px`,
                fontWeight: el.fontWeight || 400,
                color: el.fill,
                textAlign: el.textAlign || 'left',
              }}
            >
              {el.textContent || 'Double click to edit'}
            </div>
          )}
        </div>
      );
    }

    if (el.type === 'line') {
      return (
        <svg className="w-full h-full overflow-visible">
          <line
            x1="0"
            y1="0"
            x2={el.width}
            y2={el.height}
            stroke={fillStyle}
            strokeWidth={Math.max(1, el.strokeWidth)}
            strokeDasharray={strokeDash}
          />
        </svg>
      );
    }

    return null;
  };

  // Render a child element nested inside a parent frame container
  const renderNestedElement = (el: CanvasElement) => {
    if (!el.visible) return null;
    const isSelected = selectedIds.includes(el.id);
    const isSingleSelected = selectedIds.length === 1 && isSelected;
    const isEditing = editingTextId === el.id;

    return (
      <div
        key={el.id}
        id={`nested-el-${el.id}`}
        onMouseDown={(e) => handleElementMouseDown(e, el)}
        onDoubleClick={(e) => {
          if (el.type === 'text') {
            e.stopPropagation();
            setEditingTextId(el.id);
            setEditingTextValue(el.textContent || '');
          }
        }}
        className="absolute select-none cursor-pointer pointer-events-auto"
        style={{
          left: `${el.x}px`,
          top: `${el.y}px`,
          width: `${el.width}px`,
          height: `${el.height}px`,
          transform: `rotate(${el.rotation || 0}deg)`,
          transformOrigin: 'center center',
          opacity: el.opacity,
          zIndex: 10,
        }}
      >
        {renderShapeContent(el)}

        {/* Transform Bounding Box for single selected nested child */}
        {isSingleSelected && !isEditing && (
          <TransformOverlay
            element={el}
            zoom={zoom}
            onHandleMouseDown={handleTransformHandleMouseDown}
            onRadiusHandleMouseDown={handleRadiusHandleMouseDown}
            isResizing={dragState?.type === 'resize'}
          />
        )}
      </div>
    );
  };

  // Render a top-level element (Frame or root Canvas shape)
  const renderRootElement = (el: CanvasElement) => {
    if (!el.visible) return null;

    const isSelected = selectedIds.includes(el.id);
    const isSingleSelected = selectedIds.length === 1 && isSelected;
    const isEditing = editingTextId === el.id;

    const fillStyle = hexToRgba(el.fill, el.fillOpacity);
    const strokeStyle =
      el.strokeWidth > 0 ? hexToRgba(el.stroke, el.strokeOpacity) : 'transparent';
    let boxShadowStyle = 'none';
    if (el.shadow) {
      const s = el.shadow;
      const shadowColor = hexToRgba(s.color, s.opacity);
      boxShadowStyle = `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${shadowColor}`;
    }

    // 1. Frame Node (Container that holds nested children)
    if (el.type === 'frame') {
      const children = elements.filter((child) => child.parentId === el.id);

      return (
        <div
          key={el.id}
          id={`canvas-frame-${el.id}`}
          onMouseDown={(e) => handleElementMouseDown(e, el)}
          className="absolute select-none cursor-pointer"
          style={{
            left: `${el.x}px`,
            top: `${el.y}px`,
            width: `${el.width}px`,
            height: `${el.height}px`,
            transform: `rotate(${el.rotation || 0}deg)`,
            transformOrigin: 'center center',
            opacity: el.opacity,
            zIndex: 2,
          }}
        >
          {/* Frame Label Title above frame */}
          <div
            className="absolute -top-6 left-0 text-[11px] font-medium text-gray-500 hover:text-[#0d99ff] transition-colors truncate max-w-[300px] flex items-center gap-1 cursor-pointer pointer-events-auto select-none"
            onClick={(e) => {
              e.stopPropagation();
              selectElement(el.id);
            }}
          >
            <span className="text-[#0d99ff] font-mono font-bold">#</span>
            <span>{el.name}</span>
          </div>

          {/* Frame Background Body with Clip Content Support */}
          <div
            className="w-full h-full absolute inset-0 pointer-events-auto"
            style={{
              backgroundColor: fillStyle,
              borderWidth: `${el.strokeWidth}px`,
              borderColor: strokeStyle,
              borderStyle:
                el.strokeStyle === 'dashed'
                  ? 'dashed'
                  : el.strokeStyle === 'dotted'
                  ? 'dotted'
                  : 'solid',
              borderRadius: el.cornerRadius ? `${el.cornerRadius}px` : '0px',
              boxShadow: boxShadowStyle,
              overflow: el.clipContent ? 'hidden' : 'visible',
            }}
          >
            {/* Direct nested children rendered inside this frame DOM container */}
            {children.map((child) => renderNestedElement(child))}
          </div>

          {/* Transform Bounding Box for single selected Frame */}
          {isSingleSelected && (
            <TransformOverlay
              element={el}
              zoom={zoom}
              onHandleMouseDown={handleTransformHandleMouseDown}
              onRadiusHandleMouseDown={handleRadiusHandleMouseDown}
              isResizing={dragState?.type === 'resize'}
            />
          )}
        </div>
      );
    }

    // 2. Top-level Root Shape (not inside a frame)
    return (
      <div
        key={el.id}
        id={`canvas-el-${el.id}`}
        onMouseDown={(e) => handleElementMouseDown(e, el)}
        onDoubleClick={(e) => {
          if (el.type === 'text') {
            e.stopPropagation();
            setEditingTextId(el.id);
            setEditingTextValue(el.textContent || '');
          }
        }}
        className="absolute select-none cursor-pointer"
        style={{
          left: `${el.x}px`,
          top: `${el.y}px`,
          width: `${el.width}px`,
          height: `${el.height}px`,
          transform: `rotate(${el.rotation || 0}deg)`,
          transformOrigin: 'center center',
          opacity: el.opacity,
          zIndex: 5,
        }}
      >
        {renderShapeContent(el)}

        {/* Transform Bounding Box for single selected Root Shape */}
        {isSingleSelected && !isEditing && (
          <TransformOverlay
            element={el}
            zoom={zoom}
            onHandleMouseDown={handleTransformHandleMouseDown}
            onRadiusHandleMouseDown={handleRadiusHandleMouseDown}
            isResizing={dragState?.type === 'resize'}
          />
        )}
      </div>
    );
  };

  // Top level root elements for canvas rendering
  const rootElements = elements.filter((el) => !el.parentId);

  const multiBoundingBox =
    selectedIds.length > 1
      ? getBoundingBox(
          elements
            .filter((el) => selectedIds.includes(el.id))
            .map((el) => {
              const rect = getWorldRect(el, elements);
              return { ...el, x: rect.x, y: rect.y };
            })
        )
      : null;

  return (
    <div
      ref={containerRef}
      id="figma-canvas-viewport"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className="relative flex-1 h-full overflow-hidden select-none bg-[#f5f5f5]"
      style={{ cursor: getCanvasCursor() }}
    >
      {/* Interactive Horizontal & Vertical Rulers */}
      {rulerVisible && (
        <Rulers containerWidth={dimensions.width} containerHeight={dimensions.height} />
      )}

      {/* Infinite Canvas Layer Matrix */}
      <div
        id="figma-canvas-world"
        className="absolute origin-top-left inset-0"
        style={{
          transform: `matrix(${zoom}, 0, 0, ${zoom}, ${pan.x + rulerOffset}, ${
            pan.y + rulerOffset
          })`,
        }}
      >
        {/* Figma Dot Grid Background Pattern in Light Mode */}
        {gridVisible && (
          <div
            className="absolute -inset-[5000px] pointer-events-none opacity-40"
            style={{
              backgroundImage: 'radial-gradient(circle, #cbd5e1 1.2px, transparent 1.2px)',
              backgroundSize: '20px 20px',
            }}
          />
        )}

        {/* Smart Snap Guideline Overlays */}
        {snapGuides.map((guide, idx) => (
          <div
            key={idx}
            className="absolute bg-[#ff0055] pointer-events-none z-50 shadow-sm"
            style={
              guide.type === 'x'
                ? {
                    left: `${guide.position}px`,
                    top: `${guide.start}px`,
                    width: `${1 / zoom}px`,
                    height: `${guide.end - guide.start}px`,
                  }
                : {
                    left: `${guide.start}px`,
                    top: `${guide.position}px`,
                    width: `${guide.end - guide.start}px`,
                    height: `${1 / zoom}px`,
                  }
            }
          />
        ))}

        {/* Canvas Root Elements Tree (Frames render their own children nested inside) */}
        {rootElements.map((el) => renderRootElement(el))}

        {/* Multi-selection unified bounding outline */}
        {multiBoundingBox && (
          <div
            className="absolute border border-[#0d99ff] pointer-events-none z-40"
            style={{
              left: `${multiBoundingBox.x}px`,
              top: `${multiBoundingBox.y}px`,
              width: `${multiBoundingBox.width}px`,
              height: `${multiBoundingBox.height}px`,
              borderWidth: `${1.5 / zoom}px`,
            }}
          >
            <div
              className="absolute -top-5 left-0 bg-[#0d99ff] text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap"
              style={{
                transform: `scale(${Math.max(0.7, 1 / zoom)})`,
                transformOrigin: 'bottom left',
              }}
            >
              {selectedIds.length} items selected
            </div>
          </div>
        )}

        {/* Marquee Drag Selection Box */}
        {marqueeBox && (
          <div
            className="absolute bg-[#0d99ff]/15 border border-[#0d99ff] pointer-events-none z-50 rounded-[2px]"
            style={{
              left: `${marqueeBox.x}px`,
              top: `${marqueeBox.y}px`,
              width: `${marqueeBox.width}px`,
              height: `${marqueeBox.height}px`,
              borderWidth: `${1 / zoom}px`,
            }}
          />
        )}
      </div>

      {/* Floating Centered Bottom Pill Toolbar */}
      <FloatingBottomToolbar />
    </div>
  );
};
