import { CanvasElement, Point, Rect } from '../types/figma';

/**
 * Calculates absolute world coordinates (x, y) for an element,
 * accounting for parent frame offsets if nested.
 */
export function getWorldPosition(
  element: CanvasElement,
  allElements: CanvasElement[]
): Point {
  if (!element.parentId) {
    return { x: element.x, y: element.y };
  }

  const parent = allElements.find((el) => el.id === element.parentId);
  if (!parent) {
    return { x: element.x, y: element.y };
  }

  const parentWorld = getWorldPosition(parent, allElements);
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
    (el) => el.type === 'frame' && el.visible && !ignoreSet.has(el.id)
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
  while (current && current.parentId) {
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

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = allElements.filter((el) => el.parentId === currentId);
    for (const child of children) {
      result.push(child.id);
      queue.push(child.id);
    }
  }

  return result;
}
