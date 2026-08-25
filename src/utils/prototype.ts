import type { CanvasElement, PrototypeInteraction } from '../types/figma';

export const DEFAULT_PROTOTYPE_INTERACTION: Omit<PrototypeInteraction, 'id'> = {
  trigger: 'click',
  action: 'navigate-to',
  transition: 'smart-animate',
  direction: 'left',
  easing: 'ease-in-out',
  durationMs: 300,
};

export function clampPrototypeDuration(value: number): number {
  return Math.max(1, Math.min(10_000, Number.isFinite(value) ? Math.round(value) : 300));
}

export function createPrototypeInteraction(destinationFrameId?: string): PrototypeInteraction {
  return {
    ...DEFAULT_PROTOTYPE_INTERACTION,
    id: `interaction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    destinationFrameId,
  };
}

export function getTopLevelFrames(elements: CanvasElement[]): CanvasElement[] {
  return elements.filter((element) => element.type === 'frame' && !element.parentId && element.visible);
}

export function getPrototypeStartFrame(
  elements: CanvasElement[],
  selectedIds: string[] = []
): CanvasElement | undefined {
  const frames = getTopLevelFrames(elements);
  return frames.find((frame) => frame.prototypeFlowStart)
    || frames.find((frame) => selectedIds.includes(frame.id))
    || frames[0];
}

export function getMissingDestinationIds(elements: CanvasElement[]): Set<string> {
  const frameIds = new Set(getTopLevelFrames(elements).map((frame) => frame.id));
  return new Set(elements.flatMap((element) =>
    (element.interactions || []).flatMap((interaction) =>
      interaction.destinationFrameId && !frameIds.has(interaction.destinationFrameId)
        ? [interaction.destinationFrameId]
        : []
    )
  ));
}

export function getTransitionTiming(interaction: PrototypeInteraction): string {
  const easing = interaction.easing === 'ease-in-out'
    ? 'cubic-bezier(0.4, 0, 0.2, 1)'
    : interaction.easing;
  return `${clampPrototypeDuration(interaction.durationMs)}ms ${easing}`;
}

function getLayerPath(element: CanvasElement, elements: CanvasElement[], frameId: string): string {
  const parts = [`${element.type}:${element.name}`];
  let parentId = element.parentId;
  const visited = new Set<string>();
  while (parentId && parentId !== frameId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = elements.find((item) => item.id === parentId);
    if (!parent) break;
    parts.unshift(`${parent.type}:${parent.name}`);
    parentId = parent.parentId;
  }
  return parts.join('/');
}

export function matchSmartAnimateLayers(
  elements: CanvasElement[],
  fromFrameId: string,
  toFrameId: string
): Map<string, CanvasElement> {
  const from = elements.filter((element) => element.id !== fromFrameId && element.parentId);
  const to = elements.filter((element) => element.id !== toFrameId && element.parentId);
  const belongsTo = (element: CanvasElement, frameId: string) => {
    let parentId = element.parentId;
    const visited = new Set<string>();
    while (parentId && !visited.has(parentId)) {
      if (parentId === frameId) return true;
      visited.add(parentId);
      parentId = elements.find((item) => item.id === parentId)?.parentId;
    }
    return false;
  };
  const sourceByPath = new Map(
    from.filter((element) => belongsTo(element, fromFrameId))
      .map((element) => [getLayerPath(element, elements, fromFrameId), element])
  );
  return new Map(
    to.filter((element) => belongsTo(element, toFrameId)).flatMap((element) => {
      const source = sourceByPath.get(getLayerPath(element, elements, toFrameId));
      return source ? [[element.id, source] as const] : [];
    })
  );
}
