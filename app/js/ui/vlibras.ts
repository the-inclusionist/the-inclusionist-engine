// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/vlibras.ts — DEAF MODE (ADR-0234). The Dev: «não existe modo libras, mas modo pessoa surda: sons ganham legenda e o
// sonar chama o intérprete».
//
// ONE SETTING, the 🦻 on the bar, and two things it turns on together:
//   · every interface sound is captioned — the root's caption host writes while deaf mode is on, whatever the captions
//     setting says (ADR-0164 rule 4);
//   · the sonar, pressed with deaf mode on, hands the INTERPRETER exactly the text it would have read aloud, and captions
//     it. With deaf mode off the sonar reads it aloud, as it always did.
// Written Portuguese is never removed (Lei 10.436 art. 4): what the interpreter is asked to sign is also captioned.
//
// THE STATE IS OURS. The mode is the person's choice, persisted, and never a reading of a third party's rectangle: it was
// once inferred from a widget's geometry, and when the widget moved its markup the mode answered "on" forever.
//
// 📌 THE INTERPRETER IS A PORT, text in and a result out, the same shape whichever player signs. The Dev chose route A and then
// route B (ADR-0234 errata): the VLibras player served from the delivery's own origin now (`ui/vlibras-player`, which the root
// uses when the host lends no interpreter of its own — `EngineHost.interpreter`), a free player after it — only the port's
// implementation changes.
// Where the delivery shipped no player, that interpreter answers as `NO_INTERPRETER` does: «signing unavailable», which goes to
// `problems` and to the child (ADR-0169). A player that fails at run time (no WebGL, never loads) takes the same path; the
// captions and the text never depend on it.
import type { Translate } from '../core/i18n.js';
import type { Store } from '../platform/storage.js';

/** What a sign request comes back with: signed, or why not — the reason goes into `problems`. */
export type SignResult = { readonly signed: true } | { readonly signed: false; readonly reason: string };

/** A player of Libras: whatever signs, or a test's double. */
export interface Interpreter {
  /** Signs exactly this text, in front of the screen; resolves with whether it could. */
  readonly sign: (text: string) => Promise<SignResult>;
  /** Takes the interpreter off the screen: deaf mode was turned off. */
  readonly hide: () => void;
  /** Releases the player: its root is gone. */
  readonly dispose: () => void;
}

/** The interpreter of a delivery that carries no Libras player (ADR-0234): it signs nothing and says why, and how to fix it. */
export const NO_INTERPRETER: Interpreter = {
  sign: () => Promise.resolve({
    signed: false,
    reason: 'a Libras player is not installed in this delivery — build it with `inclusionist-heavy <folder> --libras`',
  }),
  hide: () => { /* nothing on screen */ },
  dispose: () => { /* nothing held */ },
};

/** Where the person's choice is kept: the page's store, built by the root (ADR-0232, issue #207). */
export type DeafModeStore = Pick<Store, 'getBool' | 'setBool'>;

/** What a deaf mode is built over. Every port is the root's. */
export interface DeafModePorts {
  /** The page's store: the choice is read once, at build, and written at each toggle. */
  readonly store: DeafModeStore;
  /** The child's captions setting, read live: with deaf mode off it alone decides whether a sound is captioned. */
  readonly captionsSetting: () => boolean;
  /** The root's translator: what the child is told comes out in the page's language. */
  readonly t: Translate;
  /** Who signs. */
  readonly interpreter: Interpreter;
  /** The narration: what the sonar's text does with deaf mode off. */
  readonly speak: (text: string) => void;
  /** The caption host, which writes while deaf mode is on (`Engine.captionSound`). */
  readonly caption: (text: string) => void;
  /** The announcer: what the child is told about the interpreter. */
  readonly tell: (text: string) => void;
  /** A line of `problems`; each distinct line is reported once. */
  readonly report: (line: string) => void;
}

/** One root's deaf mode. */
export interface DeafMode {
  /** Is deaf mode on? The person's choice — never a player's state. */
  readonly isOn: () => boolean;
  /** Turns deaf mode on or off. It always flips: the state is ours. Off, the interpreter leaves the screen. */
  readonly toggle: () => void;
  /** Does a sound get its caption now? Deaf mode on, or the captions setting on — every sound is captioned in deaf mode. */
  readonly captionsOn: () => boolean;
  /** What the sonar found: captioned and handed to the interpreter with deaf mode on, spoken with it off. */
  readonly sonar: (text: string) => void;
  /** Runs `fn` when the mode turns on or off (a host's reflow); returns its release. */
  readonly onChange: (fn: () => void) => () => void;
  /** Releases the interpreter; an answer still on its way is dropped. */
  readonly dispose: () => void;
}

/** The line `problems` gets when the interpreter cannot sign: the subject, the child's cost and the fix (ADR-0169). */
export function signingUnavailableLine(reason: string): string {
  return `deaf mode's sign-language interpreter could not sign: ${reason}. A deaf child keeps the captions and the written `
    + 'text, but nothing is signed when she presses the sonar — give deaf mode a Libras player that can sign here (ADR-0234)';
}

/** Builds a deaf mode. The stored choice is read here, at build, never at import (ADR-0232). */
export function createDeafMode({ store, captionsSetting, t, interpreter, speak, caption, tell, report }: DeafModePorts): DeafMode {
  let on = store.getBool('incl_libras', false);
  let disposed = false;
  /** Whether the child has been told, since the mode last came on, that signing is unavailable — told once, not per press. */
  let told = false;
  /** The lines already in `problems`: a child pressing the sonar twenty times is one diagnosis, not twenty. */
  const reported = new Set<string>();
  const changeListeners = new Set<() => void>();

  /**
   * The answer to one request, heard only while the mode that asked is still on and the root still alive. The first «no»
   * is told through the announcer AND written after the sonar's text: she is deaf, and the announcer alone is heard.
   */
  const heard = (text: string, result: SignResult): void => {
    if (disposed || !on || result.signed) return;
    const line = signingUnavailableLine(result.reason);
    if (!reported.has(line)) { reported.add(line); report(line); }
    if (told) return;
    told = true;
    const notice = t('sr.deaf.noSigning');
    tell(notice);
    caption(`${text} ${notice}`);
  };

  const toggle = (): void => {
    on = !on;
    store.setBool('incl_libras', on);
    if (on) told = false; else interpreter.hide();
    for (const fn of [...changeListeners]) fn();
  };

  const sonar = (text: string): void => {
    if (!on) { speak(text); return; }
    caption(text);
    let answer: Promise<SignResult>;
    try { answer = interpreter.sign(text); } catch (failure) { answer = Promise.reject(failure); }
    answer.then((result) => { heard(text, result); }, (failure: unknown) => {
      heard(text, { signed: false, reason: failure instanceof Error ? failure.message : String(failure) });
    });
  };

  return {
    isOn: () => on,
    toggle,
    captionsOn: () => on || captionsSetting(),
    sonar,
    onChange: (fn) => { changeListeners.add(fn); return () => { changeListeners.delete(fn); }; },
    dispose: () => {
      disposed = true;
      interpreter.dispose();
    },
  };
}
