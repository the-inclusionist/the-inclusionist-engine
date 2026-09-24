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
    synthesize: (texto) => {
      log.push('sintetizar:' + texto);
      const ms = demora[texto] || 0;
      return new Promise((r) => setTimeout(() => r({ texto, id: ++n }), ms));
    },
    play: (audio, aoTerminar) => {
      log.push('tocar:' + audio.texto);
      return { texto: audio.texto, aoTerminar };
    },
    stop: (fonte) => { log.push('parar:' + fonte.texto); },
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
      synthesize: (texto) => { log.push('sintetizar:' + texto); return falhar ? Promise.reject(new Error('sem voz')) : Promise.resolve({ texto }); },
      play: (audio) => { log.push('tocar:' + audio.texto); return { texto: audio.texto }; },
      stop: (f) => { log.push('parar:' + f.texto); },
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

// ========================= MUTATIONS CHECKED =========================
//   · removing the `pararTudo()` at the start of `falar` → "[Right] pedido novo CALA o anterior" fails with
//     "expected 'sintetizar:Sair' to be 'parar:Continuar'".
//   · removing the first `if (minha !== geracao) return` → "[Boundary] fora de ordem" fails with
//     ['tocar:rápido', 'tocar:lento'].
//   · replacing `falar` with a queue (`if (tocando) proximo = texto`) → "[Many] varrer cinco" fails, which is exactly
//     the old behaviour coming back.
