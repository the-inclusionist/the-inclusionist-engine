// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/motion-choices — WHAT A MOVEMENT CHOICE IS, with no document anywhere near it.
//
// 📌 THE SUITE HAD ALREADY DRAWN THIS SEAM, which is what makes the cut a reading and not an opinion:
// `tests/settings-motion.node.test.js` exercises exactly these names, and the node project mounts no document — so
// whoever wrote those cases had to know where the panel stops being a panel. It is the fifth module to come out this
// way, after `ui/audio-choices`, `ui/typo-choices`, `ui/control-choices` and `ui/visual-choices`.
//
// What lives here answers «what is each target called, is everything already frozen, and what does the screen reader
// hear»; what stays in `ui/settings-motion` is the work its name never mentioned — mounting the rows, reconciling
// them with the cartridge, wiring them and reflecting the choice.

import { t } from '../core/i18n.js';
import type { MotionSceneKey, MotionCharDef, MotionPlayer, MotionSceneFlags } from './motion-scene.js';

/**
 * Alvo → CHAVE i18n do rótulo. CHAVES, e não texto, pelo motivo de sempre: uma tabela de `const` com texto resolve UMA
 * vez, no import, e fica congelada no idioma do boot.
 *
 * E é UMA tabela onde eram DUAS. A nota anterior dizia que `walk/breath/flavor` ficavam "redundantes com rmChar[].lbl"
 * e que não haviam sido podados "por fidelidade de porte" — havia uma terceira cópia, morta, no main.js. Três tabelas
 * dos mesmos rótulos, sem nada ligando as três: mudar um rótulo pedia três edições e esquecer uma era silencioso.
 * Agora `rmChar[].lbl` guarda a chave DESTA tabela, e a do main.js foi apagada.
 */
export const RM_LABEL: Record<string, string> = {
  parallax: 'rm.parallax', decor: 'rm.decor', items: 'rm.items',
  walk: 'rm.walk', breath: 'rm.breath', flavor: 'rm.flavor', particles: 'rm.particles',
};

/** CHAVES i18n dos três efeitos CRT (ver `RM_LABEL`). */
export const CRT_LBL: Record<'scan' | 'vig' | 'round', string> = { scan: 'rm.crt.scan', vig: 'rm.crt.vig', round: 'rm.crt.round' };

// ⚠️ CHAVES desde 2026-09-12: eram as três palavras em português cru, e o anúncio saía «Rounded corners: grande» num
// jogo em inglês. Passaram pelo dicionário quando os cantos viraram passos ⯇ ⯈ (ADR-0151).
export const CRT_ROUND_LEVELS: readonly string[] = ['crt.round.off', 'crt.round.small', 'crt.round.large'];

/** selAnimPlayer nunca aponta pra fora do nº de telas atual. */
export function clampSelectedPlayer(selected: number, total: number): number {
  return selected >= total ? 0 : selected;
}

/** true quando TUDO (cena + personagem selecionado) já está com movimento reduzido LIGADO, isto é, congelado — nome
 *  fiel ao `rm[k]`/`player[prop]` que representam "reduzido", não "animado". Controla se o botão-mestre oferece
 *  "Retomar" (true) ou "Parar" (false) — mesma variável `allOn` do game.js original. */
export function allMotionFrozen(rmKeys: readonly MotionSceneKey[], rm: MotionSceneFlags, rmChar: readonly MotionCharDef[], player: MotionPlayer | undefined): boolean {
  // 🔴 SEM PERSONAGEM, A METADE DO PERSONAGEM NÃO PESA — e a versão anterior fazia o contrário, com
  // `rmChar.every((c) => !!(player && player[c.prop]))`, que é SEMPRE FALSO quando não há jogador.
  //
  // 📏 Medido em 2026-09-11, quando a engine passou a montar este painel para todo jogo: num jogo que não declara
  // `players` — um quiz, um puzzle — `allFrozen` ficava preso em `false`, logo o botão-mestre calculava
  // `next = !false = true` a CADA clique. A criança parava todas as animações e **não tinha como as trazer de
  // volta**: o botão continuava a oferecer «Parar» e a fazer o que já estava feito.
  //
  // É a mesma forma do defeito que o `boot/create-game` já regista sobre o modo cego — «ligava uma vez e NÃO HAVIA
  // COMO DESLIGAR» —, e custa mais a quem ligou o congelamento por precisar dele: essa pessoa não experimenta o botão
  // por curiosidade, carrega nele com enjoo.
  //
  // ⚠️ E O CASO QUE COBRIA ISTO FIXAVA O DEFEITO: ele afirmava «sem player nunca dá true» com a razão escrita em
  // termos do mecanismo — «RM_CHAR.every falha» —, e não da pessoa. Um caso que descreve a implementação não pode
  // discordar dela.
  //
  // 📌 Com jogador, nada muda: `!player` é falso e a conta é a de sempre, alvo a alvo.
  return rmKeys.every((k) => rm[k]) && (!player || rmChar.every((c) => !!player[c.prop]));
}

/** allFrozen=true (tudo já congelado) → oferece "Retomar"; caso contrário → oferece "Parar". */
export function motionMasterLabel(allFrozen: boolean): string {
  return t(allFrozen ? 'a11y.resumeAll' : 'a11y.stopAll'); // no glyph in the name (ADR-0159 rule 12), in the page's language
}

/** `label` chega JÁ TRADUZIDO; o que era concatenação (' congelado.') virou moldura com `{alvo}` — é o que permite a
 *  uma língua pôr o estado ANTES do alvo, coisa que uma concatenação não deixa. */
export function sceneMotionAnnouncement(label: string, frozen: boolean): string {
  return t(frozen ? 'sr.rm.frozen' : 'sr.rm.animated', { alvo: label });
}

export function crtToggleAnnouncement(label: string, on: boolean): string {
  return t(on ? 'sr.crt.on' : 'sr.crt.off', { efeito: label });
}

export function crtLevelLabel(level: number): string {
  const key = CRT_ROUND_LEVELS[level];
  return key ? t(key) : '';
}

export function crtRoundAnnouncement(label: string, level: number): string {
  return t('sr.crt.round', { efeito: label, nivel: crtLevelLabel(level) });
}

/** `nowFrozen` = o NOVO valor de rm[k]/player[prop] aplicado pelo botão-mestre (true = acabou de congelar tudo;
 *  false = acabou de descongelar/retomar tudo) — mesma variável `v` do game.js original. */
export function stopResumeAllAnnouncement(nowFrozen: boolean): string {
  return t(nowFrozen ? 'sr.rm.allStopped' : 'sr.rm.allResumed');
}
