// SPDX-License-Identifier: AGPL-3.0-or-later
// MOUNTING A SETTINGS PANEL — the gate for `ui/mount-panel.ts` (ADR-0106 §1, ADR-0122).
//
// ========================= WHY THIS IS A BROWSER CASE =========================
// The rule this file inherits from `boot-create-game.browser.test.js` is the one that keeps it from being an
// expensive duplicate: **a case belongs here only if the fake DOM could not do it.** Everything here is that
// kind — whether the overlay is really IN THE TREE, whether focus actually LANDS, whether a real click walks
// the whole path, and whether `hidden` is honoured by the element rather than by a boolean we set ourselves.
//
// 🔴 AND ONE CASE EXISTS BECAUSE I WROTE THE DEFECT FIRST. The focus fallback was `casca.lista`, which is a
// `div[role=group]` with no `tabindex`: `.focus()` on it does nothing and reports nothing. A fake DOM would
// have recorded the call and passed. A real one moves focus or does not, and that is the whole question.
//
// MUTATIONS CONFIRMED at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountPanel } from '../app/js/ui/mount-panel.js';

let host;
let registados;

const ctx = () => ({
  find: (s) => document.querySelector(s),
  create: (t) => document.createElement(t),
  host,
  overlays: {
    frontOverlay: (el) => { el.dataset.aFrente = '1'; },
    register: (id, entry) => { registados.set(id, entry); },
    restoreFocus: (id) => { registados.set(`${id}:foco-reposto`, true); },
  },
});

const spec = (extra = {}) => ({
  id: 'fixture',
  labels: () => ({
    title: `Fixture ${idioma}`,
    listLabel: 'Lista da fixture',
    resetLabel: 'Repor',
    closeLabel: 'Fechar',
  }),
  render: () => { renderizou += 1; },
  ...extra,
});

let renderizou = 0;
// The language the start does not have yet. `initI18n` applies the fallback synchronously and ASKS for the preferred
// one afterwards; this variable is that gap, written so a case can cross it.
let idioma = 'pt';

beforeEach(() => {
  host = document.createElement('div');
  host.id = 'hospedeiro-de-teste';
  document.body.appendChild(host);
  registados = new Map();
  renderizou = 0;
  idioma = 'pt';
});

afterEach(() => { host.remove(); });

describe('ADR-0106 · a engine monta o painel, e o consumidor não escreve nenhuma das cinco linhas', () => {
  it('⚠️ [Interface] a casca entra NA ÁRVORE do hospedeiro e nasce escondida', () => {
    // A fixture cannot answer «está na árvore»: it records an `appendChild` and believes it.
    const p = mountPanel(ctx(), spec());
    expect(host.contains(p.shell.overlay), 'o overlay não ficou dentro do hospedeiro').toBe(true);
    expect(document.getElementById('fixture'), 'o id da casca não chegou ao documento').toBe(p.shell.overlay);
    expect(p.shell.overlay.hidden, 'um painel que nasce aberto é um painel que ninguém abriu').toBe(true);
  });

  it('🎯 [Right] abrir RENDERIZA, revela, traz à frente e põe o foco DENTRO do cartão', () => {
    // The four things a consumer would otherwise do by hand, in one call.
    const p = mountPanel(ctx(), spec());
    const botao = document.createElement('button');
    botao.textContent = 'uma opção';
    p.shell.list.appendChild(botao);

    p.open();
    expect(renderizou, 'abrir não chamou o render do painel').toBe(1);
    expect(p.shell.overlay.hidden).toBe(false);
    expect(p.shell.overlay.dataset.aFrente, 'não foi trazido à frente da pilha').toBe('1');
    expect(p.shell.card.contains(document.activeElement), 'o foco ficou FORA de um diálogo modal').toBe(true);
    // 🔴 ADR-0158: the cursor lands on «Voltar», item 1 — even with a live control in the list, which is the case
    // that used to take the focus.
    expect(document.activeElement, 'the panel opened with the cursor away from its way out').toBe(p.shell.close);
  });

  it('🔴 [Boundary] sem controle na lista, o foco cai no VOLTAR — nunca num `div` que não o aceita', () => {
    // The defect this case caught: `casca.lista` is a `div[role=group]` without `tabindex`, and `.focus()` on it does
    // nothing AND SAYS NOTHING. In a fake DOM this passed.
    const p = mountPanel(ctx(), spec());
    p.open();
    expect(document.activeElement, 'o foco não pousou em elemento nenhum').toBe(p.shell.close);
    expect(document.activeElement).not.toBe(p.shell.list);
  });

  it('⚠️ [Right] um clique DE VERDADE no fechar esconde e devolve o foco a quem abriu', () => {
    const p = mountPanel(ctx(), spec());
    p.open();
    p.shell.close.click();
    expect(p.shell.overlay.hidden, 'o clique no fechar não escondeu o painel').toBe(true);
    expect(registados.get('fixture:foco-reposto'), 'o foco não voltou a quem abriu (WCAG 2.4.3)').toBe(true);
  });

  it('🎯 [Right] o painel ENTRA na cadeia do Escape — o registo estava vazio sob o `createGame`', () => {
    // Without this, `settings-panel.escapeTarget()` walks an empty registry: a modal dialog no key closes is the trap
    // ADR-0044 §2 names about the pause itself.
    const p = mountPanel(ctx(), spec());
    const entrada = registados.get('fixture');
    expect(entrada, 'o painel não se registou na pilha de overlays').toBeTruthy();
    expect(entrada.inEscapeChain, 'registou-se FORA da cadeia do Escape').toBe(true);
    p.open();
    entrada.close();
    expect(p.shell.overlay.hidden, 'o fecho da cadeia do Escape não escondeu o painel').toBe(true);
  });

  it('⚠️ [Zero] montar DUAS vezes deixa UM painel — é o terceiro gate do ADR-0139', () => {
    // «Two cartridges mounted in sequence leave exactly one accessibility bar in the document.» The same claim, on the
    // smallest surface where it can be measured.
    mountPanel(ctx(), spec());
    mountPanel(ctx(), spec());
    expect(document.querySelectorAll('#fixture').length, 'duas montagens deixaram dois painéis').toBe(1);
  });

  it('🎯 [Right] o IDIOMA QUE CHEGA DEPOIS DO ARRANQUE alcança o título, sem remontar a casca', () => {
    // `initI18n` applies the fallback language synchronously and asks for en/es afterwards. A panel mounted in that gap
    // would keep the fallback title — the same defect the icon bar paid for on 08/09. Here the gap is crossed on
    // purpose: mount in «pt», the language arrives, and only then does the child open it.
    const p = mountPanel(ctx(), spec());
    expect(p.shell.title.textContent).toBe('Fixture pt');
    idioma = 'en';
    p.open();
    expect(p.shell.title.textContent, 'o título ficou no idioma de recuo depois de o preferido chegar').toBe('Fixture en');
  });

  it('⚠️ [Boundary] retraduzir NÃO remonta a casca: a escuta que o painel ligou no repor sobrevive', () => {
    // `mountShell` empties the card, and each `ui/settings-*` wires its `#X-reset` ONCE in `init`. Fixing the title by
    // remounting would leave the reset button in the document with no listener — a dead button that looks alive,
    // precisely what ADR-0106 §5 forbids.
    const p = mountPanel(ctx(), spec());
    let reposto = 0;
    p.shell.reset.addEventListener('click', () => { reposto += 1; });
    const mesmoNo = p.shell.reset;
    idioma = 'en';
    p.open();
    // Through the DOCUMENT and not the shell: a remount would return a new button with the same id, and the old one —
    // the one with the listener — would leave the tree unnoticed.
    const noDocumento = document.getElementById('fixture-reset');
    expect(noDocumento, 'o botão de repor no documento não é o que o painel ligou').toBe(mesmoNo);
    expect(noDocumento.textContent, 'o rótulo do repor não foi retraduzido').toBe('Repor');
    noDocumento.click();
    expect(reposto, 'a escuta do repor morreu na retradução').toBe(1);
  });

  it('[Boundary] uma introdução que SOME apaga o `data-explain-idle` — não sobrevive ao idioma anterior', () => {
    // A dictionary without the key is an absent introduction. Not writing is not enough: the old attribute would stay,
    // and the footer would rest in the language the child just left.
    const p = mountPanel(ctx(), spec({
      labels: () => ({
        title: 'Fixture', listLabel: 'Lista', resetLabel: 'Repor', closeLabel: 'Fechar',
        ...(idioma === 'pt' ? { intro: 'Escolha uma fonte.' } : {}),
      }),
    }));
    expect(p.shell.card.getAttribute('data-explain-idle')).toBe('Escolha uma fonte.');
    idioma = 'en';
    p.open();
    expect(p.shell.card.hasAttribute('data-explain-idle'), 'a introdução do idioma anterior sobreviveu').toBe(false);
  });

  it('🎯 [Right] com `fecharProprio`, o botão tem UM dono — e a cadeia do Escape usa o MESMO', () => {
    // 📏 Some panels have their own `close()` and wire their `#X-close` themselves in init (`caa`, `empathy`). Wiring a
    // second listener here would put two owners on one button; and, worse, the Escape chain would use this shell's while
    // the button used the panel's — one exit, two paths.
    let fechou = 0;
    const meuFechar = () => { fechou += 1; };
    const p = mountPanel(ctx(), spec({ closeOwn: meuFechar }));
    p.open();
    p.shell.close.click();
    expect(fechou, 'a casca ligou um ouvinte por cima do que o painel já tinha').toBe(0);

    // and the Escape chain closes through the PANEL's path, not through a parallel closer of this shell
    registados.get('fixture').close();
    expect(fechou, 'o Escape fechou por um caminho que o botão não usa').toBe(1);
    expect(p.close, 'o `fechar` devolvido não é o do painel').toBe(meuFechar);

    // ⚠️ And the shell does NOT hide on its own: the panel is the one that knows what closing means for it.
    expect(p.shell.overlay.hidden, 'a casca escondeu por trás do closer do painel').toBe(false);
  });

  it('[Right] o render corre a CADA abertura, não uma vez na montagem', () => {
    // A panel that renders once shows stale state after the child changes the same setting through the quick bar — and
    // `fillExplain` must run again or the prose goes back inside the rows.
    const p = mountPanel(ctx(), spec());
    expect(renderizou, 'montar não devia renderizar').toBe(0);
    p.open(); p.close(); p.open();
    expect(renderizou).toBe(2);
  });
});

// ========================= MUTATIONS CHECKED =========================
// Each applied by script to the file, with occurrence counts before applying.
//   · 🔴 returning focus to `casca.lista` instead of `casca.fechar` -> the [Boundary] fails. It is the defect of the
//     first version, and the reason this file is a BROWSER one: a `div[role=group]` without `tabindex` accepts the
//     `.focus()` call and moves nothing. A fake DOM records the call and passes.
//   · removing the `register` from the stack -> the Escape-chain case fails. Without it the panel opens and no key
//     closes it, the trap of ADR-0044 §2 applied to a modal dialog.
//   · removing `restoreFocus` from closing -> the click case fails. Focus lands nowhere after closing, and a keyboard
//     user starts over from the top of the document (WCAG 2.4.3).
//   · calling `spec.render()` at mount instead of at open -> the last case fails (count 1, not 0).
//   · removing the `appendChild` -> the [Interface] fails FIRST: the shell exists and is nowhere, which is exactly
//     «o painel abre vazio, sem erro» seen from the other side.
//   · resolving the labels ONLY at mount (removing `applyLabels` from `abrir`) -> two fail: the title stays in the
//     fallback language, and the previous language's introduction survives. It is the defect the icon bar paid for on
//     08/09, reproduced in a panel.
//   · retranslating by REMOUNTING the shell (replacing `applyLabels` with `mountShell`) -> six fail, and the one that
//     matters is the reset: `mountShell` empties the card, the button with the listener leaves the tree and a mute
//     namesake stays. A dead button that looks alive is worse than an absent one (ADR-0106 §5).
//   · an absent introduction no longer ERASING `data-explain-idle` (removing the `else removeAttribute`) -> the
//     introduction case fails: not writing is not erasing, and the footer rests in the previous language.
//   · (2026-09-12, ADR-0158) focus on the first live control of the list instead of «Voltar» -> the [Right] open case
//     is red: that is exactly the old fallback, and the panel would open with the cursor away from its way out.
