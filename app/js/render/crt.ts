// SPDX-License-Identifier: AGPL-3.0-or-later
// render/crt.ts — estética CRT (menu Sensibilidade visual): scanlines/vinheta/cantos, só CSS (classes em
// #game-region). Extraído do game.js (Estágio 4, Tier 1). CRT = config {scan,vig,round} (0=off,1,2; scan/vig são
// on/off) carregada do localStorage com migração do formato antigo booleano. crtScanVars ancora a scanline em
// PIXELS REAIS (recomputa da altura real do #game-region + dpr → 1 linha por pixel de arte, espaçamento regular).
// Auto-contido: depende de core/dom-query ($). A contagem de jogadores entra por `initCrt` (ver abaixo).
import { $ } from '../core/dom-query.js';

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
let _playerCount: () => number = () => 1;
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
let _a11yVisualActive: () => boolean = () => false;
/** Liga a contagem de jogadores e a pergunta de a11y. Chamado uma vez pela raiz, antes do 1º `applyCrt()`. */
export function initCrt(deps: { numJogadores: () => number; a11yVisualAtiva: () => boolean }): void {
  _playerCount = deps.numJogadores;
  _a11yVisualActive = deps.a11yVisualAtiva;
}

export const CRT: CrtCfg = crtFromStored(store.get(store.KEYS.crt, null), store.get(store.KEYS.crtLegacy, null));

/**
 * The CRT a machine kept, from the two formats it may hold. The current one wins; the OLD one (all booleans) is migrated:
 * the vignette and the corners come across, and the scanlines come back ON once, because they became the default after
 * that format existed. Scanlines and vignette are on/off; only the corners have three levels.
 */
function crtFromStored(current: string | null, legacy: string | null): CrtCfg {
  const d: CrtCfg = { ...CRT_DEFAULT };
  const record = storedRecord(current, legacy);
  const migrating = !current;
  for (const k of Object.keys(d) as (keyof CrtCfg)[]) {
    if (record && k in record && !(migrating && k === 'scan')) d[k] = levelOf(k, record[k]);
  }
  d.scan = d.scan ? 1 : 0; d.vig = d.vig ? 1 : 0;
  return d;
}

/** The record a machine kept, the current format first — or `null` where there is none a CRT can be read from. */
function storedRecord(current: string | null, legacy: string | null): Record<string, unknown> | null {
  try {
    const s: unknown = JSON.parse(current || legacy || 'null');
    // a number or a string is not a record: reading keys in it would throw, and the answer is the factory CRT
    return s && typeof s === 'object' ? s as Record<string, unknown> : null;
  } catch { return null; } // a record that cannot be read is the factory CRT, never a broken boot
}

/** One stored value as a level: the old format's `true`/`false` mapped (round corners on are the ROUNDEST), the rest 0–2. */
function levelOf(k: keyof CrtCfg, v: unknown): number {
  if (v === true) return k === 'round' ? 2 : 1;
  if (v === false) return k === 'round' ? 1 : 0;
  return Math.max(0, Math.min(2, (v as number) | 0));
}

// Ancora a scanline em px REAIS: 1 linha por pixel de ARTE (kDev inteiro) → espaçamento SEMPRE regular em qualquer dpr.
export function crtScanVars(): void {
  const g = $<HTMLElement>('#game-region'); if (!g || !CRT.scan) return;
  const { rows } = screenGrid(_playerCount()), dpr = window.devicePixelRatio || 1;
  const perDev = Math.max(2, Math.round((g.clientHeight || 360) * dpr / (180 * rows))); // kDev = px REAIS por linha de arte (INTEIRO)
  g.style.setProperty('--scan-per', (perDev / dpr) + 'px'); // período = kDev px reais (1 linha de arte)
  g.style.setProperty('--scan-line', (Math.max(1, Math.round(dpr)) / dpr) + 'px'); // linha = 1 px REAL
}

// Aplica as classes CSS de CRT ao #game-region e persiste. Chamado no boot e ao mexer no menu.
export function applyCrt(): void {
  const g = $<HTMLElement>('#game-region'); if (!g) return;
  ['crt-scan-1', 'crt-vig-1', 'crt-round-0', 'crt-round-2'].forEach((c) => g.classList.remove(c));
  // OS DOIS EFEITOS CEDEM À ACESSIBILIDADE, SEM EXCEÇÃO (ADR-0020 + ADR-0047).
  //
  // Houve uma versão com uma chave de escape por efeito, a pedido do Dev. Ele a removeu depois de VER o
  // resultado na tela: "Ceder fez muito bem ao jogo nos modos de acessibilidade". Fica anotado porque a
  // ausência da chave é decisão, não esquecimento — e porque o pilar 2 volta a não ter exceção nenhuma.
  //
  // O valor gravado NÃO é alterado: a preferência continua lá e volta a valer sozinha ao sair do modo de
  // acessibilidade. Suprimir não é desligar — é a distinção que impede a criança de perder o que escolheu
  // toda vez que liga o alto contraste.
  const a11y = _a11yVisualActive();
  if (CRT.scan && !a11y) { g.classList.add('crt-scan-' + CRT.scan); crtScanVars(); }
  if (CRT.vig && !a11y) g.classList.add('crt-vig-' + CRT.vig);
  if (CRT.round !== 1) g.classList.add('crt-round-' + CRT.round); // 1 = visual padrão (8px), sem classe
  store.setJSON(store.KEYS.crt, CRT);
}
