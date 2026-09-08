// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/webcam.ts — JOGAR COM OS OLHOS (acessibilidade motora): controle por olhar via WebGazer (webcam). Estágio 4,
// Tier 1. WebGazer entra lazy (script do CDN no 1º uso; vendorizar p/ offline é futuro). onGaze mapeia o olhar
// para teclas SINTÉTICAS (olhar esq/dir = andar A/D; olhar p/ cima = pular Espaço) → reusa o input do teclado.
// O botão (#opt-eyes) fica no game.js (usa toggleBtn); aqui a lógica. Deps: ui/dom ($) + core/a11y-sr (srSay/srAlert).
import { t } from '../core/i18n.js';
import { $ } from './dom.js';
import { srAlert } from '../core/a11y-sr.js';
import { emFracao } from '../input/pointer-space.js'; // #105: um lugar so converte um ponto de tela
import { carimbarOrigem } from '../input/origem-sintetica.js'; // ADR-0109: a tecla sintetica declara quem a produziu

// API mínima do WebGazer (lib externa, não tipada) — encadeável.
type WG = { setRegression(m: string): WG; setGazeListener(fn: (d: unknown) => void): WG; begin(): WG; end(): void; showVideoPreview(b: boolean): WG; showPredictionPoints(b: boolean): WG };
const wg = (): WG | undefined => (window as unknown as { webgazer?: WG }).webgazer;

export let eyeMode = false; // ligado pelo botão; onGaze só age com ele ligado
export function setEyeMode(on: boolean): void { eyeMode = on; }

type EyeKey = 'left' | 'right' | 'up';
const _eyeKeys: Record<EyeKey, boolean> = { left: false, right: false, up: false };
// Dispara keydown/keyup SINTÉTICO só na TRANSIÇÃO (evita repetir). code = tecla física (KeyA/KeyD/Space).
function eyeSet(k: EyeKey, on: boolean, code: string): void {
  if (_eyeKeys[k] === on) return; _eyeKeys[k] = on;
  // ⚠️ CARIMBADO `'olhos'` ANTES DE DESPACHAR (ADR-0109). Sem esta linha o evento chega ao `input/keydown`
  // indistinguível de uma tecla premida e é carimbado `teclado` — e o efeito não é cosmético: a regra 3 diz
  // que apertar uma tecla devolve o teclado SEM alternância, logo o olhar da criança desligaria, sozinho e em
  // silêncio, a alternância de que ela depende para jogar. É o defeito que o §C desta issue existe para fechar.
  const ev = carimbarOrigem(new KeyboardEvent(on ? 'keydown' : 'keyup', { code, bubbles: true }), 'olhos');
  window.dispatchEvent(ev); document.dispatchEvent(ev);
}
// Recebe o ponto do olhar (px de tela), normaliza dentro do #game-region e vira direção. Exportado p/ teste.
//
// ⚠️ AQUI MORA METADE DA ISSUE #105, e vale estar escrito onde acontece: este handler recebe uma POSIÇÃO
// CONTÍNUA e deita-a fora em três limiares, emitindo teclas sintéticas. É a mesma coisa que os direcionais de
// toque fazem — e é por isso que a issue conclui que o ponteiro não é fundação nova, é a fundação que o olhar
// já precisava e nunca teve. Enquanto o ponto morre aqui, uma atividade de desenho não tem como usar o olhar.
//
// A conta em si passou a vir de `input/pointer-space`: um lugar só converte um ponto de tela, que é o
// primeiro item da `definition of done` da #105. O que este ficheiro FAZ com o ponto continua igual.
export function onGaze(data: unknown): void {
  const d = data as { x: number; y: number } | null;
  if (!d || !eyeMode) return; const gr = $<HTMLElement>('#game-region'); if (!gr) return;
  const r = gr.getBoundingClientRect(); if (!r.width) return;
  const { fx, fy } = emFracao(d.x, d.y, r);
  eyeSet('left', fx < 0.4, 'KeyA'); eyeSet('right', fx > 0.6, 'KeyD'); eyeSet('up', fy < 0.28, 'Space'); // esq/dir = andar; alto = pular
}
export function startEyeControl(): void {
  try {
    const g = wg(); if (!g) { srAlert(t('sr.eyes.loadFailed')); return; }
    g.setRegression('ridge').setGazeListener(onGaze).begin();
    try { g.showVideoPreview(true).showPredictionPoints(true); } catch (e) { /* noop */ }
    srAlert(t('sr.eyes.calibrate'));
  } catch (e) { /* noop */ }
}
export function stopEyeControl(): void {
  try { const g = wg(); if (g) g.end(); } catch (e) { /* noop */ }
  eyeSet('left', false, 'KeyA'); eyeSet('right', false, 'KeyD'); eyeSet('up', false, 'Space');
}
// Carrega o WebGazer (uma vez) do CDN e chama cb ao terminar. Precisa de internet no 1º uso.
export function loadWebGazer(cb?: () => void): void {
  if (wg()) { if (cb) cb(); return; }
  const s = document.createElement('script'); s.src = 'https://webgazer.cs.brown.edu/webgazer.js'; s.async = true;
  s.onload = () => { if (cb) cb(); };
  s.onerror = () => srAlert(t('sr.eyes.needsInternet'));
  document.head.appendChild(s);
}
