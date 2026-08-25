// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio-earcons — earcons (ícones sonoros) do jogo + a ponte com as LEGENDAS visuais (a11y surdez).
// Tier 2 do áudio, rodada 2. Depende das primitivas de platform/audio (SFX/ensureAC/catNode/audioOut/noiseHit) e,
// por injeção, do estado de legenda que VIVE no game.js (captionsOn é alternado pela UI; showCaption toca o #caption
// e é reusado por win()). Injeção por closure (padrão Tier 1).
//   sfx(name)      — toca o earcon da tabela SFX (oscilador) E, se as legendas estão ON e o earcon tem `.cap`, mostra a
//                    legenda ANTES de checar o som → um jogador surdo "vê" o som mesmo com o áudio desligado.
//   doorSound(mat) — porta: rangido (madeira, sawtooth) ou clangor (ferro, square) + baque de ruído (noiseHit).
// Extraído do game.js. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Tier 2, áudio rodada 2).

interface SfxDef { t: OscillatorType; f: number; d: number; cap?: string; }
import { t } from '../core/i18n.js'; // item 19: `cap` guarda CHAVE, e quem exibe resolve

export interface AudioEarconsCtx {
  SFX: Record<string, SfxDef | undefined>;      // tabela de earcons (de platform/audio)
  ensureAC: () => AudioContext | null;
  catNode: (cat: string) => AudioNode | null;   // barramento por categoria (earcons/interact)
  audioOut: () => AudioNode | null;             // nó mestre (fallback)
  noiseHit: (mat: string) => void;              // synth de ruído por material (baque da porta)
  getSoundOn: () => boolean;                     // bindings vivos (o mixer os reatribui)
  getVolume: () => number;
  getCaptionsOn: () => boolean;                  // legenda ligada? (a UI alterna no game.js)
  showCaption: (txt: string) => void;            // desenha a legenda no #caption (DOM, vive no game.js)
}

export interface AudioEarcons {
  sfx: (name: string) => void;
  doorSound: (mat: string) => void;
}

export function createAudioEarcons(ctx: AudioEarconsCtx): AudioEarcons {
  function sfx(name: string): void {
    const c = ctx.SFX[name]; if (!c) return;
    // LEGENDA primeiro (visual + aria-live via role=status) — e RESOLVIDA no ponto de uso: `cap` guarda a
    // CHAVE desde o item 19, porque a tabela vive no jogo e uma tabela de `const` com texto congelaria no
    // idioma do boot. Quem exibe resolve; é a mesma regra de `render/viz-modes`.
    if (ctx.getCaptionsOn() && c.cap) ctx.showCaption(t(c.cap));
    if (!ctx.getSoundOn() || ctx.getVolume() <= 0) return;    // ...só então o som — surdez: a legenda já saiu
    try {
      const ac = ctx.ensureAC(); if (!ac) return;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = c.t; o.frequency.value = c.f; g.gain.value = 0.0001;
      o.connect(g).connect(ctx.catNode('earcons') || ctx.audioOut() || ac.destination);
      const t = ac.currentTime, vol = ctx.getVolume();
      g.gain.exponentialRampToValueAtTime(Math.max(0.02, 0.25 * vol), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + c.d);
      o.start(t); o.stop(t + c.d + 0.02);
    } catch (e) { /* Web Audio indisponível */ }
  }

  function doorSound(mat: string): void {
    if (!ctx.getSoundOn() || ctx.getVolume() <= 0) return;
    const ac = ctx.ensureAC(); if (!ac) return;
    try { // porta: rangido (madeira) ou clangor (ferro) + baque
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime, vol = ctx.getVolume();
      o.type = mat === 'ferro' ? 'square' : 'sawtooth';
      o.frequency.setValueAtTime(mat === 'ferro' ? 520 : 200, t);
      o.frequency.exponentialRampToValueAtTime(mat === 'ferro' ? 300 : 110, t + 0.3);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14 * vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(ctx.catNode('interact') || ctx.audioOut() || ac.destination);
      o.start(t); o.stop(t + 0.4); ctx.noiseHit(mat === 'ferro' ? 'ferro' : 'madeira');
    } catch (e) { /* Web Audio indisponível */ }
  }

  return { sfx, doorSound };
}
