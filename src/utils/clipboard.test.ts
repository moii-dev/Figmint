import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanvasElement } from '../types/figma';
import { parseClipboardPayload, serializeClipboardPayload } from './clipboard';

const element: CanvasElement = {
  id: 'shape', name: 'Shape', type: 'rectangle', x: 0, y: 0, width: 20, height: 20,
  rotation: 0, fill: '#fff', fillOpacity: 1, stroke: '#000', strokeWidth: 0,
  strokeOpacity: 1, strokeStyle: 'solid', strokeAlign: 'inside', cornerRadius: 0,
  opacity: 1, visible: true, locked: false,
};

test('clipboard parser remains compatible with version 1 payloads', () => {
  const serialized = serializeClipboardPayload({ version: 1, elements: [element], topLevelIds: [element.id] });
  assert.equal(parseClipboardPayload(serialized)?.version, 1);
});

test('clipboard version 2 preserves the source project for component links', () => {
  const serialized = serializeClipboardPayload({ version: 2, elements: [element], topLevelIds: [element.id], sourceProjectId: 'project' });
  const parsed = parseClipboardPayload(serialized);
  assert.equal(parsed?.sourceProjectId, 'project');
  assert.equal(parseClipboardPayload('plain text'), null);
});
