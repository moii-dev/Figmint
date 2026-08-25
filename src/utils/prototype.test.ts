import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanvasElement } from '../types/figma';
import {
  clampPrototypeDuration,
  createPrototypeInteraction,
  getConnectionAnchorPoint,
  getMissingDestinationIds,
  getNearestConnectionSide,
  getPrototypeDestinationFrame,
  getPrototypeStartFrame,
  matchSmartAnimateLayers,
} from './prototype';

function frame(id: string, start = false): CanvasElement {
  return {
    id, name: id, type: 'frame', x: 0, y: 0, width: 100, height: 100,
    rotation: 0, fill: '#fff', fillOpacity: 1, stroke: '#000', strokeWidth: 0,
    strokeOpacity: 1, strokeStyle: 'solid', strokeAlign: 'inside', cornerRadius: 0,
    opacity: 1, visible: true, locked: false, prototypeFlowStart: start,
  };
}

test('prototype duration is normalized to the supported range', () => {
  assert.equal(clampPrototypeDuration(0), 1);
  assert.equal(clampPrototypeDuration(20_000), 10_000);
  assert.equal(clampPrototypeDuration(Number.NaN), 300);
});

test('smart animate matches layers by type, name, and hierarchy path', () => {
  const first = frame('first');
  const second = frame('second');
  const source = { ...frame('source'), type: 'rectangle' as const, name: 'Hero', parentId: first.id };
  const destination = { ...source, id: 'destination', x: 40, parentId: second.id };
  assert.equal(matchSmartAnimateLayers([first, second, source, destination], first.id, second.id).get(destination.id)?.id, source.id);
});

test('prototype start prefers the explicit flow start, then selection', () => {
  const frames = [frame('first'), frame('start', true)];
  assert.equal(getPrototypeStartFrame(frames, ['first'])?.id, 'start');
  assert.equal(getPrototypeStartFrame(frames.map((item) => ({ ...item, prototypeFlowStart: false })), ['first'])?.id, 'first');
});

test('missing destinations remain detectable instead of being silently removed', () => {
  const hotspot: CanvasElement = {
    ...frame('hotspot'),
    type: 'rectangle',
    interactions: [{ ...createPrototypeInteraction('deleted-frame'), id: 'go' }],
  };
  assert.deepEqual([...getMissingDestinationIds([frame('existing'), hotspot])], ['deleted-frame']);
});

test('connection anchors resolve all four sides and choose the side nearest the pointer', () => {
  const rect = { x: 100, y: 50, width: 200, height: 120 };
  assert.deepEqual(getConnectionAnchorPoint(rect, 'top'), { x: 200, y: 50 });
  assert.deepEqual(getConnectionAnchorPoint(rect, 'right'), { x: 300, y: 110 });
  assert.deepEqual(getConnectionAnchorPoint(rect, 'bottom'), { x: 200, y: 170 });
  assert.deepEqual(getConnectionAnchorPoint(rect, 'left'), { x: 100, y: 110 });
  assert.equal(getNearestConnectionSide(rect, { x: 205, y: 54 }), 'top');
  assert.equal(getNearestConnectionSide(rect, { x: 296, y: 112 }), 'right');
  assert.equal(getNearestConnectionSide(rect, { x: 190, y: 168 }), 'bottom');
  assert.equal(getNearestConnectionSide(rect, { x: 102, y: 120 }), 'left');
});

test('a target layer resolves to its top-level destination frame', () => {
  const screen = frame('screen');
  const group = { ...frame('group'), type: 'rectangle' as const, parentId: screen.id };
  const button = { ...frame('button'), type: 'rectangle' as const, parentId: group.id };
  assert.equal(getPrototypeDestinationFrame(button, [screen, group, button])?.id, screen.id);
  assert.equal(getPrototypeDestinationFrame(screen, [screen, group, button])?.id, screen.id);
});
