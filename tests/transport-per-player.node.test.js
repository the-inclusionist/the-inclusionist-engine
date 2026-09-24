// SPDX-License-Identifier: AGPL-3.0-or-later
// O TRANSPORTE EM USO, POR JOGADOR — a metade que faltava entre o autómato e a alternância (ADR-0109/0113).
//
// ========================= O QUE ESTA PEÇA É, E ONDE ELA MORA =========================
// O `input/transport-in-use` é o autómato PURO: recebe um estado e uma aresta, devolve o estado novo, e não
// guarda nada. O `input/latch-store` sabe ler e gravar a alternância DE UM TRANSPORTE. Faltava quem soubesse
// QUAL transporte é o de cada jogador — e é isto.
//
// ⚠️ VIVE NO `input/state` E NÃO NO `PlayerBase`, e a escolha foi medida contra o que já existe: este módulo
// já guarda estado de entrada por jogador exactamente com esta forma (`padCur: Record<number, PadState>`).
// Pô-lo no `PlayerBase` fá-lo-ia parte do CONTRATO, e trezentos cartuchos passariam a declarar um campo sobre
// o qual não decidem nada — mais uma quebra num major que já tem vinte e três.
//
// 📌 O que o jogador CARREGA continua a ser a alternância resolvida (`toggleMove`), que é o que a física lê.
// Isto é o que está a montante dela.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  inputOf, playerEdge, enableAssistedFor, disableAssistedFor, forgetInputs, releaseAllKeys,
} from '../app/js/input/state.js';
import { PADRAO } from '../app/js/input/transport-in-use.js';

beforeEach(() => { forgetInputs(); });

describe('entrada por jogador · quem nunca tocou em nada tem uma resposta', () => {
  // ⚠️ `PADRAO` E NÃO `undefined`, e o contraste com o `sourceOf` do mesmo módulo é deliberado: ali «não sei»
  // é honesto porque a pergunta é sobre uma TECLA que já existe; aqui a pergunta é sobre um JOGADOR, e um
  // jogador que ainda não tocou em nada está mesmo no teclado sem assistida.
  it('[Zero] jogador desconhecido responde o PADRÃO, e não `undefined`', () => {
    expect(inputOf(0)).toEqual(PADRAO);
    expect(inputOf(7)).toEqual(PADRAO);
  });

  it('[Interface] o padrão é teclado, sem assistida', () => {
    expect(inputOf(0).inUse).toBe('teclado');
    expect(inputOf(0).assistedOn).toBe(false);
  });
});

describe('entrada por jogador · a aresta troca o transporte, e só o daquele jogador', () => {
  it('[Right] a aresta define o transporte em uso', () => {
    playerEdge(0, 'toque');
    expect(inputOf(0).inUse).toBe('toque');
  });

  // 🎯 O CASO QUE DÁ SENTIDO AO `Record` — sem separação por jogador, a criança do segundo assento herdaria o
  // aparelho da primeira, e com ele a alternância dela.
  it('🎯 [Right] dois jogadores, dois aparelhos, e nenhum lê o do outro', () => {
    playerEdge(0, 'teclado');
    playerEdge(1, 'gamepad');
    expect(inputOf(0).inUse).toBe('teclado');
    expect(inputOf(1).inUse).toBe('gamepad');
    playerEdge(1, 'toque');
    expect(inputOf(0).inUse, 'a aresta do jogador 1 mexeu no jogador 0').toBe('teclado');
  });

  it('📌 [Right] sem mudança, o MESMO objecto volta — não se aloca por quadro', () => {
    playerEdge(0, 'toque');
    const antes = inputOf(0);
    playerEdge(0, 'toque');
    expect(inputOf(0), 'uma aresta repetida alocou um estado novo').toBe(antes);
  });
});

describe('entrada por jogador · habilitar a assistida é um acto explícito (ADR-0109 regra 4)', () => {
  // ⚠️ A REGRA INTEIRA NUMA SEQUÊNCIA: uma aresta de um transporte assistido NÃO o habilita. Um falso
  // positivo da webcam — uma sombra, um segundo rosto a passar — trancaria a alternância de toda a gente.
  it('⚠️ [Zero] uma aresta de `olhos` NÃO habilita a assistida', () => {
    playerEdge(0, 'olhos');
    expect(inputOf(0).inUse).toBe('olhos');
    expect(inputOf(0).assistedOn, 'a webcam habilitou-se sozinha').toBe(false);
  });

  it('[Right] habilitada, ela sobrevive a arestas de outros aparelhos', () => {
    enableAssistedFor(0);
    playerEdge(0, 'teclado');
    expect(inputOf(0).inUse, 'a tecla devolveu o teclado, como manda a regra 3').toBe('teclado');
    expect(inputOf(0).assistedOn, 'uma tecla desligou a assistida de quem depende dela').toBe(true);
  });

  it('[Right] desabilitar é a outra metade, e é simétrica', () => {
    enableAssistedFor(0);
    disableAssistedFor(0);
    expect(inputOf(0).assistedOn).toBe(false);
  });

  // ⚠️ ESTE PAR NASCEU DE UMA MUTAÇÃO SOBREVIVENTE, e o buraco era real. O caso era só «habilitar o 0 não
  // habilita o 1» — e `enableAssistedFor` a escrever SEMPRE no jogador 0 passava, porque o 1 continuava
  // desligado pela razão errada. Faltava a outra ponta: que habilitar o 1 habilite MESMO o 1.
  it('[Zero] habilitar um jogador não habilita o outro — nos DOIS sentidos', () => {
    enableAssistedFor(0);
    expect(inputOf(0).assistedOn).toBe(true);
    expect(inputOf(1).assistedOn).toBe(false);

    forgetInputs();
    enableAssistedFor(1);
    expect(inputOf(1).assistedOn, 'habilitar o jogador 1 não chegou ao jogador 1').toBe(true);
    expect(inputOf(0).assistedOn).toBe(false);
  });
});

describe('entrada por jogador · o que o `blur` NÃO faz', () => {
  // 🔴 O CASO QUE PROTEGE UMA CRIANÇA CONCRETA. O `releaseAllKeys` é o `blur` da janela: as teclas deixaram mesmo
  // de estar premidas. Mas ninguém trocou de aparelho por mudar de separador — e zerar o transporte em uso ali
  // devolveria toda a gente ao teclado. Quem joga por olhar perderia a alternância no meio da partida, sem
  // erro e sem nada na tela a dizê-lo.
  it('🔴 [Zero] `soltarTodas` solta as teclas e NÃO esquece o aparelho em uso', () => {
    playerEdge(0, 'olhos');
    enableAssistedFor(0);
    releaseAllKeys();
    expect(inputOf(0).inUse, 'o blur devolveu a criança ao teclado').toBe('olhos');
    expect(inputOf(0).assistedOn, 'o blur desligou a assistida').toBe(true);
  });

  // 📌 O PAR: e existe uma porta que ESQUECE, para o fim de uma partida, onde a pergunta se põe de novo.
  it('📌 [Right] `esquecerEntradas` devolve toda a gente ao padrão', () => {
    playerEdge(0, 'gamepad');
    playerEdge(1, 'toque');
    forgetInputs();
    expect(inputOf(0)).toEqual(PADRAO);
    expect(inputOf(1)).toEqual(PADRAO);
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-08, por script, com contagem de ocorrências) =====
// 1. `inputOf` a devolver `entradaPorJogador[jogador]` cru      → [Zero] do desconhecido reprova (undefined)
// 2. `playerEdge` a escrever num sítio só (sem o índice)     → 🎯 o caso dos DOIS JOGADORES reprova
// 3. `releaseAllKeys` a chamar `forgetInputs`                    → 🔴 o caso do BLUR reprova, que é o defeito
//    que ele existe para impedir: a criança que joga por olhar volta ao teclado ao mudar de separador
// 4. `enableAssistedFor` a marcar o jogador 0 sempre           → 🔴 SOBREVIVEU À PRIMEIRA VOLTA, e era
//    BURACO e não equivalência. O caso afirmava só «habilitar o 0 não habilita o 1», e escrever sempre no 0
//    passava — porque o 1 continuava desligado pela razão errada. Com a outra ponta acrescentada (habilitar
//    o 1 chega MESMO ao 1), a mesma mutação reprova. É a mutação a achar o que a leitura não achou.
// 5. `afterEdge` a habilitar a assistida quando a origem é dela  → ⚠️ o [Zero] da webcam reprova
