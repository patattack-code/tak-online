export const NAME_MAX = 60;
export const SLUG_MAX = 48;

/** Lower-case, hyphen-separated, URL-safe version of a game name. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ADJECTIVES = ['amber', 'quiet', 'bold', 'misty', 'golden', 'swift', 'stony', 'wild', 'lucky', 'copper', 'silent', 'bright'];
const NOUNS = ['road', 'tower', 'river', 'bridge', 'valley', 'summit', 'harbor', 'meadow', 'canyon', 'forest', 'keep', 'crossing'];

/** A readable fallback name like "amber-road-37" for players who leave the field blank. */
export function randomName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a} ${n} ${Math.floor(Math.random() * 90 + 10)}`;
}
