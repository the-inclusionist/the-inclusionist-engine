// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/control-choices.ts — O QUE UMA TECLA É E DE QUEM ELA JÁ É, sem documento nenhum.
//
// Três perguntas e só três: como se chama um código de tecla, que OUTRO jogador já tem esse código, e que
// OUTRA posição do mesmo esquema já o tem. Zero DOM, zero ctx, zero estado.
//
// 📌 Mesmo corte que o `ui/audio-choices` e o `ui/typo-choices` receberam (notas BD e BJ), e marcado pela mesma
// coisa: o `tests/settings-controls.node.test.js` já exercia estas funções num projecto SEM documento, e o de
// navegador conduzia o resto. A costura estava desenhada na pasta de testes antes de existir no código.
//
// 🔴 E A RAZÃO IMEDIATA FOI MEDIDA: ao adoptar o kit de painel (nota BK), o `ui/settings-controls` ficou com 195
// linhas de código contra um tecto de 195 (ADR-0221) — sem uma linha de folga. É a catraca a apontar o corte
// certo em vez de lhe ser pedida uma excepção, exactamente como aconteceu com a tipografia horas antes.
import { t } from '../core/i18n.js';
import { ACTIONS, type Action } from '../core/actions.js';
import type { KeyScheme } from '../core/entity.js';

/**
 * Physical key code → short readable label.
 *
 * Only `Space` has a word to translate; the rest are glyphs and bare letters, identical in every language —
 * and that is why this is a chain of replaces and not a table.
 */
export function keyName(code: string): string {
  return String(code)
    .replace('Arrow', '↔')
    .replace('Key', '')
    .replace('Space', t('key.space'))
    .replace('ShiftLeft', 'Shift')
    .replace('ShiftRight', 'Shift');
}

/**
 * Which OTHER player already owns `code`, among `schemes` (one entry per player, same order as player index) —
 * or -1 if free. `mapRef` (the scheme currently being edited) is excluded BY REFERENCE, mirroring the original
 * `keyUsedByOther(code, mapRef)` closing over `kbFor`/numPlayers in game.js. Built over a Map (code → owner
 * index) so a scheme with many bound keys does not cost a full re-scan per lookup.
 */
export function keyUsedByOther(code: string, mapRef: KeyScheme, schemes: readonly KeyScheme[]): number {
  const owners = new Map<string, number>();
  schemes.forEach((m, i) => {
    if (m === mapRef) return;
    for (const a of ACTIONS) for (const c of m[a] || []) if (!owners.has(c)) owners.set(c, i);
  });
  return owners.get(code) ?? -1;
}

/**
 * Qual OUTRA acção DO MESMO esquema já tem `code` — ou `null` se nenhuma.
 *
 * ⚠️ O IRMÃO QUE FALTAVA AO `keyUsedByOther`, E A FALTA ERA INVISÍVEL NUM JOGO DE UM JOGADOR (#126). Aquele
 * exclui o esquema em edição **por referência**; com um jogador só, `schemesFor()` devolve exactamente esse
 * esquema, então a guarda varre uma lista vazia e **nunca pode disparar**. A criança que põe `W` numa acção
 * nova continua com `W` na antiga, e passa o jogo inteiro com as duas a disparar juntas.
 *
 * ⚠️ E O DEFEITO É O PIOR FEITIO POSSÍVEL, escrito no cabeçalho do `input/default-bindings` desde sempre:
 * «as duas acções disparam juntas, e a criança vê uma acção dupla intermitente que ninguém consegue reproduzir
 * de propósito». Numa tela que ela abriu **porque** não conseguia usar os controles padrão.
 *
 * ⚠️ A guarda entre JOGADORES não estava partida — estava inalcançável. Medido na auditoria: com dois
 * assentos ela funciona e recusa certo. O que faltava era a verificação dentro do mesmo esquema.
 *
 * Devolve a ACÇÃO e não um booleano, porque o anúncio tem de dizer qual — «essa tecla já está em uso» manda a
 * criança procurar o que a função já sabe.
 */
export function actionAlreadyBound(code: string, mapRef: KeyScheme, except: Action): Action | null {
  for (const a of ACTIONS) {
    if (a === except) continue;
    if ((mapRef[a] || []).includes(code)) return a;
  }
  return null;
}
