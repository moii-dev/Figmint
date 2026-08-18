import assert from 'node:assert/strict';
import test from 'node:test';
import { CanvasElement } from '../types/figma';
import { getCssStrokeOverlayStyle } from './stroke';

const element: CanvasElement = {
  id: 'shape',
  name: 'Shape',
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  rotation: 0,
  fill: '#FFFFFF',
  fillOpacity: 1,
  stroke: '#000000',
  strokeWidth: 4,
  strokeOpacity: 1,
  strokeStyle: 'solid',
  strokeAlign: 'inside',
  cornerRadius: 8,
  opacity: 1,
  visible: true,
  locked: false,
};

test('CSS stroke overlay respects inside, center, and outside alignment', () => {
  assert.equal(getCssStrokeOverlayStyle(element, '#000000').inset, '0px');
  assert.equal(
    getCssStrokeOverlayStyle({ ...element, strokeAlign: 'center' }, '#000000').inset,
    '-2px'
  );
  assert.equal(
    getCssStrokeOverlayStyle({ ...element, strokeAlign: 'outside' }, '#000000').inset,
    '-4px'
  );
});

test('CSS stroke overlay preserves style and expands the corner radius', () => {
  const style = getCssStrokeOverlayStyle(
    { ...element, strokeAlign: 'outside', strokeStyle: 'dashed' },
    'rgba(0, 0, 0, 0.5)'
  );
  assert.equal(style.borderStyle, 'dashed');
  assert.equal(style.borderRadius, '12px');
  assert.equal(style.borderColor, 'rgba(0, 0, 0, 0.5)');
});
