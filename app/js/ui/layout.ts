// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/layout.ts — ESCALA do jogo (Estágio 4, Tier 1). Trava o #game-region num múltiplo inteiro de PIXELS REAIS
// de 320×180 (por jogador) e reescala as vars de UI escopadas ao canvas. Deps: ui/dom ($), core/screens,
// render/crt (crtScanVars). A contagem de jogadores entra por `initLayout`. fpsTick/configureRender seguem no main.js.
//
// JÁ NÃO RESERVA ESPAÇO PARA O INTÉRPRETE. Reservava 380px à direita quando o painel do VLibras "abria", e o
// jogo deslocava para a esquerda — decisão revista pelo Dev: o intérprete deve aparecer NA FRENTE da tela
// enquanto um áudio toca, e sumir. E a reserva estava sendo aplicada O TEMPO TODO, porque o detector de
// "aberto" lia um div vazio (ver o cabeçalho de ui/vlibras): o canvas vivia em `left: -136`, fora da tela,
// com ou sem modo pessoa surda. O acoplamento vlibras↔layout desaparece junto.
import { $ } from './dom.js';
import { screenBaseSize } from '../core/screens.js';

import { crtScanVars } from '../render/crt.js';

/**
 * THE TOUCH TARGET FLOOR, in CSS px, for a CSS scale factor `k` (ADR-0163).
 *
 * 🔴 IT WAS A RULER BY VIEWPORT HEIGHT (ADR-0095: 24 px under 540, 34 under 720, 44 above), because a 640×360 pause
 * card with 44 px items scrolled. ADR-0163 made the resolution the engine's — never under 640×360 — and the Dev set the
 * target — «44px é o correto, eu errei quando disse 42px» — so the floor is 44 px at the minimum (k = 2) and
 * grows with the scale, like the text; there is no smaller screen left to shrink for.
 */
export function minimumTarget(k: number): number {
  return 22 * (Number.isFinite(k) && k > 2 ? k : 2);
}

/** One node inside the region, as measured by whoever calls: its computed font size if it holds text, its box if it is a target. */
export interface NodeMeasure {
  readonly name: string;
  readonly daEngine: boolean;
  readonly fontPx: number | null;
  readonly target: { readonly w: number; readonly h: number } | null;
}

/**
 * WHAT A CARTRIDGE DRAWS UNDER THE FLOOR (ADR-0163 rule 4): text under 8·k px (16 at 640×360) and targets whose SMALLER
 * side is under 22·k px (44 at 640×360). The engine's own nodes are not the cartridge's to answer for, and a node with no
 * area is not drawn. Half a pixel of slack absorbs subpixel layout.
 */
export function belowFloor(nodes: readonly NodeMeasure[], k: number): { text: string[]; targets: string[] } {
  const ratio = minimumTarget(k) / 22;
  const texto: string[] = [];
  const smallTargets: string[] = [];
  for (const n of nodes) {
    if (n.daEngine) continue;
    if (n.fontPx !== null && n.fontPx > 0 && n.fontPx < 8 * ratio - 0.5) texto.push(n.name);
    if (n.target && n.target.w > 0 && n.target.h > 0 && Math.min(n.target.w, n.target.h) < minimumTarget(k) - 0.5) smallTargets.push(n.name);
  }
  return { text: texto, targets: smallTargets };
}

/**
 * OS NÓS DO JOGO QUE INVADEM O RECTÂNGULO DA BARRA DE ACESSIBILIDADE (ADR-0148 §3).
 *
 * 🔴 MEDIDO no `dist/quiz.html` em 2026-09-12, e a queixa do Dev é literal na tela: `#title-icons` é
 * `position:absolute` DENTRO do `#game-region`, em (123,15) 337×44 — e o `H2.quiz-pergunta`, o título da
 * pergunta, ocupa os mesmos pixels. A criança que procura o modo cego encontra texto por cima dos botões.
 *
 * ⚠️ E NADA FALHAVA. Não há erro, não há tipo, não há consola: só uma fila de botões tapada — e quem mais
 * depende dela é precisamente quem não vê que ela está tapada.
 *
 * 📌 PURA E COM AS CAIXAS INJECTADAS, para o crivo a poder conduzir sem navegador. Quem mede é quem chama;
 * o que esta função decide é o que CONTA como invasão, que é a parte que se erra.
 *
 * ⚠️ IGNORA OS DESCENDENTES DA PRÓPRIA BARRA: os botões dela intersectam-na por definição, e contá-los faria
 * o crivo acusar sempre — o defeito que o ADR-0106 §2 chama de afogar o que se pode resolver.
 */
export interface NamedBox { readonly name: string; readonly box: Box; readonly isBar: boolean; }
export interface Box { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export function barIntruders(barBox: Box | null, nodes: readonly NamedBox[]): string[] {
  // Uma barra sem área não reserva nada — e acusar contra um rectângulo de zero seria acusar toda a gente.
  if (!barBox || barBox.w <= 0 || barBox.h <= 0) return [];
  // ⚠️ O GUARDA DE ÁREA ZERO FAZ TRABALHO, e eu quase o tirei por uma leitura errada. Uma mutação que o
  // removia ficou VERDE, e a minha conclusão — «as desigualdades estritas já excluem quem não tem área» —
  // era falsa: elas excluem um nó DEGENERADO NA FRONTEIRA, não um em geral. Uma risca de largura zero
  // atravessando a barra passa nas quatro comparações. 📌 Contentores de altura ou largura zero são comuns
  // em markup gerado, e acusá-los seria ruído puro — que é como se ensina um consumidor a ignorar a linha.
  return nodes
    .filter((n) => !n.isBar && n.box.w > 0 && n.box.h > 0)
    .filter((n) => n.box.x < barBox.x + barBox.w && barBox.x < n.box.x + n.box.w
      && n.box.y < barBox.y + barBox.h && barBox.y < n.box.y + n.box.h)
    .map((n) => n.name);
}


// A CONTAGEM DE JOGADORES entra por injeção desde 2026-08-26. Era `numPlayers`, um `let` de `core/state`
// importado como binding vivo — e um `let` de módulo é compartilhado por qualquer segundo jogo que a
// mesma página carregue (D13 do `demos`, ADR-0038). O que entra aqui é o GETTER da rodada que a raiz
// possui; o `let` que sobra guarda a função, não o número.
let _countPlayers: () => number = () => 1;
/** Liga a contagem de jogadores. Chamado uma vez pela raiz, antes do primeiro `layout()`. */
export function initLayout(deps: { numPlayers: () => number }): void { _countPlayers = deps.numPlayers; }

/**
 * A CASCA QUE DÁ O ESPAÇO DISPONÍVEL — por id OU por classe, e as duas formas valem o mesmo.
 *
 * ⚠️ ERA SÓ `#stage-wrap`, E ISSO DEIXOU A ENGINE SEM ESCALA NO PRÓPRIO HOST. O `app/index.html` do jogo
 * trazia `<div id="stage-wrap">`; quando o cartucho saiu (issue #111) sobrou o `app/quiz.html`, que tem
 * `<div class="stage-wrap">`. A procura por id falhava, `layout()` fazia early-return, e **nada reportava
 * nada**: um `return` silencioso é indistinguível de «não havia o que fazer». O comentário do próprio
 * `quiz.html` dizia «mesmo id que ui/layout escala» — quem o escreveu acreditava que corria.
 *
 * O consumidor não erra ao usar a classe: um documento pode ter várias telas, e um id é único. Aceitar as
 * duas é o que torna a engine consumível por quem não copiou o markup dela.
 */
function findStageWrap(): HTMLElement | null {
  return $<HTMLElement>('#stage-wrap') ?? $<HTMLElement>('.stage-wrap');
}

/**
 * The scale ADR-0001 gives a stage: the factor in REAL pixels (whole, except at the floor — ADR-0179), the CSS factor, and
 * the region's CSS size.
 */
export interface Scale { readonly kDev: number; readonly k: number; readonly width: number; readonly height: number }

/**
 * ADR-0001 AS A PURE FUNCTION — so the engine can apply it to every cartridge (ADR-0163) and a test can pin it.
 *
 * Integer multiple of 320×180 (per the screen grid) in REAL pixels; up to 5 logical px of crop per side when that buys one
 * more step (the `−10`: `base·kDev − avail·dpr ≤ 10·kDev`). Never under 2 CSS px per logical pixel — 640×360 CSS, text 16 px,
 * targets 44 px: where the whole multiple gives less (a fractional display scale on the minimum window) the scale is exactly
 * 2 CSS px, whole in real pixels or not, because WCAG 2.2 AA decides (ADR-0179).
 */
export function stageScale(availW: number, availH: number, dpr: number, baseW: number, baseH: number): Scale {
  const MIN_K = 2;
  const integerK = Math.floor(Math.min(availW * dpr / (baseW - 10), availH * dpr / (baseH - 10)));
  const kDev = integerK / dpr >= MIN_K ? integerK : MIN_K * dpr;
  const k = kDev / dpr;
  return { kDev, k, width: baseW * k, height: baseH * k };
}

/**
 * Writes a scale onto the game region: its size, and the UI variables that grow with it.
 *
 * ⚠️ HOST-INJECTED (the region is passed in): `createGame` serves documents that
 * are not the global one — the fault the root's finding 15 names about reaching `document` from under the injection.
 */
export function applyScale(region: HTMLElement, e: Scale): void {
  region.style.width = e.width + 'px'; region.style.height = e.height + 'px';
  region.style.setProperty('--hud-fs', Math.max(9, Math.round(180 * e.k * 0.052)) + 'px');
  region.style.setProperty('--ui-fs', (8 * e.k) + 'px');   // base LÓGICA 8px × k (16px em k=2)
  // One ruler (plan phase 5b): `--tap` is the name three sibling games read, `--alvo-min` the engine's (ADR-0163); both come
  // from `minimumTarget`, so a display scale that gives k under 2 (Windows 110%) no longer drops `--tap` under 44 px.
  region.style.setProperty('--tap', minimumTarget(e.k) + 'px');
  region.style.setProperty('--alvo-min', minimumTarget(e.k) + 'px'); // 44 px at 640×360, growing with k (ADR-0163)
}

export function layout(): void {
  const wrap = findStageWrap(); if (!wrap) return;
  wrap.style.paddingRight = '0px';
  const availW = wrap.clientWidth || 320;
  const availH = wrap.clientHeight || 180;
  // E11: a grade de telas define a base (1=320×180, 2=640×180, 3-4=640×360)
  const n = _countPlayers();
  // (`screenGrid(n)` SAIU em 2026-08-26: `cols`/`rows` eram desestruturados e nunca lidos — a escala sai de
  //  `screenBaseSize`, logo abaixo. Era uma chamada paga a cada `layout()` por nada. `noUnusedLocals` achou.)
  const { w: baseW, h: baseH } = screenBaseSize(n);
  // Piso k=2: CADA viewport tem no mínimo 640×360. Assim 2×2 = 1280×720 cabe num Chromebook do governo (1366×768).
  // ADR-001 (CORRIGIDO 2026-07-04): ESCALA travada em PIXELS REAIS INTEIROS. Cada pixel de arte = kDev pixels
  // FÍSICOS (inteiro) → scanlines SEMPRE regulares e arte uniforme em QUALQUER dpr. Tolera ≤5px lógicos de corte
  // por lado (o −10): base·kDev − avail·dpr ≤ 10·kDev ⇒ kDev ≤ avail·dpr/(base−10). (José escolheu inteiro-REAL.)
  // A conta mora em `stageScale` desde o ADR-0163, para a engine a aplicar a todo cartucho.
  const dpr = window.devicePixelRatio || 1;
  const ratio = stageScale(availW, availH, dpr, baseW, baseH);
  const { kDev, k } = ratio;
  // ESCALA das vars de UI é ESCOPADA ao #game-region: só a UI DENTRO do canvas (menus/HUD/pausa/quiz) escala com o
  // k. Fora do canvas (barra de topo, painel de debug) herda o :root → texto SEMPRE 16px, toque 44px (José).
  const gr = $<HTMLElement>('#game-region'); if (gr) {
    // `--tap` é o tamanho PREFERIDO (22·k) e `--alvo-min` o CHÃO (22·k, 44 px a 640×360 — ADR-0163), escritos em `applyScale`.
    applyScale(gr, ratio);
  }
  crtScanVars(); // scanlines re-alinham quando a escala k muda
  if (/[?&]debug=true/.test(location.search)) console.info(`[escala] kDev=${kDev}× px REAIS (canvas físico ${baseW * kDev}×${baseH * kDev} = múltiplo INTEIRO de ${baseW}×${baseH}); CSS ${Math.round(baseW * k)}×${Math.round(baseH * k)} (k=${k.toFixed(3)}, dpr=${dpr})`);
}
