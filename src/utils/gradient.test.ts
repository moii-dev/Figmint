import assert from 'node:assert/strict';
import test from 'node:test';
import { CanvasElement } from '../types/figma';
import {
  createLinearGradient,
  getElementCssFill,
  getSvgGradientCoordinates,
} from './gradient';

const element: CanvasElement = {
  id: 'shape',
  name: 'Shape',
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  fill: '#FFFFFF',
  fillOpacity: 1,
  stroke: '#000000',
  strokeWidth: 0,
  strokeOpacity: 1,
  strokeStyle: 'solid',
  strokeAlign: 'inside',
  cornerRadius: 0,
  opacity: 1,
  visible: true,
  locked: false,
};

test('creates distinct two-stop gradient layers', () => {
  const first = createLinearGradient(0);
  const second = createLinearGradient(1);

  assert.equal(first.stops.length, 2);
  assert.notDeepEqual(first.stops, second.stops);
  assert.notEqual(first.id, second.id);
});

test('builds an unlimited ordered CSS gradient stack', () => {
  const gradients = Array.from({ length: 12 }, (_, index) => createLinearGradient(index));
  const style = getElementCssFill({ ...element, gradients });

  assert.equal(style.backgroundImage?.match(/linear-gradient/g)?.length, 12);
  assert.match(style.backgroundImage || '', /rgba\(139, 92, 246, 0\.82\)/);
});

test('converts CSS angles to SVG gradient coordinates', () => {
  assert.deepEqual(getSvgGradientCoordinates(90), {
    x1: '0%',
    y1: '50%',
    x2: '100%',
    y2: '50%',
  });
});
