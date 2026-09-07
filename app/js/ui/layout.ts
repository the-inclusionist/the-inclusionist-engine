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
 * A RÉGUA DO ALVO DE TOQUE, INDEXADA PELA ALTURA DO VIEWPORT (ADR-0095, decisão do Dev).
 *
 * ⚠️ O ALVO DEIXOU DE SER UM NÚMERO E PASSOU A SER UMA FUNÇÃO DA TELA, e o motivo é um custo que o gate de
 * `pausa-44px` já tinha MEDIDO e deixado por resolver: a 640×360 o cartão de pausa não cabe e a lista ROLA.
 * Remedido em 06/09, porque o cartão mudou desde então: 391 px de conteúdo para 349 visíveis, ou seja 42 px
 * de excesso (o comentário antigo dizia 413/353). Um alvo de 44 px que exige rolagem para ser alcançado
 * pode custar mais dedo do que um de 24 px que está à vista.
 *
 * Os três degraus são os do Dev, e os dois extremos são as duas normas — não números de gosto:
 *
 *     altura ≥ 720   44 px   WCAG 2.2 · 2.5.5 Target Size (Enhanced) — AAA
 *     altura ≥ 540   34 px   o degrau do meio
 *     altura <  540  24 px   WCAG 2.2 · 2.5.8 Target Size (Minimum)  — AA
 *
 * ⚠️ ISTO É «MARCAR HONESTAMENTE ONDE SÓ DÁ AA», que é regra escrita do projeto — e não uma renúncia
 * silenciosa. O que se perde em 360 está registrado com número no ADR-0095: a 96 px/pol, 24 CSS px são
 * 6,4 mm, abaixo do alvo de polegar de 9,6 mm que o painel de toque deste jogo cita. É por isso que o
 * ESPAÇAMENTO entre alvos passa a ser o que protege o dedo onde o tamanho não pode — a mesma saída que a
 * própria 2.5.8 dá na sua exceção de spacing.
 */
export const REGUA_DE_ALVO: readonly { readonly altura: number; readonly alvo: number }[] = Object.freeze([
  { altura: 720, alvo: 44 },
  { altura: 540, alvo: 34 },
  { altura: 0, alvo: 24 },
]);

/**
 * O menor alvo de toque aceitável num viewport desta altura, em CSS px.
 *
 * ⚠️ NUNCA DEVOLVE MENOS DE 24: abaixo disso não é «AA num aparelho pequeno», é furar o piso da WCAG. Uma
 * tela mais baixa que 360 não compra o direito de encolher mais — compra o direito de mostrar menos itens.
 */
export function alvoMinimoDeToque(alturaCss: number): number {
  const h = Number.isFinite(alturaCss) ? alturaCss : 0;
  for (const degrau of REGUA_DE_ALVO) if (h >= degrau.altura) return degrau.alvo;
  return 24;
}

// A CONTAGEM DE JOGADORES entra por injeção desde 2026-08-26. Era `numPlayers`, um `let` de `core/state`
// importado como binding vivo — e um `let` de módulo é compartilhado por qualquer segundo jogo que a
// mesma página carregue (D13 do `demos`, ADR-0038). O que entra aqui é o GETTER da rodada que a raiz
// possui; o `let` que sobra guarda a função, não o número.
let _numJogadores: () => number = () => 1;
/** Liga a contagem de jogadores. Chamado uma vez pela raiz, antes do primeiro `layout()`. */
export function initLayout(deps: { numJogadores: () => number }): void { _numJogadores = deps.numJogadores; }

export function layout(): void {
  const wrap = $<HTMLElement>('#stage-wrap'); if (!wrap) return;
  wrap.style.paddingRight = '0px';
  const availW = wrap.clientWidth || 320;
  const availH = wrap.clientHeight || 180;
  // E11: a grade de telas define a base (1=320×180, 2=640×180, 3-4=640×360)
  const n = _numJogadores();
  // (`screenGrid(n)` SAIU em 2026-08-26: `cols`/`rows` eram desestruturados e nunca lidos — a escala sai de
  //  `screenBaseSize`, logo abaixo. Era uma chamada paga a cada `layout()` por nada. `noUnusedLocals` achou.)
  const { w: baseW, h: baseH } = screenBaseSize(n);
  // Piso k=2: CADA viewport tem no mínimo 640×360. Assim 2×2 = 1280×720 cabe num Chromebook do governo (1366×768).
  const MIN_K = 2;
  // ADR-001 (CORRIGIDO 2026-07-04): ESCALA travada em PIXELS REAIS INTEIROS. Cada pixel de arte = kDev pixels
  // FÍSICOS (inteiro) → scanlines SEMPRE regulares e arte uniforme em QUALQUER dpr. Tolera ≤5px lógicos de corte
  // por lado (o −10): base·kDev − avail·dpr ≤ 10·kDev ⇒ kDev ≤ avail·dpr/(base−10). (José escolheu inteiro-REAL.)
  const dpr = window.devicePixelRatio || 1;
  const kDev = Math.max(Math.round(MIN_K * dpr), Math.floor(Math.min(availW * dpr / (baseW - 10), availH * dpr / (baseH - 10))));
  const k = kDev / dpr; // fator LÓGICO/CSS (kDev = fator em pixels REAIS, inteiro)
  // ESCALA das vars de UI é ESCOPADA ao #game-region: só a UI DENTRO do canvas (menus/HUD/pausa/quiz) escala com o
  // k. Fora do canvas (barra de topo, painel de debug) herda o :root → texto SEMPRE 16px, toque 44px (José).
  const gr = $<HTMLElement>('#game-region'); if (gr) {
    gr.style.width = (baseW * k) + 'px'; gr.style.height = (baseH * k) + 'px';
    gr.style.setProperty('--hud-fs', Math.max(9, Math.round(180 * k * 0.052)) + 'px');
    gr.style.setProperty('--ui-fs', (8 * k) + 'px');   // base LÓGICA 8px × k (16px em k=2)
    gr.style.setProperty('--tap', (22 * k) + 'px');    // toque 22px × k (44px em k=2, piso WCAG)
  }
  crtScanVars(); // scanlines re-alinham quando a escala k muda
  if (/[?&]debug=true/.test(location.search)) console.info(`[escala] kDev=${kDev}× px REAIS (canvas físico ${baseW * kDev}×${baseH * kDev} = múltiplo INTEIRO de ${baseW}×${baseH}); CSS ${Math.round(baseW * k)}×${Math.round(baseH * k)} (k=${k.toFixed(3)}, dpr=${dpr})`);
}
