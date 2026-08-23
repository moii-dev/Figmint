import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvas } from '../context/CanvasContext';
import { CanvasElement, TransformHandle, Point, Rect, SnapGuide } from '../types/figma';
import { TransformOverlay } from './TransformOverlay';
import { Rulers } from './Rulers';
import { FloatingBottomToolbar } from './FloatingBottomToolbar';
import { SvgGradientDefs } from './SvgGradientDefs';
import {
  getTrianglePoints,
  getStarPoints,
  getPolygonPoints,
  getDiamondPoints,
  calculateSnapping,
  getMarqueeSelectionIds,
  hexToRgba,
  getBoundingBoxFromRects,
} from '../utils/geometry';
import {
  findFrameAtPoint,
  getWorldPosition,
  getWorldRect,
  getTopLevelSelectionIds,
  worldToLocalPosition,
} from '../utils/hierarchy';
import {
  getElementCssFill,
  getSvgGradientId,
  getVisibleGradients,
} from '../utils/gradient';
import { getCssStrokeOverlayStyle, getEllipseStrokeGeometry } from '../utils/stroke';

interface DragElementSnapshot {
  id: string;
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  cornerRadius: number;
  parentId: string | null;
}

interface DragState {
  type: 'pan' | 'move' | 'resize' | 'radius' | 'draw' | 'marquee';
  pointerId: number;
  startX: number;
  startY: number;
  didChange?: boolean;
  targetParentId?: string | null;
  initialElements?: DragElementSnapshot[];
  handle?: TransformHandle;
  groupBounds?: Rect;
  cornerIndex?: number;
}

function resizeRect(
  initial: Rect,
  handle: TransformHandle,
  dx: number,
  dy: number,
  constrainRatio: boolean
): Rect {
  let { x, y, width, height } = initial;

  if (handle.includes('r')) width = initial.width + dx;
  if (handle.includes('l')) {
    width = initial.width - dx;
    x = initial.x + dx;
  }
  if (handle.includes('b')) height = initial.height + dy;
  if (handle.includes('t')) {
    height = initial.height - dy;
    y = initial.y + dy;
  }

  if (constrainRatio && initial.height > 0) {
    const ratio = initial.width / initial.height;
    if (handle === 'r' || handle === 'l') height = width / ratio;
    else if (handle === 'b' || handle === 't') width = height * ratio;
    else if (Math.abs(width / initial.width) >= Math.abs(height / initial.height)) height = width / ratio;
    else width = height * ratio;

    if (handle.includes('l')) x = initial.x + initial.width - width;
    if (handle.includes('t')) y = initial.y + initial.height - height;
  }

  if (width < 6) {
    width = 6;
    if (handle.includes('l')) x = initial.x + initial.width - width;
  }
  if (height < 6) {
    height = 6;
    if (handle.includes('t')) y = initial.y + initial.height - height;
  }

  return { x, y, width, height };
}

interface CanvasProps {
  hideFloatingToolbar?: boolean;
}

export const Canvas: React.FC<CanvasProps> = ({ hideFloatingToolbar = false }) => {
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
    setViewportSize,
    setTool,
    updateElement,
    updateElements,
    addElement,
    createShapeAt,
    importMediaFiles,
    finishInteraction,
  } = useCanvas();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Interaction State
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Marquee Selection Box State
  const [marqueeBox, setMarqueeBox] = useState<Rect | null>(null);

  // Smart Alignment Snap Guides
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  // Inline text editing
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState<string>('');
  const [editingTextOriginal, setEditingTextOriginal] = useState<string>('');

  // ResizeObserver for viewport dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const size = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };
        setDimensions(size);
        setViewportSize(size);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [setViewportSize]);

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
    (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('#figma-floating-toolbar')) return;
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

  const handleFileDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from<File>(event.dataTransfer.files).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    if (files.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    void importMediaFiles(files, screenToWorld(event.clientX, event.clientY));
  }, [importMediaFiles, screenToWorld]);

  const handleWheelRef = useRef(handleWheel);

  useEffect(() => {
    handleWheelRef.current = handleWheel;
  }, [handleWheel]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const listener = (event: WheelEvent) => handleWheelRef.current(event);
    container.addEventListener('wheel', listener, { passive: false });
    return () => container.removeEventListener('wheel', listener);
  }, []);

  const capturePointer = (pointerId: number) => {
    if (containerRef.current && !containerRef.current.hasPointerCapture(pointerId)) {
      containerRef.current.setPointerCapture(pointerId);
    }
  };

  const createSnapshot = (element: CanvasElement): DragElementSnapshot => {
    const world = getWorldPosition(element, elements);
    return {
      id: element.id,
      x: element.x,
      y: element.y,
      worldX: world.x,
      worldY: world.y,
      width: element.width,
      height: element.height,
      cornerRadius: element.cornerRadius || 0,
      parentId: element.parentId || null,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || isSpacePressed || activeTool === 'hand') {
      e.preventDefault();
      capturePointer(e.pointerId);
      setDragState({ type: 'pan', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY });
      return;
    }

    if (e.button !== 0) return;
    const worldPt = screenToWorld(e.clientX, e.clientY);

    if (['frame', 'rectangle', 'ellipse', 'triangle', 'text', 'line'].includes(activeTool)) {
      e.preventDefault();
      let parentFrameId: string | null = null;
      let localPt = { ...worldPt };

      if (activeTool !== 'frame') {
        const targetFrame = findFrameAtPoint(worldPt, elements);
        if (targetFrame) {
          parentFrameId = targetFrame.id;
          localPt = worldToLocalPosition(worldPt, parentFrameId, elements);
        }
      }

      if (activeTool === 'text') {
        const newText = createShapeAt('text', localPt, { width: 180, height: 32 }, parentFrameId);
        addElement(newText);
        const initialText = newText.textContent || '';
        setEditingTextId(newText.id);
        setEditingTextOriginal(initialText);
        setEditingTextValue(initialText);
        setTool('select');
        return;
      }

      const newShape = createShapeAt(activeTool, localPt, { width: 1, height: 1 }, parentFrameId);
      addElement(newShape, false);
      capturePointer(e.pointerId);
      const world = getWorldPosition(newShape, [...elements, newShape]);
      setDragState({
        type: 'draw',
        pointerId: e.pointerId,
        startX: localPt.x,
        startY: localPt.y,
        didChange: true,
        targetParentId: parentFrameId,
        initialElements: [{
          id: newShape.id,
          x: localPt.x,
          y: localPt.y,
          worldX: world.x,
          worldY: world.y,
          width: 1,
          height: 1,
          cornerRadius: newShape.cornerRadius || 0,
          parentId: parentFrameId,
        }],
      });
      return;
    }

    clearSelection();
    setEditingTextId(null);
    capturePointer(e.pointerId);
    setDragState({ type: 'marquee', pointerId: e.pointerId, startX: worldPt.x, startY: worldPt.y });
  };

  const handleElementPointerDown = (e: React.PointerEvent, element: CanvasElement) => {
    if (['frame', 'rectangle', 'ellipse', 'triangle', 'text', 'line'].includes(activeTool)) return;
    if (isSpacePressed || activeTool === 'hand') return;
    if (e.button !== 0) return;

    e.stopPropagation();
    if (element.locked) return;

    if (element.type === 'text' && e.detail >= 2) {
      setEditingTextId(element.id);
      setEditingTextValue(element.textContent || '');
      setEditingTextOriginal(element.textContent || '');
      return;
    }

    const isMulti = e.shiftKey;
    const isSelected = selectedIds.includes(element.id);
    let nextSelectedIds = selectedIds;

    if (!isSelected) {
      nextSelectedIds = isMulti ? [...selectedIds, element.id] : [element.id];
      setSelectedIds(nextSelectedIds);
    } else if (isMulti) {
      setSelectedIds(selectedIds.filter((id) => id !== element.id));
      return;
    }

    nextSelectedIds = getTopLevelSelectionIds(nextSelectedIds, elements);
    if (nextSelectedIds.length !== selectedIds.length || !nextSelectedIds.every((id) => selectedIds.includes(id))) {
      setSelectedIds(nextSelectedIds);
    }

    const worldPt = screenToWorld(e.clientX, e.clientY);
    setDragState({
      type: 'move',
      pointerId: e.pointerId,
      startX: worldPt.x,
      startY: worldPt.y,
      initialElements: elements.filter((item) => nextSelectedIds.includes(item.id)).map(createSnapshot),
    });
  };

  const startResize = (e: React.PointerEvent, handle: TransformHandle, ids: string[]) => {
    e.preventDefault();
    e.stopPropagation();
    const normalizedIds = getTopLevelSelectionIds(ids, elements);
    const snapshots = elements.filter((element) => normalizedIds.includes(element.id)).map(createSnapshot);
    if (snapshots.length === 0) return;

    const worldPt = screenToWorld(e.clientX, e.clientY);
    const groupBounds = getBoundingBoxFromRects(
      snapshots.map((item) => ({ x: item.worldX, y: item.worldY, width: item.width, height: item.height }))
    ) || undefined;
    capturePointer(e.pointerId);
    setSelectedIds(normalizedIds);
    setDragState({
      type: 'resize',
      pointerId: e.pointerId,
      handle,
      startX: worldPt.x,
      startY: worldPt.y,
      initialElements: snapshots,
      groupBounds,
    });
  };

  const handleTransformHandlePointerDown = (e: React.PointerEvent, handle: TransformHandle) => {
    startResize(e, handle, selectedIds);
  };

  const handleRadiusHandlePointerDown = (e: React.PointerEvent, cornerIndex = 0) => {
    e.preventDefault();
    e.stopPropagation();
    const primarySelected = elements.find((element) => selectedIds.includes(element.id));
    if (!primarySelected) return;

    const worldPt = screenToWorld(e.clientX, e.clientY);
    capturePointer(e.pointerId);
    setDragState({
      type: 'radius',
      pointerId: e.pointerId,
      cornerIndex,
      startX: worldPt.x,
      startY: worldPt.y,
      initialElements: [createSnapshot(primarySelected)],
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState || dragState.pointerId !== e.pointerId) return;

    if (dragState.type === 'move') capturePointer(e.pointerId);

    if (dragState.type === 'pan') {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragState((prev) => prev ? { ...prev, startX: e.clientX, startY: e.clientY, didChange: true } : null);
      return;
    }

    const worldPt = screenToWorld(e.clientX, e.clientY);

    if (dragState.type === 'marquee') {
      const box = {
        x: Math.min(dragState.startX, worldPt.x),
        y: Math.min(dragState.startY, worldPt.y),
        width: Math.abs(worldPt.x - dragState.startX),
        height: Math.abs(worldPt.y - dragState.startY),
      };
      setMarqueeBox(box);
      setSelectedIds(getMarqueeSelectionIds(box, elements));
      setDragState((prev) => prev ? { ...prev, didChange: true } : null);
      return;
    }

    if (dragState.type === 'move' && dragState.initialElements) {
      const dx = worldPt.x - dragState.startX;
      const dy = worldPt.y - dragState.startY;
      let effectiveDx = dx;
      let effectiveDy = dy;
      const primary = dragState.initialElements[0];

      if (snapToGrid && primary) {
        const targetRect = {
          x: primary.worldX + dx,
          y: primary.worldY + dy,
          width: primary.width,
          height: primary.height,
        };
        const movingIds = new Set(dragState.initialElements.map((item) => item.id));
        const snapRects = elements
          .filter((element) =>
            element.visible &&
            !movingIds.has(element.id) &&
            ((element.parentId || null) === primary.parentId || element.id === primary.parentId)
          )
          .map((element) => getWorldRect(element, elements));
        const { snappedX, snappedY, guides } = calculateSnapping(targetRect, snapRects, 6 / zoom);
        effectiveDx = snappedX - primary.worldX;
        effectiveDy = snappedY - primary.worldY;
        setSnapGuides(guides);
      } else {
        setSnapGuides([]);
      }

      updateElements(
        dragState.initialElements.map((item) => ({
          id: item.id,
          changes: { x: Math.round(item.x + effectiveDx), y: Math.round(item.y + effectiveDy) },
        })),
        false
      );
      setDragState((prev) => prev ? { ...prev, didChange: true } : null);
      return;
    }

    if (dragState.type === 'draw' && dragState.initialElements) {
      const initial = dragState.initialElements[0];
      const currentLocalPt = worldToLocalPosition(worldPt, dragState.targetParentId, elements);
      let width = currentLocalPt.x - initial.x;
      let height = currentLocalPt.y - initial.y;

      if (e.shiftKey) {
        const size = Math.max(Math.abs(width), Math.abs(height));
        width = width >= 0 ? size : -size;
        height = height >= 0 ? size : -size;
      }

      updateElement(initial.id, {
        x: Math.round(width < 0 ? initial.x + width : initial.x),
        y: Math.round(height < 0 ? initial.y + height : initial.y),
        width: Math.max(4, Math.round(Math.abs(width))),
        height: Math.max(4, Math.round(Math.abs(height))),
      }, false);
      setDragState((prev) => prev ? { ...prev, didChange: true } : null);
      return;
    }

    if (dragState.type === 'resize' && dragState.handle && dragState.initialElements && dragState.groupBounds) {
      const dx = worldPt.x - dragState.startX;
      const dy = worldPt.y - dragState.startY;
      const resized = resizeRect(dragState.groupBounds, dragState.handle, dx, dy, e.shiftKey);
      const scaleX = resized.width / dragState.groupBounds.width;
      const scaleY = resized.height / dragState.groupBounds.height;

      updateElements(dragState.initialElements.map((item) => {
        const nextWorld = {
          x: resized.x + (item.worldX - dragState.groupBounds!.x) * scaleX,
          y: resized.y + (item.worldY - dragState.groupBounds!.y) * scaleY,
        };
        const local = worldToLocalPosition(nextWorld, item.parentId, elements);
        return {
          id: item.id,
          changes: {
            x: Math.round(local.x),
            y: Math.round(local.y),
            width: Math.max(6, Math.round(item.width * scaleX)),
            height: Math.max(6, Math.round(item.height * scaleY)),
          },
        };
      }), false);
      setDragState((prev) => prev ? { ...prev, didChange: true } : null);
      return;
    }

    if (dragState.type === 'radius' && dragState.initialElements) {
      const initial = dragState.initialElements[0];
      const maxRadius = Math.min(initial.width, initial.height) / 2;
      const cornerX = initial.worldX + ([1, 2].includes(dragState.cornerIndex || 0) ? initial.width : 0);
      const cornerY = initial.worldY + ([2, 3].includes(dragState.cornerIndex || 0) ? initial.height : 0);
      const dx = Math.abs(worldPt.x - cornerX);
      const dy = Math.abs(worldPt.y - cornerY);
      const radius = Math.min(maxRadius, Math.max(0, Math.hypot(dx, dy) - 10));
      updateElement(initial.id, { cornerRadius: Math.round(radius) }, false);
      setDragState((prev) => prev ? { ...prev, didChange: true } : null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState || dragState.pointerId !== e.pointerId) return;

    if (dragState.didChange && ['move', 'resize', 'radius', 'draw'].includes(dragState.type)) {
      finishInteraction(
        dragState.type === 'move' ? dragState.initialElements?.map((item) => item.id) || [] : []
      );
    }
    if (dragState.type === 'draw') setTool('select');

    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
    setDragState(null);
    setMarqueeBox(null);
    setSnapGuides([]);
  };

  const getCanvasCursor = () => {
    if (isSpacePressed || activeTool === 'hand') return dragState?.type === 'pan' ? 'grabbing' : 'grab';
    if (['rectangle', 'ellipse', 'triangle', 'polygon', 'diamond', 'star', 'frame', 'line', 'arrow'].includes(activeTool))
      return 'crosshair';
    if (activeTool === 'text') return 'text';
    return 'default';
  };

  // Render individual canvas shape (rectangle, ellipse, text, etc.)
  const renderShapeContent = (el: CanvasElement) => {
    const fillStyle = hexToRgba(el.fill, el.fillOpacity);
    const fillCss = getElementCssFill(el);
    const visibleGradients = getVisibleGradients(el);
    const svgGradients = [...visibleGradients].reverse();
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
          className="relative w-full h-full"
          style={{
            ...fillCss,
            borderRadius: el.cornerRadius ? `${el.cornerRadius}px` : '0px',
            boxShadow: boxShadowStyle,
          }}
        >
          {el.strokeWidth > 0 && <div style={getCssStrokeOverlayStyle(el, strokeStyle)} />}
        </div>
      );
    }

    if (el.type === 'ellipse') {
      const fillGeometry = {
        cx: el.width / 2,
        cy: el.height / 2,
        rx: el.width / 2,
        ry: el.height / 2,
      };
      const strokeGeometry = getEllipseStrokeGeometry(el);

      return (
        <svg
          className="h-full w-full overflow-visible"
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
          <SvgGradientDefs element={el} prefix="canvas" />
          <ellipse {...fillGeometry} fill={fillStyle} stroke="none" />
          {svgGradients.map((gradient) => (
            <ellipse
              key={gradient.id}
              {...fillGeometry}
              fill={`url(#${getSvgGradientId('canvas', el.id, gradient.id)})`}
              opacity={gradient.opacity}
              stroke="none"
            />
          ))}
          {el.strokeWidth > 0 ? (
            <ellipse
              {...strokeGeometry}
              fill="none"
              stroke={strokeStyle}
              strokeWidth={el.strokeWidth}
              strokeDasharray={strokeDash}
            />
          ) : null}
        </svg>
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
          <SvgGradientDefs element={el} prefix="canvas" />
          <polygon
            points={getTrianglePoints(el.width, el.height)}
            fill={fillStyle}
            stroke="none"
          />
          {svgGradients.map((gradient) => (
            <polygon
              key={gradient.id}
              points={getTrianglePoints(el.width, el.height)}
              fill={`url(#${getSvgGradientId('canvas', el.id, gradient.id)})`}
              opacity={gradient.opacity}
              stroke="none"
            />
          ))}
          <polygon
            points={getTrianglePoints(el.width, el.height)}
            fill="none"
            stroke={strokeStyle}
            strokeWidth={el.strokeWidth}
            strokeDasharray={strokeDash}
          />
        </svg>
      );
    }

    if (el.type === 'star') {
      return (
        <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${el.width} ${el.height}`}>
          <SvgGradientDefs element={el} prefix="canvas" />
          <polygon
            points={getStarPoints(el.width, el.height)}
            fill={fillStyle}
            stroke="none"
          />
          {svgGradients.map((gradient) => (
            <polygon
              key={gradient.id}
              points={getStarPoints(el.width, el.height)}
              fill={`url(#${getSvgGradientId('canvas', el.id, gradient.id)})`}
              opacity={gradient.opacity}
              stroke="none"
            />
          ))}
          <polygon
            points={getStarPoints(el.width, el.height)}
            fill="none"
            stroke={strokeStyle}
            strokeWidth={el.strokeWidth}
            strokeDasharray={strokeDash}
          />
        </svg>
      );
    }

    if (el.type === 'polygon' || el.type === 'diamond') {
      const points = el.type === 'polygon'
        ? getPolygonPoints(el.width, el.height)
        : getDiamondPoints(el.width, el.height);
      return (
        <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${el.width} ${el.height}`}>
          <SvgGradientDefs element={el} prefix="canvas" />
          <polygon points={points} fill={fillStyle} stroke="none" />
          {svgGradients.map((gradient) => (
            <polygon
              key={gradient.id}
              points={points}
              fill={`url(#${getSvgGradientId('canvas', el.id, gradient.id)})`}
              opacity={gradient.opacity}
              stroke="none"
            />
          ))}
          <polygon
            points={points}
            fill="none"
            stroke={strokeStyle}
            strokeWidth={el.strokeWidth}
            strokeDasharray={strokeDash}
          />
        </svg>
      );
    }

    if (el.type === 'image') {
      return (
        <img
          src={el.mediaSrc}
          alt={el.mediaName || el.name}
          draggable={false}
          className="pointer-events-none h-full w-full select-none"
          style={{ objectFit: el.objectFit || 'cover', borderRadius: `${el.cornerRadius || 0}px` }}
        />
      );
    }

    if (el.type === 'video') {
      return (
        <video
          src={el.mediaSrc}
          aria-label={el.mediaName || el.name}
          muted
          playsInline
          preload="metadata"
          className="pointer-events-none h-full w-full bg-black"
          style={{ objectFit: el.objectFit || 'cover', borderRadius: `${el.cornerRadius || 0}px` }}
        />
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
                if (editingTextValue !== editingTextOriginal) {
                  updateElement(el.id, { textContent: editingTextValue });
                }
                setEditingTextId(null);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (editingTextValue !== editingTextOriginal) {
                    updateElement(el.id, { textContent: editingTextValue });
                  }
                  setEditingTextId(null);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditingTextValue(editingTextOriginal);
                  setEditingTextId(null);
                }
              }}
              aria-label={`Edit ${el.name}`}
              className="w-full h-full bg-transparent border border-[#0d99ff] rounded px-1 text-black outline-none resize-none overflow-hidden"
              style={{
                fontSize: `${el.fontSize || 14}px`,
                fontWeight: el.fontWeight || 400,
                fontFamily: el.fontFamily,
                letterSpacing: `${el.letterSpacing || 0}px`,
                lineHeight: el.lineHeight || 1.2,
                color: fillStyle,
                textAlign: el.textAlign || 'left',
                WebkitTextStroke: el.strokeWidth > 0 ? `${el.strokeWidth}px ${strokeStyle}` : undefined,
                paintOrder: 'stroke fill',
              }}
            />
          ) : (
            <div
              className="w-full break-words whitespace-pre-wrap select-none leading-normal"
              style={{
                fontSize: `${el.fontSize || 14}px`,
                fontWeight: el.fontWeight || 400,
                fontFamily: el.fontFamily,
                letterSpacing: `${el.letterSpacing || 0}px`,
                lineHeight: el.lineHeight || 1.2,
                color: visibleGradients.length ? 'transparent' : fillStyle,
                textAlign: el.textAlign || 'left',
                backgroundImage: visibleGradients.length
                  ? `${fillCss.backgroundImage}, linear-gradient(${fillStyle}, ${fillStyle})`
                  : undefined,
                backgroundClip: visibleGradients.length ? 'text' : undefined,
                WebkitBackgroundClip: visibleGradients.length ? 'text' : undefined,
                WebkitTextStroke: el.strokeWidth > 0 ? `${el.strokeWidth}px ${strokeStyle}` : undefined,
                paintOrder: 'stroke fill',
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
          <SvgGradientDefs element={el} prefix="canvas" />
          <line
            x1="0"
            y1="0"
            x2={el.width}
            y2={el.height}
            stroke={el.strokeWidth > 0 ? strokeStyle : fillStyle}
            strokeWidth={Math.max(1, el.strokeWidth)}
            strokeDasharray={strokeDash}
          />
          {el.strokeWidth === 0 && svgGradients.map((gradient) => (
            <line
              key={gradient.id}
              x1="0"
              y1="0"
              x2={el.width}
              y2={el.height}
              stroke={`url(#${getSvgGradientId('canvas', el.id, gradient.id)})`}
              strokeWidth={Math.max(1, el.strokeWidth)}
              strokeDasharray={strokeDash}
              opacity={gradient.opacity}
            />
          ))}
        </svg>
      );
    }

    if (el.type === 'arrow') {
      const color = el.strokeWidth > 0 ? strokeStyle : fillStyle;
      const width = Math.max(2, el.strokeWidth || 3);
      const headSize = Math.max(10, Math.min(24, el.height * 0.45));
      const midY = el.height / 2;
      return (
        <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${el.width} ${el.height}`}>
          <line x1="0" y1={midY} x2={Math.max(0, el.width - headSize)} y2={midY} stroke={color} strokeWidth={width} strokeDasharray={strokeDash} />
          <polygon
            points={`${Math.max(0, el.width - headSize)},${midY - headSize / 2} ${el.width},${midY} ${Math.max(0, el.width - headSize)},${midY + headSize / 2}`}
            fill={color}
          />
        </svg>
      );
    }

    return null;
  };

  // Render a child element nested inside a parent frame container
  const renderNestedElement = (el: CanvasElement, layerIndex: number) => {
    if (!el.visible) return null;
    const isSelected = selectedIds.includes(el.id);
    const isSingleSelected = selectedIds.length === 1 && isSelected;
    const isEditing = editingTextId === el.id;

    return (
      <div
        key={el.id}
        id={`nested-el-${el.id}`}
        data-canvas-element-id={el.id}
        onPointerDown={(e) => handleElementPointerDown(e, el)}
        onDoubleClick={(e) => {
          if (el.type === 'text') {
            e.stopPropagation();
            setEditingTextId(el.id);
            setEditingTextValue(el.textContent || '');
            setEditingTextOriginal(el.textContent || '');
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
          zIndex: layerIndex + 1,
        }}
      >
        {renderShapeContent(el)}

        {/* Transform Bounding Box for single selected nested child */}
        {isSingleSelected && !isEditing && (
          <TransformOverlay
            element={el}
            zoom={zoom}
            onHandlePointerDown={handleTransformHandlePointerDown}
            onRadiusHandlePointerDown={handleRadiusHandlePointerDown}
            isResizing={dragState?.type === 'resize'}
          />
        )}
      </div>
    );
  };

  // Render a top-level element (Frame or root Canvas shape)
  const renderRootElement = (el: CanvasElement, layerIndex: number) => {
    if (!el.visible) return null;

    const isSelected = selectedIds.includes(el.id);
    const isSingleSelected = selectedIds.length === 1 && isSelected;
    const isEditing = editingTextId === el.id;

    const fillCss = getElementCssFill(el);
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
          data-canvas-element-id={el.id}
          onPointerDown={(e) => {
            const targetElementId = (e.target as HTMLElement)
              .closest<HTMLElement>('[data-canvas-element-id]')
              ?.dataset.canvasElementId;

            if (targetElementId && targetElementId !== el.id) return;

            handleElementPointerDown(e, el);
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
            zIndex: layerIndex + 1,
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
              ...fillCss,
              borderRadius: el.cornerRadius ? `${el.cornerRadius}px` : '0px',
              boxShadow: boxShadowStyle,
              overflow: el.clipContent ? 'hidden' : 'visible',
            }}
          >
            {/* Direct nested children rendered inside this frame DOM container */}
            {children.map((child, childIndex) => renderNestedElement(child, childIndex))}
          </div>

          {el.strokeWidth > 0 && (
            <div className="absolute inset-0 z-[2]" style={getCssStrokeOverlayStyle(el, strokeStyle)} />
          )}

          {/* Transform Bounding Box for single selected Frame */}
          {isSingleSelected && (
            <TransformOverlay
              element={el}
              zoom={zoom}
              onHandlePointerDown={handleTransformHandlePointerDown}
              onRadiusHandlePointerDown={handleRadiusHandlePointerDown}
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
        data-canvas-element-id={el.id}
        onPointerDown={(e) => handleElementPointerDown(e, el)}
        onDoubleClick={(e) => {
          if (el.type === 'text') {
            e.stopPropagation();
            setEditingTextId(el.id);
            setEditingTextValue(el.textContent || '');
            setEditingTextOriginal(el.textContent || '');
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
          zIndex: layerIndex + 1,
        }}
      >
        {renderShapeContent(el)}

        {/* Transform Bounding Box for single selected Root Shape */}
        {isSingleSelected && !isEditing && (
          <TransformOverlay
            element={el}
            zoom={zoom}
            onHandlePointerDown={handleTransformHandlePointerDown}
            onRadiusHandlePointerDown={handleRadiusHandlePointerDown}
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
      ? getBoundingBoxFromRects(
          elements.filter((el) => selectedIds.includes(el.id)).map((el) => getWorldRect(el, elements))
        )
      : null;

  return (
    <div
      ref={containerRef}
      id="figma-canvas-viewport"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDragOver={(event) => {
        if (Array.from<DataTransferItem>(event.dataTransfer.items).some((item) => item.kind === 'file')) event.preventDefault();
      }}
      onDrop={handleFileDrop}
      className="relative flex-1 min-w-0 h-full overflow-hidden select-none bg-[#f5f5f5]"
      style={{ cursor: getCanvasCursor(), touchAction: 'none' }}
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
        {rootElements.map((el, layerIndex) => renderRootElement(el, layerIndex))}

        {/* Multi-selection unified bounding outline */}
        {multiBoundingBox && (
          <div
            className="absolute z-40"
            style={{
              left: `${multiBoundingBox.x}px`,
              top: `${multiBoundingBox.y}px`,
              width: `${multiBoundingBox.width}px`,
              height: `${multiBoundingBox.height}px`,
            }}
          >
            <TransformOverlay
              element={{
                ...elements.find((el) => selectedIds.includes(el.id))!,
                id: 'multi-selection',
                name: `${selectedIds.length} items`,
                x: multiBoundingBox.x,
                y: multiBoundingBox.y,
                width: multiBoundingBox.width,
                height: multiBoundingBox.height,
                rotation: 0,
                type: 'rectangle',
              }}
              zoom={zoom}
              onHandlePointerDown={handleTransformHandlePointerDown}
              onRadiusHandlePointerDown={() => undefined}
              showRadiusHandles={false}
              isResizing={dragState?.type === 'resize'}
            />
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

      {/* Side drawers own the narrow viewport and should not compete with the editing toolbar. */}
      {!hideFloatingToolbar && <FloatingBottomToolbar />}
    </div>
  );
};
