// SPDX-License-Identifier: AGPL-3.0-or-later
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
// Os ids que EXISTEM no index.html com prefixo `opt-` são: opt-title, opt-telas, opt-letra, opt-facil,
// opt-altmove, opt-touchcfg, opt-modocego, opt-tts, opt-onebtn, opt-wheelchair, opt-hearing,
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
//   (b) `#help` e `#touchcfg` estão registrados com `inEscapeChain:false` e por isso ficam fora da cadeia de Escape.
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

/* ===================== interfaces mínimas ===================== */

/** ui/dom.ts `$` — injetado; o módulo nunca alcança `document`. */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** A intenção, não a tecla. Definição única em input/edges; aqui só reexportada. */
import type { NavKeys } from '../input/edges.js';
export type { NavKeys } from '../input/edges.js';

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
    yes: KEY_YES.has(code) || act === 'action2',
    no: KEY_NO.has(code) || act === 'action3',
    up: KEY_UP.has(code) || act === 'up',
    down: KEY_DOWN.has(code) || act === 'down',
    left: KEY_LEFT.has(code) || act === 'left',
    right: KEY_RIGHT.has(code) || act === 'right',
  };
}

/** Alguma intenção foi expressa? Definição única em input/edges; aqui só o nome que este módulo sempre teve. */
import { hasNavIntent as hasIntent } from '../input/edges.js';
import type { EventTargetLike } from '../input/touch-bindings.js'; // a porta de escuta, genérica sobre WindowEventMap
import type { DomQuery } from '../core/dom-query.js';
import { mostrarSubmenuDaPausa, PM_ITENS_VISIVEIS } from './pause-icons.js';
import { anunciarItem } from './item-announcement.js';
import { accessibleLabel } from '../core/rotulo-acessivel.js';
import { stepInRing } from '../core/anel.js';
import { itensNavegaveis } from './menu-items.js';
import { t } from '../core/i18n.js';
export { hasNavIntent as hasIntent } from '../input/edges.js';

// A CONTA DO ANEL mudou de casa para `core/anel` no item 7 do ADR-0044: `ui/pause-icons` passou a precisar
// dela, e como ESTE módulo já importa aquele, a volta fecharia um ciclo de importação — que em ESM não
// estoura na hora, estoura no boot em TDZ. O nome público fica: é daqui que os menus e os testes já a
// importavam, e mudar isso seria pedir uma edição em cada um deles para não ganhar nada.
export { stepInRing } from '../core/anel.js';

/** `select` com esquerda/direita: um passo, SEM dar a volta — ajustar VALOR não é navegar lista (ver acima). */
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

/**
 * O PASSO DO CURSOR NO MENU DE PAUSA — um ANEL, agora que a pausa é uma lista (ADR-0044, itens 1 e 7).
 *
 * ISTO SUBSTITUI `pauseGridMove`, e a substituição é o desfecho do ADR-0044, não uma limpeza. O que havia
 * era uma GRADE de duas zonas — a barra de dez ícones em cima, a lista de itens em duas colunas embaixo — e
 * uma fronteira entre elas com quatro regras próprias ("de cima, 'baixo' cai sempre no primeiro item", "da
 * primeira linha, 'cima' sobe para o ícone de mesmo índice", …). Cada regra dessas era uma coisa a mais para
 * a criança descobrir sem ver, e nenhuma delas era descobrível: só se aprendia esbarrando.
 *
 * A XAG 106 permite laço para menu LINEAR e o PROÍBE para grade de duas dimensões — numa grade, dar a volta
 * teleporta o cursor para o outro canto e a pessoa perde a noção de onde está. Era por isso que o anel do
 * item 1 valia para todo menu do jogo MENOS este. Com a barra no HUD (item 7), o cartão passou a ter uma
 * lista só, e o laço deixou de ser proibido para virar o recomendado.
 *
 * O que se ganha em troca das quatro regras: `quit` fica a UMA tecla para CIMA de `resume`. Último na
 * leitura, vizinho no dedo.
 */
export function passoNaPausa(len: number, idx: number, k: NavKeys): number {
  const d = (k.down || k.right) ? 1 : -1;
  return stepInRing(len, idx < 0 ? 0 : idx, d);
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
  /**
   * ESTE É O MOMENTO DE NAVEGAR MENU? Se `false`, toda tecla passa direto.
   *
   * Era `if (phase !== 'paused') return`, com `phase` vindo por IMPORTAÇÃO de `core/state` — e o segundo
   * consumidor mostrou o preço (achado 10 de `consumer-quiz`): um quiz cujos ajustes estão SEMPRE disponíveis
   * precisava se declarar "pausado" para poder navegar os próprios menus. Não havia como trazer o próprio
   * modelo de fases, porque não havia por onde.
   *
   * A pergunta injetada é PROPOSITALMENTE um booleano, e não a fase. Injetar `getPhase()` teria consertado a
   * importação e mantido a mentira: o consumidor continuaria obrigado a devolver a string `'paused'`, que é
   * um conceito do jogo de plataforma. Perguntando "dá para navegar agora?", o jogo de plataforma responde
   * `phase === 'paused'` e um quiz responde `true` — cada um na sua língua, e nenhum dos dois mentindo.
   */
  isNavigable: () => boolean;
  /**
   * `core/a11y-sr.srSay` — a região `aria-live` "polite". INJETADO porque ela alcança o `document` na hora da
   * chamada, e este módulo não pode alcançar documento nenhum por conta própria.
   *
   * O menu de PAUSA precisa dela e os diálogos não: eles selecionam por FOCO, e o leitor de tela anuncia o
   * foco sozinho. A pausa seleciona por CLASSE (`.pm-sel`), porque é desenhada dentro da tela do jogador —
   * e classe nenhuma dispara anúncio. Sem esta injeção o menu é mudo para quem o navega por escuta.
   */
  srSay: (texto: string) => void;
  /**
   * O índice "N de M" está ligado? (ADR-0044, item 3, e a XAG 106 exige que ele possa ser desligado.)
   *
   * PERGUNTADO ao ctx e não lido de `core/state`, e o motivo é o mesmo do `isNavigable`: enquanto este módulo
   * importava `core/state`, um segundo jogo não tinha como trazer o próprio modelo — o quiz teve de se
   * declarar "pausado" para navegar os menus dele. `tests/menu-nav.node.test.js` reprova se a aresta voltar,
   * e ela quase voltou por aqui: eu tinha escrito o `import` antes de o gate me lembrar.
   */
  comIndice: () => boolean;
  /** Writes the reason of a locked pause item in the screen footer, or clears it with `null` (ADR-0161). Optional. */
  explicarItem?: (texto: string | null) => void;
  /**
   * A tela `i` está no modo `accessibility` (ADR-0044, item 7)? Perguntado ANTES de `isNavigable`, porque
   * esse modo roda com o jogo ANDANDO — é a única coisa deste módulo que age fora da pausa.
   */
  naBarraDe: (i: number) => boolean;
  /** Um passo dentro da barra rápida da tela `i`. */
  navBar: (i: number, k: NavKeys) => void;
  /** ui/settings-controls.ts: um remap em andamento consome a tecla — o menu não pode roubá-la. */
  isCapturing: () => boolean;
  /** input/gamepad.ts: o assistente de mapeamento fica POR CIMA de tudo; só Escape (cancela) o alcança. */
  closePadWiz: (save: boolean) => void;
  /** input/keyboard-runtime.ts: de quem é esta tecla? (-1 = genérica). */
  whichPlayer: (code: string) => number;
  /** input/keyboard-runtime.ts: que ação esta tecla é PARA aquele jogador (respeitando o remap)? */
  actionOf: (code: string, playerIndex: number) => string | null;
  /** `window` — só para `attach()` instalar o ouvinte em CAPTURA, exatamente como o game.js fazia. */
  /** A escuta de teclado dos menus. Ver `EventTargetLike` em input/touch-bindings. */
  win: EventTargetLike;
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

// O SELECTOR DOS ITENS mudou-se para `ui/menu-items` (ADR-0158): a numeração visível lê a MESMA lista, porque o número
// escrito tem de ser o do índice falado — duas cópias do selector eram como «2 de 7» e um «3» escrito divergiriam.
/**
 * As partes que um controle de painel DIZ (ADR-0159 regra 1, XAG 106: «Gamma, slider, 38%, 6 of 9»): o rótulo com o
 * PAPEL, e o VALOR. O índice junta-se no `anunciarItem`.
 *
 * O rótulo é o `<strong>` da linha quando o controle vive numa (é o que se VÊ, e o texto de um interruptor é o estado,
 * não o nome); fora de linha, ou num cursor com nome próprio («Volume de Música»), é o nome acessível.
 */
export function partesDoControle(el: HTMLElement): { rotulo: string; estado: string } {
  const forte = el.closest('.ctrl-row')?.querySelector('strong')?.textContent?.trim() || '';
  const nome = accessibleLabel(el);
  const com = (rotulo: string, papel: string): string => `${rotulo}, ${t(papel)}`;
  if (el.hasAttribute('data-passos')) {
    return { rotulo: com(el.getAttribute('aria-label') || forte, 'sr.papel.passos'), estado: el.getAttribute('aria-valuetext') ?? '' };
  }
  if (el.tagName === 'SELECT') {
    const s = el as HTMLSelectElement;
    return { rotulo: com(forte || nome, 'sr.papel.lista'), estado: s.selectedOptions?.[0]?.textContent?.trim() ?? '' };
  }
  if (el.tagName === 'INPUT') {
    const r = el as HTMLInputElement;
    const min = +r.min || 0, max = +r.max || 100;
    const pct = max > min ? Math.round(((+r.value - min) / (max - min)) * 100) : 0;
    return { rotulo: com(el.getAttribute('aria-label') || forte, 'sr.papel.cursor'), estado: `${pct}%` };
  }
  if (el.hasAttribute('aria-pressed')) {
    return { rotulo: com(forte || nome, 'sr.papel.interruptor'), estado: t(el.getAttribute('aria-pressed') === 'true' ? 'state.on' : 'state.off') };
  }
  if (el.getAttribute('role') === 'radio') {
    return { rotulo: com(forte || nome, 'sr.papel.opcao'), estado: el.getAttribute('aria-checked') === 'true' ? t('sr.estado.selecionado') : '' };
  }
  return { rotulo: com(nome, 'sr.papel.botao'), estado: '' };
}

/** Onde os itens moram: o card do diálogo (`.overlay__card`) ou o card da pausa (`.pause-card`). */
const CARD_SELECTOR = '.overlay__card, .pause-card';

export function initMenuNav(ctx: MenuNavCtx): MenuNavApi {
  /* ===================== diálogos de configuração ===================== */

  // ALIAS, não cópia: o corpo mora em ui/settings-panel.ts. Ver "a duplicação que esta extração curou".
  const sharedDialogOpen = (): HTMLElement | null => ctx.topVisibleOverlay();

  function menuItems(menu: HTMLElement): HTMLElement[] {
    const card = menu.querySelector<HTMLElement>(CARD_SELECTOR) || menu;
    // O filtro de VISIBILIDADE (`offsetParent`) mora com o selector em `ui/menu-items` — verbatim do que estava aqui.
    return itensNavegaveis(card);
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

  /**
   * O ITEM ALCANÇADO SE DIZ (ADR-0159 regra 1): rótulo, papel, valor e «N de M», nessa ordem.
   *
   * 🔴 Medido no `dist` em 2026-09-12: dentro de um painel o cursor andava e o `#sr-status` ficava calado — o índice
   * falado só existia no cartão de pausa. O foco do navegador move-se, mas a narração da engine (a de quem joga no
   * modo cego) não ouve foco; ouve isto.
   */
  function dizerItem(items: readonly HTMLElement[], n: number): void {
    const el = items[n];
    if (!el) return;
    const { rotulo, estado } = partesDoControle(el);
    ctx.srSay(anunciarItem({ rotulo, estado, posicao: n + 1, total: items.length }, ctx.comIndice()));
  }

  function focarEDizer(items: readonly HTMLElement[], n: number): void {
    items[n]?.focus();
    dizerItem(items, n);
  }

  function navDialog(menu: HTMLElement, k: NavKeys): void {
    const items = menuItems(menu);
    if (!items.length) return;
    let idx = items.indexOf(ctx.getActiveElement() as HTMLElement);
    if (idx < 0) { idx = 0; focarEDizer(items, 0); } // foco fora do diálogo (ou no card): entra pelo primeiro
    const cur = items[idx];

    if (k.no) { dialogBack(menu); return; }

    if (k.left || k.right) {
      const d = k.right ? 1 : -1;
      // o VALOR novo é dito: quem ajusta de ouvido não tem outra forma de saber onde parou
      if (cur.tagName === 'SELECT') {
        const antes = (cur as HTMLSelectElement).value;
        tweakSelect(cur as HTMLSelectElement, d);
        // an adjustment its owner refused (and put back) says nothing here: the owner already said why
        if ((cur as HTMLSelectElement).value !== antes) dizerItem(items, idx);
        return;
      }
      if (cur.tagName === 'INPUT') { tweakRange(cur as HTMLInputElement, d); dizerItem(items, idx); return; }
      // Os PASSOS ⯇ ⯈ (ADR-0151): esquerda e direita são o próprio ajuste, e quem o aplica ouve o `passo` (e anuncia).
      if (cur.hasAttribute('data-passos')) { cur.dispatchEvent(new CustomEvent('passo', { detail: d, bubbles: true })); return; }
      focarEDizer(items, stepInRing(items.length, idx, d));
      return;
    }

    if (k.up || k.down) { focarEDizer(items, stepInRing(items.length, idx, k.down ? 1 : -1)); return; }

    if (k.yes) {
      if (cur.tagName === 'SELECT') { tweakSelect(cur as HTMLSelectElement, 'wrap'); dizerItem(items, idx); return; }
      if (cur.tagName === 'INPUT') return; // slider não tem "confirmar" — só ajuste
      if (cur.hasAttribute('data-passos')) return; // os passos também não: «sim» num ajuste não significa nada
      cur.click();
    }
  }

  /* ===================== menu de pausa (seleção por classe, não por foco) ===================== */

  /**
   * Move o cursor do menu de pausa. Só ITENS: desde o item 7 do ADR-0044 a barra de ícones vive no HUD, e o
   * cursor dela é dela.
   *
   * O QUE SAIU DAQUI, e vale registrar: esta função também escrevia a legenda dos ícones, porque o cursor
   * atravessava a fronteira entre as duas zonas. Sem a fronteira, escrever legenda de ícone a partir do menu
   * de pausa seria um módulo mexendo na tela de outro.
   */
  function pauseSetSel(menu: HTMLElement, el: HTMLElement | null | undefined): void {
    if (!el) return; // índice fora da lista (menu vazio): não mexe em nada — verbatim
    menu.querySelectorAll<HTMLElement>('.pm-sel').forEach((b) => b.classList.remove('pm-sel'));
    el.classList.add('pm-sel');
  }

  function navPause(menu: HTMLElement, playerIndex: number, k: NavKeys): void {
    if (k.no) {
      // "não" DENTRO do submenu de opções volta à raiz, e não ao jogo (ADR-0044, item 5). A regra "voltar sai
      // um nível" já valia para os diálogos de configuração (`dialogBack`); o que mudou é que o menu de pausa
      // passou a TER um nível a mais. Sem esta linha, quem entra em Opções sem enxergar só sairia despausando.
      // ⚠️ ERA `=== 'opcoes'`, E COM TRÊS LISTAS ISSO PASSOU A SER O RAMO ERRADO. A pergunta certa nunca foi
      // «é a lista de opções?» — é «NÃO é a raiz?»: de qualquer submenu, «não» sobe UM nível (ADR-0044 item
      // 5). Escrita como estava, a lista nova do ADR-0146 caía no ramo de baixo e o «não» DESPAUSAVA o jogo a
      // partir dela, que é sair do jogo quando a criança pediu para voltar.
      const aberto = menu.querySelector<HTMLElement>('.pause-menu:not([hidden])');
      if (aberto && aberto.dataset.sub && aberto.dataset.sub !== 'raiz') { mostrarSubmenuDaPausa(menu, 'raiz'); return; }
      ctx.setPhase('playing'); return; // "não" na raiz → volta ao jogo (retoma todos)
    }

    const items = [...menu.querySelectorAll<HTMLElement>(PM_ITENS_VISIVEIS)];
    const cur = menu.querySelector<HTMLElement>('.pm-sel') || items[0];

    // "sim": o jogador que agiu vira o `pauseActor` (o submenu de a11y abre na aba dele) e o item é clicado.
    if (k.yes) { ctx.setPauseActor(playerIndex); if (cur) cur.click(); return; }
    // Guarda NOVA (o original estouraria em `cur.classList` aqui): menu sem `.pm-btn` nenhum. Não é o defeito
    // preservado — é um TypeError, e trocar um crash por um no-op não tira rede de conserto nenhum.
    if (!cur) return;

    // UMA LISTA, um anel. A barra de ícones saiu do cartão no item 7 do ADR-0044, e com ela saíram as quatro
    // regras de fronteira que ninguém conseguia descobrir sem esbarrar.
    const n = passoNaPausa(items.length, items.indexOf(cur), k);
    selecionarEDizerNaPausa(menu, items, n);
  }

  function selecionarEDizerNaPausa(menu: HTMLElement, items: readonly HTMLElement[], n: number): void {
    pauseSetSel(menu, items[n]);
    // E O ITEM NOVO É FALADO. Este menu não usa foco do navegador — seleciona por classe, porque é desenhado
    // dentro da tela do jogador —, então nada dispara anúncio sozinho: nem foco, nem `aria-activedescendant`,
    // nem região viva. MEDIDO no jogo construído: a seta andava e o `#sr-status` ficava vazio. O item 3 do
    // ADR-0044 pede posição e total "em todo lugar", e este era o lugar onde ele não tinha chegado — o menu
    // que o item 5 reconstruiu.
    // `accessibleLabel` e não `textContent`: um item com `aria-label` seria narrado de um jeito pelo jogo e de
    // outro pelo leitor de tela, e quem ouve os dois não teria como saber qual é a verdadeira.
    // 🔴 UM ITEM TRAVADO DIZ PORQUÊ ao ser alcançado (ADR-0161): dito a seguir ao nome, e escrito no rodapé.
    const motivo = items[n].getAttribute('aria-disabled') === 'true' ? (items[n].dataset.motivo ?? '') : '';
    const anuncio = anunciarItem({ rotulo: accessibleLabel(items[n]), posicao: n + 1, total: items.length }, ctx.comIndice());
    ctx.srSay(motivo ? `${anuncio}. ${motivo}` : anuncio);
    ctx.explicarItem?.(motivo || null);
  }

  /* ===================== teclado ===================== */

  /** O assistente de gamepad fica POR CIMA de tudo: com ele aberto, só Escape passa (e cancela). */
  function padWizKey(e: NavKeyEvent): boolean {
    const pw = ctx.$<HTMLElement>('#padwiz');
    if (!pw || pw.hidden) return false;
    if (e.code === 'Escape') { ctx.closePadWiz(false); e.preventDefault(); e.stopPropagation(); }
    return true; // aberto = consome (mesmo sem ser Escape: o resto do menu não navega por baixo dele)
  }

  /** Consome a tecla: ela era nossa, e ninguém mais deve vê-la. Uma função só para o par nunca se separar. */
  const consumir = (e: NavKeyEvent): void => { e.preventDefault(); e.stopPropagation(); };

  function menuNavKey(e: NavKeyEvent): void {
    if (ctx.isCapturing()) return;   // remap em andamento: a tecla é dele
    if (padWizKey(e)) return;

    // ===================== O MODO `accessibility` VEM ANTES DO GUARDA DE "NAVEGÁVEL" =====================
    // `isNavigable()` é `phase === 'paused'`, e este modo roda com o jogo ANDANDO — é para isso que ele
    // existe: ajustar a acessibilidade DURANTE a partida, sem parar. Se ele ficasse depois do guarda, a
    // direção cairia no personagem e o modo não faria nada, que é a versão silenciosa da armadilha.
    //
    // No TECLADO a saída é Escape (o `no` do projeto). O START do controle é a segunda saída e entra por
    // `input/gamepad`; aqui ele não tem par próprio, porque Enter já é "confirmar" e roubá-lo tiraria da
    // criança o único jeito de ATIVAR o ícone sob o cursor.
    const donoTecla = ctx.whichPlayer(e.code);
    const pTecla = donoTecla < 0 ? 0 : donoTecla;
    if (ctx.naBarraDe(pTecla)) {
      const kb = menuKeyIntent(e.code, donoTecla >= 0 ? ctx.actionOf(e.code, pTecla) : null);
      if (hasIntent(kb)) { consumir(e); ctx.navBar(pTecla, kb); }
      return; // na barra, tecla de menu é da barra — com ou sem intenção, não desce para o personagem
    }

    if (!ctx.isNavigable()) return;

    const owner = ctx.whichPlayer(e.code);
    const pi = owner < 0 ? 0 : owner;                       // tecla genérica → Jogador 1
    const k = menuKeyIntent(e.code, owner >= 0 ? ctx.actionOf(e.code, pi) : null);
    if (!hasIntent(k)) return;

    // A TECLA SÓ É CONSUMIDA SE HOUVER O QUE NAVEGAR. Antes, `preventDefault()` + `stopPropagation()` vinham
    // AQUI, antes de se saber se havia diálogo ou menu aberto — e o `menuNavKey` matava o evento para depois
    // descobrir que não tinha nada a fazer com ele. Na plataforma isso era invisível: `isNavigable()` é
    // `phase === 'paused'`, e pausar ABRE o menu, então quase nunca havia um caso "navegável e nada aberto".
    //
    // No segundo consumidor não era invisível — era total. Um quiz cujos ajustes estão SEMPRE disponíveis
    // responde `isNavigable(): true`, e com isso TODA tecla com intenção de menu morria aqui: as setas de
    // escolher alternativa, e o `S` do sonar. Duas funcionalidades que existiam e não chegavam à criança.
    //
    // A REDE DE SEGURANÇA DO ESCAPE FICA INTACTA, e era o risco real desta mudança. O bloco (b) acima explica
    // que `#help` e `#touchcfg` dependem do `stopPropagation()` para não deixarem a tecla cair no ouvinte de
    // bolha, que despausaria o jogo com o diálogo aberto. Esses dois casos entram por `sharedDialogOpen()`
    // — há diálogo, logo a tecla É consumida, exatamente como antes.
    const dlg = sharedDialogOpen();
    if (dlg) { consumir(e); navDialog(dlg, k); return; }    // diálogo de a11y aberto: navega ele (compartilhado)
    const menu = ctx.getPauseMenu(pi);                      // senão: menu de pausa do PRÓPRIO jogador
    if (menu && !menu.hidden) { consumir(e); navPause(menu, pi, k); }
    // Sem diálogo e sem menu: a tecla NÃO é nossa. Segue o caminho dela até quem for o dono.
  }

  /* ===================== segurar sobre um item ===================== */

  /*
   * A PRESS HELD ON AN ITEM PLACES THE CURSOR THERE AND SAYS IT, WITHOUT ACTIVATING IT (ADR-0159 rule 2, erratum of
   * 2026-09-13). «Deixar o dedo apertado ou o botão do mouse apertado sobre o item deve dar a função de posicionar o
   * cursor sem "apertar".» (Dev) — the pad left the menus (ADR-0166), and a pointer had one meaning only: activation.
   * 📌 A short press is untouched; after a hold, the ONE click the browser fires on release is swallowed, in capture,
   * before the item's own listener. Threshold: the iOS long-press default, 0.5 s.
   */
  const SEGURAR_MS = 500;
  let segurando: { id: number; timer: ReturnType<typeof setTimeout> } | null = null;
  let engolirClique: HTMLElement | null = null;

  /** The open menu and the item under `alvo`, when `alvo` is inside one: the top dialog first, else a pause card. */
  function itemSob(alvo: EventTarget | null): { menu: HTMLElement; items: HTMLElement[]; n: number; pausa: boolean } | null {
    const no = alvo as HTMLElement | null;
    if (!no || typeof no.closest !== 'function') return null;
    const dlg = sharedDialogOpen();
    if (dlg) {
      const items = menuItems(dlg);
      const n = items.findIndex((el) => el.contains(no));
      return n >= 0 ? { menu: dlg, items, n, pausa: false } : null;
    }
    const menu = no.closest<HTMLElement>('.screen-pause');
    if (!menu || menu.hidden) return null;
    const items = [...menu.querySelectorAll<HTMLElement>(PM_ITENS_VISIVEIS)];
    const n = items.findIndex((el) => el.contains(no));
    return n >= 0 ? { menu, items, n, pausa: true } : null;
  }

  function soltar(): void {
    if (segurando) clearTimeout(segurando.timer);
    segurando = null;
  }

  function aoPremir(e: PointerEvent): void {
    soltar();
    engolirClique = null;
    const sob = itemSob(e.target);
    if (!sob) return;
    const id = e.pointerId;
    segurando = {
      id,
      timer: setTimeout(() => {
        segurando = null;
        engolirClique = sob.items[sob.n] ?? null;
        if (sob.pausa) selecionarEDizerNaPausa(sob.menu, sob.items, sob.n);
        else focarEDizer(sob.items, sob.n);
      }, SEGURAR_MS),
    };
  }

  function aoSoltar(e: PointerEvent): void {
    if (segurando && segurando.id === e.pointerId) soltar();
  }

  function aoClicar(e: MouseEvent): void {
    const alvo = engolirClique;
    engolirClique = null;
    if (alvo && e.target instanceof Node && alvo.contains(e.target)) { e.preventDefault(); e.stopPropagation(); }
  }

  function attach(): void {
    ctx.win.addEventListener('keydown', menuNavKey, true);
    ctx.win.addEventListener('pointerdown', aoPremir, true);
    ctx.win.addEventListener('pointerup', aoSoltar, true);
    ctx.win.addEventListener('pointercancel', aoSoltar, true);
    ctx.win.addEventListener('click', aoClicar, true);
  }

  return { sharedDialogOpen, menuItems, menuFocus, dialogBack, navDialog, pauseSetSel, navPause, menuNavKey, attach };
}
