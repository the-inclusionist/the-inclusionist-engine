// SPDX-License-Identifier: GPL-3.0-or-later
// platform/audio-nav — BENGALA e NADO CEGO: as pistas sonoras que só existem onde há MUNDO (item 19).
//
// ========================= ESTE MÓDULO ERA DOIS =========================
// O achado 9 do segundo consumidor: "o módulo é DOIS módulos com um nome só — `caneProbe`/`caneTap`/
// `waterNav` são bengala e natação, isto é, plataforma; `sonar`/`panFor`/`needsAudioCues` são navegação
// sonora, que serve a qualquer jogo". A navegação sonora saiu para `platform/audio-sonar` e recebe o
// CONTRATO em vez de tiles; aqui ficou a metade que lê o mundo, e que lê sem disfarce.
//
// O QUE SOBROU É PLATAFORMA, e é bom que o nome não esconda isso:
//   caneProbe(pl) — material À FRENTE (água/vazio/madeira/chão do tema), lendo tile e chão.
//   caneTap(pl)   — batida da bengala no material adiante (ou tom grave oco no vazio).
//   waterNav(pl)  — nado cego: contato com paredes/chão/superfície (cordas).
//
// A bengala precisa de `facing`, `BOX.w` e `TILE` para saber o que é "à frente"; o nado precisa de `solidAt`
// em três alturas. Nada disso é traduzível para um jogo sem corpo e sem mundo, e por isso NÃO foi traduzido:
// o corte separa o que viaja do que não viaja, em vez de fingir que tudo viaja.
//
// ========================= A METADE QUE VIAJOU CONTINUA SAINDO DAQUI =========================
// `playerCtx`, `panFor`, `needsAudioCues`, `sonar` e `updateGuide` seguem no retorno, delegados ao
// `AudioSonar` injetado. Não é preguiça de mexer no chamador: a bengala PRECISA do `playerCtx` (a batida sai
// no dispositivo do jogador) e o `main.js` monta um objeto só de navegação. O que mudou é que este módulo
// deixou de IMPLEMENTAR a metade genérica — ele a repassa, e quem quiser só ela importa o outro arquivo.
// Extraído do game.js. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Tier 2, áudio rodada 3).

import type { PlayerView } from '../core/entity.js';
import type { AudioSonar, PlayerCtxOut, SonarPlayer } from './audio-sonar.js';

export type { PlayerCtxOut };

/**
 * O jogador visto pela BENGALA e pelo NADO. `facing` e `wnT` são desta metade; a outra não os usa.
 *
 * Mesma regra de game/quiz, do outro lado: este módulo é DONO dos tipos de áudio, então declara `_ac` como
 * `SinkAC` (o AudioContext com o `setSinkId` opcional) e `_acOut` como `GainNode`, enquanto core/entity os
 * declara no mínimo estrutural — `{ close(): void }` e `unknown` — porque `core/` não pode importar tipos de
 * Web Audio para descrever uma entidade de jogo. Quem é dono do tipo pode saber mais; quem não é, não pode.
 */
type SinkAC = AudioContext & { setSinkId?: (id: string) => Promise<void> };
type Player = PlayerView<'x' | 'y' | 'facing' | 'viz' | 'i' | 'audioSink' | 'wnT' | 'guideT'>
  & { _ac?: SinkAC | null; _acOut?: GainNode };

export interface AudioNavCtx {
  tileAt: (x: number, y: number) => number;
  solidAt: (x: number, y: number) => boolean;
  held: (pl: Player, act: string) => boolean;
  tonePan: (freq: number, dur: number, cat: string, pan?: number | null, vol?: number, type?: OscillatorType, pc?: PlayerCtxOut | null) => void;
  noiseHit: (mat: string, pan?: number, pc?: PlayerCtxOut | null) => void;
  BOX: { w: number; h: number };
  TILE: number;
  getCenario: () => string;
  /**
   * A NAVEGAÇÃO SONORA, pronta (`platform/audio-sonar`). Entra por injeção e não por importação: é o que
   * permite empacotar o sonar sem levar a bengala junto — e é a diferença entre "dois arquivos" e "dois
   * módulos". Onze coisas do ctx antigo saíram com ela.
   */
  sonar: AudioSonar;
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
  let _caneCount = 0, _waterNavCount = 0;

  const som = ctx.sonar; // a metade que viaja, injetada
  const playerCtx = (pl: Player): PlayerCtxOut | null => som.playerCtx(pl as unknown as SonarPlayer);

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

  return {
    playerCtx, caneProbe, caneTap, waterNav,
    // Delegação PURA para a metade que viajou. Sem lógica no meio: um adaptador que decidisse alguma coisa
    // seria uma terceira implementação escondida entre as duas.
    panFor: (wx, pl) => som.panFor(wx, pl as unknown as SonarPlayer),
    needsAudioCues: (pl) => som.needsAudioCues(pl as unknown as SonarPlayer),
    sonar: (pl) => som.sonar(pl as unknown as SonarPlayer),
    updateGuide: () => som.updateGuide(),
    get caneCount() { return _caneCount; },
    get waterNavCount() { return _waterNavCount; },
    get sonarCount() { return som.sonarCount; },
    get guideCount() { return som.guideCount; },
  };
}
