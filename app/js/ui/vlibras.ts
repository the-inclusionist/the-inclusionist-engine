// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/vlibras.ts — MODO PESSOA SURDA (intérprete de Libras) — Estágio 4, Tier 1.
//
// DOIS DEFEITOS CONSERTADOS AQUI, e eles têm a mesma raiz.
//
// `librasOpen` era deduzido da GEOMETRIA do botão de acesso do VLibras: altura zero ou sem `offsetParent`
// significava "o painel está aberto". Isso funcionava enquanto o widget renderizava dentro do nosso
// `<div vw>`. Ele parou — hoje ele anexa `#vlibras-access-wrapper` direto no `<body>` —, e o que sobrou no
// nosso markup é um div VAZIO, de 747×0. Altura zero. Então o detector respondia "aberto" para sempre:
//
//   1. o layout reservava 380px à direita para um intérprete inexistente e empurrava o jogo para fora da
//      tela (medido: canvas em `left: -136`);
//   2. o toggle não desligava, porque mandava um evento de fechar a um widget que não estava ali.
//
// (É a mesma raiz da falha do gate axe-core, consertada em 0657578: o VLibras mudou de lugar e três coisas
// que o localizavam pelo nosso markup pararam juntas, em silêncio.)
//
// O ESTADO AGORA É NOSSO. `librasOpen` é uma escolha da pessoa, persistida, e não a leitura de um retângulo
// de terceiro. Um modo de acessibilidade cujo estado é inferido da geometria de outra biblioteca é um modo
// que desliga sozinho quando essa biblioteca muda — e quem paga é quem depende dele.
//
// O QUE AINDA NÃO É: o Dev decidiu que o intérprete deve aparecer NA FRENTE da tela quando um áudio toca e
// sumir depois, sem clicar em nada e sem depender de clicar em textos. O widget do VLibras não faz isso (é um
// painel encaixado, que traduz o texto do elemento clicado), então essa é a razão de o pilar 2 do ADR-0010
// prever um motor próprio em zdog. Este arquivo para de empurrar a tela e passa a ter um toggle honesto; o
// intérprete sob demanda é trabalho à parte.
import { t } from '../core/i18n.js';
import * as store from '../platform/storage.js';

/** Estado do modo pessoa surda. Escolha da PESSOA, persistida — não inferência sobre um widget de terceiro. */
export let librasOpen = store.getBool('incl_libras', false);

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
/** O modo pessoa surda está ligado? Lê o NOSSO estado — nunca mais a geometria do widget. */
export function vlibrasOpen(): boolean { return librasOpen; }

/** Liga/desliga o modo pessoa surda. Um toggle de verdade: o estado é nosso, então ele sempre alterna. */
export function toggleLibras(): void {
  librasOpen = !librasOpen; _vlOpen = librasOpen;
  store.setBool('incl_libras', librasOpen);
  // Tentativa BEST-EFFORT de acordar o widget do VLibras, se ele estiver carregado. Falhar aqui não pode
  // impedir o modo de ligar: o estado é a escolha da pessoa, o widget é só um tradutor possível para ela.
  const b = vwBtn();
  if (librasOpen && b) { try { b.click(); } catch (e) { /* noop */ } }
  else if (!librasOpen) { try { window.dispatchEvent(new CustomEvent('vp-widget-close')); } catch (e) { /* noop */ } }
  _onLibrasChange();
  if (librasOpen) vlibrasSay(t('sr.libras.on'));
}

/** Mantido para o laço do jogo, que o chama a cada quadro. Já não decide nada — o estado é nosso. */
export function vlTick(): void { _vlOpen = librasOpen; }
