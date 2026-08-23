import type {
  CanvasElement,
  DesignToken,
  DesignTokenCategory,
  ElementTokenBindings,
  TokenBindableProperty,
} from '../types/figma';

export const DEFAULT_DESIGN_TOKENS: DesignToken[] = [
  { id: 'color-brand-500', name: 'Brand / 500', category: 'color', value: '#0d99ff' },
  { id: 'color-surface', name: 'Surface / Base', category: 'color', value: '#ffffff' },
  { id: 'color-text', name: 'Text / Primary', category: 'color', value: '#111827' },
  { id: 'color-border', name: 'Border / Default', category: 'color', value: '#dbe2ea' },
  { id: 'spacing-sm', name: 'Spacing / Small', category: 'spacing', value: 8 },
  { id: 'spacing-md', name: 'Spacing / Medium', category: 'spacing', value: 12 },
  { id: 'spacing-lg', name: 'Spacing / Large', category: 'spacing', value: 16 },
  { id: 'radius-sm', name: 'Radius / Small', category: 'radius', value: 8 },
  { id: 'radius-md', name: 'Radius / Medium', category: 'radius', value: 12 },
  { id: 'radius-pill', name: 'Radius / Pill', category: 'radius', value: 999 },
];

const PROPERTY_CATEGORY: Record<TokenBindableProperty, DesignTokenCategory> = {
  fill: 'color',
  stroke: 'color',
  cornerRadius: 'radius',
  layoutGap: 'spacing',
};

export function getCompatibleTokens(
  property: TokenBindableProperty,
  tokens: DesignToken[]
): DesignToken[] {
  return tokens.filter((token) => token.category === PROPERTY_CATEGORY[property]);
}

export function resolveElementTokens(
  element: CanvasElement,
  tokens: DesignToken[] = []
): CanvasElement {
  const bindings = element.tokenBindings;
  if (!bindings) return element;

  const tokenMap = new Map(tokens.map((token) => [token.id, token]));
  const updates: Partial<CanvasElement> = {};

  (Object.entries(bindings) as [TokenBindableProperty, string][]).forEach(([property, tokenId]) => {
    const token = tokenMap.get(tokenId);
    if (!token || token.category !== PROPERTY_CATEGORY[property]) return;
    if ((property === 'fill' || property === 'stroke') && typeof token.value === 'string') {
      updates[property] = token.value;
    }
    if ((property === 'cornerRadius' || property === 'layoutGap') && typeof token.value === 'number') {
      updates[property] = token.value;
    }
  });

  return Object.keys(updates).length > 0 ? { ...element, ...updates } : element;
}

export function bindElementToken(
  element: CanvasElement,
  property: TokenBindableProperty,
  tokenId: string | null
): CanvasElement {
  const bindings: ElementTokenBindings = { ...(element.tokenBindings || {}) };
  if (tokenId) bindings[property] = tokenId;
  else delete bindings[property];
  return {
    ...element,
    tokenBindings: Object.keys(bindings).length > 0 ? bindings : undefined,
  };
}

export function removeTokenAndMaterialize(
  elements: CanvasElement[],
  tokens: DesignToken[],
  tokenId: string
): CanvasElement[] {
  return elements.map((element) => {
    const entries = Object.entries(element.tokenBindings || {}) as [TokenBindableProperty, string][];
    if (!entries.some(([, binding]) => binding === tokenId)) return element;
    const resolved = resolveElementTokens(element, tokens);
    const nextBindings = Object.fromEntries(entries.filter(([, binding]) => binding !== tokenId));
    return {
      ...resolved,
      tokenBindings: Object.keys(nextBindings).length > 0 ? nextBindings : undefined,
    };
  });
}
