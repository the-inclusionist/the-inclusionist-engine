// SPDX-License-Identifier: AGPL-3.0-or-later
// render/recycling-tex — a ARTE PROCEDURAL do lixo reciclável e das quatro lixeiras.
//
// Mesma técnica de `render/city-tex` (retângulos carimbados por `pixelCanvas`), e por isso mesmo um módulo à
// parte e não um bloco lá dentro: `city-tex` é a arte DA RUA — bichos, pedestres, carros —, e o seu cabeçalho
// diz com todas as letras que "props é decoração de QUALQUER cenário" e fica fora. Lixo e lixeira aparecem em
// qualquer tema, então seguem a regra que aquele arquivo escreveu para si.
//
// SEM I/O NO IMPORT, pelo mesmo motivo que lá: `makeCanvas` toca `document`, e um módulo de `render/` é
// importado pelo project `node` do Vitest. Não há constante pronta aqui — há `createRecyclingTextures()`, que a
// raiz de composição chama uma vez no boot.
//
// ========================= POR QUE PROCEDURAL, E NÃO PNG =========================
// O pilar diz "arte = dados: nenhum PNG embutido no jogo" (ADR-0010/0018). Quatro objetos e quatro lixeiras em
// PNG seriam oito arquivos a versionar, precachear e recolorir à mão em cada modo de visão. Como retângulos,
// eles são LIDOS pelo alto contraste e pelos filtros de daltonismo como o resto do mundo, sem exceção e sem
// arquivo `_hc` paralelo — que é a dívida que o atlas de sprites do personagem ainda carrega.
//
// ========================= AS CORES SÃO CONTEÚDO =========================
// As lixeiras seguem a Resolução CONAMA 275/2001, que é o padrão da rua brasileira: AZUL papel, VERMELHA
// plástico, AMARELA metal, VERDE vidro. A criança que aprende a cor aqui reconhece a de fora — trocar uma por
// gosto ensina errado. O gate compara este arquivo com `game/recycling`, que é quem decide o acerto, para que
// as duas listas não possam divergir em silêncio.

import type { PixelPainter } from './canvas.js';
import { pixelTexture } from './canvas.js';

// ⚠️ ESTE MÓDULO NÃO IMPORTA DE `game/`, E ISSO É A DECISÃO E NÃO UM DETALHE. A primeira versão puxava
// `Material`, `Bin` e `LIXEIRA_DE` de `game/recycling`, e o gate de fronteira reprovou na hora — com razão:
// arte é da ENGINE e regra de acerto é do JOGO, e uma aresta daqui para lá faria a engine saber o que é reciclar.
// Os nomes são declarados aqui de novo, e QUEM PROVA QUE AS DUAS LISTAS CONCORDAM É O TESTE, que pode importar
// os dois lados sem criar dependência nenhuma no produto.
export type Material = 'papel' | 'plastico' | 'metal' | 'vidro';
export type Bin = 'azul' | 'vermelha' | 'amarela' | 'verde';

/* ===================== os quatro objetos ===================== */
// Miúdos de propósito: ficam no chão, ao lado de moedas, num mundo de 320×180. Grandes demais viram obstáculo
// visual; pequenos demais somem para quem tem baixa visão — a faixa útil aqui é 6 a 11 px de largura.

/** Latinha de alumínio 6×9 — corpo prateado, tampa e base mais escuras, brilho de uma coluna. */
export const paintCan: PixelPainter = (px) => {
  px(1, 1, 4, 7, '#b9c2cc');            // corpo
  px(1, 0, 4, 1, '#8b949e');            // tampa
  px(1, 8, 4, 1, '#8b949e');            // base
  px(2, 2, 1, 5, '#e6ecf2');            // brilho
  px(0, 2, 1, 5, '#8b949e');            // sombra do lado
};

/** Garrafa PET 6×11 — gargalo estreito, tampa, corpo translúcido esverdeado. */
export const paintPetBottle: PixelPainter = (px) => {
  px(2, 0, 2, 1, '#2f6fd0');            // tampa azul
  px(2, 1, 2, 2, '#bfe6d8');            // gargalo
  px(1, 3, 4, 7, '#a8dcc9');            // corpo
  px(2, 4, 1, 5, '#dcf3ea');            // brilho
  px(1, 10, 4, 1, '#7fbfa8');           // base
};

/** Pote de vidro 8×9 — boca larga, tampa metálica, corpo azulado transparente. */
export const paintGlassJar: PixelPainter = (px) => {
  px(1, 0, 6, 1, '#8b949e');            // tampa
  px(1, 1, 6, 1, '#6f7883');            // aro
  px(1, 2, 6, 6, '#a9cfe0');            // corpo
  px(2, 3, 1, 4, '#e2f2f8');            // brilho
  px(1, 8, 6, 1, '#7fa8ba');            // base
};

/** Caixa de papelão 10×9 — papelão liso, aba superior e fita no meio. */
export const paintCardboardBox: PixelPainter = (px) => {
  px(0, 1, 10, 8, '#c39a63');           // corpo
  px(0, 0, 10, 1, '#a37f4f');           // aba de cima
  px(4, 0, 2, 9, '#d9bb90');            // fita vertical
  px(0, 4, 10, 1, '#a37f4f');           // vinco
};

/** Catálogo dos objetos: tamanho do canvas + pintor. As chaves são os `Material` de `game/recycling`. */
export const LITTER_ART: Readonly<Record<Material, { w: number; h: number; paint: PixelPainter }>> = Object.freeze({
  metal: { w: 6, h: 9, paint: paintCan },
  plastico: { w: 6, h: 11, paint: paintPetBottle },
  vidro: { w: 8, h: 9, paint: paintGlassJar },
  papel: { w: 10, h: 9, paint: paintCardboardBox },
});

/* ===================== as quatro lixeiras ===================== */

export const BIN_W = 12, BIN_H = 15;

/** A cor de cada lixeira, na CONAMA 275/2001. Corpo e um tom escuro para tampa, aro e sombra. */
export const BIN_COLOUR: Readonly<Record<Bin, { corpo: string; escuro: string }>> = Object.freeze({
  azul: { corpo: '#2f6fd0', escuro: '#1e4a8c' },
  vermelha: { corpo: '#c8372d', escuro: '#8d251e' },
  amarela: { corpo: '#e0b423', escuro: '#a07d13' },
  verde: { corpo: '#2f9e52', escuro: '#1d6b36' },
});

/**
 * Uma lixeira 12×15 — corpo levemente cônico, tampa saliente, alça e o símbolo da reciclagem em três traços.
 *
 * ⚠️ O SÍMBOLO É CLARO SOBRE O CORPO, e não uma quinta cor: em alto contraste e nos filtros de daltonismo, o que
 * distingue as quatro lixeiras é a cor do corpo, e um símbolo colorido competiria com ela. Claro sobre escuro
 * sobrevive a qualquer um dos dezesseis modos de visão.
 */
export const paintBin = (cor: Bin): PixelPainter => (px) => {
  const { corpo, escuro } = BIN_COLOUR[cor];
  px(1, 3, 10, 11, corpo);              // corpo
  px(0, 1, 12, 2, escuro);              // tampa
  px(5, 0, 2, 1, escuro);               // alça
  px(1, 14, 10, 1, escuro);             // base
  px(2, 4, 1, 9, escuro);               // vinco esquerdo
  px(9, 4, 1, 9, escuro);               // vinco direito
  px(4, 6, 4, 1, '#f2f5f7');            // símbolo: traço de cima
  px(4, 8, 4, 1, '#f2f5f7');            // símbolo: traço do meio
  px(4, 10, 4, 1, '#f2f5f7');           // símbolo: traço de baixo
};

/* ===================== a placa de proibido jogar lixo =====================
 *
 * ⚠️ SEGUNDA VERSÃO, e a primeira era pequena demais para dizer o que dizia. Tinha 11×16 e resolvia o disco
 * de proibição com quatro retângulos — na tela virava um quadradinho vermelho com um risco branco, que a
 * criança lê como "algum objeto", não como "aqui não". O Dev mandou a referência da placa de verdade (o
 * pictograma da pessoa jogando lixo dentro do círculo cortado) e pediu: "a placa deveria ser grande, com o
 * símbolo identificável da pessoa jogando coisas e o sinal de proibido."
 *
 * Agora são 20×28: prancha de 20×20 e poste de 8. O círculo vem de TABELA DE LINHAS, como a roda do carro —
 * é o mesmo problema, e pela mesma razão: numa arte de retângulos, o que o olho já sabe que é redondo
 * denuncia o desenho inteiro se sair quadrado.
 *
 * ⚠️ E A LEITURA É EM TRÊS CAMADAS, na ordem em que a criança precisa delas: a prancha clara separa a placa
 * do fundo; o pictograma PRETO sobre claro é o contraste mais alto que existe e sobrevive aos dezesseis
 * modos de visão; a barra vermelha vem por último, por cima de tudo, porque é ela que transforma "uma pessoa
 * jogando lixo" em "não jogue lixo". Trocar essa ordem inverte o sentido do desenho. */

export const SIGN_W = 20, SIGN_H = 28;

/** Disco Ø18: `[recuo, largura]` por linha. Mesma técnica da roda do carro. */
const DISCO: readonly (readonly [number, number])[] = [
  [6, 6], [4, 10], [3, 12], [2, 14], [1, 16], [1, 16], [0, 18], [0, 18], [0, 18],
  [0, 18], [0, 18], [0, 18], [1, 16], [1, 16], [2, 14], [3, 12], [4, 10], [6, 6],
];
/** Miolo Ø14, no mesmo formato — abre o vazio claro dentro do aro vermelho. */
const MIOLO: readonly (readonly [number, number])[] = [
  [5, 4], [3, 8], [2, 10], [1, 12], [1, 12], [0, 14], [0, 14],
  [0, 14], [0, 14], [1, 12], [1, 12], [2, 10], [3, 8], [5, 4],
];

const VERMELHO = '#d42a1e', CLARO = '#f2f5f7', PRETO = '#1a1d24', POSTE = '#6f7883';

/**
 * A placa 20×28: disco vermelho vazado, a pessoa jogando lixo em preto, a barra da proibição e o poste.
 *
 * Ela é o rosto de uma regra que o jogo NÃO pune (ver `game/recycling`): quem carrega lixo simplesmente não
 * passa daqui. A placa existe para que a criança saiba POR QUE não passou — sem ela, a barreira seria um bug
 * aos olhos de quem joga.
 */
export const paintSign: PixelPainter = (px) => {
  px(1, 0, 18, 20, CLARO);                                  // prancha
  px(0, 0, 20, 1, PRETO); px(0, 19, 20, 1, PRETO);          // moldura: topo e base
  px(0, 1, 1, 18, PRETO); px(19, 1, 1, 18, PRETO);          // moldura: laterais
  DISCO.forEach(([dx, w], i) => px(1 + dx, 1 + i, w, 1, VERMELHO));
  MIOLO.forEach(([dx, w], i) => px(3 + dx, 3 + i, w, 1, CLARO));
  // O pictograma, dentro do miolo (x 3..16, y 3..16): cabeça, tronco, braço estendido e as pernas.
  px(7, 5, 3, 3, PRETO);                                    // cabeça
  px(7, 8, 3, 5, PRETO);                                    // tronco
  px(10, 9, 3, 1, PRETO);                                   // braço que joga
  px(7, 13, 1, 3, PRETO); px(9, 13, 1, 3, PRETO);           // pernas
  px(13, 11, 1, 1, PRETO); px(14, 13, 1, 1, PRETO); px(12, 14, 1, 1, PRETO); // o lixo caindo
  // A barra da proibição POR ÚLTIMO: é ela que faz o desenho dizer "não".
  for (let k = 0; k < 12; k++) px(4 + k, 4 + k, 3, 2, VERMELHO);
  px(9, 20, 2, 7, POSTE); px(7, 27, 6, 1, POSTE);           // poste e pé
};

/* ===================== assadura ===================== */

export interface RecyclingTextures {
  lixo: Record<Material, unknown>;
  lixeira: Record<Bin, unknown>;
  placa: unknown;
}

/** Assa tudo uma vez. Chamada pela raiz de composição no boot — nunca no import (ver o cabeçalho). */
export function createRecyclingTextures(): RecyclingTextures {
  const lixo = {} as Record<Material, unknown>;
  for (const m of Object.keys(LITTER_ART) as Material[]) {
    const a = LITTER_ART[m];
    lixo[m] = pixelTexture(a.w, a.h, a.paint);
  }
  const lixeira = {} as Record<Bin, unknown>;
  for (const c of Object.keys(BIN_COLOUR) as Bin[]) {
    lixeira[c] = pixelTexture(BIN_W, BIN_H, paintBin(c));
  }
  return { lixo, lixeira, placa: pixelTexture(SIGN_W, SIGN_H, paintSign) };
}

