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
} from '../types/figma';
import {
  INITIAL_PROJECTS,
  SAMPLE_BANKING_ELEMENTS,
  SAMPLE_DESIGN_SYSTEM_ELEMENTS,
} from '../data/sampleCanvas';
import {
  getBoundingBox,
  generateSvgString,
  downloadFile,
  downloadPngFromSvg,
} from '../utils/geometry';
import {
  reparentElement,
  getWorldPosition,
  findFrameAtPoint,
  getAllDescendantIds,
} from '../utils/hierarchy';

const STORAGE_KEY = 'figma_clone_projects_v3';
const ACTIVE_PROJ_KEY = 'figma_clone_active_proj_id_v3';

interface CanvasContextType {
  // Multi-Project Dashboard State
  projects: FigmaProject[];
  currentProjectId: string | null;
  currentProject: FigmaProject | null;
  viewMode: 'dashboard' | 'editor';
  openDashboard: () => void;
  openProject: (projectId: string) => void;
  createNewProject: (title?: string, template?: 'blank' | 'mobile' | 'desktop') => void;
  duplicateProject: (projectId: string) => void;
  renameProject: (projectId: string, newTitle: string) => void;
  deleteProject: (projectId: string) => void;
  setDocumentName: (title: string) => void;

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
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>, recordHistory?: boolean) => void;
  updateElements: (updates: { id: string; changes: Partial<CanvasElement> }[], recordHistory?: boolean) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
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

  // Presets & Spawning
  spawnPresetFrame: (preset: DevicePreset, position?: Point) => void;
  createShapeAt: (type: ToolType, point: Point, initialSize?: { width: number; height: number }, parentFrameId?: string | null) => CanvasElement;

  // Frame Nesting & Dropping
  autoNestOnDrop: (elementIds: string[]) => void;

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
  // Load Projects from LocalStorage or fall back to Initial Projects
  const [projects, setProjects] = useState<FigmaProject[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not read projects from localStorage', e);
    }
    return INITIAL_PROJECTS;
  });

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_PROJ_KEY);
      if (savedId) return savedId;
    } catch (e) {}
    return 'proj-banking-mobile';
  });

  const [viewMode, setViewMode] = useState<'dashboard' | 'editor'>('editor');

  const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0] || null;

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

  // History stack
  const historyRef = useRef<CanvasElement[][]>([elements]);
  const historyIndexRef = useRef<number>(0);
  const [, setHistoryTick] = useState(0);

  // Sync projects to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      if (currentProjectId) {
        localStorage.setItem(ACTIVE_PROJ_KEY, currentProjectId);
      }
    } catch (e) {
      console.warn('Failed to save projects to localStorage', e);
    }
  }, [projects, currentProjectId]);

  // Debounced auto-save current elements and canvas viewport to current project
  useEffect(() => {
    if (!currentProjectId) return;
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
  }, [elements, zoom, pan, currentProjectId]);

  const pushHistory = useCallback((newElements: CanvasElement[]) => {
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(JSON.parse(JSON.stringify(newElements)));
    if (nextHistory.length > 50) nextHistory.shift();
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    setHistoryTick((t) => t + 1);
  }, []);

  // Project Actions
  const openDashboard = useCallback(() => {
    setViewMode('dashboard');
    setSelectedIds([]);
  }, []);

  const openProject = useCallback((projectId: string) => {
    const target = projects.find((p) => p.id === projectId);
    if (!target) return;
    setCurrentProjectId(projectId);
    setElements(target.elements);
    setZoomState(target.zoom || 0.85);
    setPanState(target.pan || { x: 260, y: 40 });
    setSelectedIds(target.elements.length > 0 ? [target.elements[0].id] : []);
    historyRef.current = [target.elements];
    historyIndexRef.current = 0;
    setViewMode('editor');
  }, [projects]);

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
            strokeWidth: 1,
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
            strokeWidth: 1,
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
        zoom: 0.85,
        pan: { x: 260, y: 40 },
      };

      setProjects((prev) => [newProj, ...prev]);
      setCurrentProjectId(newId);
      setElements(initialEls);
      setZoomState(0.85);
      setPanState({ x: 260, y: 40 });
      setSelectedIds(initialEls.length > 0 ? [initialEls[0].id] : []);
      historyRef.current = [initialEls];
      historyIndexRef.current = 0;
      setViewMode('editor');
    },
    []
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
    const box = getBoundingBox(elements);
    if (!box) {
      zoomReset();
      return;
    }
    const canvasWidth = window.innerWidth - 540;
    const canvasHeight = window.innerHeight - 80;
    const scaleX = (canvasWidth - 80) / box.width;
    const scaleY = (canvasHeight - 80) / box.height;
    const targetZoom = Math.max(0.15, Math.min(1.5, Math.min(scaleX, scaleY)));

    const targetPanX = (canvasWidth - box.width * targetZoom) / 2 - box.x * targetZoom + 240;
    const targetPanY = (canvasHeight - box.height * targetZoom) / 2 - box.y * targetZoom + 50;

    setZoom(targetZoom);
    setPanState({ x: targetPanX, y: targetPanY });
  }, [elements, zoomReset, setZoom]);

  const setPan = useCallback((panArg: Point | ((prev: Point) => Point)) => {
    setPanState((prev) => (typeof panArg === 'function' ? panArg(prev) : panArg));
  }, []);

  const selectElement = useCallback((id: string, multiSelect = false) => {
    if (multiSelect) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const toggleFrameCollapsed = useCallback((frameId: string) => {
    setCollapsedFrames((prev) => ({ ...prev, [frameId]: !prev[frameId] }));
  }, []);

  // Element Actions
  const addElement = useCallback(
    (element: CanvasElement) => {
      setElements((prev) => {
        const next = [...prev, element];
        pushHistory(next);
        return next;
      });
      setSelectedIds([element.id]);
    },
    [pushHistory]
  );

  const updateElement = useCallback(
    (id: string, updates: Partial<CanvasElement>, recordHistory = true) => {
      setElements((prev) => {
        const next = prev.map((el) => (el.id === id ? { ...el, ...updates } : el));
        if (recordHistory) pushHistory(next);
        return next;
      });
    },
    [pushHistory]
  );

  const updateElements = useCallback(
    (updates: { id: string; changes: Partial<CanvasElement> }[], recordHistory = true) => {
      setElements((prev) => {
        const map = new Map(updates.map((u) => [u.id, u.changes]));
        const next = prev.map((el) => {
          if (map.has(el.id)) {
            return { ...el, ...map.get(el.id)! };
          }
          return el;
        });
        if (recordHistory) pushHistory(next);
        return next;
      });
    },
    [pushHistory]
  );

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    setElements((prev) => {
      // Collect all selected IDs + their descendant children
      const toDelete = new Set<string>(selectedIds);
      selectedIds.forEach((id) => {
        const descendants = getAllDescendantIds(id, prev);
        descendants.forEach((d) => toDelete.add(d));
      });

      const next = prev.filter((el) => !toDelete.has(el.id));
      pushHistory(next);
      return next;
    });
    setSelectedIds([]);
  }, [selectedIds, pushHistory]);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const newSelectedIds: string[] = [];

    setElements((prev) => {
      const selected = prev.filter((el) => selectedIds.includes(el.id));
      const duplicates: CanvasElement[] = [];

      selected.forEach((el) => {
        const newId = `${el.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        newSelectedIds.push(newId);

        // If it's a frame, also duplicate all its children with new parentId
        const newEl: CanvasElement = {
          ...el,
          id: newId,
          name: `${el.name} (Copy)`,
          x: el.x + 20,
          y: el.y + 20,
        };
        duplicates.push(newEl);

        if (el.type === 'frame') {
          const children = prev.filter((c) => c.parentId === el.id);
          children.forEach((c) => {
            const childId = `${c.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            duplicates.push({
              ...c,
              id: childId,
              parentId: newId,
            });
          });
        }
      });

      const next = [...prev, ...duplicates];
      pushHistory(next);
      return next;
    });

    setSelectedIds(newSelectedIds);
  }, [selectedIds, pushHistory]);

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

        // Prevent self-nesting
        if (newParentId === elementId) return prev;

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

        pushHistory(updated);
        return updated;
      });
    },
    [pushHistory]
  );

  // Auto Nesting when shapes are moved/dropped onto canvas or frames
  const autoNestOnDrop = useCallback(
    (elementIds: string[]) => {
      setElements((prev) => {
        let changed = false;
        const next = [...prev];

        for (const elId of elementIds) {
          const el = next.find((item) => item.id === elId);
          if (!el || el.type === 'frame') continue; // Frames don't nest inside frames in base auto-nest

          // Calculate center world coordinate of the element
          const worldPos = getWorldPosition(el, prev);
          const centerPt: Point = {
            x: worldPos.x + el.width / 2,
            y: worldPos.y + el.height / 2,
          };

          // Find if there is a frame at this point
          const targetFrame = findFrameAtPoint(centerPt, prev, [el.id]);

          const targetParentId = targetFrame ? targetFrame.id : null;
          if ((el.parentId || null) !== targetParentId) {
            const { x, y, parentId } = reparentElement(el, targetParentId, prev);
            const index = next.findIndex((item) => item.id === elId);
            if (index !== -1) {
              next[index] = { ...next[index], x, y, parentId };
              changed = true;
            }
          }
        }

        if (changed) {
          pushHistory(next);
          return next;
        }
        return prev;
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

        if (type === 'left') {
          const minX = Math.min(...selected.map((el) => el.x));
          selected.forEach((el) => updates.push({ id: el.id, changes: { x: minX } }));
        } else if (type === 'right') {
          const maxRight = Math.max(...selected.map((el) => el.x + el.width));
          selected.forEach((el) => updates.push({ id: el.id, changes: { x: maxRight - el.width } }));
        } else if (type === 'center') {
          const minX = Math.min(...selected.map((el) => el.x));
          const maxX = Math.max(...selected.map((el) => el.x + el.width));
          const avgCenter = (minX + maxX) / 2;
          selected.forEach((el) => updates.push({ id: el.id, changes: { x: avgCenter - el.width / 2 } }));
        } else if (type === 'top') {
          const minY = Math.min(...selected.map((el) => el.y));
          selected.forEach((el) => updates.push({ id: el.id, changes: { y: minY } }));
        } else if (type === 'bottom') {
          const maxBottom = Math.max(...selected.map((el) => el.y + el.height));
          selected.forEach((el) => updates.push({ id: el.id, changes: { y: maxBottom - el.height } }));
        } else if (type === 'middle') {
          const minY = Math.min(...selected.map((el) => el.y));
          const maxY = Math.max(...selected.map((el) => el.y + el.height));
          const avgMiddle = (minY + maxY) / 2;
          selected.forEach((el) => updates.push({ id: el.id, changes: { y: avgMiddle - el.height / 2 } }));
        } else if (type === 'distribute-h') {
          if (selected.length < 3) return prev;
          const sorted = [...selected].sort((a, b) => a.x - b.x);
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const totalDistance = last.x + last.width - first.x;
          const totalShapesWidth = sorted.reduce((sum, item) => sum + item.width, 0);
          const gap = (totalDistance - totalShapesWidth) / (sorted.length - 1);
          let currentX = first.x;
          sorted.forEach((item) => {
            updates.push({ id: item.id, changes: { x: currentX } });
            currentX += item.width + gap;
          });
        } else if (type === 'distribute-v') {
          if (selected.length < 3) return prev;
          const sorted = [...selected].sort((a, b) => a.y - b.y);
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const totalDistance = last.y + last.height - first.y;
          const totalShapesHeight = sorted.reduce((sum, item) => sum + item.height, 0);
          const gap = (totalDistance - totalShapesHeight) / (sorted.length - 1);
          let currentY = first.y;
          sorted.forEach((item) => {
            updates.push({ id: item.id, changes: { y: currentY } });
            currentY += item.height + gap;
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
      const next = prev.map((el) => (el.id === id ? { ...el, name } : el));
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const spawnPresetFrame = useCallback(
    (preset: DevicePreset, position?: Point) => {
      const defaultPos: Point = position || {
        x: Math.round((-pan.x + window.innerWidth / 2 - preset.width / 2) / zoom),
        y: Math.round((-pan.y + window.innerHeight / 2 - preset.height / 2) / zoom),
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
        strokeWidth: 1,
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
        strokeWidth: type === 'text' ? 0 : 0,
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

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const previousState = historyRef.current[historyIndexRef.current];
      setElements(JSON.parse(JSON.stringify(previousState)));
      setHistoryTick((t) => t + 1);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const nextState = historyRef.current[historyIndexRef.current];
      setElements(JSON.parse(JSON.stringify(nextState)));
      setHistoryTick((t) => t + 1);
    }
  }, []);

  const exportSelected = useCallback(
    (format: 'png' | 'svg' | 'json', scale = 2) => {
      const selected = elements.filter((el) => selectedIds.includes(el.id));
      const targetElements = selected.length > 0 ? selected : elements;

      if (format === 'json') {
        const json = JSON.stringify(targetElements, null, 2);
        downloadFile(json, `${currentProject?.title || 'design'}.json`, 'application/json');
      } else if (format === 'svg') {
        const svg = generateSvgString(targetElements);
        downloadFile(svg, `${currentProject?.title || 'design'}.svg`, 'image/svg+xml');
      } else if (format === 'png') {
        const svg = generateSvgString(targetElements);
        downloadPngFromSvg(svg, `${currentProject?.title || 'design'}.png`, scale);
      }
    },
    [elements, selectedIds, currentProject]
  );

  const exportAll = useCallback(
    (format: 'png' | 'svg' | 'json', scale = 2) => {
      if (format === 'json') {
        const json = JSON.stringify(elements, null, 2);
        downloadFile(json, `${currentProject?.title || 'figma-project'}.json`, 'application/json');
      } else if (format === 'svg') {
        const svg = generateSvgString(elements);
        downloadFile(svg, `${currentProject?.title || 'figma-project'}.svg`, 'image/svg+xml');
      } else if (format === 'png') {
        const svg = generateSvgString(elements);
        downloadPngFromSvg(svg, `${currentProject?.title || 'figma-project'}.png`, scale);
      }
    },
    [elements, currentProject]
  );

  const importJson = useCallback(
    (jsonString: string): boolean => {
      try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setElements(parsed);
          pushHistory(parsed);
          setSelectedIds([parsed[0].id]);
          return true;
        }
      } catch (err) {
        console.error('Failed to parse JSON design:', err);
      }
      return false;
    },
    [pushHistory]
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
            const next = prev.map((el) =>
              selectedIds.includes(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el
            );
            pushHistory(next);
            return next;
          });
        }
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
        case 'a':
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
        case 'p':
          setPresentationMode(!presentationMode);
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
  }, [undo, redo, duplicateSelected, deleteSelected, selectedIds, pushHistory, presentationMode, setTool]);

  return (
    <CanvasContext.Provider
      value={{
        projects,
        currentProjectId,
        currentProject,
        viewMode,
        openDashboard,
        openProject,
        createNewProject,
        duplicateProject,
        renameProject,
        deleteProject,
        setDocumentName,

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
        deleteSelected,
        duplicateSelected,
        reorderElement,
        reparentLayer,
        autoNestOnDrop,
        bringToFront,
        sendToBack,
        bringForward,
        sendBackward,
        alignSelected,
        toggleVisibility,
        toggleLock,
        renameElement,
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
