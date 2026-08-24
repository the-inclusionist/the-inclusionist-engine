// SPDX-License-Identifier: GPL-3.0-or-later
// ui/vlibras.ts — integração com o intérprete VLibras (modo pessoa surda) — Estágio 4, Tier 1. Com o painel
// ABERTO, as narrações do jogo vão para o intérprete (o plugin traduz o TEXTO do elemento clicado → usamos um nó
// quase invisível e disparamos o clique; fila de 1, ~4s por fala). vlTick faz polling do estado do painel; ao
// abrir/fechar, reflui o layout via CALLBACK injetado (setOnLibrasChange) — evita acoplar a ui/vlibras ao ui/layout
// (que ainda não saiu). Importa srAlert de core/a11y-sr (a11y-sr NÃO importa daqui — a fala em Libras entra lá por
// injeção, sem ciclo). librasOpen (binding vivo) e LIBRAS_RESERVE são lidos pelo layout do game.js.
import { t } from '../core/i18n.js';
import { srAlert } from '../core/a11y-sr.js';

export const LIBRAS_RESERVE = 380; // px reservados p/ o painel do VLibras quando aberto (slot 5:9 à direita)
export let librasOpen = false;      // espelho VIVO do estado do painel (o vlTick atualiza; layout/__incl leem)

let _vlOpen = false, _vlNode: HTMLElement | null = null, _vlBusyUntil = 0, _vlNext: string | null = null;
let _onLibrasChange: () => void = () => { /* game.js registra o layout() */ };
// Registra o reflow (layout) a rodar quando o painel abre/fecha. Chamado no boot do game.js.
export function setOnLibrasChange(fn: () => void): void { _onLibrasChange = fn; }

// Fala em Libras: manda o texto ao intérprete (só quando o painel está aberto). Fila de 1 — fala nova substitui a pendente.
export function vlibrasSay(text: string): void {
  if (!_vlOpen || !text) return;
  const now = Date.now();
  if (now < _vlBusyUntil) { _vlNext = text; return; }
  _vlBusyUntil = now + 4000;
  if (!_vlNode) {
    _vlNode = document.createElement('span'); _vlNode.setAttribute('aria-hidden', 'true');
    _vlNode.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:.01;z-index:1;pointer-events:auto';
    document.body.appendChild(_vlNode);
  }
  _vlNode.textContent = text; try { _vlNode.click(); } catch (e) { /* noop */ }
  setTimeout(() => { const nx = _vlNext; _vlNext = null; _vlBusyUntil = 0; if (nx) vlibrasSay(nx); }, 4100);
}

const vwBtn = (): HTMLElement | null => document.querySelector<HTMLElement>('[vw-access-button]');
// Painel aberto? O botão de acesso do VLibras fica escondido/zerado quando o intérprete está aberto.
export function vlibrasOpen(): boolean { const b = vwBtn(); if (!b) return false; const r = b.getBoundingClientRect(); return r.width === 0 || r.height === 0 || b.offsetParent === null; }
// Liga/desliga o intérprete. Abre clicando o botão de acesso; fecha pelo evento oficial do widget (DOM/Unity na própria origem).
export function toggleLibras(): void {
  const b = vwBtn(); if (!b) { srAlert(t('sr.libras.loading')); return; }
  if (vlibrasOpen()) { try { window.dispatchEvent(new CustomEvent('vp-widget-close')); } catch (e) { /* noop */ } }
  else { try { b.click(); } catch (e) { /* noop */ } }
}
// Polling (250ms): detecta abrir/fechar → atualiza librasOpen, reflui o layout (callback) e anuncia ao ligar.
// _vlOpen guia o vlibrasSay (setado aqui p/ evitar TDZ de librasOpen no boot).
export function vlTick(): void {
  const o = vlibrasOpen(); _vlOpen = o;
  if (o !== librasOpen) { librasOpen = o; _onLibrasChange(); if (o) vlibrasSay('Tradução em Libras ligada.'); }
}
