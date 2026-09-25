// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAUSE BECOMES A SHORT LIST, AND THE ORDER IS THE DECISION — item 5 of ADR-0044 (seven items then; SIX since ADR-0151 —
// see the first case).
//
// ========================= WHAT WAS MEASURED, AND WHY IT CHANGES =========================
// The pause card had 22 stops on ONE screen, in two blocks with two interaction models: ten emoji-only toggles
// (`role="group"`) and twelve word items (`role="menu"`), with an `<h2>` in between.
//
// The touch targets were not the problem — the icons were already 44×44. The problem was ORDER and VOLUME: `resume`, which
// is THE EXIT, was the card's 11th stop, because the ten icons came first in reading order. A child who pauses and cannot
// see swept ten toggles and a heading before finding "Continuar".
//
// The root list is short, and the order is a decision and not an arrangement:
//
//   resume FIRST      — the exit is what a pause is for. A menu with no way out is a trap, and the trap costs most to
//                       whoever cannot see it.
//   quit LAST         — it is the least wanted outcome of pausing. And since the list is a RING (item 1), ONE key UP
//                       from `resume` reaches it: far in reading, near to the finger.
//
// The settings panels went down into a SUBMENU, and it obeys the same rule: the exit ("Voltar") is the first item, not
// the last.
//
// ========================= ONE MENU PER SCREEN, AND WHY IT MATTERS HERE =========================
// The lists exist in the markup at the same time, but only ONE is visible — the others carry `hidden`, which takes them
// out of the accessibility tree entirely. That is what lets "what happens at the end of the list" have ONE answer: the
// ring goes round inside the visible list, and never crosses into another.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { PM_VISIBLE_ITEMS, rootThatActs } from '../app/js/ui/pause-icons.js';
import { screenPauseMarkup } from '../app/js/ui/pause-markup.js';
import { PM_BTNS, PM_OPTIONS_BTNS, PM_GAME_BTNS } from '../app/js/ui/pause-buttons.js';
import { t } from '../app/js/core/i18n.js';

const SEM_DIN = () => null;
const markup = () => screenPauseMarkup({
  player: 0, numPlayers: 1, pmButtons: PM_BTNS, optionsButtons: PM_OPTIONS_BTNS, dynLabel: SEM_DIN, t,
});

/** The `data-act`s of a list, in the order the markup puts them. */
function atos(html, sub) {
  const bloco = html.match(new RegExp('<div class="pause-menu"[^>]*data-sub="' + sub + '"[^>]*>([\\s\\S]*?)</div>'));
  expect(bloco, 'a lista `' + sub + '` sumiu do markup').toBeTruthy();
  return [...bloco[1].matchAll(/data-act="([^"]+)"/g)].map((m) => m[1]);
}

describe('menu de pausa · seis itens na raiz, os ajustes num submenu', () => {
  it('[Right] a lista raiz é EXATAMENTE os SEIS itens do ADR-0151, nessa ordem', () => {
    // ⚠️ They were seven (ADR-0044 §2) and reached nine on paper (ADR-0147). Six is MEASURED: nine overflowed by 64 px at
    // 640×360, and the sieve proving the root fits is `pause-target-44px`'s «o cartão CABE a 640×360» case.
    expect(PM_BTNS.map((b) => b.act)).toEqual(
      ['resume', 'ajuda', 'addplayer', 'options', 'opcoesdojogo', 'quit'],
    );
  });

  it('🔴 [Zero] «acessibilidade» e «print» SAÍRAM da raiz — foram para o SELECT, e a ausência é o caso', () => {
    // The pair of the case above: a list keeping both and losing two others would pass on length.
    const acts = atos(markup(), 'raiz');
    expect(acts).not.toContain('acessibilidade');
    expect(acts).not.toContain('print');
  });

  it('[Right] a saída é o PRIMEIRO item e `quit` é o ÚLTIMO', () => {
    // Written apart from the case above on purpose: the list may gain or lose a middle item one day, and these two ends
    // are what CANNOT change without reopening ADR-0044.
    const acts = atos(markup(), 'raiz');
    expect(acts[0], 'a saída deixou de ser a primeira parada — é a armadilha que o ADR-0044 desfaz').toBe('resume');
    expect(acts[acts.length - 1], '`quit` deixou de ser o último').toBe('quit');
    expect(acts).toHaveLength(6);
  });

  it('[Right] o submenu tem os painéis do ADR-0151, e a saída dele também vem primeiro', () => {
    const acts = atos(markup(), 'opcoes');
    expect(acts[0], 'o "Voltar" do submenu tem de ser a primeira parada, como `resume` na raiz').toBe('pmback');
    // «Áudio» (`som`) right after auditory accessibility: the two sound panels, side by side (ADR-0151 §2).
    expect(acts.slice(1)).toEqual(['empatia', 'audio', 'som', 'motora', 'visual', 'anim']);
  });

  it('🔴 [Zero] «Comunicação» e «Tipografia» SAÍRAM do submenu (ADR-0151) — a ausência é o caso', () => {
    // The pair of the case above: a list keeping them and losing two others would pass on length.
    const acts = atos(markup(), 'opcoes');
    expect(acts).not.toContain('caa');
    expect(acts).not.toContain('tipo');
  });

  it('[Right] só UMA lista é visível — a outra sai da árvore de acessibilidade', () => {
    // `hidden` and not `display:none` in a class: `hidden` takes the whole branch out of the accessibility tree, which is
    // what makes "one menu per screen" true for whoever listens, and not only for whoever sees.
    const html = markup();
    expect(html).toContain('data-sub="raiz"');
    expect(html).toMatch(/<div class="pause-menu"[^>]*data-sub="opcoes"[^>]*hidden/);
    expect(html).not.toMatch(/<div class="pause-menu"[^>]*data-sub="raiz"[^>]*hidden/);
    // ⚠️ AND THE THIRD (ADR-0146): also mounted, also hidden, and the exit also first.
    expect(html).toMatch(/<div class="pause-menu"[^>]*data-sub="jogo"[^>]*hidden/);
    expect(atos(html, 'jogo')[0]).toBe('pmback');
  });

  it('[Interface] o seletor de itens navegáveis IGNORA a lista escondida', () => {
    // Without this the ring would go round crossing into the invisible list, and the child would hear items of a menu
    // that is not on screen. It is the one line that stops the lists from becoming one for navigation.
    expect(PM_VISIBLE_ITEMS).toContain(':not([hidden])');
  });

  it('[Right] o NOME ACESSÍVEL do diálogo passa pelo dicionário', () => {
    // MEASURED in the built game with `<html lang="en">`: the visible title said "Paused" and the dialog's accessible name
    // said "Menu de pausa do jogador 1". Whoever sees read English; whoever listens got the menu announced in Portuguese.
    //
    // It is the SAME asymmetry as item 4 of ADR-0044, one level up: there the legend existed for whoever sees and was
    // hidden from whoever listens; here the label is translated for whoever sees and raw for whoever listens. The
    // accessibility channel getting worse treatment than the visual one is the pattern this record exists to break.
    //
    // The `<h2>` is NOT the dialog's name — the card uses `aria-label`, not `aria-labelledby`. That is why hiding it in
    // the tight frame costs whoever listens nothing; this line makes that claim checkable instead of remembered.
    // A «não contém a frase crua» assertion does NOT fit here: in pt-BR the dictionary value IS the same sentence, so it
    // would contradict itself. What proves the passage through the key is the IDENTITY with what `t()` returns, plus the
    // key's existence in the three languages (`i18n-dicts` covers the rest).
    const h = markup();
    expect(h).toContain('aria-label="' + t('pause.cardAria', { n: 1 }) + '"');
    expect(t('pause.cardAria', { n: 3 }), 'o número do jogador tem de entrar por parâmetro').toContain('3');
    expect(h, 'o `<h2>` não pode virar o nome do diálogo — ele é rótulo VISUAL').not.toContain('aria-labelledby');
  });

  it('🔴 [Zero] um jogo SEM NADA SEU não recebe a porta «Opções do jogo» — e o par: com algo seu, recebe', () => {
    // The gate ADR-0146 names. Offering the door and opening a room with only «voltar» is what ADR-0106 §5 calls worse
    // than absence; and absence alone would pass with a door that never appears.
    const fn = () => {};
    const acts = { resume: fn, ajuda: fn, addplayer: fn, quit: fn, audio: fn, tabuleiro: fn };
    const semNada = rootThatActs(PM_BTNS, PM_OPTIONS_BTNS, acts, PM_GAME_BTNS).map((b) => b.act);
    expect(semNada, 'a porta abriu para uma sala vazia').not.toContain('opcoesdojogo');
    expect(semNada, 'o caso mediria uma raiz vazia').toContain('options');
    const comAlgo = rootThatActs(PM_BTNS, PM_OPTIONS_BTNS, acts, [...PM_GAME_BTNS, { act: 'tabuleiro' }]).map((b) => b.act);
    expect(comAlgo, 'o jogo declarou algo seu e a porta não apareceu').toContain('opcoesdojogo');
  });

  it('[Zero] nenhum ato aparece nas DUAS listas', () => {
    // A duplicated act would be a second door to the same thing in different positions, and the "N de M" index would
    // count two places for a single item.
    const html = markup();
    const repetidos = atos(html, 'raiz').filter((a) => atos(html, 'opcoes').includes(a));
    expect(repetidos, 'ato nas duas listas: ' + repetidos.join(', ')).toEqual([]);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · putting `quit` before `print` in PM_BTNS → `[Right] a lista raiz é EXATAMENTE` and "a saída é o PRIMEIRO"
//     fail, the second naming the wrong item at the end.
//   · removing `hidden` from the options list → `[Right] só UMA lista é visível` fails.
//   · replacing `PM_VISIBLE_ITEMS` with '.pm-btn' → `[Interface] o seletor IGNORA a lista escondida` fails.
