import test from 'node:test';
import assert from 'node:assert/strict';
import { hsvToHex, normalizeHexColor, rgbToHsv } from './color';

test('RGB and HSV conversion preserves primary colors', () => {
  assert.deepEqual(rgbToHsv('#FF0000'), { h: 0, s: 1, v: 1 });
  assert.deepEqual(rgbToHsv('#00FF00'), { h: 120, s: 1, v: 1 });
  assert.deepEqual(rgbToHsv('#0000FF'), { h: 240, s: 1, v: 1 });
  assert.equal(hsvToHex({ h: 0, s: 1, v: 1 }), '#FF0000');
  assert.equal(hsvToHex({ h: 120, s: 1, v: 1 }), '#00FF00');
  assert.equal(hsvToHex({ h: 240, s: 1, v: 1 }), '#0000FF');
});

test('color conversion handles grayscale, wrapped hue, and invalid input', () => {
  assert.deepEqual(rgbToHsv('#808080'), { h: 0, s: 0, v: 128 / 255 });
  assert.equal(hsvToHex({ h: 360, s: 1, v: 1 }), '#FF0000');
  assert.equal(hsvToHex({ h: -120, s: 1, v: 1 }), '#0000FF');
  assert.equal(normalizeHexColor('invalid'), '#0D99FF');
});
