// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/debug-panel — the ?debug=true live-tuning panel (physics/animation sliders + juice toggles). Leaf UI module.
// Built via closure DI: receives the LIVE TUNE/ANIM/JUICE objects (mutated in place) + saveJuice from the composition
// root, so the sliders/checkboxes tune the same state the game reads. Extracted from game.js (modularization Tier 1).
// Returns the panel element (or null when not in ?debug=true) — testable without booting the game.

import type { JuiceFlags } from '../render/fx.js';
type Tune = Record<string, number>;
type Anim = Record<string, number>;
// `Juice` era `Record<string, boolean>` — uma descrição que APENAS se parece com a real. O dono é
// `render/fx`, que exporta `JuiceFlags` com os campos nomeados. ADR-0039: quem não é dono, ou não
// declara, ou declara um supertipo VERDADEIRO. Um `Record` genérico não é nem um nem outro — ele
// aceita qualquer chave e perde exatamente o que o tipo do dono garante.
type Juice = JuiceFlags;

export interface DebugPanelCtx {
  TUNE: Tune;
  ANIM: Anim;
  JUICE: Juice;
  saveJuice: () => void;
  /** Override for tests; defaults to location.search. */
  search?: string;
}

type Header = { h: string };
type Toggle = { label: string; chk: () => boolean; set: (v: boolean) => void };
type Range = { label: string; get: () => number; set: (v: number) => void; min: number; max: number; step: number; cad?: boolean };
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
    { label: 'Andar', get: () => ANIM.walkHold, set: (v: number) => (ANIM.walkHold = v), min: 1, max: 20, step: 1, cad: true },
    { label: 'Correr', get: () => ANIM.runHold, set: (v: number) => (ANIM.runHold = v), min: 1, max: 20, step: 1, cad: true },
    { label: 'Parado (idle)', get: () => ANIM.idleHold, set: (v: number) => (ANIM.idleHold = v), min: 2, max: 40, step: 1, cad: true },
    { label: 'Nado', get: () => ANIM.swimHold, set: (v: number) => (ANIM.swimHold = v), min: 2, max: 24, step: 1, cad: true },
    { h: 'Juice (efeitos de resposta) — toggles independentes' },
    { label: '💨 Poeira (pulo/pouso/corrida)', chk: () => JUICE.dust, set: (v: boolean) => { JUICE.dust = v; saveJuice(); } },
    { label: '✨ Brilho ao coletar', chk: () => JUICE.sparkle, set: (v: boolean) => { JUICE.sparkle = v; saveJuice(); } },
    { label: '🤸 Squash & stretch', chk: () => JUICE.squash, set: (v: boolean) => { JUICE.squash = v; saveJuice(); } },
    { label: '⏱️ Hit-stop (impacto)', chk: () => JUICE.hitstop, set: (v: boolean) => { JUICE.hitstop = v; saveJuice(); } },
    { label: '📳 Tremor de tela', chk: () => JUICE.shake, set: (v: boolean) => { JUICE.shake = v; saveJuice(); } },
    { label: '🌟 Cintilar dos itens', chk: () => JUICE.shimmer, set: (v: boolean) => { JUICE.shimmer = v; saveJuice(); } },
  ]; // Estética CRT saiu daqui: mora no menu Sensibilidade visual (pedido do José).

  const p = document.createElement('div');
  p.id = 'debug-panel';
  p.hidden = true; // começa oculto; abre pelo botão 🐞 Debug
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
    const upd = () => { val.textContent = k.cad ? `${k.get()} (${Math.round(60 / k.get())}fps)` : String(k.get()); };
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

  document.body.appendChild(p);
  return p;
}
