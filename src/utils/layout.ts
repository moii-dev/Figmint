import type { CanvasElement, LayoutPadding } from '../types/figma';

export const DEFAULT_LAYOUT_PADDING: LayoutPadding = { top: 12, right: 12, bottom: 12, left: 12 };

function clampSize(value: number): number {
  return Math.max(1, Math.round(value * 100) / 100);
}

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export function applyAutoLayout(elements: CanvasElement[], containerId?: string): CanvasElement[] {
  const next = elements.map((element) => ({ ...element }));
  const containers = containerId
    ? next.filter((element) => element.id === containerId)
    : next.filter((element) => element.layoutMode && element.layoutMode !== 'none');

  for (const container of containers) {
    const mode = container.layoutMode;
    if (!mode || mode === 'none') continue;
    const padding = container.layoutPadding || DEFAULT_LAYOUT_PADDING;
    const gap = Math.max(0, container.layoutGap ?? 8);
    const children = next.filter(
      (element) => element.parentId === container.id && element.layoutPositioning !== 'absolute'
    );
    if (children.length === 0) continue;

    const isHorizontal = mode === 'horizontal';
    const mainAvailable = isHorizontal
      ? container.width - padding.left - padding.right
      : container.height - padding.top - padding.bottom;
    const counterAvailable = isHorizontal
      ? container.height - padding.top - padding.bottom
      : container.width - padding.left - padding.right;
    const fixedMain = children.reduce((sum, child) => {
      const sizing = isHorizontal ? child.layoutSizingHorizontal : child.layoutSizingVertical;
      const size = isHorizontal ? child.width : child.height;
      return sizing === 'fill' || child.layoutGrow === 1 ? sum : sum + size;
    }, 0);
    const fillChildren = children.filter((child) => {
      const sizing = isHorizontal ? child.layoutSizingHorizontal : child.layoutSizingVertical;
      return sizing === 'fill' || child.layoutGrow === 1;
    });
    const baseGap = container.layoutPrimaryAlign === 'space-between' && children.length > 1 && fillChildren.length === 0
      ? Math.max(0, (mainAvailable - fixedMain) / (children.length - 1))
      : gap;
    const remainingForFill = Math.max(
      1,
      mainAvailable - fixedMain - baseGap * Math.max(0, children.length - 1)
    );
    const fillSize = fillChildren.length > 0 ? remainingForFill / fillChildren.length : 0;
    const measuredMain = children.reduce((sum, child) => {
      const isFill = fillChildren.some((item) => item.id === child.id);
      return sum + (isFill ? fillSize : isHorizontal ? child.width : child.height);
    }, 0) + baseGap * Math.max(0, children.length - 1);

    let cursor = isHorizontal ? padding.left : padding.top;
    if (container.layoutPrimaryAlign === 'center') cursor += Math.max(0, (mainAvailable - measuredMain) / 2);
    if (container.layoutPrimaryAlign === 'end') cursor += Math.max(0, mainAvailable - measuredMain);

    for (const child of children) {
      const index = next.findIndex((element) => element.id === child.id);
      if (index === -1) continue;
      const updated = { ...next[index] };
      const isFill = fillChildren.some((item) => item.id === child.id);
      if (isHorizontal && isFill) updated.width = clampSize(fillSize);
      if (!isHorizontal && isFill) updated.height = clampSize(fillSize);

      const counterSize = isHorizontal ? updated.height : updated.width;
      const counterSizing = isHorizontal ? updated.layoutSizingVertical : updated.layoutSizingHorizontal;
      let counter = isHorizontal ? padding.top : padding.left;
      if (container.layoutCounterAlign === 'center') counter += Math.max(0, (counterAvailable - counterSize) / 2);
      if (container.layoutCounterAlign === 'end') counter += Math.max(0, counterAvailable - counterSize);
      if (container.layoutCounterAlign === 'stretch' || counterSizing === 'fill') {
        if (isHorizontal) updated.height = clampSize(counterAvailable);
        else updated.width = clampSize(counterAvailable);
      }

      if (isHorizontal) {
        updated.x = roundCoordinate(cursor);
        updated.y = roundCoordinate(counter);
        cursor += updated.width + baseGap;
      } else {
        updated.x = roundCoordinate(counter);
        updated.y = roundCoordinate(cursor);
        cursor += updated.height + baseGap;
      }
      next[index] = updated;
    }

    const containerIndex = next.findIndex((element) => element.id === container.id);
    if (containerIndex !== -1) {
      const updatedContainer = { ...next[containerIndex] };
      if (container.layoutSizingHorizontal === 'hug') {
        updatedContainer.width = clampSize(
          isHorizontal ? padding.left + measuredMain + padding.right : padding.left + Math.max(...children.map((child) => child.width)) + padding.right
        );
      }
      if (container.layoutSizingVertical === 'hug') {
        updatedContainer.height = clampSize(
          isHorizontal ? padding.top + Math.max(...children.map((child) => child.height)) + padding.bottom : padding.top + measuredMain + padding.bottom
        );
      }
      next[containerIndex] = updatedContainer;
    }
  }

  return next;
}

export function reorderAutoLayoutChild(
  elements: CanvasElement[],
  childId: string,
  targetChildId: string
): CanvasElement[] {
  const child = elements.find((element) => element.id === childId);
  const target = elements.find((element) => element.id === targetChildId);
  if (!child || !target || !child.parentId || child.parentId !== target.parentId) return elements;
  const parent = elements.find((element) => element.id === child.parentId);
  if (!parent?.layoutMode || parent.layoutMode === 'none') return elements;

  const siblings = elements.filter((element) => element.parentId === parent.id);
  const ordered = siblings.filter((element) => element.id !== childId);
  const targetIndex = ordered.findIndex((element) => element.id === targetChildId);
  ordered.splice(Math.max(0, targetIndex), 0, child);
  const siblingIds = new Set(siblings.map((element) => element.id));
  const nonSiblings = elements.filter((element) => !siblingIds.has(element.id));
  return applyAutoLayout([...nonSiblings, ...ordered], parent.id);
}
