// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/reading-in-worker — THE ENGINE'S SIDE OF THE READING WORKER (ADR-0216 §2; issue #185).
//
// Answers the same shape `platform/reading` asks its `model` port for — something with `transcribe(samples)` — and keeps the
// work off the thread that draws the game and feeds the microphone (`platform/reading-worker` says what that costs when it is
// not kept off it).
//
// 📌 THE WORKER IS OPENED AT THE FIRST READING AND KEPT, not opened per utterance: opening it means compiling the model again,
// and the model is up to 378 MiB. It is closed when the engine lets the reading go, so a game that stops listening stops
// paying for a thread.

import type { ReadingAnswer, ReadingRequest } from './reading-worker.js';

/** The little of a `Worker` this module uses, so a gate can answer the protocol without a thread. */
export interface ReadingWorkerLike {
  postMessage(message: ReadingRequest, transfer?: readonly Transferable[]): void;
  onmessage: ((event: { data: ReadingAnswer }) => void) | null;
  onerror?: ((event: unknown) => void) | null;
  terminate(): void;
}

export interface ReadingInWorkerDeps {
  /** The page's address: the worker resolves `heavy/` against it, because IT is who fetches the model. */
  readonly base: string;
  readonly language: string;
  /**
   * Opens the thread: `platform/reading-worker` started as a module worker. REQUIRED (ADR-0232 D4), and the root writes it,
   * because the one form a bundler recognises — `new Worker(new URL('…', import.meta.url), { type: 'module' })`, literally —
   * has to sit where the `Worker` is the host's.
   */
  readonly spawn: () => ReadingWorkerLike;
  /**
   * WHY THE THREAD COULD NOT OPEN, WHEN NOBODY IS THERE TO BE TOLD (ADR-0169).
   *
   * 🔴 The opening is awaited by `transcribe()`, and only by it. A game that declares `uses: { reading: true }` and has
   * not listened yet — or one whose child never will — has nobody awaiting the answer, so a model that does not load
   * used to reject into NOTHING: an unhandled rejection in a browser's console, and silence in `problems`.
   * 📌 THE REASON AND NOT THE SENTENCE: what this hands over is the failure's own words, and the line a human reads —
   * what the child loses, what to do about it — is written by whoever owns the diagnostic channel. A module that is
   * one thread's protocol has no business holding interface prose, and the raw-prose ledger is where that shows.
   * 📌 Optional, and the absence is answered: without it the failure is still owned, it is just not reported.
   */
  readonly report?: (reason: string) => void;
}

export interface ReadingInWorker {
  transcribe(samples: Float32Array): Promise<string>;
  /** Lets the thread go. A transcription still running answers with the reason instead of never answering. */
  close(): void;
}

/** The reading thread of the language being read in, kept between readings; see `keepOneThreadPerLanguage`. */
export interface ReadingThreads<T extends { close(): void }> {
  /**
   * The thread for this language: the one kept when its base language is the same, else a new one from `open` — handed a
   * `failed` to call when its opening fails. `open` is given at each call because the one form a bundler recognises for the
   * thread's file has to sit where the host's `Worker` is (ADR-0232 D4), which is the caller's scope and not this module's.
   */
  forLanguage(language: string, open: (failed: () => void) => T): T;
  /** Lets the kept thread go (the game left); the next `forLanguage` opens one again. */
  close(): void;
}

/**
 * ONE READING THREAD PER LANGUAGE, KEPT (issue #185; ADR-0225 erratum). Opening a thread compiles a model of up to 378 MiB, so a
 * reading in the language already open reuses its thread, and a reading in another language (a child who switched: `pt-BR` and
 * `pt-PT` are one model, `pt` and `en` are two) closes the old thread and opens the new one — one compiled model in memory at a
 * time, which is what a school machine can hold.
 * 🔴 A THREAD WHOSE OPENING FAILED IS FORGOTTEN: the next reading opens it again — the model may have come down since, and a
 * thread kept dead would answer every later reading with the first one's failure.
 */
export function keepOneThreadPerLanguage<T extends { close(): void }>(): ReadingThreads<T> {
  let kept: { readonly base: string; thread: T | null; dead: boolean } | null = null;
  const baseOf = (tag: string): string => tag.split('-')[0]!.toLowerCase();
  return {
    forLanguage(language, open) {
      const base = baseOf(language);
      if (kept?.base === base && kept.thread) return kept.thread;
      kept?.thread?.close();
      const mine: { readonly base: string; thread: T | null; dead: boolean } = { base, thread: null, dead: false };
      kept = mine;
      const thread = open(() => {
        mine.dead = true;
        if (kept === mine) kept = null;
        mine.thread?.close();
      });
      if (mine.dead) { thread.close(); return thread; }   // it failed while opening: answered, and not kept
      mine.thread = thread;
      return thread;
    },
    close() {
      kept?.thread?.close();
      kept = null;
    },
  };
}

export function createReadingInWorker(d: ReadingInWorkerDeps): ReadingInWorker {
  const worker = d.spawn();
  let nextId = 1;
  const waiting = new Map<number, { resolve: (text: string) => void; reject: (e: Error) => void }>();
  let opened: { resolve: () => void; reject: (e: Error) => void } | null = null;
  let closed = false;

  const openedPromise = new Promise<void>((resolve, reject) => { opened = { resolve, reject }; });
  /*
   * 🔴 THE OPENING HAS AN OWNER FROM BIRTH, and giving it one is the whole job of this line. Nothing awaits
   * `openedPromise` until the first `transcribe()`, so a thread that cannot open — a model file the delivery never
   * wrote, a wasm that will not compile — rejected into nothing.
   * 📏 Measured 2026-09-22: the browser project ended with every one of its 1140 cases green and an exit code of
   * FAILURE, from this rejection alone. A suite that reports failure while passing teaches everyone to stop reading
   * the exit code, and this house has already paid for that once — the published branch's CI was red for eight days.
   * ⚠️ AND IT DOES NOT SWALLOW THE REASON: `transcribe()` awaits this same promise and still throws it, so whoever
   * asked for a reading is told what went wrong. This line is for when NOBODY asks.
   * 📌 Letting the thread go is not a failure: `close()` rejects the opening to release whoever was waiting, and a
   * child who changed games is not a defect to report.
   */
  openedPromise.catch((e: Error) => {
    if (closed) return;
    d.report?.(e.message);
  });

  /** Everything pending gives up with the SAME reason — a promise nobody ever settles is how a game freezes politely. */
  const giveUp = (message: string): void => {
    opened?.reject(new Error(message));
    for (const { reject } of waiting.values()) reject(new Error(message));
    waiting.clear();
  };

  worker.onmessage = (event): void => {
    const msg = event.data;
    if (msg.kind === 'ready') { opened?.resolve(); return; }
    if (msg.kind === 'text') { waiting.get(msg.id)?.resolve(msg.text); waiting.delete(msg.id); return; }
    if (msg.id === undefined) { opened?.reject(new Error(msg.message)); return; }
    waiting.get(msg.id)?.reject(new Error(msg.message));
    waiting.delete(msg.id);
  };
  // a worker that dies — a file that did not load, a wasm that ran out of memory — must not leave the child waiting in silence
  if ('onerror' in worker) worker.onerror = (): void => { giveUp('reading worker: the thread stopped before answering'); };

  worker.postMessage({ kind: 'load', base: d.base, language: d.language });

  return {
    async transcribe(samples: Float32Array): Promise<string> {
      if (closed) throw new Error('reading worker: asked to transcribe after the thread was let go');
      await openedPromise;
      const id = nextId++;
      const answer = new Promise<string>((resolve, reject) => { waiting.set(id, { resolve, reject }); });
      /*
       * 📌 THE SAMPLES ARE TRANSFERRED AND NOT COPIED: 30 s at 16 kHz is 1.9 MB, and copying it is a pause on the very thread
       * this module exists to keep free. ⚠️ The buffer is empty on this side afterwards, which is correct — the recording
       * belongs to the transcription now, and `platform/microphone` hands over a fresh one for the next reading.
       */
      worker.postMessage({ kind: 'transcribe', id, samples }, [samples.buffer]);
      return await answer;
    },
    close(): void {
      if (closed) return;
      closed = true;
      giveUp('reading worker: the thread was let go while this reading was still running');
      worker.terminate();
    },
  };
}
