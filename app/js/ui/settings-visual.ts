// SPDX-License-Identifier: GPL-3.0-or-later
// ui/settings-visual — the "Acessibilidade visual" overlay: high-contrast level, L→Q contrast enhancement,
// owner-colored items, CB-safe (Okabe-Ito) palette, color-blocking role colors, and the two outline selects
// (foreground/background). `selVizPlayer` (chosen player), `setPlayerViz`/`setLq`/`setOwnerColors`/`setCbSafe`/
// `setOutlineFg`/`setOutlineBg`/`setRoleColor`/`resetRoleColors` are INJECTED — they mutate PIXI texture caches
// and rebake the world (`_rebakeDirect`/`rebuildExtras`), which stay in game.js. `numPlayers`/`players` are read
// live from core/state.js (same source game.js itself uses). Extracted verbatim from renderVisual() in game.js
// (behavior-preserving) — see docs/5-Refactoring/plano-modularizacao-mapa.md.

import { t } from '../core/i18n.js';
import { numPlayers, players } from '../core/state.js';
import { lqName as lqLabel } from '../render/lq-filter.js';

// Os quatro papéis do color-blocking vêm de render/hc-role-data (folha, sem dependências) — a mesma fonte
// que render/high-contrast usa para repintar os tiles. Reexportados com os nomes que este painel sempre
// teve, para que os chamadores e os testes não mudem. Os RÓTULOS abaixo ficam aqui: são apresentação.
import type { HcRoleKey } from '../render/hc-role-data.js';
import { HC_ROLE_KEYS, HC_ROLE_DEF } from '../render/hc-role-data.js';
import { DEFAULTS } from '../core/state.js';
import { markChanged, markMenuChanged } from './changed-mark.js';
export type { HcRoleKey as RoleKey } from '../render/hc-role-data.js';
type RoleKey = HcRoleKey;
export type RGB = readonly [number, number, number];

/** Contrast levels, in cycle order — mirrors game.js's HC_SEQ (also used there by the physical contrast-cycle button). */
export const CONTRAST_LEVELS: readonly string[] = ['normal', 'hc-direto', 'hc-direto-45', 'hc-direto-7'];
const CONTRAST_LEVEL_SET: ReadonlySet<string> = new Set(CONTRAST_LEVELS);
/** Short announcement labels — mirrors game.js's HC_LABEL. */
// Chaves i18n, não texto. Os dois extremos parecem números universais, mas '4,5:1' usa a vírgula decimal do
// pt-BR e vira '4.5:1' em inglês — e 'off' era uma palavra inglesa dentro de uma frase em português.
export const CONTRAST_LABELS: Readonly<Record<string, string>> = { normal: 'contrast.off', 'hc-direto': 'contrast.3', 'hc-direto-45': 'contrast.45', 'hc-direto-7': 'contrast.7' };

export const ROLE_KEYS: readonly RoleKey[] = HC_ROLE_KEYS;
/** Readable labels for the color-blocking roles — mirrors game.js's ROLE_LBL. */
export const ROLE_LABELS: Readonly<Record<RoleKey, string>> = { hazard: 'perigo (lava)', climb: 'escalável (escada/trampolim)', water: 'água', gate: 'portão' };

/** Live snapshot of the state this panel does not own — read fresh on every render(). */
export interface VisualSettings {
  lq: number; // 0..1, L→Q contrast enhancement
  ownerColors: boolean;
  cbSafe: boolean;
  outlineFg: number; // 0=none 1=thin 2=thick
  outlineBg: number;
  roleColors: Record<RoleKey, RGB>;
}

export interface SettingsVisualCtx {
  $: <T extends Element = Element>(sel: string) => T | null;
  srSay: (text: string) => void;
  /** Fresh read of lq/ownerColors/cbSafe/outlineFg/outlineBg/roleColors (game.js live vars). */
  getVisualSettings: () => VisualSettings;
  /** `selVizPlayer` — shared with the Empathy panel; owned by game.js. */
  getSelectedPlayer: () => number;
  setSelectedPlayer: (i: number) => void;
  /** Same setPlayerViz used by the Empathy panel and the physical contrast-cycle shortcut. */
  setPlayerViz: (i: number, mode: string) => void;
  setLq: (t: number) => void;
  setOwnerColors: (on: boolean) => void;
  setCbSafe: (on: boolean) => void;
  setOutlineFg: (level: number) => void;
  setOutlineBg: (level: number) => void;
  setRoleColor: (key: RoleKey, hex: string) => void;
  resetRoleColors: () => void;
}

// ---------- Pure logic (Right-BICEP/ZOMBIES-tested in node) ----------

/** `viz` if it's one of the 4 contrast levels, else 'normal' — mirrors `HC_SEQ.includes(cur)?cur:'normal'`. */
export function resolveContrastValue(viz: string): string {
  return CONTRAST_LEVEL_SET.has(viz) ? viz : 'normal';
}

/** i18n KEY of a contrast level's label; unknown modes fall back to the 'off' key. Resolve with `t()`. */
export function contrastLabel(mode: string): string {
  return CONTRAST_LABELS[mode] ?? CONTRAST_LABELS.normal;
}

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/**
 * i18n KEY of the L->Q slider label ('lq.off'/'lq.linear'/'lq.mixed'/'lq.quadratic'). The label belongs to the
 * L->Q feature, so it lives with the filter that owns it (render/lq-filter) and is re-exported here under the
 * name this overlay has always used. Two copies of one rule is one copy too many: only the owner may change
 * what the levels mean. Callers resolve with `t()` — see the note on lqName about the `t` shadowing.
 */
export { lqName as lqLabel } from '../render/lq-filter.js';

/** t (0..1) -> slider percent (0..100, rounded) — mirrors `Math.round(lqT*100)`. */
export function lqPercent(t: number): number {
  return Math.round(clamp01(t) * 100);
}

/** slider percent (any number) -> clamped t (0..1) — mirrors `+lq.value/100` fed into setLq's clamp. */
export function lqFromPercent(pct: number): number {
  return clamp01(pct / 100);
}

/** Defensive clamp when the player count shrank — mirrors `if(selVizPlayer>=numPlayers)selVizPlayer=0`. */
export function clampSelectedPlayer(selected: number, playerCount: number): number {
  return selected >= playerCount ? 0 : selected;
}

/** [r,g,b] (0..255) -> '#rrggbb' — mirrors game.js's rgbHex. */
export function rgbToHex(rgb: RGB): string {
  return '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** Shared on/off button label used by this panel's toggle buttons. */
export function onOffLabel(on: boolean): string {
  return on ? '❚❚ Ligado' : '▶ Desligado';
}

/** Reads player[i].viz defensively (no player at that index -> 'normal'), without a Player type import. */
function playerViz(list: readonly unknown[], i: number): string {
  const p = list[i] as { viz?: unknown } | undefined;
  return typeof p?.viz === 'string' ? p.viz : 'normal';
}

/** Builds the #visual-list innerHTML — pure string templating, no DOM access. Mirrors renderVisual()'s markup. */
export function renderVisualPanelHtml(contrastValue: string, s: VisualSettings): string {
  const roleInputs = ROLE_KEYS.map(
    (k) =>
      `<input type="color" id="opt-role-${k}" value="${rgbToHex(s.roleColors[k])}" aria-label="Cor de ${ROLE_LABELS[k]}" style="inline-size:2.2em;block-size:1.8em;padding:0;border:1px solid #666;border-radius:4px;background:none">`,
  ).join('');
  return (
    '<div class="ctrl-row"><span><strong>Alto contraste</strong> — recolore o cenário para destacar o que importa; escolha o nível de contraste.</span>' +
    '<select id="opt-contrast" aria-label="Nível de alto contraste"><option value="normal">Desligado</option><option value="hc-direto">3:1 (agradável)</option><option value="hc-direto-45">4,5:1</option><option value="hc-direto-7">7:1 (máximo)</option></select></div>' +
    '<div class="ctrl-row"><span><strong>Realce de contraste (Linear → Quadrático)</strong> — curva de tom na tela inteira: o começo da faixa estica o contraste (linear), o fim realça sombras e altas-luzes (curva S quadrática). Zero desliga. Vale para todos os jogadores.</span>' +
    '<span style="display:flex;align-items:center;gap:.4rem"><input type="range" id="opt-lq" min="0" max="100" step="5" style="width:9em" aria-label="Realce de contraste: zero desligado, começo linear, fim quadrático"><strong id="opt-lq-val" aria-hidden="true"></strong></span></div>' +
    '<div class="ctrl-row"><span><strong>Itens na cor do dono</strong> — no multiplayer, cada jogador vê os próprios itens na cor dele. Desligado: itens na cor original para todos.</span>' +
    `<button id="opt-ownercolors" class="mode-btn${s.ownerColors ? ' is-on' : ''}" type="button" aria-pressed="${s.ownerColors}">${onOffLabel(s.ownerColors)}</button></div>` +
    '<div class="ctrl-row"><span><strong>Paleta segura para daltonismo</strong> — troca as cores de jogadores, itens e efeitos pela paleta Okabe-Ito (distinguível em protan/deutan/tritan). O cenário mantém as cores naturais.</span>' +
    `<button id="opt-cbsafe" class="mode-btn${s.cbSafe ? ' is-on' : ''}" type="button" aria-pressed="${s.cbSafe}">${onOffLabel(s.cbSafe)}</button></div>` +
    '<div class="ctrl-row"><span><strong>Cores do color-blocking</strong> — nos modos de alto contraste, escolha a cor de cada papel: perigo, escalável, água e portão. ↺ restaura o padrão.</span>' +
    '<span style="display:flex;gap:.35rem;align-items:center">' +
    roleInputs +
    '<button id="opt-role-reset" class="mode-btn" type="button" aria-label="Restaurar cores padrão">↺</button></span></div>'
  );
}

/** Duas cores de papel são a mesma? Comparação por componente — `[0,0,0] === [0,0,0]` é `false` em JS, e
 *  esse `false` diria "alterado" para uma cor que ninguém tocou, mandando a criança desfazer o que não fez. */
export function sameRgb(a: RGB | undefined, b: RGB | undefined): boolean {
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// ---------- Thin DOM shell ----------

export interface SettingsVisual {
  /** Rebuilds #visual-list and (re)wires its controls — call whenever the panel should reflect fresh state. */
  render: () => void;
}

export function initSettingsVisual(ctx: SettingsVisualCtx): SettingsVisual {
  function reflectOutlines(): void {
    const s = ctx.getVisualSettings();
    const f = ctx.$<HTMLSelectElement>('#opt-outline-fg');
    if (f) f.value = String(s.outlineFg);
    const b = ctx.$<HTMLSelectElement>('#opt-outline-bg');
    if (b) b.value = String(s.outlineBg);
  }

  // Outline selects live in static HTML outside #visual-list (untouched by innerHTML rebuilds) -> wire once.
  const outFg = ctx.$<HTMLSelectElement>('#opt-outline-fg');
  if (outFg) outFg.addEventListener('change', () => ctx.setOutlineFg(+outFg.value));
  const outBg = ctx.$<HTMLSelectElement>('#opt-outline-bg');
  if (outBg) outBg.addEventListener('change', () => ctx.setOutlineBg(+outBg.value));
  reflectOutlines();

  function render(): void {
    const el = ctx.$('#visual-list');
    if (!el) return;

    const rawSelected = ctx.getSelectedPlayer();
    const selected = clampSelectedPlayer(rawSelected, numPlayers);
    if (selected !== rawSelected) ctx.setSelectedPlayer(selected);

    const contrastValue = resolveContrastValue(playerViz(players, selected));
    const settings = ctx.getVisualSettings();
    el.innerHTML = renderVisualPanelHtml(contrastValue, settings);

    const s = ctx.$<HTMLSelectElement>('#opt-contrast');
    if (s) {
      s.value = contrastValue;
      s.addEventListener('change', () => {
        ctx.setPlayerViz(selected, s.value);
        ctx.srSay(t('sr.visual.contrast', { v: t(contrastLabel(s.value)) }));
      });
    }

    const lq = ctx.$<HTMLInputElement>('#opt-lq');
    const lqv = ctx.$<HTMLElement>('#opt-lq-val');
    if (lq) {
      // O parâmetro chamava-se `t` e passou a `amount`: `lqLabel` agora devolve uma chave que precisa de
      // `t()` para virar texto, e o nome antigo sombreava justamente a função que faltava chamar aqui.
      const reflect = (amount: number): void => {
        if (lqv) lqv.textContent = t(lqLabel(amount));
      };
      lq.value = String(lqPercent(settings.lq));
      reflect(settings.lq);
      lq.addEventListener('input', () => {
        const amount = lqFromPercent(Number(lq.value));
        ctx.setLq(amount);
        reflect(amount);
      });
      lq.addEventListener('change', () => {
        ctx.srSay(t('sr.visual.lq', { v: t(lqLabel(lqFromPercent(Number(lq.value)))) }));
      });
    }

    const oc = ctx.$<HTMLButtonElement>('#opt-ownercolors');
    if (oc) oc.addEventListener('click', () => { ctx.setOwnerColors(!settings.ownerColors); render(); });

    const cb = ctx.$<HTMLButtonElement>('#opt-cbsafe');
    if (cb) cb.addEventListener('click', () => { ctx.setCbSafe(!settings.cbSafe); render(); });

    for (const k of ROLE_KEYS) {
      const inp = ctx.$<HTMLInputElement>('#opt-role-' + k);
      if (inp) inp.addEventListener('change', () => ctx.setRoleColor(k, inp.value));
    }
    const rr = ctx.$<HTMLButtonElement>('#opt-role-reset');
    if (rr) rr.addEventListener('click', () => { ctx.resetRoleColors(); render(); });

    reflectOutlines();
    refreshMarks();
  }

  /**
   * A marca de "saiu do padrão" (ADR-0029). Cada linha contra o SEU padrão, e o botão do menu por cima.
   *
   * O contraste é comparado pelo valor RESOLVIDO, não pelo `viz` cru: quem está com uma simulação ou uma
   * correção de daltonismo ligada tem `resolveContrastValue` respondendo 'normal', que é a verdade sobre
   * ESTE menu — o modo dela não saiu do padrão daqui, saiu do padrão de outro painel, e é lá que a marca
   * precisa aparecer para levar a criança ao lugar certo.
   */
  function refreshMarks(): void {
    const s = ctx.getVisualSettings();
    const contraste = resolveContrastValue(playerViz(players, ctx.getSelectedPlayer())) !== 'normal';
    const lqOff = s.lq !== DEFAULTS.lq;
    const owner = s.ownerColors !== DEFAULTS.ownerColors;
    const cb = s.cbSafe !== DEFAULTS.cbSafe;
    const fg = s.outlineFg !== DEFAULTS.hcOutlineFg;
    const bg = s.outlineBg !== DEFAULTS.hcOutlineBg;
    const papeis = ROLE_KEYS.some((k) => !sameRgb(s.roleColors[k], HC_ROLE_DEF[k]));
    const linha = (sel: string): HTMLElement | null =>
      ctx.$<HTMLElement>(sel)?.closest<HTMLElement>('.ctrl-row') ?? null;
    markChanged(linha('#opt-contrast'), contraste);
    markChanged(linha('#opt-lq'), lqOff);
    markChanged(linha('#opt-ownercolors'), owner);
    markChanged(linha('#opt-cbsafe'), cb);
    markChanged(linha('#opt-outline-fg'), fg);
    markChanged(linha('#opt-outline-bg'), bg);
    markChanged(linha('#opt-role-reset'), papeis);
    markMenuChanged(ctx.$<HTMLElement>('[data-act="visual"]'), [contraste, lqOff, owner, cb, fg, bg, papeis]);
  }

  // ---- restaurar os padrões DESTE menu (ADR-0028) ----
  //
  // O espelho exato do cuidado que o menu de EMPATIA precisou ter, e pelo mesmo motivo visto do outro lado:
  // `p.viz` é UM campo compartilhado por três menus. Aqui ele só pode voltar a 'normal' se o que estiver nele
  // for um NÍVEL DE CONTRASTE. Se a criança está com uma simulação de baixa visão ou com a correção de
  // daltonismo dela ligada, este botão não tem nada a dizer sobre isso — e apagar em silêncio a correção de
  // quem é daltônico, a partir do menu de contraste, seria o mesmo estrago com outra porta de entrada.
  //
  // As LEGENDAS (#opt-captions) estão nesta tela mas ficam de fora: quem as liga e persiste é o main.js, e a
  // pergunta de a qual menu elas pertencem está aberta (#58 — são uma acomodação de surdez morando no menu
  // visual). Puxá-las para cá agora responderia essa pergunta por acidente, num commit sobre outra coisa.
  const resetBtn = ctx.$<HTMLButtonElement>('#visual-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    players.forEach((p, i) => {
      const viz = playerViz(players, i);
      if (CONTRAST_LEVEL_SET.has(viz) && viz !== 'normal') ctx.setPlayerViz(i, 'normal');
    });
    const s = ctx.getVisualSettings();
    if (s.lq !== DEFAULTS.lq) ctx.setLq(DEFAULTS.lq);
    if (s.ownerColors !== DEFAULTS.ownerColors) ctx.setOwnerColors(DEFAULTS.ownerColors);
    if (s.cbSafe !== DEFAULTS.cbSafe) ctx.setCbSafe(DEFAULTS.cbSafe);
    if (s.outlineFg !== DEFAULTS.hcOutlineFg) ctx.setOutlineFg(DEFAULTS.hcOutlineFg);
    if (s.outlineBg !== DEFAULTS.hcOutlineBg) ctx.setOutlineBg(DEFAULTS.hcOutlineBg);
    if (ROLE_KEYS.some((k) => !sameRgb(s.roleColors[k], HC_ROLE_DEF[k]))) ctx.resetRoleColors();
    render();
    ctx.srSay(t('sr.visual.reset'));
  });

  return { render };
}
