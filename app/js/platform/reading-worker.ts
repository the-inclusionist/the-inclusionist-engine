// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/reading-worker — THE TRANSCRIPTION, OFF THE MAIN THREAD (ADR-0216 §2; issue #185).
//
// 🔴 WHY A THREAD OF ITS OWN, and it is measured and not hygiene: `platform/reading-runtime` runs an encoder and then a decoder
// token by token, each one a wasm call of tens of milliseconds. On the main thread that is the thread that also draws the game
// and feeds the microphone — 📏 measured in the lab, Whisper transcribing on the main thread CUT THE AUDIO IN GAPS OF 4 s; the
// same work in a worker left a biggest gap of 264 ms. A child who reads aloud while the page transcribes loses the words she
// said during the pause, and nothing anywhere says so.
//
// The protocol is three messages and no state the caller cannot see:
//   · `{ kind: 'load', base, language }`      → `{ kind: 'ready' }` or `{ kind: 'failed', message }`
//   · `{ kind: 'transcribe', id, samples }`   → `{ kind: 'text', id, text }` or `{ kind: 'failed', id, message }`
// Every answer carries the `id` of the question, because a second reading may be asked for while the first is still running and
// an answer that cannot be matched to its question is an answer given to the wrong child.
//
// ⚠️ THE MODEL IS OPENED HERE, INSIDE THE WORKER, and that is the whole point: `loadReadingRuntime` fetches the graphs from the
// delivery and the ONNX runtime compiles them. Doing that on the main thread freezes the game for as long as it takes to open
// 378 MiB of model, which is the other half of the defect this file exists to remove.

import { loadReadingRuntime, type ReadingTranscriber } from './reading-runtime.js';

/** What the client asks for. */
export type ReadingRequest =
  | { readonly kind: 'load'; readonly base: string; readonly language: string }
  | { readonly kind: 'transcribe'; readonly id: number; readonly samples: Float32Array };

/** What the worker answers. `id` is absent only on the answer to `load`, which nobody can ask twice. */
export type ReadingAnswer =
  | { readonly kind: 'ready' }
  | { readonly kind: 'text'; readonly id: number; readonly text: string }
  | { readonly kind: 'failed'; readonly id?: number; readonly message: string };

/** The side of the conversation this file needs, so a gate can run the whole protocol without a thread. */
export interface WorkerScope {
  onmessage: ((event: { data: ReadingRequest }) => void) | null;
  postMessage(answer: ReadingAnswer): void;
  /**
   * The worker realm's own `fetch`, which the model's files are fetched with (ADR-0232 D4): the runtime receives it from the
   * scope, so the worker's entry reaches no bare global either.
   */
  fetch(url: string): Promise<Response>;
}

const reason = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Wires the protocol onto a scope. Exported — and not only run at import — so the gate exercises the REAL handler instead of a
 * copy of it written in the test, which is the difference between measuring the protocol and measuring a description of it.
 */
export function serveReading(scope: WorkerScope, load = loadReadingRuntime): void {
  let transcriber: ReadingTranscriber | null = null;
  scope.onmessage = (event): void => {
    const msg = event.data;
    if (msg.kind === 'load') {
      void (async (): Promise<void> => {
        try {
          // a METHOD call on the scope: `fetch` detached from its realm throws «Illegal invocation»
          transcriber = await load({ base: msg.base, language: msg.language, fetch: (url) => scope.fetch(url) });
          scope.postMessage({ kind: 'ready' });
        } catch (e) {
          scope.postMessage({ kind: 'failed', message: reason(e) });
        }
      })();
      return;
    }
    // ⚠️ A REQUEST BEFORE THE MODEL IS OPEN IS ANSWERED, not dropped: a dropped message leaves the caller's promise pending for
    // ever, and a child waiting for words that will never come has no way to know she should try again.
    void (async (): Promise<void> => {
      try {
        if (!transcriber) throw new Error('reading worker: asked to transcribe before the model was opened');
        scope.postMessage({ kind: 'text', id: msg.id, text: await transcriber.transcribe(msg.samples) });
      } catch (e) {
        scope.postMessage({ kind: 'failed', id: msg.id, message: reason(e) });
      }
    })();
  };
}

/*
 * THE WORKER'S OWN SCOPE, when this module IS the worker — and the guard is not ceremony: the same file is imported by the
 * gate and by `platform/reading-in-worker` for its types, where `self` is a WINDOW and wiring `onmessage` there would make the
 * page answer its own messages.
 *
 * ⚠️ `WorkerGlobalScope` AND NOT `importScripts`: this worker is a MODULE worker (it imports the runtime), and a module worker
 * has no `importScripts` at all — the first version of this guard tested for it and the worker would have stayed silent.
 */
declare const WorkerGlobalScope: (new () => unknown) | undefined;
declare const self: WorkerScope;
if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope) {
  serveReading(self);
}
