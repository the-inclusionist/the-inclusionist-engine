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
// `Material`, `Lixeira` e `LIXEIRA_DE` de `game/recycling`, e o gate de fronteira reprovou na hora — com razão:
// arte é da ENGINE e regra de acerto é do JOGO, e uma aresta daqui para lá faria a engine saber o que é reciclar.
// Os nomes são declarados aqui de novo, e QUEM PROVA QUE AS DUAS LISTAS CONCORDAM É O TESTE, que pode importar
// os dois lados sem criar dependência nenhuma no produto.
export type Material = 'papel' | 'plastico' | 'metal' | 'vidro';
export type Lixeira = 'azul' | 'vermelha' | 'amarela' | 'verde';

/* ===================== os quatro objetos ===================== */
// Miúdos de propósito: ficam no chão, ao lado de moedas, num mundo de 320×180. Grandes demais viram obstáculo
// visual; pequenos demais somem para quem tem baixa visão — a faixa útil aqui é 6 a 11 px de largura.

/** Latinha de alumínio 6×9 — corpo prateado, tampa e base mais escuras, brilho de uma coluna. */
export const paintLatinha: PixelPainter = (px) => {
  px(1, 1, 4, 7, '#b9c2cc');            // corpo
  px(1, 0, 4, 1, '#8b949e');            // tampa
  px(1, 8, 4, 1, '#8b949e');            // base
  px(2, 2, 1, 5, '#e6ecf2');            // brilho
  px(0, 2, 1, 5, '#8b949e');            // sombra do lado
};

/** Garrafa PET 6×11 — gargalo estreito, tampa, corpo translúcido esverdeado. */
export const paintGarrafaPet: PixelPainter = (px) => {
  px(2, 0, 2, 1, '#2f6fd0');            // tampa azul
  px(2, 1, 2, 2, '#bfe6d8');            // gargalo
  px(1, 3, 4, 7, '#a8dcc9');            // corpo
  px(2, 4, 1, 5, '#dcf3ea');            // brilho
  px(1, 10, 4, 1, '#7fbfa8');           // base
};

/** Pote de vidro 8×9 — boca larga, tampa metálica, corpo azulado transparente. */
export const paintPoteDeVidro: PixelPainter = (px) => {
  px(1, 0, 6, 1, '#8b949e');            // tampa
  px(1, 1, 6, 1, '#6f7883');            // aro
  px(1, 2, 6, 6, '#a9cfe0');            // corpo
  px(2, 3, 1, 4, '#e2f2f8');            // brilho
  px(1, 8, 6, 1, '#7fa8ba');            // base
};

/** Caixa de papelão 10×9 — papelão liso, aba superior e fita no meio. */
export const paintCaixaDePapelao: PixelPainter = (px) => {
  px(0, 1, 10, 8, '#c39a63');           // corpo
  px(0, 0, 10, 1, '#a37f4f');           // aba de cima
  px(4, 0, 2, 9, '#d9bb90');            // fita vertical
  px(0, 4, 10, 1, '#a37f4f');           // vinco
};

/** Catálogo dos objetos: tamanho do canvas + pintor. As chaves são os `Material` de `game/recycling`. */
export const LIXO_ART: Readonly<Record<Material, { w: number; h: number; paint: PixelPainter }>> = Object.freeze({
  metal: { w: 6, h: 9, paint: paintLatinha },
  plastico: { w: 6, h: 11, paint: paintGarrafaPet },
  vidro: { w: 8, h: 9, paint: paintPoteDeVidro },
  papel: { w: 10, h: 9, paint: paintCaixaDePapelao },
});

/* ===================== as quatro lixeiras ===================== */

export const LIXEIRA_W = 12, LIXEIRA_H = 15;

/** A cor de cada lixeira, na CONAMA 275/2001. Corpo e um tom escuro para tampa, aro e sombra. */
export const COR_DA_LIXEIRA: Readonly<Record<Lixeira, { corpo: string; escuro: string }>> = Object.freeze({
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
export const paintLixeira = (cor: Lixeira): PixelPainter => (px) => {
  const { corpo, escuro } = COR_DA_LIXEIRA[cor];
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

/* ===================== a placa de proibido jogar lixo ===================== */

export const PLACA_W = 11, PLACA_H = 16;

/**
 * A placa 11×16 — poste, disco branco com aro vermelho e a barra diagonal da proibição.
 *
 * Ela é o rosto de uma regra que o jogo NÃO pune (ver `game/recycling`): a barreira invisível simplesmente não
 * deixa o lixo passar. A placa existe para que a criança saiba POR QUE não passou — sem ela, a barreira seria
 * um bug aos olhos de quem joga.
 */
export const paintPlaca: PixelPainter = (px) => {
  px(5, 8, 1, 8, '#6f7883');            // poste
  px(1, 0, 9, 8, '#c8372d');            // disco: aro vermelho
  px(2, 1, 7, 6, '#f2f5f7');            // disco: miolo branco
  px(2, 3, 7, 2, '#c8372d');            // barra da proibição
};

/* ===================== assadura ===================== */

export interface RecyclingTextures {
  lixo: Record<Material, unknown>;
  lixeira: Record<Lixeira, unknown>;
  placa: unknown;
}

/** Assa tudo uma vez. Chamada pela raiz de composição no boot — nunca no import (ver o cabeçalho). */
export function createRecyclingTextures(): RecyclingTextures {
  const lixo = {} as Record<Material, unknown>;
  for (const m of Object.keys(LIXO_ART) as Material[]) {
    const a = LIXO_ART[m];
    lixo[m] = pixelTexture(a.w, a.h, a.paint);
  }
  const lixeira = {} as Record<Lixeira, unknown>;
  for (const c of Object.keys(COR_DA_LIXEIRA) as Lixeira[]) {
    lixeira[c] = pixelTexture(LIXEIRA_W, LIXEIRA_H, paintLixeira(c));
  }
  return { lixo, lixeira, placa: pixelTexture(PLACA_W, PLACA_H, paintPlaca) };
}

