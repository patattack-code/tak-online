import { describe, expect, it } from 'vitest';
import { SLUG_RE, randomName, slugify } from './slug';

describe('slugify', () => {
  it('turns names into URL-safe slugs', () => {
    expect(slugify('Friday night Tak')).toBe('friday-night-tak');
    expect(slugify('  Ünïcode & symbols!! ')).toBe('unicode-symbols');
    expect(slugify('---')).toBe('');
  });

  it('caps length without leaving a trailing hyphen', () => {
    const s = slugify('a'.repeat(47) + ' b');
    expect(s.length).toBeLessThanOrEqual(48);
    expect(s.endsWith('-')).toBe(false);
  });

  it('random names always slugify to a valid ID', () => {
    for (let i = 0; i < 50; i++) expect(slugify(randomName())).toMatch(SLUG_RE);
  });
});
