// SPDX-License-Identifier: AGPL-3.0-or-later
// render/city-tex — a ARTE PROCEDURAL DA RUA: os bichos, os pedestres e os carros do cenário Cidade.
//
// Três blocos que viviam soltos no main.js (`LIFE_TEX`, `ADULT_TEX`, `CAR_TEX`) e que são a MESMA coisa vista
// de três ângulos: retângulos coloridos carimbados num canvas offscreen que vira PIXI.Texture. Por isso caem
// juntos aqui, e não em três módulos: o que os une não é o assunto (bicho ≠ carro), é a TÉCNICA e o CONSUMIDOR
// — quem os pede é a Cidade, e só ela. `render/props` (moeda, árvore) e `render/world-tex` (o nível inteiro)
// ficam onde estão: props é decoração de QUALQUER cenário, world-tex é o mapa, não a rua.
//
// A DUPLICAÇÃO QUE ESTA EXTRAÇÃO CUROU: cada um dos três blocos declarava o SEU `mk` e o SEU `px`, com
// assinaturas que não conversavam — `mk(w,h,paint)` com `px(x,y,w,h,cor)`; `mk(paint)` de 16×32 fixo com
// `px(x,y,w,h)` e a cor presa numa `const` de fora; `mk(body,dark,top)` de 78×36 fixo com `px(x,y,w,h,cl)`.
// Três grafias para "pinte um retângulo". Agora existe uma só, `pixelCanvas`/`pixelTexture` em render/canvas.
// EFEITO COLATERAL ACEITO: as silhuetas de adulto passaram a receber a cor em CADA chamada (`ADULT_COL`) em vez
// de um `fillStyle` único antes do laço. O bitmap resultante é idêntico ao byte — só o número de atribuições de
// `fillStyle` muda —, e em troca some a última assinatura divergente.
//
// SEM I/O NO IMPORT — este é o ponto mais importante do arquivo. As texturas de origem nasciam em IIFE no corpo
// do main.js, o que funciona lá porque o main.js só roda no navegador; um módulo em `render/` é importado pelo
// project `node` do Vitest, onde `makeCanvas` toca `document` e explode. Por isso NÃO há constante pronta aqui:
// há `createCityTextures()`, chamada uma vez pelo main.js no boot. Mesmo precedente de `render/textures`
// (caches preenchidos por `initTextures`) e `render/viewports` (`initViewports`).
//
// A FRONTEIRA COM O JOGO NÃO SE MEXE: `game/life` e `game/traffic` continuam recebendo as texturas por INJEÇÃO
// (`initLife({ lifeTex, adultTex, … })`, `initTraffic({ CAR_TEX, … })`) — eles nunca importaram este módulo e
// continuam sem importar, para seguirem testáveis em `node` com texturas de mentira. O main.js é que passou a
// buscar aqui o que antes fabricava em casa. Quem cria as CAMADAS (`lifeLayer`, `carLayer`) e solda o z-order
// segue sendo o main.js: z-order é composição de cena, não arte.
//
// ARMADILHAS AO MEXER NA ARTE:
//  · Os comentários de arte (`// cabeça alta / bicando`, `// M2: magro, de boné`, `// coluna B + retrovisor`)
//    são a ÚNICA documentação de qual retângulo é qual parte da figura. Não os apague ao editar coordenadas.
//  · A silhueta F2 NÃO chama `arms` — é verbatim do original, não esquecimento: os dois retângulos altos do
//    cabelo longo (`2,4,3,13` e `11,4,3,13`) ocupam exatamente onde os braços iriam. Se um dia isso for
//    "consertado", a F2 muda de forma no jogo.
//  · Os carros são 3× NATIVOS (78×36 desenhados, sem upscale) porque a rua fica na camada da frente, perto da
//    câmera; os bichos são 1× (7×6 … 13×9). Não normalize as escalas: `game/traffic` conta com os 78px.
//  · Dois quadros por figura, sempre na ordem `[f0, f1]`: `game/life` alterna por índice (`f = f ? 0 : 1`).
//    Inverter o par não quebra nenhum tipo — quebra a animação, em silêncio.

import { pixelTexture, tex, type PixelBrush, type PixelPainter } from './canvas.js';

type Tex = ReturnType<typeof tex>;
/** O par de quadros do ciclo de 2 tempos que TODA figura da rua usa. */
export type TexPair = [Tex, Tex];
/** Índice do quadro: 0 e 1, os dois tempos do ciclo. */
export type Frame = 0 | 1;

/* ===================== bichos: pombo, pombo voando, gato, cão ===================== */

/** Pombo no chão 7×6 — corpo cinza, bico laranja, pés. f alterna cabeça alta ↔ bicando. */
export const paintPigeon = (f: Frame): PixelPainter => (px) => {
  px(1, 2, 4, 2, '#9aa3b2'); px(0, 3, 2, 1, '#7d8695');
  if (f === 0) { px(4, 1, 2, 2, '#b9c2d0'); px(6, 2, 1, 1, '#e0a23c'); } else { px(4, 3, 2, 2, '#b9c2d0'); px(6, 4, 1, 1, '#e0a23c'); } // cabeça alta / bicando
  px(2, 5, 1, 1, '#c96a2e'); px(4, 5, 1, 1, '#c96a2e');
};
/** Pombo em revoada 8×7 — mesmo corpo, asa batendo. */
export const paintPigeonFly = (f: Frame): PixelPainter => (px) => {
  px(2, 3, 4, 2, '#9aa3b2'); px(6, 2, 2, 2, '#b9c2d0'); px(7, 3, 1, 1, '#e0a23c');
  if (f === 0) px(1, 0, 4, 2, '#c8d0dc'); else px(1, 5, 4, 2, '#c8d0dc');                             // asa cima/baixo
};
/** Gato 12×8 — corpo/cabeça/orelhas/rabo escuros, olho verde; f alterna as patas. */
export const paintCat = (f: Frame): PixelPainter => (px) => {
  px(1, 3, 8, 3, '#454b58'); px(8, 1, 3, 3, '#454b58'); px(8, 0, 1, 1, '#454b58'); px(10, 0, 1, 1, '#454b58');
  px(0, 2, 1, 3, '#454b58'); px(9, 2, 1, 1, '#9fe07a');
  if (f === 0) { px(2, 6, 1, 2, '#454b58'); px(7, 6, 1, 2, '#454b58'); } else { px(3, 6, 1, 2, '#454b58'); px(6, 6, 1, 2, '#454b58'); }
};
/** Cão 13×9 — corpo marrom, focinho escuro, orelha; f alterna as patas. */
export const paintDog = (f: Frame): PixelPainter => (px) => {
  px(1, 3, 9, 4, '#8a6a44'); px(9, 1, 4, 4, '#8a6a44'); px(12, 2, 1, 2, '#3a2d1c'); px(9, 0, 2, 2, '#6d5334');
  px(0, 2, 1, 3, '#8a6a44');
  if (f === 0) { px(2, 7, 1, 2, '#6d5334'); px(8, 7, 1, 2, '#6d5334'); } else { px(3, 7, 1, 2, '#6d5334'); px(7, 7, 1, 2, '#6d5334'); }
};

/** Catálogo dos bichos: tamanho do canvas + painter por quadro. Fonte única que `createCityTextures` percorre
 *  e que o teste de regressão de arte itera — as chaves são as MESMAS que `game/life` lê em `LifeTexAtlas`. */
export const CREATURE_ART = {
  pombo: { w: 7, h: 6, paint: paintPigeon },
  pomboFly: { w: 8, h: 7, paint: paintPigeonFly },
  gato: { w: 12, h: 8, paint: paintCat },
  cao: { w: 13, h: 9, paint: paintDog },
} as const;
export type CreatureKey = keyof typeof CREATURE_ART;

/* ===================== adultos: 6 silhuetas 16×32 ===================== */
// Adultos = SILHUETAS 16×32 (mesma proporção/tamanho do personagem), formatos distintos M/F (pedido do José)

/** Tamanho da silhueta — casado com o do personagem jogável (render/sprites). */
export const ADULT_W = 16, ADULT_H = 32;
/** Cor única de toda silhueta (era o `const col` fora do `mk` no main.js). */
export const ADULT_COL = '#262b38';

/** Pernas: calça (duas colunas alternando o passo) ou saia + pernas curtas. */
const legs = (px: PixelBrush, f: Frame, skirt: boolean): void => {
  if (skirt) { px(4, 20, 8, 6, ADULT_COL); if (f === 0) { px(5, 26, 2, 6, ADULT_COL); px(9, 26, 2, 6, ADULT_COL); } else { px(4, 26, 2, 6, ADULT_COL); px(10, 26, 2, 6, ADULT_COL); } }
  else { if (f === 0) { px(5, 20, 3, 12, ADULT_COL); px(9, 20, 3, 11, ADULT_COL); } else { px(4, 20, 3, 11, ADULT_COL); px(10, 20, 3, 12, ADULT_COL); } }
};
/** Braços pendentes, defasados entre os quadros (dá o balanço da caminhada). */
const arms = (px: PixelBrush, f: Frame): void => {
  if (f === 0) { px(2, 10, 2, 8, ADULT_COL); px(12, 10, 2, 8, ADULT_COL); } else { px(2, 11, 2, 7, ADULT_COL); px(12, 9, 2, 8, ADULT_COL); }
};

/** As 6 silhuetas — 3 masculinas + 3 femininas, todas 16×32. A ordem é a do original (M1, M2, M3, F1, F2, F3);
 *  `game/life` sorteia por índice, então reordenar troca qual silhueta cada sorteio produz. */
export const ADULT_SHAPES: ((f: Frame) => PixelPainter)[] = [
  (f) => (px) => { px(4, 0, 8, 6, ADULT_COL); px(3, 6, 10, 14, ADULT_COL); arms(px, f); legs(px, f, false); },                                                                        // M1: ombros largos
  (f) => (px) => { px(5, 0, 6, 5, ADULT_COL); px(3, 1, 10, 2, ADULT_COL); px(5, 5, 6, 15, ADULT_COL); arms(px, f); legs(px, f, false); },                                             // M2: magro, de boné
  (f) => (px) => { px(4, 1, 8, 5, ADULT_COL); px(2, 6, 12, 14, ADULT_COL); arms(px, f); legs(px, f, false); },                                                                        // M3: troncudo
  (f) => (px) => { px(4, 0, 8, 6, ADULT_COL); px(11, 3, 3, 10, ADULT_COL); px(4, 6, 8, 10, ADULT_COL); px(3, 16, 10, 5, ADULT_COL); arms(px, f); legs(px, f, true); },                // F1: rabo de cavalo + saia
  (f) => (px) => { px(3, 0, 10, 6, ADULT_COL); px(2, 4, 3, 13, ADULT_COL); px(11, 4, 3, 13, ADULT_COL); px(5, 6, 6, 10, ADULT_COL); px(4, 16, 8, 5, ADULT_COL); legs(px, f, true); }, // F2: cabelo longo + vestido (sem `arms` — ver o cabeçalho)
  (f) => (px) => { px(3, 0, 10, 7, ADULT_COL); px(4, 7, 8, 9, ADULT_COL); px(3, 16, 10, 5, ADULT_COL); arms(px, f); legs(px, f, true); },                                             // F3: chanel + saia
];

/* ===================== carros: 4 cores, 78×36 (3× nativo) ===================== */

/** Tamanho do carro — 3× NATIVO (detalhado, sem upscale); `game/traffic` conta com os 78px de largura. */
export const CAR_W = 78, CAR_H = 36;
/** As 4 pinturas de fábrica: `[lataria, sombra, teto]`. */
export const CAR_PALETTES: readonly (readonly [string, string, string])[] = [
  ['#c8452e', '#7d2717', '#a03a24'], // vermelho
  ['#2e6fc8', '#193f7d', '#2757a0'], // azul
  ['#3aa15b', '#1f6336', '#2f8a4c'], // verde
  ['#c8a12e', '#7d641a', '#a8862a'], // amarelo
];

/* ===================== A RODA É REDONDA, E ISSO PRECISOU SER DITO =====================
 * A primeira versão do carro (portada verbatim do monólito) fazia o pneu com UM retângulo de 14×11. Numa
 * arte de retângulos carimbados, a roda é o único elemento que o olho sabe de cor que é redondo — e é o
 * primeiro que denuncia o desenho inteiro. O Dev, olhando a rua: "melhore os carros, estão muito feios com
 * as rodas quadradas."
 *
 * O jeito de ter círculo aqui é o de sempre em pixel art: uma TABELA de linhas, cada uma com o recuo e a
 * largura daquela altura. Não é aproximação de matemática em tempo de execução — é o desenho, escrito. */

/** Pneu Ø14: `[recuo, largura]` por linha, de cima para baixo. */
const PNEU: readonly (readonly [number, number])[] = [
  [5, 4], [3, 8], [2, 10], [1, 12], [1, 12], [0, 14], [0, 14],
  [0, 14], [0, 14], [1, 12], [1, 12], [2, 10], [3, 8], [5, 4],
];
/** Aro Ø8, no mesmo formato — desenhado dentro do pneu. */
const ARO: readonly (readonly [number, number])[] = [
  [2, 4], [1, 6], [0, 8], [0, 8], [0, 8], [0, 8], [1, 6], [2, 4],
];

/** Um carro 78×36 na paleta dada. Vidros, brilhos, farol e lanterna são fixos (não seguem a lataria). */
export const paintCar = (body: string, dark: string, top: string): PixelPainter => (px) => {
  px(3, 14, 72, 13, body); px(3, 25, 72, 2, dark);              // corpo + saia escura
  px(1, 16, 2, 8, dark); px(75, 16, 2, 8, dark);                // para-choques
  // Cabine com o teto AFUNILADO: eram 40px de bloco reto, e teto reto num carro de perfil lê como caixa.
  px(17, 4, 36, 2, top); px(15, 6, 40, 9, top); px(17, 6, 36, 9, body);
  px(19, 7, 14, 7, '#bcd6ee'); px(37, 7, 14, 7, '#bcd6ee');     // vidros
  px(20, 8, 4, 2, '#eef6ff'); px(38, 8, 4, 2, '#eef6ff');       // brilho dos vidros
  px(34, 7, 3, 7, top); px(53, 10, 4, 4, dark);                 // coluna B + retrovisor
  px(3, 14, 72, 1, 'rgba(255,255,255,.28)');                    // realce superior da lataria
  px(35, 15, 1, 10, dark);                                      // frisa entre as duas portas
  px(0, 17, 3, 5, '#ffd9a0'); px(75, 17, 3, 5, '#ff6a5a');      // farol / lanterna
  const wheel = (wx: number): void => {
    px(wx + 1, 20, 12, 2, dark); px(wx - 1, 21, 16, 1, dark);                       // caixa de roda, em arco
    PNEU.forEach(([dx, w], i) => px(wx + dx, 22 + i, w, 1, '#10131a'));             // pneu
    ARO.forEach(([dx, w], i) => px(wx + 3 + dx, 25 + i, w, 1, '#2b3140'));          // aro
    px(wx + 6, 28, 2, 2, '#8a93a8');                                                // cubo
  };
  wheel(11); wheel(53);
};

/* ===================== a fábrica (o único ponto de I/O) ===================== */

/** O que o main.js injeta em `game/life` e `game/traffic` — nomes iguais aos campos dos respectivos `Ctx`. */
export interface CityTextures {
  lifeTex: Record<CreatureKey, TexPair>; // → LifeCtx.lifeTex
  adultTex: TexPair[];                   // → LifeCtx.adultTex (6 silhuetas × 2 quadros)
  carTex: Tex[];                         // → TrafficCtx.CAR_TEX (4 carros)
}

/** Assa TODA a arte da rua de uma vez. TOCA `document` — chame só no boot do navegador, nunca no import.
 *  Não memoiza de propósito: é chamada uma vez pelo main.js; um cache aqui só esconderia uma segunda chamada. */
export function createCityTextures(): CityTextures {
  const pair = (w: number, h: number, paint: (f: Frame) => PixelPainter): TexPair =>
    [pixelTexture(w, h, paint(0)), pixelTexture(w, h, paint(1))]; // ordem [f0, f1] — game/life alterna por índice
  const lifeTex = {} as Record<CreatureKey, TexPair>;
  for (const k of Object.keys(CREATURE_ART) as CreatureKey[]) { const a = CREATURE_ART[k]; lifeTex[k] = pair(a.w, a.h, a.paint); }
  const adultTex = ADULT_SHAPES.map((v) => pair(ADULT_W, ADULT_H, v));
  const carTex = CAR_PALETTES.map(([body, dark, top]) => pixelTexture(CAR_W, CAR_H, paintCar(body, dark, top)));
  return { lifeTex, adultTex, carTex };
}
