import type { CanvasElement } from '../types/figma';

export type StarterComponentKind =
  | 'primary-button'
  | 'secondary-button'
  | 'text-field'
  | 'search-field'
  | 'toggle'
  | 'checkbox'
  | 'badge'
  | 'avatar'
  | 'card'
  | 'nav-item';

export const STARTER_COMPONENTS: { kind: StarterComponentKind; name: string; description: string }[] = [
  { kind: 'primary-button', name: 'Primary Button', description: 'Auto layout · Brand token' },
  { kind: 'secondary-button', name: 'Secondary Button', description: 'Auto layout · Surface token' },
  { kind: 'text-field', name: 'Text Field', description: 'Label and placeholder' },
  { kind: 'search-field', name: 'Search Field', description: 'Search control' },
  { kind: 'toggle', name: 'Toggle', description: 'Interactive control' },
  { kind: 'checkbox', name: 'Checkbox', description: 'Selection control' },
  { kind: 'badge', name: 'Badge', description: 'Compact status label' },
  { kind: 'avatar', name: 'Avatar', description: 'Profile placeholder' },
  { kind: 'card', name: 'Content Card', description: 'Vertical auto layout' },
  { kind: 'nav-item', name: 'Navigation Item', description: 'Sidebar row' },
];

function id(kind: StarterComponentKind, suffix: string): string {
  return `ui-${kind}-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function base(
  elementId: string,
  name: string,
  type: CanvasElement['type'],
  x: number,
  y: number,
  width: number,
  height: number,
  parentId: string | null
): CanvasElement {
  return {
    id: elementId, name, type, x, y, width, height, rotation: 0,
    fill: '#ffffff', fillOpacity: 1, stroke: '#dbe2ea', strokeWidth: 0,
    strokeOpacity: 1, strokeStyle: 'solid', strokeAlign: 'inside', cornerRadius: 12,
    opacity: 1, visible: true, locked: false, parentId,
  };
}

function text(
  elementId: string,
  parentId: string,
  content: string,
  color: string,
  width: number,
  fontSize = 14,
  fontWeight: number | string = 600
): CanvasElement {
  return {
    ...base(elementId, content, 'text', 0, 0, width, Math.round(fontSize * 1.45), parentId),
    fill: color,
    fillOpacity: 1,
    strokeWidth: 0,
    cornerRadius: 0,
    textContent: content,
    fontSize,
    fontWeight,
    fontFamily: 'Inter, system-ui, sans-serif',
    lineHeight: 1.45,
  };
}

export function buildStarterComponent(
  kind: StarterComponentKind,
  position: { x: number; y: number }
): CanvasElement[] {
  const meta = STARTER_COMPONENTS.find((item) => item.kind === kind)!;
  const rootId = id(kind, 'root');
  const root: CanvasElement = {
    ...base(rootId, `Figmint UI / ${meta.name}`, 'component', position.x, position.y, 180, 44, null),
    presetName: `ui-kit:${kind}`,
    clipContent: false,
    layoutMode: 'horizontal' as const,
    layoutGap: 8,
    layoutPadding: { top: 10, right: 16, bottom: 10, left: 16 },
    layoutPrimaryAlign: 'center' as const,
    layoutCounterAlign: 'center' as const,
    layoutSizingHorizontal: 'fixed' as const,
    layoutSizingVertical: 'fixed' as const,
    tokenBindings: { cornerRadius: 'radius-md' },
  };

  if (kind === 'primary-button' || kind === 'secondary-button') {
    root.width = kind === 'primary-button' ? 164 : 176;
    root.fill = kind === 'primary-button' ? '#0d99ff' : '#ffffff';
    root.strokeWidth = kind === 'secondary-button' ? 1 : 0;
    root.tokenBindings = kind === 'primary-button'
      ? { fill: 'color-brand-500', cornerRadius: 'radius-md', layoutGap: 'spacing-sm' }
      : { fill: 'color-surface', stroke: 'color-border', cornerRadius: 'radius-md', layoutGap: 'spacing-sm' };
    return [root, text(id(kind, 'label'), rootId, kind === 'primary-button' ? 'Continue' : 'Secondary action', kind === 'primary-button' ? '#ffffff' : '#111827', 132)];
  }

  if (kind === 'text-field' || kind === 'search-field') {
    root.width = 260;
    root.height = 48;
    root.strokeWidth = 1;
    root.layoutPrimaryAlign = 'start';
    root.tokenBindings = { fill: 'color-surface', stroke: 'color-border', cornerRadius: 'radius-md', layoutGap: 'spacing-sm' };
    const children: CanvasElement[] = [];
    if (kind === 'search-field') {
      children.push(text(id(kind, 'icon'), rootId, '⌕', '#64748b', 18, 18, 500));
    }
    children.push(text(id(kind, 'placeholder'), rootId, kind === 'search-field' ? 'Search anything…' : 'Enter a value…', '#64748b', 188, 13, 500));
    return [root, ...children];
  }

  if (kind === 'toggle') {
    root.width = 52;
    root.height = 30;
    root.fill = '#0d99ff';
    root.cornerRadius = 999;
    root.layoutPadding = { top: 3, right: 3, bottom: 3, left: 25 };
    root.tokenBindings = { fill: 'color-brand-500', cornerRadius: 'radius-pill' };
    const knob = { ...base(id(kind, 'knob'), 'Knob', 'ellipse', 0, 0, 24, 24, rootId), strokeWidth: 0, cornerRadius: 999 };
    return [root, knob];
  }

  if (kind === 'checkbox') {
    root.width = 28;
    root.height = 28;
    root.fill = '#0d99ff';
    root.layoutPadding = { top: 4, right: 4, bottom: 4, left: 4 };
    root.tokenBindings = { fill: 'color-brand-500', cornerRadius: 'radius-sm' };
    return [root, text(id(kind, 'check'), rootId, '✓', '#ffffff', 18, 14, 800)];
  }

  if (kind === 'badge') {
    root.width = 104;
    root.height = 30;
    root.fill = '#e5f2ff';
    root.cornerRadius = 999;
    root.layoutPadding = { top: 5, right: 12, bottom: 5, left: 12 };
    root.tokenBindings = { cornerRadius: 'radius-pill' };
    return [root, text(id(kind, 'label'), rootId, 'Open source', '#0878c7', 80, 12, 700)];
  }

  if (kind === 'avatar') {
    root.width = 52;
    root.height = 52;
    root.fill = '#7c3aed';
    root.cornerRadius = 999;
    root.layoutPadding = { top: 12, right: 12, bottom: 12, left: 12 };
    root.tokenBindings = { cornerRadius: 'radius-pill' };
    return [root, text(id(kind, 'initials'), rootId, 'FM', '#ffffff', 28, 14, 800)];
  }

  if (kind === 'card') {
    root.width = 300;
    root.height = 168;
    root.layoutMode = 'vertical';
    root.layoutPrimaryAlign = 'start';
    root.layoutCounterAlign = 'start';
    root.layoutGap = 10;
    root.layoutPadding = { top: 20, right: 20, bottom: 20, left: 20 };
    root.shadow = { x: 0, y: 12, blur: 28, spread: -8, color: '#0f172a', opacity: 0.18 };
    root.tokenBindings = { fill: 'color-surface', cornerRadius: 'radius-md', layoutGap: 'spacing-md' };
    return [
      root,
      text(id(kind, 'title'), rootId, 'Open design system', '#111827', 260, 18, 700),
      text(id(kind, 'body'), rootId, 'Reusable components, tokens and local-first files.', '#64748b', 260, 13, 500),
      text(id(kind, 'link'), rootId, 'Explore components →', '#0d99ff', 260, 13, 700),
    ];
  }

  root.width = 228;
  root.height = 44;
  root.layoutPrimaryAlign = 'start';
  root.fill = '#e5f2ff';
  root.tokenBindings = { cornerRadius: 'radius-md', layoutGap: 'spacing-sm' };
  return [
    root,
    text(id(kind, 'icon'), rootId, '◆', '#0d99ff', 18, 13, 700),
    text(id(kind, 'label'), rootId, 'Components', '#111827', 160, 13, 650),
  ];
}
