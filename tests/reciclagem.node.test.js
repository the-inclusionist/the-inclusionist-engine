// SPDX-License-Identifier: AGPL-3.0-or-later
// RECICLAGEM — quatro materiais, quatro lixeiras, e um ponto que NÃO mexe em nada.
//
// ========================= O QUE ISTO É, E O QUE NÃO É =========================
// O Dev espalhou pelo cenário uma latinha de alumínio, uma garrafa PET, um pote de vidro e uma caixa de
// papelão; e pôs no canto inferior esquerdo quatro lixeiras: azul (papel), vermelha (plástico), amarela
// (metal), verde (vidro). Item na lixeira certa vale UM PONTO.
//
// ⚠️ E O PONTO AQUI É DE COMPORTAMENTO, NÃO DE ATIVIDADE. Palavras dele: "Lata na lixeira é boa ação, pontos na
// barra segmentada só via minigames." A distinção é a do ADR-0049 §1: ponto registra que a pessoa trabalhou e
// **não move nada** — não pinta a barra de dez segmentos, não muda nível, não alimenta a adaptação. Se pintasse,
// uma criança boa de plataforma subiria de nível ESCOLAR sem ter respondido nada.
//
// ========================= AS CORES NÃO SÃO ARBITRÁRIAS =========================
// Azul/papel, vermelho/plástico, amarelo/metal e verde/vidro são o padrão brasileiro (CONAMA 275/2001). Uma
// criança que aprende essas cores aqui as reconhece na rua — e é isso que faz disto conteúdo e não decoração.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { LIXEIRA_DE, MATERIAIS, LIXEIRAS, descartar, podeNascerEm } from '../app/js/game/recycling.js';

describe('reciclagem · o material, a cor e o ponto', () => {
  it('[Right] cada material tem a lixeira do padrão brasileiro', () => {
    expect(LIXEIRA_DE.papel).toBe('azul');
    expect(LIXEIRA_DE.plastico).toBe('vermelha');
    expect(LIXEIRA_DE.metal).toBe('amarela');
    expect(LIXEIRA_DE.vidro).toBe('verde');
  });

  it('[Interface] os quatro materiais e as quatro lixeiras se cobrem, sem sobra dos dois lados', () => {
    // Uma lixeira sem material é lixeira que nunca acerta; um material sem lixeira é item que nunca pontua.
    expect(MATERIAIS).toHaveLength(4);
    expect(LIXEIRAS).toHaveLength(4);
    expect(new Set(MATERIAIS.map((m) => LIXEIRA_DE[m])).size).toBe(4);
    expect([...LIXEIRAS].sort()).toEqual([...MATERIAIS.map((m) => LIXEIRA_DE[m])].sort());
  });

  it('[Right] material na lixeira certa é ACERTO e vale um ponto de comportamento', () => {
    const r = descartar('metal', 'amarela');
    expect(r.acertou).toBe(true);
    expect(r.pontos).toBe(1);
  });

  it('[Right] na lixeira errada não vale ponto — e também não TIRA ponto', () => {
    // Não há punição: o ADR-0049 recusa a mecânica que pune, e errar a lixeira é o momento de aprender qual é a
    // certa, não de perder o que já se fez.
    const r = descartar('metal', 'azul');
    expect(r.acertou).toBe(false);
    expect(r.pontos).toBe(0);
  });

  it('[Zero] acerto NÃO pinta a barra e NÃO mexe em nível — é a cláusula que separa boa ação de atividade', () => {
    const r = descartar('vidro', 'verde');
    expect(r.segmentoDaBarra, 'boa ação não entra na barra de dez segmentos').toBe(null);
    expect(r.mudaNivel, 'e não move a dificuldade acadêmica').toBe(false);
  });

  it('[Boundary] errar também não pinta nem move — o erro de lixeira não é erro acadêmico', () => {
    const r = descartar('vidro', 'amarela');
    expect(r.segmentoDaBarra).toBe(null);
    expect(r.mudaNivel).toBe(false);
  });

  it('[Right] os itens nascem ANTES da água, nunca depois', () => {
    // Regra do Dev, e ela tem motivo de jogo: item que cai na água some ou fica inalcançável, e a criança perde
    // um ponto por geometria em vez de por escolha.
    expect(podeNascerEm(100, 500)).toBe(true);
    expect(podeNascerEm(499, 500)).toBe(true);
    expect(podeNascerEm(500, 500), 'na borda da água já não nasce').toBe(false);
    expect(podeNascerEm(900, 500)).toBe(false);
  });

  it('[Zero] cenário sem água: o mapa inteiro serve', () => {
    expect(podeNascerEm(0, null)).toBe(true);
    expect(podeNascerEm(9999, null)).toBe(true);
  });

  it('[Interface] lixeira desconhecida não acerta nada, e não explode', () => {
    const r = descartar('metal', 'roxa');
    expect(r.acertou).toBe(false);
    expect(r.pontos).toBe(0);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · fazendo `descartar` devolver `segmentoDaBarra: 'verde'` no acerto → "[Zero] acerto NÃO pinta a barra"
//     reprova, e o efeito real é criança boa de plataforma subindo de nível escolar sem responder nada.
//   · fazendo o erro devolver `pontos: -1` → "[Right] na lixeira errada... também não TIRA ponto" reprova, e o
//     efeito real é punição numa mecânica que o ADR-0049 desenhou para não punir.
//   · trocando `<` por `<=` em `podeNascerEm` → "[Right] os itens nascem ANTES da água" reprova na borda, e o
//     efeito real é item nascendo dentro d'água.
//   · trocando azul↔verde no mapa de cores → "[Right] cada material tem a lixeira do padrão brasileiro" reprova,
//     e o efeito real é ensinar à criança a cor errada, que ela vai levar para a rua.
