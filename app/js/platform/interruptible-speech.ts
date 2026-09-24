// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/interruptible-speech — SPEAK THE LATEST REQUEST, AND SILENCE THE PREVIOUS ONE AT ONCE (ADR-0044, item 2).
//
// ========================= THE DEFECT THIS REPLACES =========================
// The neural engine used to speak like this:
//
//     speak: (text) => { if (busy) next = text; else speakNow(text); }   // a queue of 1
//
// A QUEUE, of size one. Sweeping five menu items, the child heard the FIRST one whole and then the LAST — the three in
// between vanished in silence, because each new request overwrote `next`. It is slow AND it loses information, and both
// hurt in the same place: a person who cannot see navigates BY EAR, and the ear was several items behind the focus.
//
// XAG 106 says what to do, and why: if the focused item's narration is still being read when the focus moves, the
// original element's narration stops IMMEDIATELY and the new element's begins.
//
// ========================= THE TWO THINGS THIS GUARANTEES =========================
//
//   1. SILENCE BEFORE SYNTHESISING, not after. Neural synthesis takes time; stopping only once the new audio is ready would
//      leave the old voice speaking during the wait — the wrong item, with conviction. Silence is the right answer: the
//      child knows they moved, and the silence confirms it.
//
//   2. A GENERATION, which is what prevents the race. `synthesize` is asynchronous, and two requests can finish out of
//      order: the second is ready first and starts playing, then the first arrives and runs it over — the child would
//      hear the item they ALREADY passed, on top of the current one. Each request carries its number; whatever comes back
//      with an old number is dropped, at each of the two `await`s.
//
// ========================= WHY A MODULE, AND NOT A LINE IN `tts` =========================
// Because this way it can be PROVEN. The neural block lives inside a dynamic `import()` that only resolves with the
// runtime present; testing it there would need the real engine. Here the policy is pure — it receives "how to
// synthesise", "how to play" and "how to stop" — and the node test exercises the race and the interruption with fakes,
// in milliseconds.

/** What the caller provides. Nothing here knows the neural engine, Web Audio or the browser. */
export interface SpeechEngine<Audio, Fonte> {
  /** Text → audio. ASYNCHRONOUS on purpose: it is where neural synthesis spends its time. */
  synthesize(text: string): Promise<Audio>;
  /** Starts playing and returns the source, so it can be stopped. `null` = it could not play right now. */
  play(audio: Audio, onEnded: () => void): Fonte | null;
  /** Silences the source. Called with what `play` returned, and never with `null`. */
  stop(playing: Fonte): void;
}

export interface InterruptibleSpeech {
  /** Speaks `text`, SILENCING at once whatever is speaking. It does not queue: the latest request is the one that counts. */
  speak(text: string): void;
  /** Silences and forgets. Used when a menu closes or narration is switched off. */
  silence(): void;
  /** Is anything playing? For tests and debugging only — the policy does not depend on it. */
  speaking(): boolean;
}

export function createInterruptibleSpeech<Audio, Fonte>(engine: SpeechEngine<Audio, Fonte>): InterruptibleSpeech {
  let nowPlaying: Fonte | null = null;
  let currentTurn = 0;

  /** Silences whatever is playing. The `try` exists because stopping an already finished source throws in some engines. */
  function stopPlayback(): void {
    if (nowPlaying !== null) {
      try { engine.stop(nowPlaying); } catch (e) { /* the source already ended — stopping again is no error */ }
      nowPlaying = null;
    }
  }

  async function speakNow(text: string): Promise<void> {
    const myTurn = ++currentTurn; // claims the turn BEFORE any wait
    stopPlayback();             // guarantee 1: immediate silence, not at the end of synthesis
    if (!text) return;
    try {
      const audio = await engine.synthesize(text);
      if (myTurn !== currentTurn) return; // guarantee 2: it arrived late — another request already took over
      stopPlayback();                   // again: something may have started playing during the wait
      const playing = engine.play(audio, () => { if (nowPlaying === playing) nowPlaying = null; });
      if (myTurn !== currentTurn) { if (playing !== null) { try { engine.stop(playing); } catch (e) { /* noop */ } } return; }
      nowPlaying = playing;
    } catch (e) {
      // Synthesis failed for THIS text. No reason to bring the whole narration down: the next request tries again, and one
      // silent item is better than a dead engine.
    }
  }

  return {
    speak: (text) => { void speakNow(text); },
    silence: () => { currentTurn++; stopPlayback(); }, // the `++` invalidates whatever is being synthesised now
    speaking: () => nowPlaying !== null,
  };
}
