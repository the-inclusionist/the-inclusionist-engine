// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TWO PERSISTENCE SCOPES (node project: only reads the key table, no localStorage).
//
// The obvious namespacing — one prefix per game on EVERYTHING — would be a serious accessibility defect, and that is what
// these cases guard. A blind child sets up blind mode, cane, voice and narration speed; a colour-blind child chooses the
// correction; a dyslexic child chooses the font. With one namespace per game, she would redo all of that in every game —
// and whoever depends most on the settings is whoever has least margin to redo them.
//
// The line between the scopes is not technical, it is BELONGING: what is the CHILD's is shared, what is the MATCH's stays
// in the game. If someone one day "standardises" by prefixing everything, these cases fail.
import { describe, it, expect } from 'vitest';
import * as store from '../app/js/platform/storage.js';
import { KEYS, gameKey } from '../app/js/platform/storage.js';

/** The platform game's id. Here it is TEST DATA, not engine truth: the engine does not hold it (ADR-0080), and what
 *  these cases guard is that it still produces exactly the old keys. */
const PLATAFORMA = 'inclusionist';

/** Everything in the GAME's scope. Short on purpose: when in doubt, the key belongs to the child. */
const DO_JOGO = ['activity', 'quizlevel', 'cenario', 'tabsel', 'fracnot'];

/** What belongs to the CHILD and goes with her from game to game. A representative sample, not the whole list. */
const DA_CRIANCA = [
  'modocego', 'caneDiv', 'onebtn', 'wheelchair', 'hearingloss',   // acessibilidade motora/auditiva
  'viz', 'cbsafe', 'outfg', 'outbg', 'lq',                        // visão
  'ttsEngine', 'ttsVoice', 'lang',                                // voz e idioma
  'letterCase', 'captions', 'fontKey',                            // communication and reading
  'padDesign', 'touchmap', 'padBtnMm',                            // controles e toque
];

describe('escopo DO JOGO — o que é de uma partida', () => {
  it('[Right] é uma FUNÇÃO do id, e o nome sai na forma `incl.<jogo>.<nome>`', () => {
    for (const k of DO_JOGO) expect(KEYS[k]('xis'), k).toBe('incl.xis.' + k);
  });

  it('[Right] ⚠️ dois jogos no mesmo perfil têm chaves DISJUNTAS — é o defeito da #108 em uma linha', () => {
    // This was the damage: a constant `JOGO_ID` in the engine, so the quiz and the platform game both wrote to
    // `incl.inclusionist.activity`. The second game opened erased the first one's progress, with no error at all.
    // The second id is NEUTRAL on purpose: the property is «dois jogos quaisquer não colidem», and naming a concrete game
    // here would couple an engine fixture to the catalogue — which is what `engine-boundary` guards.
    const daPlataforma = DO_JOGO.map((k) => KEYS[k](PLATAFORMA)).concat(KEYS.attract(PLATAFORMA, 'campo'));
    const doOutro = DO_JOGO.map((k) => KEYS[k]('jogo-b')).concat(KEYS.attract('jogo-b', 'campo'));
    expect(daPlataforma.filter((n) => doOutro.includes(n)), 'chave partilhada entre dois jogos').toEqual([]);
  });

  it('[Right] e a plataforma continua a resolver as chaves QUE JÁ EXISTEM no aparelho da criança', () => {
    // The other side of the same coin: parametrising the prefix must not rename anything for whoever already played. The
    // names below are verbatim the ones the fixed `JOGO_ID` produced.
    expect(KEYS.activity(PLATAFORMA)).toBe('incl.inclusionist.activity');
    expect(KEYS.quizlevel(PLATAFORMA)).toBe('incl.inclusionist.quizlevel');
    expect(KEYS.cenario(PLATAFORMA)).toBe('incl.inclusionist.cenario');
    expect(KEYS.tabsel(PLATAFORMA)).toBe('incl.inclusionist.tabsel');
    expect(KEYS.fracnot(PLATAFORMA)).toBe('incl.inclusionist.fracnot');
    expect(KEYS.attract(PLATAFORMA, 'campo')).toBe('incl.inclusionist.attract_campo');
  });

  it('[Right] cada uma guarda o nome LEGADO — é como o ajuste de quem já jogava sobrevive', () => {
    // Without this the rename would be a silent loss: the child would open the game and find the factory level 2 instead
    // of the 5 she had reached, with nothing explaining.
    for (const k of DO_JOGO) {
      expect(KEYS[k + 'Legado'], k).toBeTruthy();
      expect(KEYS[k + 'Legado'], k).toMatch(/^incl_/);
    }
  });

  it('[Interface] a gravação da demonstração também é do jogo, e também herda', () => {
    expect(KEYS.attract('xis', 'campo')).toBe(gameKey('xis', 'attract_campo'));
    expect(KEYS.attractLegado('campo')).toBe('incl_attract_campo'); // the legacy one carries NO id: it predates the scope
  });
});

describe('escopo COMPARTILHADO — o que é da criança', () => {
  it('[Right] NENHUM ajuste de acessibilidade leva prefixo de jogo', () => {
    // It is this file's central case. If it fails, someone prefixed a child's preference — and the effect is forcing her
    // to reconfigure everything once per game.
    const prefixadas = DA_CRIANCA.filter((k) => String(KEYS[k]).startsWith('incl.'));
    expect(prefixadas, 'preferência da criança com prefixo de jogo').toEqual([]);
  });

  it('[Right] e todas continuam no formato antigo, que é o que as mantém compartilhadas', () => {
    for (const k of DA_CRIANCA) expect(KEYS[k], k).toMatch(/^incl_/);
  });

  it('[Boundary] as chaves POR JOGADOR são da criança também — a tela 2 é uma criança, não um jogo', () => {
    for (const f of ['vizP', 'sinkP', 'easyP', 'rmWalkP']) {
      expect(KEYS[f](1), f).toMatch(/^incl_/);
      expect(KEYS[f](1), f).not.toMatch(/^incl\./);
    }
  });
});

describe('os dois escopos não se confundem', () => {
  it('[Zero] nenhuma chave está nas duas listas', () => {
    expect(DO_JOGO.filter((k) => DA_CRIANCA.includes(k))).toEqual([]);
  });

  it('[Interface] o id entra pelo argumento, e é ele que aparece no prefixo', () => {
    expect(gameKey('inclusionist', 'x')).toBe('incl.inclusionist.x');
    expect(gameKey('15puzzle', 'x')).toBe('incl.15puzzle.x');
  });

  it('[Zero] ⚠️ a ENGINE não guarda id de jogo nenhum — era o achado 1 do ADR-0080', () => {
    // `JOGO_ID = "inclusionist"` used to live here. ADR-0080's test is a question — *would a second game want a different
    // value?* — and this field answered yes at a high price: a silent progress collision.
    expect(store.JOGO_ID, 'a engine voltou a guardar o id de um jogo').toBeUndefined();
  });

  it('[Zero] ⚠️ e a distinção dos dois escopos vive na FORMA, não só no comentário', () => {
    // A child's key is a STRING (it has nowhere to receive an id); a match key is a FUNCTION (without the id it does not
    // compile). That is what prevents both prefixing a preference by mistake and forgetting to scope a match key — the two
    // mistakes the comment alone could not prevent.
    for (const k of DA_CRIANCA) expect(typeof KEYS[k], k).toBe('string');
    for (const k of DO_JOGO) expect(typeof KEYS[k], k).toBe('function');
  });
});
