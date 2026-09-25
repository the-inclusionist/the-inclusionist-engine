// SPDX-License-Identifier: AGPL-3.0-or-later
// AN EXPLANATION FOLLOWS THE LANGUAGE, LIKE EVERY OTHER WORD THE ENGINE DRAWS (ADR-0225; ADR-0031; CLAUDE.md §4).
//
// 📏 MEASURED ON 2026-09-23, and this file exists because the number was bad: engine booted, the six panels visited in
// Portuguese, `setLocale('en')`, the six revisited — **17 of the 19 explanation-bearing rows still read in Portuguese**,
// while every short label had followed. A child playing in English focused «Wait between presses» and the footer, which is
// `aria-live` and is the one thing a child who cannot see the row has, answered in Portuguese.
//
// 🎯 THE CAUSE WAS ONE LINE, AND IT WAS IN THE KIT. `ui/panel-widgets.labelRow` already rewrote `.opt-hint` at every
// relabel — with a comment of its own saying why («numa retradução para um dicionário sem a chave, o texto antigo
// sobreviveria»). What erased that work was `fillExplain`, which REMOVED the `.opt-hint` node on the way to the footer
// (`span.innerHTML = strong.outerHTML`), so every producer's rewrite landed on a node that no longer existed and the
// footer showed a sentence captured in a closure on the day the row was born.
//
// 📌 THE ORDER OF READING IS THE OTHER HALF, and it is asserted here rather than assumed: the hint is now HIDDEN instead of
// destroyed, and `hidden` takes it out of the accessibility tree entirely — which is what keeps the row reading as «short
// label, control» for a screen reader, the whole point of the 2026-08-25 decision.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
/** The page's language is switched through the root's translator (`core/i18n` holds no state, ADR-0232 D3). */
const setLocale = (code) => motor.setLocale(code);

let motor;
let idiomaGuardado;

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#mundo' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

const PAINEIS = ['empatia', 'som', 'audio', 'visual', 'motora', 'sensib'];

/**
 * Every explanation-bearing row of every panel, keyed by WHERE it is.
 *
 * 🔴 NEVER BY ITS LABEL, and the first version of this measurement was wrong exactly there: a key that carries the short
 * label only matches between the two passes when the LABEL is stale too, so it counts stale ROWS and reports them as stale
 * explanations. It said «14 of 28»; the truth was 17 of 19.
 */
function visitarOsPaineis() {
  const mapa = new Map();
  for (const act of PAINEIS) {
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    const botao = document.querySelector(`#vp-pause-0 .pm-btn[data-act="${act}"]`);
    if (!botao) continue;
    botao.click();
    for (const linha of document.querySelectorAll('.overlay .ctrl-row[data-explain]')) {
      const overlay = linha.closest('.overlay');
      const dentro = [...(overlay?.querySelectorAll('.ctrl-row') ?? [])].indexOf(linha);
      mapa.set(`${overlay?.id ?? '?'}#${dentro}`, {
        explain: linha.dataset.explain,
        label: linha.querySelector('strong')?.textContent?.trim() ?? null,
      });
    }
    for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
    motor.pause.hide(0);
  }
  return mapa;
}

beforeAll(async () => {
  idiomaGuardado = localStorage.getItem('incl_lang');
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"><div id="mundo" style="position:relative;width:640px;height:360px"></div></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }] });
});

// The stored language lives in this origin's storage, and every browser file of this suite shares it.
afterAll(async () => {
  await setLocale('pt');
  if (idiomaGuardado === null) localStorage.removeItem('incl_lang');
  else localStorage.setItem('incl_lang', idiomaGuardado);
});

describe('a language changed in play reaches the explanations too', () => {
  const antes = {};

  it('🎯 [Cross-check] the panels DO carry explanations — a case that finds none would pass empty', () => {
    antes.pt = visitarOsPaineis();
    expect(antes.pt.size, 'no row with an explanation was found at all — the walk is broken, not the tree clean')
      .toBeGreaterThan(10);
    expect([...antes.pt.values()].every((r) => (r.explain ?? '').length > 0)).toBe(true);
  });

  it('🔴 [Right] NOT ONE explanation stays in the language it was built in', async () => {
    await setLocale('en');
    await new Promise((r) => setTimeout(r, 150));
    const en = visitarOsPaineis();
    const presos = [...en]
      .filter(([k, v]) => antes.pt.has(k) && antes.pt.get(k).explain === v.explain)
      .map(([k, v]) => `${k}: ${String(v.explain).slice(0, 60)}`);
    expect(presos, 'the footer answers in the old language to a child who changed it').toEqual([]);
  });

  it('🔴 [Right] and the labels follow too — the row and its explanation move together', () => {
    const en = visitarOsPaineis();
    const rotulados = [...en].filter(([k, v]) => v.label && antes.pt.get(k)?.label);
    expect(rotulados.length, 'no labelled row to compare').toBeGreaterThan(3);
    for (const [k, v] of rotulados) {
      expect(v.label, `${k} keeps its old label`).not.toBe(antes.pt.get(k).label);
    }
  });

  it('🔴 [Interface] and the FOOTER says it — the child hovers a row and hears the language she chose', () => {
    // 🎯 THE CASE THAT MAKES THE LATE READ MATTER, and it was missing: the two above read `data-explain`, which a closure
    // captured at wiring time would happily contradict. The footer is `aria-live` and is the only thing a child who cannot
    // see the row has, so what it SAYS is the assertion — not what the row stores.
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="motora"]').click();
    const linha = [...document.querySelectorAll('.overlay:not([hidden]) .ctrl-row[data-explain]')][0];
    expect(linha, 'no explained row in the mobility panel').toBeTruthy();
    const rodape = linha.closest('.overlay__card').querySelector('.opt-explain');
    expect(rodape, 'no aria-live footer').toBeTruthy();
    linha.dispatchEvent(new Event('mouseenter'));
    expect(rodape.textContent, 'the footer answers with the sentence captured when the row was born')
      .toBe(linha.dataset.explain);
    expect(rodape.textContent).not.toBe(antes.pt.get([...antes.pt.keys()].find((k) => k.startsWith('motora')))?.explain);
    for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
    motor.pause.hide(0);
  });

  it('⚠️ [Boundary] the explanation is HIDDEN in the row, never visible beside the label (CLAUDE.md §4)', () => {
    // This is what makes «keep it instead of destroying it» safe: `hidden` takes the node out of the accessibility tree,
    // so a screen reader still reads «short label, control» and the long prose still belongs to the footer alone.
    const dicas = [...document.querySelectorAll('.overlay .ctrl-row[data-explain] > span .opt-hint')];
    expect(dicas.length, 'no hint node survived at all — there would be nothing for a producer to rewrite')
      .toBeGreaterThan(0);
    expect(dicas.filter((d) => !d.hidden).map((d) => d.textContent?.slice(0, 40)),
      'the prose is back beside the label: the menu is a manual again').toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   E1 the hint DESTROYED again on the way to the footer          🔴 not one explanation
//   E2 an already-wired row never re-read                         🔴 not one explanation · the footer says it
//   E3 the footer CAPTURES the sentence instead of reading late   🔴 the footer says it — and ONLY that case
//   E4 the hint kept but NOT hidden                               🔴 settings-empathy (the prose is back beside the label)
//   E5 `ui/simulation-list` writes its explanation at build time  🔴 the simulation list's own file
//
//   🔴 E3 SURVIVED THE FIRST ROUND, and it was a missing case and not inert code: the two «not one explanation» cases read
//   `row.dataset.explain`, which a closure captured at wiring time contradicts happily — nothing FOCUSED a row after the
//   change, so the footer was never asked. «[Interface] and the FOOTER says it» is that case, and it is the one that makes
//   the late read worth its line.
