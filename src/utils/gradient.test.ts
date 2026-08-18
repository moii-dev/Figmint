import assert from 'node:assert/strict';
import test from 'node:test';
import { CanvasElement } from '../types/figma';
import {
  addGradientColor,
  collapseGradientLayers,
  createLinearGradient,
  getElementCssFill,
  getRenderableGradientStops,
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

test('creates a two-color gradient based on the current fill', () => {
  const first = createLinearGradient(0, '#FFFFFF');
  const second = createLinearGradient(1);

  assert.equal(first.stops.length, 2);
  assert.equal(first.stops[0].color, '#FFFFFF');
  assert.notDeepEqual(first.stops, second.stops);
  assert.notEqual(first.id, second.id);
});

test('adds unlimited colors and redistributes them across one gradient', () => {
  let gradient = createLinearGradient(0);
  for (let index = 0; index < 12; index += 1) gradient = addGradientColor(gradient);
  const style = getElementCssFill({ ...element, gradients: [gradient] });

  assert.equal(gradient.stops.length, 14);
  assert.equal(gradient.stops[0].position, 0);
  assert.equal(gradient.stops.at(-1)?.position, 100);
  assert.equal(style.backgroundImage?.match(/linear-gradient/g)?.length, 1);
  assert.match(style.backgroundImage || '', /rgba\(139, 92, 246, 1\)/);
});

test('collapses legacy gradient layers into evenly distributed color stops', () => {
  const gradient = collapseGradientLayers([createLinearGradient(0), createLinearGradient(1)]);
  assert.equal(gradient?.stops.length, 4);
  assert.deepEqual(gradient?.stops.map((stop) => Math.round(stop.position)), [0, 33, 67, 100]);
});

test('hidden colors are excluded and a single visible color remains renderable', () => {
  const gradient = createLinearGradient(0);
  gradient.stops[1].visible = false;
  const stops = getRenderableGradientStops(gradient);

  assert.equal(stops.length, 2);
  assert.deepEqual(stops.map((stop) => stop.position), [0, 100]);
  assert.equal(stops[0].color, stops[1].color);
});

test('converts CSS angles to SVG gradient coordinates', () => {
  assert.deepEqual(getSvgGradientCoordinates(90), {
    x1: '0%',
    y1: '50%',
    x2: '100%',
    y2: '50%',
  });
});
