// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/debug-panel — the ?debug=true live-tuning panel (physics/animation sliders + juice toggles). Leaf UI module.
// Built via closure DI: receives the LIVE TUNE/ANIM/JUICE objects (mutated in place) + saveJuice from the composition
// root, so the sliders/checkboxes tune the same state the game reads.
// Returns the panel element (or null when not in ?debug=true) — testable without booting the game.


type Tune = Record<string, number>;
type Anim = Record<string, number>;
/*
 * 🔴 DECLARED HERE (ADR-0228): the six fields are the juice switches this panel edits, and importing them from a game
 * module would be the inversion that record undid. ⚠️ It is NOT `Record<string, boolean>`, which is a description that
 * only LOOKS like the real one: it accepts any key and loses exactly what the named fields guarantee (ADR-0039).
 */
type Juice = { dust: boolean; sparkle: boolean; squash: boolean; hitstop: boolean; shake: boolean; shimmer: boolean };

/**
 * A SNAPSHOT OF THE CHARACTER in one frame — DATA, and no PixiJS object.
 *
 * The composition root, the only place where PixiJS is known, takes the snapshot and hands over strings. It is the
 * same choice as `RenderInto` and `CreateSprite` in render/port: asking for the VERB fits where lending the object does
 * not — and here it pays twice, because it keeps `ui/debug-panel` testable in the `node` project.
 */
export interface CharacterSample {
  /** Identity of the texture WITHIN this recording. Not geometry: the four idle frames share it. */
  textureId: number;
  /** The crop, "x,y WxH". */
  crop: string;
  /** The texture base, "WxH". */
  base: string;
  /** The sprite position, "x,y". */
  position: string;
  /** The scale, "x,y" — squash & stretch moves it. */
  scale: string;
  /** How many camera SIBLINGS were drawing a texture of the character in this frame. */
  siblingsDrawing: number;
  /** Where they were, in case there is one. */
  siblingPositions: string;
}

/** What the probe answers. Three questions, because they are what separates the remaining causes. */
export interface ProbeSummary {
  frames: number;
  textures: number;
  maxSiblings: number;
  siblingExample: string;
  /** The textures whose crop is too large for a character frame — atlas bleeding. */
  sangramento: string[];
  scales: string[];
  verdict: string;
}

/** A crop larger than this is not a character frame: it is a piece of the atlas. The largest real one is 31x35. */
const MAX_CHARACTER_FRAME_SIDE = 64;

/**
 * Reduces the recording to three questions and a verdict.
 *
 * THE ORDER OF THE VERDICT IS THE DECISION: a sibling drawing beats bleeding, because it is what produces WHOLE copies
 * at different positions. And when the three questions come back clean the verdict does NOT say "all is well": it says
 * WHERE to look next. Absence of evidence in the three is not evidence of absence, and ending the search here would end
 * it in the wrong place.
 */
export function summariseProbe(samples: readonly CharacterSample[]): ProbeSummary {
  if (!samples.length) {
    return { frames: 0, textures: 0, maxSiblings: 0, siblingExample: '', sangramento: [], scales: [], verdict: 'não gravou nada — o personagem existia?' };
  }
  const textureCount = new Set(samples.map((a) => a.textureId)).size;
  const withSiblings = samples.filter((a) => a.siblingsDrawing > 0);
  const mostSiblings = withSiblings.reduce((m, a) => Math.max(m, a.siblingsDrawing), 0);
  const isAtlasPiece = (r: string): boolean => {
    const m = /(\d+)x(\d+)$/.exec(r);
    return !!m && (+m[1] > MAX_CHARACTER_FRAME_SIDE || +m[2] > MAX_CHARACTER_FRAME_SIDE);
  };
  const sangramento = [...new Set(samples.filter((a) => isAtlasPiece(a.crop)).map((a) => a.crop + ' (base ' + a.base + ')'))];
  const distinctScales = [...new Set(samples.map((a) => a.scale))].sort();
  const finding = mostSiblings > 0
    ? 'ALGUÉM DESENHA DUAS VEZES: até ' + mostSiblings + ' irmão(s) da câmera com a textura do personagem'
    : sangramento.length
      ? 'RECORTE GRANDE DEMAIS: o quadro está pegando pedaço do atlas'
      : 'sprite limpo (uma textura por quadro, sem irmão, recorte de quadro) — procure em composição: filtro, pós-efeito ou câmera';
  return { frames: samples.length, textures: textureCount, maxSiblings: mostSiblings, siblingExample: withSiblings.length ? withSiblings[0].siblingPositions : '', sangramento, scales: distinctScales, verdict: finding };
}

export interface DebugPanelCtx {
  TUNE: Tune;
  ANIM: Anim;
  JUICE: Juice;
  saveJuice: () => void;
  /**
   * A snapshot of the character NOW, or `null` if there is no character in the scene yet.
   *
   * OPTIONAL: a host with no character (the quiz) does not provide it, and the probe simply does not appear. The
   * panel still does not know PixiJS.
   */
  sampleCharacter?: () => CharacterSample | null;
  /** Calls `fn` every frame and returns how to cancel. It is the render clock, injected as a verb. */
  onFrame?: (fn: () => void) => () => void;
  /** Override for tests; defaults to location.search. */
  search?: string;
}

type Header = { h: string };
type Toggle = { label: string; chk: () => boolean; set: (v: boolean) => void };
type Range = { label: string; get: () => number; set: (v: number) => void; min: number; max: number; step: number; cadence?: boolean };
type Knob = Header | Toggle | Range;

export function initDebugPanel(ctx: DebugPanelCtx): HTMLElement | null {
  const search = ctx.search ?? location.search;
  if (!/[?&]debug=true/.test(search)) return null;
  const { TUNE, ANIM, JUICE, saveJuice } = ctx;

  const KNOBS: Knob[] = [
    { h: 'Movimento (valores absolutos)' },
    { label: 'Velocidade de andar', get: () => TUNE.hWalk, set: (v: number) => (TUNE.hWalk = v), min: 0.5, max: 5, step: 0.1 },
    { label: 'Velocidade de correr', get: () => TUNE.hRun, set: (v: number) => (TUNE.hRun = v), min: 1, max: 7, step: 0.1 },
    { label: 'Super-corrida (turbo)', get: () => TUNE.hTurbo, set: (v: number) => (TUNE.hTurbo = v), min: 1, max: 9, step: 0.1 },
    { label: 'Pulo (impulso inicial)', get: () => TUNE.jumpVel, set: (v: number) => (TUNE.jumpVel = v), min: 1, max: 8, step: 0.1 },
    { label: 'Ultra-pulo', get: () => TUNE.ultraJumpVel, set: (v: number) => (TUNE.ultraJumpVel = v), min: 3, max: 16, step: 0.1 },
    { label: 'Trampolim (base)', get: () => TUNE.trampBase, set: (v: number) => (TUNE.trampBase = v), min: 2, max: 10, step: 0.1 },
    { label: 'Trampolim (máximo)', get: () => TUNE.trampMax, set: (v: number) => (TUNE.trampMax = v), min: 3, max: 14, step: 0.1 },
    { label: 'Nado: impulso', get: () => TUNE.waterJump, set: (v: number) => (TUNE.waterJump = v), min: 1, max: 7, step: 0.1 },
    { label: 'Nado: impulso correndo', get: () => TUNE.waterJumpRun, set: (v: number) => (TUNE.waterJumpRun = v), min: 1, max: 8, step: 0.1 },
    { label: 'Nado: quadros/braçada', get: () => TUNE.waterStrokeFrames, set: (v: number) => (TUNE.waterStrokeFrames = v), min: 10, max: 60, step: 1 },
    { label: 'Escalada (velocidade)', get: () => TUNE.climbSpeed, set: (v: number) => (TUNE.climbSpeed = v), min: 0.5, max: 4, step: 0.1 },
    { label: 'Gravidade', get: () => TUNE.gravity, set: (v: number) => (TUNE.gravity = v), min: 0.05, max: 0.4, step: 0.01 },
    { label: 'Queda máxima', get: () => TUNE.maxFall, set: (v: number) => (TUNE.maxFall = v), min: 3, max: 14, step: 0.5 },
    { label: 'Queda máxima na água', get: () => TUNE.waterMaxFall, set: (v: number) => (TUNE.waterMaxFall = v), min: 1, max: 8, step: 0.5 },
    { h: 'Animação (cadência: ticks/quadro)' },
    { label: 'Andar', get: () => ANIM.walkHold, set: (v: number) => (ANIM.walkHold = v), min: 1, max: 20, step: 1, cadence: true },
    { label: 'Correr', get: () => ANIM.runHold, set: (v: number) => (ANIM.runHold = v), min: 1, max: 20, step: 1, cadence: true },
    { label: 'Parado (idle)', get: () => ANIM.idleHold, set: (v: number) => (ANIM.idleHold = v), min: 2, max: 40, step: 1, cadence: true },
    { label: 'Nado', get: () => ANIM.swimHold, set: (v: number) => (ANIM.swimHold = v), min: 2, max: 24, step: 1, cadence: true },
    { h: 'Juice (efeitos de resposta) — toggles independentes' },
    { label: '💨 Poeira (pulo/pouso/corrida)', chk: () => JUICE.dust, set: (v: boolean) => { JUICE.dust = v; saveJuice(); } },
    { label: '✨ Brilho ao coletar', chk: () => JUICE.sparkle, set: (v: boolean) => { JUICE.sparkle = v; saveJuice(); } },
    { label: '🤸 Squash & stretch', chk: () => JUICE.squash, set: (v: boolean) => { JUICE.squash = v; saveJuice(); } },
    { label: '⏱️ Hit-stop (impacto)', chk: () => JUICE.hitstop, set: (v: boolean) => { JUICE.hitstop = v; saveJuice(); } },
    { label: '📳 Tremor de tela', chk: () => JUICE.shake, set: (v: boolean) => { JUICE.shake = v; saveJuice(); } },
    { label: '🌟 Cintilar dos itens', chk: () => JUICE.shimmer, set: (v: boolean) => { JUICE.shimmer = v; saveJuice(); } },
  ]; // The CRT look is not here: it lives in the visual sensitivity panel (the Dev's request).

  const p = document.createElement('div');
  p.id = 'debug-panel';
  p.hidden = true; // starts hidden; opened by the 🐞 Debug button
  p.setAttribute('role', 'group');
  p.setAttribute('aria-label', 'Painel de depuração');
  p.style.cssText = 'position:fixed;top:8px;right:8px;z-index:200;background:rgba(11,16,32,.97);color:#fff;border:2px solid #ffd23f;border-radius:8px;padding:.6rem .7rem;font:13px/1.4 system-ui,sans-serif;max-width:270px;max-height:86vh;overflow:auto;box-shadow:0 4px 16px rgba(0,0,0,.5)';
  p.innerHTML = '<strong>🔧 ?debug — valores ao vivo</strong>';

  for (const k of KNOBS) {
    if ('h' in k) {
      const h = document.createElement('div');
      h.textContent = k.h;
      h.style.cssText = 'margin:.7rem 0 .1rem;font-weight:700;color:#ffd23f;border-bottom:1px solid rgba(255,210,63,.4)';
      p.appendChild(h);
      continue;
    }
    if ('chk' in k) {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;gap:.4rem;align-items:center;margin-top:.4rem;font-size:12px;cursor:pointer';
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.checked = k.chk();
      inp.addEventListener('change', () => k.set(inp.checked));
      row.appendChild(inp);
      row.appendChild(document.createTextNode(k.label));
      p.appendChild(row);
      continue;
    }
    const row = document.createElement('div');
    row.style.cssText = 'margin-top:.5rem';
    const lab = document.createElement('label');
    lab.style.cssText = 'display:block;font-size:12px;margin-bottom:2px';
    const val = document.createElement('strong');
    val.style.cssText = 'color:#ffd23f;float:right';
    const upd = () => { val.textContent = k.cadence ? `${k.get()} (${Math.round(60 / k.get())}fps)` : String(k.get()); };
    lab.textContent = k.label;
    lab.appendChild(val);
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = String(k.min);
    inp.max = String(k.max);
    inp.step = String(k.step);
    inp.value = String(k.get());
    inp.style.cssText = 'width:100%';
    inp.setAttribute('aria-label', k.label);
    inp.addEventListener('input', () => { k.set(parseFloat(inp.value)); upd(); });
    row.appendChild(lab);
    row.appendChild(inp);
    p.appendChild(row);
    upd();
  }

  /* ===================== THE CHARACTER PROBE =====================
     It lives HERE, and not in a script to paste into the console, because that is what the Dev asked for — an
     instrument that exists only while someone remembers to paste it is not an instrument, it is a memory. Here it
     sits beside the other live values, behind the same `?debug=true`.

     It only appears if the host can take the snapshot: a game with no character does not get a button that does
     nothing. */
  if (ctx.sampleCharacter && ctx.onFrame) {
    const sampleCharacter = ctx.sampleCharacter, everyFrame = ctx.onFrame;
    const h = document.createElement('div');
    h.textContent = 'Sonda do personagem';
    h.style.cssText = 'margin:.7rem 0 .1rem;font-weight:700;color:#ffd23f;border-bottom:1px solid rgba(255,210,63,.4)';
    p.appendChild(h);

    const migrated = document.createElement('pre');
    migrated.style.cssText = 'margin:.4rem 0 0;font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap;color:#cfe';
    migrated.setAttribute('aria-live', 'polite');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '🥷 Gravar 180 quadros';
    btn.style.cssText = 'margin-top:.4rem;width:100%;min-height:32px;font:inherit;font-weight:700;cursor:pointer;border-radius:6px;border:1px solid #ffd23f;background:#1a2740;color:#fff';
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      btn.disabled = true;
      const samples: CharacterSample[] = [];
      let n = 0;
      migrated.textContent = 'gravando… PULE agora';
      const stopSampling = everyFrame(() => {
        const a = sampleCharacter();
        if (a) samples.push(a);
        if (++n < 180) return;
        stopSampling();
        btn.disabled = false;
        const r = summariseProbe(samples);
        migrated.textContent = [
          'quadros: ' + r.frames + '  texturas: ' + r.textures,
          'irmãos desenhando: ' + r.maxSiblings + (r.siblingExample ? ' em ' + r.siblingExample : ''),
          'recorte grande: ' + (r.sangramento.length ? r.sangramento.join(' ') : 'nenhum'),
          'escalas: ' + r.scales.join(' '),
          '',
          '→ ' + r.verdict,
        ].join(String.fromCharCode(10));
        // The RAW recording stays reachable for whoever wants more than the summary — without filling the panel with 180 lines.
        (window as unknown as { __sonda?: unknown }).__sonda = samples;
      });
    });
    p.appendChild(btn);
    p.appendChild(migrated);
  }

  document.body.appendChild(p);
  return p;
}
