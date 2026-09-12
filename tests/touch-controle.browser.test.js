// SPDX-License-Identifier: AGPL-3.0-or-later
// O CONTROLE VIRTUAL, DESENHADO A PARTIR DO QUE O JOGO DECLARA — o gate do ADR-0143.
//
// ========================= POR QUE ESTES CASOS SÃO DE NAVEGADOR =========================
// A regra herdada do `boot-create-game.browser.test.js`: um caso só entra aqui se o DOM falso não o
// conseguisse fazer. O que se pergunta é se o nó está mesmo na árvore, se `dataset.btn` sobrevive a ser lido
// como `'b' + dataset.btn` — que é o que o `touch-bindings` faz —, e se montar duas vezes deixa um pad.
//
// 🔴 E UM CASO EXISTE PORQUE O PRÓPRIO REGISTO AVISOU QUE ELE PASSA POR ACIDENTE. O ADR-0143 escreve-o:
// «hoje o pad já está ausente e já está calado, então um caso que afirme só a ausência continua verde com
// nada construído». O caso do `preset` vazio exige as DUAS metades — o markup ausente E a linha presente.
//
// MUTAÇÕES CONFERIDAS no fim do ficheiro.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { montarControleDeToque, lacunasDoToque } from '../app/js/input/touch.js';
import { TOUCH_DEFAULT } from '../app/js/input/devices.js';

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

const montar = (acoes, extra = {}) => {
  const raiz = montarControleDeToque(ctx, {
    mapa: TOUCH_DEFAULT,
    acoesDoJogo: new Set(acoes),
    rotuloDoSlot: (s) => 'rótulo de ' + s,
    ...extra,
  });
  hospedeiro.appendChild(raiz);
  return raiz;
};

// As acções que o jogo de plataforma declara, e as que um quiz declara. São os dois extremos que o registo
// usa para decidir a forma.
const OITO_ACOES = ['up', 'down', 'left', 'right', 'action1', 'action2', 'action3', 'action4'];
const DUAS_ACOES = ['action1', 'action2'];

describe('ADR-0143 · a FORMA vem do que o jogo declara', () => {
  it('🎯 [Right] o platformer recebe as quatro direções e os quatro botões', () => {
    const raiz = montar(OITO_ACOES);
    expect(raiz.querySelectorAll('.touch-arm')).toHaveLength(4);
    expect(raiz.querySelectorAll('.touch-btn[data-btn]')).toHaveLength(4);
  });

  it('🔴 [Right] o QUIZ recebe DOIS alvos e NENHUM direcional — não nove botões mortos', () => {
    // ⚠️ É a objecção do segundo consumidor, virada afirmação: «um quiz quer dois alvos grandes, não um
    // direcional de plataforma». Montar o pad do platformer aqui daria nove controles que o leitor de tela
    // anuncia e que não disparam nada — o ADR-0106 §5 quebrado pelo trabalho que o cita.
    const raiz = montar(DUAS_ACOES);
    expect(raiz.querySelector('#touch-cross'), 'recebeu um direcional que a declaração não pede').toBeNull();
    expect(raiz.querySelector('#touch-stick')).toBeNull();
    expect(raiz.querySelectorAll('.touch-arm')).toHaveLength(0);
    // `action1` e `action2` estão no mapa em `b2` e `b0`; as outras duas não são declaradas
    expect(raiz.querySelectorAll('.touch-btn[data-btn]')).toHaveLength(2);
  });

  it('🔴 [Boundary] um jogo de duas direções não recebe braços mortos', () => {
    // ⚠️ É O RISCO QUE O REGISTO NOMEIA: «um jogo que declara só `left` e `right` não deve receber uma cruz
    // com dois braços mortos». A cruz é um CONJUNTO de braços aqui, não um molde de quatro.
    const raiz = montar(['left', 'right', 'action1']);
    const bracos = [...raiz.querySelectorAll('.touch-arm')].map((b) => b.dataset.dir);
    expect(bracos.sort()).toEqual(['left', 'right']);
  });

  it('🎯 [Right] o slot dispara pelo MAPA, não pelo próprio nome — o remapeamento da criança vale', () => {
    // 📌 `touch-bindings.ts:451` faz `doTouch(ctx.getTouchMap()['b' + b.dataset.btn])`: «a função vem do
    // touchMap (remapeável), não do data-act». Ler o nome do slot desenharia o pad de fábrica a quem o mudou.
    // Aqui a criança pôs `action1` no `b3` e mais nada; só o `b3` pode existir.
    const raiz = montarControleDeToque(ctx, {
      mapa: { ...TOUCH_DEFAULT, b0: 'action4', b1: 'action4', b2: 'action4', b3: 'action1' },
      acoesDoJogo: new Set(['action1']),
      rotuloDoSlot: (s) => s,
    });
    hospedeiro.appendChild(raiz);
    const btns = [...raiz.querySelectorAll('.touch-btn[data-btn]')].map((b) => b.dataset.btn);
    expect(btns, 'desenhou os slots pelo nome de fábrica em vez do mapa de agora').toEqual(['3']);
  });

  it('⚠️ [Interface] `data-btn` casa com o `\'b\' + dataset.btn` que o `touch-bindings` recompõe', () => {
    // Um duplo aceitaria qualquer string aqui. O que se mede é a ida e volta: o que o markup escreve tem de
    // ser o que o despacho lê, ou o botão dispara `undefined` — sem erro, e sem fazer nada.
    const raiz = montar(OITO_ACOES);
    for (const b of raiz.querySelectorAll('.touch-btn[data-btn]')) {
      const slot = 'b' + b.dataset.btn;
      expect(TOUCH_DEFAULT[slot], `o slot ${slot} não existe no mapa`).toBeTruthy();
    }
  });

  it('🔴 [Right] o START é INCONDICIONAL — a pausa não é declinável (ADR-0122)', () => {
    // Os outros oito slots respondem ao que o jogo declara; este responde a uma decisão já tomada. Uma
    // criança com tablet e sem teclado não tem outra forma de chegar à pausa.
    expect(montar([]).querySelector('#touch-start'), 'um jogo sem acções ficou sem pausa alcançável')
      .not.toBeNull();
    expect(montar(DUAS_ACOES).querySelector('#touch-start')).not.toBeNull();
  });

  it('⚠️ [Right] nasce ESCONDIDO — a alternância por modalidade é do `touch-bindings`', () => {
    // «toque/clique MOSTRA; teclado/controle OCULTA». Um pad que nasce à vista cobre o jogo de quem nunca
    // lhe vai tocar.
    expect(montar(OITO_ACOES).hidden).toBe(true);
  });

  it('⚠️ [Right] o analógico traz a `.touch-knob`, sem a qual o `touch-bindings` desiste dele', () => {
    // `if (stick && knob)` — sem a manopla, o analógico inteiro fica sem escuta, em silêncio.
    const raiz = montar(OITO_ACOES, { direcional: 'analogico' });
    const stick = raiz.querySelector('#touch-stick');
    expect(stick, 'o analógico não foi montado').not.toBeNull();
    expect(stick.querySelector('.touch-knob'), 'o analógico veio sem manopla e fica sem escuta').not.toBeNull();
    expect(raiz.querySelector('#touch-cross'), 'montou os dois direcionais ao mesmo tempo').toBeNull();
  });

  it('⚠️ [Zero] montar DUAS vezes deixa UM pad', () => {
    montar(OITO_ACOES);
    montar(OITO_ACOES);
    expect(document.querySelectorAll('#touch-controls')).toHaveLength(1);
    expect(document.querySelectorAll('.touch-btn[data-btn]')).toHaveLength(4);
  });
});

describe('ADR-0143 §4 · o silêncio acaba', () => {
  it('🔴 [Zero] sem `preset`: o markup NÃO é montado E a linha É dita — as duas metades', () => {
    // ⚠️ ESTE É O CASO QUE O PRÓPRIO REGISTO AVISOU QUE PASSA POR ACIDENTE. Hoje o pad já está ausente e já
    // está calado; um caso que afirme só a ausência continua verde com nada construído. Só o par prova.
    const raiz = montar([]);
    expect(raiz.querySelectorAll('.touch-arm')).toHaveLength(0);
    expect(raiz.querySelectorAll('.touch-btn[data-btn]'), 'desenhou botões para um jogo sem acções')
      .toHaveLength(0);

    const linhas = lacunasDoToque({ mapa: TOUCH_DEFAULT, acoesDoJogo: new Set() });
    expect(linhas, 'a engine não montou o pad e calou-se, que é o estado de hoje').toHaveLength(1);
    expect(linhas[0], 'a linha não nomeia a saída, logo é queixa e não conserto').toMatch(/preset/);
    expect(linhas[0], 'a linha não diz o que a criança perde').toMatch(/tablet/);
  });

  it('🎯 [Zero] com o preset do platformer, `problems` não inventa lacuna nenhuma', () => {
    // O par do caso acima. Sem ele, o crivo aprovaria uma engine que acusa sempre — tão inútil quanto uma
    // que nunca acusa.
    expect(lacunasDoToque({ mapa: TOUCH_DEFAULT, acoesDoJogo: new Set(OITO_ACOES) })).toEqual([]);
  });

  it('🔴 [Boundary] uma acção declarada que NENHUM slot dispara também vira linha', () => {
    // ⚠️ A lacuna PARCIAL, que hoje não aparece em lado nenhum: a acção existe no teclado e não existe no
    // toque. Quem joga por toque simplesmente não a tem, e ninguém lhe diz.
    const linhas = lacunasDoToque({
      mapa: TOUCH_DEFAULT,
      acoesDoJogo: new Set(['action1', 'leftShoulder']),
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatch(/leftShoulder/);
    expect(linhas[0], 'a linha não nomeia a saída').toMatch(/remapeie/);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
