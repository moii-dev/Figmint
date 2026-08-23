import type { CanvasElement, InstanceOverride } from '../types/figma';
import { getAllDescendantIds } from './hierarchy';

const OVERRIDE_KEYS: (keyof InstanceOverride)[] = ['textContent', 'fill', 'fillOpacity', 'visible'];

function makeId(type: CanvasElement['type']): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getInstanceRoot(element: CanvasElement, allElements: CanvasElement[]): CanvasElement | null {
  let current: CanvasElement | undefined = element;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    if (current.type === 'instance') return current;
    visited.add(current.id);
    current = current.parentId ? allElements.find((item) => item.id === current!.parentId) : undefined;
  }
  return null;
}

export function createInstanceTree(
  masterId: string,
  elements: CanvasElement[],
  position?: { x: number; y: number }
): { elements: CanvasElement[]; rootId: string } | null {
  const master = elements.find((element) => element.id === masterId && element.type === 'component');
  if (!master) return null;
  const treeIds = new Set([master.id, ...getAllDescendantIds(master.id, elements)]);
  const sourceTree = elements.filter((element) => treeIds.has(element.id));
  const idMap = new Map(sourceTree.map((element) => [element.id, makeId(element.id === master.id ? 'instance' : element.type)]));
  const rootId = idMap.get(master.id)!;
  const cloned = sourceTree.map((element) => ({
    ...element,
    id: idMap.get(element.id)!,
    name: element.id === master.id ? `${master.name} Instance` : element.name,
    type: element.id === master.id ? 'instance' as const : element.type,
    parentId: element.id === master.id ? null : idMap.get(element.parentId || '') || rootId,
    x: element.id === master.id ? position?.x ?? master.x + master.width + 80 : element.x,
    y: element.id === master.id ? position?.y ?? master.y : element.y,
    mainComponentId: element.id === master.id ? master.id : undefined,
    sourceElementId: element.id,
    instanceOverrides: element.id === master.id ? {} : undefined,
  }));
  return { elements: cloned, rootId };
}

export function syncInstances(elements: CanvasElement[], masterId: string): CanvasElement[] {
  const master = elements.find((element) => element.id === masterId && element.type === 'component');
  if (!master) return elements;
  const masterIds = new Set([master.id, ...getAllDescendantIds(master.id, elements)]);
  const sourceTree = elements.filter((element) => masterIds.has(element.id));
  let next = [...elements];

  const instances = next.filter((element) => element.type === 'instance' && element.mainComponentId === masterId);
  for (const instance of instances) {
    const overrides = instance.instanceOverrides || {};
    const existingIds = new Set([instance.id, ...getAllDescendantIds(instance.id, next)]);
    const existingTree = next.filter((element) => existingIds.has(element.id));
    const bySource = new Map(existingTree.map((element) => [element.sourceElementId, element]));
    const idMap = new Map<string, string>();
    sourceTree.forEach((source) => {
      const existing = bySource.get(source.id);
      idMap.set(source.id, source.id === master.id ? instance.id : existing?.id || makeId(source.type));
    });

    const synced = sourceTree.map((source) => {
      const existing = bySource.get(source.id);
      const override = overrides[source.id] || {};
      const rootTransform = source.id === master.id
        ? { x: instance.x, y: instance.y, rotation: instance.rotation }
        : {};
      return {
        ...source,
        ...rootTransform,
        ...override,
        id: idMap.get(source.id)!,
        type: source.id === master.id ? 'instance' as const : source.type,
        name: source.id === master.id ? instance.name : source.name,
        parentId: source.id === master.id ? instance.parentId || null : idMap.get(source.parentId || '') || instance.id,
        mainComponentId: source.id === master.id ? master.id : undefined,
        sourceElementId: source.id,
        instanceOverrides: source.id === master.id ? overrides : undefined,
      };
    });
    next = next.filter((element) => !existingIds.has(element.id)).concat(synced);
  }
  return next;
}

export function recordInstanceOverride(
  elements: CanvasElement[],
  elementId: string,
  changes: Partial<CanvasElement>
): CanvasElement[] {
  const target = elements.find((element) => element.id === elementId);
  if (!target?.sourceElementId) return elements;
  const root = getInstanceRoot(target, elements);
  if (!root) return elements;
  const allowed = Object.fromEntries(
    OVERRIDE_KEYS.flatMap((key) => key in changes ? [[key, changes[key]]] : [])
  ) as InstanceOverride;
  if (Object.keys(allowed).length === 0) return elements;
  const overrides = {
    ...(root.instanceOverrides || {}),
    [target.sourceElementId]: {
      ...(root.instanceOverrides?.[target.sourceElementId] || {}),
      ...allowed,
    },
  };
  return elements.map((element) => element.id === root.id ? { ...element, instanceOverrides: overrides } : element);
}

export function detachInstanceTree(elements: CanvasElement[], instanceId: string): CanvasElement[] {
  const instance = elements.find((element) => element.id === instanceId && element.type === 'instance');
  if (!instance) return elements;
  const treeIds = new Set([instance.id, ...getAllDescendantIds(instance.id, elements)]);
  return elements.map((element) => {
    if (!treeIds.has(element.id)) return element;
    const detached = { ...element };
    delete detached.mainComponentId;
    delete detached.sourceElementId;
    delete detached.instanceOverrides;
    if (detached.id === instance.id) detached.type = 'frame';
    return detached;
  });
}

export function detachOrphanedInstances(elements: CanvasElement[]): CanvasElement[] {
  const masterIds = new Set(elements.filter((element) => element.type === 'component').map((element) => element.id));
  return elements.reduce((next, element) => {
    if (element.type === 'instance' && element.mainComponentId && !masterIds.has(element.mainComponentId)) {
      return detachInstanceTree(next, element.id);
    }
    return next;
  }, elements);
}
