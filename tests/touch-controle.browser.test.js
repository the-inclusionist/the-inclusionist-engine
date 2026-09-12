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

  it('🔴 [Right] o QUIZ recebe o MÍNIMO — quatro direções e quatro botões (ADR-0157)', () => {
    // 🔴 ERA O CONTRÁRIO (ADR-0143): «um quiz quer dois alvos grandes, não um direcional de plataforma». O Dev abriu o
    // quiz num ecrã de toque e não conseguiu andar em menu nenhum — o pad só tinha START. As direções e as acções 2 e 3
    // são o que os menus pedem, e existem num jogo que não as usa em jogo.
    const raiz = montar(DUAS_ACOES, { direcional: 'cruz' });
    expect(raiz.querySelectorAll('.touch-arm')).toHaveLength(4);
    expect(raiz.querySelectorAll('.touch-btn[data-btn]')).toHaveLength(4);
  });

  it('🎯 [Right] e cada botão recebe o nome que `rotuloDoSlot` lhe dá — o do jogo ou o do botão físico, decide a raiz', () => {
    const raiz = montarControleDeToque(ctx, {
      mapa: TOUCH_DEFAULT,
      acoesDoJogo: new Set(['action1']),
      rotuloDoSlot: (s) => (s === 'b2' ? 'Confirmar' : `face ${s}`),
    });
    hospedeiro.appendChild(raiz);
    const nomes = [...raiz.querySelectorAll('.touch-btn[data-btn]')].map((b) => b.textContent);
    expect(nomes).toContain('Confirmar');
    expect(nomes.filter((n) => n.startsWith('face'))).toHaveLength(3);
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
  it('🔴 [Zero] sem `preset`: o MÍNIMO é montado E a linha diz que faltam as palavras (ADR-0157)', () => {
    // As duas metades, como antes: o pad existe (senão ninguém anda nos menus por toque) e a lacuna diz-se (os botões
    // mostram as letras do controle físico, e uma criança não sabe o que cada um faz neste jogo).
    const raiz = montar([], { direcional: 'cruz' });
    expect(raiz.querySelectorAll('.touch-arm')).toHaveLength(4);
    expect(raiz.querySelectorAll('.touch-btn[data-btn]')).toHaveLength(4);
    const linhas = lacunasDoToque({ mapa: TOUCH_DEFAULT, acoesDoJogo: new Set() });
    expect(linhas).toHaveLength(1);
    expect(linhas[0], 'a linha não nomeia a saída').toMatch(/preset/);
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
