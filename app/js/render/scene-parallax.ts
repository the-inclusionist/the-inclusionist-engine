// SPDX-License-Identifier: GPL-3.0-or-later
// render/scene-parallax — parallax background TEXTURE generators (Estágio 4, Tier 2). Pure builders: given a
// theme (or a city-placeholder index) they return a PIXI texture. Formulas verbatim from game.js (v3 drawBackdrop
// / drawHillBand). The per-frame scroll (`updateParallax`) stays in game.js — it is render-graph glue (moves the
// TilingSprites + the sky-deco layers). See docs/5-Refactoring/plano-modularizacao-mapa.md.

import { makeCanvas, tex } from './canvas.js';
import { LOGICAL_H } from '../core/constants.js';

/** A scenery theme's parallax colors. */
export interface ParallaxTheme {
  sky: readonly [string, string];
  hills: readonly [string, string];
}

/** Hill silhouette height at column `x` (v3 drawHillBand: double sine). `near` = the front (taller) band. */
export function hillHeight(x: number, near: boolean): number {
  const amp = near ? 9 : 5, freq = near ? 0.013 : 0.018, phase = near ? 0 : 140;
  return Math.sin((x + phase) * freq) * amp + Math.sin((x + phase) * freq * 2.3 + 1.7) * amp * 0.4;
}

/** City placeholder backdrop (the 4 v3 themes have their own sky/hills below). */
export function parallaxPlaceholder(i: number): unknown {
  const w = 320, h = LOGICAL_H, cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  const pal = [['#0a1024', '#1b2350'], ['#13284a', '#22406e'], ['#1d3a52', '#356a86']][i]!;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, pal[0]!); g.addColorStop(1, pal[1]!); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = pal[1]!;
  for (let x = 0; x < w; x += 44 + i * 14) { const hh = 24 + ((x * 7 + i * 29) % (46 + i * 22)); c.fillRect(x, h - hh, 30 + i * 6, hh); }
  c.fillStyle = 'rgba(255,255,255,.18)'; for (let k = 0; k < 8; k++) c.fillRect((k * 53 + i * 17) % w, (k * 23 + i * 11) % (h - 40), 2, 2);
  return tex(cv);
}

/** Theme sky: pure vertical gradient (v3 drawBackdrop). */
export function themeSkyTexture(T: ParallaxTheme): unknown {
  const w = 64, h = LOGICAL_H, cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
  return tex(cv);
}

/* ===================== silhuetas por tema ===================== */
//
// AS DUAS FAIXAS DE MORRO ERAM LISAS. Elas já parallaxavam — o que faltava era CONTEÚDO: uma floresta e um
// cemitério tinham exatamente o mesmo desenho, só que em cores diferentes. Isto acrescenta a silhueta que
// distingue um do outro, na MESMA cor da faixa: é recorte contra o céu, não pintura.
//
// PURO E DETERMINÍSTICO, e isso não é preferência. Sem `Math.random`, a mesma fase desenha o mesmo horizonte
// em toda partida e em toda máquina — o que a torna testável (dá para AFERIR a silhueta) e o que impede a
// arte de tremer entre dois quadros do mesmo cenário. A variação vem de `hash(x)`, que é sujeira reprodutível.

/** Ruído reprodutível em [0,1) a partir de um inteiro. Substitui `Math.random` onde a arte precisa variar. */
export function hash01(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Desenha UM elemento de silhueta. `topo` é a linha do morro naquele x; tudo cresce para cima a partir dela. */
type Elemento = (c: CanvasRenderingContext2D, x: number, topo: number, alt: number) => void;

/** Conífera: tronco fino e três saias triangulares. Lê como "mata fechada" mesmo com 6 px de largura. */
const conifera: Elemento = (c, x, topo, alt) => {
  c.fillRect(x - 1, topo - alt * 0.25, 2, alt * 0.25);
  for (let i = 0; i < 3; i++) {
    const y = topo - alt * (0.25 + i * 0.25), meia = (alt * 0.30) * (1 - i * 0.22);
    c.beginPath(); c.moveTo(x, y - alt * 0.30); c.lineTo(x + meia, y); c.lineTo(x - meia, y); c.closePath(); c.fill();
  }
};

/** Árvore redonda: tronco curto e copa em bloco arredondado — o campo, não a mata. */
const frondosa: Elemento = (c, x, topo, alt) => {
  c.fillRect(x - 1, topo - alt * 0.45, 2, alt * 0.45);
  c.beginPath(); c.arc(x, topo - alt * 0.68, alt * 0.34, 0, Math.PI * 2); c.fill();
};

/** Poste de cerca com duas travessas — dá escala humana ao campo, que é o que o diferencia da mata. */
const cerca: Elemento = (c, x, topo, alt) => {
  c.fillRect(x - 1, topo - alt, 2, alt);
  c.fillRect(x - 1, topo - alt * 0.75, 14, 1);
  c.fillRect(x - 1, topo - alt * 0.45, 14, 1);
};

interface Silhueta { el: Elemento; passo: number; alt: [number, number] }

/**
 * O MESMO CAMPO EM TRÊS HORAS DO DIA. `campo`, `cemiterio` e `espaco` são "Dia no Campo", "Amanhecer no Campo"
 * e "Noite no Campo" — é o que a criança lê, e é a decisão do Dev. Os IDS MENTEM: sobraram de quando os temas
 * eram cemitério e espaço, e ninguém que leia só o código adivinha isso. (Eu quase plantei lápides num
 * amanhecer por causa deles; a correção veio do Dev, não do arquivo.) Renomear os ids é migração de dado
 * persistido — `incl_cenario` e as gravações de demonstração guardam esses nomes —, então fica para uma
 * rodada própria, e este comentário é a rede até lá.
 *
 * Consequência de desenho, e ela simplifica: os três compartilham A MESMA SILHUETA, porque é a mesma terra.
 * O que muda entre o dia, o amanhecer e a noite é a LUZ, e a luz já está nas cores que cada tema declara.
 * Silhuetas diferentes fariam parecer três lugares; iguais, fazem parecer um lugar e três horários.
 *
 * `passo` é o espaçamento médio; `alt` a faixa de altura em px. A faixa da FRENTE leva elementos maiores e
 * mais juntos — é a que passa mais rápido, e esse contraste de densidade é o que dá profundidade sem custar
 * uma terceira camada.
 */
const CAMPO = { far: { el: frondosa, passo: 96, alt: [10, 16] as [number, number] },
                near: { el: cerca, passo: 46, alt: [7, 9] as [number, number] } };

export const SILHUETAS: Readonly<Record<string, { far?: Silhueta; near?: Silhueta }>> = {
  campo: CAMPO,      // Dia no Campo
  cemiterio: CAMPO,  // Amanhecer no Campo — mesmo campo, outra luz
  espaco: CAMPO,     // Noite no Campo — idem
  // AJUSTADO DEPOIS DE VER NA TELA. Os números antigos (far 14–22, near 22–34) faziam as DUAS faixas
  // terminarem no mesmo y: com `baseY` 12 px mais baixo na da frente, as duas silhuetas encostavam no mesmo
  // topo e liam como UMA. A conta confirmou o que a imagem mostrou — topo 72 nas duas.
  // Agora a de trás é uma MATA FECHADA distante (baixa e densa) e a da frente são TRONCOS individuais
  // (altos e esparsos). A profundidade vem do contraste entre parede e indivíduo, não de 12 px de deslocamento.
  floresta:  { far: { el: conifera, passo: 18, alt: [8, 13] }, near: { el: conifera, passo: 46, alt: [30, 46] } },
};

/**
 * Theme hills band (v3 drawHillBand): double sine, transparent above the silhouette. `near` = the front band.
 * `tema` escolhe a silhueta plantada em cima da faixa; sem tema conhecido, sai a faixa lisa de antes.
 */
export function themeHillsTexture(T: ParallaxTheme, near: boolean, tema = ''): unknown {
  const w = 1280, h = LOGICAL_H, cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  const horizon = Math.round(h * 0.5), baseY = horizon + (near ? 16 : 4);
  const linha = (x: number): number => Math.round(baseY - hillHeight(x, near));
  c.fillStyle = T.hills[near ? 1 : 0];
  for (let x = 0; x < w; x++) { const top = linha(x); c.fillRect(x, top, 1, h - top); }

  const sil = SILHUETAS[tema]?.[near ? 'near' : 'far'];
  if (!sil) return tex(cv);
  // Planta na MESMA cor da faixa: o elemento não é um objeto pintado, é o próprio morro subindo.
  for (let x = 0; x < w; x += sil.passo) {
    const r = hash01(x + (near ? 977 : 131));
    const px = Math.round(x + r * sil.passo * 0.6);
    if (px < 4 || px > w - 20) continue; // margem: nada atravessa a emenda do azulejo horizontal
    const alt = sil.alt[0] + hash01(px * 31 + (near ? 7 : 3)) * (sil.alt[1] - sil.alt[0]);
    sil.el(c, px, linha(px) + 1, alt);
  }
  return tex(cv);
}
