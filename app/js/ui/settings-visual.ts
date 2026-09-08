// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-visual — the "Acessibilidade visual" overlay: high-contrast level, L→Q contrast enhancement,
// owner-colored items, CB-safe (Okabe-Ito) palette, color-blocking role colors, and the two outline selects
// (foreground/background). `selVizPlayer` (chosen player), `setPlayerViz`/`setLq`/`setOwnerColors`/`setCbSafe`/
// `setOutlineFg`/`setOutlineBg`/`setRoleColor`/`resetRoleColors` are INJECTED — they mutate PIXI texture caches
// and rebake the world (`_rebakeDirect`/`rebuildExtras`), which stay in game.js. `numPlayers`/`players` are read
// live from core/state.js (same source game.js itself uses). Extracted verbatim from renderVisual() in game.js
// (behavior-preserving) — see docs/5-Refactoring/plano-modularizacao-mapa.md.

import { toggleLabel } from './dom.js';
import { t } from '../core/i18n.js';

import { lqName as lqLabel } from '../render/lq-filter.js';

// Os quatro papéis do color-blocking vêm de render/hc-role-data (folha, sem dependências) — a mesma fonte
// que render/high-contrast usa para repintar os tiles. Reexportados com os nomes que este painel sempre
// teve, para que os chamadores e os testes não mudem. Os RÓTULOS abaixo ficam aqui: são apresentação.
import type { HcRoleKey } from '../render/hc-role-data.js';
import { HC_ROLE_KEYS, HC_ROLE_DEF } from '../render/hc-role-data.js';
import { VIZ_CORRECTIONS, VIZ_MODES, type VizMode } from '../render/viz-modes.js';
import { DEFAULTS } from '../core/state.js';
import { markChanged, markMenuChanged } from './changed-mark.js';
export type { HcRoleKey as RoleKey } from '../render/hc-role-data.js';
type RoleKey = HcRoleKey;
export type RGB = readonly [number, number, number];

/** Contrast levels, in cycle order — mirrors game.js's HC_SEQ (also used there by the physical contrast-cycle button). */
export const CONTRAST_LEVELS: readonly string[] = ['normal', 'hc-direto', 'hc-direto-45', 'hc-direto-7'];

/**
 * TUDO que este menu escreve em `p.viz`: os 4 níveis de contraste MAIS as 3 correções de daltonismo, que
 * mudaram de casa por decisão do Dev (#60). Elas moravam no Modo empatia, onde a criança daltônica precisava
 * entrar no menu "sentir como é ter uma deficiência" para achar a correção da deficiência que ela tem.
 *
 * Os sete vivem num CONTROLE SÓ, e isso não é economia de espaço: `p.viz` guarda UM valor. Dois controles
 * separados se sobrescreveriam em silêncio — a criança escolheria a correção, depois o contraste, e perderia
 * a correção sem nada dizer que perdeu. Uma lista só conta a verdade sobre a exclusividade.
 */
export const VISUAL_MODES: readonly string[] = [...CONTRAST_LEVELS, ...VIZ_CORRECTIONS.map((m) => m.key)];
const VISUAL_MODE_SET: ReadonlySet<string> = new Set(VISUAL_MODES);
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
  /** Quantos jogadores/telas. Estado de RODADA (ADR-0038): vem da instância que a raiz possui.
   *  Era `numPlayers`, um `let` de `core/state` importado como binding vivo — e um `let` de módulo
   *  é compartilhado por qualquer segundo jogo que a mesma página carregue (D13 do `demos`). */
  getNumPlayers: () => number;
  /** Os jogadores. Estado de RODADA, pelo mesmo motivo. `readonly unknown[]` porque cada consumidor
   *  estreita para a SUA fatia — o tipo real é do jogo, não da engine (ADR-0033). */
  getPlayers: () => readonly unknown[];
  $: <T extends Element = Element>(sel: string) => T | null;
  srSay: (text: string) => void;
  /** Fresh read of lq/ownerColors/cbSafe/outlineFg/outlineBg/roleColors (game.js live vars). */
  getVisualSettings: () => VisualSettings;
  /** `selVizPlayer` — shared with the Empathy panel; owned by game.js. */
  getSelectedPlayer: () => number;
  setSelectedPlayer: (i: number) => void;
  /** Same setPlayerViz used by the Empathy panel and the physical contrast-cycle shortcut. */
  setPlayerViz: (i: number, mode: string) => void;
  /** Desenha UMA lista de rádio de modos visuais (+ abas por jogador). O MESMO helper que o painel de
   *  empatia usa — de propósito: as três correções mudaram de menu, e mudar junto a aparência delas faria a
   *  criança ter de reaprender um controle que ela já conhecia. */
  /**
   * Os DOIS eixos deste painel (#104). Substituiu o `renderVizGroup`, que fica com o painel de EMPATIA.
   *
   * ⚠️ A lista de sete que este painel oferecia era a forma honesta de contar uma exclusividade REAL, e o
   * `VISUAL_MODES` explica-a em prosa logo acima. Ela deixou de existir: o estado tem dois eixos, e os
   * escritores por eixo mexem num sem tocar no outro.
   */
  renderEixosVisuais: (listSel: string, tabsSel: string) => void;
  setLq: (t: number) => void;
  setOwnerColors: (on: boolean) => void;
  setCbSafe: (on: boolean) => void;
  setOutlineFg: (level: number) => void;
  setOutlineBg: (level: number) => void;
  setRoleColor: (key: RoleKey, hex: string) => void;
  resetRoleColors: () => void;
  /**
   * Move a prosa das linhas para o rodapé (`ui/settings-panel` → `fillExplain`). Chamado a CADA render.
   *
   * ⚠️ NÃO É OPCIONAL POR ELEGÂNCIA: `fillExplain` roda uma vez quando o overlay é frontalizado e move o
   * `.opt-hint` de dentro de cada linha para o rodapé. Este painel RECONSTRÓI as linhas, e as linhas novas
   * voltam com a prosa lá dentro — então a explicação aparece duas vezes, no rodapé e sob o rótulo, a
   * partir do primeiro clique. O `CLAUDE.md` §4 regista exatamente isto, e a issue #109 já o consertou
   * uma vez noutros painéis.
   *
   * Opcional na assinatura porque um consumidor pode montar o painel sem a casca (um teste, o segundo
   * consumidor): sem casca não há rodapé para duplicar.
   */
  fillExplain?: (card: HTMLElement | null) => void;
}

// ---------- Pure logic (Right-BICEP/ZOMBIES-tested in node) ----------

/**
 * `viz` quando ele é um modo DESTE menu (contraste ou correção), senão 'normal'.
 *
 * Chamava-se `resolveContrastValue` enquanto o menu só tinha contraste. O nome antigo passaria a mentir ao
 * devolver `fix-deuter`, e um nome que mente sobre o que devolve é pior que um nome comprido.
 */
export function resolveVisualMode(viz: string): string {
  return VISUAL_MODE_SET.has(viz) ? viz : 'normal';
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
  return toggleLabel(on);
}

/** Reads player[i].viz defensively (no player at that index -> 'normal'), without a Player type import. */
function playerViz(list: readonly unknown[], i: number): string {
  const p = list[i] as { viz?: unknown } | undefined;
  return typeof p?.viz === 'string' ? p.viz : 'normal';
}

/** Builds the #visual-list innerHTML — pure string templating, no DOM access. Mirrors renderVisual()'s markup. */
/**
 * Os 7 modos como o painel os OFERECE: uma lista de rádio, com nome e descrição em cada linha.
 *
 * A primeira versão desta mudança usou um `<select>`, e foi um erro que o Dev pegou na hora: no menu de
 * empatia as três correções eram LINHAS VISÍVEIS, com descrição; dentro de um `<select>` viraram uma linha
 * fechada dentro de uma caixa fechada. Para um controle cuja razão de existir é ser ACHADO por quem enxerga
 * mal, esconder atrás de um clique é quase o mesmo que não ter movido. Voltam a ser linhas, e pelo mesmo
 * renderizador que o painel de empatia usa — o que a criança já sabia procurar continua com a mesma cara.
 *
 * Rádio, e não sete botões: `p.viz` guarda UM valor, e a exclusividade fica dita pela forma do controle em
 * vez de ser descoberta ao perder a correção que se acabou de escolher.
 */
export const VISUAL_MODE_LIST: readonly VizMode[] =
  VIZ_MODES.filter((m) => m.kind === 'normal' || m.kind === 'hcnew').concat(VIZ_CORRECTIONS);

export function renderVisualPanelHtml(_contrastValue: string, s: VisualSettings): string {
  const roleInputs = ROLE_KEYS.map(
    (k) =>
      `<input type="color" id="opt-role-${k}" value="${rgbToHex(s.roleColors[k])}" aria-label="Cor de ${ROLE_LABELS[k]}" style="inline-size:2.2em;block-size:1.8em;padding:0;border:1px solid #666;border-radius:4px;background:none">`,
  ).join('');
  return (
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
    const selected = clampSelectedPlayer(rawSelected, ctx.getNumPlayers());
    if (selected !== rawSelected) ctx.setSelectedPlayer(selected);

    const contrastValue = resolveVisualMode(playerViz(ctx.getPlayers(), selected));
    const settings = ctx.getVisualSettings();
    // ⚠️ `renderEixosVisuais` E NÃO `renderVizGroup` desde a #104: este painel passou a ter DOIS controles,
    // e o `renderVizGroup` continua a servir o painel de EMPATIA, cuja lista de simulações é mesmo exclusiva.
    // Trocar o corpo daquela função em vez de acrescentar esta teria posto os dois eixos na lista de
    // simulações — foi o que quase aconteceu, e o que a separação impede.
    ctx.renderEixosVisuais('#visual-modes', '#visual-players');
    el.innerHTML = renderVisualPanelHtml(contrastValue, settings);

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
    // A prosa volta para o rodapé depois de as linhas serem reconstruídas (CLAUDE.md §4, #109).
    ctx.fillExplain?.(ctx.$<HTMLElement>('#visual .overlay__card'));
  }

  /**
   * A marca de "saiu do padrão" (ADR-0029). Cada linha contra o SEU padrão, e o botão do menu por cima.
   *
   * O contraste é comparado pelo valor RESOLVIDO, não pelo `viz` cru: quem está com uma simulação ou uma
   * O modo visual é comparado pelo valor RESOLVIDO: quem está com uma SIMULAÇÃO ligada (empatia) tem
   * `resolveVisualMode` respondendo 'normal', que é a verdade sobre ESTE menu — aquele modo não saiu do
   * padrão daqui, e é no menu de empatia que a marca precisa aparecer para levar a criança ao lugar certo.
   */
  function refreshMarks(): void {
    const s = ctx.getVisualSettings();
    const contraste = resolveVisualMode(playerViz(ctx.getPlayers(), ctx.getSelectedPlayer())) !== 'normal';
    const lqOff = s.lq !== DEFAULTS.lq;
    const owner = s.ownerColors !== DEFAULTS.ownerColors;
    const cb = s.cbSafe !== DEFAULTS.cbSafe;
    const fg = s.outlineFg !== DEFAULTS.hcOutlineFg;
    const bg = s.outlineBg !== DEFAULTS.hcOutlineBg;
    const papeis = ROLE_KEYS.some((k) => !sameRgb(s.roleColors[k], HC_ROLE_DEF[k]));
    const linha = (sel: string): HTMLElement | null =>
      ctx.$<HTMLElement>(sel)?.closest<HTMLElement>('.ctrl-row') ?? null;
    markChanged(ctx.$<HTMLElement>('#visual-modes'), contraste);
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
  // `p.viz` é UM campo compartilhado com o menu de empatia, então o reset só pode zerá-lo quando o que
  // estiver lá for um modo DESTE menu. Se a criança está com uma simulação de baixa visão ou de cegueira
  // ligada, este botão não tem nada a dizer sobre isso.
  //
  // As correções de daltonismo AGORA entram no que ele zera, e isso mudou com a #60: elas passaram a morar
  // aqui. Desfazê-las é legítimo porque a criança as reencontra no MESMO seletor que acabou de usar — a
  // regra é "um reset só pode desfazer o que ele também consegue refazer", e aqui ela é satisfeita. Por isso
  // o anúncio nomeia o modo visual entre o que voltou.
  //
  // As LEGENDAS (#opt-captions) estão nesta tela mas ficam de fora: quem as liga e persiste é o main.js, e a
  // pergunta de a qual menu elas pertencem está aberta (#58 — são uma acomodação de surdez morando no menu
  // visual). Puxá-las para cá agora responderia essa pergunta por acidente, num commit sobre outra coisa.
  const resetBtn = ctx.$<HTMLButtonElement>('#visual-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    ctx.getPlayers().forEach((_p, i) => {
      const viz = playerViz(ctx.getPlayers(), i);
      if (VISUAL_MODE_SET.has(viz) && viz !== 'normal') ctx.setPlayerViz(i, 'normal');
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
