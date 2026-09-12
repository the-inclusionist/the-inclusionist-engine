// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SAFE PALETTE FOLLOWS THE COLOUR CORRECTION (ADR-0151) — and can be switched on without it.
//
// The Dev's rule: «ativada automaticamente quando se liga correção para protano, deutero e tritanopia e desativada
// automaticamente quando muda para visão padrão (tricromática). Aqui se permite ativá-la sem usar o filtro.»
//
// 📌 A browser file with ONE root, for the reason of the other boot files: `createGame` hangs listeners on
// `window` and on `core/state`, and nothing removes them.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

let state;
const jogadores = [{ ctrl: {} }];
const escritas = [];
const paleta = () => document.documentElement.dataset.paleta;

beforeAll(async () => {
  state = await import('../app/js/core/state.js');
  state.setCbSafeValue(false);
  const { createGame } = await import('../app/js/boot/create-game.js');
  const raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  createGame({ acomodacoes: SEM_ASSUNTO,
    declaration: {
      topology: () => ({ kind: 'hotspots', order: ['a'] }), holdsAtOnce: () => 1, seguraTeclas: () => false,
      tick: 'player', world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
      nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
      objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
    },
    host: { doc: document, win: window },
    baixarPesados: false,
    players: jogadores,
    // The CARTRIDGE corrects colour in its own render — the palette must follow it all the same.
    setCorrecaoDoJogador: (i, correcao) => {
      escritas.push(correcao);
      jogadores[i].visual = { ...(jogadores[i].visual ?? {}), correcao };
    },
  });
});

const icone = () => document.querySelector('#title-icons [data-pi="cvd"]');

describe('the safe palette and the colour correction', () => {
  it('🔴 [Right] turning a correction ON switches the palette on', () => {
    expect(icone(), 'the colour icon did not mount — the case would measure nothing').not.toBeNull();
    expect(paleta(), 'the palette was on before anything asked for it').toBeUndefined();
    icone().click();
    expect(escritas.at(-1), 'the first press is a correction, not the default').not.toBe('tricro');
    expect(paleta(), 'a correction is on and the menus kept the confusable colours').toBe('okabe-ito');
  });

  it('🔴 [Right] cycling back to trichromatic vision switches it OFF', () => {
    for (let n = 0; n < 6 && escritas.at(-1) !== 'tricro'; n++) icone().click();
    expect(escritas.at(-1), 'the cycle never came back to trichromatic vision').toBe('tricro');
    expect(paleta(), 'back to default vision and the palette stayed').toBeUndefined();
  });

  it('🎯 [Right] and it can be switched on ALONE — «sem usar o filtro»', () => {
    state.setCbSafeValue(true);
    expect(paleta(), 'the palette state is on and nothing paints the menus').toBe('okabe-ito');
    expect(escritas.at(-1), 'switching the palette alone turned a filter on').toBe('tricro');
    state.setCbSafeValue(false);
    expect(paleta()).toBeUndefined();
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   B1 the correction writer is not wrapped (comPaletaSegura removed)   🔴 the palette never follows
//   B2 the wrapper always switches ON                                   🔴 trichromatic keeps it
//   B3 nothing listens to `cbSafe`                                      🔴 switched alone, nothing paints
