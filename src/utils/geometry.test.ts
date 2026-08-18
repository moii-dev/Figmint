import assert from 'node:assert/strict';
import test from 'node:test';
import { CanvasElement, ShapeType } from '../types/figma';
import { calculateSnapping, generateSvgString, getMarqueeSelectionIds } from './geometry';

function element(
  id: string,
  type: ShapeType,
  x: number,
  y: number,
  parentId: string | null = null,
  width = 100,
  height = 80
): CanvasElement {
  return {
    id,
    name: id,
    type,
    x,
    y,
    width,
    height,
    rotation: 0,
    fill: '#0d99ff',
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
    parentId,
  };
}

test('snapping uses world rects and keeps only the closest guide per axis', () => {
  const result = calculateSnapping(
    { x: 98, y: 99, width: 50, height: 50 },
    [{ x: 100, y: 100, width: 50, height: 50 }],
    6
  );

  assert.equal(result.snappedX, 100);
  assert.equal(result.snappedY, 100);
  assert.equal(result.guides.filter((guide) => guide.type === 'x').length, 1);
  assert.equal(result.guides.filter((guide) => guide.type === 'y').length, 1);
});

test('marquee selects children without selecting their partially intersected frame', () => {
  const frame = element('frame', 'frame', 100, 100, null, 300, 300);
  const first = element('first', 'rectangle', 20, 20, frame.id, 40, 40);
  const second = element('second', 'text', 90, 20, frame.id, 80, 30);
  const elements = [frame, first, second];

  assert.deepEqual(getMarqueeSelectionIds({ x: 110, y: 110, width: 190, height: 80 }, elements), [
    first.id,
    second.id,
  ]);
  assert.deepEqual(getMarqueeSelectionIds({ x: 90, y: 90, width: 330, height: 330 }, elements), [frame.id]);
});

test('SVG export uses world coordinates and escapes text and font metadata', () => {
  const frame = element('frame', 'frame', 200, 100, null, 300, 200);
  const textElement: CanvasElement = {
    ...element('text', 'text', 25, 30, frame.id, 120, 40),
    textContent: '<Hello & "Figmint">',
    fontFamily: 'A&B',
    fontSize: 16,
    fontWeight: 600,
    textAlign: 'left',
  };

  const svg = generateSvgString([textElement], [frame, textElement]);
  assert.match(svg, /x="225" y="146"/);
  assert.match(svg, /&lt;Hello &amp; &quot;Figmint&quot;&gt;/);
  assert.match(svg, /font-family="A&amp;B"/);
  assert.doesNotMatch(svg, /<Hello/);
});

test('SVG export collapses legacy layers into one multi-color gradient', () => {
  const shape: CanvasElement = {
    ...element('gradient-shape', 'rectangle', 0, 0),
    gradients: [
      {
        id: 'top',
        type: 'linear',
        angle: 90,
        opacity: 0.8,
        visible: true,
        stops: [
          { color: '#8B5CF6', position: 0, opacity: 1 },
          { color: '#06B6D4', position: 100, opacity: 1 },
        ],
      },
      {
        id: 'bottom',
        type: 'linear',
        angle: 180,
        opacity: 0.6,
        visible: true,
        stops: [
          { color: '#FF4D8D', position: 0, opacity: 1 },
          { color: '#FFB648', position: 100, opacity: 1 },
        ],
      },
    ],
  };

  const svg = generateSvgString([shape]);
  assert.equal(svg.match(/<linearGradient/g)?.length, 1);
  assert.equal(svg.match(/<stop /g)?.length, 4);
  assert.match(svg, /url\(#export-gradient-shape-top\)/);
  assert.doesNotMatch(svg, /url\(#export-gradient-shape-bottom\)/);
});

test('SVG export uses stroke settings for text and line elements', () => {
  const textElement: CanvasElement = {
    ...element('outlined-text', 'text', 0, 0),
    textContent: 'Stroke',
    stroke: '#FF0000',
    strokeWidth: 2,
  };
  const lineElement: CanvasElement = {
    ...element('outlined-line', 'line', 0, 30),
    stroke: '#00FF00',
    strokeWidth: 4,
  };

  const svg = generateSvgString([textElement, lineElement]);
  assert.match(svg, /<text[^>]+stroke="rgba\(255, 0, 0, 1\)"[^>]+stroke-width="2"/);
  assert.match(svg, /<line[^>]+stroke="rgba\(0, 255, 0, 1\)"[^>]+stroke-width="4"/);
});
