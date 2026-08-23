// SPDX-License-Identifier: GPL-3.0-or-later
// ui/settings-motion.ts — "Sensibilidade visual" → painel Movimento (#animation overlay): reduce-motion (WCAG
// 2.3.3 + Pause/Stop/Hide 2.2.2) por PERSONAGEM (andar/respirar/gracinhas) e por CENA (parallax/decor/itens/
// partículas), o botão-mestre "Parar/Retomar todas as animações", a seleção de jogador (selAnimPlayer) e a
// estética CRT (scanlines/vinheta/cantos) — que também mora nesta MESMA tela no game.js original (renderMotion
// escreve os dois blocos no mesmo #motion-list), por isso vem junto. Lógica PURA (rótulos, HTML, allMotionFrozen,
// anúncios) separada do DOM. INJETADO via initSettingsMotion(ctx): $ (seletor), srSay, store (persistência),
// frontOverlay/toggleBtn (helpers compartilhados com os painéis irmãos: visual/audio/typo/empathy/controls/
// motor), e rm/saveRM/RM_KEYS/RM_CHAR (estado de movimento reduzido — fica em game.js porque applyCalm(), o
// modo TEA, também os usa; não é exclusivo deste painel). `players`/`numPlayers` (core/state.ts) e CRT/applyCrt
// (render/crt.ts, já extraído) são importados DIRETO — são módulos-folha, não game.js. A API de render/fx.ts
// NÃO é referenciada aqui: renderMotion() nunca leu/escreveu JUICE (só o painel ?debug o faz) — ver nota no
// retorno da extração antes de assumir que falta wiring.
import { players, numPlayers } from '../core/state.js';
import { CRT, applyCrt } from '../render/crt.js';

export type MotionSceneKey = 'parallax' | 'decor' | 'items' | 'particles';
export type MotionCharProp = 'rmWalk' | 'rmBreath' | 'rmFlavor';

export interface MotionCharDef {
  readonly prop: MotionCharProp;
  readonly lbl: string;
}
export type MotionPlayer = Partial<Record<MotionCharProp, boolean>>;
export type MotionSceneFlags = Record<MotionSceneKey, boolean>;

export interface SettingsMotionCtx {
  /** Seletor DOM (ui/dom.ts `$`). */
  $: <T extends Element = Element>(sel: string) => T | null;
  /** Anúncio "polite" para leitor de tela (core/a11y-sr.ts). */
  srSay: (text: string) => void;
  /** Persistência (platform/storage.ts) — só o necessário aqui: gravar as flags por jogador. */
  store: { setBool: (key: string, on: boolean) => void };
  /** Empilha o overlay (z-index) + liga o rodapé de explicação — compartilhado por todos os painéis "Sensibilidade". */
  frontOverlay: (el: HTMLElement | null) => void;
  /** Reflete on/off num botão (classe is-on + aria-pressed) — helper genérico usado por vários botões-mestre. */
  toggleBtn: (el: HTMLElement, on: boolean) => void;
  /** Movimento reduzido de CENA (parallax/decor/items/particles) — objeto VIVO, mutado in-place. Fica em game.js:
   *  applyCalm() (modo TEA) também o usa, não é exclusivo deste painel. */
  rm: MotionSceneFlags;
  /** Persiste `rm` (localStorage 'inclusionist.reducedmotion.v1') — mesmo motivo, fica em game.js. */
  saveRM: () => void;
  /** As 4 chaves de cena — a MESMA array que applyCalm() itera. */
  rmKeys: readonly MotionSceneKey[];
  /** Os 3 alvos de movimento reduzido do PERSONAGEM — a MESMA array que applyCalm() itera. */
  rmChar: readonly MotionCharDef[];
}

// Rótulos das linhas de CENA. Mantido VERBATIM do game.js original (7 chaves), embora só as 4 de RM_KEYS sejam
// lidas por este painel — walk/breath/flavor ficam redundantes com rmChar[].lbl. Não podei por fidelidade de porte.
export const RM_LABEL: Record<string, string> = {
  parallax: 'Parallax do fundo', decor: 'Decoração (nuvens, grama)', items: 'Animação de itens (moedas)',
  walk: 'Personagem em movimento (andar, escalar, nadar, pular)', breath: 'Respiração (parado)',
  flavor: 'Gracinhas (animações de descanso)', particles: 'Partículas e cintilação',
};
// Alvos de cena "em breve" (hoje nenhum — os 4 já agem).
export const RM_SOON: ReadonlySet<MotionSceneKey> = new Set([]);

const CRT_LBL: Record<'scan' | 'vig' | 'round', string> = { scan: 'Scanlines', vig: 'Vinheta', round: 'Cantos arredondados' };
const CRT_ROUND_LEVELS: readonly string[] = ['desligado', 'pequeno', 'grande'];

// ---------------------------------------------------------------------------------------------------------
// Lógica PURA — testável em node, sem `document`.
// ---------------------------------------------------------------------------------------------------------

/** selAnimPlayer nunca aponta pra fora do nº de telas atual. */
export function clampSelectedPlayer(selected: number, total: number): number {
  return selected >= total ? 0 : selected;
}

/** Uma linha de switch "Animado/Congelado" (usada tanto para o personagem quanto para a cena). */
export function motionRowHtml(label: string, frozen: boolean, attr: string, soon: boolean): string {
  const on = !frozen;
  const soonTag = soon ? ' <em style="opacity:.7">(em breve)</em>' : '';
  const cls = 'mode-btn switch' + (on ? ' is-on' : '');
  const btnText = on ? '▶ Animado' : '❄ Congelado';
  const state = on ? 'animação ligada' : 'animação congelada';
  return `<div class="ctrl-row"><span>${label}${soonTag}</span><button class="${cls}" ${attr} type="button" aria-pressed="${on}" aria-label="${label}: ${state}">${btnText}</button></div>`;
}

/** Linhas "Personagem" (por jogador selecionado). */
export function buildCharRowsHtml(rmChar: readonly MotionCharDef[], player: MotionPlayer | undefined): string {
  return rmChar.map((c) => motionRowHtml(c.lbl, !!(player && player[c.prop]), `data-rmc="${c.prop}"`, false)).join('');
}

/** Linhas "Cena" (globais, valem para todos os jogadores). */
export function buildSceneRowsHtml(rmKeys: readonly MotionSceneKey[], rm: MotionSceneFlags, labels: Record<string, string>, soon: ReadonlySet<MotionSceneKey>): string {
  return rmKeys.map((k) => motionRowHtml(labels[k], !!rm[k], `data-rm="${k}"`, soon.has(k))).join('');
}

/** Toggle liga/desliga da estética CRT (scanlines/vinheta). */
export function crtToggleRowHtml(label: string, key: string, on: boolean): string {
  const cls = 'mode-btn switch' + (on ? ' is-on' : '');
  return `<div class="ctrl-row"><span>${label}</span><button class="${cls}" data-crt-tgl="${key}" type="button" aria-pressed="${on}" aria-label="${label}: ${on ? 'ligado' : 'desligado'}">${on ? '❚❚ Ligado' : '▶ Desligado'}</button></div>`;
}

/** Cantos CRT: 3 níveis (0=quadrado · 1=pequeno · 2=grande). */
export function crtRoundRowHtml(label: string, round: number): string {
  const opt = (v: number, text: string) => `<option value="${v}"${round === v ? ' selected' : ''}>${text}</option>`;
  return `<div class="ctrl-row"><span>${label}</span><select class="vol" data-crt="round" aria-label="${label}">${opt(0, 'Desligado (quadrado)')}${opt(1, 'Pequeno')}${opt(2, 'Grande')}</select></div>`;
}

/** true quando TUDO (cena + personagem selecionado) já está com movimento reduzido LIGADO, isto é,
 *  congelado — nome fiel ao `rm[k]`/`player[prop]` que representam "reduzido", não "animado". Controla
 *  se o botão-mestre oferece "Retomar" (true) ou "Parar" (false) — mesma variável `allOn` do game.js
 *  original, aqui renomeada por clareza (o valor/comportamento não muda). */
export function allMotionFrozen(rmKeys: readonly MotionSceneKey[], rm: MotionSceneFlags, rmChar: readonly MotionCharDef[], player: MotionPlayer | undefined): boolean {
  return rmKeys.every((k) => rm[k]) && rmChar.every((c) => !!(player && player[c.prop]));
}

/** allFrozen=true (tudo já congelado) → oferece "Retomar"; caso contrário → oferece "Parar". */
export function motionMasterLabel(allFrozen: boolean): string {
  return allFrozen ? '▶ Retomar todas as animações' : '⏸ Parar todas as animações';
}

export function sceneMotionAnnouncement(label: string, frozen: boolean): string {
  return label + (frozen ? ' congelado.' : ' animado.');
}
export function crtToggleAnnouncement(label: string, on: boolean): string {
  return label + (on ? ' ligada.' : ' desligada.');
}
export function crtLevelLabel(level: number): string {
  return CRT_ROUND_LEVELS[level] as string;
}
export function crtRoundAnnouncement(label: string, level: number): string {
  return label + ': ' + crtLevelLabel(level) + '.';
}
/** `nowFrozen` = o NOVO valor de rm[k]/player[prop] aplicado pelo botão-mestre (true = acabou de congelar
 *  tudo; false = acabou de descongelar/retomar tudo) — mesma variável `v` do game.js original. */
export function stopResumeAllAnnouncement(nowFrozen: boolean): string {
  return nowFrozen ? 'Todas as animações paradas.' : 'Todas as animações retomadas.';
}

// ---------------------------------------------------------------------------------------------------------
// Estado do módulo — equivalente a `let selAnimPlayer=0` + `animationOpen=false` do game.js.
// ---------------------------------------------------------------------------------------------------------

let selectedPlayer = 0;
export function getSelectedPlayer(): number { return selectedPlayer; }
/** Chamado de fora (ex.: o atalho "anim" do menu de pausa) antes de open(). */
export function setSelectedPlayer(i: number): void { selectedPlayer = i; }

/** Espelha `animationOpen` do game.js — só LIDO por quem despacha Escape entre os diálogos abertos. */

// ---------------------------------------------------------------------------------------------------------
// Render/DOM — casca fina em torno da lógica pura acima.
// ---------------------------------------------------------------------------------------------------------

export interface SettingsMotionApi {
  render: () => void;
  open: () => void;
  close: () => void;
}

export function initSettingsMotion(ctx: SettingsMotionCtx): SettingsMotionApi {
  function reflectMotionBtn(): void {
    const b = ctx.$<HTMLElement>('#opt-animation');
    if (b) b.classList.toggle('is-on', ctx.rmKeys.some((k) => ctx.rm[k]));
  }

  function updateMotionMaster(): void {
    reflectMotionBtn();
    const m = ctx.$<HTMLElement>('#motion-master');
    if (!m) return;
    const player = (players as MotionPlayer[])[selectedPlayer];
    const allFrozen = allMotionFrozen(ctx.rmKeys, ctx.rm, ctx.rmChar, player);
    m.textContent = motionMasterLabel(allFrozen);
    ctx.toggleBtn(m, allFrozen);
  }

  function render(): void {
    const el = ctx.$<HTMLElement>('#motion-list');
    if (!el) return;
    selectedPlayer = clampSelectedPlayer(selectedPlayer, numPlayers);

    // E3: sem abas — cada jogador edita só o seu. BUG preservado VERBATIM do game.js (não corrigido, ver
    // retorno da extração): innerHTML='' roda ANTES do querySelectorAll, então o forEach abaixo nunca acha
    // botões — este bloco de wiring é código morto tanto aqui quanto no original.
    const tabs = ctx.$<HTMLElement>('#animation-players');
    if (tabs) {
      tabs.hidden = true;
      tabs.innerHTML = '';
      tabs.querySelectorAll<HTMLButtonElement>('button[data-ap]').forEach((b) => b.addEventListener('click', () => {
        selectedPlayer = Number(b.dataset.ap);
        render();
      }));
    }

    const player = (players as MotionPlayer[])[selectedPlayer];
    const charRows = buildCharRowsHtml(ctx.rmChar, player);
    const sceneRows = buildSceneRowsHtml(ctx.rmKeys, ctx.rm, RM_LABEL, RM_SOON);
    const crtRows = crtToggleRowHtml(CRT_LBL.scan, 'scan', !!CRT.scan) + crtToggleRowHtml(CRT_LBL.vig, 'vig', !!CRT.vig) + crtRoundRowHtml(CRT_LBL.round, CRT.round);

    el.innerHTML =
      `<h3 class="panel-sub">Personagem${numPlayers > 1 ? ' · Jogador ' + (selectedPlayer + 1) : ''} <span class="panel-sub__tag">por jogador</span></h3>${charRows}` +
      `<h3 class="panel-sub">Cena <span class="panel-sub__tag">todos os jogadores</span></h3>${sceneRows}` +
      `<h3 class="panel-sub">Estética CRT <span class="panel-sub__tag">todos os jogadores</span></h3>${crtRows}`;

    el.querySelectorAll<HTMLButtonElement>('button[data-crt-tgl]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.crtTgl as 'scan' | 'vig';
      CRT[k] = CRT[k] ? 0 : 1;
      applyCrt();
      render();
      ctx.srSay(crtToggleAnnouncement(CRT_LBL[k], !!CRT[k]));
    }));
    el.querySelectorAll<HTMLSelectElement>('select[data-crt]').forEach((s) => s.addEventListener('change', () => {
      const key = s.dataset.crt as 'round';
      CRT[key] = +s.value;
      applyCrt();
      ctx.srSay(crtRoundAnnouncement(CRT_LBL[key], CRT[key]));
    }));
    el.querySelectorAll<HTMLButtonElement>('button[data-rmc]').forEach((b) => b.addEventListener('click', () => {
      const prop = b.dataset.rmc as MotionCharProp;
      const p = (players as MotionPlayer[])[selectedPlayer];
      p[prop] = !p[prop];
      ctx.store.setBool('incl_' + prop + '_p' + selectedPlayer, !!p[prop]);
      render();
    }));
    el.querySelectorAll<HTMLButtonElement>('button[data-rm]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.rm as MotionSceneKey;
      ctx.rm[k] = !ctx.rm[k];
      ctx.saveRM();
      render();
      updateMotionMaster();
      ctx.srSay(sceneMotionAnnouncement(RM_LABEL[k], ctx.rm[k]));
    }));

    updateMotionMaster();
  }

  function open(): void {
    const ov = ctx.$<HTMLElement>('#animation');
    if (!ov) return;
    render();
    ov.hidden = false;
    ctx.frontOverlay(ov);
    const f = ov.querySelector<HTMLElement>('button');
    if (f) f.focus();
  }

  function close(): void {
    const ov = ctx.$<HTMLElement>('#animation');
    if (!ov) return;
    ov.hidden = true;
    const b = ctx.$<HTMLElement>('#opt-animation');
    if (b) b.focus();
  }

  const master = ctx.$<HTMLElement>('#motion-master');
  if (master) master.addEventListener('click', () => {
    const player = (players as MotionPlayer[])[selectedPlayer];
    const allFrozen = allMotionFrozen(ctx.rmKeys, ctx.rm, ctx.rmChar, player);
    const next = !allFrozen;
    for (const k of ctx.rmKeys) ctx.rm[k] = next;
    ctx.saveRM();
    if (player) for (const c of ctx.rmChar) {
      player[c.prop] = next;
      ctx.store.setBool('incl_' + c.prop + '_p' + selectedPlayer, next);
    }
    render();
    ctx.srSay(stopResumeAllAnnouncement(next));
  });

  reflectMotionBtn(); // estado inicial (ex.: prefers-reduced-motion liga por padrão)

  return { render, open, close };
}
