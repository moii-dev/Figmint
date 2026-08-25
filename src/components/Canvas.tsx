import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvas } from '../context/CanvasContext';
import {
  CanvasElement,
  TransformHandle,
  Point,
  PrototypeConnectionSide,
  Rect,
  SnapGuide,
} from '../types/figma';
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
import { resolveElementTokens } from '../utils/tokens';
import { ImageFillLayer } from './ImageFillLayer';
import {
  createPrototypeInteraction,
  getConnectionAnchorPoint,
  getNearestConnectionSide,
  getPrototypeDestinationFrame,
  PROTOTYPE_CONNECTION_SIDES,
} from '../utils/prototype';

const CREATION_TOOLS = ['frame', 'rectangle', 'ellipse', 'triangle', 'polygon', 'diamond', 'star', 'text', 'line', 'arrow', 'pen'];
const CONTAINER_TYPES: CanvasElement['type'][] = ['frame', 'component', 'instance'];

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
  type: 'pan' | 'move' | 'resize' | 'radius' | 'draw' | 'marquee' | 'node';
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

interface PrototypeConnectionDraft {
  sourceId: string;
  sourceAnchor: PrototypeConnectionSide;
  pointer: Point;
  targetElementId?: string;
  targetAnchor?: PrototypeConnectionSide;
  destinationFrameId?: string;
}

const PROTOTYPE_ANCHOR_POSITION: Record<PrototypeConnectionSide, React.CSSProperties> = {
  top: { left: '50%', top: 0 },
  right: { left: '100%', top: '50%' },
  bottom: { left: '50%', top: '100%' },
  left: { left: 0, top: '50%' },
};

const PROTOTYPE_OPPOSITE_SIDE: Record<PrototypeConnectionSide, PrototypeConnectionSide> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
};

function getPrototypeCurvePath(
  from: Point,
  sourceSide: PrototypeConnectionSide,
  to: Point,
  destinationSide: PrototypeConnectionSide
): string {
  const vectors: Record<PrototypeConnectionSide, Point> = {
    top: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
  };
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const bend = Math.max(36, Math.min(180, distance * 0.42));
  const sourceVector = vectors[sourceSide];
  const destinationVector = vectors[destinationSide];
  const c1 = { x: from.x + sourceVector.x * bend, y: from.y + sourceVector.y * bend };
  const c2 = { x: to.x + destinationVector.x * bend, y: to.y + destinationVector.y * bend };
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
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

function getVectorPathD(element: CanvasElement): string {
  const points = element.vectorPath || [];
  if (points.length === 0) return '';
  const commands = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x * element.width} ${point.y * element.height}`);
  if (element.vectorClosed) commands.push('Z');
  return commands.join(' ');
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
    tokens,
    appMode,
  } = useCanvas();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Interaction State
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [prototypeConnectionDraft, setPrototypeConnectionDraft] = useState<PrototypeConnectionDraft | null>(null);

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

  const resolvePrototypeTarget = useCallback((point: Point, sourceId: string) => {
    const source = elements.find((element) => element.id === sourceId);
    const sourceFrame = source ? getPrototypeDestinationFrame(source, elements) : undefined;
    const depthOf = (element: CanvasElement) => {
      let depth = 0;
      let parentId = element.parentId;
      const visited = new Set<string>();
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        depth += 1;
        parentId = elements.find((item) => item.id === parentId)?.parentId;
      }
      return depth;
    };

    const candidates = elements.flatMap((element, index) => {
      if (!element.visible || element.locked || element.id === sourceId) return [];
      const rect = getWorldRect(element, elements);
      if (point.x < rect.x || point.x > rect.x + rect.width || point.y < rect.y || point.y > rect.y + rect.height) return [];
      const destinationFrame = getPrototypeDestinationFrame(element, elements);
      if (!destinationFrame || destinationFrame.id === sourceFrame?.id) return [];
      return [{ element, rect, destinationFrame, depth: depthOf(element), index }];
    });

    candidates.sort((a, b) => b.depth - a.depth || a.rect.width * a.rect.height - b.rect.width * b.rect.height || b.index - a.index);
    const target = candidates[0];
    if (!target) return undefined;
    return {
      element: target.element,
      destinationFrame: target.destinationFrame,
      anchor: getNearestConnectionSide(target.rect, point),
    };
  }, [elements]);

  useEffect(() => {
    if (!prototypeConnectionDraft) return;
    const sourceId = prototypeConnectionDraft.sourceId;
    const sourceAnchor = prototypeConnectionDraft.sourceAnchor;

    const handleConnectionMove = (event: PointerEvent) => {
      const point = screenToWorld(event.clientX, event.clientY);
      const target = resolvePrototypeTarget(point, sourceId);
      setPrototypeConnectionDraft((current) => current?.sourceId === sourceId ? {
        ...current,
        pointer: point,
        targetElementId: target?.element.id,
        targetAnchor: target?.anchor,
        destinationFrameId: target?.destinationFrame.id,
      } : current);
    };
    const handleConnectionEnd = (event: PointerEvent) => {
      const point = screenToWorld(event.clientX, event.clientY);
      const target = resolvePrototypeTarget(point, sourceId);
      const source = elements.find((element) => element.id === sourceId);
      if (source && target) {
        updateElement(source.id, {
          interactions: [...(source.interactions || []), {
            ...createPrototypeInteraction(target.destinationFrame.id),
            destinationElementId: target.element.id,
            sourceAnchor,
            destinationAnchor: target.anchor,
          }],
        });
      }
      setPrototypeConnectionDraft(null);
    };
    const handleConnectionCancel = () => setPrototypeConnectionDraft(null);
    const handleConnectionKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleConnectionCancel();
    };

    window.addEventListener('pointermove', handleConnectionMove);
    window.addEventListener('pointerup', handleConnectionEnd, { once: true });
    window.addEventListener('pointercancel', handleConnectionCancel, { once: true });
    window.addEventListener('keydown', handleConnectionKeyDown);
    return () => {
      window.removeEventListener('pointermove', handleConnectionMove);
      window.removeEventListener('pointerup', handleConnectionEnd);
      window.removeEventListener('pointercancel', handleConnectionCancel);
      window.removeEventListener('keydown', handleConnectionKeyDown);
    };
  }, [elements, prototypeConnectionDraft?.sourceAnchor, prototypeConnectionDraft?.sourceId, resolvePrototypeTarget, screenToWorld, updateElement]);

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
    const targetElementId = (event.target as HTMLElement)
      .closest<HTMLElement>('[data-canvas-element-id]')
      ?.dataset.canvasElementId;
    void importMediaFiles(files, screenToWorld(event.clientX, event.clientY), targetElementId);
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

    if (CREATION_TOOLS.includes(activeTool)) {
      e.preventDefault();
      let parentFrameId: string | null = null;
      let localPt = { ...worldPt };

      const targetFrame = findFrameAtPoint(worldPt, elements);
      if (targetFrame) {
        parentFrameId = targetFrame.id;
        localPt = worldToLocalPosition(worldPt, parentFrameId, elements);
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
    if (CREATION_TOOLS.includes(activeTool)) return;
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
      return;
    }

    if (dragState.type === 'node' && dragState.initialElements && dragState.cornerIndex !== undefined) {
      const target = elements.find((element) => element.id === dragState.initialElements![0].id);
      if (!target?.vectorPath) return;
      const rect = getWorldRect(target, elements);
      const nextPoint = {
        x: Math.max(0, Math.min(1, (worldPt.x - rect.x) / Math.max(1, rect.width))),
        y: Math.max(0, Math.min(1, (worldPt.y - rect.y) / Math.max(1, rect.height))),
      };
      updateElement(target.id, {
        vectorPath: target.vectorPath.map((point, index) => index === dragState.cornerIndex ? { ...point, ...nextPoint } : point),
      }, false);
      setDragState((prev) => prev ? { ...prev, didChange: true } : null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState || dragState.pointerId !== e.pointerId) return;

    if (dragState.didChange && ['move', 'resize', 'radius', 'draw', 'node'].includes(dragState.type)) {
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
    if (['rectangle', 'ellipse', 'triangle', 'polygon', 'diamond', 'star', 'frame', 'line', 'arrow', 'pen'].includes(activeTool))
      return 'crosshair';
    if (activeTool === 'text') return 'text';
    return 'default';
  };

  const renderPrototypeHandles = (element: CanvasElement, visible: boolean) => {
    if (appMode !== 'prototype' || !visible) return null;
    const isDraftTarget = prototypeConnectionDraft?.targetElementId === element.id;
    const isDraftSource = prototypeConnectionDraft?.sourceId === element.id;
    return (
      <div className="pointer-events-none absolute inset-0 z-50" aria-label="Prototype connection points">
        {PROTOTYPE_CONNECTION_SIDES.map((side) => {
          const isActive = (isDraftSource && prototypeConnectionDraft.sourceAnchor === side)
            || (isDraftTarget && prototypeConnectionDraft.targetAnchor === side);
          const isTargetPoint = isDraftTarget;
          return (
            <span key={side} className="absolute h-0 w-0" style={PROTOTYPE_ANCHOR_POSITION[side]}>
              <button
                type="button"
                aria-label={`${side} prototype connection point`}
                title={isTargetPoint ? `Connect to ${side}` : `Drag from ${side}`}
                data-prototype-anchor={side}
                onPointerDown={isTargetPoint ? undefined : (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const rect = getWorldRect(element, elements);
                  setPrototypeConnectionDraft({
                    sourceId: element.id,
                    sourceAnchor: side,
                    pointer: getConnectionAnchorPoint(rect, side),
                  });
                }}
                className={`absolute h-3.5 w-3.5 rounded-full border-2 shadow-sm transition-[transform,background-color,opacity] duration-150 ${
                  isTargetPoint ? 'pointer-events-none' : 'pointer-events-auto cursor-crosshair'
                } ${isActive ? 'border-white bg-[#0d99ff]' : 'border-[#0d99ff] bg-white hover:bg-[#0d99ff]'}`}
                style={{
                  transform: `translate(-50%, -50%) scale(${(isActive ? 1.25 : 1) / zoom})`,
                  transformOrigin: 'center',
                  opacity: isTargetPoint && !isActive ? 0.38 : 1,
                }}
              />
            </span>
          );
        })}
      </div>
    );
  };

  const getMaskClipPath = (element: CanvasElement): string | undefined => {
    if (!element.maskId) return undefined;
    const mask = elements.find((item) => item.id === element.maskId);
    if (!mask) return undefined;
    const targetRect = getWorldRect(element, elements);
    const maskRect = getWorldRect(mask, elements);
    const left = ((maskRect.x - targetRect.x) / targetRect.width) * 100;
    const top = ((maskRect.y - targetRect.y) / targetRect.height) * 100;
    const right = ((targetRect.x + targetRect.width - maskRect.x - maskRect.width) / targetRect.width) * 100;
    const bottom = ((targetRect.y + targetRect.height - maskRect.y - maskRect.height) / targetRect.height) * 100;
    if (mask.type === 'ellipse') {
      return `ellipse(${(maskRect.width / targetRect.width) * 50}% ${(maskRect.height / targetRect.height) * 50}% at ${left + (maskRect.width / targetRect.width) * 50}% ${top + (maskRect.height / targetRect.height) * 50}%)`;
    }
    return `inset(${top}% ${right}% ${bottom}% ${left}% round ${mask.cornerRadius || 0}px)`;
  };

  // Render individual canvas shape (rectangle, ellipse, text, etc.)
  const renderShapeContent = (el: CanvasElement) => {
    el = resolveElementTokens(el, tokens);
    const fillStyle = el.imageFill ? 'transparent' : hexToRgba(el.fill, el.fillOpacity);
    const fillCss: React.CSSProperties = el.imageFill ? { backgroundColor: 'transparent' } : getElementCssFill(el);
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

    if (el.type === 'boolean') {
      const groupRect = getWorldRect(el, elements);
      const sources = (el.booleanSourceIds || []).flatMap((id) => {
        const source = elements.find((item) => item.id === id);
        if (!source) return [];
        const rect = getWorldRect(source, elements);
        const x = rect.x - groupRect.x;
        const y = rect.y - groupRect.y;
        if (source.type === 'ellipse') {
          const rx = rect.width / 2;
          const ry = rect.height / 2;
          return [`M ${x + rx} ${y} A ${rx} ${ry} 0 1 1 ${x + rx} ${y + rect.height} A ${rx} ${ry} 0 1 1 ${x + rx} ${y} Z`];
        }
        return [`M ${x} ${y} H ${x + rect.width} V ${y + rect.height} H ${x} Z`];
      });
      const combined = sources.join(' ');
      const operation = el.booleanOperation || 'union';
      return (
        <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${el.width} ${el.height}`}>
          {operation === 'intersect' && sources.length >= 2 ? (
            <><defs><clipPath id={`boolean-clip-${el.id}`}><path d={sources.slice(1).join(' ')} /></clipPath></defs><path d={sources[0]} fill={fillStyle} clipPath={`url(#boolean-clip-${el.id})`} /></>
          ) : (
            <path d={combined} fill={fillStyle} fillRule={operation === 'union' ? 'nonzero' : 'evenodd'} />
          )}
        </svg>
      );
    }

    if (el.type === 'rectangle' || CONTAINER_TYPES.includes(el.type)) {
      return (
        <div
          className="relative w-full h-full"
          style={{
            ...fillCss,
            borderRadius: el.cornerRadius ? `${el.cornerRadius}px` : '0px',
            boxShadow: boxShadowStyle,
          }}
        >
          <ImageFillLayer element={el} />
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
        <>
        <ImageFillLayer element={el} />
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
        </>
      );
    }

    if (el.type === 'triangle') {
      return (
        <>
        <ImageFillLayer element={el} />
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
        </>
      );
    }

    if (el.type === 'star') {
      return (
        <>
        <ImageFillLayer element={el} />
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
        </>
      );
    }

    if (el.type === 'polygon' || el.type === 'diamond') {
      const points = el.type === 'polygon'
        ? getPolygonPoints(el.width, el.height)
        : getDiamondPoints(el.width, el.height);
      return (
        <>
        <ImageFillLayer element={el} />
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
        </>
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

    if (el.type === 'vector') {
      return (
        <>
          <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${el.width} ${el.height}`}>
            <path d={getVectorPathD(el)} fill={el.vectorClosed ? fillStyle : 'none'} stroke={strokeStyle === 'transparent' ? fillStyle : strokeStyle} strokeWidth={Math.max(1, el.strokeWidth || 2)} strokeDasharray={strokeDash} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          {activeTool === 'node' && selectedIds.includes(el.id) && el.vectorPath?.map((point, index) => (
            <button
              key={`${el.id}-node-${index}`}
              type="button"
              aria-label={`Vector node ${index + 1}`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                capturePointer(event.pointerId);
                setDragState({ type: 'node', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, initialElements: [createSnapshot(el)], cornerIndex: index });
              }}
              className="absolute z-50 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-[#0d99ff] bg-white shadow-sm"
              style={{ left: `${point.x * el.width}px`, top: `${point.y * el.height}px` }}
            />
          ))}
        </>
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
    const renderedElement = resolveElementTokens(el, tokens);
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
          width: `${renderedElement.width}px`,
          height: `${renderedElement.height}px`,
          transform: `rotate(${el.rotation || 0}deg)`,
          transformOrigin: 'center center',
          opacity: renderedElement.opacity,
          zIndex: layerIndex + 1,
          clipPath: getMaskClipPath(el),
        }}
      >
        {CONTAINER_TYPES.includes(el.type) ? (
          <div
            className="absolute inset-0"
            style={{ overflow: el.clipContent ? 'hidden' : 'visible' }}
          >
            {renderShapeContent(renderedElement)}
            {elements
              .filter((child) => child.parentId === el.id)
              .map((child, childIndex) => renderNestedElement(child, childIndex))}
          </div>
        ) : renderShapeContent(renderedElement)}

        {(el.type === 'component' || el.type === 'instance') && (
          <div
            className={`pointer-events-none absolute inset-0 border ${
              el.type === 'component' ? 'border-[#9747ff]' : 'border-dashed border-[#9747ff]'
            }`}
          />
        )}

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
        {renderPrototypeHandles(el, (isSingleSelected && !isEditing) || prototypeConnectionDraft?.targetElementId === el.id)}
      </div>
    );
  };

  // Render a top-level element (Frame or root Canvas shape)
  const renderRootElement = (el: CanvasElement, layerIndex: number) => {
    if (!el.visible) return null;
    const renderedElement = resolveElementTokens(el, tokens);

    const isSelected = selectedIds.includes(el.id);
    const isSingleSelected = selectedIds.length === 1 && isSelected;
    const isEditing = editingTextId === el.id;

    const fillCss: React.CSSProperties = renderedElement.imageFill ? { backgroundColor: 'transparent' } : getElementCssFill(renderedElement);
    const strokeStyle =
      renderedElement.strokeWidth > 0 ? hexToRgba(renderedElement.stroke, renderedElement.strokeOpacity) : 'transparent';
    let boxShadowStyle = 'none';
    if (renderedElement.shadow) {
      const s = renderedElement.shadow;
      const shadowColor = hexToRgba(s.color, s.opacity);
      boxShadowStyle = `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${shadowColor}`;
    }

    // 1. Frame Node (Container that holds nested children)
    if (CONTAINER_TYPES.includes(el.type)) {
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
            width: `${renderedElement.width}px`,
            height: `${renderedElement.height}px`,
            transform: `rotate(${el.rotation || 0}deg)`,
            transformOrigin: 'center center',
            opacity: renderedElement.opacity,
            zIndex: layerIndex + 1,
            clipPath: getMaskClipPath(el),
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
            <span className={`font-mono font-bold ${el.type === 'frame' ? 'text-[#0d99ff]' : 'text-[#9747ff]'}`}>
              {el.type === 'frame' ? '#' : el.type === 'component' ? '◆' : '◇'}
            </span>
            <span>{el.name}</span>
          </div>

          {/* Frame Background Body with Clip Content Support */}
          <div
            className="w-full h-full absolute inset-0 pointer-events-auto"
            style={{
              ...fillCss,
              borderRadius: renderedElement.cornerRadius ? `${renderedElement.cornerRadius}px` : '0px',
              boxShadow: boxShadowStyle,
              overflow: el.clipContent ? 'hidden' : 'visible',
            }}
          >
            <ImageFillLayer element={renderedElement} />
            {/* Direct nested children rendered inside this frame DOM container */}
            {children.map((child, childIndex) => renderNestedElement(child, childIndex))}
          </div>

          {renderedElement.strokeWidth > 0 && (
            <div className="absolute inset-0 z-[2]" style={getCssStrokeOverlayStyle(renderedElement, strokeStyle)} />
          )}

          {(el.type === 'component' || el.type === 'instance') && (
            <div className={`pointer-events-none absolute inset-0 z-[3] border ${el.type === 'component' ? 'border-[#9747ff]' : 'border-dashed border-[#9747ff]'}`} />
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
          {renderPrototypeHandles(el, isSingleSelected || prototypeConnectionDraft?.targetElementId === el.id)}
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
          clipPath: getMaskClipPath(el),
        }}
      >
        {renderShapeContent(renderedElement)}

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
        {renderPrototypeHandles(el, (isSingleSelected && !isEditing) || prototypeConnectionDraft?.targetElementId === el.id)}
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
        {appMode === 'prototype' && (
          <svg className="pointer-events-none absolute left-0 top-0 z-30 h-px w-px overflow-visible" aria-label="Prototype connections">
            {elements.flatMap((source) => (source.interactions || []).flatMap((interaction) => {
              const target = elements.find((element) => element.id === interaction.destinationElementId)
                || elements.find((element) => element.id === interaction.destinationFrameId && element.type === 'frame' && !element.parentId);
              if (!target) return [];
              const from = getWorldRect(source, elements);
              const to = getWorldRect(target, elements);
              const sourceSide = interaction.sourceAnchor || 'right';
              const destinationSide = interaction.destinationAnchor || 'left';
              const start = getConnectionAnchorPoint(from, sourceSide);
              const end = getConnectionAnchorPoint(to, destinationSide);
              return [
                <g key={`${source.id}-${interaction.id}`}>
                  <path d={getPrototypeCurvePath(start, sourceSide, end, destinationSide)} fill="none" stroke="#0d99ff" strokeWidth={Math.max(1.5, 2 / zoom)} />
                  <circle cx={start.x} cy={start.y} r={Math.max(2.5, 3.5 / zoom)} fill="#0d99ff" />
                  <circle cx={end.x} cy={end.y} r={Math.max(3, 4 / zoom)} fill="#0d99ff" />
                </g>,
              ];
            }))}
            {prototypeConnectionDraft && (() => {
              const source = elements.find((element) => element.id === prototypeConnectionDraft.sourceId);
              if (!source) return null;
              const start = getConnectionAnchorPoint(getWorldRect(source, elements), prototypeConnectionDraft.sourceAnchor);
              const target = prototypeConnectionDraft.targetElementId
                ? elements.find((element) => element.id === prototypeConnectionDraft.targetElementId)
                : undefined;
              const destinationSide = prototypeConnectionDraft.targetAnchor
                || PROTOTYPE_OPPOSITE_SIDE[prototypeConnectionDraft.sourceAnchor];
              const end = target && prototypeConnectionDraft.targetAnchor
                ? getConnectionAnchorPoint(getWorldRect(target, elements), prototypeConnectionDraft.targetAnchor)
                : prototypeConnectionDraft.pointer;
              return (
                <g aria-label="Prototype connection preview">
                  <path
                    d={getPrototypeCurvePath(start, prototypeConnectionDraft.sourceAnchor, end, destinationSide)}
                    fill="none"
                    stroke="#0d99ff"
                    strokeDasharray={target ? undefined : `${Math.max(3, 5 / zoom)} ${Math.max(2, 4 / zoom)}`}
                    strokeWidth={Math.max(1.75, 2.25 / zoom)}
                  />
                  <circle cx={end.x} cy={end.y} r={Math.max(3.5, 4.5 / zoom)} fill="#0d99ff" />
                </g>
              );
            })()}
          </svg>
        )}
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
