import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStorageFallback, mergeLatestProjectState } from './projectStorage';
import { FigmaProject } from '../types/figma';

const baseElement = {
  id: 'image-1',
  name: 'Image',
  type: 'image' as const,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  fill: '#ffffff',
  fillOpacity: 1,
  stroke: '#000000',
  strokeWidth: 0,
  strokeOpacity: 1,
  strokeStyle: 'solid' as const,
  strokeAlign: 'inside' as const,
  cornerRadius: 0,
  opacity: 1,
  visible: true,
  locked: false,
};

function createProject(mediaSrc: string): FigmaProject {
  return {
    id: 'project-1',
    title: 'Project',
    createdAt: 1,
    updatedAt: 2,
    zoom: 1,
    pan: { x: 0, y: 0 },
    elements: [{ ...baseElement, mediaSrc }],
  };
}

test('localStorage fallback keeps small media and removes large inline media', () => {
  const smallProject = createProject('data:image/png;base64,abc');
  const largeProject = createProject(`data:video/mp4;base64,${'a'.repeat(100)}`);

  const [smallFallback] = createLocalStorageFallback([smallProject], 32);
  const [largeFallback] = createLocalStorageFallback([largeProject], 32);

  assert.equal(smallFallback.elements[0].mediaSrc, smallProject.elements[0].mediaSrc);
  assert.equal(largeFallback.elements[0].mediaSrc, undefined);
  assert.equal(largeFallback.elements[0].mediaName, largeProject.elements[0].mediaName);
});

test('creating a localStorage fallback does not mutate the live project', () => {
  const project = createProject(`data:image/png;base64,${'b'.repeat(100)}`);
  const originalSource = project.elements[0].mediaSrc;

  createLocalStorageFallback([project], 32);

  assert.equal(project.elements[0].mediaSrc, originalSource);
});

test('latest editor state is merged before switching projects', () => {
  const current = createProject('data:image/png;base64,old');
  const other = { ...createProject('data:image/png;base64,other'), id: 'project-2' };
  const nextElements = [{ ...baseElement, id: 'image-latest', mediaSrc: 'data:image/png;base64,new' }];

  const result = mergeLatestProjectState(
    [current, other],
    current.id,
    nextElements,
    1.5,
    { x: 25, y: 50 },
    99
  );

  assert.deepEqual(result[0].elements, nextElements);
  assert.equal(result[0].zoom, 1.5);
  assert.deepEqual(result[0].pan, { x: 25, y: 50 });
  assert.equal(result[0].updatedAt, 99);
  assert.equal(result[1], other);
});
