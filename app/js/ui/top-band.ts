// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/top-band.ts — QUANTO ESPAÇO A ENGINE GUARDA PARA SI NO TOPO DA TELA (ADR-0148 §3, errata de 2026-09-13; issue #160).
//
// A engine desenha coisas por cima do jogo — a barra de acessibilidade, o nome do ícone apontado, as duas colunas do HUD e
// a ficha da varredura — e o jogo tem de saber quanto do topo não é dele. Este módulo mede o que está lá e escreve duas
// variáveis na região: `--barra-a11y-h`, que é a faixa inteira, e `--scan-top`, que é onde a ficha se pousa.
//
// 📌 SAIU DA RAIZ EM 2026-09-22 (ADR-0221 passo 7c.1). 📏 Era a pior função não-raiz do `boot/create-game`: **26 nós de
// decisão em 57 linhas**, contra o tecto de 10 por função. E não é fiação — é uma conta, que é justamente o que uma raiz de
// composição não deve ter (Seemann; Fowler): uma raiz é grande porque liga muita coisa, não porque decide.
//
// ⚠️ RECEBE OS NÓS E O MEDIDOR, e nunca alcança um global: o alcance global deste módulo é ZERO (passo 7d), e é isso que
// permite medi-lo num documento que não é o do navegador.
//
// 🔴 A ORDEM DAS DUAS ESCRITAS É A DECISÃO, e a primeira versão errou-a: a ficha é posta por `--scan-top`, que NÃO depende
// dela; só a faixa depende. Pô-la pela faixa que ela própria faz crescer criava um laço — a ficha empurrava a faixa, a
// faixa empurrava a ficha, e ela descia a tela a cada medição. ⚠️ E o comentário que registava isso dizia que um caso o
// tinha apanhado: medido em 22/09, nenhum apanhava, porque um laço é invisível a uma medição só. O caso que o prende agora
// mede a ficha, deixa a varredura andar três passos — que é o que remede a faixa no uso real — e exige o mesmo lugar.

/** O que este módulo precisa de ver para medir. Tudo injectado: o módulo não alcança `document` nem `window`. */
export interface TopBandCtx {
  /** A região do jogo, onde as duas variáveis são escritas. Ausente: não há onde escrever, e não se escreve. */
  readonly region: HTMLElement | null;
  /** A barra de acessibilidade. ⚠️ Ausente = faixa ZERO: não há nada para reservar, e reservar mesmo assim tirava ao jogo
   *  a primeira linha da tela — 12% da altura a 640×360. */
  readonly bar: HTMLElement | null;
  /** As duas colunas do HUD (ADR-0175), quando montadas. */
  readonly hud: { readonly left: HTMLElement; readonly right: HTMLElement } | null;
  /** `getComputedStyle`, injectado. Ausente num documento que não o tem, e aí a linha do nome não é medida. */
  readonly computedStyle?: (el: HTMLElement) => CSSStyleDeclaration;
}

/** Um quarto da base da escala, resolvido PELA FOLHA através de uma sonda, para a regra ter uma casa só. */
function breathingRoom(region: HTMLElement, fallback: number): number {
  const probe = region.ownerDocument.createElement('div');
  // Um quarto do tamanho base da escala, e não do nome: uma face com piso mais alto faz crescer o TEXTO dela, não este
  // vão (#172). O `--espaco-fixo` é o que encolhe com o Ctrl −.
  probe.style.cssText = 'position:absolute;visibility:hidden;height:calc(var(--ui-fs,16px) / 4 * var(--espaco-fixo,1))';
  region.appendChild(probe);
  const h = probe.getBoundingClientRect().height || fallback;
  probe.remove();
  return h;
}

/**
 * A sala que a barra pede: o fundo dela, ou o fundo da linha do NOME do ícone apontado, mais um respiro.
 *
 * 📌 A linha do nome conta esteja ou não a mostrar um nome — reservar só enquanto se aponta moveria o jogo debaixo do dedo
 * da criança. 📏 Medido a 640×360: a variável dizia 44 px (só a barra) e o nome, a 57–87 px, cobria o enunciado do quiz.
 */
function barRoom(ctx: TopBandCtx, top: number): { room: number; breath: number } {
  const { region, bar, computedStyle } = ctx;
  if (!region || !bar || typeof bar.getBoundingClientRect !== 'function') return { room: 0, breath: 4 };
  let bottom = bar.getBoundingClientRect().bottom;
  let breath = 0;
  const name = bar.querySelector<HTMLElement>('.pause-icons-cap');
  if (name && computedStyle) {
    const cs = computedStyle(name);
    const fs = parseFloat(cs.fontSize) || 16;
    const line = (parseFloat(cs.lineHeight) || fs * 1.2) + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    bottom = name.getBoundingClientRect().top + line;
    breath = breathingRoom(region, fs / 4);
  }
  return { room: bottom - top + breath, breath };
}

/**
 * A sala que o HUD pede, e a largura que cada coluna aceita.
 *
 * 📌 Cada coluna é ESTREITADA para nunca alcançar a barra: sem isso um número comprido encosta nos ícones e a criança
 * deixa de conseguir apontar um deles.
 */
function hudRoom(ctx: TopBandCtx, top: number, breath: number, room: number): number {
  const { region, bar, hud } = ctx;
  if (!region || !hud) return room;
  const regionBox = region.getBoundingClientRect();
  const barBox = bar && typeof bar.getBoundingClientRect === 'function' ? bar.getBoundingClientRect() : null;
  const gap = Math.max(breath, 4);
  let out = room;
  if (!hud.left.hidden) {
    hud.left.style.maxWidth = barBox ? `${Math.max(0, Math.floor(barBox.left - regionBox.left - 2 * gap))}px` : '';
    out = Math.max(out, hud.left.getBoundingClientRect().bottom - top + gap);
  }
  if (!hud.right.hidden) {
    hud.right.style.maxWidth = barBox ? `${Math.max(0, Math.floor(regionBox.right - barBox.right - 2 * gap))}px` : '';
    out = Math.max(out, hud.right.getBoundingClientRect().bottom - top + gap);
  }
  return out;
}

/**
 * Mede o topo e escreve `--scan-top` e `--barra-a11y-h` na região.
 *
 * 🔴 A FICHA DA VARREDURA TOMA SALA PELA MESMA RAZÃO QUE A LINHA DO NOME (ADR-0218): ela é HUD, e HUD que não reserva o seu
 * espaço é a engine a escrever por cima do jogo — medido no quiz construído, onde «DIZER A RESPOSTA» caiu em cima do
 * enunciado. Mas ela é POSTA pelo `--scan-top`, escrito ANTES de ela engordar a sala; ver o laço no cabeçalho.
 */
export function reserveTopBand(ctx: TopBandCtx): void {
  const { region } = ctx;
  if (!region || typeof region.style?.setProperty !== 'function') return;
  const measures = typeof region.getBoundingClientRect === 'function';
  if (!measures) { region.style.setProperty('--barra-a11y-h', '0px'); return; }

  const top = region.getBoundingClientRect().top;
  const { room: barPart, breath } = barRoom(ctx, top);
  let room = hudRoom(ctx, top, breath, barPart);

  region.style.setProperty('--scan-top', `${Math.ceil(Math.max(0, room - breath))}px`);
  const chip = region.querySelector<HTMLElement>('.scan-now');
  if (chip && !chip.hidden) room = Math.max(0, room - breath) + chip.getBoundingClientRect().height + breath;
  region.style.setProperty('--barra-a11y-h', `${Math.ceil(room)}px`);
}
