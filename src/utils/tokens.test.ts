import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanvasElement, DesignToken } from '../types/figma';
import { bindElementToken, removeTokenAndMaterialize, resolveElementTokens } from './tokens';

const element: CanvasElement = {
  id: 'shape', name: 'Shape', type: 'rectangle', x: 0, y: 0, width: 100, height: 40,
  rotation: 0, fill: '#000000', fillOpacity: 1, stroke: '#000000', strokeWidth: 0,
  strokeOpacity: 1, strokeStyle: 'solid', strokeAlign: 'inside', cornerRadius: 0,
  opacity: 1, visible: true, locked: false,
};
const tokens: DesignToken[] = [
  { id: 'brand', name: 'Brand', category: 'color', value: '#0d99ff' },
  { id: 'radius', name: 'Radius', category: 'radius', value: 12 },
];

test('bound tokens resolve to canvas properties', () => {
  const bound = bindElementToken(bindElementToken(element, 'fill', 'brand'), 'cornerRadius', 'radius');
  const resolved = resolveElementTokens(bound, tokens);
  assert.equal(resolved.fill, '#0d99ff');
  assert.equal(resolved.cornerRadius, 12);
});

test('deleting a token materializes its last value and removes binding', () => {
  const bound = bindElementToken(element, 'fill', 'brand');
  const [result] = removeTokenAndMaterialize([bound], tokens, 'brand');
  assert.equal(result.fill, '#0d99ff');
  assert.equal(result.tokenBindings, undefined);
});
