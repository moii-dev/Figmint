import type { CanvasElement } from '../types/figma';

export const FIGMINT_CLIPBOARD_PREFIX = 'FIGMINT_ELEMENTS:';

export interface ClipboardPayload {
  version: 1 | 2;
  elements: CanvasElement[];
  topLevelIds: string[];
  sourceProjectId?: string | null;
}

export function serializeClipboardPayload(payload: ClipboardPayload): string {
  return `${FIGMINT_CLIPBOARD_PREFIX}${JSON.stringify(payload)}`;
}

export function parseClipboardPayload(value: string): ClipboardPayload | null {
  if (!value.startsWith(FIGMINT_CLIPBOARD_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(FIGMINT_CLIPBOARD_PREFIX.length)) as ClipboardPayload;
    if (
      (parsed.version !== 1 && parsed.version !== 2) ||
      !Array.isArray(parsed.elements) ||
      !Array.isArray(parsed.topLevelIds)
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}
