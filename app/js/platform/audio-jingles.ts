// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio-jingles — recompensas sonoras (jingles) SEM estado de jogo: vitória, enigma resolvido e fogos.
// Primeiro passo do Tier 2 (áudio): o cluster mais puro — só depende das primitivas de platform/audio (tone/ensureAC/
// catNode/audioOut) + soundOn/volume vivos. Sem tiles, players, coins nem DOM. Injeção por closure (padrão Tier 1).
//   playVictory      — jingle 8-bit ascendente (C5 E5 G5 C6 B5 E6) + 4 fogos de artifício.
//   playPuzzleSolved — frase DOCE senoidal ascendente (E5 G5 B5 E6 + C6 de fundo), Zelda OoT; NUNCA agressiva (José).
//   firework         — assobio subindo (sine 300→1200 Hz) + estouro/crepitar (5 osciladores square); usado por playVictory.
// Extraído do game.js (linhas 625-633). Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Tier 2, áudio rodada 1).

type ToneFn = (freq: number, dur: number, type?: OscillatorType, when?: number, vol?: number) => void;

export interface AudioJinglesCtx {
  tone: ToneFn;                          // synth de oscilador de platform/audio (já filtra soundOn/volume)
  ensureAC: () => AudioContext | null;   // ciclo do AudioContext
  catNode: (cat: string) => AudioNode | null; // barramento por categoria do mixer
  audioOut: () => AudioNode | null;      // nó mestre (fallback do catNode)
  getSoundOn: () => boolean;             // binding vivo (o mixer reatribui)
  getVolume: () => number;               // binding vivo
}

export interface AudioJingles {
  playVictory: () => void;
  playPuzzleSolved: () => void;
  firework: (when?: number) => void;
}

export function createAudioJingles(ctx: AudioJinglesCtx): AudioJingles {
  // Fogos: só osciladores crus (não usam `tone`), então guardam soundOn/volume aqui e escalam o ganho pelo volume.
  function firework(when?: number): void {
    if (!ctx.getSoundOn() || ctx.getVolume() <= 0) return;
    try {
      const ac = ctx.ensureAC(); if (!ac) return;
      const vol = ctx.getVolume(), t = ac.currentTime + (when || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(1200, t + 0.35); // assobio subindo
      const out = ctx.catNode('earcons') || ctx.audioOut() || ac.destination;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 * vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.4);
      [0, 0.04, 0.09, 0.15, 0.22].forEach((dt, i) => { // estouro/crepitar
        const po = ac.createOscillator(), pg = ac.createGain(), tt = t + 0.36 + dt;
        po.type = 'square'; po.frequency.setValueAtTime(180 + ((i * 131) % 520), tt);
        pg.gain.setValueAtTime(0.18 * vol, tt); pg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09);
        po.connect(pg).connect(out); po.start(tt); po.stop(tt + 0.11);
      });
    } catch (e) { /* Web Audio indisponível */ }
  }

  function playVictory(): void {
    ([[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [988, 0.52], [1319, 0.64]] as [number, number][])
      .forEach(([f, w]) => ctx.tone(f, 0.16, 'square', w, 0.22));
    [0.2, 0.8, 1.35, 1.9].forEach((w) => firework(w));
  }

  function playPuzzleSolved(): void { // E5 G5 B5 E6 + C6 de fundo
    ([[659, 0], [784, 0.13], [988, 0.26], [1319, 0.42]] as [number, number][])
      .forEach(([f, w]) => ctx.tone(f, 0.32, 'sine', w, 0.12));
    ctx.tone(1047, 0.6, 'sine', 0.42, 0.07);
  }

  return { playVictory, playPuzzleSolved, firework };
}
