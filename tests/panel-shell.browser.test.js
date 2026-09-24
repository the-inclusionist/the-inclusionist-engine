// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PANEL SHELL IS BUILT, SO THE CONTRACT STOPS BEING INVISIBLE (#62, #115, finding 6 of #63).
//
// ========================= WHAT THIS PREVENTS =========================
// The second consumer measured and wrote: «o ctx do painel pede `$` e `store`; o que ele REALMENTE exige é
// que o documento contenha `#typo`, `#typo-list`, `#typo-preview`, `#typo-close` e `#typo-reset`. Nada no
// tipo diz isso — descobre-se por tentativa, e o modo de falhar é o pior possível: **o painel abre vazio,
// sem erro**.»
//
// Each `ui/settings-*` fills the inside; the shell builds the outside, so the engine no longer requires ids per panel
// that it declares nowhere.
//
// ⚠️ AND THE MENU RULE OF `CLAUDE.md` §4 BECOMES CONSTRUCTION INSTEAD OF A REMINDER. A panel's introduction goes in the
// card's `data-explain-idle`, never in a `<p>` of prose at the top — and the shell has no way to receive a `<p>` (#62).
//
// ⚠️ This is a BROWSER test because the shell is a DOM tree: the `node` project cannot tell «criou o nó» from
// «criou o nó no sítio certo», and the defect it fixes is exactly one of structure.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach } from 'vitest';
import { mountShell, shellIds } from '../app/js/ui/panel-shell.js';

const ctx = {
  find: (sel) => document.querySelector(sel),
  create: (tag) => document.createElement(tag),
};

const SPEC = {
  id: 'audio',
  title: 'Acessibilidade auditiva',
  listLabel: 'Ajustes de som',
  resetLabel: 'Restaurar padrões deste menu',
  closeLabel: 'Fechar',
};

beforeEach(() => { document.body.innerHTML = ''; });

describe('ui/panel-shell · a casca declara o que exigia em silêncio', () => {
  it('[Right] monta os cinco ids que o painel precisa, e devolve-os', () => {
    const casca = mountShell(ctx, SPEC);
    document.body.appendChild(casca.overlay);
    const ids = shellIds('audio');
    for (const [papel, id] of Object.entries(ids)) {
      expect(document.getElementById(id), `${papel} (#${id}) não foi montado`).not.toBe(null);
    }
    expect(casca.ids).toEqual(ids);
  });

  it('🔴 [Right] «Voltar» is the FIRST control, and no close button comes after the rows (ADR-0158)', () => {
    // The Dev, on a panel ending in «Restore» and «Close»: «Não pode haver botão "close" no final, mas sim o
    // primeiro item deve ser o botão "voltar"». The order a keyboard walks is the DOM order, so the DOM order is
    // what this case reads.
    const casca = mountShell(ctx, SPEC);
    document.body.appendChild(casca.overlay);
    const item = document.createElement('button');
    casca.list.appendChild(item);
    const botoes = [...casca.card.querySelectorAll('button')];
    expect(botoes[0], 'the way out is not item 1').toBe(casca.close);
    expect(botoes.at(-1), 'something comes after the reset — a close at the bottom again?').toBe(casca.reset);
    expect(botoes.indexOf(casca.close)).toBeLessThan(botoes.indexOf(item));
  });

  it('⚠️ [Right] o cartão é um diálogo NOMEADO pelo próprio título', () => {
    // `aria-labelledby` pointing at the `<h2>` is what makes the screen reader announce WHICH panel opened. Without it
    // the child hears «diálogo» and has to guess which of the eight they entered.
    const { card, overlay } = mountShell(ctx, SPEC);
    document.body.appendChild(overlay);
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
    const rotulo = card.getAttribute('aria-labelledby');
    expect(document.getElementById(rotulo)?.textContent).toBe(SPEC.title);
  });

  it('⚠️ [Right] a lista é um GRUPO com nome — e nasce vazia, porque o interior é do painel', () => {
    const { list: lista } = mountShell(ctx, SPEC);
    expect(lista.getAttribute('role')).toBe('group');
    expect(lista.getAttribute('aria-label')).toBe(SPEC.listLabel);
    expect(lista.children.length, 'a casca desenhou conteúdo que é do settings-*').toBe(0);
  });

  it('⚠️ [Boundary] ZERO prosa no topo — a introdução só cabe no `data-explain-idle`', () => {
    // The case of #62. The shell has no parameter for a paragraph at the top, so the only way for the introduction to
    // exist is as the footer's IDLE text — which is what `fillExplain` reads.
    const { card } = mountShell(ctx, { ...SPEC, intro: 'Ajuste como o jogo soa.' });
    expect(card.getAttribute('data-explain-idle')).toBe('Ajuste como o jogo soa.');
    expect(card.querySelectorAll('p').length, 'apareceu prosa no topo do cartão').toBe(0);
    // And the first child is the title: nothing gets between the card and the `<h2>`.
    expect(card.firstElementChild?.tagName).toBe('H2');
  });

  it('[Zero] sem introdução o atributo não existe — ausência é ausência, não cadeia vazia', () => {
    // A `data-explain-idle=""` would make `fillExplain` set a live region with empty text, which the screen reader
    // announces as nothing. «Este painel não tem introdução» is a legitimate answer.
    const { card } = mountShell(ctx, SPEC);
    expect(card.hasAttribute('data-explain-idle')).toBe(false);
  });

  it('⚠️ [Interface] o rótulo entra por `textContent` — markup de dicionário não vira markup', () => {
    // A translated label is outside data, and a consumer's dictionary may carry anything inside it.
    const { close: fechar } = mountShell(ctx, { ...SPEC, closeLabel: '<img src=x onerror=alert(1)>Fechar' });
    document.body.appendChild(document.createElement('div')).appendChild(fechar);
    expect(fechar.querySelector('img'), 'o rótulo foi ANALISADO como marcação').toBe(null);
    expect(fechar.textContent).toContain('Fechar');
  });

  it('⚠️ [Exercise] montar duas vezes NÃO duplica o véu — a grade de telas remonta', () => {
    // The root remounts the panels when the player count changes. Two veils with the same id is the defect
    // `.pause-menu[hidden]` already paid for in another layer: two nodes, one of them invisible to `querySelector`.
    document.body.appendChild(mountShell(ctx, SPEC).overlay);
    const segunda = mountShell(ctx, { ...SPEC, title: 'Outro título' });
    expect(document.querySelectorAll('#audio').length).toBe(1);
    expect(document.querySelectorAll('#audio-title').length).toBe(1);
    expect(document.getElementById('audio-title').textContent).toBe('Outro título');
    expect(segunda.overlay).toBe(document.getElementById('audio'));
  });

  it('[Right] a casca nasce ESCONDIDA — um painel que abre sozinho é um painel que interrompe', () => {
    expect(mountShell(ctx, SPEC).overlay.hidden).toBe(true);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · removing the card's `aria-labelledby` → "[Right] o cartão é um diálogo NOMEADO" fails. It is the attribute
//     that makes the child hear WHICH panel opened instead of just «diálogo».
//   · replacing `card.setAttribute('data-explain-idle', …)` with a `<p>` appended to the card → "[Boundary] ZERO
//     prosa no topo" fails on both assertions. It is #62 measured instead of edited.
//   · putting `if (spec.introducao !== undefined)` in place of `if (spec.introducao)` → "[Zero] sem introdução" stays
//     green (the field is `undefined`), but passing `introducao: ''` would produce the empty attribute. ⚠️ Recorded as
//     a mutation that does NOT fail: the case measures the field's absence, not the empty string, and closing that
//     hole would need its own case — not written because no caller passes an empty string.
//   · replacing `textContent` with `innerHTML` on the button → "[Interface] o rótulo entra por textContent" fails with
//     the `<img>` mounted.
//   · removing the remount's `while (overlay.firstChild)` → "[Exercise] montar duas vezes" fails with two
//     `#audio-title` in the document.
//   · (2026-09-12, ADR-0158) «Voltar» appended AFTER the list → the «Voltar is the FIRST control» case is red; and
//     the close button put back into `.overlay__actions` after the reset → red too, by the last-button assertion.
