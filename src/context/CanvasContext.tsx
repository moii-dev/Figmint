import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  CanvasElement,
  ToolType,
  DevicePreset,
  Point,
  FigmaProject,
  LinearGradientFill,
  DesignToken,
  DesignTokenCategory,
  TokenBindableProperty,
} from '../types/figma';
import {
  INITIAL_PROJECTS,
  SAMPLE_BANKING_ELEMENTS,
} from '../data/sampleCanvas';
import { buildStarterComponent, StarterComponentKind } from '../data/uiKit';
import {
  ClipboardPayload,
  parseClipboardPayload,
  serializeClipboardPayload,
} from '../utils/clipboard';
import {
  getBoundingBox,
  generateSvgString,
  downloadFile,
  downloadPngFromSvg,
} from '../utils/geometry';
import {
  reparentElement,
  getWorldPosition,
  getWorldRect,
  findFrameAtPoint,
  getAllDescendantIds,
  canReparentElement,
  getTopLevelSelectionIds,
  worldToLocalPosition,
  isAncestor,
} from '../utils/hierarchy';
import { applyAutoLayout, DEFAULT_LAYOUT_PADDING } from '../utils/layout';
import {
  createInstanceTree,
  detachInstanceTree,
  detachOrphanedInstances,
  getInstanceRoot,
  recordInstanceOverride,
  syncInstances,
} from '../utils/components';
import {
  bindElementToken,
  DEFAULT_DESIGN_TOKENS,
  removeTokenAndMaterialize,
  resolveElementTokens,
} from '../utils/tokens';
import {
  loadProjectsFromIndexedDb,
  persistProjects,
  readActiveProjectId,
  readProjectsFromLocalStorage,
  mergeLatestProjectState,
  writeLocalStorageFallback,
} from '../utils/projectStorage';
const IMPORTABLE_TYPES = new Set([
  'frame',
  'rectangle',
  'ellipse',
  'triangle',
  'polygon',
  'diamond',
  'star',
  'text',
  'line',
  'arrow',
  'image',
  'video',
  'component',
  'instance',
]);
export type SaveStatus = 'loading' | 'saving' | 'saved' | 'error';

interface HistorySnapshot {
  elements: CanvasElement[];
  tokens: DesignToken[];
}

function createElementId(type: CanvasElement['type']): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneElementTree(
  source: CanvasElement[],
  topLevelIds: string[],
  existing: CanvasElement[],
  offset = 20
): { elements: CanvasElement[]; selectedIds: string[] } {
  const sourceIds = new Set(source.map((element) => element.id));
  const idMap = new Map(source.map((element) => [element.id, createElementId(element.type)]));
  const topLevelSet = new Set(topLevelIds);
  const existingIds = new Set(existing.map((element) => element.id));

  const cloned = source.map((element) => {
    const mappedParentId = element.parentId && idMap.get(element.parentId);
    const parentId = mappedParentId || (element.parentId && existingIds.has(element.parentId) ? element.parentId : null);
    const shouldOffset = topLevelSet.has(element.id) || !element.parentId || !sourceIds.has(element.parentId);

    return {
      ...element,
      id: idMap.get(element.id)!,
      name: topLevelSet.has(element.id) ? `${element.name} (Copy)` : element.name,
      parentId,
      mainComponentId: element.mainComponentId
        ? idMap.get(element.mainComponentId) || element.mainComponentId
        : undefined,
      sourceElementId: element.sourceElementId
        ? idMap.get(element.sourceElementId) || element.sourceElementId
        : undefined,
      instanceOverrides: element.instanceOverrides
        ? Object.fromEntries(
            Object.entries(element.instanceOverrides).map(([sourceId, value]) => [idMap.get(sourceId) || sourceId, value])
          )
        : undefined,
      x: shouldOffset ? element.x + offset : element.x,
      y: shouldOffset ? element.y + offset : element.y,
    };
  });

  return {
    elements: cloned,
    selectedIds: topLevelIds.flatMap((id) => (idMap.has(id) ? [idMap.get(id)!] : [])),
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function getMediaDimensions(src: string, type: 'image' | 'video'): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const media = type === 'image' ? new Image() : document.createElement('video');
    const finish = (width: number, height: number) => {
      const safeWidth = Math.max(1, width || 320);
      const safeHeight = Math.max(1, height || 240);
      const scale = Math.min(1, 640 / safeWidth, 480 / safeHeight);
      resolve({ width: Math.round(safeWidth * scale), height: Math.round(safeHeight * scale) });
    };

    if (type === 'image') {
      const image = media as HTMLImageElement;
      image.onload = () => finish(image.naturalWidth, image.naturalHeight);
      image.onerror = () => finish(320, 240);
      image.src = src;
    } else {
      const video = media as HTMLVideoElement;
      video.preload = 'metadata';
      video.onloadedmetadata = () => finish(video.videoWidth, video.videoHeight);
      video.onerror = () => finish(480, 270);
      video.src = src;
    }
  });
}

function normalizeImportedGradients(value: unknown): LinearGradientFill[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Partial<LinearGradientFill>;
    if (!Array.isArray(raw.stops) || raw.stops.length < 2) return [];

    const stops = raw.stops.map((stop, stopIndex) => ({
      color: typeof stop?.color === 'string' ? stop.color : stopIndex === 0 ? '#8B5CF6' : '#06B6D4',
      position: Number.isFinite(stop?.position)
        ? Math.max(0, Math.min(100, Number(stop.position)))
        : (stopIndex / Math.max(1, raw.stops!.length - 1)) * 100,
      opacity: Number.isFinite(stop?.opacity) ? Math.max(0, Math.min(1, Number(stop.opacity))) : 1,
      visible: stop?.visible !== false,
    }));

    return [{
      id: typeof raw.id === 'string' && raw.id ? raw.id : `gradient-import-${index}`,
      type: 'linear' as const,
      angle: Number.isFinite(raw.angle) ? Number(raw.angle) : 135,
      opacity: Number.isFinite(raw.opacity) ? Math.max(0, Math.min(1, Number(raw.opacity))) : 0.82,
      visible: raw.visible !== false,
      stops,
    }];
  });
}

function normalizeImportedElements(value: unknown): CanvasElement[] | null {
  if (!Array.isArray(value)) return null;

  const seenIds = new Set<string>();
  const normalized: CanvasElement[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const raw = item as Partial<CanvasElement>;
    if (
      typeof raw.id !== 'string' ||
      !raw.id.trim() ||
      seenIds.has(raw.id) ||
      typeof raw.type !== 'string' ||
      !IMPORTABLE_TYPES.has(raw.type) ||
      !Number.isFinite(raw.x) ||
      !Number.isFinite(raw.y) ||
      !Number.isFinite(raw.width) ||
      !Number.isFinite(raw.height)
    ) {
      return null;
    }

    seenIds.add(raw.id);
    normalized.push({
      ...raw,
      id: raw.id,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : raw.type,
      type: raw.type,
      x: Number(raw.x),
      y: Number(raw.y),
      width: Math.max(1, Number(raw.width)),
      height: Math.max(1, Number(raw.height)),
      rotation: Number.isFinite(raw.rotation) ? Number(raw.rotation) : 0,
      fill: typeof raw.fill === 'string' ? raw.fill : '#0d99ff',
      fillOpacity: Number.isFinite(raw.fillOpacity) ? Math.max(0, Math.min(1, Number(raw.fillOpacity))) : 1,
      gradients: normalizeImportedGradients(raw.gradients),
      stroke: typeof raw.stroke === 'string' ? raw.stroke : '#000000',
      strokeWidth: Number.isFinite(raw.strokeWidth) ? Math.max(0, Number(raw.strokeWidth)) : 0,
      strokeOpacity: Number.isFinite(raw.strokeOpacity) ? Math.max(0, Math.min(1, Number(raw.strokeOpacity))) : 1,
      strokeStyle: ['solid', 'dashed', 'dotted'].includes(raw.strokeStyle || '') ? raw.strokeStyle! : 'solid',
      strokeAlign: ['inside', 'center', 'outside'].includes(raw.strokeAlign || '') ? raw.strokeAlign! : 'inside',
      cornerRadius: Number.isFinite(raw.cornerRadius) ? Math.max(0, Number(raw.cornerRadius)) : 0,
      opacity: Number.isFinite(raw.opacity) ? Math.max(0, Math.min(1, Number(raw.opacity))) : 1,
      visible: raw.visible !== false,
      locked: raw.locked === true,
      parentId: typeof raw.parentId === 'string' ? raw.parentId : null,
    } as CanvasElement);
  }

  const containerIds = new Set(
    normalized.filter((element) => ['frame', 'component', 'instance'].includes(element.type)).map((element) => element.id)
  );

  return normalized.map((element) => ({
    ...element,
    parentId:
      element.parentId &&
      element.parentId !== element.id &&
      containerIds.has(element.parentId) &&
      !isAncestor(element.id, element.parentId, normalized)
        ? element.parentId
        : null,
  }));
}

function normalizeImportedTokens(value: unknown): DesignToken[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Partial<DesignToken>;
    if (
      typeof raw.id !== 'string' ||
      typeof raw.name !== 'string' ||
      !['color', 'spacing', 'radius'].includes(raw.category || '')
    ) return [];
    if (raw.category === 'color' && typeof raw.value !== 'string') return [];
    if (raw.category !== 'color' && !Number.isFinite(raw.value)) return [];
    return [{
      id: raw.id,
      name: raw.name,
      category: raw.category,
      value: raw.category === 'color' ? raw.value : Math.max(0, Number(raw.value)),
    } as DesignToken];
  });
}

function getOwningComponentMaster(
  elementId: string,
  allElements: CanvasElement[]
): CanvasElement | null {
  let current = allElements.find((element) => element.id === elementId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    if (current.type === 'instance') return null;
    if (current.type === 'component') return current;
    visited.add(current.id);
    current = current.parentId ? allElements.find((element) => element.id === current!.parentId) : undefined;
  }
  return null;
}

function settleDocumentMutation(
  elements: CanvasElement[],
  affectedMasterIds: Iterable<string> = []
): CanvasElement[] {
  let next = applyAutoLayout(elements);
  for (const masterId of new Set(affectedMasterIds)) next = syncInstances(next, masterId);
  next = applyAutoLayout(next);
  return detachOrphanedInstances(next);
}

interface CanvasContextType {
  // Multi-Project Dashboard State
  projects: FigmaProject[];
  currentProjectId: string | null;
  currentProject: FigmaProject | null;
  tokens: DesignToken[];
  viewMode: 'dashboard' | 'editor';
  openDashboard: () => void;
  openProject: (projectId: string) => void;
  createNewProject: (title?: string, template?: 'blank' | 'mobile' | 'desktop') => void;
  duplicateProject: (projectId: string) => void;
  renameProject: (projectId: string, newTitle: string) => void;
  deleteProject: (projectId: string) => void;
  setDocumentName: (title: string) => void;
  saveStatus: SaveStatus;
  saveError: string | null;
  saveWarning: string | null;

  // Editor State
  elements: CanvasElement[];
  selectedIds: string[];
  activeTool: ToolType;
  zoom: number;
  pan: Point;
  gridVisible: boolean;
  rulerVisible: boolean;
  snapToGrid: boolean;
  presentationMode: boolean;
  isFramePickerOpen: boolean;
  appMode: 'design' | 'prototype';
  isLeftSidebarOpen: boolean;
  activeLeftTab: 'layers' | 'assets' | 'variables';
  collapsedFrames: Record<string, boolean>;

  // Setters & Actions
  setTool: (tool: ToolType) => void;
  setSelectedIds: (ids: string[]) => void;
  selectElement: (id: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  zoomToFit: () => void;
  setPan: (pan: Point | ((prev: Point) => Point)) => void;
  setViewportSize: (size: { width: number; height: number }) => void;
  setGridVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  setRulerVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  setSnapToGrid: (snap: boolean | ((prev: boolean) => boolean)) => void;
  setPresentationMode: (mode: boolean) => void;
  setIsFramePickerOpen: (open: boolean) => void;
  setAppMode: (mode: 'design' | 'prototype') => void;
  setIsLeftSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setActiveLeftTab: (tab: 'layers' | 'assets' | 'variables') => void;
  toggleFrameCollapsed: (frameId: string) => void;

  // Element CRUD
  addElement: (element: CanvasElement, recordHistory?: boolean) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>, recordHistory?: boolean) => void;
  updateElements: (updates: { id: string; changes: Partial<CanvasElement> }[], recordHistory?: boolean) => void;
  createComponentFromSelection: () => void;
  createInstance: (masterId: string) => void;
  resetInstance: (instanceId: string) => void;
  detachInstance: (instanceId: string) => void;
  goToMainComponent: (instanceId: string) => void;
  wrapSelectionInAutoLayout: () => void;
  insertStarterComponent: (kind: StarterComponentKind) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteCopied: (serializedPayload?: string) => boolean;
  importMediaFiles: (files: File[], position?: Point) => Promise<void>;
  reorderElement: (id: string, targetIndex: number) => void;
  reparentLayer: (elementId: string, newParentId: string | null, targetIndex?: number) => void;
  bringToFront: () => void;
  sendToBack: () => void;
  bringForward: () => void;
  sendBackward: () => void;

  // Alignment
  alignSelected: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v') => void;

  // Layers & Properties
  toggleVisibility: (id: string) => void;
  toggleLock: (id: string) => void;
  renameElement: (id: string, name: string) => void;
  addToken: (category: DesignTokenCategory) => void;
  updateToken: (tokenId: string, changes: Partial<DesignToken>) => void;
  deleteToken: (tokenId: string) => void;
  bindToken: (elementId: string, property: TokenBindableProperty, tokenId: string | null) => void;

  // Presets & Spawning
  spawnPresetFrame: (preset: DevicePreset, position?: Point) => void;
  createShapeAt: (type: ToolType, point: Point, initialSize?: { width: number; height: number }, parentFrameId?: string | null) => CanvasElement;

  // Frame Nesting & Dropping
  finishInteraction: (movedElementIds?: string[]) => void;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Export / Import
  exportSelected: (format: 'png' | 'svg' | 'json', scale?: number) => void;
  exportAll: (format: 'png' | 'svg' | 'json', scale?: number) => void;
  importJson: (jsonString: string) => boolean;
  resetCanvas: () => void;
}

const CanvasContext = createContext<CanvasContextType | null>(null);

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<FigmaProject[]>(() =>
    readProjectsFromLocalStorage(INITIAL_PROJECTS)
  );

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() =>
    readActiveProjectId(projects)
  );

  const [viewMode, setViewMode] = useState<'dashboard' | 'editor'>('editor');

  const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0] || null;
  const tokens = currentProject?.tokens || DEFAULT_DESIGN_TOKENS;

  // Active Editor State
  const [elements, setElements] = useState<CanvasElement[]>(
    currentProject?.elements || SAMPLE_BANKING_ELEMENTS
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(['frame-banking-app']);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [zoom, setZoomState] = useState<number>(currentProject?.zoom || 0.85);
  const [pan, setPanState] = useState<Point>(currentProject?.pan || { x: 260, y: 40 });
  const [gridVisible, setGridVisible] = useState<boolean>(true);
  const [rulerVisible, setRulerVisible] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [presentationMode, setPresentationMode] = useState<boolean>(false);
  const [isFramePickerOpen, setIsFramePickerOpen] = useState<boolean>(false);
  const [appMode, setAppMode] = useState<'design' | 'prototype'>('design');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [activeLeftTab, setActiveLeftTab] = useState<'layers' | 'assets' | 'variables'>('layers');
  const [collapsedFrames, setCollapsedFrames] = useState<Record<string, boolean>>({});
  const [storageReady, setStorageReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const viewportSizeRef = useRef({ width: 900, height: 700 });
  const persistenceRef = useRef({ projects, currentProjectId, elements, zoom, pan });
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  const saveRequestRef = useRef(0);
  persistenceRef.current = { projects, currentProjectId, elements, zoom, pan };

  // History stack
  const historyRef = useRef<HistorySnapshot[]>([{ elements, tokens }]);
  const historyIndexRef = useRef<number>(0);
  const [, setHistoryTick] = useState(0);

  // IndexedDB is the primary store. Existing localStorage data is used as a synchronous
  // first render and migrated without changing the project data format.
  useEffect(() => {
    let cancelled = false;

    const hydrateProjects = async () => {
      try {
        const storedProjects = await loadProjectsFromIndexedDb();
        if (cancelled) return;

        if (storedProjects?.length) {
          const storedProjectId = readActiveProjectId(storedProjects);
          const targetProject =
            storedProjects.find((project) => project.id === storedProjectId) || storedProjects[0];

          setProjects(storedProjects);
          setCurrentProjectId(targetProject.id);
          setElements(targetProject.elements);
          setZoomState(targetProject.zoom || 0.85);
          setPanState(targetProject.pan || { x: 260, y: 40 });
          setSelectedIds(targetProject.elements.length > 0 ? [targetProject.elements[0].id] : []);
          historyRef.current = [{ elements: targetProject.elements, tokens: targetProject.tokens || DEFAULT_DESIGN_TOKENS }];
          historyIndexRef.current = 0;
        }

        setSaveWarning(null);
        setSaveStatus(storedProjects?.length ? 'saved' : 'saving');
      } catch (error) {
        if (cancelled) return;
        setSaveWarning(
          `IndexedDB is unavailable; Figmint will use limited browser storage. ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        setSaveStatus('saved');
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    };

    void hydrateProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    const requestId = ++saveRequestRef.current;
    setSaveStatus('saving');
    setSaveError(null);

    const timeout = window.setTimeout(() => {
      void persistProjects(projects, currentProjectId)
        .then((result) => {
          if (requestId !== saveRequestRef.current) return;
          setSaveWarning(result.warning || null);
          setSaveStatus('saved');
        })
        .catch((error) => {
          if (requestId !== saveRequestRef.current) return;
          const message = error instanceof Error ? error.message : String(error);
          console.error('Failed to save Figmint projects', error);
          setSaveError(message);
          setSaveStatus('error');
        });
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [currentProjectId, projects, storageReady]);

  const persistLatestEditorState = useCallback(() => {
    const latest = persistenceRef.current;
    const persistedProjects = mergeLatestProjectState(
      latest.projects,
      latest.currentProjectId,
      latest.elements,
      latest.zoom,
      latest.pan
    );

    try {
      writeLocalStorageFallback(persistedProjects, latest.currentProjectId);
    } catch (error) {
      console.warn('Failed to update the emergency localStorage fallback', error);
    }
    void persistProjects(persistedProjects, latest.currentProjectId).catch((error) => {
      console.warn('Failed to persist the latest editor state during page exit', error);
    });
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistLatestEditorState();
    };

    window.addEventListener('pagehide', persistLatestEditorState);
    window.addEventListener('beforeunload', persistLatestEditorState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', persistLatestEditorState);
      window.removeEventListener('beforeunload', persistLatestEditorState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [persistLatestEditorState]);

  // Debounced auto-save current elements and canvas viewport to current project
  useEffect(() => {
    if (!currentProjectId) return;
    if (storageReady) setSaveStatus('saving');
    const timeout = setTimeout(() => {
      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id === currentProjectId) {
            return {
              ...proj,
              elements,
              zoom,
              pan,
              updatedAt: Date.now(),
            };
          }
          return proj;
        })
      );
    }, 400);

    return () => clearTimeout(timeout);
  }, [elements, zoom, pan, currentProjectId, storageReady]);

  const pushHistory = useCallback((newElements: CanvasElement[], newTokens: DesignToken[] = tokens) => {
    const snapshot = JSON.parse(JSON.stringify({ elements: newElements, tokens: newTokens })) as HistorySnapshot;
    const currentSnapshot = historyRef.current[historyIndexRef.current];
    if (currentSnapshot && JSON.stringify(currentSnapshot) === JSON.stringify(snapshot)) return;

    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(snapshot);
    if (nextHistory.length > 50) nextHistory.shift();
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    setHistoryTick((t) => t + 1);
  }, [tokens]);

  // Project Actions
  const openDashboard = useCallback(() => {
    setProjects((previousProjects) =>
      mergeLatestProjectState(previousProjects, currentProjectId, elements, zoom, pan)
    );
    setViewMode('dashboard');
    setSelectedIds([]);
  }, [currentProjectId, elements, pan, zoom]);

  const openProject = useCallback((projectId: string) => {
    const target = projects.find((p) => p.id === projectId);
    if (!target) return;
    setProjects((previousProjects) =>
      mergeLatestProjectState(previousProjects, currentProjectId, elements, zoom, pan)
    );
    setCurrentProjectId(projectId);
    setElements(target.elements);
    setZoomState(target.zoom || 0.85);
    setPanState(target.pan || { x: 260, y: 40 });
    setSelectedIds(target.elements.length > 0 ? [target.elements[0].id] : []);
    historyRef.current = [{ elements: target.elements, tokens: target.tokens || DEFAULT_DESIGN_TOKENS }];
    historyIndexRef.current = 0;
    setViewMode('editor');
  }, [currentProjectId, elements, pan, projects, zoom]);

  const createNewProject = useCallback(
    (title = 'Untitled Design', template: 'blank' | 'mobile' | 'desktop' = 'blank') => {
      const newId = `proj-${Date.now()}`;
      let initialEls: CanvasElement[] = [];

      if (template === 'mobile') {
        initialEls = [
          {
            id: `frame-${Date.now()}`,
            name: 'iPhone 16 Pro',
            type: 'frame',
            x: 100,
            y: 60,
            width: 393,
            height: 852,
            rotation: 0,
            fill: '#ffffff',
            fillOpacity: 1,
            stroke: '#e2e8f0',
            strokeWidth: 0,
            strokeOpacity: 1,
            strokeStyle: 'solid',
            strokeAlign: 'inside',
            cornerRadius: 44,
            opacity: 1,
            visible: true,
            locked: false,
            clipContent: true,
            presetName: 'iPhone 16 Pro',
            shadow: { x: 0, y: 20, blur: 40, spread: -5, color: '#000000', opacity: 0.15 },
          },
        ];
      } else if (template === 'desktop') {
        initialEls = [
          {
            id: `frame-${Date.now()}`,
            name: 'Desktop - 1440',
            type: 'frame',
            x: 80,
            y: 60,
            width: 1280,
            height: 800,
            rotation: 0,
            fill: '#ffffff',
            fillOpacity: 1,
            stroke: '#e2e8f0',
            strokeWidth: 0,
            strokeOpacity: 1,
            strokeStyle: 'solid',
            strokeAlign: 'inside',
            cornerRadius: 12,
            opacity: 1,
            visible: true,
            locked: false,
            clipContent: true,
            presetName: 'Desktop',
            shadow: { x: 0, y: 20, blur: 40, spread: -5, color: '#000000', opacity: 0.15 },
          },
        ];
      }

      const newProj: FigmaProject = {
        id: newId,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        elements: initialEls,
        tokens: DEFAULT_DESIGN_TOKENS,
        zoom: 0.85,
        pan: { x: 260, y: 40 },
      };

      setProjects((previousProjects) => [
        newProj,
        ...mergeLatestProjectState(previousProjects, currentProjectId, elements, zoom, pan),
      ]);
      setCurrentProjectId(newId);
      setElements(initialEls);
      setZoomState(0.85);
      setPanState({ x: 260, y: 40 });
      setSelectedIds(initialEls.length > 0 ? [initialEls[0].id] : []);
      historyRef.current = [{ elements: initialEls, tokens: DEFAULT_DESIGN_TOKENS }];
      historyIndexRef.current = 0;
      setViewMode('editor');
    },
    [currentProjectId, elements, pan, zoom]
  );

  const duplicateProject = useCallback(
    (projectId: string) => {
      const source = projects.find((p) => p.id === projectId);
      if (!source) return;

      const dupId = `proj-${Date.now()}`;
      const duplicate: FigmaProject = {
        ...source,
        id: dupId,
        title: `${source.title} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        elements: JSON.parse(JSON.stringify(source.elements)),
      };

      setProjects((prev) => [duplicate, ...prev]);
    },
    [projects]
  );

  const renameProject = useCallback((projectId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, title: newTitle.trim(), updatedAt: Date.now() } : p))
    );
  }, []);

  const deleteProject = useCallback(
    (projectId: string) => {
      setProjects((prev) => {
        const filtered = prev.filter((p) => p.id !== projectId);
        if (filtered.length === 0) {
          return INITIAL_PROJECTS;
        }
        return filtered;
      });

      if (currentProjectId === projectId) {
        const remaining = projects.filter((p) => p.id !== projectId);
        if (remaining.length > 0) {
          openProject(remaining[0].id);
        } else {
          openProject(INITIAL_PROJECTS[0].id);
        }
      }
    },
    [currentProjectId, projects, openProject]
  );

  const setDocumentName = useCallback(
    (title: string) => {
      if (!currentProjectId) return;
      renameProject(currentProjectId, title);
    },
    [currentProjectId, renameProject]
  );

  // Viewport / Zoom Tools
  const setTool = useCallback((tool: ToolType) => {
    setActiveTool(tool);
    if (tool === 'frame') {
      setIsFramePickerOpen(true);
    }
  }, []);

  const setZoom = useCallback((zoomArg: number | ((prev: number) => number)) => {
    setZoomState((prev) => {
      const next = typeof zoomArg === 'function' ? zoomArg(prev) : zoomArg;
      return Math.max(0.05, Math.min(5.0, Number(next.toFixed(2))));
    });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(5, z * 1.2));
  }, [setZoom]);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(0.1, z / 1.2));
  }, [setZoom]);

  const zoomReset = useCallback(() => {
    setZoom(1);
    setPanState({ x: 100, y: 50 });
  }, [setZoom]);

  const zoomToFit = useCallback(() => {
    const box = getBoundingBox(elements.filter((element) => !element.parentId));
    if (!box) {
      zoomReset();
      return;
    }
    const canvasWidth = Math.max(240, viewportSizeRef.current.width);
    const canvasHeight = Math.max(240, viewportSizeRef.current.height);
    const scaleX = (canvasWidth - 96) / box.width;
    const scaleY = (canvasHeight - 140) / box.height;
    const targetZoom = Math.max(0.15, Math.min(1.5, Math.min(scaleX, scaleY)));

    const targetPanX = (canvasWidth - box.width * targetZoom) / 2 - box.x * targetZoom;
    const targetPanY = (canvasHeight - box.height * targetZoom) / 2 - box.y * targetZoom - 20;

    setZoom(targetZoom);
    setPanState({ x: targetPanX, y: targetPanY });
  }, [elements, zoomReset, setZoom]);

  const setPan = useCallback((panArg: Point | ((prev: Point) => Point)) => {
    setPanState((prev) => (typeof panArg === 'function' ? panArg(prev) : panArg));
  }, []);

  const setViewportSize = useCallback((size: { width: number; height: number }) => {
    viewportSizeRef.current = size;
  }, []);

  const selectElement = useCallback((id: string, multiSelect = false) => {
    setSelectedIds((prev) => {
      const next = multiSelect
        ? prev.includes(id)
          ? prev.filter((item) => item !== id)
          : [...prev, id]
        : [id];
      return getTopLevelSelectionIds(next, elements);
    });
  }, [elements]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const toggleFrameCollapsed = useCallback((frameId: string) => {
    setCollapsedFrames((prev) => ({ ...prev, [frameId]: !prev[frameId] }));
  }, []);

  // Element Actions
  const addElement = useCallback(
    (element: CanvasElement, recordHistory = true) => {
      setElements((prev) => {
        const master = element.parentId ? getOwningComponentMaster(element.parentId, prev) : null;
        const next = settleDocumentMutation([...prev, element], master ? [master.id] : []);
        if (recordHistory) pushHistory(next);
        return next;
      });
      setSelectedIds([element.id]);
    },
    [pushHistory]
  );

  const updateElement = useCallback(
    (id: string, updates: Partial<CanvasElement>, recordHistory = true) => {
      setElements((prev) => {
        const master = getOwningComponentMaster(id, prev);
        const target = prev.find((element) => element.id === id);
        const instanceRoot = target ? getInstanceRoot(target, prev) : null;
        const overrideKeys = new Set(['textContent', 'fill', 'fillOpacity', 'visible']);
        const rootKeys = new Set(['x', 'y', 'width', 'height', 'rotation', 'opacity', 'name']);
        const effectiveUpdates = instanceRoot
          ? Object.fromEntries(Object.entries(updates).filter(([key]) =>
              overrideKeys.has(key) || (target?.id === instanceRoot.id && rootKeys.has(key))
            )) as Partial<CanvasElement>
          : updates;
        if (Object.keys(effectiveUpdates).length === 0) return prev;
        let next = prev.map((el) => (el.id === id ? { ...el, ...effectiveUpdates } : el));
        if (target && instanceRoot) next = recordInstanceOverride(next, id, effectiveUpdates);
        if (recordHistory) next = settleDocumentMutation(next, master ? [master.id] : []);
        if (recordHistory) pushHistory(next);
        return next;
      });
    },
    [pushHistory]
  );

  const updateElements = useCallback(
    (updates: { id: string; changes: Partial<CanvasElement> }[], recordHistory = true) => {
      setElements((prev) => {
        const effective = updates.flatMap((update) => {
          const target = prev.find((element) => element.id === update.id);
          const instanceRoot = target ? getInstanceRoot(target, prev) : null;
          if (!instanceRoot) return [update];
          const overrideKeys = new Set(['textContent', 'fill', 'fillOpacity', 'visible']);
          const rootKeys = new Set(['x', 'y', 'width', 'height', 'rotation', 'opacity', 'name']);
          const changes = Object.fromEntries(Object.entries(update.changes).filter(([key]) =>
            overrideKeys.has(key) || (target?.id === instanceRoot.id && rootKeys.has(key))
          )) as Partial<CanvasElement>;
          return Object.keys(changes).length > 0 ? [{ id: update.id, changes }] : [];
        });
        if (effective.length === 0) return prev;
        const map = new Map(effective.map((u) => [u.id, u.changes]));
        const affectedMasters = updates.flatMap((update) => {
          const master = getOwningComponentMaster(update.id, prev);
          return master ? [master.id] : [];
        });
        let next = prev.map((el) => {
          if (map.has(el.id)) {
            return { ...el, ...map.get(el.id)! };
          }
          return el;
        });
        effective.forEach((update) => {
          const target = prev.find((element) => element.id === update.id);
          if (target && getInstanceRoot(target, prev)) {
            next = recordInstanceOverride(next, update.id, update.changes);
          }
        });
        if (recordHistory) next = settleDocumentMutation(next, affectedMasters);
        if (recordHistory) pushHistory(next);
        return next;
      });
    },
    [pushHistory]
  );

  const createComponentFromSelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    setElements((prev) => {
      const topLevelIds = getTopLevelSelectionIds(selectedIds, prev);
      const selected = topLevelIds.flatMap((id) => {
        const element = prev.find((item) => item.id === id);
        return element ? [element] : [];
      });
      if (selected.length === 0) return prev;
      if (selected.some((element) => getInstanceRoot(element, prev))) return prev;

      if (selected.length === 1 && ['frame', 'component'].includes(selected[0].type)) {
        const componentId = selected[0].id;
        const next = settleDocumentMutation(
          prev.map((element) => element.id === componentId
            ? { ...element, type: 'component', name: element.type === 'component' ? element.name : `Component / ${element.name}` }
            : element),
          [componentId]
        );
        pushHistory(next);
        setSelectedIds([componentId]);
        return next;
      }

      const rects = selected.map((element) => getWorldRect(element, prev));
      const minX = Math.min(...rects.map((rect) => rect.x));
      const minY = Math.min(...rects.map((rect) => rect.y));
      const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
      const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
      const componentId = createElementId('component');
      const component: CanvasElement = {
        id: componentId,
        name: 'Component / New',
        type: 'component',
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        rotation: 0,
        fill: '#ffffff',
        fillOpacity: 0,
        stroke: '#9747ff',
        strokeWidth: 1,
        strokeOpacity: 1,
        strokeStyle: 'solid',
        strokeAlign: 'inside',
        cornerRadius: 0,
        opacity: 1,
        visible: true,
        locked: false,
        clipContent: false,
        parentId: null,
      };
      const selectedSet = new Set(topLevelIds);
      const next = settleDocumentMutation([
        ...prev.map((element) => {
          if (!selectedSet.has(element.id)) return element;
          const world = getWorldPosition(element, prev);
          return { ...element, parentId: componentId, x: world.x - minX, y: world.y - minY };
        }),
        component,
      ], [componentId]);
      pushHistory(next);
      setSelectedIds([componentId]);
      return next;
    });
  }, [pushHistory, selectedIds]);

  const createInstance = useCallback((masterId: string) => {
    setElements((prev) => {
      const master = prev.find((element) => element.id === masterId && element.type === 'component');
      if (!master) return prev;
      const viewportPosition = {
        x: Math.round((-pan.x + viewportSizeRef.current.width / 2) / zoom - master.width / 2),
        y: Math.round((-pan.y + viewportSizeRef.current.height / 2) / zoom - master.height / 2),
      };
      const position = Math.abs(viewportPosition.x - master.x) < 32 && Math.abs(viewportPosition.y - master.y) < 32
        ? { x: master.x + master.width + 80, y: master.y }
        : viewportPosition;
      const created = createInstanceTree(masterId, prev, position);
      if (!created) return prev;
      const next = settleDocumentMutation([...prev, ...created.elements]);
      pushHistory(next);
      setSelectedIds([created.rootId]);
      setActiveLeftTab('layers');
      return next;
    });
  }, [pan.x, pan.y, pushHistory, zoom]);

  const resetInstance = useCallback((instanceId: string) => {
    setElements((prev) => {
      const instance = prev.find((element) => element.id === instanceId && element.type === 'instance');
      if (!instance?.mainComponentId) return prev;
      const cleared = prev.map((element) => element.id === instanceId ? { ...element, instanceOverrides: {} } : element);
      const next = settleDocumentMutation(syncInstances(cleared, instance.mainComponentId));
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const detachInstance = useCallback((instanceId: string) => {
    setElements((prev) => {
      const next = detachInstanceTree(prev, instanceId);
      if (next === prev) return prev;
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const goToMainComponent = useCallback((instanceId: string) => {
    const instance = elements.find((element) => element.id === instanceId && element.type === 'instance');
    const master = instance?.mainComponentId
      ? elements.find((element) => element.id === instance.mainComponentId)
      : null;
    if (!master) return;
    const world = getWorldPosition(master, elements);
    setSelectedIds([master.id]);
    setPanState({
      x: viewportSizeRef.current.width / 2 - (world.x + master.width / 2) * zoom,
      y: viewportSizeRef.current.height / 2 - (world.y + master.height / 2) * zoom,
    });
  }, [elements, zoom]);

  const wrapSelectionInAutoLayout = useCallback(() => {
    if (selectedIds.length === 0) return;
    setElements((prev) => {
      const topLevelIds = getTopLevelSelectionIds(selectedIds, prev);
      const selected = topLevelIds.flatMap((id) => {
        const element = prev.find((item) => item.id === id);
        return element ? [element] : [];
      });
      if (selected.length === 0) return prev;
      if (selected.some((element) => getInstanceRoot(element, prev))) return prev;
      const directContainer = selected.length === 1 && ['frame', 'component'].includes(selected[0].type)
        ? selected[0]
        : null;
      if (directContainer) {
        const next = settleDocumentMutation(prev.map((element) => element.id === directContainer.id ? {
          ...element,
          layoutMode: element.layoutMode && element.layoutMode !== 'none' ? element.layoutMode : 'horizontal',
          layoutGap: element.layoutGap ?? 8,
          layoutPadding: element.layoutPadding || DEFAULT_LAYOUT_PADDING,
          layoutPrimaryAlign: element.layoutPrimaryAlign || 'start',
          layoutCounterAlign: element.layoutCounterAlign || 'center',
          layoutSizingHorizontal: element.layoutSizingHorizontal || 'fixed',
          layoutSizingVertical: element.layoutSizingVertical || 'fixed',
        } : element), [directContainer.type === 'component' ? directContainer.id : '']);
        pushHistory(next);
        return next;
      }

      const rects = selected.map((element) => getWorldRect(element, prev));
      const minX = Math.min(...rects.map((rect) => rect.x));
      const minY = Math.min(...rects.map((rect) => rect.y));
      const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
      const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
      const mode = maxX - minX >= maxY - minY ? 'horizontal' as const : 'vertical' as const;
      const frameId = createElementId('frame');
      const sharedParentId = selected.every((element) => (element.parentId || null) === (selected[0].parentId || null))
        ? selected[0].parentId || null
        : null;
      const localFramePosition = worldToLocalPosition({ x: minX - 12, y: minY - 12 }, sharedParentId, prev);
      const frame: CanvasElement = {
        id: frameId, name: 'Auto Layout', type: 'frame', x: localFramePosition.x, y: localFramePosition.y,
        width: maxX - minX + 24, height: maxY - minY + 24, rotation: 0,
        fill: '#ffffff', fillOpacity: 1, stroke: '#000000', strokeWidth: 0,
        strokeOpacity: 1, strokeStyle: 'solid', strokeAlign: 'inside', cornerRadius: 12,
        opacity: 1, visible: true, locked: false, clipContent: false, parentId: sharedParentId,
        layoutMode: mode, layoutGap: 8, layoutPadding: DEFAULT_LAYOUT_PADDING,
        layoutPrimaryAlign: 'start', layoutCounterAlign: 'center',
        layoutSizingHorizontal: 'fixed', layoutSizingVertical: 'fixed',
      };
      const ordered = [...selected].sort((a, b) => {
        const aw = getWorldPosition(a, prev);
        const bw = getWorldPosition(b, prev);
        return mode === 'horizontal' ? aw.x - bw.x : aw.y - bw.y;
      });
      const selectedSet = new Set(topLevelIds);
      const outerMaster = sharedParentId ? getOwningComponentMaster(sharedParentId, prev) : null;
      const next = settleDocumentMutation([
        ...prev.filter((element) => !selectedSet.has(element.id)),
        frame,
        ...ordered.map((element) => ({ ...element, parentId: frameId })),
      ], outerMaster ? [outerMaster.id] : []);
      pushHistory(next);
      setSelectedIds([frameId]);
      return next;
    });
  }, [pushHistory, selectedIds]);

  const insertStarterComponent = useCallback((kind: StarterComponentKind) => {
    const existingMaster = elements.find(
      (element) => element.type === 'component' && element.presetName === `ui-kit:${kind}`
    );
    if (existingMaster) {
      createInstance(existingMaster.id);
      return;
    }

    setElements((prev) => {
      const position = {
        x: Math.round((-pan.x + viewportSizeRef.current.width / 2) / zoom - 120),
        y: Math.round((-pan.y + viewportSizeRef.current.height / 2) / zoom - 50),
      };
      const tree = buildStarterComponent(kind, position);
      const root = tree[0];
      const next = settleDocumentMutation([...prev, ...tree], [root.id]);
      pushHistory(next);
      setSelectedIds([root.id]);
      setActiveLeftTab('layers');
      return next;
    });
  }, [createInstance, elements, pan.x, pan.y, pushHistory, zoom]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    setElements((prev) => {
      const affectedMasters = selectedIds.flatMap((id) => {
        const master = getOwningComponentMaster(id, prev);
        return master ? [master.id] : [];
      });
      // Collect all selected IDs + their descendant children
      const toDelete = new Set<string>(selectedIds);
      selectedIds.forEach((id) => {
        const descendants = getAllDescendantIds(id, prev);
        descendants.forEach((d) => toDelete.add(d));
      });

      const next = settleDocumentMutation(
        prev.filter((el) => !toDelete.has(el.id)),
        affectedMasters
      );
      pushHistory(next);
      return next;
    });
    setSelectedIds([]);
  }, [selectedIds, pushHistory]);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    setElements((prev) => {
      const topLevelIds = getTopLevelSelectionIds(selectedIds, prev);
      const copyIds = new Set(topLevelIds);
      topLevelIds.forEach((id) => getAllDescendantIds(id, prev).forEach((childId) => copyIds.add(childId)));
      const source = prev.filter((element) => copyIds.has(element.id));
      const cloned = cloneElementTree(source, topLevelIds, prev);
      const next = settleDocumentMutation([...prev, ...cloned.elements]);
      pushHistory(next);
      setSelectedIds(cloned.selectedIds);
      return next;
    });
  }, [selectedIds, pushHistory]);

  const copySelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const topLevelIds = getTopLevelSelectionIds(selectedIds, elements);
    const copyIds = new Set(topLevelIds);
    topLevelIds.forEach((id) => getAllDescendantIds(id, elements).forEach((childId) => copyIds.add(childId)));
    const payload: ClipboardPayload = {
      version: 2,
      elements: elements.filter((element) => copyIds.has(element.id)),
      topLevelIds,
      sourceProjectId: currentProjectId,
    };
    clipboardRef.current = payload;
    void navigator.clipboard?.writeText(serializeClipboardPayload(payload)).catch(() => undefined);
  }, [currentProjectId, elements, selectedIds]);

  const pasteCopied = useCallback((serializedPayload?: string): boolean => {
    let payload = clipboardRef.current;
    if (serializedPayload) {
      const parsed = parseClipboardPayload(serializedPayload);
      if (parsed) payload = parsed;
      else return false;
    }
    if (!payload?.elements.length) return false;

    setElements((prev) => {
      const cloned = cloneElementTree(payload!.elements, payload!.topLevelIds, prev, 24);
      let next = settleDocumentMutation([...prev, ...cloned.elements]);
      if (payload!.version === 1 || payload!.sourceProjectId !== currentProjectId) {
        cloned.selectedIds.forEach((id) => {
          if (next.find((element) => element.id === id)?.type === 'instance') {
            next = detachInstanceTree(next, id);
          }
        });
      }
      pushHistory(next);
      setSelectedIds(cloned.selectedIds);
      return next;
    });
    clipboardRef.current = payload;
    return true;
  }, [currentProjectId, pushHistory]);

  const reorderElement = useCallback(
    (id: string, targetIndex: number) => {
      setElements((prev) => {
        const index = prev.findIndex((el) => el.id === id);
        if (index === -1) return prev;
        const next = [...prev];
        const [removed] = next.splice(index, 1);
        next.splice(targetIndex, 0, removed);
        pushHistory(next);
        return next;
      });
    },
    [pushHistory]
  );

  const reparentLayer = useCallback(
    (elementId: string, newParentId: string | null, targetIndex?: number) => {
      setElements((prev) => {
        const targetElement = prev.find((el) => el.id === elementId);
        if (!targetElement) return prev;

        if (!canReparentElement(targetElement, newParentId, prev)) return prev;
        const oldMaster = getOwningComponentMaster(elementId, prev);
        const newMaster = newParentId ? getOwningComponentMaster(newParentId, prev) : null;

        const { x, y, parentId } = reparentElement(targetElement, newParentId, prev);
        const updated = prev.map((el) =>
          el.id === elementId ? { ...el, x, y, parentId } : el
        );

        if (typeof targetIndex === 'number') {
          const idx = updated.findIndex((el) => el.id === elementId);
          if (idx !== -1) {
            const [item] = updated.splice(idx, 1);
            updated.splice(targetIndex, 0, item);
          }
        }

        const next = settleDocumentMutation(updated, [oldMaster?.id || '', newMaster?.id || '']);
        pushHistory(next);
        return next;
      });
    },
    [pushHistory]
  );

  // Commit one complete pointer interaction and apply frame nesting atomically.
  const finishInteraction = useCallback(
    (elementIds: string[] = []) => {
      setElements((prev) => {
        let next = [...prev];
        const affectedMasters = elementIds.flatMap((id) => {
          const master = getOwningComponentMaster(id, prev);
          return master ? [master.id] : [];
        });

        for (const elId of elementIds) {
          const el = next.find((item) => item.id === elId);
          if (!el || el.type === 'component') continue;

          const currentParent = el.parentId ? next.find((item) => item.id === el.parentId) : null;
          if (currentParent?.layoutMode && currentParent.layoutMode !== 'none') {
            const siblings = next
              .filter((item) => item.parentId === currentParent.id && item.layoutPositioning !== 'absolute')
              .sort((a, b) => currentParent.layoutMode === 'horizontal'
                ? a.x + a.width / 2 - (b.x + b.width / 2)
                : a.y + a.height / 2 - (b.y + b.height / 2));
            const siblingIds = new Set(siblings.map((item) => item.id));
            const insertionIndex = Math.min(...next.flatMap((item, index) => siblingIds.has(item.id) ? [index] : []));
            next = next.filter((item) => !siblingIds.has(item.id));
            next.splice(Number.isFinite(insertionIndex) ? insertionIndex : next.length, 0, ...siblings);
          }

          // Calculate center world coordinate of the element
          const worldPos = getWorldPosition(el, next);
          const centerPt: Point = {
            x: worldPos.x + el.width / 2,
            y: worldPos.y + el.height / 2,
          };

          // Find if there is a frame at this point
          const targetFrame = findFrameAtPoint(centerPt, next, elementIds);

          const targetParentId = targetFrame ? targetFrame.id : null;
          if ((el.parentId || null) !== targetParentId) {
            const { x, y, parentId } = reparentElement(el, targetParentId, next);
            const index = next.findIndex((item) => item.id === elId);
            if (index !== -1) {
              next[index] = { ...next[index], x, y, parentId };
            }
          }
        }

        next = settleDocumentMutation(next, affectedMasters);
        pushHistory(next);
        return next;
      });
    },
    [pushHistory]
  );

  const bringToFront = useCallback(() => {
    if (selectedIds.length === 0) return;
    setElements((prev) => {
      const unselected = prev.filter((el) => !selectedIds.includes(el.id));
      const selected = prev.filter((el) => selectedIds.includes(el.id));
      const next = [...unselected, ...selected];
      pushHistory(next);
      return next;
    });
  }, [selectedIds, pushHistory]);

  const sendToBack = useCallback(() => {
    if (selectedIds.length === 0) return;
    setElements((prev) => {
      const unselected = prev.filter((el) => !selectedIds.includes(el.id));
      const selected = prev.filter((el) => selectedIds.includes(el.id));
      const next = [...selected, ...unselected];
      pushHistory(next);
      return next;
    });
  }, [selectedIds, pushHistory]);

  const bringForward = useCallback(() => {
    if (selectedIds.length === 0) return;
    setElements((prev) => {
      const next = [...prev];
      for (let i = next.length - 2; i >= 0; i--) {
        if (selectedIds.includes(next[i].id) && !selectedIds.includes(next[i + 1].id)) {
          const temp = next[i];
          next[i] = next[i + 1];
          next[i + 1] = temp;
        }
      }
      pushHistory(next);
      return next;
    });
  }, [selectedIds, pushHistory]);

  const sendBackward = useCallback(() => {
    if (selectedIds.length === 0) return;
    setElements((prev) => {
      const next = [...prev];
      for (let i = 1; i < next.length; i++) {
        if (selectedIds.includes(next[i].id) && !selectedIds.includes(next[i - 1].id)) {
          const temp = next[i];
          next[i] = next[i - 1];
          next[i - 1] = temp;
        }
      }
      pushHistory(next);
      return next;
    });
  }, [selectedIds, pushHistory]);

  const alignSelected = useCallback(
    (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v') => {
      if (selectedIds.length < 2 && !['left', 'right', 'top', 'bottom'].includes(type)) return;

      setElements((prev) => {
        const selected = prev.filter((el) => selectedIds.includes(el.id));
        if (selected.length === 0) return prev;

        const updates: { id: string; changes: Partial<CanvasElement> }[] = [];
        const items = selected.map((element) => ({ element, rect: getWorldRect(element, prev) }));
        const moveToWorld = (element: CanvasElement, worldX: number, worldY: number) => {
          const local = worldToLocalPosition({ x: worldX, y: worldY }, element.parentId, prev);
          updates.push({ id: element.id, changes: { x: local.x, y: local.y } });
        };

        if (type === 'left') {
          const minX = Math.min(...items.map(({ rect }) => rect.x));
          items.forEach(({ element, rect }) => moveToWorld(element, minX, rect.y));
        } else if (type === 'right') {
          const maxRight = Math.max(...items.map(({ rect }) => rect.x + rect.width));
          items.forEach(({ element, rect }) => moveToWorld(element, maxRight - rect.width, rect.y));
        } else if (type === 'center') {
          const minX = Math.min(...items.map(({ rect }) => rect.x));
          const maxX = Math.max(...items.map(({ rect }) => rect.x + rect.width));
          const avgCenter = (minX + maxX) / 2;
          items.forEach(({ element, rect }) => moveToWorld(element, avgCenter - rect.width / 2, rect.y));
        } else if (type === 'top') {
          const minY = Math.min(...items.map(({ rect }) => rect.y));
          items.forEach(({ element, rect }) => moveToWorld(element, rect.x, minY));
        } else if (type === 'bottom') {
          const maxBottom = Math.max(...items.map(({ rect }) => rect.y + rect.height));
          items.forEach(({ element, rect }) => moveToWorld(element, rect.x, maxBottom - rect.height));
        } else if (type === 'middle') {
          const minY = Math.min(...items.map(({ rect }) => rect.y));
          const maxY = Math.max(...items.map(({ rect }) => rect.y + rect.height));
          const avgMiddle = (minY + maxY) / 2;
          items.forEach(({ element, rect }) => moveToWorld(element, rect.x, avgMiddle - rect.height / 2));
        } else if (type === 'distribute-h') {
          if (items.length < 3) return prev;
          const sorted = [...items].sort((a, b) => a.rect.x - b.rect.x);
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const totalDistance = last.rect.x + last.rect.width - first.rect.x;
          const totalShapesWidth = sorted.reduce((sum, item) => sum + item.rect.width, 0);
          const gap = (totalDistance - totalShapesWidth) / (sorted.length - 1);
          let currentX = first.rect.x;
          sorted.forEach((item) => {
            moveToWorld(item.element, currentX, item.rect.y);
            currentX += item.rect.width + gap;
          });
        } else if (type === 'distribute-v') {
          if (items.length < 3) return prev;
          const sorted = [...items].sort((a, b) => a.rect.y - b.rect.y);
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const totalDistance = last.rect.y + last.rect.height - first.rect.y;
          const totalShapesHeight = sorted.reduce((sum, item) => sum + item.rect.height, 0);
          const gap = (totalDistance - totalShapesHeight) / (sorted.length - 1);
          let currentY = first.rect.y;
          sorted.forEach((item) => {
            moveToWorld(item.element, item.rect.x, currentY);
            currentY += item.rect.height + gap;
          });
        }

        const map = new Map(updates.map((u) => [u.id, u.changes]));
        const next = prev.map((el) => (map.has(el.id) ? { ...el, ...map.get(el.id)! } : el));
        pushHistory(next);
        return next;
      });
    },
    [selectedIds, pushHistory]
  );

  const toggleVisibility = useCallback((id: string) => {
    setElements((prev) => {
      const next = prev.map((el) => (el.id === id ? { ...el, visible: !el.visible } : el));
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const toggleLock = useCallback((id: string) => {
    setElements((prev) => {
      const next = prev.map((el) => (el.id === id ? { ...el, locked: !el.locked } : el));
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const renameElement = useCallback((id: string, name: string) => {
    setElements((prev) => {
      const master = getOwningComponentMaster(id, prev);
      const next = settleDocumentMutation(
        prev.map((el) => (el.id === id ? { ...el, name } : el)),
        master ? [master.id] : []
      );
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const addToken = useCallback((category: DesignTokenCategory) => {
    if (!currentProjectId) return;
    const count = tokens.filter((token) => token.category === category).length + 1;
    const token: DesignToken = {
      id: `token-${category}-${Date.now()}`,
      name: `${category.charAt(0).toUpperCase() + category.slice(1)} / ${count}`,
      category,
      value: category === 'color' ? '#0d99ff' : category === 'radius' ? 12 : 8,
    };
    const nextTokens = [...tokens, token];
    setProjects((prev) => prev.map((project) => project.id === currentProjectId
      ? { ...project, tokens: nextTokens, updatedAt: Date.now() }
      : project));
    pushHistory(elements, nextTokens);
  }, [currentProjectId, elements, pushHistory, tokens]);

  const updateToken = useCallback((tokenId: string, changes: Partial<DesignToken>) => {
    if (!currentProjectId) return;
    const nextTokens = tokens.map((token) => token.id === tokenId ? { ...token, ...changes, id: token.id } : token);
    setProjects((prev) => prev.map((project) => project.id === currentProjectId
      ? {
          ...project,
          tokens: nextTokens,
          updatedAt: Date.now(),
        }
      : project));
    setElements((prev) => {
      const next = settleDocumentMutation(prev.map((element) => resolveElementTokens(element, nextTokens)));
      pushHistory(next, nextTokens);
      return next;
    });
  }, [currentProjectId, pushHistory, tokens]);

  const deleteToken = useCallback((tokenId: string) => {
    if (!currentProjectId) return;
    const nextTokens = tokens.filter((token) => token.id !== tokenId);
    setElements((prev) => {
      const next = removeTokenAndMaterialize(prev, tokens, tokenId);
      pushHistory(next, nextTokens);
      return next;
    });
    setProjects((prev) => prev.map((project) => project.id === currentProjectId
      ? { ...project, tokens: nextTokens, updatedAt: Date.now() }
      : project));
  }, [currentProjectId, pushHistory, tokens]);

  const bindToken = useCallback((elementId: string, property: TokenBindableProperty, tokenId: string | null) => {
    setElements((prev) => {
      const target = prev.find((element) => element.id === elementId);
      if (!target || getInstanceRoot(target, prev)) return prev;
      const master = getOwningComponentMaster(elementId, prev);
      const next = settleDocumentMutation(
        prev.map((element) => element.id === elementId
          ? resolveElementTokens(bindElementToken(element, property, tokenId), tokens)
          : element),
        master ? [master.id] : []
      );
      pushHistory(next);
      return next;
    });
  }, [pushHistory, tokens]);

  const spawnPresetFrame = useCallback(
    (preset: DevicePreset, position?: Point) => {
      const defaultPos: Point = position || {
        x: Math.round((-pan.x + viewportSizeRef.current.width / 2) / zoom - preset.width / 2),
        y: Math.round((-pan.y + viewportSizeRef.current.height / 2) / zoom - preset.height / 2),
      };

      const newFrame: CanvasElement = {
        id: `frame-${Date.now()}`,
        name: `${preset.name} - 1`,
        type: 'frame',
        x: Math.max(50, defaultPos.x),
        y: Math.max(50, defaultPos.y),
        width: preset.width,
        height: preset.height,
        rotation: 0,
        fill: preset.category === 'mobile' ? '#ffffff' : '#ffffff',
        fillOpacity: 1,
        stroke: '#e2e8f0',
        strokeWidth: 0,
        strokeOpacity: 1,
        strokeStyle: 'solid',
        strokeAlign: 'inside',
        cornerRadius: preset.category === 'mobile' ? 44 : 16,
        opacity: 1,
        visible: true,
        locked: false,
        clipContent: true,
        presetName: preset.name,
        parentId: null,
        shadow: {
          x: 0,
          y: 20,
          blur: 40,
          spread: -5,
          color: '#000000',
          opacity: 0.15,
        },
      };

      addElement(newFrame);
      setIsFramePickerOpen(false);
      setActiveTool('select');
    },
    [pan, zoom, addElement]
  );

  const createShapeAt = useCallback(
    (
      type: ToolType,
      point: Point,
      initialSize = { width: 140, height: 140 },
      parentFrameId: string | null = null
    ): CanvasElement => {
      const id = `${type}-${Date.now()}`;
      let name = `${type.charAt(0).toUpperCase() + type.slice(1)}`;
      let fill = '#0d99ff';
      let stroke = '#0284c7';
      let cornerRadius = 0;

      if (type === 'frame') {
        fill = '#ffffff';
        stroke = '#e2e8f0';
        name = 'Frame 1';
        cornerRadius = 16;
      } else if (type === 'rectangle') {
        fill = '#0d99ff';
        stroke = '#0284c7';
        cornerRadius = 12;
      } else if (type === 'ellipse') {
        fill = '#6366f1';
        stroke = '#4f46e5';
      } else if (type === 'triangle') {
        fill = '#f59e0b';
        stroke = '#d97706';
      } else if (type === 'polygon') {
        fill = '#8b5cf6';
        stroke = '#7c3aed';
        name = 'Polygon';
      } else if (type === 'diamond') {
        fill = '#06b6d4';
        stroke = '#0891b2';
        name = 'Diamond';
      } else if (type === 'star') {
        fill = '#f97316';
        stroke = '#ea580c';
        name = 'Star';
      } else if (type === 'arrow') {
        fill = '#334155';
        stroke = '#334155';
        name = 'Arrow';
      } else if (type === 'text') {
        fill = '#0f172a';
        stroke = '#000000';
      }

      const element: CanvasElement = {
        id,
        name,
        type: type as any,
        x: point.x,
        y: point.y,
        width: initialSize.width,
        height: initialSize.height,
        rotation: 0,
        fill,
        fillOpacity: 1,
        stroke,
        strokeWidth: 0,
        strokeOpacity: 1,
        strokeStyle: 'solid',
        strokeAlign: 'inside',
        cornerRadius,
        opacity: 1,
        visible: true,
        locked: false,
        parentId: parentFrameId,
        textContent: type === 'text' ? 'Type something...' : undefined,
        fontSize: type === 'text' ? 16 : undefined,
        fontWeight: type === 'text' ? 500 : undefined,
        clipContent: type === 'frame' ? true : undefined,
      };

      return element;
    },
    []
  );

  const importMediaFiles = useCallback(async (files: File[], position?: Point) => {
    const supported = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (supported.length === 0) return;

    const basePoint = position || {
      x: (viewportSizeRef.current.width / 2 - pan.x) / zoom,
      y: (viewportSizeRef.current.height / 2 - pan.y) / zoom,
    };
    const created = await Promise.all(supported.map(async (file, index) => {
      const type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
      const mediaSrc = await fileToDataUrl(file);
      const size = await getMediaDimensions(mediaSrc, type);
      const worldPoint = { x: basePoint.x + index * 28, y: basePoint.y + index * 28 };
      const parentFrame = findFrameAtPoint(worldPoint, elements);
      const localPoint = parentFrame
        ? worldToLocalPosition(worldPoint, parentFrame.id, elements)
        : worldPoint;

      return {
        id: createElementId(type),
        name: file.name || (type === 'image' ? 'Pasted image' : 'Video'),
        type,
        x: localPoint.x - size.width / 2,
        y: localPoint.y - size.height / 2,
        width: size.width,
        height: size.height,
        rotation: 0,
        fill: '#e2e8f0',
        fillOpacity: 1,
        stroke: '#94a3b8',
        strokeWidth: 0,
        strokeOpacity: 1,
        strokeStyle: 'solid' as const,
        strokeAlign: 'inside' as const,
        cornerRadius: 8,
        opacity: 1,
        visible: true,
        locked: false,
        parentId: parentFrame?.id || null,
        mediaSrc,
        mediaMimeType: file.type,
        mediaName: file.name,
        objectFit: 'cover' as const,
      } satisfies CanvasElement;
    }));

    setElements((prev) => {
      const next = [...prev, ...created];
      pushHistory(next);
      return next;
    });
    setSelectedIds(created.map((element) => element.id));
    setActiveTool('select');
  }, [elements, pan.x, pan.y, pushHistory, zoom]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const previousState = historyRef.current[historyIndexRef.current];
      setElements(JSON.parse(JSON.stringify(previousState.elements)));
      setSelectedIds((ids) => ids.filter((id) => previousState.elements.some((element) => element.id === id)));
      if (currentProjectId) {
        setProjects((prev) => prev.map((project) => project.id === currentProjectId
          ? { ...project, tokens: previousState.tokens, updatedAt: Date.now() }
          : project));
      }
      setHistoryTick((t) => t + 1);
    }
  }, [currentProjectId]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const nextState = historyRef.current[historyIndexRef.current];
      setElements(JSON.parse(JSON.stringify(nextState.elements)));
      setSelectedIds((ids) => ids.filter((id) => nextState.elements.some((element) => element.id === id)));
      if (currentProjectId) {
        setProjects((prev) => prev.map((project) => project.id === currentProjectId
          ? { ...project, tokens: nextState.tokens, updatedAt: Date.now() }
          : project));
      }
      setHistoryTick((t) => t + 1);
    }
  }, [currentProjectId]);

  const exportSelected = useCallback(
    (format: 'png' | 'svg' | 'json', scale = 2) => {
      const exportIds = new Set(selectedIds);
      selectedIds.forEach((id) => {
        getAllDescendantIds(id, elements).forEach((descendantId) => exportIds.add(descendantId));
      });
      const selected = elements.filter((el) => exportIds.has(el.id));
      const targetElements = selected.length > 0 ? selected : elements;

      if (format === 'json') {
        const json = JSON.stringify({ format: 'figmint', version: 2, elements: targetElements, tokens }, null, 2);
        downloadFile(json, `${currentProject?.title || 'design'}.json`, 'application/json');
      } else if (format === 'svg') {
        const svg = generateSvgString(targetElements, elements, undefined, tokens);
        downloadFile(svg, `${currentProject?.title || 'design'}.svg`, 'image/svg+xml');
      } else if (format === 'png') {
        const svg = generateSvgString(targetElements, elements, undefined, tokens);
        downloadPngFromSvg(svg, `${currentProject?.title || 'design'}.png`, scale);
      }
    },
    [elements, selectedIds, currentProject, tokens]
  );

  const exportAll = useCallback(
    (format: 'png' | 'svg' | 'json', scale = 2) => {
      if (format === 'json') {
        const json = JSON.stringify({ format: 'figmint', version: 2, elements, tokens }, null, 2);
        downloadFile(json, `${currentProject?.title || 'figma-project'}.json`, 'application/json');
      } else if (format === 'svg') {
        const svg = generateSvgString(elements, elements, undefined, tokens);
        downloadFile(svg, `${currentProject?.title || 'figma-project'}.svg`, 'image/svg+xml');
      } else if (format === 'png') {
        const svg = generateSvgString(elements, elements, undefined, tokens);
        downloadPngFromSvg(svg, `${currentProject?.title || 'figma-project'}.png`, scale);
      }
    },
    [elements, currentProject, tokens]
  );

  const importJson = useCallback(
    (jsonString: string): boolean => {
      try {
        const parsed = JSON.parse(jsonString);
        const imported = normalizeImportedElements(Array.isArray(parsed) ? parsed : parsed?.elements);
        if (!imported) return false;
        const importedTokens = Array.isArray(parsed) ? null : normalizeImportedTokens(parsed?.tokens);

        setElements(imported);
        pushHistory(imported, importedTokens || tokens);
        setSelectedIds(imported.length > 0 ? [imported[0].id] : []);
        if (importedTokens && currentProjectId) {
          setProjects((prev) => prev.map((project) => project.id === currentProjectId
            ? { ...project, tokens: importedTokens, updatedAt: Date.now() }
            : project));
        }
        return true;
      } catch (err) {
        console.error('Failed to parse JSON design:', err);
      }
      return false;
    },
    [currentProjectId, pushHistory, tokens]
  );

  const resetCanvas = useCallback(() => {
    setElements(SAMPLE_BANKING_ELEMENTS);
    pushHistory(SAMPLE_BANKING_ELEMENTS);
    setSelectedIds(['frame-banking-app']);
  }, [pushHistory]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Duplicate
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelected();
        return;
      }

      // Paste is handled by the ClipboardEvent listener below so image files are available.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') return;

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Arrow Nudges
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

          setElements((prev) => {
            const normalizedSelection = new Set(getTopLevelSelectionIds(selectedIds, prev));
            const next = prev.map((el) =>
              normalizedSelection.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el
            );
            pushHistory(next);
            return next;
          });
        }
        return;
      }

      if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault();
        zoomToFit();
        return;
      }

      if (e.shiftKey && e.code === 'Digit0') {
        e.preventDefault();
        zoomReset();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPresentationMode(true);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        createComponentFromSelection();
        return;
      }

      if (e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        wrapSelectionInAutoLayout();
        return;
      }

      // Tool Hotkeys
      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 'h':
          setActiveTool('hand');
          break;
        case 'f':
          setTool('frame');
          break;
        case 'r':
          setActiveTool('rectangle');
          break;
        case 'o':
          setActiveTool('ellipse');
          break;
        case 't':
          setActiveTool('text');
          break;
        case 'l':
          setActiveTool(e.shiftKey ? 'arrow' : 'line');
          break;
        case 'escape':
          setSelectedIds([]);
          setActiveTool('select');
          setIsFramePickerOpen(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, duplicateSelected, copySelected, deleteSelected, selectedIds, pushHistory, setTool, zoomToFit, zoomReset, createComponentFromSelection, wrapSelectionInAutoLayout]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;

      const itemFiles = Array.from<DataTransferItem>(event.clipboardData?.items || [])
        .flatMap((item) => {
          const file = item.kind === 'file' ? item.getAsFile() : null;
          return file ? [file] : [];
        });
      const files = (itemFiles.length > 0
        ? itemFiles
        : Array.from<File>(event.clipboardData?.files || [])
      ).filter((file) => file.type.startsWith('image/'));
      if (files.length > 0) {
        event.preventDefault();
        void importMediaFiles(files);
        return;
      }

      const text = event.clipboardData?.getData('text/plain') || '';
      if (pasteCopied(text || undefined)) event.preventDefault();
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [importMediaFiles, pasteCopied]);

  return (
    <CanvasContext.Provider
      value={{
        projects,
        currentProjectId,
        currentProject,
        tokens,
        viewMode,
        openDashboard,
        openProject,
        createNewProject,
        duplicateProject,
        renameProject,
        deleteProject,
        setDocumentName,
        saveStatus,
        saveError,
        saveWarning,

        elements,
        selectedIds,
        activeTool,
        zoom,
        pan,
        gridVisible,
        rulerVisible,
        snapToGrid,
        presentationMode,
        canUndo,
        canRedo,
        isFramePickerOpen,
        collapsedFrames,
        toggleFrameCollapsed,
        setTool,
        setSelectedIds,
        selectElement,
        clearSelection,
        setZoom,
        zoomIn,
        zoomOut,
        zoomReset,
        zoomToFit,
        setPan,
        setViewportSize,
        setGridVisible,
        setRulerVisible,
        setSnapToGrid,
        setPresentationMode,
        setIsFramePickerOpen,
        appMode,
        setAppMode,
        isLeftSidebarOpen,
        setIsLeftSidebarOpen,
        activeLeftTab,
        setActiveLeftTab,
        addElement,
        updateElement,
        updateElements,
        createComponentFromSelection,
        createInstance,
        resetInstance,
        detachInstance,
        goToMainComponent,
        wrapSelectionInAutoLayout,
        insertStarterComponent,
        deleteSelected,
        duplicateSelected,
        copySelected,
        pasteCopied,
        importMediaFiles,
        reorderElement,
        reparentLayer,
        finishInteraction,
        bringToFront,
        sendToBack,
        bringForward,
        sendBackward,
        alignSelected,
        toggleVisibility,
        toggleLock,
        renameElement,
        addToken,
        updateToken,
        deleteToken,
        bindToken,
        spawnPresetFrame,
        createShapeAt,
        undo,
        redo,
        exportSelected,
        exportAll,
        importJson,
        resetCanvas,
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
};

export function useCanvas() {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvas must be used within a CanvasProvider');
  }
  return context;
}
