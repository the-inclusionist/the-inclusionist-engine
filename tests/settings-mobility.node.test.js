// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-mobility — PURE logic (node project, no document). ZOMBIES + Right-BICEP.
// Covers: the clamp of the selected player (Boundary: sel >= numPlayers), the predicate "some player active" (turns
// the bar on), the Easy Mode announcement text and the building of the per-player tabs (kept `hidden`, decision E3).
// render()/reflect() themselves (they touch the DOM) are in settings-mobility.browser.test.js.
// See docs/5-Refactoring/plan-modularization-map.md.
import { describe, it, expect } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { toggleLabel } from '../app/js/ui/dom.js'; // onOffLabel is its alias (item 14)
import { t } from '../app/js/core/i18n.js';
import { latchKey } from '../app/js/input/latch-scope.js'; // the announcements come from the dictionary (item 14)
import { easyKey, toggleRunKey, toggleMoveKey, setMoveLatch, setRunLatch } from '../app/js/ui/settings-mobility.js';
import {
  clampSelPlayer, anyMobilityActive, onOffLabel, playerTabsHTML, easyAnnouncement,
} from '../app/js/ui/mobility-choices.js';
import { KEYS } from '../app/js/platform/storage-keys.js';

describe('easyKey', () => {
  it('[Right] gera a chave incl_easy_p{i} (== platform/storage.ts KEYS.easy_p)', () => {
    expect(easyKey(0)).toBe('incl_easy_p0');
    expect(easyKey(3)).toBe('incl_easy_p3');
  });
});

describe('clampSelPlayer', () => {
  it('[Right] mantém a seleção quando dentro do intervalo', () => {
    expect(clampSelPlayer(1, 4)).toBe(1);
    expect(clampSelPlayer(0, 1)).toBe(0);
  });
  it('[Boundary/Edge-case] volta a 0 quando a seleção é >= numPlayers (jogador saiu)', () => {
    expect(clampSelPlayer(3, 2)).toBe(0);
    expect(clampSelPlayer(2, 2)).toBe(0); // equal to the limit clamps too (the valid index is 0..numPlayers-1)
  });
  it('[Zero] numPlayers=0 sempre clampa para 0', () => {
    expect(clampSelPlayer(0, 0)).toBe(0);
  });
});

describe('anyMobilityActive', () => {
  it('[Zero] nenhum jogador ativo -> false', () => {
    expect(anyMobilityActive([{ easy: false, toggleMove: false }])).toBe(false);
  });
  it('[Right] true quando QUALQUER jogador tem Fácil ligado', () => {
    expect(anyMobilityActive([{ easy: false, toggleMove: false }, { easy: true, toggleMove: false }])).toBe(true);
  });
  it('[Right] true quando QUALQUER jogador tem alternância ligada', () => {
    expect(anyMobilityActive([{ easy: false, toggleMove: true }])).toBe(true);
  });
  it('[Boundary] lista vazia -> false (Array#some em [] é sempre false)', () => {
    expect(anyMobilityActive([])).toBe(false);
  });
});

describe('onOffLabel', () => {
  it('[Interface] é o MESMO rótulo de ui/dom — o alias continua ligado à fonte única', () => {
    // `onOffLabel` is an alias of `ui/dom.toggleLabel`, the single source. What this case guards is not the text (that
    // lives in tests/dom.node.test.js): it is the alias never becoming a copy again.
    expect(onOffLabel).toBe(toggleLabel);
  });
});

describe('playerTabsHTML', () => {
  it('[Zero] numPlayers<=1 não gera abas (painel de 1 jogador não precisa escolher)', () => {
    expect(playerTabsHTML(1, 0)).toBe('');
    expect(playerTabsHTML(0, 0)).toBe('');
  });
  it('[Right] gera um botão por jogador com data-mp e rótulo "Jogador N"', () => {
    const html = playerTabsHTML(3, 0);
    expect(html).toContain('data-mp="0"');
    expect(html).toContain('data-mp="1"');
    expect(html).toContain('data-mp="2"');
    expect(html).toContain('Jogador 1');
    expect(html).toContain('Jogador 3');
  });
  it('[Interface] marca apenas o botão selecionado como is-on', () => {
    const html = playerTabsHTML(2, 1);
    const btn0 = html.match(/<button[^>]*data-mp="0"[^>]*>/)[0];
    const btn1 = html.match(/<button[^>]*data-mp="1"[^>]*>/)[0];
    expect(btn0).not.toContain('is-on');
    expect(btn1).toContain('is-on');
  });
});

describe('easyAnnouncement', () => {
  // Compared against `t()` and not against the Portuguese sentence. Pinning the sentence here would bring back into the
  // test the text item 14 took out of the code — and the case still catches a SWAPPED key, because `t('…easyOn')` and
  // `t('…easyOff')` are different.
  it('[Right] 1 jogador: sem prefixo "Jogador N"', () => {
    expect(easyAnnouncement(translate, 0, 1, true)).toBe(t('sr.motor.easyOn'));
  });
  it('[Right] multiplayer: prefixa "Jogador N: "', () => {
    expect(easyAnnouncement(translate, 1, 2, true)).toBe(t('sr.player.prefix', { n: 2 }) + t('sr.motor.easyOn'));
  });
  it('[Zero] a chave NUNCA vaza para o anúncio', () => {
    // The silent way key-based i18n fails: a forgotten `t()` makes the screen reader READ the key.
    for (const on of [true, false]) expect(easyAnnouncement(translate, 0, 1, on)).not.toMatch(/sr\./);
  });
  it('[Boundary] desligado: mensagem curta', () => {
    expect(easyAnnouncement(translate, 0, 1, false)).toBe(t('sr.motor.easyOff'));
    expect(easyAnnouncement(translate, 2, 3, false)).toBe(t('sr.player.prefix', { n: 3 }) + t('sr.motor.easyOff'));
  });
});

describe('toggleMoveKey / a delegação das três chaves', () => {
  it('[Right] gera a chave incl_togglemove_p{i}, como as duas irmãs geram as delas', () => {
    expect(toggleMoveKey(0)).toBe('incl_togglemove_p0');
    expect(toggleMoveKey(3)).toBe('incl_togglemove_p3');
  });

  it('⚠️ [Interface] as TRÊS delegam ao `KEYS` — nenhuma voltou a ser cópia do literal', () => {
    // Two copies of a name change one at a time, which is why the three key helpers delegate to `KEYS`. This case and the
    // literal pins above hold both sides — alone, it would move together with `KEYS`; alone, the pins would let the copy
    // come back.
    for (const i of [0, 2]) {
      expect(easyKey(i)).toBe(KEYS.easyP(i));
      expect(toggleRunKey(i)).toBe(KEYS.toggleRunP(i));
      expect(toggleMoveKey(i)).toBe(KEYS.toggleMoveP(i));
    }
  });
});

describe('definirAlternanciaDeMarcha — a escrita que voltou para a engine (ADR-0106 §4)', () => {
  function cenario(jogadores) {
    const escrito = {};
    const ditos = [];
    return {
      escrito, ditos,
      ctx: {
        players: jogadores,
        store: { setBool: (k, on) => { escrito[k] = on; } },
        srSay: (m) => ditos.push(m),
        getNumPlayers: () => jogadores.length,
      },
    };
  }

  // ⚠️ THE DOUBLE WRITE (ADR-0113), and the OLD key does not leave yet: the cartridge is still who READS it, through
  // `KEYS.toggleMoveP(i)`. Stopping writing it now would make the child lose her choice at the next boot — the same
  // shape as `p.visual` beside `p.viz` (#104 step 1a), for the same reason.
  it('🎯 [Right] com o aparelho conhecido, escreve NAS DUAS chaves — a nova e a legada', () => {
    const c = cenario([{ toggleMove: false, walkDir: 0 }]);
    c.ctx.transportInUse = () => 'gamepad';
    setMoveLatch(c.ctx, 0, true);
    expect(c.escrito[KEYS.toggleMoveP(0)], 'a chave legada deixou de ser escrita e a criança perde a escolha')
      .toBe(true);
    expect(c.escrito[latchKey('togglemove', 0, 'gamepad')], 'a chave por transporte não foi escrita')
      .toBe(true);
  });

  // 📌 WITHOUT THE DEVICE, the behaviour is EXACTLY the legacy one — which is what makes the optional field safe.
  it('📌 [Zero] sem `transporteEmUso`, escreve só a legada, como antes', () => {
    const c = cenario([{ toggleMove: false, walkDir: 0 }]);
    setMoveLatch(c.ctx, 0, true);
    expect(Object.keys(c.escrito)).toEqual([KEYS.toggleMoveP(0)]);
  });

  // ⚠️ AND ON THE FOUR ASSISTED ONES THE NEW WRITE REFUSES (clause 3): there is no choice to store, because the latch is
  // what makes that input work. The legacy one is still written — it is the setting the child takes with her to the
  // devices where the choice exists.
  it('⚠️ [Zero] em `olhos` a chave nova não é escrita, e a legada é', () => {
    const c = cenario([{ toggleMove: false, walkDir: 0 }]);
    c.ctx.transportInUse = () => 'olhos';
    setMoveLatch(c.ctx, 0, true);
    expect(Object.keys(c.escrito), 'gravou uma escolha que o jogo vai ignorar').toEqual([KEYS.toggleMoveP(0)]);
  });

  it('[Right] ligar escreve o campo, persiste na chave da engine e anuncia', () => {
    const c = cenario([{ toggleMove: false, walkDir: 0 }]);
    setMoveLatch(c.ctx, 0, true);
    expect(c.ctx.players[0].toggleMove).toBe(true);
    expect(c.escrito[KEYS.toggleMoveP(0)]).toBe(true);
    expect(c.ditos).toEqual([t('sr.motor.toggleMoveOn')]);
  });

  it('⚠️ [Right] DESLIGAR pára quem está a andar por travamento — senão a personagem anda sozinha', () => {
    // The symptom this case prevents gives no error at all: the child turns the mode off, lets go of everything, and the
    // character keeps walking with no key pressed.
    const c = cenario([{ toggleMove: true, walkDir: -1 }]);
    setMoveLatch(c.ctx, 0, false);
    expect(c.ctx.players[0].toggleMove).toBe(false);
    expect(c.ctx.players[0].walkDir).toBe(0);
    expect(c.ditos).toEqual([t('sr.motor.toggleMoveOff')]);
  });

  it('[Right] LIGAR não mexe em `walkDir` — quem já andava continua a andar', () => {
    const c = cenario([{ toggleMove: false, walkDir: 1 }]);
    setMoveLatch(c.ctx, 0, true);
    expect(c.ctx.players[0].walkDir).toBe(1);
  });

  it('[Interface] com mais de um jogador, o anúncio leva o prefixo daquele assento', () => {
    const c = cenario([{ toggleMove: false, walkDir: 0 }, { toggleMove: false, walkDir: 0 }]);
    setMoveLatch(c.ctx, 1, true);
    expect(c.ditos).toEqual([t('sr.player.prefix', { n: 2 }) + t('sr.motor.toggleMoveOn')]);
  });

  it('[Zero] um assento que não existe não escreve, não anuncia e não rebenta', () => {
    const c = cenario([{ toggleMove: false, walkDir: 0 }]);
    setMoveLatch(c.ctx, 7, true);
    expect(Object.keys(c.escrito)).toEqual([]);
    expect(c.ditos).toEqual([]);
  });

  // ===================== THE SISTER, THE RUN ONE =====================
  //
  // 🎯 It exists for the same reason and passes the same test: «cada passo já era da engine». Here it is even more true
  // — `toggleRun` is a field of `PlayerBase`, the key is `KEYS.toggleRunP(i)` and the announcement is
  // `sr.motor.toggleRun*`. There is NO game effect to inject, and that is what makes the ctx field optional.
  it('[Right] a do CORRER escreve o campo, persiste na chave da engine e anuncia', () => {
    const c = cenario([{ toggleRun: false, walkDir: 0 }]);
    setRunLatch(c.ctx, 0, true);
    expect(c.ctx.players[0].toggleRun).toBe(true);
    expect(c.escrito[KEYS.toggleRunP(0)], 'não persistiu: a escolha some no arranque seguinte').toBe(true);
    expect(c.ditos).toEqual([t('sr.motor.toggleRunOn')]);
  });

  it('🔴 [Inverse] DESLIGAR a do correr NÃO mexe em `walkDir` — ela não governa quem anda', () => {
    // ⚠️ THE DIFFERENCE BETWEEN THE TWO SISTERS, and it is why this case exists. The WALK one calls `applyLatch`, which
    // stops whoever walks by latching: without it the character walks by itself. The RUN one governs a SPEED latch and
    // has no way to leave anyone moving — copying that line «por simetria» would touch `walkDir` because of a button that
    // does not touch it.
    const c = cenario([{ toggleRun: true, walkDir: -1 }]);
    setRunLatch(c.ctx, 0, false);
    expect(c.ctx.players[0].toggleRun).toBe(false);
    expect(c.ctx.players[0].walkDir, 'parou quem andava por causa de um botão que não governa o andar').toBe(-1);
    expect(c.ditos).toEqual([t('sr.motor.toggleRunOff')]);
  });

  it('[Interface] com mais de um jogador, a do correr leva o prefixo do assento', () => {
    const c = cenario([{ toggleRun: false }, { toggleRun: false }]);
    setRunLatch(c.ctx, 1, true);
    expect(c.ditos).toEqual([t('sr.player.prefix', { n: 2 }) + t('sr.motor.toggleRunOn')]);
  });

  it('[Zero] assento inexistente: a do correr também não escreve, não anuncia e não rebenta', () => {
    const c = cenario([{ toggleRun: false }]);
    setRunLatch(c.ctx, 7, true);
    expect(Object.keys(c.escrito)).toEqual([]);
    expect(c.ditos).toEqual([]);
  });
});

// ========================= MUTATIONS CHECKED (step 1b of ADR-0106) =========================
//   · ⚠️ removing the `if (!on) p.walkDir = 0;` -> fails "DESLIGAR para quem esta a andar". It is the mutation that
//     matters most: the symptom gives no error at all — the child turns the mode off and the character walks by itself —,
//     and without this case the line could fall in the change of owner with nobody noticing.
//   · replacing `if (!on)` with `if (on)` -> TWO fail ("DESLIGAR para" and "LIGAR nao mexe"), which is the measure that
//     both directions are pinned and not just one.
//   · removing the `if (!p) return;` -> fails `[Zero] um assento que nao existe`. Without it, `p.toggleMove` on an
//     `undefined` throws, and the quick bar's icon would bring down the whole pause.
//   · replacing `toggleMoveKey(i)` with `easyKey(i)` in the persistence -> fails "ligar escreve ... na chave da
//     engine". Without that case, writing to the wrong key would lose the setting AND break easy mode, silently.
//   · swapping the announcement's ternary (`on ? …On : …Off`) -> TWO fail, one per direction.
//   · giving `easyKey` back to the literal `'incl_easy_p' + i` -> ⚠️ does NOT fail, and that is right: the copy and the
//     literal coincide today. What fails is changing `KEYS.easyP` — then the literal pin falls. The two cases together
//     hold both sides; that is why neither alone was enough.
