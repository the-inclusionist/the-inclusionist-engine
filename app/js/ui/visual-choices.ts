// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/visual-choices — WHAT A VISUAL CHOICE IS, with no document anywhere near it.
//
// 📌 THE SUITE HAD ALREADY DRAWN THIS SEAM, which is what makes the cut a reading and not an opinion:
// `tests/settings-visual.node.test.js` imports exactly these names and nothing else, and the node project mounts no
// document — so whoever wrote those cases had to know where the panel stopped being a panel. It is the fourth module to
// come out this way, after `ui/audio-choices`, `ui/typo-choices` and `ui/control-choices`.
//
// What lives here answers «what are the positions, what is each one called, and what does a value mean»; what stayed in
// `ui/settings-visual` is the work its name never mentioned — finding the controls, wiring them, and reflecting the
// choice on three surfaces.

import { toggleLabel } from './dom.js';
import { CONTRAST_LEVELS } from '../core/visual-cycles.js';
import type { HcRoleKey } from '../render/hc-role-data.js';
import { HC_ROLE_KEYS } from '../render/hc-role-data.js';
import { VIZ_CORRECTIONS, VIZ_MODES, type VizMode } from '../render/viz-modes.js';

export type { HcRoleKey as RoleKey } from '../render/hc-role-data.js';
type RoleKey = HcRoleKey;
export type RGB = readonly [number, number, number];

/**
 * TUDO que este menu escreve em `p.viz`: os 4 níveis de contraste MAIS as 3 correções de daltonismo, que mudaram de
 * casa por decisão do Dev (#60). Elas moravam no Modo empatia, onde a criança daltônica precisava entrar no menu
 * "sentir como é ter uma deficiência" para achar a correção da deficiência que ela tem.
 *
 * Os sete vivem num CONTROLE SÓ, e isso não é economia de espaço: `p.viz` guarda UM valor. Dois controles separados se
 * sobrescreveriam em silêncio — a criança escolheria a correção, depois o contraste, e perderia a correção sem nada
 * dizer que perdeu. Uma lista só conta a verdade sobre a exclusividade.
 */
export const VISUAL_MODES: readonly string[] = [...CONTRAST_LEVELS, ...VIZ_CORRECTIONS.map((m) => m.key)];
const VISUAL_MODE_SET: ReadonlySet<string> = new Set(VISUAL_MODES);

/** Short announcement labels — mirrors game.js's HC_LABEL. */
// Chaves i18n, não texto. Os dois extremos parecem números universais, mas '4,5:1' usa a vírgula decimal do pt-BR e
// vira '4.5:1' em inglês — e 'off' era uma palavra inglesa dentro de uma frase em português.
export const CONTRAST_LABELS: Readonly<Record<string, string>> = { normal: 'contrast.off', 'hc-direto': 'contrast.3', 'hc-direto-45': 'contrast.45', 'hc-direto-7': 'contrast.7' };

export const ROLE_KEYS: readonly RoleKey[] = HC_ROLE_KEYS;
/** Readable labels for the color-blocking roles — mirrors game.js's ROLE_LBL. */
export const ROLE_LABELS: Readonly<Record<RoleKey, string>> = { hazard: 'perigo (lava)', climb: 'escalável (escada/trampolim)', water: 'água', gate: 'portão' };

/**
 * Os 7 modos como o painel os OFERECE: uma lista de rádio, com nome e descrição em cada linha.
 *
 * A primeira versão desta mudança usou um `<select>`, e foi um erro que o Dev pegou na hora: no menu de empatia as três
 * correções eram LINHAS VISÍVEIS, com descrição; dentro de um `<select>` viraram uma linha fechada dentro de uma caixa
 * fechada. Para um controle cuja razão de existir é ser ACHADO por quem enxerga mal, esconder atrás de um clique é
 * quase o mesmo que não ter movido.
 *
 * Rádio, e não sete botões: `p.viz` guarda UM valor, e a exclusividade fica dita pela forma do controle em vez de ser
 * descoberta ao perder a correção que se acabou de escolher.
 */
export const VISUAL_MODE_LIST: readonly VizMode[] =
  VIZ_MODES.filter((m) => m.kind === 'normal' || m.kind === 'hcnew').concat(VIZ_CORRECTIONS);

/**
 * `viz` quando ele é um modo DESTE menu (contraste ou correção), senão 'normal'.
 *
 * Chamava-se `resolveContrastValue` enquanto o menu só tinha contraste. O nome antigo passaria a mentir ao devolver
 * `fix-deuter`, e um nome que mente sobre o que devolve é pior que um nome comprido.
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
 * i18n KEY of the L->Q slider label ('lq.off'/'lq.linear'/'lq.mixed'/'lq.quadratic'). The label belongs to the L->Q
 * feature, so it lives with the filter that owns it (render/lq-filter) and is re-exported here under the name this
 * overlay has always used. Two copies of one rule is one copy too many: only the owner may change what the levels
 * mean. Callers resolve with `t()` — see the note on lqName about the `t` shadowing.
 */
export { lqName as lqLabel } from '../render/lq-filter.js';
import { lqName } from '../render/lq-filter.js';

/**
 * AS QUATRO POSIÇÕES DO REALCE DE CONTRASTE, escolhidas com esquerda e direita (ADR-0151): desligado, linear, misto e
 * quadrático — «da mesma forma que se troca o número de jogadores, e não através de uma barra».
 *
 * ⚠️ O VALOR DE «LINEAR» NÃO PODE SER ZERO: `setLq(0)` desliga o filtro, e qualquer valor acima liga a curva. 0,05 é o
 * primeiro passo que o cursor antigo dava — o valor mais linear que ainda liga o filtro. Misto é o meio, e quadrático
 * é a curva S inteira. Cada posição cai na faixa que o `lqName` já dá ao seu nome.
 */
export const LQ_STEPS: readonly number[] = [0, 0.05, 0.5, 1];

/**
 * Em que posição está um valor contínuo — incluindo um GUARDADO pelo cursor antigo (0,35, 0,7…). Pela faixa do
 * `lqName`, e não pelo valor mais próximo: é o NOME que a criança ouviu que tem de continuar a ser o de agora.
 */
export function lqPosition(amount: number): number {
  return Math.max(0, ['lq.off', 'lq.linear', 'lq.mixed', 'lq.quadratic'].indexOf(lqName(amount)));
}

/** t (0..1) -> slider percent (0..100, rounded) — mirrors `Math.round(lqT*100)`.
 *  @deprecated Desde o ADR-0151 o realce é escolhido por PASSOS (`LQ_STEPS`/`lqPosition`); fica pelo consumidor.
 *  ⚠️ Mudou de casa com o resto da metade pura e continua sem leitor na engine: a dívida veio junto, e dizê-lo aqui é
 *  o que impede a mudança de morada de a apagar da vista. */
export function lqPercent(t: number): number {
  return Math.round(clamp01(t) * 100);
}

/** slider percent (any number) -> clamped t (0..1) — mirrors `+lq.value/100` fed into setLq's clamp.
 *  @deprecated Desde o ADR-0151 o realce é escolhido por PASSOS; fica pelo consumidor. */
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
