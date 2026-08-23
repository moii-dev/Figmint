import assert from 'node:assert/strict';
import test from 'node:test';
import { CanvasElement, ShapeType } from '../types/figma';
import {
  canReparentElement,
  findFrameAtPoint,
  getAllDescendantIds,
  getTopLevelSelectionIds,
  getWorldPosition,
  reparentElement,
  worldToLocalPosition,
} from './hierarchy';

function element(id: string, type: ShapeType, x: number, y: number, parentId: string | null = null): CanvasElement {
  return {
    id,
    name: id,
    type,
    x,
    y,
    width: 100,
    height: 80,
    rotation: 0,
    fill: '#ffffff',
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

test('world and local coordinates remain inverse for frame children', () => {
  const frame = element('frame', 'frame', 300, 200);
  const child = element('child', 'rectangle', 25, 40, frame.id);
  const elements = [frame, child];

  assert.deepEqual(getWorldPosition(child, elements), { x: 325, y: 240 });
  assert.deepEqual(worldToLocalPosition({ x: 325, y: 240 }, frame.id, elements), { x: 25, y: 40 });
});

test('reparenting preserves visual world position', () => {
  const first = element('first', 'frame', 100, 100);
  const second = element('second', 'frame', 500, 250);
  const child = element('child', 'ellipse', 30, 45, first.id);
  const elements = [first, second, child];

  const moved = reparentElement(child, second.id, elements);
  assert.deepEqual(moved, { x: -370, y: -105, parentId: second.id });
  assert.deepEqual(reparentElement({ ...child, ...moved }, null, [first, second, { ...child, ...moved }]), {
    x: 130,
    y: 145,
    parentId: null,
  });
});

test('containers can nest while circular and instance nesting is rejected', () => {
  const frame = element('frame', 'frame', 0, 0);
  const otherFrame = element('other-frame', 'frame', 200, 0);
  const shape = element('shape', 'rectangle', 20, 20, frame.id);
  const instance = element('instance', 'instance', 400, 0);
  const elements = [frame, otherFrame, shape, instance];

  assert.equal(canReparentElement(frame, otherFrame.id, elements), true);
  assert.equal(canReparentElement(shape, otherFrame.id, elements), true);
  assert.equal(canReparentElement(shape, shape.id, elements), false);
  assert.equal(canReparentElement(shape, instance.id, elements), false);
  const nested = [{ ...frame }, { ...otherFrame, parentId: frame.id }, shape, instance];
  assert.equal(canReparentElement(frame, otherFrame.id, nested), false);
});

test('selection normalization and descendant traversal are cycle safe', () => {
  const frame = element('frame', 'frame', 0, 0);
  const child = element('child', 'rectangle', 10, 10, frame.id);
  const malformedA = element('a', 'rectangle', 0, 0, 'b');
  const malformedB = element('b', 'rectangle', 0, 0, 'a');
  const elements = [frame, child, malformedA, malformedB];

  assert.deepEqual(getTopLevelSelectionIds([frame.id, child.id], elements), [frame.id]);
  assert.deepEqual(getAllDescendantIds('a', elements), ['b']);
  assert.doesNotThrow(() => getWorldPosition(malformedA, elements));
});

test('frame hit testing returns the topmost unlocked container', () => {
  const back = element('back', 'frame', 0, 0);
  const front = element('front', 'frame', 20, 20);
  assert.equal(findFrameAtPoint({ x: 30, y: 30 }, [back, front])?.id, 'front');
  assert.equal(findFrameAtPoint({ x: 30, y: 30 }, [back, { ...front, locked: true }])?.id, 'back');
});
