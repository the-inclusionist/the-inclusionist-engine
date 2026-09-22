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
import { mountTouchControls, touchGaps } from '../app/js/input/touch.js';
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
  const raiz = mountTouchControls(ctx, {
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

  it('🔴 [Right] duas acções e nenhuma direção: DOIS botões e NENHUM braço (ADR-0162)', () => {
    // O ADR-0157 dava o mínimo a todo jogo (direções e quatro botões); o Dev: «Vale para todos os botões: somente
    // aparecem se o jogo os nomeia.»
    const raiz = montar(DUAS_ACOES, { direcional: 'cruz' });
    expect(raiz.querySelectorAll('.touch-arm'), 'um braço que o jogo não nomeou').toHaveLength(0);
    expect(raiz.querySelector('#touch-cross'), 'uma cruz sem braço nenhum').toBeNull();
    expect(raiz.querySelectorAll('.touch-btn[data-btn]')).toHaveLength(2);
  });

  it('🔴 [Right] the FACE shows the button\'s NAME, never the cartridge\'s word; the accessible name holds both (ADR-0165)', () => {
    // The Dev: «Botões 2 e 3 devem continuar sendo 2 e 3, confirm e back não são seus nomes, mas suas funções atribuídas
    // pelo cartucho.» Measured before: the quiz's pad wrote «Confirm» and «Back» on the faces of 2 and 3.
    const slotDe = (acao) => Object.keys(TOUCH_DEFAULT).find((s) => TOUCH_DEFAULT[s] === acao);
    const FUNCOES = { action2: 'Confirm', action3: 'Back', leftShoulder: 'Page', up: 'Climb' };
    const raiz = mountTouchControls(ctx, {
      mapa: TOUCH_DEFAULT,
      acoesDoJogo: new Set(Object.keys(FUNCOES)),
      rotuloDoSlot: (s) => FUNCOES[TOUCH_DEFAULT[s]] ?? (s === 'start' ? 'START' : s === 'select' ? 'SELECT' : ''),
      direcional: 'cruz',
    });
    hospedeiro.appendChild(raiz);
    const botao = (acao) => raiz.querySelector(`[data-btn="${slotDe(acao).slice(1)}"]`);
    expect(botao('action2').textContent, 'the face shows the function').toBe('2');
    expect(botao('action3').textContent).toBe('3');
    expect(botao('leftShoulder').textContent).toBe('L1');
    expect(botao('action2').getAttribute('aria-label')).toBe('2, Confirm');
    expect(botao('leftShoulder').getAttribute('aria-label')).toBe('L1, Page');
    expect(botao('action2').dataset.acao, 'the button does not say which action places it').toBe('action2');
    // a direction keeps its direction name (in the language of the moment) and says its function after it
    expect(raiz.querySelector('.dpad-up').getAttribute('aria-label')).toMatch(/^Cima, Climb$/);
    // SELECT and START: name and function are the same word, said once
    expect(raiz.querySelector('#touch-start').textContent).toBe('START');
    expect(raiz.querySelector('#touch-start').getAttribute('aria-label')).toBe('START');
    expect(raiz.textContent, 'a function word reached a face').not.toMatch(/Confirm|Back|Page/);
  });

  it('⚠️ [Right] a REMAPPED slot takes the name of the action it now fires — the name follows the place', () => {
    const slot = Object.keys(TOUCH_DEFAULT).find((s) => TOUCH_DEFAULT[s] === 'action2');
    const raiz = montar(['action4'], { mapa: { ...TOUCH_DEFAULT, [slot]: 'action4' } });
    expect([...raiz.querySelectorAll('.touch-btn[data-btn]')].map((b) => b.textContent)).toContain('4');
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
  it('🔴 [Zero] sem `preset`: só SELECT e START, E a linha diz o que falta (ADR-0162)', () => {
    const raiz = montar([], { direcional: 'cruz' });
    expect(raiz.querySelectorAll('.touch-arm')).toHaveLength(0);
    expect(raiz.querySelectorAll('.touch-btn[data-btn]')).toHaveLength(0);
    expect(raiz.querySelector('#touch-start')).not.toBeNull();
    const linhas = touchGaps({ mapa: TOUCH_DEFAULT, acoesDoJogo: new Set() });
    expect(linhas).toHaveLength(1);
    expect(linhas[0], 'a linha não nomeia a saída').toMatch(/preset/);
    expect(linhas[0], 'a linha não diz o que a criança perde').toMatch(/tablet/);
  });

  it('🎯 [Zero] com o preset do platformer, `problems` não inventa lacuna nenhuma', () => {
    // O par do caso acima. Sem ele, o crivo aprovaria uma engine que acusa sempre — tão inútil quanto uma
    // que nunca acusa.
    expect(touchGaps({ mapa: TOUCH_DEFAULT, acoesDoJogo: new Set(OITO_ACOES) })).toEqual([]);
  });

  it('🔴 [Boundary] uma acção declarada que NENHUM slot dispara também vira linha', () => {
    // ⚠️ A lacuna PARCIAL, que hoje não aparece em lado nenhum: a acção existe no teclado e não existe no
    // toque. Quem joga por toque simplesmente não a tem, e ninguém lhe diz.
    const linhas = touchGaps({
      mapa: TOUCH_DEFAULT,
      // ⚠️ `select` e não `leftShoulder`: desde o ADR-0160 os ombros TÊM slot, e o exemplo deixaria de ser exemplo
      acoesDoJogo: new Set(['action1', 'select']),
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatch(/select/);
    expect(linhas[0], 'a linha não nomeia a saída').toMatch(/remap a slot/);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   N1 the face shows the function again (ADR-0165)       🔴 name and remap cases
//   N2 the accessible name is the name only               🔴
//   N3 L1 and L2 swapped                                   🔴
//   N4 directions without a spoken name                   🔴
//   N5 the name read from the slot, not the action it fires 🔴
