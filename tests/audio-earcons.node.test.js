// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of platform/audio-earcons (NODE project: fake Web Audio/SFX/showCaption/noiseHit injected by closure).
// The key a11y contract: the CAPTION goes out BEFORE the sound check → a deaf child sees the earcon even with audio OFF.
// sfx plays 1 oscillator; doorSound picks a timbre by material + fires noiseHit. See docs/5-Refactoring/plan-modularization-map.md.
import { describe, it, expect } from 'vitest';
import { createAudioEarcons } from '../app/js/platform/audio-earcons.js';
import { t } from '../app/js/core/i18n.js';

function fakeAC() {
  const rec = { osc: 0, types: [] };
  const chain = { connect: () => chain };
  const mkOsc = () => { rec.osc++; const o = {
    type: '', frequency: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    connect: () => chain, start: () => {}, stop: () => {} };
    Object.defineProperty(o, 'type', { set: (v) => rec.types.push(v), get: () => rec.types[rec.types.length - 1] });
    return o; };
  const mkGain = () => ({ gain: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => chain });
  return { rec, ac: { currentTime: 0, destination: {}, createOscillator: mkOsc, createGain: mkGain } };
}

// The table is the GAME's (item 19) and `cap` holds the KEY, not the text. The fixture uses a key that does NOT exist in
// the dictionary on purpose: `t()` returns the key itself when it finds nothing, so the case can still assert what
// matters — that the caption goes out — without depending on any language's text.
const SFX = { alvo: { t: 'square', f: 880, d: 0.1, cap: 'sfx.teste' }, plain: { t: 'sine', f: 440, d: 0.1 } };

function setup(over = {}) {
  const caps = [], hits = [];
  const { rec, ac } = fakeAC();
  const ctx = {
    SFX,
    ensureAC: () => ac,
    catNode: () => null,
    audioOut: () => ({ connect: () => ({}) }),
    noiseHit: (mat) => hits.push(mat),
    getSoundOn: () => true,
    getVolume: () => 0.6,
    getCaptionsOn: () => true,
    showCaption: (t) => caps.push(t),
    ...over,
  };
  return { earcons: createAudioEarcons(ctx), rec, caps, hits };
}

describe('platform/audio-earcons', () => {
  it('[Zero] sfx com nome inexistente: no-op (sem legenda, sem som)', () => {
    const { earcons, rec, caps } = setup();
    earcons.sfx('nope');
    expect(caps).toEqual([]);
    expect(rec.osc).toBe(0);
  });

  it('[Cross-check a11y] som OFF mas legendas ON: legenda SAI, mas 0 osciladores', () => {
    const { earcons, rec, caps } = setup({ getSoundOn: () => false });
    earcons.sfx('alvo');
    expect(caps).toEqual(['sfx.teste']); // a deaf child sees the earcon even with no audio
    expect(rec.osc).toBe(0);
  });

  it('[Interface] legendas OFF: nenhuma legenda mesmo com .cap (mas o som toca)', () => {
    const { earcons, rec, caps } = setup({ getCaptionsOn: () => false });
    earcons.sfx('alvo');
    expect(caps).toEqual([]);
    expect(rec.osc).toBe(1);
  });

  it('[One] sfx com som ON: 1 oscilador; earcon sem .cap não legenda', () => {
    const { earcons, rec, caps } = setup();
    earcons.sfx('plain');
    expect(rec.osc).toBe(1);
    expect(caps).toEqual([]); // 'plain' has no cap
  });

  it('[Boundary] doorSound(ferro)=square + noiseHit(ferro); doorSound(madeira)=sawtooth + noiseHit(madeira)', () => {
    const a = setup(); a.earcons.doorSound('ferro');
    expect(a.rec.types).toContain('square');
    expect(a.hits).toEqual(['ferro']);
    const b = setup(); b.earcons.doorSound('madeira');
    expect(b.rec.types).toContain('sawtooth');
    expect(b.hits).toEqual(['madeira']);
  });

  it('[Zero] doorSound com volume 0: 0 osciladores e nenhum noiseHit', () => {
    const { earcons, rec, hits } = setup({ getVolume: () => 0 });
    earcons.doorSound('ferro');
    expect(rec.osc).toBe(0);
    expect(hits).toEqual([]);
  });
});

// ==========================================================================================================
// ⚠️ AN EARCON MUST BE ABLE TO GO SOMEWHERE (#124)
//
// Measured while building `game-soccer`: scoring and conceding a goal must be distinguishable **by ear alone** — a blind
// child hears the room react and needs to know which way BEFORE the narration arrives. The obvious design is a figure
// that RISES for her goal and FALLS for the other's, and the table could not say it: `SfxDef` had one frequency, and the
// oscillator stood still on it.
//
// ⚠️ AND THE CAPABILITY WAS ALREADY IN THE SAME FILE, unreachable from the table: `doorSound` does exactly this with
// `frequency.exponentialRampToValueAtTime`. The fix is not new synthesis — it is opening the door.
//
// These cases need a finer fake AudioContext than the one above: that one records NOTHING done to `frequency`, so a ramp
// would pass through it without a trace. This one notes the calls.
//
// MUTATIONS CHECKED (at the end of the block).
// ==========================================================================================================
describe('platform/audio-earcons — a figura do earcon (#124)', () => {
  function acQueAnota() {
    const freq = { fixados: [], rampas: [] };
    const chain = { connect: () => chain };
    const mkOsc = () => ({
      type: '',
      frequency: {
        value: 0,
        setValueAtTime: (v, quando) => freq.fixados.push([v, quando]),
        exponentialRampToValueAtTime: (v, quando) => freq.rampas.push([v, quando]),
      },
      connect: () => chain, start: () => {}, stop: () => {},
    });
    const mkGain = () => ({ gain: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => chain });
    return { freq, ac: { currentTime: 0, destination: {}, createOscillator: mkOsc, createGain: mkGain } };
  }

  function toca(def) {
    const { freq, ac } = acQueAnota();
    const earcons = createAudioEarcons({
      SFX: { alvo: def },
      ensureAC: () => ac, catNode: () => null, audioOut: () => ({ connect: () => ({}) }),
      noiseHit: () => {}, getSoundOn: () => true, getVolume: () => 0.6,
      getCaptionsOn: () => false, showCaption: () => {},
    });
    earcons.sfx('alvo');
    return freq;
  }

  it('⚠️ [Right] com `f2` o earcon SOBE — parte de `f` e chega a `f2` no fim da duracao', () => {
    const freq = toca({ t: 'triangle', f: 300, d: 0.4, f2: 900 });
    expect(freq.fixados, 'nao fixou o ponto de partida; a curva comeca onde calhar').toEqual([[300, 0]]);
    expect(freq.rampas, 'nao rampou ate f2 no fim da duracao').toEqual([[900, 0.4]]);
  });

  it('[Right] e DESCE, que e a outra metade do par — a mesma tabela diz as duas', () => {
    const freq = toca({ t: 'triangle', f: 900, d: 0.4, f2: 300 });
    expect(freq.fixados).toEqual([[900, 0]]);
    expect(freq.rampas).toEqual([[300, 0.4]]);
  });

  it('[Zero] sem `f2` nada se mexe — a nota parada continua a ser o que sempre foi', () => {
    const freq = toca({ t: 'square', f: 520, d: 0.12 });
    expect(freq.fixados).toEqual([]);
    expect(freq.rampas).toEqual([]);
  });

  it('⚠️ [Boundary] `f2: 0` NAO rampa — a rampa exponencial lanca com alvo zero', () => {
    // Without this guard, a table with zero would kill the WHOLE earcon through `sfx()`'s `catch`, silently: no sound and
    // no error. It is the worst way this file can fail.
    const freq = toca({ t: 'sine', f: 440, d: 0.2, f2: 0 });
    expect(freq.rampas, 'pediu rampa para zero').toEqual([]);
  });

  it('[Boundary] `f2` igual a `f` nao rampa — nao ha figura nenhuma a desenhar', () => {
    const freq = toca({ t: 'sine', f: 440, d: 0.2, f2: 440 });
    expect(freq.rampas).toEqual([]);
  });

  it('⚠️ [Interface] o earcon com figura continua a legendar ANTES de olhar para o som', () => {
    // The order the audit asked to record as what the engine got RIGHT. A new `f2` must not have touched it: whoever
    // reads captions gets the information with the speakers mute.
    const caps = [];
    const { ac } = acQueAnota();
    const earcons = createAudioEarcons({
      SFX: { alvo: { t: 'triangle', f: 300, d: 0.4, f2: 900, cap: 'sfx.teste' } },
      ensureAC: () => ac, catNode: () => null, audioOut: () => ({ connect: () => ({}) }),
      noiseHit: () => {}, getSoundOn: () => false, getVolume: () => 0,
      getCaptionsOn: () => true, showCaption: (x) => caps.push(x),
    });
    earcons.sfx('alvo');
    expect(caps, 'com o som desligado a legenda deixou de sair').toEqual(['sfx.teste']);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · removing the `if (typeof c.f2 === 'number' && ...)` block → the [Right] rises and falls cases fail with both
//     lists empty. It is #124 reproduced: the table asks for a figure and the oscillator stands still.
//   · replacing `c.f2 > 0` with `c.f2 >= 0` → the [Boundary] `f2: 0` case fails, and in a real browser it would be the
//     whole earcon dying silently through the `catch`.
//   · removing the `setValueAtTime` and leaving only the ramp → both rise/fall cases fail. The curve's starting point
//     cannot be left to the implementation.
//     ⚠️ And this mutation ABORTED the first time, with a count of ZERO: the file was CRLF and the script's `\n` did not
//     match. Without the occurrence count it would have "survived" without ever being applied, and an unchecked line
//     would have been recorded as checked. That is the only reason the count exists.
//   · replacing `t + c.d` with `t + 0.3` (`doorSound`'s hard-coded number) → both rise/fall cases fail at once. The
//     figure must fit the duration the table declares, not a borrowed constant.

// ==========================================================================================================
// WHERE AN EARCON GOES, HOW LOUD, FOR HOW LONG — and what the door does (probed 2026-09-23)
//
// A probe of `sfx` and `doorSound` found eleven decisions no case above could see, because the fake above records
// oscillators and types and nothing else: the bus a sound is routed to, its peak and its floor, when it stops,
// a caption resolved into the child's language, a Web Audio that throws, and the door's pitch, bus and «sound
// off». This context writes all of it down.
// ==========================================================================================================
describe('platform/audio-earcons — the bus, the level, the length, and the door', () => {
  function acQueGrava() {
    const rec = { destinos: [], ganhos: [], paradas: [], fixados: [], osc: 0 };
    const no = (nome) => ({ _nome: nome, connect: (n) => { rec.destinos.push(n._nome); return n; } });
    const ac = {
      currentTime: 0,
      destination: no('destination'),
      createOscillator: () => {
        rec.osc++;
        return { ...no('osc'), type: '', start: () => {}, stop: (quando) => rec.paradas.push(quando),
          frequency: { value: 0, setValueAtTime: (v) => rec.fixados.push(v), exponentialRampToValueAtTime: () => {} } };
      },
      createGain: () => ({ ...no('ganho'), gain: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: (v) => rec.ganhos.push(v) } }),
    };
    return { rec, ac, no };
  }

  function montar(over = {}) {
    const { rec, ac, no } = acQueGrava();
    const caps = [], hits = [], pedidos = [];
    const earcons = createAudioEarcons({
      SFX: { alvo: { t: 'square', f: 880, d: 0.1, cap: 'gaze.lookHere' } },
      ensureAC: () => ac,
      catNode: (cat) => { pedidos.push(cat); return over.barramento ? no(`${cat}-bus`) : null; },
      audioOut: () => (over.semMestre ? null : no('mestre')),
      noiseHit: (m) => hits.push(m), getSoundOn: () => over.somLigado ?? true, getVolume: () => over.volume ?? 0.6,
      getCaptionsOn: () => true, showCaption: (x) => caps.push(x),
      ...over.ctx,
    });
    return { earcons, rec, caps, hits, pedidos };
  }

  it('🔴 [Right] the caption is shown in the child\'s language — the table keeps a KEY and whoever shows it resolves it', () => {
    const { earcons, caps } = montar();
    earcons.sfx('alvo');
    expect(caps[0], 'the key itself reached the caption').not.toBe('gaze.lookHere');
    expect(caps[0]).toBe(t('gaze.lookHere'));
  });

  it('🔴 [Zero] the sound on at volume ZERO plays nothing — and the caption still comes out', () => {
    const { earcons, rec, caps } = montar({ volume: 0 });
    earcons.sfx('alvo');
    expect(rec.osc).toBe(0);
    expect(caps).toHaveLength(1);
  });

  it('🔴 [Right] an earcon goes to the `earcons` bus; without one to the master; without that to the device', () => {
    const noBarramento = montar({ barramento: true });
    noBarramento.earcons.sfx('alvo');
    expect(noBarramento.pedidos).toEqual(['earcons']);
    expect(noBarramento.rec.destinos.at(-1)).toBe('earcons-bus');
    const noMestre = montar();
    noMestre.earcons.sfx('alvo');
    expect(noMestre.rec.destinos.at(-1)).toBe('mestre');
    const noAparelho = montar({ semMestre: true });
    noAparelho.earcons.sfx('alvo');
    expect(noAparelho.rec.destinos.at(-1)).toBe('destination');
  });

  it('🔴 [Right] the peak follows the master volume, with a floor so a low volume is still heard', () => {
    const alto = montar({ volume: 0.6 });
    alto.earcons.sfx('alvo');
    expect(alto.rec.ganhos[0]).toBeCloseTo(0.15, 6);
    const baixo = montar({ volume: 0.01 });
    baixo.earcons.sfx('alvo');
    expect(baixo.rec.ganhos[0], 'the floor').toBeCloseTo(0.02, 6);
  });

  it('🔴 [Right] it stops when the table says, a moment after the sound has faded', () => {
    const { earcons, rec } = montar();
    earcons.sfx('alvo');
    expect(rec.paradas).toEqual([0.1 + 0.02]);
  });

  it('⚠️ [Error] a Web Audio that throws is silent — the game goes on, and the caption is already out', () => {
    const { earcons, caps } = montar({ ctx: { ensureAC: () => ({ createOscillator: () => { throw new Error('no audio'); } }) } });
    expect(() => earcons.sfx('alvo')).not.toThrow();
    expect(caps).toHaveLength(1);
  });

  it('🔴 [Zero] a door with the game\'s sound OFF makes no sound and no thud', () => {
    const { earcons, rec, hits } = montar({ somLigado: false });
    earcons.doorSound('ferro');
    expect([rec.osc, hits]).toEqual([0, []]);
  });

  it('🔴 [Right] an iron door starts higher than a wooden one, and a door goes to the `interact` bus', () => {
    const ferro = montar({ barramento: true });
    ferro.earcons.doorSound('ferro');
    const madeira = montar();
    madeira.earcons.doorSound('madeira');
    expect([ferro.rec.fixados[0], madeira.rec.fixados[0]]).toEqual([520, 200]);
    expect(ferro.pedidos).toEqual(['interact']);
    expect(ferro.rec.destinos.at(-1)).toBe('interact-bus');
  });
});

// Two survivors are EQUIVALENT and declared rather than caught: dropping the «no context» guard in `sfx` (the null context then
// throws inside the same `catch`, and the answer is the same silence), and dropping the check that `f2` is a NUMBER (a typed
// table's `f2` is a number or absent, and an absent one is not `> 0`).
