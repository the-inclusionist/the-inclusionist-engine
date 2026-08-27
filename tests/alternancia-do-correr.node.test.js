// SPDX-License-Identifier: AGPL-3.0-or-later
// A ALTERNÂNCIA DO BOTÃO DE CORRER — correr deixa de ser "segurar" e vira ESTADO (pedido do Dev).
//
// ========================= POR QUE ISTO EXISTE =========================
// A alternância de MOVIMENTO já resolvia metade do problema: "para quem não consegue manter pressionado
// (1 dedo): toque a direção para andar sem segurar". Metade, porque o botão de CORRER continuava exigindo
// exatamente o que ela dispensa — manter pressionado. Quem toca com um dedo andava sem segurar e não corria.
//
// Com a alternância do correr, o botão vira trava: aperta liga a corrida, aperta de novo desliga.
//
// ⚠️ E ISSO TIRA UMA FUNÇÃO DO BOTÃO. Hoje a BORDA do Correr é o que gruda e solta na parede com o poder de
// aranha (`updateCling`). Se a borda passa a significar "liga/desliga corrida", grudar precisa de outra
// porta — e a porta é o PULO EM CONTEXTO: no ar, encostado numa parede, com o poder de aranha, o pulo gruda
// em vez de pular. Fora desse contexto o pulo continua pulando.
//
// A escolha do contexto não é arbitrária: no ar, encostado na parede e com o poder ligado, PULAR não tinha o
// que fazer de útil — o pulo aéreo já está gasto. É o momento em que o botão está ocioso, e por isso ele pode
// receber a função sem tirar nada.
//
// ========================= O QUE FICA DE FORA, DITO AQUI =========================
// O Dev descreveu também o objeto que se segura e se arremessa. Esse mecanismo NÃO EXISTE no jogo — não há
// pegar, carregar nem arremessar em lugar nenhum. O contrato dele está registrado em issue; aqui só entra o
// que dá para verificar hoje.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { correndoAgora, pularVaiGrudar } from '../app/js/game/run-toggle.js';

/** Um jogador mínimo para a decisão. */
const pl = (o = {}) => ({ toggleRun: false, runLatch: false, runEdge: false, easy: false, toggleMove: false, ...o });

describe('alternância do correr · a trava, e o que ela desloca', () => {
  it('[Right] SEM a alternância, correr é enquanto se SEGURA — verbatim do que já valia', () => {
    expect(correndoAgora(pl(), true)).toBe(true);
    expect(correndoAgora(pl(), false)).toBe(false);
  });

  it('[Right] COM a alternância, correr é ESTADO e a tecla segurada não conta', () => {
    // A inversão é o ponto: quem usa a alternância não consegue manter pressionado, então "segurando" não
    // pode ser a pergunta. O que vale é a trava.
    expect(correndoAgora(pl({ toggleRun: true, runLatch: true }), false)).toBe(true);
    expect(correndoAgora(pl({ toggleRun: true, runLatch: false }), true)).toBe(false);
  });

  it('[Right] o Modo Fácil continua vencendo — ele não corre, com ou sem trava', () => {
    // `easy` desliga a corrida por decisão pedagógica, e a trava não pode furá-la pela porta dos fundos.
    expect(correndoAgora(pl({ easy: true }), true)).toBe(false);
    expect(correndoAgora(pl({ toggleRun: true, runLatch: true, easy: true }), false)).toBe(false);
  });

  it('[Boundary] a alternância de MOVIMENTO continua desligando a corrida', () => {
    // Regra que já existia: com `toggleMove`, segurar é "ir mais rápido" e não corrida. As duas alternâncias
    // convivem, e a de movimento é quem manda sobre correr.
    expect(correndoAgora(pl({ toggleMove: true, toggleRun: true, runLatch: true }), false)).toBe(false);
  });

  it('[Right] com a trava, o PULO gruda quando o contexto pede', () => {
    const ctx = { noAr: true, encostado: true, temAranha: true, jaGrudado: false };
    expect(pularVaiGrudar(pl({ toggleRun: true }), ctx)).toBe(true);
  });

  it('[Right] e SOLTA quando já está grudado', () => {
    // Sem isto o modo vira armadilha: a criança gruda e não tem como descer sem soltar o botão de correr,
    // que agora significa outra coisa.
    const ctx = { noAr: true, encostado: false, temAranha: true, jaGrudado: true };
    expect(pularVaiGrudar(pl({ toggleRun: true }), ctx)).toBe(true);
  });

  it('[Boundary] fora do contexto, o pulo é PULO — a função nova não come a antiga', () => {
    const base = { noAr: true, encostado: true, temAranha: true, jaGrudado: false };
    expect(pularVaiGrudar(pl({ toggleRun: true }), { ...base, noAr: false }), 'no chão o pulo tem de pular').toBe(false);
    expect(pularVaiGrudar(pl({ toggleRun: true }), { ...base, encostado: false }), 'longe da parede o pulo tem de pular').toBe(false);
    expect(pularVaiGrudar(pl({ toggleRun: true }), { ...base, temAranha: false }), 'sem o poder o pulo tem de pular').toBe(false);
  });

  it('[Zero] SEM a alternância, o pulo NUNCA gruda — grudar continua sendo do Correr', () => {
    // O caminho de quem não liga o ajuste não pode mudar em nada. Quem joga com controle físico continua
    // grudando com o Correr, exatamente como antes.
    const ctx = { noAr: true, encostado: true, temAranha: true, jaGrudado: false };
    expect(pularVaiGrudar(pl({ toggleRun: false }), ctx)).toBe(false);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · fazendo `correndoAgora` ignorar `easy` → "[Right] o Modo Fácil continua vencendo" reprova.
//   · fazendo `pularVaiGrudar` devolver `true` sem checar `toggleRun` → "[Zero] SEM a alternância" reprova, e
//     o efeito real seria roubar o pulo de quem nunca pediu o ajuste.
//   · tirando o ramo do `jaGrudado` → "[Right] e SOLTA quando já está grudado" reprova, e o modo vira a
//     armadilha que o ADR-0044 passou sete itens desfazendo.
