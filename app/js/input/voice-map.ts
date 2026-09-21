// SPDX-License-Identifier: AGPL-3.0-or-later
// input/voice-map — THE WORDS A CHILD SAYS, AND THE POSITION EACH ONE PRESSES (ADR-0204 erratum; issues #184, #190).
//
// This is the pure half of playing by voice: a table of words per language, a closed grammar built from it, and the rule that
// decides WHEN a heard word becomes a press. Nothing here opens a microphone or loads a model — the same division that let the
// gaze cycle be measured without a camera.
//
// 🎯 THE WORDS ARE THE DEV'S, checked by him against what games use (racing R2 accelerate / L2 brake, shooters L2 aim / R2 fire)
// and then run in the lab's bar protocol in the three languages: pt 23/23, es 24/24, en 24/24 detected, all rated «ok».
// A position answers to ANY of its words, and L1/R1 are the ship's sides — his adaptation.
//
// ⚠️ ONE WORD IS KNOWN TO BE MISSING from a model's vocabulary: «boreste» is not in Vosk small pt (measured against its `Gr.fst`
// symbol table), so under that recogniser R1 answers only to «estibordo». It stays in the table because the browser's own
// recogniser has no closed vocabulary and does hear it — a word is dropped by the RECOGNISER that cannot hear it, never by this
// table, which is the Dev's decision written down.

import type { Action } from '../core/actions.js';

/** Every word of one language, by position. Lowercase and unaccented is the job of `palavrasDe` below, not of this table. */
export type VoiceWords = { readonly [A in Action]?: readonly string[] };

const PT: VoiceWords = {
  up: ['acima'], down: ['abaixo'], left: ['esquerda'], right: ['direita'],
  start: ['start'], select: ['select'],
  action1: ['ação'], action2: ['confirma', 'pega', 'ativar', 'pulo'], action3: ['voltar', 'solta', 'cancelar', 'especial'],
  action4: ['lista', 'troca'],
  leftShoulder: ['bombordo'], leftTrigger: ['mira', 'freia'],
  rightShoulder: ['estibordo', 'boreste'], rightTrigger: ['gatilho', 'acelera'],
};

const ES: VoiceWords = {
  up: ['arriba'], down: ['abajo'], left: ['izquierda'], right: ['derecha'],
  start: ['start'], select: ['select'],
  action1: ['acción'], action2: ['confirma', 'recoger', 'activar', 'saltar'], action3: ['volver', 'soltar', 'cancelar', 'especial'],
  action4: ['inventario', 'lista', 'cambiar'],
  leftShoulder: ['babor'], leftTrigger: ['apuntar', 'frenar'],
  rightShoulder: ['estribor'], rightTrigger: ['disparar', 'acelerar'],
};

const EN: VoiceWords = {
  up: ['up'], down: ['down'], left: ['left'], right: ['right'],
  start: ['start'], select: ['select'],
  action1: ['action'], action2: ['confirm', 'grab', 'pick up', 'activate', 'jump'], action3: ['back', 'drop', 'cancel', 'special'],
  action4: ['inventory', 'swap'],
  leftShoulder: ['port'], leftTrigger: ['aim', 'brake'],
  rightShoulder: ['starboard'], rightTrigger: ['trigger', 'accelerate'],
};

const BY_LANGUAGE: { readonly [k: string]: VoiceWords } = { pt: PT, es: ES, en: EN };

/** The table of the child's language. An unknown tag falls back to Portuguese, the project's base language (ADR-0010 pillar 3). */
export function voiceWordsFor(language: string): VoiceWords {
  return BY_LANGUAGE[language.split('-')[0]!.toLowerCase()] ?? PT;
}

/**
 * The words a sentence is made of, compared the way a recogniser writes them: no case, no accents, no punctuation.
 * The same rule the quiz's spoken answer uses — a recogniser that writes «Acima.» is not a child who said something else.
 */
function palavrasDe(frase: string): string[] {
  return frase.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
}

/**
 * THE CLOSED GRAMMAR: every word the recogniser is allowed to return, and nothing else (ADR-0189, ADR-0193).
 *
 * 📌 A grammar is what makes 32 MiB answer in a quarter of a second, and it is also what makes it answer WRONG when a child
 * says something that is not a command: the lab measured free speech being pushed to the nearest word («configurações de
 * inclusão» → «quatro»). That is the cost of the closed list and the reason the words are short and unlike each other.
 * ⚠️ `extra` is what the MENU is showing right now (ADR-0194): saying the name of an item activates it, so those words join the
 * grammar while that menu is open and leave with it.
 */
export function voiceGrammar(language: string, extra: readonly string[] = []): readonly string[] {
  const todas = new Set<string>();
  for (const palavras of Object.values(voiceWordsFor(language))) for (const p of palavras) todas.add(p.toLowerCase());
  for (const e of extra) { const limpo = palavrasDe(e).join(' '); if (limpo) todas.add(limpo); }
  return [...todas];
}

export interface VoiceCommands {
  /**
   * What the recogniser has heard SO FAR in this utterance, and the position it presses — or `null` when nothing new was said.
   * ⚠️ It answers on the PARTIAL and not at the end of the sentence (ADR-0193 erratum, the Dev's choice after running both):
   * 0.25–0.45 s against 1.3–1.4 s, which is the difference between a command and a delay a child gives up on.
   */
  partial(text: string): Action | null;
  /** The utterance ended (or the microphone was let go): the next partial starts a new sentence. */
  reset(): void;
}

/**
 * The rule that turns a growing partial into presses.
 *
 * 🎯 A PARTIAL GROWS, AND ONLY WHAT IS NEW FIRES. «acima» then «acima abaixo» is a child who said two words, and the second
 * press must be `down`, not `up` all over again — so the words already answered for are counted, never re-read.
 * 📌 The tail is matched LONGEST FIRST because a position may answer to a phrase: «pick up» is one command in English, and
 * reading only the last word would make it `null` after having fired nothing.
 */
export function createVoiceCommands(language: string): VoiceCommands {
  const words = voiceWordsFor(language);
  const porFrase = new Map<string, Action>();
  for (const [acao, ditas] of Object.entries(words) as [Action, readonly string[]][]) {
    for (const dita of ditas) porFrase.set(palavrasDe(dita).join(' '), acao);
  }
  const maisLonga = Math.max(1, ...[...porFrase.keys()].map((f) => f.split(' ').length));
  let respondidas = 0;
  let anteriores: string[] = [];

  return {
    partial(text) {
      const ditas = palavrasDe(text);
      /*
       * 🔴 A NEW UTTERANCE IS ONE THAT DOES NOT CONTINUE THE LAST, and counting words is not enough to see it: a recogniser
       * starts a new partial without saying so, and «abaixo» after «acima abaixo» is the same LENGTH as what was already
       * answered. A case caught it — the child said a second command and nothing moved. What a partial of the same utterance
       * always is, is the previous one plus more.
       */
      const continua = anteriores.every((p, i) => ditas[i] === p);
      if (!continua) respondidas = 0;
      anteriores = ditas;
      if (ditas.length <= respondidas) return null;
      for (let n = Math.min(maisLonga, ditas.length - respondidas); n >= 1; n--) {
        const acao = porFrase.get(ditas.slice(ditas.length - n).join(' '));
        if (acao) { respondidas = ditas.length; return acao; }
      }
      respondidas = ditas.length;
      return null;
    },
    reset() { respondidas = 0; anteriores = []; },
  };
}
