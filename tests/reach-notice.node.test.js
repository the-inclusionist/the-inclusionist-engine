// SPDX-License-Identifier: AGPL-3.0-or-later
// AS FRASES DO AVISO DE ALCANCE (issue #112). A tela é aferida no project browser; aqui é o TEXTO, que é a
// parte que precisa de ser lida com cuidado e traduzida para três idiomas.
//
// ⚠️ O QUE ESTE AVISO EXISTE PARA IMPEDIR: o controle de tela tem NOVE lugares e o vocabulário passou a
// CATORZE. Num tablet de escola pública o toque não é o caminho alternativo — é o único. Sem a frase, a
// criança descobre no meio da partida que não alcança uma ação e conclui que o jogo está partido, sem ter
// como saber que não está.
import { describe, it, expect } from 'vitest';
import { linhasDoAviso } from '../app/js/ui/reach-notice.js';
import { alcance, transportesPadrao } from '../app/js/input/transports.js';
import { ACTIONS } from '../app/js/core/actions.js';
import pt from '../app/js/i18n/pt.js';

/** Um tradutor de teste que devolve a CHAVE e os parâmetros — assim os casos falam de estrutura, não de prosa. */
const cru = (k, p) => (p ? `${k}(${Object.entries(p).map(([a, b]) => `${a}=${b}`).join(',')})` : k);

/** E um que usa o dicionário de verdade, para os casos que precisam de afirmar a frase. */
const real = (k, p) => {
  let s = pt[k];
  if (s === undefined) throw new Error(`chave i18n ausente: ${k}`);
  for (const [a, b] of Object.entries(p ?? {})) s = s.split(`{${a}}`).join(String(b));
  return s;
};

const sempre = () => true, nunca = () => false;
const TABLET = transportesPadrao({ gamepad: nunca, teclado: nunca, toque: sempre });
const DESKTOP = transportesPadrao({ gamepad: nunca, teclado: sempre, toque: nunca });

describe('quando NÃO há o que dizer, não se diz nada', () => {
  it('[Zero] alcance ok devolve zero linhas — um aviso que aparece sempre deixa de ser lido', () => {
    expect(linhasDoAviso(alcance(DESKTOP, ACTIONS), cru)).toEqual([]);
  });

  it('[Boundary] e um jogo cujas ações CABEM no toque também não avisa', () => {
    const nove = ACTIONS.slice(0, 9);
    expect(linhasDoAviso(alcance(TABLET, nove), cru)).toEqual([]);
  });
});

describe('quando há, a informação é ACIONÁVEL — não «faltam lugares»', () => {
  it('[Right] diz quantas o jogo pede, quem está curto com quantos lugares, e o que resolveria', () => {
    const linhas = linhasDoAviso(alcance(TABLET, ACTIONS), cru);
    expect(linhas).toEqual([
      `reach.titulo(pedidas=${ACTIONS.length})`,
      'reach.curto(transporte=reach.nome.toque,lugares=9)',
      'reach.ligue(saida=reach.nome.gamepadreach.oureach.nome.teclado)',
    ]);
  });

  it('[Right] e em português sai uma frase que uma criança consegue seguir', () => {
    const linhas = linhasDoAviso(alcance(TABLET, ACTIONS), real);
    expect(linhas[0]).toBe('Este jogo usa 14 ações.');
    expect(linhas[1]).toBe('O controle de tela tem 9 lugares — não chegam para todas.');
    expect(linhas[2]).toBe('Ligue controle ou teclado e você joga com todas.');
  });

  it('[Zero] ⚠️ quando NADA resolveria, a frase é OUTRA — mandar ligar um controle seria mentir', () => {
    // O jogo pede mais posições do que qualquer transporte deste aparelho oferece. Aqui o problema é do JOGO,
    // e dizer «ligue um controle» mandaria a criança procurar uma coisa que não conserta nada.
    const demais = [...ACTIONS, ...ACTIONS, ...ACTIONS]; // 42 posições: acima até do gamepad
    const linhas = linhasDoAviso(alcance(transportesPadrao({ gamepad: sempre, teclado: sempre, toque: sempre }), demais), cru);
    expect(linhas).toContain('reach.semSaida');
    expect(linhas.some((l) => l.startsWith('reach.ligue'))).toBe(false);
  });

  it('[Interface] todas as chaves usadas EXISTEM no dicionário base', () => {
    // O tradutor `real` lança em chave ausente, então isto é a asserção. Uma chave que falta não dá erro no
    // navegador — dá a chave crua na tela, ou uma frase vazia num leitor de tela, que é pior.
    expect(() => linhasDoAviso(alcance(TABLET, ACTIONS), real)).not.toThrow();
    expect(() => linhasDoAviso(alcance(transportesPadrao({ gamepad: sempre, teclado: sempre, toque: sempre }),
      [...ACTIONS, ...ACTIONS, ...ACTIONS]), real)).not.toThrow();
  });
});
