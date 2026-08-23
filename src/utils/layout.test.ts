import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanvasElement } from '../types/figma';
import { applyAutoLayout, reorderAutoLayoutChild } from './layout';

function element(id: string, parentId: string | null, width: number, height: number): CanvasElement {
  return {
    id, name: id, type: id === 'container' ? 'frame' : 'rectangle',
    x: 0, y: 0, width, height, rotation: 0, fill: '#fff', fillOpacity: 1,
    stroke: '#000', strokeWidth: 0, strokeOpacity: 1, strokeStyle: 'solid',
    strokeAlign: 'inside', cornerRadius: 0, opacity: 1, visible: true, locked: false, parentId,
  };
}

test('horizontal auto layout places children using padding and gap', () => {
  const container = {
    ...element('container', null, 200, 80),
    layoutMode: 'horizontal' as const,
    layoutGap: 10,
    layoutPadding: { top: 12, right: 16, bottom: 12, left: 16 },
    layoutCounterAlign: 'center' as const,
  };
  const result = applyAutoLayout([container, element('a', 'container', 40, 20), element('b', 'container', 60, 30)]);
  assert.deepEqual(result.find((item) => item.id === 'a') && { x: result[1].x, y: result[1].y }, { x: 16, y: 30 });
  assert.equal(result[2].x, 66);
  assert.equal(result[2].y, 25);
});

test('hug sizing and fill child produce deterministic dimensions', () => {
  const container = {
    ...element('container', null, 180, 100),
    layoutMode: 'vertical' as const,
    layoutGap: 8,
    layoutPadding: { top: 10, right: 12, bottom: 10, left: 12 },
    layoutSizingHorizontal: 'hug' as const,
    layoutSizingVertical: 'hug' as const,
  };
  const result = applyAutoLayout([container, element('a', 'container', 80, 20), element('b', 'container', 120, 24)]);
  const laidOut = result.find((item) => item.id === 'container')!;
  assert.equal(laidOut.width, 144);
  assert.equal(laidOut.height, 72);
});

test('reordering an auto layout child changes sibling order and positions', () => {
  const container = { ...element('container', null, 200, 60), layoutMode: 'horizontal' as const, layoutGap: 8 };
  const result = reorderAutoLayoutChild(
    [container, element('a', 'container', 20, 20), element('b', 'container', 20, 20)],
    'b',
    'a'
  );
  assert.deepEqual(result.filter((item) => item.parentId === 'container').map((item) => item.id), ['b', 'a']);
  assert.ok(result.find((item) => item.id === 'b')!.x < result.find((item) => item.id === 'a')!.x);
});
