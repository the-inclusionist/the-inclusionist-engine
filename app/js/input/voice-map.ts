// SPDX-License-Identifier: AGPL-3.0-or-later
// input/voice-map — THE WORDS A CHILD SAYS, AND THE POSITION EACH ONE PRESSES (ADR-0204 erratum; issues #184, #190).
//
// This is the pure half of playing by voice: a table of words per language, a closed grammar built from it, and the rule that
// decides WHEN a heard word becomes a press. Nothing here opens a microphone or loads a model — the same division that let the
// gaze cycle be measured without a camera.
//
// 🎯 THE WORDS ARE THE DEV'S, checked by the Dev against what games use (racing R2 accelerate / L2 brake, shooters L2 aim / R2 fire)
// and then run in the lab's bar protocol in the three languages: pt 23/23, es 24/24, en 24/24 detected, all rated «ok».
// A position answers to ANY of its words, and L1/R1 are the ship's sides — his adaptation.
//
// ⚠️ ONE WORD IS KNOWN TO BE MISSING from a model's vocabulary: «boreste» is not in Vosk small pt (measured against its `Gr.fst`
// symbol table), so under that recogniser R1 answers only to «estibordo». It stays in the table because the browser's own
// recogniser has no closed vocabulary and does hear it — a word is dropped by the RECOGNISER that cannot hear it, never by this
// table, which is the Dev's decision written down.

import type { Action } from '../core/actions.js';
import { spokenText } from '../platform/speech-recognition.js';

/**
 * Every word of one language, by position.
 *
 * ⚠️ WRITTEN AS THE RECOGNISER'S VOCABULARY SPELLS THEM — lowercase, with their accents (the Dev's words are «ação» and
 * «Acción»): a grammar word the model does not know is dropped and its position goes mute (measured below). Comparing ignores
 * accents, because a heard sentence and a table entry both pass through `wordsOf` before they meet.
 */
export type VoiceWords = { readonly [A in Action]?: readonly string[] };

const PT: VoiceWords = {
  up: ['acima'], down: ['abaixo'], left: ['esquerda'], right: ['direita'],
  start: ['start'], select: ['select'],
  // 🔴 `ação` WITH THE CEDILLA AND THE TILDE, measured in a browser: written `acao`, the pt model answered "Ignoring word
  // missing in vocabulary: 'acao'" and the first position was MUTE — the child said the word and nothing happened. The
  // spelling here is the recogniser's VOCABULARY's; whoever compares no longer looks at accents (`wordsOf`), so spelling it
  // right costs nothing on the hearing side. ⚠️ `boreste` is still outside the small model's vocabulary (ADR-0204 erratum)
  // and stays on the table on purpose: it is the Dev's word, and a larger model hears it.
  action1: ['ação'], action2: ['confirma', 'pega', 'ativar', 'pulo'], action3: ['voltar', 'solta', 'cancelar', 'especial'],
  action4: ['lista', 'troca'],
  leftShoulder: ['bombordo'], leftTrigger: ['mira', 'freia'],
  rightShoulder: ['estibordo', 'boreste'], rightTrigger: ['gatilho', 'acelera'],
};

const ES: VoiceWords = {
  up: ['arriba'], down: ['abajo'], left: ['izquierda'], right: ['derecha'],
  start: ['start'], select: ['select'],
  // `acción` with its accent, by the pt line's measurement: the model's vocabulary keeps the word as the language writes it.
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
function wordsOf(sentence: string): string[] {
  return sentence.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
}

/**
 * THE CLOSED GRAMMAR: every word the recogniser is allowed to return, and nothing else (ADR-0189, ADR-0193).
 *
 * 📌 A grammar is what makes 32 MiB answer in a quarter of a second, and it is also what makes it answer WRONG when a child
 * says something that is not a command: the lab measured free speech being pushed to the nearest word («configurações de
 * inclusão» → «quatro»). That is the cost of the closed list and the reason the words are short and unlike each other.
 * ⚠️ `extra` is what the MENU is showing right now (ADR-0194): saying the name of an item activates it, so those words join the
 * grammar while that menu is open and leave with it — AS THE LANGUAGE WRITES THEM (§1, «as shown»), accents kept: stripped,
 * «configurações» is not in the model's vocabulary and the name goes mute, the same defect «acao» was.
 */
export function voiceGrammar(language: string, extra: readonly string[] = []): readonly string[] {
  const all = new Set<string>();
  for (const words of Object.values(voiceWordsFor(language))) for (const p of words) all.add(p.toLowerCase());
  for (const e of extra) { const clean = spokenText(e); if (clean) all.add(clean); }
  return [...all];
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
  const byPhrase = new Map<string, Action>();
  for (const [action, spoken] of Object.entries(words) as [Action, readonly string[]][]) {
    for (const phrase of spoken) byPhrase.set(wordsOf(phrase).join(' '), action);
  }
  const longest = Math.max(1, ...[...byPhrase.keys()].map((f) => f.split(' ').length));
  let answered = 0;
  let previous: string[] = [];

  return {
    partial(text) {
      const heard = wordsOf(text);
      /*
       * 🔴 A NEW UTTERANCE IS ONE THAT DOES NOT CONTINUE THE LAST, and counting words is not enough to see it: a recogniser
       * starts a new partial without saying so, and «abaixo» after «acima abaixo» is the same LENGTH as what was already
       * answered. A case caught it — the child said a second command and nothing moved. What a partial of the same utterance
       * always is, is the previous one plus more.
       */
      const continues = previous.every((p, i) => heard[i] === p);
      if (!continues) answered = 0;
      previous = heard;
      if (heard.length <= answered) return null;
      for (let n = Math.min(longest, heard.length - answered); n >= 1; n--) {
        const action = byPhrase.get(heard.slice(heard.length - n).join(' '));
        if (action) { answered = heard.length; return action; }
      }
      answered = heard.length;
      return null;
    },
    reset() { answered = 0; previous = []; },
  };
}
