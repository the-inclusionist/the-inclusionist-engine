// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/changed-mark — a marca de "saiu do padrão" (ADR-0029, project BROWSER: usa document).
//
// O caso que mantém este módulo honesto NÃO é o de marcar: é o de DESMARCAR. Uma marca que só soubesse
// acrescentar acabaria em todos os controles, e uma marca em tudo não é marca — é ruído com aparência de
// informação, no menu onde a criança tem menos margem para ser confundida.
//
// O segundo caso que importa é o do NOME acessível, que tem dois caminhos porque `aria-label` vence o
// conteúdo do botão. Marcar só um deles deixaria metade dos controles mudos para quem não enxerga, em
// silêncio — o pior jeito de uma marca de acessibilidade falhar, porque nada na tela denuncia a falta.
//
// O terceiro é o rótulo VISÍVEL, e ele entrou aqui por um teste alheio ter caído. A primeira versão pendurava
// um `<span class="sr-only">` dentro do botão, e um caso de settings-mobility que aferia `textContent` acusou:
// os painéis reescrevem o conteúdo inteiro a cada reflect, então o sufixo dependia da ordem das chamadas para
// sobreviver. O sufixo agora mora só no `aria-label`, e o texto visível é intocado.
import { describe, it, expect, beforeEach } from 'vitest';
import { markChanged, markMenuChanged, CHANGED_CLASS } from '../app/js/ui/changed-mark.js';

const $ = (sel) => document.querySelector(sel);
const nome = (el) => (el.hasAttribute('aria-label') ? el.getAttribute('aria-label') : el.textContent);

beforeEach(() => {
  document.body.innerHTML = `
    <div class="ctrl-row" id="row-label"><span>Modo Fácil</span>
      <button id="btn-label" type="button" aria-label="Modo Fácil, desligado">▶ Desligado</button></div>
    <div class="ctrl-row" id="row-text"><span>Alternância</span>
      <button id="btn-text" type="button">▶ Desligado</button></div>
    <button class="pm-btn" id="opener" type="button">Acessibilidade motora</button>`;
});

describe('ui/changed-mark — a marca visual', () => {
  it('[Right] põe a classe na linha alterada e tira quando ela volta ao padrão', () => {
    const row = $('#row-label');
    markChanged(row, true);
    expect(row.classList.contains(CHANGED_CLASS)).toBe(true);
    markChanged(row, false);
    expect(row.classList.contains(CHANGED_CLASS)).toBe(false);
  });

  it('[Right] é idempotente — chamar dez vezes com o mesmo valor dá o mesmo resultado', () => {
    // Os painéis chamam isto de dentro do `reflect*`, que roda a cada mudança de qualquer controle.
    const row = $('#row-text');
    for (let i = 0; i < 10; i++) markChanged(row, true);
    expect(row.classList.contains(CHANGED_CLASS)).toBe(true);
    expect(nome($('#btn-text')).match(/alterado/g)).toHaveLength(1); // UMA vez, não dez
  });

  it('[Interface] NÃO mexe no texto visível — quem reescreve o rótulo a cada reflect são os painéis', () => {
    markChanged($('#row-text'), true);
    expect($('#btn-text').textContent).toBe('▶ Desligado');
    markChanged($('#row-label'), true);
    expect($('#btn-label').textContent).toBe('▶ Desligado');
  });

  it('[Zero] elemento nulo não lança — um painel sem a linha no DOM não pode derrubar o resto', () => {
    expect(() => markChanged(null, true)).not.toThrow();
  });
});

describe('ui/changed-mark — o nome acessível, pelos dois caminhos', () => {
  it('[Right] com aria-label: o sufixo entra NO label, porque ele vence o conteúdo', () => {
    markChanged($('#row-label'), true);
    expect($('#btn-label').getAttribute('aria-label')).toBe('Modo Fácil, desligado, alterado');
  });

  it('[Right] sem aria-label: um é CRIADO a partir do conteúdo, para o sufixo ter onde entrar', () => {
    markChanged($('#row-text'), true);
    expect($('#btn-text').getAttribute('aria-label')).toBe('▶ Desligado, alterado');
  });

  it('[Right] desmarcar DEVOLVE o nome original, sem sobra dos dois caminhos', () => {
    // A base fica guardada em dataset justamente para não ter que reconstruí-la removendo texto por regex —
    // isso quebraria calado no dia em que a tradução do sufixo mudasse.
    markChanged($('#row-label'), true);
    markChanged($('#row-label'), false);
    expect($('#btn-label').getAttribute('aria-label')).toBe('Modo Fácil, desligado');

    markChanged($('#row-text'), true);
    markChanged($('#row-text'), false);
    expect($('#btn-text').hasAttribute('aria-label')).toBe(false); // criado por nós → some inteiro
  });

  it('[Boundary] alternar marcado→limpo→marcado não acumula sufixo', () => {
    const btn = $('#btn-label');
    markChanged($('#row-label'), true);
    markChanged($('#row-label'), false);
    markChanged($('#row-label'), true);
    expect(btn.getAttribute('aria-label')).toBe('Modo Fácil, desligado, alterado');
  });

  it('[Interface] linha com DOIS controles: o sufixo vai no PRIMEIRO, e só nele', () => {
    // Uma linha do mixer tem volume + liga/desliga. Quem tabula alcança o volume primeiro, então é ali que
    // "alterado" precisa sair — antes de a criança decidir se para nesta linha. E só ali: repetir nos dois
    // faria o leitor dizer a mesma coisa duas vezes ao atravessar uma linha só.
    //
    // Este caso existe porque a escolha era um ACIDENTE de ordem do DOM até eu conferir no jogo. Agora
    // reordenar o markup quebra aqui, em vez de mover o sufixo em silêncio.
    document.body.innerHTML =
      '<div class="ctrl-row" id="mix"><span>Música</span>' +
      '<input type="range" aria-label="Volume de Música">' +
      '<button type="button" aria-label="Música"></button></div>';
    markChanged($('#mix'), true);
    expect($('#mix input').getAttribute('aria-label')).toBe('Volume de Música, alterado');
    expect($('#mix button').getAttribute('aria-label')).toBe('Música');
  });

  it('[Interface] a linha SEM controle dentro recebe o sufixo nela mesma', () => {
    document.body.innerHTML = '<div class="ctrl-row" id="solo">Contraste</div>';
    markChanged($('#solo'), true);
    expect($('#solo').getAttribute('aria-label')).toBe('Contraste, alterado');
  });
});

describe('ui/changed-mark — a marca sobe para o menu', () => {
  it('[Right] o botão que abre o menu fica marcado se QUALQUER opção dentro está', () => {
    markMenuChanged($('#opener'), [false, false, true]);
    expect($('#opener').classList.contains(CHANGED_CLASS)).toBe(true);
  });

  it('[Boundary] desmarca só quando a ÚLTIMA opção volta ao padrão, não a primeira', () => {
    // A falha interessante mora aqui: com `every` no lugar de `some`, o menu limparia a marca assim que UMA
    // opção voltasse ao padrão, e as outras alteradas ficariam escondidas atrás de um menu que diz estar
    // intocado. A criança procuraria em todo lugar menos onde está.
    const opener = $('#opener');
    markMenuChanged(opener, [true, true]);
    markMenuChanged(opener, [false, true]);
    expect(opener.classList.contains(CHANGED_CLASS)).toBe(true);
    markMenuChanged(opener, [false, false]);
    expect(opener.classList.contains(CHANGED_CLASS)).toBe(false);
  });

  it('[Zero] lista vazia = menu no padrão', () => {
    markMenuChanged($('#opener'), []);
    expect($('#opener').classList.contains(CHANGED_CLASS)).toBe(false);
  });
});
