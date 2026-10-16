/**
 * Renders static SVG assets into public/assets:
 *   - one icon per piece type and colour
 *   - an empty board preview for every legal board size (3x3 .. 8x8)
 *   - a sample mid-game position for the landing page
 *   - the logo / favicon
 *
 * Run with: npm run render-assets
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { boardSvg, logoSvg, pieceSvg } from '../src/render/iso';
import { BOARD_SIZES, type Color, type PieceType } from '../src/engine/types';
import { newGame } from '../src/engine/rules';
import { replay } from '../src/engine/ptn';

const outDir = join(process.cwd(), 'public', 'assets');
mkdirSync(outDir, { recursive: true });

const written: string[] = [];
function write(name: string, content: string) {
  writeFileSync(join(outDir, name), content, 'utf8');
  written.push(name);
}

for (const color of ['white', 'black'] as Color[]) {
  for (const type of ['flat', 'wall', 'cap'] as PieceType[]) {
    write(`piece-${color}-${type}.svg`, pieceSvg({ color, type }));
  }
}

for (const size of BOARD_SIZES) {
  write(`board-${size}.svg`, boardSvg(newGame(size), `Empty ${size}x${size} Tak board`));
}

// A sample 5x5 position with stacks, a wall and a capstone for the landing page.
const sample = replay(5, [
  'a5', 'e1', 'c3', 'c4', 'c3+', 'b3', 'Cd3', 'Sb4', 'd3<', 'a1',
  'd2', 'a2', 'd1', 'a3', 'e2', 'b2',
]);
write('sample-position.svg', boardSvg(sample, 'Sample Tak position'));

write('logo.svg', logoSvg(128));
write('favicon.svg', logoSvg(32));

console.log(`Wrote ${written.length} assets to ${outDir}:`);
for (const name of written) console.log('  ' + name);
