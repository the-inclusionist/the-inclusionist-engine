// SPDX-License-Identifier: AGPL-3.0-or-later
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
    // Dublê do `fillExplain` da casca. Ele existe no ctx porque o painel o chama a CADA render: sem isso a
    // prosa volta para dentro das linhas ao primeiro clique, e o menu vira manual de novo.
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

describe('ui/settings-caa — escolher', () => {
  it('[Right] o interruptor liga e DESLIGA — e o desligado significa maiúsculas E minúsculas', () => {
    const ctx = fullCtx();
    initSettingsCaa(ctx).render();
    $('#caa-caixa-alta').click();
    expect(ctx.getCaso()).toBe('mixed');
    expect(ctx.said.at(-1)).toContain('minúsculas');
    $('#caa-caixa-alta').click();
    expect(ctx.getCaso()).toBe('upper');
    expect(ctx.said.at(-1)).toContain('caixa alta');
  });

  it('[Right] o interruptor LIGADO parece ligado, e o desligado não', () => {
    // ADR-0029 e a regra de que estado não se diz só por cor: o `is-on` é a faixa que a criança vê. Sem ele o
    // botão diz «▶ Ligado» no texto e continua com a aparência de desligado — dois sinais contrários na mesma
    // linha, e o que ela lê primeiro é a forma. Achado por sonda em 22/09: nada prendia esta classe.
    const ctx = fullCtx();
    initSettingsCaa(ctx).render();
    expect($('#caa-caixa-alta').classList.contains('is-on')).toBe(true);
    $('#caa-caixa-alta').click();
    expect($('#caa-caixa-alta').classList.contains('is-on')).toBe(false);
  });

  it('[Right] a explicação vai ao rodapé a CADA render, e não só ao abrir', () => {
    // 🔴 O COMENTÁRIO DO MÓDULO JÁ CONTAVA ESTE DEFEITO — «sem esta chamada a explicação volta para dentro das
    // linhas, e foi exatamente o que aconteceu: o menu virou manual de novo ao primeiro clique» — e nenhum
    // caso o prendia (sonda de 22/09). Uma lição escrita num comentário e não num crivo volta a ser aprendida.
    let chamadas = 0;
    const ctx = fullCtx({ fillExplain: () => { chamadas += 1; } });
    const api = initSettingsCaa(ctx);
    api.render();
    expect(chamadas).toBe(1);
    $('#caa-caixa-alta').click(); // o clique RECONSTRÓI as linhas: a prosa volta para dentro delas
    expect(chamadas, 'cada reconstrução devolve a prosa às linhas; só o fillExplain a tira de lá').toBe(2);
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
    $('#caa-caixa-alta').click();
    $('#caa-reset').click();
    expect(ctx.getCaso()).toBe('upper');
    expect(ctx.said.at(-1)).toContain('padrão');
  });

  it('[Right] fora do padrão marca a linha e o botão do menu; voltar apaga as duas', () => {
    const ctx = fullCtx();
    initSettingsCaa(ctx).render();
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);

    $('#caa-caixa-alta').click();
    expect($('#caa-letras').classList.contains('is-changed')).toBe(true);
    expect($('[data-act="caa"]').classList.contains('is-changed')).toBe(true);

    $('#caa-reset').click();
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);
  });
});

describe('ui/settings-caa — abrir e fechar', () => {
  it('[Right] open mostra o overlay e foca o primeiro botão; close o esconde e DEVOLVE o foco', () => {
    // 🔴 O NOME DESTE CASO PROMETIA O FOCO E O CASO NÃO O MEDIA (achado por sonda em 22/09: apagar o
    // `f.focus()` deixava-o verde). Quem abre um painel pelo teclado e fica com o foco atrás dele não tem como
    // alcançar o que acabou de abrir — e quem o fecha e não o recebe de volta perde o lugar na lista.
    const ctx = fullCtx();
    const devolvido = [];
    const api = initSettingsCaa({ ...ctx, restoreFocus: (id) => { devolvido.push(id); return true; } });
    api.open();
    expect($('#caa').hidden).toBe(false);
    expect(document.activeElement).toBe($('#caa').querySelector('button'));
    api.close();
    expect($('#caa').hidden).toBe(true);
    expect(devolvido).toEqual(['caa']);
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
