// SPDX-License-Identifier: AGPL-3.0-or-later
// render/crt.ts — estética CRT (menu Sensibilidade visual): scanlines/vinheta/cantos, só CSS (classes em
// #game-region). Extraído do game.js (Estágio 4, Tier 1). CRT = config {scan,vig,round} (0=off,1,2; scan/vig são
// on/off) carregada do localStorage com migração do formato antigo booleano. crtScanVars ancora a scanline em
// PIXELS REAIS (recomputa da altura real do #game-region + dpr → 1 linha por pixel de arte, espaçamento regular).
// Auto-contido: depende de ui/dom ($). A contagem de jogadores entra por `initCrt` (ver abaixo).
import { $ } from '../ui/dom.js';

import { screenGrid } from '../core/screens.js';
import * as store from '../platform/storage.js';

type CrtCfg = { scan: number; vig: number; round: number };
// scanline LIGADA por padrão (decisão do José 2026-07-03). Migra incl_crt (booleano) → incl_crt2 (níveis 0..2).
/** O CRT de fábrica. Ganhou nome porque o "restaurar padrões" do menu (ADR-0028) precisa do MESMO valor que
 *  a carga do boot usa quando nada foi salvo — duas cópias seriam duas chances de o reset devolver um CRT que
 *  o jogo nunca mostrou. Congelado: um padrão que alguém consiga escrever em tempo de execução não é padrão. */
export const CRT_DEFAULT: Readonly<CrtCfg> = Object.freeze({ scan: 1, vig: 0, round: 1 });

// A CONTAGEM DE JOGADORES entra por injeção desde 2026-08-26. Era `numPlayers`, um `let` de `core/state`
// importado como binding vivo — e um `let` de módulo é compartilhado por qualquer segundo jogo que a
// mesma página carregue (D13 do `demos`, ADR-0038). O que entra aqui é o GETTER da rodada que a raiz
// possui; o `let` que sobra guarda a função, não o número.
let _numJogadores: () => number = () => 1;
/**
 * ALGUM jogador está num modo de acessibilidade visual? (qualquer coisa que não seja `normal`.)
 *
 * O ADR-0020 decide: "modos de a11y SUPRIMEM o CRT/efeitos decorativos — precedência a11y > estética". Isso
 * nunca tinha sido implementado, e a emenda de 2026-08-26 mediu: com a vinheta ligada, `crt-vig-1` sobrevivia
 * em `hc-direto`, `fix-deuter`, `lv-blur` e `blind`. Uma vinheta escurecendo as bordas trabalha contra o modo
 * que existe para AUMENTAR contraste.
 *
 * `ALGUM` e não "o jogador 1": o CRT é decoração GLOBAL, uma só para a tela inteira. Não há como escurecer as
 * bordas de meia tela. Se a decoração e a acessibilidade de qualquer criança se contradizem, quem cede é a
 * decoração — que é literalmente o que "precedência a11y > estética" quer dizer.
 */
let _a11yVisualAtiva: () => boolean = () => false;
/** Liga a contagem de jogadores e a pergunta de a11y. Chamado uma vez pela raiz, antes do 1º `applyCrt()`. */
export function initCrt(deps: { numJogadores: () => number; a11yVisualAtiva: () => boolean }): void {
  _numJogadores = deps.numJogadores;
  _a11yVisualAtiva = deps.a11yVisualAtiva;
}

export const CRT: CrtCfg = (() => {
  const d: CrtCfg = { ...CRT_DEFAULT };
  try {
    const s = JSON.parse(store.get(store.KEYS.crt, null) || store.get(store.KEYS.crtLegacy, null) || 'null');
    const fresh = !store.get(store.KEYS.crt, null); // migração p/ crt2: herda vig/round; scan volta ao padrão ON uma vez
    if (s && typeof s === 'object') for (const k in d) if (k in s) {
      const v = s[k];
      if (fresh && k === 'scan') continue;
      (d as Record<string, number>)[k] = v === true ? (k === 'round' ? 2 : 1) : v === false ? (k === 'round' ? 1 : 0) : Math.max(0, Math.min(2, v | 0));
    }
  } catch (e) { /* noop: file:// / modo privado */ }
  d.scan = d.scan ? 1 : 0; d.vig = d.vig ? 1 : 0; // scanlines/vinheta são ON/OFF (só cantos têm 3 níveis)
  return d;
})();

// Ancora a scanline em px REAIS: 1 linha por pixel de ARTE (kDev inteiro) → espaçamento SEMPRE regular em qualquer dpr.
export function crtScanVars(): void {
  const g = $<HTMLElement>('#game-region'); if (!g || !CRT.scan) return;
  const { rows } = screenGrid(_numJogadores()), dpr = window.devicePixelRatio || 1;
  const perDev = Math.max(2, Math.round((g.clientHeight || 360) * dpr / (180 * rows))); // kDev = px REAIS por linha de arte (INTEIRO)
  g.style.setProperty('--scan-per', (perDev / dpr) + 'px'); // período = kDev px reais (1 linha de arte)
  g.style.setProperty('--scan-line', (Math.max(1, Math.round(dpr)) / dpr) + 'px'); // linha = 1 px REAL
}

// Aplica as classes CSS de CRT ao #game-region e persiste. Chamado no boot e ao mexer no menu.
export function applyCrt(): void {
  const g = $<HTMLElement>('#game-region'); if (!g) return;
  ['crt-scan-1', 'crt-vig-1', 'crt-round-0', 'crt-round-2'].forEach((c) => g.classList.remove(c));
  if (CRT.scan) { g.classList.add('crt-scan-' + CRT.scan); crtScanVars(); }
  // A VINHETA CEDE PARA A ACESSIBILIDADE (ADR-0020: "modos de a11y suprimem o CRT decorativo").
  //
  // ⚠️ A SCANLINE NÃO CEDE, e isso é escolha declarada, não descuido. O registro nomeia `CRT_VIGNETTE` e
  // "flashes decorativos"; a scanline não está na lista, e ela é a única das três que vem LIGADA de fábrica.
  // Suprimi-la mudaria a aparência de todo mundo que usa qualquer modo de visão, e essa é decisão de produto
  // — não a tomo por conta própria a partir de uma lista que não a menciona. Fica registrada como pergunta.
  //
  // O valor de `CRT.vig` NÃO é alterado: a preferência da criança continua gravada, e volta a valer sozinha
  // quando ela sair do modo de acessibilidade. Suprimir não é desligar.
  if (CRT.vig && !_a11yVisualAtiva()) g.classList.add('crt-vig-' + CRT.vig);
  if (CRT.round !== 1) g.classList.add('crt-round-' + CRT.round); // 1 = visual padrão (8px), sem classe
  store.setJSON(store.KEYS.crt, CRT);
}
