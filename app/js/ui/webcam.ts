// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/webcam.ts — JOGAR COM OS OLHOS (acessibilidade motora): controle por olhar via WebGazer (webcam). Estágio 4,
// Tier 1. WebGazer runs from the sha256-checked cache the install filled (#168, #169) — never from the network. onGaze mapeia o olhar
// para teclas SINTÉTICAS (olhar esq/dir = andar A/D; olhar p/ cima = pular Espaço) → reusa o input do teclado.
// O botão (#opt-eyes) fica no game.js (usa toggleBtn); aqui a lógica. Deps: ui/dom ($) + core/a11y-sr (srSay/srAlert).
import { t } from '../core/i18n.js';
import { $ } from './dom.js';
import { srAlert } from '../core/a11y-sr.js';
import { emFracao } from '../input/pointer-space.js'; // #105: um lugar so converte um ponto de tela
import { carimbarOrigem } from '../input/origem-sintetica.js'; // ADR-0109: a tecla sintetica declara quem a produziu
import { PESADOS, CACHE_PESADOS } from '../platform/pesados.js'; // #169: WebGazer runs from the sha256-checked cache

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
/**
 * Loads WebGazer once, FROM THE CHECKED CACHE, and calls `cb` when it has run (issue #169; ADR-0132).
 *
 * The file is downloaded at install by `platform/pesados` and kept in `CACHE_PESADOS` only when its sha256 matches (#168);
 * it runs from a `blob:` of those bytes. Never from the network on first use: that ran third-party code unchecked, with the
 * page's powers and the camera, and did nothing at all in a school without a network. Not downloaded yet: nothing runs,
 * and the child hears why.
 */
export function loadWebGazer(cb?: () => void): void {
  if (wg()) { if (cb) cb(); return; }
  void daCacheVerificada().then((blob) => {
    if (!blob) { srAlert(t('sr.eyes.needsInternet')); return; }
    const endereco = URL.createObjectURL(blob);
    const s = document.createElement('script'); s.src = endereco; s.async = true;
    s.onload = () => { URL.revokeObjectURL(endereco); if (cb) cb(); };
    s.onerror = () => { URL.revokeObjectURL(endereco); srAlert(t('sr.eyes.loadFailed')); };
    document.head.appendChild(s);
  });
}
async function daCacheVerificada(): Promise<Blob | null> {
  const url = PESADOS.find((p) => p.id === 'visao:olhar')?.url;
  if (!url || typeof caches === 'undefined') return null;
  try {
    const resp = await (await caches.open(CACHE_PESADOS)).match(url);
    return resp ? await resp.blob() : null;
  } catch { return null; }
}
