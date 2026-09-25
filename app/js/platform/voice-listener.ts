// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/voice-listener — THE MICROPHONE THAT HEARS COMMANDS, AND LETS GO (ADR-0189, ADR-0193; issue #184).
//
// The reading opens a microphone for one sentence and closes it (`platform/microphone`); this one stays open while the child
// plays by voice, because a command may come at any moment. Everything else is the same promise: the sound is handed to a
// recogniser ON THIS MACHINE, nothing is kept, and letting go is part of the job — a page that is still listening after the
// child turned voice off is the promise broken, however good the reason.
//
// 📌 THE GRAMMAR CARRIES `[unk]`, and it is what lets the recogniser answer «that was not one of these». Without it a closed
// grammar pushes whatever it hears to the NEAREST word — the lab measured «configurações de inclusão» coming back as «quatro»,
// which in a game is a button the child never pressed.
//
// ⚠️ `ScriptProcessorNode`, deprecated, for the reason already written in `platform/microphone`: the AudioWorklet replacement
// needs its code served as a module and the engine's policy has no `blob:` in `script-src` (ADR-0214). It is also what
// `acceptWaveform` takes directly. Written here so the next person does not «fix» it without that decision.

import type { AudioContextLike, StreamLike, ProcessorNode } from './microphone.js';
import type { VoskModel, VoskRecognizer } from './vosk-runtime.js';

/** How much sound is handed over at a time. The lab's number; smaller starves the recogniser, larger delays a command. */
export const VOICE_BLOCK = 4096;

export interface VoiceListenerDeps {
  readonly model: VoskModel;
  /** Every phrase the recogniser may answer with: the language's words, plus what the open menu is showing (ADR-0194). */
  readonly grammar: readonly string[];
  /**
   * The host's `navigator.mediaDevices.getUserMedia`, lent by the root (ADR-0232 D4). REQUIRED, and `undefined` is a device
   * with no microphone: REFUSED and said, never hidden.
   */
  readonly getUserMedia: ((constraints: { audio: object | boolean }) => Promise<StreamLike>) | undefined;
  /** A new audio context from the host's `AudioContext`, lent by the root. REQUIRED. */
  readonly createContext: () => AudioContextLike;
  /** What the recogniser has heard so far in this utterance. */
  readonly onPartial: (text: string) => void;
  /**
   * The utterance ended, with the recogniser's last word on it: a name the partials held back because another item's name
   * continued it («voltar» while «voltar ao jogo» could follow) is decided HERE (ADR-0194 §3), and whoever counts what was
   * already answered for starts a new sentence. `''` when the recogniser heard nothing it knows.
   */
  readonly onFinal?: (text: string) => void;
}

export interface VoiceListener {
  /** The words the recogniser may answer with, from now on. A new grammar is a new recogniser; the microphone stays open. */
  setGrammar(grammar: readonly string[]): void;
  /** Gives the microphone back and closes everything. Safe to call twice. */
  stop(): Promise<void>;
}

const withUnknown = (grammar: readonly string[]): string => JSON.stringify([...grammar, '[unk]']);

/**
 * Opens the microphone and feeds the recogniser until `stop()`.
 *
 * ⚠️ THE MICROPHONE IS ASKED FOR WITH ECHO CANCELLATION AND NOISE SUPPRESSION, which is what a classroom needs: twenty children
 * in one room is the case, not the exception. Mono, because the recogniser hears one channel.
 */
export async function startVoiceListening(d: VoiceListenerDeps): Promise<VoiceListener> {
  const { getUserMedia } = d;
  if (!getUserMedia) throw new Error('voice-listener: this device cannot open a microphone');
  const context = d.createContext();

  let recognizer: VoskRecognizer = new d.model.KaldiRecognizer(context.sampleRate, withUnknown(d.grammar));
  const listen = (r: VoskRecognizer): void => {
    r.on('partialresult', (heard) => { const t = heard.result.partial; if (t) d.onPartial(t); });
    r.on('result', (heard) => { d.onFinal?.(heard.result.text ?? ''); });
  };
  listen(recognizer);

  const stream = await getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const node: ProcessorNode = context.createScriptProcessor(VOICE_BLOCK, 1, 1);
  let stopped = false;
  node.onaudioprocess = (e) => {
    if (stopped) return;
    // ⚠️ A recogniser that throws on one block must not take the microphone down with it: the next block is a new chance, and
    // a child mid-sentence would otherwise lose the rest of it.
    try { recognizer.acceptWaveform(e.inputBuffer as unknown as AudioBuffer); } catch { /* this block is lost, the next is not */ }
  };
  context.createMediaStreamSource(stream).connect(node);
  // 📌 The graph has to REACH the destination or nothing is pulled through it — and it must be silent, or the classroom hears
  // itself. That is what the muted gain is for; it is not decoration.
  node.connect(context.destination);

  return {
    setGrammar(grammar) {
      if (stopped) return;
      const previous = recognizer;
      recognizer = new d.model.KaldiRecognizer(context.sampleRate, withUnknown(grammar));
      listen(recognizer);
      try { previous.remove(); } catch { /* an old recogniser that is already gone is not a failure */ }
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      node.onaudioprocess = null;
      try { node.disconnect(); } catch { /* a node already detached is not a failure */ }
      for (const t of stream.getTracks()) t.stop();
      try { recognizer.remove(); } catch { /* idem */ }
      try { d.model.terminate?.(); } catch { /* idem */ }
      await context.close();
    },
  };
}
