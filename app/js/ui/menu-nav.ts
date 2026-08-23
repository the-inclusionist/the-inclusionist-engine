// SPDX-License-Identifier: GPL-3.0-or-later
// ui/menu-nav.ts — NAVEGAÇÃO UNIVERSAL de menus e diálogos: andar, escolher e voltar sem mouse.
//
// Este módulo é acessibilidade pura, e é o coração do pilar de a11y no que diz respeito a operação por
// teclado (WCAG 2.1.1) e a ordem de foco (2.4.3). A regra que ele encarna é a do projeto, escrita no game.js
// antes de qualquer código: QUALQUER menu aberto — o de pausa OU um submenu de configuração — é navegável
// pelos MESMOS seis gestos, e esses seis gestos valem igualmente para teclado, controle, olhos e fala:
//   · cima/baixo/esquerda/direita — andam entre itens; nos `select`/`slider`, esquerda/direita AJUSTAM o valor
//   · sim   — confirma, alterna, entra
//   · não   — volta ao menu anterior; na raiz, volta ao jogo (= Continuar)
// Por isso o módulo não fala em "tecla": ele fala em INTENÇÃO (`NavKeys`). O teclado é só um dos tradutores —
// input/gamepad.ts monta exatamente o mesmo `{yes,no,up,down,left,right}` e chama `navDialog`/`navPause` daqui.
// É essa forma comum que faz "o jogo inteiro é operável de seis maneiras" ser verdade por construção e não por
// disciplina.
//
// O QUE VEIO, E DE ONDE (bloco "NAVEGAÇÃO UNIVERSAL de menus" do game.js)
//  · `sharedDialogOpen` · `menuItems` · `menuFocus` · `dialogBack` — a leitura do "onde estou" e o voltar.
//  · `navDialog` — andar dentro de um diálogo de configuração (o único lugar que ajusta select/slider).
//  · `pauseSetSel` · `navPause` — andar dentro de um menu de pausa, que NÃO usa foco do navegador e sim uma
//    classe de seleção própria (`.pm-sel`/`.pi-sel`), porque ele é desenhado dentro da tela do jogador.
//  · `menuNavKey` — o tradutor de teclado, em fase de CAPTURA.
//
// A DUPLICAÇÃO QUE ESTA EXTRAÇÃO CUROU
// `sharedDialogOpen` do game.js e `topVisibleOverlay` de ui/settings-panel.ts eram A MESMA FUNÇÃO escrita
// duas vezes: mesmo seletor de escopo (`#game-region .overlay`), mesmo filtro (`!hidden`), mesma ordenação
// estável por z-index efetivo, mesmo "vence o último". Conferi as duas linha a linha antes de unificar. Aqui
// `sharedDialogOpen` é um ALIAS de `ctx.topVisibleOverlay` — o nome antigo sobrevive porque input/gamepad.ts o
// consome por esse nome, mas o CÓDIGO agora existe uma vez só, em ui/settings-panel.ts. O ganho não é linha de
// menos: enquanto eram duas, uma correção de escopo (é justamente o que o defeito 1 abaixo pede) podia ser
// aplicada num lado e não no outro, e o sintoma seria "às vezes o foco volta".
//
// ======================= DOIS DEFEITOS CONHECIDOS — PRESERVADOS VERBATIM, NÃO CONSERTE =======================
//
// DEFEITO 1 — o escopo de `sharedDialogOpen` não alcança os menus de pausa (WCAG 2.4.3 · foco perdido).
// O escopo é `#game-region .overlay`. Os nove diálogos de configuração estão lá (o `inCanvasMenus()` do game.js
// reparenta os onze elementos para dentro do `#game-region`), MAS os menus de pausa por tela são
// `.screen-pause` — classe diferente, construída por ui/pause-icons.ts, e nunca `.overlay`. Consequência:
// `menuFocus(sharedDialogOpen())` devolve `null` quando o último diálogo se fecha, `menuFocus` sai pelo guarda
// de nulo, e o foco fica no botão que acabou de ficar `hidden` — o navegador o joga no `<body>`. Quem sofre são
// `#typo` (closeTypo) e `#help` (closeHelp), os dois únicos que devolvem o foco por esse caminho.
//
// O QUE EU VERIFIQUEI ANTES DE ESCREVER ISTO (a nota do coordenador estava certa, e a conclusão dela também):
// li os NOVE `close*` e o `app/index.html` inteiro, um por um. De todos os nove, só UM devolve o foco de fato:
//   · touchcfg  → `#opt-touchcfg`  — EXISTE (index.html, dentro do painel #movement). Funciona.
//   · options   → `#opt-controls`  — NÃO existe no index.html. No-op silencioso.
//   · movement  → `#opt-movement`  — NÃO existe. No-op.
//   · visual    → `#opt-visual`    — NÃO existe. No-op.
//   · audio     → `#opt-sound`     — NÃO existe. No-op.
//   · animation → `#opt-animation` — NÃO existe (o próprio game.js já anota isso na linha do `#animation-close`).
//   · empathy   → `#opt-empathy`   — NÃO existe. No-op.
//   · typo/help → `menuFocus(sharedDialogOpen())` — o caminho quebrado descrito acima.
// Os ids que EXISTEM no index.html com prefixo `opt-` são: opt-title, opt-mode, opt-telas, opt-letra, opt-facil,
// opt-altmove, opt-touchcfg, opt-eyes, opt-modocego, opt-tts, opt-onebtn, opt-wheelchair, opt-hearing,
// opt-captions. Nenhum `#opt-visual`/`#opt-sound`/`#opt-movement`/`#opt-controls`/`#opt-empathy`/`#opt-animation`
// — são ganchos para uma barra de botões que ainda não existe. Ou seja: NÃO é "sete certos e dois errados". É
// "um certo e oito quebrados, por duas causas diferentes" — e a causa dos oito (botão inexistente) não é a
// mesma dos dois (escopo do seletor). Quem consertar precisa saber disso, porque arrumar só o escopo deixa oito
// painéis ainda largando o foco.
//
// DEFEITO 2 — `menuNavKey` trata Escape como "voltar", em CAPTURA, com `stopPropagation()`, e resolve por
// z-index em vez de pela cadeia registrada. `addEventListener('keydown', menuNavKey, true)` roda ANTES do
// ouvinte principal do game.js (que é de BOLHA, na mesma janela); o `stopPropagation()` na fase de captura
// impede o evento de descer e, portanto, de voltar — o ouvinte de bolha nunca vê a tecla. Efeitos verificados
// lendo os dois ouvintes lado a lado:
//   (a) a cadeia `overlays.escapeTarget()` (ORDEM DE REGISTRO: options→movement→animation→visual→empathy→
//       audio→typo→touchcfg→help) é código morto com o jogo pausado. Quem decide é o topo da pilha de z-index.
//       O próprio game.js já anota isso ("MEDIDO no navegador") no ouvinte de bolha.
//   (b) `#help` e `#touchcfg` estão registrados SEM flag `isOpen` e por isso ficam fora da cadeia de Escape.
//       Enquanto a captura os cobrir por z-index, Escape os fecha; se alguém tirar o `stopPropagation()` ou a
//       fase de captura sem antes dar flag aos dois, a tecla cai no ouvinte de bolha e o
//       `if(Escape||Enter) togglePause()` de lá DESPAUSA O JOGO com o diálogo de Ajuda ainda aberto.
//       Ou seja: o comportamento correto de hoje depende de um `stopPropagation()`, não da cadeia — é uma rede
//       de segurança acidental, e é exatamente o que o conserto vai mexer.
//   (c) Escape é a MESMA intenção que "especial" do gamepad (`no`). Não há como distinguir "fechar diálogo" de
//       "voltar ao jogo" — na raiz do menu de pausa, `no` faz `setPhase('playing')`.
// `menuNavKey` é exportado por si só (e não só instalado) justamente para o teste poder dispará-lo sem depender
// de fase de propagação, e `attach()` existe para o game.js instalar exatamente como antes.
//
// Os testes de `menu-nav` PINAM os dois comportamentos ACIMA como estão hoje. Eles falham de propósito se
// alguém "melhorar" a região sem tratar o conserto inteiro — que é o ponto: o conserto futuro precisa da rede.
// ============================================================================================================
//
// O QUE FICOU DE FORA, E POR QUÊ
//  · `updateTitleLegend` foi para ui/shell.ts, não para cá. Ela não navega nada — não lê foco, não trata tecla,
//    não anda entre itens; pinta o rodapé de UMA tela (o título) e quem a chama é `setPhase('title')`. Trazê-la
//    obrigaria a casca a importar o módulo de navegação só para desenhar uma legenda.
//  · `padKind()` não veio para lugar nenhum: JÁ ESTÁ em `input/touch.ts` (Onda A), com corpo idêntico, e a
//    cópia do game.js não tem chamador nenhum. É código morto duplicado — apagar, não mover.
//  · `navTitle`/`titleButtons` são de ui/activities-menu.ts (menu inicial), já extraídos.
//  · A pilha de z-index, o registro de overlays e o fechar por id são de ui/settings-panel.ts. Este módulo
//    CONSOME (`topVisibleOverlay`, `closeById`) e não reimplementa.
//
// INJEÇÃO E ORDEM DE BOOT
//  · `phase` entra como binding vivo de core/state.ts (deixou de ser `let` do game.js na Fase 2) — mesmo
//    precedente de game/session.ts e input/touch.ts. O que AINDA é `let` do game.js entra por getter:
//    `vpPause` (`getPauseMenu(i)`), reatribuído por `buildGameHud`.
//  · `closePadWiz` é LAZY (`(save) => gamepadApi.closePadWiz(save)`): input/gamepad.ts é `const` do game.js e o
//    ctx DELE consome `sharedDialogOpen`/`navDialog`/`navPause` daqui. A dependência é mútua, e a única forma
//    de quebrar o ciclo sem reordenar o boot é ela ser resolvida na CHAMADA. Mesmo motivo para `isCapturing`
//    (ui/settings-controls.ts) e para `setPhase` (o envelope içado do game.js sobre ui/shell.ts).
//  · `actionOf`/`whichPlayer` entram já ligados a input/keyboard-runtime.ts, que é `const` declarado bem no
//    alto do game.js — mas entram como callback mesmo assim, porque o roteamento por jogador é dele e não daqui.
//
// SEM I/O NO IMPORT: o corpo do módulo só declara dados e funções puras. Todo efeito passa por `initMenuNav`.
//
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (C3).

import { phase } from '../core/state.js'; // binding vivo (fonte única de estado)

/* ===================== interfaces mínimas ===================== */

/** ui/dom.ts `$` — injetado; o módulo nunca alcança `document`. */
export type DomQuery = <T extends Element = Element>(sel: string) => T | null;

/** A intenção, não a tecla. MESMA forma que input/gamepad.ts monta (`NavKeys` de lá). */
export interface NavKeys { yes: boolean; no: boolean; up: boolean; down: boolean; left: boolean; right: boolean }

/** O que este módulo lê de um `KeyboardEvent`. */
export interface NavKeyEvent {
  code: string;
  preventDefault(): void;
  stopPropagation(): void;
}

// ---------------------------------------------------------------------------------------------------------
// PURO — a decisão de navegação, sem DOM. Testável no project `node`.
// ---------------------------------------------------------------------------------------------------------

/* As tabelas de tecla GENÉRICA (as que valem para qualquer jogador, mesmo sem remap). Viraram `Set` porque é
   o que elas sempre foram semanticamente — pertinência, não ordem — e porque um `Set` nomeado deixa a tabela
   auditável de fora (o teste importa a constante em vez de repetir os literais). Conteúdo VERBATIM. */
/** Confirma/entra. `NumpadEnter` conta aqui (mas NÃO pausa: ver o ouvinte de bolha do game.js). */
export const KEY_YES: ReadonlySet<string> = new Set(['Space', 'KeyJ', 'Enter', 'NumpadEnter']);
/** Volta. ⚠️ DEFEITO 2: `Escape` é a MESMA intenção que a ação "especial" do gamepad. Verbatim. */
export const KEY_NO: ReadonlySet<string> = new Set(['Escape']);
export const KEY_UP: ReadonlySet<string> = new Set(['ArrowUp', 'KeyW']);
export const KEY_DOWN: ReadonlySet<string> = new Set(['ArrowDown', 'KeyS']);
export const KEY_LEFT: ReadonlySet<string> = new Set(['ArrowLeft', 'KeyA']);
export const KEY_RIGHT: ReadonlySet<string> = new Set(['ArrowRight', 'KeyD']);

/**
 * Traduz (tecla física, ação remapeada do dono da tecla) → intenção. `act` é `null` quando a tecla não é de
 * nenhum jogador (tecla genérica). Verbatim das seis linhas de `menuNavKey`.
 */
export function menuKeyIntent(code: string, act: string | null): NavKeys {
  return {
    yes: KEY_YES.has(code) || act === 'jump',
    no: KEY_NO.has(code) || act === 'especial',
    up: KEY_UP.has(code) || act === 'up',
    down: KEY_DOWN.has(code) || act === 'down',
    left: KEY_LEFT.has(code) || act === 'left',
    right: KEY_RIGHT.has(code) || act === 'right',
  };
}

/** Alguma intenção foi expressa? Se não, a tecla NÃO é consumida (nem preventDefault, nem stopPropagation). */
export function hasIntent(k: NavKeys): boolean {
  return k.yes || k.no || k.up || k.down || k.left || k.right;
}

/** Anda um passo numa lista, sem dar a volta (o original nunca faz wrap em lista de itens). */
export function clampIndex(len: number, idx: number, delta: number): number {
  return Math.max(0, Math.min(len - 1, idx + delta));
}

/** `select` com esquerda/direita: um passo, SEM dar a volta. */
export function selectStep(selectedIndex: number, optionsLen: number, delta: number): number {
  return Math.max(0, Math.min(optionsLen - 1, selectedIndex + delta));
}

/** `select` com "sim": um passo, COM volta. É a diferença deliberada entre confirmar e ajustar. */
export function selectWrap(selectedIndex: number, optionsLen: number): number {
  return (selectedIndex + 1) % optionsLen;
}

/** `input[type=range]` com esquerda/direita: um `step` (default 1), preso entre `min` e `max`. */
export function rangeStep(value: number, min: number, max: number, step: number, delta: number): number {
  const st = step || 1; // `+cur.step||1`: step ausente/0/NaN vira 1, verbatim
  return Math.max(min, Math.min(max, value + delta * st));
}

/** Onde está o cursor do menu de pausa: na barra de ícones de a11y, ou na lista de itens. */
export type PauseZone = 'icons' | 'items';
export interface PauseCursor { zone: PauseZone; index: number }

/** A lista de itens do menu de pausa é uma GRADE de 2 colunas — cima/baixo pulam de linha, não de item. */
export const PAUSE_COLS = 2;

/**
 * O movimento do cursor no menu de pausa, incluindo a FRONTEIRA entre a barra de ícones (horizontal, uma
 * linha) e a lista de itens (grade de `cols` colunas). Verbatim de `navPause`, e é aqui que mora a regra de
 * acessibilidade que mais se quebra sem ninguém ver:
 *   · da barra de ícones, "baixo" cai no PRIMEIRO item (Continuar) — nunca no item alinhado por coluna;
 *   · da barra de ícones, "cima" NÃO sai (fica onde está) — não há nada acima;
 *   · da PRIMEIRA LINHA de itens (`index < cols`), "cima" sobe para a barra, no ícone de MESMO índice, preso
 *     ao último ícone se a barra for mais curta; se não houver ícone nenhum, "cima" vira um passo de linha.
 * `yes`/`no` não chegam aqui (o chamador os trata antes). Índice negativo entra como 0, como no original.
 */
export function pauseGridMove(cur: PauseCursor, k: NavKeys, iconsLen: number, itemsLen: number, cols = PAUSE_COLS): PauseCursor {
  let idx = cur.index < 0 ? 0 : cur.index;
  if (cur.zone === 'icons') {
    if (k.left) idx = Math.max(0, idx - 1);
    else if (k.right) idx = Math.min(iconsLen - 1, idx + 1);
    else if (k.down) return { zone: 'items', index: 0 }; // desce da barra → menu (Continuar)
    return { zone: 'icons', index: idx };                // "cima" na barra: fica
  }
  if (k.up) {
    if (idx < cols && iconsLen) return { zone: 'icons', index: Math.min(idx, iconsLen - 1) }; // 1ª linha → barra
    idx = Math.max(0, idx - cols);
  } else if (k.down) idx = Math.min(itemsLen - 1, idx + cols);
  else if (k.left) idx = Math.max(0, idx - 1);
  else if (k.right) idx = Math.min(itemsLen - 1, idx + 1);
  return { zone: 'items', index: idx };
}

// ---------------------------------------------------------------------------------------------------------
// ctx / api
// ---------------------------------------------------------------------------------------------------------

export interface MenuNavCtx {
  /** ui/dom.ts `$` — só para achar `#padwiz`. */
  $: DomQuery;
  /** `document.activeElement` — injetado para o teste node poder simular foco sem DOM. */
  getActiveElement: () => Element | null;

  /* --- ui/settings-panel.ts: a pilha de overlays. NÃO reimplementar nada disto aqui. --- */
  /** O overlay VISÍVEL de z-index mais alto dentro de `#game-region`. É o `sharedDialogOpen` original. */
  topVisibleOverlay: () => HTMLElement | null;
  /** `overlays.closeById(id)` — true se havia entrada registrada para aquele diálogo. */
  closeById: (id: string) => boolean;

  /* --- o que o game.js AINDA reatribui: getter --- */
  /** `vpPause[i]` — o menu de pausa da tela do jogador `i`. `buildGameHud` REATRIBUI a array. */
  getPauseMenu: (playerIndex: number) => HTMLElement | null | undefined;

  /* --- vizinhos, todos LAZY (ver o cabeçalho: o ciclo com input/gamepad.ts) --- */
  /** ui/shell.ts via o envelope içado do game.js. `no` na raiz do menu de pausa volta ao jogo. */
  setPhase: (p: 'title' | 'playing' | 'paused') => void;
  /** `let pauseActor` do game.js: "sim" no menu de pausa marca QUEM agiu (o submenu abre na aba dele).
   *  ui/pause-icons.ts já recebe o mesmo setter — o `let` continua sendo do game.js, com seis leitores. */
  setPauseActor: (playerIndex: number) => void;
  /** ui/settings-controls.ts: um remap em andamento consome a tecla — o menu não pode roubá-la. */
  isCapturing: () => boolean;
  /** input/gamepad.ts: o assistente de mapeamento fica POR CIMA de tudo; só Escape (cancela) o alcança. */
  closePadWiz: (save: boolean) => void;
  /** input/keyboard-runtime.ts: de quem é esta tecla? (-1 = genérica). */
  whichPlayer: (code: string) => number;
  /** input/keyboard-runtime.ts: que ação esta tecla é PARA aquele jogador (respeitando o remap)? */
  actionOf: (code: string, playerIndex: number) => string | null;
  /** `window` — só para `attach()` instalar o ouvinte em CAPTURA, exatamente como o game.js fazia. */
  win: { addEventListener(type: string, fn: (e: never) => void, capture: boolean): void };
}

export interface MenuNavApi {
  /** O overlay visível mais alto (alias de `topVisibleOverlay` — ver "a duplicação que esta extração curou"). */
  sharedDialogOpen: () => HTMLElement | null;
  /** Os controles NAVEGÁVEIS de um menu: habilitados E visíveis (`offsetParent !== null`). */
  menuItems: (menu: HTMLElement) => HTMLElement[];
  /** Foca o item atual (se já for um deles) ou o primeiro. Sai calado com `menu` nulo — ver o DEFEITO 1. */
  menuFocus: (menu: HTMLElement | null) => void;
  /** Fecha o diálogo e tenta devolver o foco ao que ficou por baixo. */
  dialogBack: (menu: HTMLElement) => void;
  /** Um passo de navegação DENTRO de um diálogo de configuração. */
  navDialog: (menu: HTMLElement, k: NavKeys) => void;
  /** Marca `el` como o item selecionado de `menu` e atualiza a legenda dos ícones. */
  pauseSetSel: (menu: HTMLElement, el: HTMLElement | null | undefined) => void;
  /** Um passo de navegação DENTRO de um menu de pausa (barra de ícones + grade de itens). */
  navPause: (menu: HTMLElement, playerIndex: number, k: NavKeys) => void;
  /** O tradutor de teclado. Exportado à parte para o teste disparar sem depender da fase de propagação. */
  menuNavKey: (e: NavKeyEvent) => void;
  /** Instala `menuNavKey` em CAPTURA na janela — verbatim do game.js. */
  attach: () => void;
}

/** Os controles que contam como "item navegável" de um menu. Verbatim do seletor do `menuItems`. */
const ITEM_SELECTOR = 'button:not([disabled]), select:not([disabled]), input[type=range]:not([disabled])';
/** Onde os itens moram: o card do diálogo (`.overlay__card`) ou o card da pausa (`.pause-card`). */
const CARD_SELECTOR = '.overlay__card, .pause-card';

export function initMenuNav(ctx: MenuNavCtx): MenuNavApi {
  /* ===================== diálogos de configuração ===================== */

  // ALIAS, não cópia: o corpo mora em ui/settings-panel.ts. Ver "a duplicação que esta extração curou".
  const sharedDialogOpen = (): HTMLElement | null => ctx.topVisibleOverlay();

  function menuItems(menu: HTMLElement): HTMLElement[] {
    const card = menu.querySelector<HTMLElement>(CARD_SELECTOR) || menu;
    // `offsetParent === null` = fora do fluxo de layout (escondido, `display:none` ou dentro de aba oculta).
    // É o único filtro de VISIBILIDADE real que existe aqui: sem ele o cursor pousa em botão invisível e o
    // leitor de tela anuncia um controle que ninguém vê. Verbatim.
    return [...card.querySelectorAll<HTMLElement>(ITEM_SELECTOR)].filter((el) => el.offsetParent !== null);
  }

  function menuFocus(menu: HTMLElement | null): void {
    if (!menu) return; // ⚠️ DEFEITO 1: com os menus de pausa fora do escopo, este guarda é o fim da linha
    const it = menuItems(menu);
    if (!it.length) return;
    const cur = it.indexOf(ctx.getActiveElement() as HTMLElement);
    (cur >= 0 ? it[cur] : it[0]).focus();
  }

  function dialogBack(menu: HTMLElement): void {
    if (!ctx.closeById(menu.id)) menu.hidden = true; // sem entrada no registro: some na marra
    menuFocus(sharedDialogOpen());
  }

  /** Ajusta um `select` (esquerda/direita = passo preso; sim = passo com volta) e dispara `change`. */
  function tweakSelect(el: HTMLSelectElement, delta: number | 'wrap'): void {
    el.selectedIndex = delta === 'wrap' ? selectWrap(el.selectedIndex, el.options.length) : selectStep(el.selectedIndex, el.options.length, delta);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Ajusta um `input[type=range]` em um `step` e dispara `input` (é o evento que os painéis escutam). */
  function tweakRange(el: HTMLInputElement, delta: number): void {
    el.value = String(rangeStep(+el.value, +el.min, +el.max, +el.step, delta));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function navDialog(menu: HTMLElement, k: NavKeys): void {
    const items = menuItems(menu);
    if (!items.length) return;
    let idx = items.indexOf(ctx.getActiveElement() as HTMLElement);
    if (idx < 0) { idx = 0; items[0].focus(); } // foco fora do diálogo (ou no card): entra pelo primeiro
    const cur = items[idx];

    if (k.no) { dialogBack(menu); return; }

    if (k.left || k.right) {
      const d = k.right ? 1 : -1;
      if (cur.tagName === 'SELECT') { tweakSelect(cur as HTMLSelectElement, d); return; }
      if (cur.tagName === 'INPUT') { tweakRange(cur as HTMLInputElement, d); return; }
      items[clampIndex(items.length, idx, d)].focus();
      return;
    }

    if (k.up || k.down) { items[clampIndex(items.length, idx, k.down ? 1 : -1)].focus(); return; }

    if (k.yes) {
      if (cur.tagName === 'SELECT') { tweakSelect(cur as HTMLSelectElement, 'wrap'); return; }
      if (cur.tagName === 'INPUT') return; // slider não tem "confirmar" — só ajuste
      cur.click();
    }
  }

  /* ===================== menu de pausa (seleção por classe, não por foco) ===================== */

  function pauseSetSel(menu: HTMLElement, el: HTMLElement | null | undefined): void {
    if (!el) return; // índice fora da lista (barra vazia, menu vazio): não mexe em nada — verbatim
    menu.querySelectorAll<HTMLElement>('.pm-sel,.pi-sel').forEach((b) => b.classList.remove('pm-sel', 'pi-sel'));
    const isIcon = el.classList.contains('pi-btn');
    el.classList.add(isIcon ? 'pi-sel' : 'pm-sel');
    // A legenda `aria-live="polite"` narra o ícone sob o cursor — é ela que substitui, para quem não vê, o
    // `title`/tooltip que só o mouse revela. Item comum limpa a legenda (o rótulo já está no próprio botão).
    const cap = menu.querySelector<HTMLElement>('.pause-icons-cap');
    if (cap) cap.textContent = isIcon ? (el.getAttribute('aria-label') || '') : '';
  }

  function navPause(menu: HTMLElement, playerIndex: number, k: NavKeys): void {
    if (k.no) { ctx.setPhase('playing'); return; } // "não" na raiz → volta ao jogo (retoma todos)

    const icons = [...menu.querySelectorAll<HTMLElement>('.pi-btn')];
    const items = [...menu.querySelectorAll<HTMLElement>('.pm-btn')];
    const cur = menu.querySelector<HTMLElement>('.pi-sel') || menu.querySelector<HTMLElement>('.pm-sel') || items[0];

    // "sim": o jogador que agiu vira o `pauseActor` (o submenu de a11y abre na aba dele) e o item é clicado.
    if (k.yes) { ctx.setPauseActor(playerIndex); if (cur) cur.click(); return; }
    // Guarda NOVA (o original estouraria em `cur.classList` aqui): menu sem `.pm-btn` nenhum e sem ícone
    // selecionado. Não é o defeito preservado — é um TypeError, e trocar um crash por um no-op não tira rede
    // de conserto nenhum. Registrado por honestidade: é a única linha desta função que não é cópia literal.
    if (!cur) return;

    const zone: PauseZone = cur.classList.contains('pi-btn') ? 'icons' : 'items';
    const list = zone === 'icons' ? icons : items;
    const next = pauseGridMove({ zone, index: list.indexOf(cur) }, k, icons.length, items.length);
    pauseSetSel(menu, (next.zone === 'icons' ? icons : items)[next.index]);
  }

  /* ===================== teclado ===================== */

  /** O assistente de gamepad fica POR CIMA de tudo: com ele aberto, só Escape passa (e cancela). */
  function padWizKey(e: NavKeyEvent): boolean {
    const pw = ctx.$<HTMLElement>('#padwiz');
    if (!pw || pw.hidden) return false;
    if (e.code === 'Escape') { ctx.closePadWiz(false); e.preventDefault(); e.stopPropagation(); }
    return true; // aberto = consome (mesmo sem ser Escape: o resto do menu não navega por baixo dele)
  }

  function menuNavKey(e: NavKeyEvent): void {
    if (phase !== 'paused') return;
    if (ctx.isCapturing()) return;   // remap em andamento: a tecla é dele
    if (padWizKey(e)) return;

    const owner = ctx.whichPlayer(e.code);
    const pi = owner < 0 ? 0 : owner;                       // tecla genérica → Jogador 1
    const k = menuKeyIntent(e.code, owner >= 0 ? ctx.actionOf(e.code, pi) : null);
    if (!hasIntent(k)) return;

    // ⚠️ DEFEITO 2: em CAPTURA + stopPropagation, o ouvinte de bolha do game.js nunca vê esta tecla.
    e.preventDefault();
    e.stopPropagation();

    const dlg = sharedDialogOpen();
    if (dlg) { navDialog(dlg, k); return; }                 // diálogo de a11y aberto: navega ele (compartilhado)
    const menu = ctx.getPauseMenu(pi);                      // senão: menu de pausa do PRÓPRIO jogador
    if (menu && !menu.hidden) navPause(menu, pi, k);
  }

  function attach(): void {
    ctx.win.addEventListener('keydown', menuNavKey as (e: never) => void, true);
  }

  return { sharedDialogOpen, menuItems, menuFocus, dialogBack, navDialog, pauseSetSel, navPause, menuNavKey, attach };
}
