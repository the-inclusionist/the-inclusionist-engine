// SPDX-License-Identifier: AGPL-3.0-or-later
// INTERRUPTIBLE NARRATION — item 2 of ADR-0044, and the race it hides.
//
// A QUEUE OF ONE (`if (busy) next = text; else speakNow(text)`) is what this replaces: scanning five menu items, the
// child heard the first in full and then the last — the three in between vanished, because each request overwrote
// `next`. Slow AND gappy, and both hurt in the same place: whoever cannot see navigates by ear, and the ear fell
// several items behind the focus.
//
// This file proves both guarantees with fakes, in milliseconds — the real neural block lives inside an `import()` that
// only resolves with the heavy runtime present.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createInterruptibleSpeech } from '../app/js/platform/interruptible-speech.js';

/**
 * A fake engine with CONTROLLABLE synthesis time — what lets the race be staged: a slow request followed by a fast
 * one, finishing out of order.
 */
function motorFalso() {
  const log = [];
  /** text → ms the "synthesis" takes. Anything not here is instant. */
  const demora = {};
  let n = 0;
  const motor = {
    synthesize: (text) => {
      log.push('sintetizar:' + text);
      const ms = demora[text] || 0;
      return new Promise((r) => setTimeout(() => r({ text, id: ++n }), ms));
    },
    play: (audio, aoTerminar) => {
      log.push('tocar:' + audio.text);
      return { text: audio.text, aoTerminar };
    },
    stop: (fonte) => { log.push('parar:' + fonte.text); },
  };
  return { motor, log, demora };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

describe('fala interrompível — o último pedido é o que vale', () => {
  it('[Right] fala o texto pedido', async () => {
    const { motor, log } = motorFalso();
    const fala = createInterruptibleSpeech(motor);
    fala.speak('Continuar');
    await esperar(10);
    expect(log).toEqual(['sintetizar:Continuar', 'tocar:Continuar']);
    expect(fala.speaking()).toBe(true);
  });

  it('[Right] pedido novo CALA o anterior antes mesmo de sintetizar', async () => {
    // Guarantee 1, the one that gives immediate silence. Stopping only when the new audio is ready would leave the old
    // voice speaking during synthesis — the wrong item, with conviction.
    const { motor, log } = motorFalso();
    const fala = createInterruptibleSpeech(motor);
    fala.speak('Continuar');
    await esperar(10);
    log.length = 0;
    fala.speak('Sair');
    // BEFORE any wait, the `parar` must already have happened.
    expect(log[0], 'o anterior precisa calar na hora, não ao fim da síntese').toBe('parar:Continuar');
    await esperar(10);
    expect(log).toEqual(['parar:Continuar', 'sintetizar:Sair', 'tocar:Sair']);
  });

  it('[Many] varrer CINCO itens depressa toca só o último — e nenhum do meio', async () => {
    // The case that describes the queue-of-one defect inside out. With a queue of one, this played the first AND the
    // last. It plays ONE: the one where the finger stopped.
    const { motor, log, demora } = motorFalso();
    for (const t of ['um', 'dois', 'três', 'quatro', 'cinco']) demora[t] = 20;
    const fala = createInterruptibleSpeech(motor);
    for (const t of ['um', 'dois', 'três', 'quatro', 'cinco']) fala.speak(t);
    await esperar(80);
    expect(log.filter((l) => l.startsWith('tocar:')), 'só o último deve tocar').toEqual(['tocar:cinco']);
  });

  it('[Boundary] síntese que termina FORA DE ORDEM não atropela a mais nova', async () => {
    // The race the generation counter exists to prevent, and it is real: the neural synthesis of a short text can finish
    // before that of a long text requested earlier. Without the generation, the child would hear the item they already
    // passed, over the current one.
    const { motor, log, demora } = motorFalso();
    demora['lento'] = 50; demora['rápido'] = 5;
    const fala = createInterruptibleSpeech(motor);
    fala.speak('lento');
    await esperar(1);
    fala.speak('rápido');   // requested later, but finishes first
    await esperar(100);     // time to spare for 'lento' to come back from synthesis
    expect(log.filter((l) => l.startsWith('tocar:')), 'o lento não pode tocar depois').toEqual(['tocar:rápido']);
  });

  it('[Inverse] `calar` silencia e invalida o que está sintetizando', async () => {
    const { motor, log, demora } = motorFalso();
    demora['longo'] = 30;
    const fala = createInterruptibleSpeech(motor);
    fala.speak('longo');
    await esperar(1);
    fala.silence();
    await esperar(60);
    expect(log.filter((l) => l.startsWith('tocar:')), 'nada deve tocar depois de calar').toEqual([]);
    expect(fala.speaking()).toBe(false);
  });

  it('[Zero] texto vazio não sintetiza — mas ainda CALA o anterior', async () => {
    // A menu announcing an empty string happens (a label not yet translated, an item with no name). Synthesising
    // silence is not worth it, but stopping is: the focus moved.
    const { motor, log } = motorFalso();
    const fala = createInterruptibleSpeech(motor);
    fala.speak('Continuar');
    await esperar(10);
    log.length = 0;
    fala.speak('');
    await esperar(10);
    expect(log).toEqual(['parar:Continuar']);
  });

  it('[Error] síntese que estoura não derruba a narração seguinte', async () => {
    // ONE item's silence is better than a dead engine. Without the `try`, a rejected promise would leave the generation
    // stuck and the whole menu mute from then on.
    const log = [];
    let falhar = true;
    const motor = {
      synthesize: (text) => { log.push('sintetizar:' + text); return falhar ? Promise.reject(new Error('sem voz')) : Promise.resolve({ text }); },
      play: (audio) => { log.push('tocar:' + audio.text); return { text: audio.text }; },
      stop: (f) => { log.push('parar:' + f.text); },
    };
    const fala = createInterruptibleSpeech(motor);
    fala.speak('quebra');
    await esperar(10);
    falhar = false;
    fala.speak('funciona');
    await esperar(10);
    expect(log).toContain('tocar:funciona');
  });
});

// A caller speaking PARTS IN ORDER (ADR-0243 §1) waits for each utterance to be over before the next: `finished` tells it, once,
// however the utterance ends — and an utterance that never ends in the ordinary way must still say so, or the parts after it wait
// forever.
describe('interruptible speech — `finished` says an utterance is over, once, however it ends', () => {
  const counter = () => { const c = { n: 0 }; return [c, () => { c.n++; }]; };

  it('🔴 [Right] when the audio ends — and not before', async () => {
    const { motor } = motorFalso();
    const fala = createInterruptibleSpeech(motor);
    let fonte = null;
    motor.play = (audio, onEnded) => { fonte = { texto: audio.texto, onEnded }; return fonte; };
    const [c, done] = counter();
    fala.speak('apple', done);
    await esperar(10);
    expect(c.n, 'said over while still playing').toBe(0);
    fonte.onEnded();
    expect(c.n).toBe(1);
  });

  it('🔴 [Right] when a newer request silences it, or `silence()` does', async () => {
    const { motor } = motorFalso();
    const fala = createInterruptibleSpeech(motor);
    const [a, doneA] = counter(), [b, doneB] = counter();
    fala.speak('first', doneA);
    await esperar(10);
    fala.speak('second', doneB);
    expect(a.n, 'the silenced utterance never said it was over').toBe(1);
    await esperar(10);
    fala.silence();
    expect(b.n).toBe(1);
  });

  it('🔴 [Right] when it was overtaken during synthesis, failed, or had nothing to say', async () => {
    const { motor, demora } = motorFalso();
    demora['slow'] = 30;
    const fala = createInterruptibleSpeech(motor);
    const [slow, doneSlow] = counter(), [empty, doneEmpty] = counter();
    fala.speak('slow', doneSlow);
    await esperar(1);
    fala.speak('', doneEmpty);
    await esperar(60);
    expect(slow.n, 'overtaken during synthesis').toBe(1);
    expect(empty.n, 'nothing to say').toBe(1);
    const failing = createInterruptibleSpeech({ ...motor, synthesize: () => Promise.reject(new Error('no voice')) });
    const [failed, doneFailed] = counter();
    failing.speak('x', doneFailed);
    await esperar(5);
    expect(failed.n, 'a failed synthesis').toBe(1);
  });

  it('🎯 [Cardinality] ONCE: a source that still reports its end after it was silenced is not said over twice', async () => {
    // Some engines fire `ended` on a source they were told to stop; the parts after it would then be started twice.
    const { motor } = motorFalso();
    const fala = createInterruptibleSpeech(motor);
    let fonte = null;
    motor.play = (audio, onEnded) => { fonte = { texto: audio.texto, onEnded }; return fonte; };
    const [c, done] = counter();
    fala.speak('apple', done);
    await esperar(10);
    fala.silence();
    fonte.onEnded();
    fala.speak('pear');
    expect(c.n).toBe(1);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · removing the `pararTudo()` at the start of `falar` → "[Right] pedido novo CALA o anterior" fails with
//     "expected 'sintetizar:Sair' to be 'parar:Continuar'".
//   · removing the first `if (minha !== geracao) return` → "[Boundary] fora de ordem" fails with
//     ['tocar:rápido', 'tocar:lento'].
//   · replacing `falar` with a queue (`if (tocando) proximo = texto`) → "[Many] varrer cinco" fails, which is exactly
//     the old behaviour coming back.
//   · (ADR-0243, 2026-09-26) `stopPlayback` not calling `finished` → «when a newer request silences it» red; `finished` not
//     guarded to once → «ONCE» red. Each applied by a counting script, restored from a copy and checked by SHA-256.
