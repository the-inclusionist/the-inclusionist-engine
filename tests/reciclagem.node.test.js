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
import { LIXEIRA_DE, MATERIAIS, LIXEIRAS, descartar, podeNascerEm, podePassarDaPlaca, travarNaPlaca } from '../app/js/game/recycling.js';

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

// ========================= A PLACA =========================
// Aqui mora a decisão mais fina do módulo, e ela desmonta o reflexo de quem desenha jogo. O óbvio seria: jogou
// lixo na água, perde ponto. O Dev recusou, e o motivo é sobre a criança e não sobre a regra:
//
//   "a criança não pode escolher ter um comportamento ruim, visto que a PERDA DE PONTOS ainda é vista como
//    RECOMPENSA para crianças que estão procurando fazer uma má ação por um motivo como estar irritada com o
//    professor ou com o jogo."
//
// Para quem quer transgredir, a penalidade É o efeito procurado: ela confirma que a transgressão funcionou. Um
// número que desce é feedback tão bom quanto um que sobe, quando o que se quer é REAÇÃO. A barreira não julga e
// não reage — ela não deixa acontecer, e é por isso que não há punição, nem sermão, nem tela de aviso: cada um
// deles seria uma resposta, e resposta é o prêmio.
describe('a placa de proibido jogar lixo · barreira, não penalidade', () => {
  it('[Right] CARREGANDO LIXO, A CRIANÇA NÃO PASSA DA PLACA', () => {
    // A barreira é sobre ELA, e não sobre o objeto. A primeira versão barrava o lixo: quem cruzava soltava o
    // item ali. Só que soltar o lixo JÁ É desobedecer — barrar o objeto deixava a desobediência acontecer e
    // depois consertava a consequência; barrar a criança faz a desobediência não ter por onde começar.
    const vao = { x: 500, topo: 400, piso: 500 };
    expect(podePassarDaPlaca(499, 500, vao, true), 'aquém da linha, segue').toBe(true);
    expect(podePassarDaPlaca(500, 500, vao, true), 'na linha já não passa').toBe(false);
    expect(podePassarDaPlaca(700, 450, vao, true), 'no meio do vão, tampouco').toBe(false);
  });

  it('[Right] A BARREIRA É UM SEGMENTO, e fora do vão da placa ela não existe', () => {
    // "A barreira deve valer só do piso da placa até o próximo tile sólido acima da placa." Uma linha do teto
    // ao chão barraria a criança em andares onde a placa nem aparece — parede invisível, que ela lê como
    // defeito do jogo. Assim a barreira e o aviso ocupam o mesmo vão: onde ela não passa, ela vê o porquê.
    const vao = { x: 500, topo: 400, piso: 500 };
    expect(podePassarDaPlaca(700, 400, vao, true), 'na altura do teto do vão, já passa').toBe(true);
    expect(podePassarDaPlaca(700, 380, vao, true), 'acima do vão — outro andar').toBe(true);
    expect(podePassarDaPlaca(700, 501, vao, true), 'abaixo do piso da placa').toBe(true);
    expect(podePassarDaPlaca(700, 500, vao, true), 'exatamente no piso: é o andar da placa').toBe(false);
  });

  it('[Zero] de mãos livres ela passa à vontade, e sem placa também', () => {
    const vao = { x: 500, topo: 400, piso: 500 };
    expect(podePassarDaPlaca(700, 450, vao, false), 'a placa só barra quem carrega lixo').toBe(true);
    expect(podePassarDaPlaca(9999, 450, null, true), 'fase sem placa declarada não barra nada').toBe(true);
  });

  it('[Right] `travarNaPlaca` devolve ONDE ela para, não só que parou', () => {
    // Número e não booleano: barrar é grudar a criança na linha, e um booleano faria cada chamador inventar
    // o seu próprio "então onde ela fica?".
    const vao = { x: 500, topo: 400, piso: 500 };
    expect(travarNaPlaca(700, 450, vao, true)).toBe(500);
    expect(travarNaPlaca(400, 450, vao, true), 'quem pode passar não é movido').toBe(400);
    expect(travarNaPlaca(700, 450, vao, false)).toBe(700);
    expect(travarNaPlaca(700, 300, vao, true), 'noutro andar, segue direto').toBe(700);
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
