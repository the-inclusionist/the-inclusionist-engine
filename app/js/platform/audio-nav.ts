// SPDX-License-Identifier: GPL-3.0-or-later
// platform/audio-nav — pistas de áudio ESPACIAIS de a11y (cego / baixa visão): bengala, sonar, guarda de beirada, guia
// (beacon em laço) e nado cego. O cluster mais acoplado do Tier 2: lê tiles, colisão, moedas e jogadores. Cada pista pode
// sair por um AudioContext POR JOGADOR (playerCtx → setSinkId no dispositivo escolhido). Injeção por closure (padrão Tier 1).
//   playerCtx(pl)      — AudioContext do jogador (ou null → contexto global).   [exposto: a guarda de beirada o usa]
//   caneProbe(pl)      — material À FRENTE (agua/vazio/madeira/chão do tema).
//   caneTap(pl)        — batida da bengala no material adiante (ou tom grave oco no vazio).
//   waterNav(pl)       — nado cego: contato com paredes/chão/superfície (cordas).
//   panFor(wx,pl)      — pan −1..1 pela posição relativa.                        [exposto: a guarda de beirada o usa]
//   needsAudioCues(pl) — visão comprometida? (modo cego OU blind/lowvision).     [exposto: o gate de movimento o usa]
//   sonar(pl)          — aponta a moeda-alvo mais próxima (tom + fala).
//   updateGuide()      — beacon automático por frame p/ a moeda mais próxima (sonar contínuo).
// Extraído do game.js. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Tier 2, áudio rodada 3).

import type { PlayerView } from '../core/entity.js';

type SinkAC = AudioContext & { setSinkId?: (id: string) => Promise<void> };
/**
 * O jogador visto pela NAVEGAÇÃO SONORA. Os campos de posição e identidade são derivados; os de áudio não.
 *
 * Mesma regra de game/quiz, do outro lado: este módulo é DONO dos tipos de áudio, então declara `_ac` como
 * `SinkAC` (o AudioContext com o `setSinkId` opcional) e `_acOut` como `GainNode`, enquanto core/entity os
 * declara no mínimo estrutural — `{ close(): void }` e `unknown` — porque `core/` não pode importar tipos de
 * Web Audio para descrever uma entidade de jogo. Quem é dono do tipo pode saber mais; quem não é, não pode.
 */
type Player = PlayerView<'x' | 'y' | 'facing' | 'viz' | 'i' | 'audioSink' | 'wnT' | 'guideT'>
  & { _ac?: SinkAC | null; _acOut?: GainNode };
export interface PlayerCtxOut { ac: AudioContext; out: GainNode; }
interface Coin { x: number; y: number; taken?: boolean; owner: number; }
type VizDef = { kind?: string } | undefined;

export interface AudioNavCtx {
  tileAt: (x: number, y: number) => number;
  solidAt: (x: number, y: number) => boolean;
  held: (pl: Player, act: string) => boolean;
  tonePan: (freq: number, dur: number, cat: string, pan?: number | null, vol?: number, type?: OscillatorType, pc?: PlayerCtxOut | null) => void;
  noiseHit: (mat: string, pan?: number, pc?: PlayerCtxOut | null) => void;
  srSay: (t: string) => void;
  narrate: (t: string) => void;
  BOX: { w: number; h: number };
  TILE: number;
  LOGICAL_W: number;
  VIZ_BY_KEY: Record<string, VizDef>;
  getCoins: () => Coin[];
  getPlayers: () => Player[];
  getNumPlayers: () => number;
  getCenario: () => string;
  getModoCego: () => boolean;
  getAudioCtx: () => AudioContext | null;
  getSoundOn: () => boolean;
  getAudioCat: () => Record<string, { on: boolean }> | null;
}

export interface AudioNav {
  playerCtx: (pl: Player) => PlayerCtxOut | null;
  caneProbe: (pl: Player) => string;
  caneTap: (pl: Player) => void;
  waterNav: (pl: Player) => void;
  panFor: (wx: number, pl: Player) => number;
  needsAudioCues: (pl: Player) => boolean;
  sonar: (pl: Player) => void;
  updateGuide: () => void;
  readonly caneCount: number;
  readonly waterNavCount: number;
  readonly sonarCount: number;
  readonly guideCount: number;
}

export function createAudioNav(ctx: AudioNavCtx): AudioNav {
  const SURF_MAT: Record<string, string> = { cidade: 'piso', campo: 'grama', floresta: 'grama', cemiterio: 'terra', espaco: 'pedra', classico: 'pedra' }; // chão por tema
  let _caneCount = 0, _waterNavCount = 0, _sonarCount = 0, _guideCount = 0;

  function playerCtx(pl: Player): PlayerCtxOut | null {
    if (!pl || !pl.audioSink) return null;
    try {
      if (!pl._ac) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        pl._ac = new AC(); pl._acOut = pl._ac.createGain(); pl._acOut.connect(pl._ac.destination);
        if (pl._ac.setSinkId) pl._ac.setSinkId(pl.audioSink).catch(() => {});
      }
      if (pl._ac.state === 'suspended') pl._ac.resume();
      return { ac: pl._ac, out: pl._acOut! };
    } catch (e) { return null; }
  }

  function caneProbe(pl: Player): string { // material À FRENTE
    const dir = pl.facing < 0 ? -1 : 1;
    const ax = Math.floor((pl.x + dir * (ctx.BOX.w / 2 + ctx.TILE * 0.6)) / ctx.TILE), footTy = Math.floor((pl.y + 1) / ctx.TILE);
    if (ctx.tileAt(ax, footTy) === 3 || ctx.tileAt(ax, footTy - 1) === 3) return 'agua'; // água à frente
    let gty = -1; for (let ty = footTy; ty <= footTy + 1; ty++) { if (ctx.solidAt(ax, ty)) { gty = ty; break; } } // chão (pé ou 1 abaixo = degrau/rampa)
    if (gty < 0) return 'vazio'; // sem chão → fosso
    if (ctx.tileAt(ax, gty) === 4) return 'madeira'; // escada
    return SURF_MAT[ctx.getCenario()] || 'pedra';
  }

  function caneTap(pl: Player): void {
    const mat = caneProbe(pl), dir = pl.facing < 0 ? -1 : 1, pan = dir * 0.5, pc = playerCtx(pl); _caneCount++;
    if (mat === 'vazio') { ctx.tonePan(150, 0.18, 'guard', pan, 0.16, 'sine', pc); return; } // vazio = tom grave oco
    ctx.noiseHit(mat, pan, pc); // batida no material adiante (no dispositivo do jogador)
  }

  function waterNav(pl: Player): void { // NADO CEGO: guia por contato com bordas + superfície
    // dir tipado como number (não 1|-1) DE PROPÓSITO: o original usa `dir!==0` (sempre true aqui, pois facing é ±1) —
    // preservo essa guarda sempre-verdadeira exatamente; alargar o tipo satisfaz o tsc sem mudar o comportamento.
    const dir: number = pl.facing < 0 ? -1 : 1, tx = Math.floor(pl.x / ctx.TILE), tyF = Math.floor((pl.y - 1) / ctx.TILE), tyH = Math.floor((pl.y - ctx.BOX.h) / ctx.TILE);
    const wallAhead = ctx.solidAt(tx + dir, tyF) || ctx.solidAt(tx + dir, tyH); // parede lateral (azulejo)
    const floorBelow = ctx.solidAt(tx, tyF + 1); // chão (fundo)
    const openAbove = ctx.tileAt(tx, tyH - 1) !== 3 && !ctx.solidAt(tx, tyH - 1); // acima da cabeça é ar → dá p/ subir/sair
    const moving = (dir !== 0) || ctx.held(pl, 'up') || ctx.held(pl, 'down'), pc = playerCtx(pl);
    pl.wnT = (pl.wnT || 0) + 1; if (pl.wnT < 18) return; let played = true;
    if (openAbove && wallAhead) ctx.noiseHit('parede', dir * 0.5, pc); // superfície + parede = batida (fim da corda)
    else if (openAbove && moving) ctx.tonePan(560, 0.09, 'guide', dir * 0.4, 0.12, 'sine', pc); // corda livre: "dá p/ subir"
    else if (wallAhead && dir !== 0) ctx.noiseHit('parede', dir * 0.5, pc); // parede submersa à frente
    else if (floorBelow && ctx.held(pl, 'down')) ctx.noiseHit('areia', 0, pc); // fundo (chão)
    else played = false;
    if (played) { pl.wnT = 0; _waterNavCount++; } else pl.wnT = 17; // sem contato = SEM som (pronto p/ tocar ao encostar)
  }

  function panFor(wx: number, pl: Player): number { return Math.max(-1, Math.min(1, (wx - pl.x) / (ctx.LOGICAL_W * 0.55))); }

  function needsAudioCues(pl: Player): boolean { // guarda/guia só quando a visão está comprometida ou no modo cego
    if (ctx.getModoCego()) return true; const m = ctx.VIZ_BY_KEY[pl.viz]; return !!(m && (m.kind === 'blind' || m.kind === 'lowvision'));
  }

  function sonar(pl: Player): void {
    _sonarCount++; let best: Coin | null = null, bd = 1e9;
    for (const cn of ctx.getCoins()) { if (cn.taken || cn.owner !== pl.i) continue; const d = Math.hypot(cn.x - pl.x, cn.y - pl.y); if (d < bd) { bd = d; best = cn; } }
    const pc = playerCtx(pl); if (!best) { ctx.tonePan(300, 0.2, 'sonar', 0, 0.2, 'sine', pc); ctx.srSay('Nenhuma moeda por perto.'); return; }
    const pan = panFor(best.x, pl), near = Math.max(0, 1 - bd / (12 * ctx.TILE)); ctx.tonePan(380 + 740 * near, 0.16, 'sonar', pan, 0.26, 'sine', pc); // mais perto = mais agudo
    const lado = best.x < pl.x - 4 ? 'à esquerda' : best.x > pl.x + 4 ? 'à direita' : 'à frente', dist = bd < 4 * ctx.TILE ? 'bem perto' : bd < 9 * ctx.TILE ? 'perto' : 'longe';
    const msg = (ctx.getNumPlayers() > 1 ? 'Jogador ' + (pl.i + 1) + ': ' : '') + 'Sonar: moeda ' + lado + ', ' + dist + '.'; ctx.srSay(msg); ctx.narrate(msg);
  }

  function updateGuide(): void {
    const cat = ctx.getAudioCat(); if (!ctx.getAudioCtx() || !ctx.getSoundOn() || !cat || !cat.guide || !cat.guide.on) return;
    for (const pl of ctx.getPlayers()) {
      if (!needsAudioCues(pl)) continue; pl.guideT = (pl.guideT || 0) + 1; if (pl.guideT < 48) continue; pl.guideT = 0; // pinga ~0,8s
      let best: Coin | null = null, bd = 1e9;
      for (const cn of ctx.getCoins()) { if (cn.taken || cn.owner !== pl.i) continue; const d = Math.hypot(cn.x - pl.x, cn.y - pl.y); if (d < bd) { bd = d; best = cn; } }
      if (best) { const pan = panFor(best.x, pl), near = Math.max(0, 1 - bd / (14 * ctx.TILE)); ctx.tonePan(300 + 380 * near, 0.12, 'guide', pan, 0.11, 'triangle', playerCtx(pl)); _guideCount++; }
    }
  }

  return {
    playerCtx, caneProbe, caneTap, waterNav, panFor, needsAudioCues, sonar, updateGuide,
    get caneCount() { return _caneCount; },
    get waterNavCount() { return _waterNavCount; },
    get sonarCount() { return _sonarCount; },
    get guideCount() { return _guideCount; },
  };
}
