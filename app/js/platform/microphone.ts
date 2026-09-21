// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/microphone — THE CHILD'S VOICE, AND NOTHING ELSE (ADR-0216 §2, ADR-0200 erratum; issues #185, #200).
//
// The reading model eats 16 kHz mono samples. This is where they come from, and it is the only place in the engine that opens a
// microphone for reading: what it captures stays in this page, is handed to the model on this machine, and is dropped when the
// reading ends (ADR-0200's erratum: on the device or not at all).
//
// · IT ENDS WHEN THE CHILD DOES. A reading closes after `silenceMs` of quiet FOLLOWING something that was said, or at the `maxMs`
//   ceiling, whichever comes first. A child who stops mid-sentence is not an error: what was heard so far is the answer.
// · «QUIET» IS MEASURED, NOT ASSUMED. The first moments are taken as the room she is in, and sound is what stands above it —
//   a fixed threshold would end a whispering child's reading in a noisy classroom, and never end in a quiet one.
// · ⚠️ IT USES `ScriptProcessorNode`, which is deprecated. The replacement, an AudioWorklet, needs its code fetched as a module,
//   and the engine's CSP has no `blob:` in `script-src` since ADR-0214 — so the modern way would need a new file in every
//   delivery and a decision about serving it. This one works everywhere the project targets today, and it is written here so the
//   next person does not «fix» it without that decision.

/** The part of the Web Audio API this uses — narrow on purpose, so a case can answer it without a browser. */
export interface AudioNodeLike { connect(to: unknown): void; disconnect(): void }
export interface ProcessorNode extends AudioNodeLike {
  onaudioprocess: ((e: { inputBuffer: { getChannelData(ch: number): Float32Array } }) => void) | null;
}
export interface AudioContextLike {
  readonly sampleRate: number;
  readonly destination: unknown;
  createMediaStreamSource(stream: unknown): AudioNodeLike;
  createScriptProcessor(bufferSize: number, inputs: number, outputs: number): ProcessorNode;
  close(): Promise<void> | void;
}
/** A stream, in the one thing that matters after the reading: letting go of it. */
export interface StreamLike { getTracks(): readonly { stop(): void }[] }

export interface MicrophoneDeps {
  /** `navigator.mediaDevices.getUserMedia`. Absent is a device with no microphone, which is REFUSED and said, not hidden. */
  readonly getUserMedia?: (constraints: { audio: boolean }) => Promise<StreamLike>;
  readonly createContext?: (rate: number) => AudioContextLike;
  readonly now?: () => number;
}

export interface RecordOptions {
  /** How long a silence ends the reading. Default 1.5 s: shorter cuts a child who is thinking between words. */
  readonly silenceMs?: number;
  /** The ceiling, so a forgotten microphone does not listen for ever. Default 30 s, the window Whisper reads at once. */
  readonly maxMs?: number;
}

export interface Microphone {
  /** Listens, and answers with what was said, at 16 kHz mono. */
  record(options?: RecordOptions): Promise<Float32Array>;
  /** Gives the microphone back now; the recording in hand answers with what it has. */
  stop(): void;
}

export const READING_RATE = 16_000;
const SILENCE_MS = 1500;
const MAX_MS = 30_000;
const BUFFER = 4096;
/** How much of the start is taken as «the room»: long enough to be a room, short enough not to swallow a first word. */
const ROOM_MS = 300;
/** How far above the room a sound must be to be a voice, and the floor under it for a digitally silent input. */
const OVER_ROOM = 4;
const QUIETEST = 0.005;

const rms = (block: Float32Array): number => {
  let sum = 0;
  for (const v of block) sum += v * v;
  return Math.sqrt(sum / (block.length || 1));
};

/** 16 kHz from whatever the device gave us. Linear, because what follows is a mel filterbank, not a listener. */
function atReadingRate(samples: Float32Array, from: number): Float32Array {
  if (from === READING_RATE) return samples;
  const out = new Float32Array(Math.round((samples.length * READING_RATE) / from));
  const step = from / READING_RATE;
  for (let i = 0; i < out.length; i++) {
    const at = i * step;
    const left = Math.floor(at);
    const right = Math.min(left + 1, samples.length - 1);
    out[i] = samples[left]! + (samples[right]! - samples[left]!) * (at - left);
  }
  return out;
}

export function createMicrophone(d: MicrophoneDeps = {}): Microphone {
  const now = d.now ?? (() => performance.now());
  let askToStop: (() => void) | null = null;

  return {
    stop() { askToStop?.(); },
    async record(options: RecordOptions = {}): Promise<Float32Array> {
      const getUserMedia = d.getUserMedia
        ?? (navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) as MicrophoneDeps['getUserMedia']);
      if (!getUserMedia) throw new Error('microphone: this device offers none, so a reading cannot be heard here');
      const makeContext = d.createContext ?? ((rate: number) => new AudioContext({ sampleRate: rate }) as unknown as AudioContextLike);

      const silenceMs = options.silenceMs ?? SILENCE_MS;
      const maxMs = options.maxMs ?? MAX_MS;
      const stream = await getUserMedia({ audio: true });
      const context = makeContext(READING_RATE);
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(BUFFER, 1, 1);

      const blocks: Float32Array[] = [];
      const startedAt = now();
      let room = 0, roomBlocks = 0, spoke = false, lastSound = startedAt, done = false;

      return await new Promise<Float32Array>((resolve) => {
        const finish = (): void => {
          if (done) return;
          done = true;
          askToStop = null;
          processor.onaudioprocess = null;
          processor.disconnect();
          source.disconnect();
          // ⚠️ THE LIGHT GOES OUT. A track left running keeps the microphone open and the browser saying so, which to a child
          // and to whoever is with her means the game is still listening.
          for (const track of stream.getTracks()) track.stop();
          void context.close();
          let total = 0;
          for (const b of blocks) total += b.length;
          const whole = new Float32Array(total);
          let at = 0;
          for (const b of blocks) { whole.set(b, at); at += b.length; }
          resolve(atReadingRate(whole, context.sampleRate));
        };
        askToStop = finish;

        processor.onaudioprocess = (e) => {
          if (done) return;
          const block = Float32Array.from(e.inputBuffer.getChannelData(0));
          blocks.push(block);
          const level = rms(block);
          const elapsed = now() - startedAt;
          if (elapsed < ROOM_MS) { room = (room * roomBlocks + level) / (roomBlocks + 1); roomBlocks++; return; }
          if (level > Math.max(room * OVER_ROOM, QUIETEST)) { spoke = true; lastSound = now(); }
          else if (spoke && now() - lastSound >= silenceMs) { finish(); return; }
          if (elapsed >= maxMs) finish();
        };
        source.connect(processor);
        processor.connect(context.destination);
      });
    },
  };
}
