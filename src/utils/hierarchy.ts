import { CanvasElement, Point, Rect } from '../types/figma';

/**
 * Calculates absolute world coordinates (x, y) for an element,
 * accounting for parent frame offsets if nested.
 */
export function getWorldPosition(
  element: CanvasElement,
  allElements: CanvasElement[],
  visited = new Set<string>()
): Point {
  if (!element.parentId || visited.has(element.id)) {
    return { x: element.x, y: element.y };
  }

  visited.add(element.id);

  const parent = allElements.find((el) => el.id === element.parentId);
  if (!parent) {
    return { x: element.x, y: element.y };
  }

  const parentWorld = getWorldPosition(parent, allElements, visited);
  return {
    x: parentWorld.x + element.x,
    y: parentWorld.y + element.y,
  };
}

/**
 * Calculates absolute world bounding rect for an element.
 */
export function getWorldRect(
  element: CanvasElement,
  allElements: CanvasElement[]
): Rect {
  const worldPos = getWorldPosition(element, allElements);
  return {
    x: worldPos.x,
    y: worldPos.y,
    width: element.width,
    height: element.height,
  };
}

/**
 * Finds the topmost Frame element that contains the given world point.
 * Ignores elements in ignoreIds.
 */
export function findFrameAtPoint(
  point: Point,
  allElements: CanvasElement[],
  ignoreIds: string[] = []
): CanvasElement | null {
  const ignoreSet = new Set(ignoreIds);
  const frames = allElements.filter(
    (el) =>
      (el.type === 'frame' || el.type === 'component') &&
      el.visible &&
      !el.locked &&
      !ignoreSet.has(el.id)
  );

  // Iterate backwards from top of stack to bottom
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i];
    const worldPos = getWorldPosition(frame, allElements);
    if (
      point.x >= worldPos.x &&
      point.x <= worldPos.x + frame.width &&
      point.y >= worldPos.y &&
      point.y <= worldPos.y + frame.height
    ) {
      return frame;
    }
  }

  return null;
}

/**
 * Reparents an element to a new parent (or null for root canvas)
 * and adjusts (x, y) so that its visual canvas position stays identical.
 */
export function reparentElement(
  element: CanvasElement,
  newParentId: string | null,
  allElements: CanvasElement[]
): { x: number; y: number; parentId: string | null } {
  // If parent hasn't changed, return current coords
  if ((element.parentId || null) === (newParentId || null)) {
    return { x: element.x, y: element.y, parentId: element.parentId || null };
  }

  // 1. Compute current world coordinates
  const currentWorldPos = getWorldPosition(element, allElements);

  // 2. If moving to root canvas
  if (!newParentId) {
    return {
      x: currentWorldPos.x,
      y: currentWorldPos.y,
      parentId: null,
    };
  }

  // 3. If moving into a new parent frame
  const targetParent = allElements.find((el) => el.id === newParentId);
  if (!targetParent) {
    return {
      x: currentWorldPos.x,
      y: currentWorldPos.y,
      parentId: null,
    };
  }

  const parentWorldPos = getWorldPosition(targetParent, allElements);
  return {
    x: Math.round(currentWorldPos.x - parentWorldPos.x),
    y: Math.round(currentWorldPos.y - parentWorldPos.y),
    parentId: newParentId,
  };
}

/** Converts a world-space point to coordinates local to a parent frame. */
export function worldToLocalPosition(
  point: Point,
  parentId: string | null | undefined,
  allElements: CanvasElement[]
): Point {
  if (!parentId) return point;

  const parent = allElements.find((el) => el.id === parentId);
  if (!parent) return point;

  const parentWorld = getWorldPosition(parent, allElements);
  return {
    x: point.x - parentWorld.x,
    y: point.y - parentWorld.y,
  };
}

/**
 * Removes selected descendants when their ancestor is also selected.
 * This prevents a child from moving twice together with its frame.
 */
export function getTopLevelSelectionIds(
  selectedIds: string[],
  allElements: CanvasElement[]
): string[] {
  const selected = new Set(selectedIds);

  return selectedIds.filter((id) => {
    let current = allElements.find((el) => el.id === id);
    const visited = new Set<string>();

    while (current?.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      if (selected.has(current.parentId)) return false;
      current = allElements.find((el) => el.id === current?.parentId);
    }

    return true;
  });
}

/** Frames and components are containers; circular nesting and instance structural edits are rejected. */
export function canReparentElement(
  element: CanvasElement,
  newParentId: string | null,
  allElements: CanvasElement[]
): boolean {
  if (!newParentId) return true;
  if (element.id === newParentId) return false;

  const parent = allElements.find((el) => el.id === newParentId);
  if (!parent || !['frame', 'component'].includes(parent.type)) return false;

  return !isAncestor(element.id, newParentId, allElements);
}

/**
 * Checks if candidate is an ancestor of target element (to prevent circular nesting)
 */
export function isAncestor(
  ancestorId: string,
  targetId: string,
  allElements: CanvasElement[]
): boolean {
  if (ancestorId === targetId) return true;
  let current = allElements.find((el) => el.id === targetId);
  const visited = new Set<string>();
  while (current && current.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.parentId === ancestorId) return true;
    current = allElements.find((el) => el.id === current?.parentId);
  }
  return false;
}

/**
 * Gets all direct children of an element
 */
export function getDirectChildren(
  parentId: string,
  allElements: CanvasElement[]
): CanvasElement[] {
  return allElements.filter((el) => el.parentId === parentId);
}

/**
 * Gets all descendants of an element recursively
 */
export function getAllDescendantIds(
  parentId: string,
  allElements: CanvasElement[]
): string[] {
  const result: string[] = [];
  const queue = [parentId];
  const visited = new Set<string>([parentId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = allElements.filter((el) => el.parentId === currentId);
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      result.push(child.id);
      queue.push(child.id);
    }
  }

  return result;
}
