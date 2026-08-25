import { CanvasElement, FigmaProject, Point } from '../types/figma';

export const PROJECTS_STORAGE_KEY = 'figma_clone_projects_v3';
export const ACTIVE_PROJECT_STORAGE_KEY = 'figma_clone_active_proj_id_v3';

const DATABASE_NAME = 'figmint_workspace';
const DATABASE_VERSION = 1;
const WORKSPACE_STORE = 'workspace';
const PROJECTS_RECORD_KEY = 'projects';
const MAX_FALLBACK_MEDIA_LENGTH = 256_000;

interface StoredWorkspace {
  schemaVersion: 1;
  savedAt: number;
  projects: FigmaProject[];
}

export interface PersistProjectsResult {
  mode: 'indexeddb' | 'localstorage';
  warning?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WORKSPACE_STORE)) {
        request.result.createObjectStore(WORKSPACE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open IndexedDB.'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another Figmint tab.'));
  });
}

export function readProjectsFromLocalStorage(fallback: FigmaProject[]): FigmaProject[] {
  try {
    const saved = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function readActiveProjectId(projects: FigmaProject[]): string | null {
  try {
    const savedId = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    if (savedId && projects.some((project) => project.id === savedId)) return savedId;
  } catch {
    // The first project remains a safe fallback when browser storage is unavailable.
  }
  return projects[0]?.id || null;
}

export function createLocalStorageFallback(
  projects: FigmaProject[],
  maxInlineMediaLength = MAX_FALLBACK_MEDIA_LENGTH
): FigmaProject[] {
  return projects.map((project) => ({
    ...project,
    elements: project.elements.map((element) => {
      const mediaSrc = element.mediaSrc;
      const imageFillSrc = element.imageFill?.src;
      let lightweightElement = element;
      if (mediaSrc?.startsWith('data:') && mediaSrc.length > maxInlineMediaLength) {
        const { mediaSrc: _removedMediaSource, ...withoutMedia } = lightweightElement;
        lightweightElement = withoutMedia as CanvasElement;
      }
      if (imageFillSrc?.startsWith('data:') && imageFillSrc.length > maxInlineMediaLength) {
        lightweightElement = {
          ...lightweightElement,
          imageFill: lightweightElement.imageFill
            ? { ...lightweightElement.imageFill, src: '' }
            : undefined,
        };
      }
      return lightweightElement;
    }),
  }));
}

export function mergeLatestProjectState(
  projects: FigmaProject[],
  currentProjectId: string | null,
  elements: CanvasElement[],
  zoom: number,
  pan: Point,
  updatedAt = Date.now()
): FigmaProject[] {
  if (!currentProjectId) return projects;
  return projects.map((project) =>
    project.id === currentProjectId
      ? { ...project, elements, zoom, pan, updatedAt }
      : project
  );
}

export async function loadProjectsFromIndexedDb(): Promise<FigmaProject[] | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(WORKSPACE_STORE, 'readonly');
      const request = transaction.objectStore(WORKSPACE_STORE).get(PROJECTS_RECORD_KEY);
      request.onsuccess = () => {
        const workspace = request.result as StoredWorkspace | undefined;
        resolve(
          workspace?.schemaVersion === 1 && Array.isArray(workspace.projects) && workspace.projects.length > 0
            ? workspace.projects
            : null
        );
      };
      request.onerror = () => reject(request.error || new Error('Could not read saved Figmint projects.'));
      transaction.onabort = () => reject(transaction.error || new Error('Reading Figmint projects was aborted.'));
    });
  } finally {
    database.close();
  }
}

async function saveProjectsToIndexedDb(projects: FigmaProject[]): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(WORKSPACE_STORE, 'readwrite');
      const workspace: StoredWorkspace = {
        schemaVersion: 1,
        savedAt: Date.now(),
        projects,
      };
      transaction.objectStore(WORKSPACE_STORE).put(workspace, PROJECTS_RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not save Figmint projects.'));
      transaction.onabort = () => reject(transaction.error || new Error('Saving Figmint projects was aborted.'));
    });
  } finally {
    database.close();
  }
}

function writeActiveProjectId(currentProjectId: string | null): void {
  if (currentProjectId) {
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, currentProjectId);
  } else {
    localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
  }
}

export function writeLocalStorageFallback(
  projects: FigmaProject[],
  currentProjectId: string | null
): void {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(createLocalStorageFallback(projects)));
  writeActiveProjectId(currentProjectId);
}

export async function persistProjects(
  projects: FigmaProject[],
  currentProjectId: string | null
): Promise<PersistProjectsResult> {
  try {
    await saveProjectsToIndexedDb(projects);

    let warning: string | undefined;
    try {
      writeLocalStorageFallback(projects, currentProjectId);
    } catch (error) {
      warning = `The IndexedDB copy is safe, but the lightweight fallback could not be updated: ${getErrorMessage(error)}`;
    }

    return { mode: 'indexeddb', warning };
  } catch (indexedDbError) {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
      writeActiveProjectId(currentProjectId);
      return {
        mode: 'localstorage',
        warning: `IndexedDB is unavailable; Figmint is using limited browser storage: ${getErrorMessage(indexedDbError)}`,
      };
    } catch (localStorageError) {
      throw new Error(
        `Could not save this project. IndexedDB: ${getErrorMessage(indexedDbError)} Local storage: ${getErrorMessage(localStorageError)}`
      );
    }
  }
}
