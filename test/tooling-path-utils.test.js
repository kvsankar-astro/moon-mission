import { describe, expect, it } from 'vitest';
import { normalizeToolingPath } from './tooling-path-utils.js';

describe('normalizeToolingPath', () => {
  it('strips extended-length Windows prefixes from drive paths on Windows', () => {
    const input = '\\\\?\\C:\\repo\\moon-mission';
    const expected = process.platform === 'win32' ? 'C:\\repo\\moon-mission' : input;
    expect(normalizeToolingPath(input)).toBe(expected);
  });

  it('leaves normal paths unchanged', () => {
    const input = 'C:\\repo\\moon-mission';
    expect(normalizeToolingPath(input)).toBe(input);
  });
});
