// SPDX-License-Identifier: AGPL-3.0-or-later
// PORTUGUESE IN COMMENTS ONLY SHRINKS — phase 1 of the English plan for comments («nada novo em português»).
//
// The identifier gate (`portuguese-stays-out`) made names English and keeps them so. Comments had no gate, and the rule
// «artefacts are in English» was kept by memory alone — which is how a Portuguese comment keeps being written into a
// file the next commit touches. This reads `scripts/comment-language.mjs` against its baseline: no file may carry MORE
// Portuguese comment lines than it did, and a file that is not in the baseline starts at zero.
//
// ⚠️ The measure is a heuristic that undercounts (see the script's header), so this is a ratchet: it can let a short
// Portuguese line through; it cannot let the count grow.
import { describe, it, expect } from 'vitest';
import { inventory, readBaseline, isPortugueseLine } from '../scripts/comment-language.mjs';

describe('Portuguese in comments only shrinks', () => {
  const now = inventory();
  const base = readBaseline();

  it('🔴 [Right] no file carries more Portuguese comment lines than its baseline — a new file starts at zero', () => {
    const grew = Object.entries(now).filter(([f, n]) => n > (base.files[f] ?? 0)).map(([f, n]) => `${f}: ${base.files[f] ?? 0} -> ${n}`);
    expect(grew, 'write the comment in English (the Dev\'s own words stay between «» in the language he said them)').toEqual([]);
  }, 60_000);

  it('📌 [Boundary] the baseline is the tree, not a wish: its total is what its files add up to', () => {
    expect(Object.values(base.files).reduce((s, n) => s + n, 0)).toBe(base.total);
  });

  it('⚠️ [Interface] the classifier reads a Portuguese sentence as Portuguese and an English one as English', () => {
    expect(isPortugueseLine('// a criança não consegue segurar o botão quando o jogo pausa')).toBe(true);
    expect(isPortugueseLine('// the child cannot hold the button while the game is paused')).toBe(false);
    // quotations stay in the language they were said in, and code in backticks is not prose
    expect(isPortugueseLine('// The Dev: «não é na rodada de agora» — so this waits')).toBe(false);
    expect(isPortugueseLine('// `nao` and `que` are identifiers here, and the line is English')).toBe(false);
  });
});
