// SPDX-License-Identifier: AGPL-3.0-or-later
// render/weather — visual CLIMA: rain intensity ramp, thunder cadence/flash, and the rain-drop layer drawn in
// screen-space on top of everything. Extracted from game.js's updateWeather/drawWeather (behavior-preserving,
// formulas verbatim). `weatherLayer` (the PIXI.Graphics) and `stage` are CREATED in game.js — the layer's z-order
// is soldered into the render-graph assembly there, same precedent as render/scene-sky.ts — and are INJECTED via
// initWeather(); only the logic moves. `_rainLevel` is the bridge to platform/audio-ambient.ts (thunder/rain
// track follow the visual): exposed here ONLY via getRainLevel(), never the raw mutable value, exactly like the
// game.js `get rainLevel(){return _rainLevel;}` it replaces. `cenario` is read as a live binding from
// core/state.ts (shared state home); `rnd` from core/rng.ts (shared pure RNG) — same pattern as render/fx.ts.

import { rnd } from '../core/rng.js';

import type { DesenhoComLinha } from './port.js';
// `cenario` e `CENARIOS` SAÍRAM (Fase B, ADR-0038): o cenário virou estado do JOGO (`game/state`), e este
// módulo é engine — o gate de fronteira proíbe a importação. Em vez do VALOR, entra a PERGUNTA: `temChuva`.
// Ficou melhor do que era: o módulo perguntava "qual tema, e o dado dele diz chuva?"; agora pergunta "chove
// aqui?", que é a única coisa que ele precisa saber.

// ---------------------------------------------------------------------------------------------
// Pure logic (no PIXI/DOM) — rain intensity curve, thunder cadence, drop positions over time.
// ---------------------------------------------------------------------------------------------

/** A single rain drop's screen-space position + falling speed. */
export interface RainDrop { x: number; y: number; len: number; spd: number; }

/**
 * L5 (rotina do José): tempo bom nos primeiros 30s; depois LOOP de 60s = garoa 5s → chuva 5s → garoa 5s → bom 45s.
 * Skipped when scene decor is reduced-motion.
 *
 * QUEM TEM CHUVA É DADO DO TEMA (`CENARIOS[...].chuva`), e não uma condição escrita aqui. Era
 * `cenario === 'cidade'` — verdade enquanto a Cidade era o único tema com chuva, e mentira no dia em que o Dev
 * pediu chuva na Floresta. O defeito de uma condição dessas não é estar errada, é ser INVISÍVEL de onde a
 * pessoa procura: quem abre a tabela de cenários para dar chuva a um tema novo não encontra nada para mudar.
 *
 * @param sec elapsed weather-clock time, in seconds
 * @param temChuva true when the active theme declares `chuva`
 * @param reduceDecor true when reduced-motion scene decor (rm.decor) is on
 * @returns target rain level: 0 (dry), 0.35 (garoa) or 1 (chuva)
 */
export function rainLevelTarget(sec: number, temChuva: boolean, reduceDecor: boolean): number {
  if (!(sec >= 30 && !reduceDecor && temChuva)) return 0;
  const c = (sec - 30) % 60;
  return c < 5 ? 0.35 : c < 10 ? 1 : c < 15 ? 0.35 : 0;
}

/** Onde estamos DENTRO do ciclo de 60s, em segundos. 0 = a primeira gota; 59 = um segundo antes dela. */
export function faseDoClima(sec: number): number { return (((sec - 30) % 60) + 60) % 60; }

/**
 * AGLOMERAÇÃO DAS NUVENS: 0 = espalhadas e altas, com o céu aparecendo entre elas; 1 = fechadas numa manta.
 *
 * O pedido do Dev foi de um MOVIMENTO, não de um estado: as nuvens se juntam, chove, elas se separam e o pôr
 * do sol aparece nas frestas. Quem faz isso ler como causa e não como coincidência é a ANTECEDÊNCIA — a manta
 * fecha OITO SEGUNDOS ANTES da primeira gota. Se fechasse junto, a chuva pareceria vir do nada e as nuvens
 * pareceriam reagir a ela; fechando antes, é a nuvem que traz a chuva, que é o que uma criança já sabe.
 *
 * Anda no MESMO ciclo da chuva (`faseDoClima`), e não num relógio próprio, porque dois relógios independentes
 * desandam um do outro — não de imediato, mas depois de alguns minutos, e aí ninguém liga o defeito à causa.
 * Devolve uma rampa contínua: não precisa de suavização depois.
 */
export function aglomeracaoAlvo(sec: number, temChuva: boolean, reduceDecor: boolean): number {
  if (!(sec >= 22 && !reduceDecor && temChuva)) return 0; // 22s = exatamente a fase 52, onde a rampa começa
  const f = faseDoClima(sec);
  if (f >= 52) return (f - 52) / 8;     // 8s juntando, antes da primeira gota
  if (f < 12) return 1;                 // fechado durante a garoa e a chuva
  if (f < 22) return 1 - (f - 12) / 10; // 10s abrindo — é aqui que o pôr do sol reaparece
  return 0;
}

/** Ramps `current` toward `target` by at most `step`, snapping to `target` once within 0.02 (no "quase seco" flicker). */
export function rampRainLevel(current: number, target: number, step: number): number {
  let next = current + Math.max(-step, Math.min(step, target - current));
  if (Math.abs(target - next) < 0.02) next = target;
  return next;
}

/** Thunder cooldown/flash step (só na chuva forte, > 0.45). Calls `onThunder(inten)` — e.g. platform/audio-ambient's `thunder`. */
export interface ThunderStep { thunderCD: number; flash: number; }
export function stepThunder(rainLevel: number, thunderCD: number, flash: number, rndFn: () => number, onThunder: (inten: number) => void): ThunderStep {
  if (rainLevel > 0.45) {
    thunderCD--;
    if (thunderCD <= 0) {
      thunderCD = 200 + Math.floor(rndFn() * 420);
      const inten = 0.35 + rndFn() * 0.65;
      flash = Math.max(flash, inten);
      onThunder(inten);
    }
  }
  if (flash > 0) flash = Math.max(0, flash - 0.05);
  return { thunderCD, flash };
}

/** Seeds `n` rain drops at random positions across the WxH screen (lazy — built once on first rain). */
export function makeRainDrops(n: number, W: number, H: number, rndFn: () => number): RainDrop[] {
  const drops: RainDrop[] = [];
  for (let i = 0; i < n; i++) drops.push({ x: rndFn() * W, y: rndFn() * H, len: 6 + rndFn() * 9, spd: 8 + rndFn() * 7 });
  return drops;
}

/** Advances one drop by its own speed; wraps to the top (new random x) past H. GAG: drops freeze when `moving` is false (pause). */
export function stepRainDrop(d: RainDrop, W: number, H: number, moving: boolean, rndFn: () => number): void {
  if (!moving) return;
  d.y += d.spd; d.x -= d.spd * 0.35;
  if (d.y > H) { d.y = -d.len; d.x = rndFn() * W; }
  if (d.x < 0) d.x += W;
}

// ---------------------------------------------------------------------------------------------
// PIXI drawing (weatherLayer injected — kept structural so the module still runs in node tests)
// ---------------------------------------------------------------------------------------------

// `Gfx` vem de `render/port`. A chuva traça linha, então é o `DesenhoComLinha`; o `parent` é lido para
// saber se a camada está no `stage` informado antes de reposicioná-la.
type Gfx = DesenhoComLinha & { parent: unknown };
interface StageLike {
  children: { length: number };
  setChildIndex(child: unknown, index: number): void;
}

export interface WeatherCtx {
  /** The PIXI.Graphics layer this module draws into (created + z-ordered in game.js, kept on top of the stage). */
  weatherLayer: Gfx;
  /** The PIXI.Container `weatherLayer` lives on — used only to re-pin it as the topmost child every draw. */
  stage: StageLike;
  /** Live screen size (pass `app.screen`; width/height read fresh on every draw()). */
  screen: { width: number; height: number };
  /** Reduced-motion flags; only `.decor` (scene decor/animation) matters here. */
  getRm: () => { decor?: boolean };
  /** Called when thunder should rumble (platform/audio-ambient's `ambient.thunder`). */
  thunder: (inten: number) => void;
  /** Chove no cenário atual? Uma PERGUNTA e não o id do cenário: quem tem o catálogo responde. */
  temChuva: () => boolean;
  /** O mundo está rodando? Um BOOLEANO e não a fase — a engine não conhece o vocabulário de cenas deste
   *  jogo (ADR-0030 C3). Era `phase === 'playing'`, importado de `core/state`. É o que congela as gotas na
   *  pausa: elas param no ar em vez de continuarem caindo por trás do menu. */
  mundoRodando: () => boolean;
}

let _weatherLayer: Gfx | null = null;
let _stage: StageLike | null = null;
let _screen: { width: number; height: number } | null = null;
let _getRm: (() => { decor?: boolean }) | null = null;
let _thunder: ((inten: number) => void) | null = null;
let _temChuva: (() => boolean) | null = null;
let _mundoRodando: () => boolean = () => true;

let _rainLevel = 0, _weatherT = 0, _flash = 0, _thunderCD = 240, _aglomeracao = 0;
let _rainDrops: RainDrop[] | null = null;

export function initWeather(ctx: WeatherCtx): void {
  _weatherLayer = ctx.weatherLayer;
  _stage = ctx.stage;
  _screen = ctx.screen;
  _getRm = ctx.getRm;
  _thunder = ctx.thunder;
  _temChuva = ctx.temChuva;
  _mundoRodando = ctx.mundoRodando;
}

/** Per-frame clima update (game.js calls this only while `phase==='playing'`, same as before). */
export function updateWeather(): void {
  _weatherT++;
  const sec = _weatherT / 60;
  const rm = _getRm ? _getRm() : {};
  const temChuva = _temChuva ? _temChuva() : false;
  const target = rainLevelTarget(sec, temChuva, !!rm.decor);
  _rainLevel = rampRainLevel(_rainLevel, target, 1 / 30); // rampa ~1s
  _aglomeracao = aglomeracaoAlvo(sec, temChuva, !!rm.decor); // já é rampa: nada a suavizar aqui
  const step = stepThunder(_rainLevel, _thunderCD, _flash, rnd, (inten) => { if (_thunder) _thunder(inten); });
  _thunderCD = step.thunderCD; _flash = step.flash;
}

/** Redraws the rain/flash overlay (chuva/clarão em tela-espaço, sobre tudo). */
export function drawWeather(): void {
  if (!_weatherLayer) return;
  const g = _weatherLayer;
  if (_stage && g.parent === _stage) _stage.setChildIndex(g, _stage.children.length - 1); // mantido no topo em draw
  g.clear();
  const W = _screen ? _screen.width : 0, H = _screen ? _screen.height : 0;
  if (_rainLevel <= 0 && _flash <= 0) return;
  if (_rainLevel > 0) {
    g.beginFill(0x0a0e1a, _rainLevel * 0.34); g.drawRect(0, 0, W, H); g.endFill(); // céu mais escuro
    if (!_rainDrops) _rainDrops = makeRainDrops(110, W, H, rnd);
    const mv = _mundoRodando(); // GAG: gotas congelam na pausa
    g.lineStyle(1, 0xaebfe0, 0.5 * _rainLevel);
    for (const d of _rainDrops) { stepRainDrop(d, W, H, mv, rnd); g.moveTo(d.x, d.y); g.lineTo(d.x - 2, d.y + d.len); }
    g.lineStyle(0);
  }
  if (_flash > 0) { g.beginFill(0xe4ecff, _flash * 0.55); g.drawRect(0, 0, W, H); g.endFill(); } // clarão do relâmpago
}

/** The clima→áudio bridge: platform/audio-ambient.ts reads this (never the raw value) so its rain track follows the visual. */
export function getRainLevel(): number { return _rainLevel; }
/** A ponte clima→céu: render/scene-sky lê isto para juntar e separar as nuvens no compasso da chuva. */
export function getAglomeracao(): number { return _aglomeracao; }
/** Weather-clock read/write — the game.js `window.__incl.weatherT` debug hook fast-forwards the cycle via this. */
export function getWeatherT(): number { return _weatherT; }
export function setWeatherT(v: number): void { _weatherT = v; }
