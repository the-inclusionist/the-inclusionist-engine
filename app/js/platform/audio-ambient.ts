// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio-ambient — trilha de AMBIENTE sintetizada (loops de ruído filtrado) + trovão. Última rodada do Tier 2 de
// áudio (r4). O clima VISUAL (updateWeather/drawWeather/chuva) fica no game.js e migra p/ render depois — aqui só o SOM.
// Ponte com o clima: `_rainLevel` (0..1) é calculado por updateWeather (game.js) e LIDO aqui por getter → o volume da
// chuva "segue o visual". Injeção por closure (padrão Tier 1).
//   updateAmbient() — por frame: constrói a trilha 1x (lazy) e ajusta o ganho de ÁGUA (proximidade de tiles de água) e
//                     de CHUVA (segue _rainLevel). Gated por audioCat.ambient.on.
//   thunder(inten)  — rumor grave sintetizado (ruído passa-baixas), intensidade variável; chamado por updateWeather.
// Extraído do game.js. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Tier 2, áudio rodada 4).

interface AmbientNodes { hum: GainNode; wind: GainNode; water: GainNode; rain: GainNode; }
interface Vec2 { x: number; y: number; }

export interface AudioAmbientCtx {
  ensureAC: () => AudioContext | null;
  getAudioCtx: () => AudioContext | null;
  catNode: (cat: string) => AudioNode | null;
  audioOut: () => AudioNode | null;
  noiseBuffer: (ac: AudioContext) => AudioBuffer;
  getSoundOn: () => boolean;
  getVolume: () => number;
  getAudioCat: () => Record<string, { on: boolean }> | null;
  getPlayers: () => Vec2[];
  tileAt: (x: number, y: number) => number;
  TILE: number;
  getRainLevel: () => number; // 0..1, calculado por updateWeather (game.js)
}

export interface AudioAmbient {
  updateAmbient: () => void;
  thunder: (inten: number) => void;
}

export function createAudioAmbient(ctx: AudioAmbientCtx): AudioAmbient {
  let _ambient: AmbientNodes | null = null;

  function buildAmbient(ac: AudioContext): AmbientNodes | null {
    const cat = ctx.catNode('ambient'); if (!cat) return null;
    const n = (ac.sampleRate * 2) | 0, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } // ruído rosa em loop
    const mk = (type: BiquadFilterType, freq: number, q: number, vol: number): GainNode => {
      const s = ac.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = ac.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(cat); try { s.start(); } catch (e) { /* noop */ } return g;
    };
    // trânsito/rumor · folhas/vento · água (proximidade) · chuva (ciclo)
    return { hum: mk('lowpass', 480, 0, 0.055), wind: mk('highpass', 3200, 0, 0.028), water: mk('bandpass', 820, 1.4, 0), rain: mk('highpass', 1700, 0, 0) };
  }

  function updateAmbient(): void {
    const ac = ctx.getAudioCtx(), cat = ctx.getAudioCat();
    if (!ac || !ctx.getSoundOn() || !cat || !cat.ambient || !cat.ambient.on) return;
    if (!_ambient) { _ambient = buildAmbient(ac); if (!_ambient) return; }
    const pl = ctx.getPlayers()[0], px = Math.floor(pl.x / ctx.TILE), py = Math.floor(pl.y / ctx.TILE);
    let nearWater = 0;
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) { if (ctx.tileAt(px + dx, py + dy) === 3) nearWater = Math.max(nearWater, 1 - Math.hypot(dx, dy) / 4.2); }
    _ambient.water.gain.setTargetAtTime(0.15 * nearWater, ac.currentTime, 0.3);
    _ambient.rain.gain.setTargetAtTime(0.09 * ctx.getRainLevel(), ac.currentTime, 0.5); // chuva segue _rainLevel; 0 = silêncio total
  }

  function thunder(inten: number): void { // rumor grave sintetizado (intensidade variável)
    if (!ctx.getSoundOn() || ctx.getVolume() <= 0) return; const ac = ctx.ensureAC(); if (!ac) return;
    try {
      const vol = ctx.getVolume();
      const src = ac.createBufferSource(); src.buffer = ctx.noiseBuffer(ac); src.loop = true;
      const bq = ac.createBiquadFilter(); bq.type = 'lowpass'; bq.frequency.value = 140 + Math.random() * 220; bq.Q.value = 0.7;
      const g = ac.createGain(), t = ac.currentTime, dur = 0.7 + inten * 1.4;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.min(0.55, 0.2 * inten) * vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bq).connect(g).connect(ctx.catNode('ambient') || ctx.audioOut() || ac.destination); src.start(t); src.stop(t + dur + 0.1);
    } catch (e) { /* Web Audio indisponível */ }
  }

  return { updateAmbient, thunder };
}
