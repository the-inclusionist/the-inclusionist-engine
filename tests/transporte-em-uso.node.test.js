// SPDX-License-Identifier: AGPL-3.0-or-later
// AS QUATRO REGRAS DO ADR-0109 §1, testadas como o que são: um AUTÓMATO.
//
// ⚠️ SEQUÊNCIAS E NÃO CHAMADAS SOLTAS. Estas regras são sobre o que acontece DEPOIS de outra coisa ter
// acontecido — «apertar uma tecla DEVOLVE o teclado» só quer dizer alguma coisa se antes se tinha saído dele.
// Um caso que chama uma função uma vez mede a função; o que faz a criança tropeçar é a ordem.
//
// ⚠️ E O CASO QUE MAIS IMPORTA É O DA CÂMERA. O §4 diz que ela liga a alternância para todos e que não há
// como desligar — e a forma como isso falha não é um erro: é uma criança que joga por webcam, toca na tela
// uma vez, e fica sem a alternância de que depende. Silencioso, e no meio da partida.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  PADRAO, alternanciaAgora, aposAresta, habilitarAssistida, desabilitarAssistida,
  EXIGEM_HABILITACAO, COM_ALTERNANCIA_PROPRIA,
} from '../app/js/input/transporte-em-uso.js';

/** Corre uma sequência de arestas a partir do padrão, e devolve o estado final. */
const correr = (...origens) => origens.reduce(aposAresta, PADRAO);

describe('ADR-0109 §1 · a alternância segue o aparelho em uso', () => {
  it('[Right] REGRA 1 — por padrão, teclado e controle, ambos SEM alternância', () => {
    expect(alternanciaAgora(PADRAO)).toBe(false);
    expect(alternanciaAgora(correr('gamepad'))).toBe(false);
    expect(alternanciaAgora(correr('teclado'))).toBe(false);
  });

  it('⚠️ [Right] REGRA 2 — tocar na tela liga os controles de tela COM alternância', () => {
    expect(alternanciaAgora(correr('toque'))).toBe(true);
  });

  it('⚠️ [Right] REGRA 3 — apertar tecla DEVOLVE o teclado sem alternância; o controle também', () => {
    // A regra só existe como sequência: sair do teclado, e voltar. Uma chamada solta não a exprime.
    expect(alternanciaAgora(correr('toque', 'teclado'))).toBe(false);
    expect(alternanciaAgora(correr('toque', 'gamepad'))).toBe(false);
    // E a ida e volta várias vezes — é o caps-lock com memória: cada aparelho lembra o seu.
    expect(alternanciaAgora(correr('toque', 'teclado', 'toque'))).toBe(true);
    expect(alternanciaAgora(correr('toque', 'teclado', 'toque', 'gamepad'))).toBe(false);
  });

  it('⚠️ [Zero] REGRA 4 — com a assistida ligada, NENHUM aparelho desliga a alternância', () => {
    // O caso cuja falha tranca uma criança fora do próprio jogo. Ela joga por webcam, toca na tela uma vez,
    // e sem esta regra fica sem a alternância de que depende — no meio da partida e sem nada o dizer.
    const ligada = habilitarAssistida(PADRAO);
    for (const t of ['teclado', 'gamepad', 'toque', 'olhos', 'rosto', 'gestos', 'fala']) {
      expect(alternanciaAgora(aposAresta(ligada, t)), `${t} desligou a alternância da assistida`).toBe(true);
    }
    // E ao longo de uma sequência inteira, não só de uma aresta.
    const depois = ['teclado', 'toque', 'gamepad', 'teclado'].reduce(aposAresta, ligada);
    expect(alternanciaAgora(depois)).toBe(true);
  });

  it('⚠️ [Zero] uma ARESTA de transporte assistido NÃO o habilita — habilitar é acto explícito', () => {
    // Um falso positivo da webcam (uma sombra, um segundo rosto a passar) trancaria a alternância de toda a
    // gente sem ninguém ter pedido. O §4 diz «precisam ser habilitados», e isto é essa palavra.
    for (const t of EXIGEM_HABILITACAO) {
      expect(aposAresta(PADRAO, t).assistidaLigada, `${t} habilitou-se sozinho`).toBe(false);
      expect(alternanciaAgora(aposAresta(PADRAO, t)), `${t} ligou a alternância sem habilitação`).toBe(false);
    }
  });

  it('[Right] habilitar é idempotente, e desabilitar existe — mas não é oferecido à criança', () => {
    const ligada = habilitarAssistida(PADRAO);
    expect(habilitarAssistida(ligada)).toBe(ligada); // MESMO objecto: sem mudança, sem cópia
    expect(alternanciaAgora(desabilitarAssistida(ligada))).toBe(false);
    expect(desabilitarAssistida(PADRAO)).toBe(PADRAO);
  });

  it('[Boundary] uma aresta do transporte que já está em uso não cria estado novo', () => {
    const s = correr('toque');
    expect(aposAresta(s, 'toque')).toBe(s); // identidade, não igualdade
  });

  it('⚠️ [Interface] as duas listas não se sobrepõem — um transporte não pode ter duas regras', () => {
    // Se `toque` entrasse em `EXIGEM_HABILITACAO`, ele deixaria de ligar a alternância até ser habilitado, e
    // a regra 2 morreria em silêncio. As listas dizem coisas diferentes e têm de continuar disjuntas.
    for (const t of COM_ALTERNANCIA_PROPRIA) {
      expect(EXIGEM_HABILITACAO.has(t), `${t} está nas duas listas`).toBe(false);
    }
    expect([...COM_ALTERNANCIA_PROPRIA]).toEqual(['toque']);
    expect([...EXIGEM_HABILITACAO].sort()).toEqual(['fala', 'gestos', 'olhos', 'rosto']);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · ⚠️ INVERTENDO as duas linhas de `alternanciaAgora` (o `emUso` antes da assistida) -> reprova a REGRA 4.
//     E a mutacao que mais interessa de todo o ficheiro: e o defeito que tranca uma crianca fora do jogo, e
//     nao da erro nenhum — ela toca na tela, volta ao teclado, e a alternancia de que depende desapareceu.
//   · `alternanciaAgora` a devolver so `COM_ALTERNANCIA_PROPRIA.has(...)` (sem a assistida) -> reprova a
//     REGRA 4 tambem, pelo outro lado.
//   · `aposAresta` a habilitar a assistida quando a origem esta em `EXIGEM_HABILITACAO` -> reprova "uma
//     ARESTA nao habilita". E a leitura ingenua da regra 4, e a que um falso positivo da webcam explora.
//   · `aposAresta` a ignorar a origem (devolver sempre o estado) -> reprovam as REGRAS 2 e 3.
//   · `PADRAO` com `emUso: 'toque'` -> reprova a REGRA 1: o padrao passaria a ter alternancia, que e
//     exactamente o contrario do que o ADR diz.
//   · pondo `'toque'` em `EXIGEM_HABILITACAO` -> reprovam a REGRA 2 e o caso das listas disjuntas.
