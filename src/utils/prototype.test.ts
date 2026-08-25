import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanvasElement } from '../types/figma';
import {
  clampPrototypeDuration,
  createPrototypeInteraction,
  getMissingDestinationIds,
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
