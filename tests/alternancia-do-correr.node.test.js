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
import { correndoAgora, pularVaiGrudar, botaoDeCorrerEngatado, usaTravaDeCorrer, botaoDeGrude } from '../app/js/game/run-toggle.js';

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

  it('[Right] TECLAS DE ALTERNÂNCIA passam a correr pela trava — reversão do Dev, 2026-08-27', () => {
    // ⚠️ ESTE CASO AFIRMAVA O CONTRÁRIO. Até 27/08, `toggleMove` desligava a corrida inteira: segurar a direção
    // já era "ir mais rápido", e a corrida foi considerada substituída por isso.
    //
    // Ele decidiu o oposto, e a frase corrige a premissa: "Aperta o botão de corrida uma vez, liga a corrida,
    // aperta outra vez volta a andar." E o motivo é quem usa o modo: "Teclas de alternância não é só para quem
    // tem rigidez nas mãos e perde agilidade e destreza, mas para quem tem um ou mais dedos a menos e não
    // consegue manter apertado três botões ao mesmo tempo."
    //
    // Quem não tem dedos para segurar três botões não tem dedos para segurar o Correr. Tirar a corrida dessa
    // criança não é simplificar o controle dela — é dar-lhe um jogo mais lento e chamar isso de acessibilidade.
    expect(usaTravaDeCorrer(pl({ toggleMove: true })), 'teclas de alternância usam a TRAVA').toBe(true);
    expect(correndoAgora(pl({ toggleMove: true, runLatch: true }), false)).toBe(true);
    expect(correndoAgora(pl({ toggleMove: true, runLatch: false }), true), 'e segurar não conta').toBe(false);
  });

  it('[Right] a trava vale para todo modo de entrada que não seja teclado/gamepad no padrão', () => {
    // A regra do ADR-0033 é invertida de propósito: SEGURAR é a exceção. Hoje são dois campos; rosto, olhos e
    // voz (issue #11) entram nesta mesma função quando existirem, num lugar só.
    expect(usaTravaDeCorrer(pl()), 'modo padrão: segura').toBe(false);
    expect(usaTravaDeCorrer(pl({ toggleRun: true }))).toBe(true);
    expect(usaTravaDeCorrer(pl({ toggleMove: true }))).toBe(true);
  });

  it('[Boundary] e o grude migra JUNTO nas teclas de alternância — a borda do Correr foi ocupada lá também', () => {
    // Se a borda do Correr virou a trava, ela não pode continuar grudando. Sem esta linha, a criança em teclas
    // de alternância ficaria sem porta para grudar na parede — o beco que o ADR-0045 existe para não abrir.
    const ctx = { noAr: true, encostado: true, temAranha: true, jaGrudado: false };
    expect(pularVaiGrudar(pl({ toggleMove: true }), ctx)).toBe(true);
    expect(botaoDeGrude(pl({ toggleMove: true })), 'e a frase falada nomeia o PULO').toBe('act.jump');
  });

  it('[Right] a SONDAGEM da bengala segue a trava — senão o modo cego perde o tato', () => {
    // REGRESSÃO MINHA, achada seguindo o fio das frases faladas. Parado, SEGURAR o Correr é a sondagem da
    // bengala no modo cego: é assim que a criança varre o que está em volta sem andar. Com a alternância
    // ligada ela nunca segura — ela toca —, e a sondagem sumiria justamente para quem depende dela.
    //
    // E a pergunta é OUTRA que "está correndo": `easy` e `toggleMove` desligam a CORRIDA e não podem desligar
    // o tato. Por isso `botaoDeCorrerEngatado` existe separada — quem sonda é o botão engatado, não a corrida.
    expect(botaoDeCorrerEngatado(pl({ toggleRun: true, runLatch: true }), false), 'a trava tem de sondar').toBe(true);
    expect(botaoDeCorrerEngatado(pl(), true), 'segurar continua sondando sem o ajuste').toBe(true);
    expect(botaoDeCorrerEngatado(pl({ toggleRun: true, runLatch: false }), true)).toBe(false);
  });

  it('[Boundary] o Modo Fácil NÃO tira a sondagem — ele tira a corrida, e agora é o ÚNICO que tira', () => {
    // A distinção que o caso acima protege, escrita pelo avesso: usar `correndoAgora` para a sondagem teria
    // sido o conserto óbvio, e teria calado a bengala de toda criança em Modo Fácil.
    expect(botaoDeCorrerEngatado(pl({ easy: true }), true)).toBe(true);
    expect(correndoAgora(pl({ easy: true }), true), 'mas correr, esse continua desligado').toBe(false);
    expect(correndoAgora(pl({ easy: true, toggleMove: true, runLatch: true }), false),
      'e o Modo Fácil vence a trava, senão a decisão pedagógica teria porta dos fundos').toBe(false);
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
//   · usando `correndoAgora` no lugar de `botaoDeCorrerEngatado` para a sondagem → "[Boundary] o Modo Fácil
//     NÃO tira a sondagem" reprova, e o efeito real é a bengala calada para quem usa Modo Fácil.
//   · tirando o ramo do `jaGrudado` → "[Right] e SOLTA quando já está grudado" reprova, e o modo vira a
//     armadilha que o ADR-0044 passou sete itens desfazendo.
