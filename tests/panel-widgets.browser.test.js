// SPDX-License-Identifier: AGPL-3.0-or-later
// UMA LINHA DE MENU, E O INTERIOR DO PAINEL MOTORA — o contrato invisível um nível abaixo do `panel-shell`.
//
// ========================= POR QUE ESTES CASOS SÃO DE NAVEGADOR =========================
// A regra herdada do `boot-create-game.browser.test.js`: **um caso só entra aqui se o DOM falso não o
// conseguisse fazer.** O que se pergunta é se o controle criado é mesmo um `<select>` e não um `<button>`, se
// o `.opt-hint` está DENTRO do `<span>` onde o `fillExplain` o vai procurar, e se montar duas vezes deixa uma
// linha. Um duplo responde «sim» às três sem que nenhuma seja verdade.
//
// MUTAÇÕES CONFERIDAS no fim do ficheiro.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { linhaDeControle } from '../app/js/ui/panel-widgets.js';
import { montarInteriorDoMotor } from '../app/js/ui/settings-motor.js';
import { montarCasca } from '../app/js/ui/panel-shell.js';

const ctx = {
  procurar: (s) => document.querySelector(s),
  criar: (t) => document.createElement(t),
};

let hospedeiro;
beforeEach(() => {
  hospedeiro = document.createElement('div');
  document.body.appendChild(hospedeiro);
});
afterEach(() => { hospedeiro.remove(); });

describe('linhaDeControle — a regra de menu do CLAUDE.md §4, por construção', () => {
  it('🎯 [Right] o rótulo curto fica à vista e a prosa vai num `.opt-hint` DENTRO do `<span>`', () => {
    // É onde o `ui/settings-panel.fillExplain` a procura para a mover ao rodapé. Fora do `<span>` ela nunca
    // sai da linha, e o menu volta a ser um manual — o resultado que o Dev já viu e nomeou.
    const { linha } = linhaDeControle(ctx, { id: 'x', rotulo: 'Modo Fácil', dica: 'Gravidade menor.' });
    hospedeiro.appendChild(linha);
    expect(linha.className).toBe('ctrl-row');
    expect(linha.querySelector('strong').textContent).toBe('Modo Fácil');
    const dica = linha.querySelector('.opt-hint');
    expect(dica, 'a dica não foi criada').not.toBeNull();
    expect(dica.parentElement.tagName, 'a dica ficou fora do `<span>` onde o fillExplain a procura').toBe('SPAN');
    expect(dica.parentElement.contains(linha.querySelector('strong')), 'a dica não está no mesmo `<span>` do rótulo')
      .toBe(true);
  });

  it('⚠️ [Zero] UMA dica só — duas descrições do mesmo controle deixam sempre uma para trás', () => {
    const { linha } = linhaDeControle(ctx, { id: 'x', rotulo: 'Rótulo', dica: 'Uma explicação.' });
    expect(linha.querySelectorAll('.opt-hint')).toHaveLength(1);
  });

  it('[Zero] sem dica, não nasce `.opt-hint` vazio — o rodapé descansa no texto do painel', () => {
    const { linha } = linhaDeControle(ctx, { id: 'x', rotulo: 'Rótulo' });
    expect(linha.querySelector('.opt-hint')).toBeNull();
  });

  it('🔴 [Interface] a FORMA decide a tag — um `<select>` pedido não pode nascer `<button>`', () => {
    // ⚠️ É O DEFEITO QUE NÃO DÁ ERRO. `settings-audio` faz `ctx.$<HTMLSelectElement>('#cane-div').value = …`;
    // num `<button>` isso escreve uma propriedade que ninguém lê, e a escolha da criança some em silêncio.
    expect(linhaDeControle(ctx, { id: 'a', rotulo: 'A' }).controle.tagName).toBe('BUTTON');
    expect(linhaDeControle(ctx, { id: 'b', rotulo: 'B', forma: 'escolha' }).controle.tagName).toBe('SELECT');
    const cursor = linhaDeControle(ctx, { id: 'c', rotulo: 'C', forma: 'cursor' }).controle;
    expect(cursor.tagName).toBe('INPUT');
    expect(cursor.type).toBe('range');
    // ⚠️ E COM LIMITES: um `range` sem `min`/`max` assume 0..100, e o volume deste projeto é 0..1 — sem isto o
    // primeiro passo do cursor salta o intervalo inteiro.
    expect(cursor.min).toBe('0');
    expect(cursor.max).toBe('100');
  });

  it('🔴 [Right] o interruptor anuncia o NOME, não só o estado', () => {
    // O `textContent` de um interruptor deste projeto é «▶ Desligado». Sem `aria-label`, quem navega controlo
    // a controlo ouve «Desligado, botão» e não sabe desligado O QUÊ — o `<strong>` ao lado só serve a quem vê
    // a linha inteira.
    const { controle } = linhaDeControle(ctx, { id: 'x', rotulo: 'Modo Fácil' });
    expect(controle.getAttribute('aria-label')).toBe('Modo Fácil');
    expect(controle.getAttribute('aria-pressed'), 'nasce sem estado dito, e um estado por dizer é um estado errado')
      .toBe('false');
  });

  it('[Right] `rotuloAria` ganha ao rótulo, para quando o nome falado não é o escrito', () => {
    const { controle } = linhaDeControle(ctx, { id: 'x', rotulo: '↺', rotuloAria: 'Restaurar cores padrão' });
    expect(controle.getAttribute('aria-label')).toBe('Restaurar cores padrão');
  });
});

describe('montarInteriorDoMotor — o painel constrói o que ele próprio alcança', () => {
  function casca() {
    const c = montarCasca(ctx, {
      id: 'movement', titulo: 'Motora', rotuloDaLista: 'Escolhas', rotuloReset: 'Repor', rotuloFechar: 'Fechar',
    });
    hospedeiro.appendChild(c.overlay);
    return c;
  }

  it('🎯 [Right] cria os QUATRO ids que o painel alcança e nunca criava', () => {
    // 📏 `settings-motor` procura `#movement-players`, `#opt-facil`, `#opt-altmove` e `#opt-togglerun`. O
    // markup deles vivia no `app/index.html`, que saiu com o cartucho — desde então o painel abria com o
    // cartão, o título e o botão de repor, e NENHUMA das três escolhas.
    const c = casca();
    montarInteriorDoMotor(ctx, c.card, c.lista);
    for (const id of ['movement-players', 'opt-facil', 'opt-altmove', 'opt-togglerun']) {
      expect(document.getElementById(id), `#${id} não foi criado`).not.toBeNull();
    }
  });

  it('⚠️ [Right] as três escolhas ficam DENTRO da lista, e as abas FORA dela', () => {
    // A lista é o `div[role=group]` que o leitor de tela anuncia como o conjunto das escolhas. As abas dizem
    // de QUEM são as escolhas: pô-las lá dentro faria o grupo anunciar o selector de assento como se fosse
    // mais um ajuste.
    const c = casca();
    montarInteriorDoMotor(ctx, c.card, c.lista);
    for (const id of ['opt-facil', 'opt-altmove', 'opt-togglerun']) {
      expect(c.lista.contains(document.getElementById(id)), `#${id} ficou fora da lista`).toBe(true);
    }
    const abas = document.getElementById('movement-players');
    expect(c.lista.contains(abas), 'as abas entraram no grupo das escolhas').toBe(false);
    expect(c.card.contains(abas), 'as abas ficaram fora do cartão').toBe(true);
    expect(abas.hidden, 'as abas nascem à vista e vazias — um selector que não seleciona nada').toBe(true);
  });

  it('⚠️ [Zero] montar DUAS vezes deixa UMA linha de cada', () => {
    // A raiz monta mais do que uma vez: a contagem de jogadores muda a grade de telas, e o ADR-0142 põe dois
    // cartuchos na mesma página.
    const c = casca();
    montarInteriorDoMotor(ctx, c.card, c.lista);
    montarInteriorDoMotor(ctx, c.card, c.lista);
    for (const id of ['movement-players', 'opt-facil', 'opt-altmove', 'opt-togglerun']) {
      expect(document.querySelectorAll('#' + id), `#${id} ficou duplicado`).toHaveLength(1);
    }
  });

  it('🔴 [Right] a linha da ALTERNÂNCIA é sempre criada — quem a esconde é o painel, por `seguraTeclas`', () => {
    // ⚠️ A REGRA MORA NUM SÍTIO SÓ. `reflectAltMove` decide se ela se vê, pelo `seguraTeclas` do ADR-0115, e
    // a decisão dele é `hidden` — que a tira da tela E da árvore de acessibilidade. Criar só quando se aplica
    // poria a mesma regra em dois lugares, e o dia em que divergissem é o dia em que a linha aparece num jogo
    // onde não faz nada.
    const c = casca();
    montarInteriorDoMotor(ctx, c.card, c.lista);
    const alt = document.getElementById('opt-altmove');
    expect(alt, 'a linha da alternância não foi criada').not.toBeNull();
    expect(alt.closest('.ctrl-row').hidden, 'nasceu escondida: a construção assumiu uma decisão que não é dela')
      .toBe(false);
  });

  it('[Right] cada escolha tem a sua explicação, e ela vai para o rodapé pelo caminho da casca', () => {
    const c = casca();
    montarInteriorDoMotor(ctx, c.card, c.lista);
    for (const id of ['opt-facil', 'opt-altmove', 'opt-togglerun']) {
      const linha = document.getElementById(id).closest('.ctrl-row');
      expect(linha.querySelector('.opt-hint'), `#${id} ficou sem explicação`).not.toBeNull();
      expect(linha.querySelector('strong').textContent.length, `#${id} ficou sem rótulo`).toBeGreaterThan(0);
    }
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Dez, cada uma aplicada por script a ficheiro e com contagem de ocorrencias antes de aplicar.
//
//   1. a dica a sair do `<span>` -> o `fillExplain` nunca a acha, e o menu volta a ser um manual.
//   2. a FORMA ignorada (tudo botao) -> um `<select>` pedido nasce `<button>`; escrever `.value` nele nao da
//      erro nenhum, e a escolha da crianca some em silencio.
//   3. o cursor sem `min`/`max` -> assume 0..100 onde o volume e 0..1, e o primeiro passo salta o intervalo.
//   4. o controle sem `aria-label` -> reprovam DOIS: quem navega controlo a controlo ouve so «Desligado».
//   5. `rotuloAria` a deixar de ganhar -> um botao cujo rotulo e um glifo passa a anunciar o glifo.
//   6. o interruptor sem `aria-pressed` -> nasce com o estado por dizer, que e um estado errado.
//   7. o interior do motor sem guarda -> montar duas vezes deixa duas linhas de cada, e a raiz monta mais do
//      que uma vez (a contagem de jogadores muda a grade; o ADR-0142 poe dois cartuchos na mesma pagina).
//   8. as abas DENTRO da lista -> o grupo anuncia o selector de assento como se fosse mais um ajuste.
//   9. a linha da alternancia criada so quando se aplica -> reprovam CINCO. A regra do `seguraTeclas` mora no
//      `reflectAltMove`; em dois sitios, elas divergem, e a linha aparece num jogo onde nao faz nada.
//  10. as escolhas no cartao em vez da lista -> saem do `div[role=group]` que o leitor de tela anuncia.
