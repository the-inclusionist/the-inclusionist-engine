// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/menu-intent — what a key MEANS inside a menu, and how far one step goes, with no menu: the generic key tables, a key's
// intent given its owner's remapped action, and the steps of a list, a select, a range and the pause card (ADR-0221; issue
// #203).
//
// It left `ui/menu-nav` for the reason the `*-choices` modules left their panels: the node test drove exactly these names with
// no document, so the seam was already drawn. What stays there is the navigation that needs a page — finding the focused item,
// moving the focus, announcing it.
import type { NavKeys } from '../input/edges.js';
import { stepInRing } from '../core/ring.js';

/* As tabelas de tecla GENÉRICA (as que valem para qualquer jogador, mesmo sem remap). Viraram `Set` porque é
   o que elas sempre foram semanticamente — pertinência, não ordem — e porque um `Set` nomeado deixa a tabela
   auditável de fora (o teste importa a constante em vez de repetir os literais). Conteúdo VERBATIM. */
/** Confirma/entra. `NumpadEnter` conta aqui (mas NÃO pausa: ver o ouvinte de bolha do game.js). */
export const KEY_YES: ReadonlySet<string> = new Set(['Space', 'KeyJ', 'Enter', 'NumpadEnter']);
/** Volta. ⚠️ DEFEITO 2: `Escape` é a MESMA intenção que a ação "especial" do gamepad. Verbatim. */
export const KEY_NO: ReadonlySet<string> = new Set(['Escape']);
export const KEY_UP: ReadonlySet<string> = new Set(['ArrowUp', 'KeyW']);
export const KEY_DOWN: ReadonlySet<string> = new Set(['ArrowDown', 'KeyS']);
export const KEY_LEFT: ReadonlySet<string> = new Set(['ArrowLeft', 'KeyA']);
export const KEY_RIGHT: ReadonlySet<string> = new Set(['ArrowRight', 'KeyD']);

/**
 * Traduz (tecla física, ação remapeada do dono da tecla) → intenção. `act` é `null` quando a tecla não é de
 * nenhum jogador (tecla genérica). Verbatim das seis linhas de `menuNavKey`.
 */
export function menuKeyIntent(code: string, act: string | null): NavKeys {
  return {
    yes: KEY_YES.has(code) || act === 'action2',
    no: KEY_NO.has(code) || act === 'action3',
    up: KEY_UP.has(code) || act === 'up',
    down: KEY_DOWN.has(code) || act === 'down',
    left: KEY_LEFT.has(code) || act === 'left',
    right: KEY_RIGHT.has(code) || act === 'right',
  };
}

/** `select` com esquerda/direita: um passo, SEM dar a volta — ajustar VALOR não é navegar lista (ver acima). */
export function selectStep(selectedIndex: number, optionsLen: number, delta: number): number {
  return Math.max(0, Math.min(optionsLen - 1, selectedIndex + delta));
}

/** `select` com "sim": um passo, COM volta. É a diferença deliberada entre confirmar e ajustar. */
export function selectWrap(selectedIndex: number, optionsLen: number): number {
  return (selectedIndex + 1) % optionsLen;
}

/** `input[type=range]` com esquerda/direita: um `step` (default 1), preso entre `min` e `max`. */
export function rangeStep(value: number, min: number, max: number, step: number, delta: number): number {
  const st = step || 1; // `+cur.step||1`: step ausente/0/NaN vira 1, verbatim
  return Math.max(min, Math.min(max, value + delta * st));
}

/**
 * O PASSO DO CURSOR NO MENU DE PAUSA — um ANEL, agora que a pausa é uma lista (ADR-0044, itens 1 e 7).
 *
 * ISTO SUBSTITUI `pauseGridMove`, e a substituição é o desfecho do ADR-0044, não uma limpeza. O que havia
 * era uma GRADE de duas zonas — a barra de dez ícones em cima, a lista de itens em duas colunas embaixo — e
 * uma fronteira entre elas com quatro regras próprias ("de cima, 'baixo' cai sempre no primeiro item", "da
 * primeira linha, 'cima' sobe para o ícone de mesmo índice", …). Cada regra dessas era uma coisa a mais para
 * a criança descobrir sem ver, e nenhuma delas era descobrível: só se aprendia esbarrando.
 *
 * A XAG 106 permite laço para menu LINEAR e o PROÍBE para grade de duas dimensões — numa grade, dar a volta
 * teleporta o cursor para o outro canto e a pessoa perde a noção de onde está. Era por isso que o anel do
 * item 1 valia para todo menu do jogo MENOS este. Com a barra no HUD (item 7), o cartão passou a ter uma
 * lista só, e o laço deixou de ser proibido para virar o recomendado.
 *
 * O que se ganha em troca das quatro regras: `quit` fica a UMA tecla para CIMA de `resume`. Último na
 * leitura, vizinho no dedo.
 */
export function stepInPause(len: number, idx: number, k: NavKeys): number {
  const d = (k.down || k.right) ? 1 : -1;
  return stepInRing(len, idx < 0 ? 0 : idx, d);
}
