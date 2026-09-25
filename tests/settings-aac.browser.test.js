// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-aac — the panel (BROWSER project: uses document). ADR-0028 (7th menu) + ADR-0029 (the mark).
// The pure logic (catalogue, reasons, assembly) is in aac-sets.node.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { initSettingsAac, mountAacInside } from '../app/js/ui/settings-aac.js';
import { sectionHeader } from '../app/js/ui/panel-widgets.js';
import { AAC_SETS } from '../app/js/ui/aac-sets.js';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)

const $ = (sel) => document.querySelector(sel);

function fullCtx(over = {}) {
  const said = [];
  let caso = 'upper';
  return {
    t: translate,
    $,
    srSay: (m) => said.push(m),
    getLetterCase: () => caso,
    setLetterCase: (c) => { caso = c; },
    frontOverlay: () => {},
    // A double of the shell's `fillExplain`. It is in the ctx because the panel calls it on EVERY render: without it the
    // prose goes back inside the rows at the first click, and the menu becomes a manual again.
    fillExplain: () => {},
    restoreFocus: () => true,
    said,
    getCaso: () => caso,
    ...over,
  };
}

beforeEach(() => {
  document.body.innerHTML = `
    <button data-act="caa" class="pm-btn" type="button">Comunicação</button>
    <div id="caa" hidden>
      <div class="overlay__card">
      <div id="caa-list"></div>
      <button id="caa-reset" type="button">Restaurar</button>
      <button id="caa-close" type="button">Fechar</button>
      </div>
    </div>`;
});

describe('ui/settings-aac — escolher', () => {
  it('[Right] o interruptor liga e DESLIGA — e o desligado significa maiúsculas E minúsculas', () => {
    const ctx = fullCtx();
    initSettingsAac(ctx).render();
    $('#caa-caixa-alta').click();
    expect(ctx.getCaso()).toBe('mixed');
    expect(ctx.said.at(-1)).toContain('minúsculas');
    $('#caa-caixa-alta').click();
    expect(ctx.getCaso()).toBe('upper');
    expect(ctx.said.at(-1)).toContain('caixa alta');
  });

  it('🔴 [Right] every section and row is written in the language of the ctx\'s `t`, never as a key (ADR-0232 D3)', () => {
    // The literals, so the case cannot pass by reading the same table the code reads. The letters row, a set in
    // preparation and a set under negotiation each carry a different key, and each section its own title.
    initSettingsAac(fullCtx()).render();
    const list = $('#caa-list');
    const words = [list.textContent, ...[...list.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label'))].join(' | ');
    expect(words, 'a raw key reached the menu').not.toMatch(/\baac\.[a-zA-Z]/);
    expect(list.textContent).toContain('Disponível agora');
    expect($('#caa-caixa-alta').closest('.ctrl-row').textContent).toContain('Letras maiúsculas');
    expect(words, 'a set in preparation does not say so').toContain('Mulberry Symbols, em preparação');
    expect(words, 'a set under negotiation does not say so').toContain('Sclera, aguardando negociação');
  });

  it('[Right] o interruptor LIGADO parece ligado, e o desligado não', () => {
    // ADR-0029 and the rule that state is not told by colour alone: `is-on` is the band the child sees. Without it the
    // button says «▶ Ligado» in its text and still looks off — two opposite signals on the same row, and what she reads
    // first is the shape. Found by a probe on 22/09: nothing pinned this class.
    const ctx = fullCtx();
    initSettingsAac(ctx).render();
    expect($('#caa-caixa-alta').classList.contains('is-on')).toBe(true);
    $('#caa-caixa-alta').click();
    expect($('#caa-caixa-alta').classList.contains('is-on')).toBe(false);
  });

  it('[Right] a explicação vai ao rodapé a CADA render, e não só ao abrir', () => {
    // 🔴 THE MODULE'S OWN COMMENT DESCRIBES THIS DEFECT — without this call the explanation goes back inside the rows and
    // the menu becomes a manual again at the first click — and no case pinned it (probe of 22/09). A lesson written in a
    // comment and not in a sieve gets learned again.
    let chamadas = 0;
    const ctx = fullCtx({ fillExplain: () => { chamadas += 1; } });
    const api = initSettingsAac(ctx);
    api.render();
    expect(chamadas).toBe(1);
    $('#caa-caixa-alta').click(); // the click REBUILDS the rows: the prose goes back inside them
    expect(chamadas, 'cada reconstrução devolve a prosa às linhas; só o fillExplain a tira de lá').toBe(2);
  });

  it('[Interface] clicar num conjunto INDISPONÍVEL não muda nada e não anuncia', () => {
    // The guard exists for the day someone removes the `disabled` "just to test": a set that is not in the game must not
    // become the child's choice by accident, leaving the screen with nothing to draw.
    //
    // HONESTY ABOUT WHAT THIS CASE PINS: there are TWO guards on this path — the button's own `disabled`, and the list's
    // listener, which only reacts to the letters switch —, and removing either one alone still passes here. It pins the
    // BEHAVIOUR, not a specific guard.
    const ctx = fullCtx();
    initSettingsAac(ctx).render();
    const b = $('#caa-list button[data-caa="mulberry"]');
    b.removeAttribute('disabled');
    b.click();
    expect(ctx.getCaso()).toBe('upper');
    expect(ctx.said).toHaveLength(0);
  });

  it('[Interface] os sete pictogramas aparecem, e nenhum deles é clicável hoje', () => {
    // Appearing is a decision: hiding them would make the educator conclude the game does no pictograms at all, when the
    // obstacle is a licence or pending work — and they are precisely the ones the school may already have.
    const ctx = fullCtx();
    initSettingsAac(ctx).render();
    const pict = ['mulberry', 'blissymbolics', 'tawasol', 'arasaac', 'sclera', 'pcs', 'symbolstix', 'widgit'];
    for (const k of pict) {
      const b = $(`#caa-list button[data-caa="${k}"]`);
      expect(b, k).not.toBeNull();
      expect(b.disabled, k).toBe(true);
    }
  });
});

describe('ui/settings-aac — restaurar padrões (ADR-0028) e marca (ADR-0029)', () => {
  it('[Right] o reset volta para maiúsculas — onde a alfabetização costuma começar', () => {
    const ctx = fullCtx();
    initSettingsAac(ctx).render();
    $('#caa-caixa-alta').click();
    $('#caa-reset').click();
    expect(ctx.getCaso()).toBe('upper');
    expect(ctx.said.at(-1)).toContain('padrão');
  });

  it('[Right] fora do padrão marca a linha e o botão do menu; voltar apaga as duas', () => {
    const ctx = fullCtx();
    initSettingsAac(ctx).render();
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);

    $('#caa-caixa-alta').click();
    expect($('#caa-letras').classList.contains('is-changed')).toBe(true);
    expect($('[data-act="caa"]').classList.contains('is-changed')).toBe(true);

    $('#caa-reset').click();
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);
  });
});

describe('ui/settings-aac — a montagem pelo kit (ADR-0129)', () => {
  const kit = () => ({ find: (sel) => document.querySelector(sel), create: (tag) => document.createElement(tag) });

  it('[Zero] uma seção sem nenhuma linha NÃO desenha o cabeçalho dela', () => {
    // An «Aguardando negociação» over nothing tells the educator there is something there and there is not: they look for
    // the row the title promises. 📌 With the number of rows as an ARGUMENT this branch can be exercised — the catalogue is
    // fixed and no section is empty today, so through the public API it would be unreachable — and being exercisable is
    // what a rule needs to be one.
    expect(sectionHeader(kit(), 'Aguardando negociação', 'a permissão não é nossa', 0)).toBeNull();
    expect(sectionHeader(kit(), 'Aguardando negociação', 'a permissão não é nossa', 1)).not.toBeNull();
  });

  it('[Right] a lista traz o interruptor mais os 8 conjuntos, em três seções', () => {
    initSettingsAac(fullCtx()).render();
    expect($('#caa-caixa-alta')).not.toBeNull();
    for (const s of AAC_SETS) expect($(`#caa-list button[data-caa="${s.key}"]`), s.key).not.toBeNull();
    expect(document.querySelectorAll('#caa-list .panel-sub')).toHaveLength(3);
  });

  it('[Right] toda linha nasce com a regra de menu por construção: um `.opt-hint` só, dentro do `<span>`', () => {
    // This is why the conversion pays for itself: the rule of CLAUDE.md §4 is written by `controlRow`, not repeated by
    // convention in each panel, so a new panel cannot diverge from it.
    initSettingsAac(fullCtx()).render();
    for (const linha of document.querySelectorAll('#caa-list .ctrl-row')) {
      expect(linha.querySelectorAll('.opt-hint').length, linha.textContent).toBeLessThanOrEqual(1);
      const dica = linha.querySelector('.opt-hint');
      if (dica) expect(dica.parentElement.tagName).toBe('SPAN');
    }
  });

  it('[Right] o indisponível vem travado, e o disponível não — nunca um botão que não faz nada', () => {
    initSettingsAac(fullCtx()).render();
    for (const s of AAC_SETS) {
      expect($(`#caa-list button[data-caa="${s.key}"]`).disabled, s.key).toBe(!s.available);
    }
    // The letters switch is the offline floor: it never depends on any file, so it never comes locked.
    expect($('#caa-caixa-alta').disabled).toBe(false);
  });

  it('[Many] montar duas vezes REETIQUETA em vez de duplicar — senão cada render deixaria linhas órfãs', () => {
    // ⚠️ And relabelling is not thrift: redoing the row would leave a control in the document WITHOUT a listener — a dead
    // button that looks alive (ADR-0106 §5). It is what the kit's `labelRow` exists to do.
    const lista = $('#caa-list');
    mountAacInside(translate, kit(), lista);
    const antes = lista.querySelectorAll('.ctrl-row').length;
    const botao = $('#caa-caixa-alta');
    mountAacInside(translate, kit(), lista);
    expect(lista.querySelectorAll('.ctrl-row')).toHaveLength(antes);
    expect(lista.querySelectorAll('.panel-sub')).toHaveLength(3);
    expect($('#caa-caixa-alta'), 'o MESMO nó, ou a escuta ligada nele ficou para trás').toBe(botao);
  });
});

describe('ui/settings-aac — abrir e fechar', () => {
  it('[Right] open mostra o overlay e foca o primeiro botão; close o esconde e DEVOLVE o foco', () => {
    // 🔴 This case's name promises the focus, and a probe on 22/09 found it did not measure it (deleting `f.focus()` left
    // it green). Whoever opens a panel by keyboard and keeps the focus behind it has no way to reach what they just
    // opened — and whoever closes it and does not get it back loses their place in the list.
    const ctx = fullCtx();
    const devolvido = [];
    const api = initSettingsAac({ ...ctx, restoreFocus: (id) => { devolvido.push(id); return true; } });
    api.open();
    expect($('#caa').hidden).toBe(false);
    expect(document.activeElement).toBe($('#caa').querySelector('button'));
    api.close();
    expect($('#caa').hidden).toBe(true);
    expect(devolvido).toEqual(['caa']);
  });

  it('[Right] o botão Fechar fecha', () => {
    const ctx = fullCtx();
    initSettingsAac(ctx).open();
    $('#caa-close').click();
    expect($('#caa').hidden).toBe(true);
  });

  it('[Zero] sem o overlay no DOM nada lança — um painel ausente não derruba o resto', () => {
    document.body.innerHTML = '';
    const ctx = fullCtx();
    const api = initSettingsAac(ctx);
    expect(() => { api.render(); api.open(); api.close(); }).not.toThrow();
  });
});
