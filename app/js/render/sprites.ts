// SPDX-License-Identifier: GPL-3.0-or-later
// render/sprites.ts — texturas do PERSONAGEM (spritesheets PNG do PixelLab, editados no Aseprite). Import PURO:
// NADA de I/O no import — um módulo não deve carregar 38 arquivos só por ser importado (era o smell que os testes
// denunciaram; ver docs/plano-testes.md). O contrato testável é o SPRITE_MANIFEST (dados puros: nº de quadros
// por animação); a criação das texturas é um passo EXPLÍCITO em initCharacterSprites(), chamado UMA vez no boot
// do game.js. Os TEX_* começam vazios e são preenchidos por init — importadores os leem como bindings VIVOS
// (atualizam após init). PIXI vem do npm (7.4.2), só usado em initCharacterSprites. Fonte: assets/sprites/menino/. (Fase 2.24)
import * as PIXI from 'pixi.js';
import { makeCanvas, tex } from './canvas.js'; // p/ o tapa-costuras (inpaint 1px) dos frames do PixelLab
// O ATLAS (item 22, X2). Módulo VIRTUAL, gerado por `scripts/vite-plugin-atlas.mjs` no build: `FRAMES` é o
// manifesto `anim/idx → {x,y,w,h}` e vem DENTRO do bundle, para o boot continuar síncrono. Um `.json` ao lado
// do PNG seria a segunda requisição, e este item existe para matar requisição.
import { ATLAS_URL, FRAMES } from 'virtual:sprite-atlas';

// Manifesto PURO (animação → nº de quadros): fonte única da ESTRUTURA, testável sem carregar textura nenhuma.
export const SPRITE_MANIFEST: Record<string, number> = {
  idle: 4, andar: 8, correr: 4,
  'gracinha-joinha': 2, 'gracinha-espreguicar': 2, 'gracinha-aquecer': 1,
  pulo: 2, escada: 2, voo: 1, parede: 4, teto: 4, nadar: 2, 'nadar-parado': 2,
};

// FLAVORS: idles ocasionais ("gracinhas"). seq/hold são DADOS PUROS; .tex é preenchido por initCharacterSprites().
type Flavor = { seq: number[]; hold: number; tex: PIXI.Texture[] };
export const FLAVORS: Flavor[] = [
  { seq: [0, 1, 0, 1, 0, 1], hold: 12, tex: [] }, // joínha (bounce do polegar)
  { seq: [0, 1, 1, 1, 1, 0], hold: 16, tex: [] }, // espreguiçar (sobe, segura, desce)
  { seq: [0, 0, 0], hold: 40, tex: [] },          // aquecer (segura a pose)
];

// Texturas — bindings VIVOS, VAZIOS até initCharacterSprites(). O game.js só LÊ (nunca reatribui).
export let TEX_IDLE: PIXI.Texture[] = [], TEX_WALK: PIXI.Texture[] = [], TEX_RUN: PIXI.Texture[] = [];
export let TEX_JUMP_UP: PIXI.Texture | null = null, TEX_JUMP_DOWN: PIXI.Texture | null = null, TEX_CLIMB: PIXI.Texture[] = [], TEX_FLY: PIXI.Texture | null = null;
export let TEX_CLING_WALL: PIXI.Texture[] = [], TEX_CLING_CEIL: PIXI.Texture[] = [], TEX_SWIM: PIXI.Texture[] = [], TEX_SWIMIDLE: PIXI.Texture[] = [];

// Base dos PNGs do personagem. EXPORTADA porque o assistente de mapeamento de controle (input/gamepad)
// monta os caminhos da demonstracao animada a partir dela; era um `const` privado e o game.js usava o
// nome como se fosse global, o que derrubava o assistente com ReferenceError ao abrir.
export const SPR = 'assets/sprites/menino/';

/**
 * A base do ATLAS — UMA textura, criada uma vez. Era `PIXI.Texture.from` por quadro, e o boot pedia 38
 * arquivos (55 requisições, porque 16 iam duas vezes). Medido no empacotador: os 39 quadros de cor cabem num
 * PNG de 256×207 e 25,4 KB, contra 56,4 KB soltos — o atlas ganha em requisição E em bytes.
 *
 * Preguiçosa de propósito: este módulo continua SEM I/O no import (a regra que os testes cobram), e a base só
 * nasce quando `initCharacterSprites()` roda.
 */
let _base: PIXI.BaseTexture | null = null;
function baseDoAtlas(): PIXI.BaseTexture {
  if (!_base) { _base = PIXI.BaseTexture.from(ATLAS_URL); _base.scaleMode = PIXI.SCALE_MODES.NEAREST; }
  return _base;
}

/**
 * A textura de um quadro: um RECORTE do atlas.
 *
 * ⚠️ QUADRO AUSENTE devolve `PIXI.Texture.EMPTY` em vez de estourar. O manifesto é gerado do disco no build,
 * então um nome errado aqui é erro de PROGRAMA — mas derrubar o boot inteiro do personagem por um quadro é
 * pior que desenhar um quadro vazio: a criança perde o jogo em vez de perder uma pose. O aviso vai ao console
 * para quem desenvolve, que é quem pode consertar.
 */
const pngTex = (f: string): PIXI.Texture => {
  const nome = f.replace(/\.png$/, '');
  const r = (FRAMES as Record<string, { x: number; y: number; w: number; h: number } | undefined>)[nome];
  if (!r) { console.warn('render/sprites: quadro fora do atlas:', nome); return PIXI.Texture.EMPTY; }
  return new PIXI.Texture(baseDoAtlas(), new PIXI.Rectangle(r.x, r.y, r.w, r.h));
};
const A = (anim: string, n: number): PIXI.Texture[] => Array.from({ length: n }, (_, i) => pngTex(anim + '/' + i + '.png')); // frames de cor

// TAPA-COSTURAS (temporário, até refazer os sprites no Aseprite): os frames do PixelLab deslocam o tronco na
// respiração/movimento e deixam uma FRESTA de 1px transparente no encaixe (o "fatiado"). Enche cada pixel transparente
// cercado por opaco à ESQUERDA e à DIREITA com a MÉDIA dos dois (a cor do tronco) — só 1px, então vãos legítimos
// (entre pernas/braços, largos) ficam intactos. Horizontal apenas (a cabeça sobe sem vão). Ver docs/plano-arte-procedural.md.
function inpaintSeams1px(id: ImageData): void {
  const d = id.data, w = id.width, h = id.height;
  for (let y = 0; y < h; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4; if (d[i + 3] !== 0) continue; // opaco → pula
    const l = (y * w + x - 1) * 4, r = (y * w + x + 1) * 4;
    if (d[l + 3] > 0 && d[r + 3] > 0) { // fresta de 1px (opaco dos dois lados) → cor do tronco (média esq/dir)
      d[i] = (d[l] + d[r]) >> 1; d[i + 1] = (d[l + 1] + d[r + 1]) >> 1; d[i + 2] = (d[l + 2] + d[r + 2]) >> 1; d[i + 3] = 255;
    }
  }
}
/**
 * Recorta o quadro `r` de `img`, tapa as costuras e SUBSTITUI o binding vivo `arr[idx]`.
 *
 * O RECORTE é o que mudou com o atlas (item 22): antes `img` era o PNG do quadro e o desenho ia em 0,0 com o
 * tamanho da imagem inteira; agora `img` é o ATLAS e o quadro é um retângulo dentro dele. Desenhar o atlas
 * inteiro aqui não estouraria — produziria um sprite com o personagem inteiro dentro, o que é exatamente o
 * tipo de defeito que passa por build e por teste e só aparece na tela.
 */
function aplicarInpaint(img: CanvasImageSource, r: { x: number; y: number; w: number; h: number }, arr: PIXI.Texture[], idx: number): void {
  try {
    const cv = makeCanvas(r.w, r.h), c = cv.getContext('2d'); if (!c) return;
    c.imageSmoothingEnabled = false;
    c.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    const id = c.getImageData(0, 0, r.w, r.h);
    inpaintSeams1px(id); c.putImageData(id, 0, 0);
    arr[idx] = tex(cv);
  } catch (e) { /* falhou -> mantem o recorte cru */ }
}

/**
 * Tapa as costuras do quadro `idx` REUSANDO a imagem que o PIXI já baixou.
 *
 * ========================= 55 REQUISIÇÕES PARA 38 ARQUIVOS =========================
 * Isto aqui abria um `new Image()` com a MESMA url que o `pngTex` acabara de pedir. Medido no navegador:
 * 55 requisições para 38 arquivos distintos, 16 deles baixados duas vezes — e `idle/0.png`, três. São
 * exatamente os 16 quadros que passam por aqui (idle, andar, correr), ou seja, os que a criança mais vê.
 *
 * Na minha máquina o custo foi ZERO em bytes (tudo do cache do navegador), e é justamente por isso que o
 * defeito sobreviveu tanto tempo: ele não aparece em nada que se meça daqui. Numa rede de escola com cache
 * frio, porém, são 16 idas e voltas a mais — e latência é o que dói lá, não os 66 KB do conjunto inteiro.
 *
 * A textura CRUA continua sendo criada pelo `pngTex` antes desta chamada, e tem de ser: o `TEX_*` precisa
 * existir e ser desenhável no primeiro quadro, muito antes de o inpaint terminar. O que muda é que o segundo
 * carregamento deixou de existir — a imagem que o PIXI já tem é a mesma que este código queria.
 *
 * MEXE NO INTERIOR DO PIXI (`baseTexture.resource.source`), e por isso o caminho antigo continua aqui como
 * REDE: se um dia essa forma mudar, o `instanceof HTMLImageElement` falha, o `new Image()` assume e as
 * costuras seguem tapadas. Sem a rede, a falha seria silenciosa e VISUAL — as frestas de 1px voltariam no
 * tronco do personagem e nenhum teste diria nada.
 */
function inpaintInto(file: string, arr: PIXI.Texture[], idx: number): void {
  const nome = file.replace(/\.png$/, '');
  const r = (FRAMES as Record<string, { x: number; y: number; w: number; h: number } | undefined>)[nome];
  if (!r) return; // quadro fora do atlas: `pngTex` já avisou, e sem retângulo não há o que recortar
  const base = arr[idx]?.baseTexture as (PIXI.BaseTexture & { resource?: { source?: unknown } }) | undefined;
  const doPixi = (): boolean => {
    const src = base?.resource?.source;
    if (!(src instanceof HTMLImageElement) || !src.complete || !src.naturalWidth) return false;
    aplicarInpaint(src, r, arr, idx);
    return true;
  };
  const buscarDeNovo = (): void => { // rede: só roda se a imagem do PIXI não estiver acessível
    const img = new Image();
    img.onload = () => aplicarInpaint(img, r, arr, idx);
    img.src = ATLAS_URL; // era o PNG do quadro; hoje é o atlas, e o recorte vem de `r`
  };
  if (doPixi()) return;
  if (base) base.once('loaded', () => { if (!doPixi()) buscarDeNovo(); });
  else buscarDeNovo();
}

let _loaded = false;
// Cria as texturas do personagem (I/O EXPLÍCITO). Idempotente. Chamado uma vez no boot do game.js; NUNCA no import.
// O alto-contraste REMAPEIA a cor no draw (tint/paleta), não recria a textura.
export function initCharacterSprites(): void {
  if (_loaded) return; _loaded = true;
  TEX_IDLE = A('idle', 4);   // RESPIRAÇÃO por frames (cabeça congelada → sem 'mastigar'; só o tronco respira)
  TEX_WALK = A('andar', 8);  // ANDAR = running-8 (postura ereta/leve) — José pediu manter estes como andar
  TEX_RUN = A('correr', 4);  // CORRER = sprint AGRESSIVA (inclinada, braços grandes)
  FLAVORS[0].tex = A('gracinha-joinha', 2);
  FLAVORS[1].tex = A('gracinha-espreguicar', 2);
  FLAVORS[2].tex = A('gracinha-aquecer', 1);
  TEX_JUMP_UP = pngTex('pulo/0.png'); TEX_JUMP_DOWN = pngTex('pulo/1.png'); // pose aérea (sobe recolhido / cai estendido)
  TEX_CLIMB = A('escada', 2); TEX_FLY = pngTex('voo/0.png');               // escada (vista de COSTAS) / voo
  TEX_CLING_WALL = A('parede', 4); TEX_CLING_CEIL = A('teto', 4);          // aranha: parede / teto (ciclos distintos)
  TEX_SWIM = A('nadar', 2); TEX_SWIMIDLE = A('nadar-parado', 2);           // nado MOVENDO / nado PARADO
  // Tapa-costuras (temporário) nos frames que respiram/movem no chão: idle + andar + correr. Assíncrono — substitui a
  // textura crua pela inpaintada quando o PNG termina de carregar (o game.js lê TEX_* por frame). Ver inpaintInto acima.
  for (let i = 0; i < 4; i++) inpaintInto('idle/' + i + '.png', TEX_IDLE, i);
  for (let i = 0; i < 8; i++) inpaintInto('andar/' + i + '.png', TEX_WALK, i);
  for (let i = 0; i < 4; i++) inpaintInto('correr/' + i + '.png', TEX_RUN, i);
}
