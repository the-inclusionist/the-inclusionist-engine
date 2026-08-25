// SPDX-License-Identifier: AGPL-3.0-or-later
// core/a11y-sr.ts — anúncios para LEITOR DE TELA (Estágio 4, Tier 1). srSay = região aria-live "polite" (status);
// srAlert = região "assertive" (alertas). O padrão limpar→requestAnimationFrame→escrever força o leitor a
// reanunciar mesmo texto repetido. Também espelha a fala em LIBRAS: como ui/vlibras ainda não foi extraído, o
// vlibrasSay entra por INJEÇÃO (setVlibrasSay) — no-op até o game.js registrá-lo no boot (evita inverter a ordem
// do Tier 1). Depende só de ui/dom ($). As regiões #sr-status/#sr-alert vivem no index.html.
import { $ } from '../ui/dom.js';

let _vlibrasSay: (text: string) => void = () => { /* no-op até setVlibrasSay() */ };
// Registra a fala em Libras (chamado no boot do game.js, quando vlibrasSay existe). Ver ui/vlibras (futuro).
export function setVlibrasSay(fn: (text: string) => void): void { _vlibrasSay = fn; }

// Anúncio "polite" (status): não interrompe o que o leitor está falando.
export const srSay = (t: string): void => { const el = $('#sr-status'); if (el) { el.textContent = ''; requestAnimationFrame(() => { el.textContent = t; }); } _vlibrasSay(t); };
// Anúncio "assertive" (alerta): interrompe e fala já (erros/avisos importantes).
export const srAlert = (t: string): void => { const el = $('#sr-alert'); if (el) { el.textContent = ''; requestAnimationFrame(() => { el.textContent = t; }); } _vlibrasSay(t); };
