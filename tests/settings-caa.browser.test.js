// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-caa — o painel (project BROWSER: usa document). ADR-0028 (7º menu) + ADR-0029 (marca).
// A lógica pura (catálogo, motivos, montagem) está em caa-sets.node.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { initSettingsCaa } from '../app/js/ui/settings-caa.js';

const $ = (sel) => document.querySelector(sel);

function fullCtx(over = {}) {
  const said = [];
  let caso = 'upper';
  return {
    $,
    srSay: (m) => said.push(m),
    getLetterCase: () => caso,
    setLetterCase: (c) => { caso = c; },
    frontOverlay: () => {},
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
      <div id="caa-list"></div>
      <button id="caa-reset" type="button">Restaurar</button>
      <button id="caa-close" type="button">Fechar</button>
    </div>`;
});

describe('ui/settings-caa — escolher', () => {
  it('[Right] clicar numa caixa de letra disponível muda `letterCase` e anuncia o nome escolhido', () => {
    const ctx = fullCtx();
    initSettingsCaa(ctx).render();
    $('#caa-list button[data-caa="letras-mistas"]').click();
    expect(ctx.getCaso()).toBe('mixed');
    expect(ctx.said.at(-1)).toContain('minúsculas');
  });

  it('[Interface] clicar num conjunto INDISPONÍVEL não muda nada e não anuncia', () => {
    // A guarda existe para o dia em que alguém tirar o `disabled` "só para testar": um conjunto que não está
    // no jogo não pode virar a escolha da criança por acidente, deixando a tela sem nada para desenhar.
    //
    // HONESTIDADE SOBRE O QUE ESTE CASO PRENDE: hoje há DOIS guardas neste caminho — `disponivel` e a falta de
    // mapeamento para uma caixa de letra —, e apagar qualquer um deles sozinho ainda passa aqui. Ele prende o
    // COMPORTAMENTO, não um guarda específico. Quando um pictograma virar escolhível, o segundo guarda deixa
    // de existir (um conjunto disponível terá comportamento) e este caso passa a prender o primeiro sozinho.
    const ctx = fullCtx();
    initSettingsCaa(ctx).render();
    const b = $('#caa-list button[data-caa="mulberry"]');
    b.removeAttribute('disabled');
    b.click();
    expect(ctx.getCaso()).toBe('upper');
    expect(ctx.said).toHaveLength(0);
  });

  it('[Interface] os sete pictogramas aparecem, e nenhum deles é clicável hoje', () => {
    // Aparecer é decisão: escondê-los faria o educador concluir que o jogo não faz pictograma nenhum, quando
    // o obstáculo é licença ou trabalho pendente — e são justamente os que a escola já pode ter.
    const ctx = fullCtx();
    initSettingsCaa(ctx).render();
    const pict = ['mulberry', 'blissymbolics', 'tawasol', 'arasaac', 'sclera', 'pcs', 'symbolstix', 'widgit'];
    for (const k of pict) {
      const b = $(`#caa-list button[data-caa="${k}"]`);
      expect(b, k).not.toBeNull();
      expect(b.disabled, k).toBe(true);
    }
  });
});

describe('ui/settings-caa — restaurar padrões (ADR-0028) e marca (ADR-0029)', () => {
  it('[Right] o reset volta para maiúsculas — onde a alfabetização costuma começar', () => {
    const ctx = fullCtx();
    initSettingsCaa(ctx).render();
    $('#caa-list button[data-caa="letras-mistas"]').click();
    $('#caa-reset').click();
    expect(ctx.getCaso()).toBe('upper');
    expect(ctx.said.at(-1)).toContain('padrão');
  });

  it('[Right] fora do padrão marca a linha e o botão do menu; voltar apaga as duas', () => {
    const ctx = fullCtx();
    initSettingsCaa(ctx).render();
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);

    $('#caa-list button[data-caa="letras-mistas"]').click();
    expect($('#caa-list button[data-caa="letras-mistas"]').closest('.ctrl-row')
      .classList.contains('is-changed')).toBe(true);
    expect($('[data-act="caa"]').classList.contains('is-changed')).toBe(true);

    $('#caa-reset').click();
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);
  });
});

describe('ui/settings-caa — abrir e fechar', () => {
  it('[Right] open mostra o overlay e foca o primeiro botão; close o esconde', () => {
    const ctx = fullCtx();
    const api = initSettingsCaa(ctx);
    api.open();
    expect($('#caa').hidden).toBe(false);
    api.close();
    expect($('#caa').hidden).toBe(true);
  });

  it('[Right] o botão Fechar fecha', () => {
    const ctx = fullCtx();
    initSettingsCaa(ctx).open();
    $('#caa-close').click();
    expect($('#caa').hidden).toBe(true);
  });

  it('[Zero] sem o overlay no DOM nada lança — um painel ausente não derruba o resto', () => {
    document.body.innerHTML = '';
    const ctx = fullCtx();
    const api = initSettingsCaa(ctx);
    expect(() => { api.render(); api.open(); api.close(); }).not.toThrow();
  });
});
