import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanvasElement } from '../types/figma';
import {
  createInstanceTree,
  detachInstanceTree,
  recordInstanceOverride,
  syncInstances,
} from './components';

function element(id: string, type: CanvasElement['type'], parentId: string | null): CanvasElement {
  return {
    id, name: id, type, x: 0, y: 0, width: 100, height: 40, rotation: 0,
    fill: '#ffffff', fillOpacity: 1, stroke: '#000000', strokeWidth: 0,
    strokeOpacity: 1, strokeStyle: 'solid', strokeAlign: 'inside', cornerRadius: 8,
    opacity: 1, visible: true, locked: false, parentId,
    textContent: type === 'text' ? 'Button' : undefined,
  };
}

test('component instance syncs master changes and preserves overrides', () => {
  const master = element('master', 'component', null);
  const label = element('label', 'text', 'master');
  const created = createInstanceTree('master', [master, label], { x: 200, y: 0 })!;
  let elements = [master, label, ...created.elements];
  const instanceLabel = elements.find((item) => item.sourceElementId === 'label')!;
  elements = elements.map((item) => item.id === instanceLabel.id ? { ...item, textContent: 'Override' } : item);
  elements = recordInstanceOverride(elements, instanceLabel.id, { textContent: 'Override' });
  elements = elements.map((item) => item.id === 'label' ? { ...item, fill: '#ff0000', textContent: 'Master' } : item);
  elements = syncInstances(elements, 'master');
  const syncedLabel = elements.find((item) => item.sourceElementId === 'label')!;
  assert.equal(syncedLabel.fill, '#ff0000');
  assert.equal(syncedLabel.textContent, 'Override');
});

test('detaching an instance keeps appearance and removes component metadata', () => {
  const master = element('master', 'component', null);
  const created = createInstanceTree('master', [master])!;
  const detached = detachInstanceTree([master, ...created.elements], created.rootId);
  const root = detached.find((item) => item.id === created.rootId)!;
  assert.equal(root.type, 'frame');
  assert.equal(root.mainComponentId, undefined);
  assert.equal(root.sourceElementId, undefined);
});
