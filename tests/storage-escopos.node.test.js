// SPDX-License-Identifier: AGPL-3.0-or-later
// OS DOIS ESCOPOS DE PERSISTÊNCIA (project node: só lê a tabela de chaves, sem localStorage).
//
// O namespacing óbvio — um prefixo por jogo em TUDO — seria um defeito de acessibilidade grave, e é isso que
// estes casos guardam. Uma criança cega configura modo cego, bengala, voz e velocidade de narração; uma
// criança daltônica escolhe a correção; uma disléxica escolhe a fonte. Com um espaço de nomes por jogo, ela
// refaria tudo isso nos 35 jogos do catálogo — e quem mais depende dos ajustes é quem menos tem margem para
// refazê-los.
//
// A linha entre os escopos não é técnica, é de PERTENCIMENTO: o que é da CRIANÇA fica compartilhado, o que é
// da PARTIDA fica no jogo. Se alguém um dia "padronizar" prefixando tudo, estes casos reprovam.
import { describe, it, expect } from 'vitest';
import { KEYS, JOGO_ID, kJogo } from '../app/js/platform/storage.js';

/** Tudo que é do escopo DO JOGO. Curto de propósito: na dúvida, a chave é da criança. */
const DO_JOGO = ['activity', 'quizlevel', 'cenario', 'tabsel', 'fracnot'];

/** O que pertence à CRIANÇA e segue com ela de jogo em jogo. Amostra representativa, não a lista inteira. */
const DA_CRIANCA = [
  'modocego', 'caneDiv', 'onebtn', 'wheelchair', 'hearingloss',   // acessibilidade motora/auditiva
  'viz', 'cbsafe', 'outfg', 'outbg', 'lq',                        // visão
  'ttsEngine', 'ttsVoice', 'lang',                                // voz e idioma
  'letterCase', 'captions', 'fontKey',                            // comunicação e leitura
  'padDesign', 'touchmap', 'padBtnMm',                            // controles e toque
];

describe('escopo DO JOGO — o que é de uma partida', () => {
  it('[Right] tem o prefixo do jogo', () => {
    for (const k of DO_JOGO) expect(KEYS[k], k).toBe(kJogo(k === 'quizlevel' ? 'quizlevel' : k));
  });

  it('[Right] cada uma guarda o nome LEGADO — é como o ajuste de quem já jogava sobrevive', () => {
    // Sem isto a renomeação seria uma perda silenciosa: a criança abriria o jogo e encontraria o nível 2 de
    // fábrica no lugar do 5 que ela tinha alcançado, sem nada explicando.
    for (const k of DO_JOGO) {
      expect(KEYS[k + 'Legado'], k).toBeTruthy();
      expect(KEYS[k + 'Legado'], k).toMatch(/^incl_/);
    }
  });

  it('[Interface] a gravação da demonstração também é do jogo, e também herda', () => {
    expect(KEYS.attract('campo')).toBe(kJogo('attract_campo'));
    expect(KEYS.attractLegado('campo')).toBe('incl_attract_campo');
  });
});

describe('escopo COMPARTILHADO — o que é da criança', () => {
  it('[Right] NENHUM ajuste de acessibilidade leva prefixo de jogo', () => {
    // É o caso central deste arquivo. Se ele reprovar, alguém prefixou uma preferência da criança — e o
    // efeito, num catálogo de 35 jogos, é obrigá-la a reconfigurar tudo 35 vezes.
    const prefixadas = DA_CRIANCA.filter((k) => String(KEYS[k]).startsWith('incl.'));
    expect(prefixadas, 'preferência da criança com prefixo de jogo').toEqual([]);
  });

  it('[Right] e todas continuam no formato antigo, que é o que as mantém compartilhadas', () => {
    for (const k of DA_CRIANCA) expect(KEYS[k], k).toMatch(/^incl_/);
  });

  it('[Boundary] as chaves POR JOGADOR são da criança também — a tela 2 é uma criança, não um jogo', () => {
    for (const f of ['vizP', 'sinkP', 'easyP', 'rmWalkP']) {
      expect(KEYS[f](1), f).toMatch(/^incl_/);
      expect(KEYS[f](1), f).not.toMatch(/^incl\./);
    }
  });
});

describe('os dois escopos não se confundem', () => {
  it('[Zero] nenhuma chave está nas duas listas', () => {
    expect(DO_JOGO.filter((k) => DA_CRIANCA.includes(k))).toEqual([]);
  });

  it('[Interface] o id do jogo aparece no prefixo, e é um só', () => {
    expect(JOGO_ID).toBe('inclusionist');
    expect(kJogo('x')).toBe('incl.inclusionist.x');
  });
});
