// SPDX-License-Identifier: AGPL-3.0-or-later
// A SETTINGS PANEL NUMBERS ITS ITEMS, and the number is the spoken index's (ADR-0158 rules 1 and 2, issue #152).
//
// ========================= WHAT IS MEASURED, AND AGAINST WHAT =========================
// The expected numbers are LITERALS written from the fixture below, never computed with `itensNavegaveis`: a case
// that reads the numbers and the stops through the same function moves with it and cannot fail.
//
// The fixture is the shapes the engine's panels really have: a one-control row, a row with a switch AND a volume
// slider (the «Áudio» panel's five rows), a row that hides (the keyboard seat row), a `[data-passos]` stepper whose
// arrows are not stops, and the reset outside the list.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../app/css/style.css';
import { montarPainel } from '../app/js/ui/mount-panel.js';
import { montarPassos } from '../app/js/ui/panel-widgets.js';

let host;
let painel;

const ctx = () => ({
  procurar: (s) => document.querySelector(s),
  criar: (t) => document.createElement(t),
  host,
  overlays: { frontOverlay: () => {}, register: () => {} },
});

function linha(...filhos) {
  const r = document.createElement('div');
  r.className = 'ctrl-row';
  const rotulo = document.createElement('span');
  rotulo.textContent = 'label';
  r.append(rotulo, ...filhos);
  return r;
}
const botao = (id) => Object.assign(document.createElement('button'), { id, type: 'button', textContent: id });
const cursor = (id) => Object.assign(document.createElement('input'), { id, type: 'range' });

function preencher(lista) {
  lista.replaceChildren(
    linha(botao('um')),
    linha(botao('som'), cursor('volume')),
    Object.assign(linha(botao('escondida')), { id: 'linha-escondida' }),
    linha(montarPassos(ctx(), { rotulo: 'Size', valores: ['small', 'big'], atual: 1 })),
  );
}

const num = (el) => el.getAttribute('data-item-num');

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  painel = montarPainel(ctx(), {
    id: 'fx',
    rotulos: () => ({ titulo: 'Fixture', rotuloDaLista: 'List', rotuloReset: 'Restore', rotuloFechar: 'Back' }),
    render: () => preencher(painel.casca.lista),
  });
});
afterEach(() => { host.remove(); });

describe('panel items are numbered with the spoken index (ADR-0158)', () => {
  it('🔴 [Right] «Voltar» is 1, each row takes the number of its first stop, a second stop its own, the reset the last', async () => {
    painel.abrir();
    // ⚠️ hidden AFTER the open, as the keyboard seat row is: `abrir()` re-renders, and a row hidden before it would be
    // replaced by a fresh visible one — the first version of this case measured exactly that and failed.
    document.getElementById('linha-escondida').hidden = true;
    await Promise.resolve(); // mutation observers run as a microtask
    const linhas = [...painel.casca.lista.querySelectorAll('.ctrl-row')];
    expect(num(painel.casca.fechar), '«Voltar» is not item 1').toBe('1');
    expect(num(linhas[0])).toBe('2');
    expect(num(linhas[1]), 'the switch row').toBe('3');
    // the slider is the 4th stop: its number sits right before it, and not on the row a second time
    expect(document.getElementById('volume').previousElementSibling?.textContent, 'the slider has no number of its own').toBe('4');
    expect(num(linhas[2]), 'a HIDDEN row took a number').toBeNull();
    expect(num(linhas[3]), 'the stepper row — its arrows are not stops').toBe('5');
    expect(num(painel.casca.reset), 'the reset is not the last number').toBe('6');
  });

  it('🔴 [Boundary] a re-render WHILE OPEN is renumbered — a panel rewrites its rows on every click', async () => {
    painel.abrir();
    preencher(painel.casca.lista); // what a panel's click handler does
    await Promise.resolve(); // mutation observers run as a microtask
    const linhas = [...painel.casca.lista.querySelectorAll('.ctrl-row')];
    expect(num(linhas[0]), 'the new rows came without numbers').toBe('2');
    expect(painel.casca.card.querySelectorAll('.item-num')).toHaveLength(1);
  });

  it('🎯 [Zero] a renumbering WITHOUT a re-render leaves ONE number per stop — no stale marks pile up', async () => {
    // ⚠️ Without a re-render on purpose: opening twice replaces the rows, and the old marks leave with them — the first
    // version of this case opened twice and stayed green with the clean-up removed.
    painel.abrir();
    document.getElementById('linha-escondida').hidden = true;
    await Promise.resolve();
    expect(painel.casca.card.querySelectorAll('.item-num'), 'the slider got two numbers').toHaveLength(1);
    expect(document.getElementById('volume').previousElementSibling?.textContent).toBe('4');
  });

  it('🔴 [Right] the number is DRAWN, and kept out of the accessible name', () => {
    painel.abrir();
    const linha0 = painel.casca.lista.querySelector('.ctrl-row');
    // 📏 Chromium RESOLVES `attr()` in the computed `content` — so this reads the number actually drawn, not a rule.
    for (const [el, n] of [[painel.casca.fechar, '1'], [linha0, '2'], [painel.casca.reset, '7']]) {
      expect(getComputedStyle(el, '::before').content, 'the number is not drawn, or enters the name').toBe(`"${n}" / ""`);
    }
    expect(painel.casca.card.querySelector('.item-num').getAttribute('aria-hidden')).toBe('true');
  });

  it('🔴 [Right] the panel footer holds at most TWO lines, over its dark band (ADR-0164)', () => {
    painel.abrir();
    const rodape = document.createElement('div');
    rodape.className = 'opt-explain';
    rodape.textContent = 'uma explicação longa demais '.repeat(12);
    painel.casca.card.style.width = '320px';
    painel.casca.card.appendChild(rodape);
    const cs = getComputedStyle(rodape);
    const linhas = (rodape.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight);
    expect(rodape.scrollHeight, 'the case would not measure the cut').toBeGreaterThan(rodape.clientHeight);
    expect(linhas, 'the panel footer grew past two lines').toBeLessThanOrEqual(2.05);
    expect(cs.backgroundColor).toBe('rgba(0, 0, 0, 0.82)');
  });

  it('⚠️ [Right] the row keeps its control at the FAR end — the number does not push the label to the middle', () => {
    painel.abrir();
    const linha0 = painel.casca.lista.querySelector('.ctrl-row');
    const caixa = linha0.getBoundingClientRect();
    const controlo = linha0.lastElementChild.getBoundingClientRect();
    const rotulo = linha0.firstElementChild.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(linha0).paddingRight) + parseFloat(getComputedStyle(linha0).borderRightWidth);
    expect(Math.abs(caixa.right - padding - controlo.right), 'the control left the far end').toBeLessThan(1);
    expect(rotulo.left - caixa.left, 'the label drifted away from the number').toBeLessThan(caixa.width / 3);
  });
});

// ===== MUTATIONS CHECKED (2026-09-12) =====
// 1. `abrir()` stops numbering                                   → red (the observer only sees LATER changes)
// 2. the observer's callback stops renumbering                   → red, twice (re-render and hidden row)
// 3. old number marks are not cleared                            → red — only after the [Zero] case stopped opening
//    twice: a re-render took the old marks away with the rows, and the clean-up looked tested while it was not
// 4. `content:attr(data-item-num)` without `/ ""`                 → red (the number enters the accessible name)
// 5. the row's last child loses `margin-inline-start:auto`       → red (the label drifts to the middle). A sibling
//    rule, `justify-content:flex-start`, SURVIVED its removal: the auto margin takes the free space first, so it
//    was inert and was deleted
// 6. a second stop in a row numbers the row again                → red, four times
// 7. no visibility filter in `itensNavegaveis`                   → red (a hidden row takes a number)
