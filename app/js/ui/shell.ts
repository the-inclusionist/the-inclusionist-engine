// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/shell.ts — A CASCA: em que TELA o jogo está, e o que a tela liga e desliga ao trocar.
//
// Este módulo responde a UMA pergunta: "estamos no título, jogando ou pausados — e o que isso significa para o
// documento?". Ele é o irmão de cima de tudo o que já saiu: game/session.ts decide o que é uma RODADA,
// render/draw.ts decide o que é um QUADRO, e aqui se decide o que é uma TELA. Nada aqui sabe de física, de
// moeda ou de pixel; tudo aqui sabe de `hidden`, de foco, de mudo e do menu de pausa.
//
// O QUE VEIO, E DE ONDE (bloco "E14: shell — título/splash + pausa" do game.js)
//  · `setPhase(p)`        — a reação de UI à troca de fase. O VALOR continua em core/state.ts (setPhaseValue);
//                           o que mora aqui é só a consequência visível.
//  · `pauseActs`          — a tabela de ações dos `.pm-btn` do menu de pausa (por tela).
//  · `pauseSelect()`      — põe o 1º item (Continuar) selecionado em cada tela de pausa.
//  · `printMode()`        — esconde as pausas para ver a tela limpa; qualquer botão volta.
//  · `togglePause()`      — jogando ⇄ pausado.
//  · `updateTitleLegend()`— a legenda de dispositivo do splash (2 linhas de "chips": movimento/pausa e os 4
//                           botões de ação, com o que está CONFIGURADO para o Jogador 1).
//
// POR QUE `setPhase` NÃO VIROU UMA MÁQUINA DE ESTADOS COM TABELA DE TRANSIÇÃO — E O QUE VIROU NO LUGAR
// O pedido do projeto era transformar a sequência de `if`s numa máquina de estados de verdade. Olhei e a
// resposta honesta é: metade sim, metade não, e a metade que vale não é a que o nome sugere.
//   · NÃO vale a tabela de transição. São TRÊS estados e as nove transições são todas legais — de qualquer
//     fase para qualquer fase, sem guarda, sem evento nomeado, sem hook de entrada/saída além do corpo que já
//     está aqui. Uma `Map<[from,to], handler>` sobre isso não impede nenhum estado ilegal (não existe nenhum),
//     não descreve nada que o código já não diga, e troca um bloco linear que se lê de cima a baixo por uma
//     indireção que obriga a saltar. Seria cerimônia sobre três estados. Não fiz.
//   · VALE, e muito, separar a DECISÃO do EFEITO. Os `if`s do original não são transições: são nove perguntas
//     diferentes feitas à MESMA fase (`p!=='playing'`, `p!=='title'`, `p!=='paused'`, `p==='paused'`…),
//     espalhadas no meio de nove escritas no DOM. Isso é uma PROJEÇÃO pura da fase disfarçada de sequência
//     imperativa. Extraí a projeção — `phaseView(p)` devolve o registro completo do que a fase manda fazer, e
//     `applyPhaseView` é a única parte que toca o documento. O ganho é concreto e não é estético: a decisão
//     passa a ser testável no project `node`, sem DOM, sem PIXI e sem áudio, e um erro de sinal num `!==`
//     (o tipo de erro que aqui deixa a11y quebrada em silêncio: overlay do título visível durante o jogo,
//     áudio não silenciado na pausa) vira uma asserção em vez de um sintoma que só aparece jogando.
//     É o mesmo movimento que ui/title.ts já fez com `computeTitleMenuView`, e por isso é o precedente da casa.
//   · O único pedaço com MEMÓRIA (e portanto o único candidato legítimo a "estado") é a restauração dos
//     controles de toque, que depende do `dataset.wasOn` gravado na pausa anterior. Esse virou
//     `touchControlsPlan(...)`, uma função pura de (fase, wasOn, escondido, nº de telas) → (escondido', wasOn').
//     Ver, logo abaixo, o defeito que essa separação tornou visível.
//
// O QUE FICOU DE FORA, E POR QUÊ
//  · `fpsTick` — a fronteira listava, mas ele não é casca: é instrumentação de HUD (escreve `#hud-fps` e
//    `#hud-fpsmin`), tem três contadores próprios de módulo e é chamado do laço a cada quadro, não na troca de
//    tela. Trazê-lo para cá acoplaria o "em que tela estamos" ao "quantos quadros por segundo" sem nenhum
//    parentesco. O precedente da casa já é esse: ui/layout.ts diz, no cabeçalho, "fpsTick/configureRender
//    seguem no game.js (outro concern)". Não forcei; segue no game.js, e o lar natural dele, quando chegar a
//    vez, é ui/hud.ts.
//  · `padKind()` — não extraído: não tinha chamador, e a cópia de `input/touch.ts` também foi apagada em
//    2026-09-24, pela mesma razão (nota CE).
//  · `updateTitleLegend()` — a fronteira deixava em aberto se ela é de shell ou de menu-nav. É de SHELL, e a
//    razão é simples: ela não navega nada. Não lê foco, não trata tecla, não anda entre itens; ela pinta o
//    rodapé de UMA tela específica (o título) com a configuração de entrada vigente, e quem a chama é o
//    próprio `setPhase('title')`. Se morasse em ui/menu-nav, a casca precisaria importar o módulo de
//    navegação só para desenhar uma legenda, e a dependência apontaria para o lado errado (a casca chamando o
//    teclado). Ficando aqui, ui/menu-nav não precisa saber que existe uma tela de título.
//  · O `.pm-btn`/`.pi-btn` (markup e delegação de clique) é de ui/pause-icons.ts, que já os constrói e já
//    consome esta tabela por `getPauseActs()`. Aqui está só a TABELA, não o botão.
//  · Abrir/fechar os nove diálogos de configuração é de ui/settings-panel.ts + ui/settings-*.ts. `pauseActs`
//    apenas os CHAMA, por injeção.
//
// INJEÇÃO E ORDEM DE BOOT (a armadilha desta etapa)
//   · `phase` e `numPlayers` NÃO entram por getter, e isso é de propósito: eles deixaram de ser `let` do
//     game.js na Fase 2 e hoje são bindings vivos de core/state.ts. Importá-los direto é exatamente o que
//     game/session.ts e input/touch.ts já fazem — um getter aqui seria uma indireção sobre uma indireção.
//     Quem AINDA é `let` do game.js entra por getter: `vpPause` (reatribuído por `buildGameHud`) e
//     `pauseActor` (reatribuído por seis lugares, incluindo o ctx do gamepad).
//   · TODA entrada de `pauseActs` é um callback, e não um valor, porque `initShell` precisa poder ser chamado
//     no lugar do bloco E14 (linha ~1373 do game.js) enquanto quase tudo o que a tabela chama — `openTypo`,
//     `openAudio`, `openMovement`, `openVisual`, `openHelp`, `quitGame`, `fitsN`, `joinPlayer` — são
//     `function` içadas OU `const` declarados depois (`motor`, `motion`, `empathy`, `hud`, `selVizPlayer`).
//     Com callbacks, a resolução acontece na CHAMADA (sempre pós-boot) e não na montagem do ctx.
//   · `setPhase` é chamado de fora por game/session.ts, input/gamepad.ts, game/attract.ts e
//     ui/activities-menu.ts, todos com o ctx montado ANTES do ponto de extração. Por isso o game.js deve
//     manter um envelope `function setPhase(p){ shell.setPhase(p); }` — declaração de função, içada — em vez
//     de trocar as quatro fiações. É o mesmo padrão já usado lá para `hideTouchControls`, `showTouchControls`,
//     `restartGame`, `fitsN`, `joinPlayer` e `quitGame`.
//   · O original protegia duas chamadas com `typeof pauseSelect==='function'` / `typeof reflectPauseIcons===
//     'function'`. Eram guardas de TDZ do tempo do monólito; aqui `pauseSelect` é função local (sempre
//     definida) e `reflectPauseIcons` é injetada (sempre função). Verifiquei que `reflectPauseIcons` é `const`
//     declarado no game.js MUITO antes de a primeira pausa acontecer, então as guardas nunca foram falsas em
//     execução real — removê-las não muda comportamento, só tira ruído. Registrado aqui porque é a única
//     linha que não é cópia literal.
//
// SEM I/O NO IMPORT: o corpo do módulo só declara dados e funções puras. Todo efeito passa por `initShell`.
// GUARDAS: cada consulta ao DOM passa por guarda de nulo, como manda a casa — é o que permite rodar no project
// `node` com um `$` falso que devolve `null`.
//
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (C3).

import { t } from '../core/i18n.js';
import type { PlayerView } from '../core/entity.js';

import { PAD_DESIGNS, PAD_GLYPH_SPOKEN } from '../input/devices.js'; // módulo-folha de DADOS (zero deps) — importado, não injetado
import type { DomQuery } from '../core/dom-query.js';
import type { PadMap } from '../input/pad-reading.js';
import type { SceneFacts } from '../core/scenes.js';
// UMA constante, e não um seletor repetido: com o submenu de opções (ADR-0044, item 5) o cartão de pausa passou
// a ter DUAS listas, e quem varrer `.pm-btn` cru enxerga também a que está escondida.
import { PM_VISIBLE_ITEMS } from './pause-icons.js';

/* ===================== interfaces mínimas ===================== */

/** ui/dom.ts `$` — injetado para o teste node poder passar um DOM falso. */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** O que `pauseActs.addplayer` lê de um jogador. `players` é `unknown[]` em core/state.ts. */
/** A casca só precisa saber QUEM é o jogador e se ele está esperando a próxima rodada. */
type ShellPlayer = PlayerView<'i' | 'waiting'>;

/** O subconjunto de `Window` que `printMode` usa (add/remove de ouvinte em CAPTURA + o adiamento de 80ms). */
export interface ShellWindow {
  addEventListener(type: string, fn: (e: Event) => void, capture: boolean): void;
  removeEventListener(type: string, fn: (e: Event) => void, capture: boolean): void;
  setTimeout(fn: () => void, ms: number): unknown;
}

/** Uma tela de pausa (`.screen-pause`) — só o que a casca toca. */
export interface PauseScreen {
  hidden: boolean;
  querySelectorAll<T extends Element = Element>(sel: string): ArrayLike<T> & Iterable<T>;
}

/** Um gamepad, do jeito mínimo que a legenda do título lê. */
interface PadLike { index: number; id: string; mapping: string }

// ---------------------------------------------------------------------------------------------------------
// PROJEÇÃO PURA — a decisão de fase, sem DOM. Testável no project `node`.
// ---------------------------------------------------------------------------------------------------------

// (`PHASES` SAIU em 2026-08-26. A casca não sabe mais QUANTAS cenas existem nem como se chamam — ver
//  `SceneFacts`, logo abaixo. Quem enumera as cenas deste jogo é a raiz de composição.)

/** Para onde o foco vai ao ENTRAR na fase. `null` = ninguém foca nada (não existe hoje; é o default seguro). */
export type PhaseFocus = 'game-region' | 'pause-menu' | 'title-button';

/**
 * O que a fase `p` manda o documento fazer. É a sequência de `if`s do `setPhase` original lida como o que ela
 * sempre foi: uma projeção da fase. Nenhum campo depende de histórico — o único que dependeria
 * (`#touch-controls`) mora em `touchControlsPlan`, separado de propósito.
 */
export type { SceneFacts } from '../core/scenes.js'; // reexportado: os consumidores da casca já o pediam daqui

export interface PhaseView {
  /** `#title-overlay`.hidden — o splash só aparece no título. */
  titleOverlayHidden: boolean;
  /**
   * ⚠️ `pauseOverlayHidden` SAIU EM 2026-09-08, e a ausência é a notícia.
   *
   * Ele era `true` em toda fase, e existia porque a Etapa 2 aposentou a pausa GLOBAL sem apagar o elemento: a
   * casca continuava a procurá-lo e a escondê-lo a cada troca de fase, com dois gates a afirmar que ele ficava
   * escondido. Código a segurar um cadáver.
   *
   * E o cadáver custava mais do que as linhas: aquelas quarenta linhas de `#pause-overlay` no `index.html` do
   * cartucho eram o menu de pausa com aspecto mais OFICIAL do repositório — o que o próximo autor de cartucho
   * copia junto com o ficheiro —, e já tinham derivado do que a engine gera (dois itens «Comunicação», e um
   * `#opt-letra` que hoje sai do `dynLabel`). Um campo que diz «está escondido» aceita que ele exista; não o
   * ter diz que ele não existe.
   */
  /** `.screen-pause`.hidden de CADA tela — os menus por tela só aparecem na pausa. */
  screenPauseHidden: boolean;
  /** `setMasterMuted(...)` — GAG: fora de 'playing' TODO o som cala (loops de ambiente/chuva inclusive). */
  masterMuted: boolean;
  /** `hideTouchControls()` — menu ativo (título/pausa) = sem controle virtual. */
  hideTouchControls: boolean;
  /**
   * `aria-pressed` do botão de pausa — ele diz ao leitor de tela SE está pausado.
   *
   * O alvo era `#btn-pause`, e esse id NUNCA existiu no documento: o botão saiu da barra e a fiação ficou
   * "guardada p/ compat". A linha que escrevia o atributo era morta, e o teste do navegador não pegava porque
   * o FIXTURE inventava o elemento — um caso que provava que o código escreve num botão que só o teste tem.
   *
   * O alvo agora é `#touch-start`, que é o botão que existe, o que o Dev clica e o ÚNICO caminho de pausa num
   * tablet (não há teclado no Positivo da issue #8).
   */
  pausePressed: boolean;
  /** Quem recebe o foco ao entrar nesta fase. */
  focus: PhaseFocus;
}

// `SceneFacts` mora em `core/scenes`, ao lado da pilha que os produz — é tipo de ENGINE, e precisa ser
// alcançável também por `game/`, que não pode importar de `ui/`. Ver o cabeçalho de lá.

/** Verbatim das nove perguntas que o `setPhase` do game.js fazia à fase, agora feitas de uma vez só. */
export function phaseView(f: SceneFacts): PhaseView {
  return {
    titleOverlayHidden: !f.titleScreen,
    screenPauseHidden: !f.pauseMenu,
    masterMuted: !f.worldRunning,
    hideTouchControls: !f.worldRunning,
    pausePressed: f.pauseMenu,
    focus: f.worldRunning ? 'game-region' : f.pauseMenu ? 'pause-menu' : 'title-button',
  };
}

/** O estado de `#touch-controls` que interessa: escondido? e havia controle ligado antes da pausa? */
export interface TouchControlsState {
  /** `tc.hidden`. */
  hidden: boolean;
  /** `tc.dataset.wasOn === '1'`. Ausente/qualquer outro valor = false, como no original. */
  wasOn: boolean;
}

/**
 * O ÚNICO pedaço de `setPhase` com memória: esconder os controles de toque ao pausar (guardando que estavam
 * ligados) e devolvê-los ao retomar. Pura, e por isso pinável sem navegador.
 *
 * O estado que chega aqui é o de ANTES de `hideTouchControls()` — quem chama lê primeiro e esconde depois.
 * Já foi o contrário, e o efeito era que `wasOn` nunca era gravado (o plano via o pad como se já estivesse
 * desligado): pausar no celular sumia com o direcional virtual e retomar não o devolvia.
 */
export function touchControlsPlan(f: SceneFacts, st: TouchControlsState, screens: number): TouchControlsState {
  if (f.pauseMenu) {
    if (!st.hidden) return { hidden: true, wasOn: true }; // guarda que estava ligado e esconde
    return st;                                            // já escondido: nada muda (nem `wasOn`)
  }
  if (f.worldRunning) {
    return { hidden: st.wasOn && screens <= 1 ? false : st.hidden, wasOn: false };
  }
  return { hidden: true, wasOn: false }; // título (ou qualquer cena que não seja jogo nem pausa): some e esquece
}

// ---------------------------------------------------------------------------------------------------------
// LEGENDA DO TÍTULO — a parte pura (montar as duas linhas de chips a partir dos glifos escolhidos)
// ---------------------------------------------------------------------------------------------------------

/** Um "chip" da legenda: o glifo (com cor de fundo opcional) seguido da palavra que ele significa. */
export function chip(txt: string, col: string | null, word?: string): string {
  return `<span class="lg"><span class="lg-ico"${col ? ` style="background:${col}"` : ''}>${txt}</span>${word ? ' ' + word : ''}</span>`;
}

/**
 * O nome FALADO de um glifo de controle. Glifo que já se lê passa intocado.
 *
 * Ver `PAD_GLYPH_SPOKEN` em `input/devices`: a tabela guarda CHAVES e não texto, porque ela é uma `const` de
 * módulo avaliada uma vez no import — texto já resolvido congelaria o idioma no boot. Quem resolve é aqui, a
 * cada chamada, com o idioma vigente naquele instante.
 */
export function spokenGlyph(g: string): string {
  const k = PAD_GLYPH_SPOKEN[g];
  return k ? t(k) : g;
}

/**
 * A LEGENDA DA PAUSA — duas camadas no mesmo lugar (ADR-0044, item 4).
 *
 * Ela dizia qual botão confirma e qual volta, e carregava `aria-hidden="true"` — ou seja, era invisível
 * justamente para quem não pode ver o glifo. A XAG 106 manda narrar exatamente isto ("A to Select").
 *
 * Mas só tirar o atributo devolveria o ruído que provavelmente o motivou: um leitor de tela lê `✕` como
 * "sinal de multiplicação". Então os CHIPS ficam visíveis e mudos, e ao lado nasce UMA frase só para leitor
 * de tela, com os glifos já traduzidos em palavra. Duas leituras da mesma informação, cada uma no sentido
 * que a alcança.
 *
 * Takes the `[glyph, colour]` pairs of the pad's design by position: yes is the south button (A · ✕ · B) and no the east one
 * (B · ◯ · A) on every design — no design swaps them (the Dev's association, ADR-0013 erratum).
 */
export function pauseLegendHtml(sim: readonly [string, string], nao: readonly [string, string]): string {
  const silentLegend = (g: readonly [string, string], palavra: string): string =>
    `<span class="lg" aria-hidden="true"><span class="lg-ico" style="background:${g[1]}">${g[0]}</span> ${palavra}</span>`;
  const falada = t('menu.legendSpoken', { sim: spokenGlyph(sim[0]), nao: spokenGlyph(nao[0]) });
  return silentLegend(sim, t('menu.yes')) + silentLegend(nao, t('menu.no')) + `<span class="sr-only">${falada}</span>`;
}

/** Os quatro botões de ação, na ordem fixa da legenda: pular · especial · correr · trocar. */
export interface ActionGlyphs {
  action2: readonly [string, string | null];
  action3: readonly [string, string | null];
  action1: readonly [string, string | null];
  action4: readonly [string, string | null];
}

/**
 * Linha 1 da legenda: direcional + START/Enter. Igual para toque e gamepad; o teclado sobrescreve os rótulos.
 *
 * As palavras vêm de `legend.*` e são resolvidas AQUI, a cada chamada — não numa tabela de módulo, que
 * congelaria o idioma no boot. Registro CURTO de propósito: esta fileira fica embaixo de um glifo e não tem
 * largura para o "Correr / interagir" que a lista de mapeamento usa (ver a nota em pt.ts).
 */
export function legendRow1(dirTxt: string, pauseTxt: string): string {
  return chip(dirTxt, null, t('legend.move')) + chip(pauseTxt, null, t('legend.pause'));
}

/**
 * Linha 2 da legenda: os botões de ação, na ordem dos glifos.
 *
 * ⚠️ AS PALAVRAS DEIXARAM DE ESTAR AQUI. Esta função dizia `t('legend.jump')`, `t('legend.run')` — o
 * vocabulário da plataforma dentro de um módulo de engine, e a engine a afirmar que todo jogo tem pular,
 * especial, correr e trocar, nessa ordem. Agora `rotulo` é perguntado ao jogo (a versão CURTA, ver
 * `ActionWord.short`), e uma posição que o jogo não nomeia não vira ficha nenhuma.
 */
export function legendRow2(g: ActionGlyphs, rotulo: (acao: string) => string | null): string {
  const GLYPH_ORDER: readonly (keyof ActionGlyphs)[] = ['action2', 'action3', 'action1', 'action4'];
  return GLYPH_ORDER.map((a) => {
    const palavra = rotulo(a);
    return palavra ? chip(g[a][0], g[a][1], palavra) : '';
  }).join('');
}

/** O innerHTML final de `#title-legend`: duas `.lg-row`. */
export function legendHtml(l1: string, l2: string): string {
  return `<span class="lg-row">${l1}</span><span class="lg-row">${l2}</span>`;
}

/**
 * Glifos de um pad FÍSICO. `layout` sai de `padLayoutFromId` (só quando `mapping === 'standard'`; fora do
 * padrão é sempre 'generic'), e `custom` é o mapa do assistente (só consultado FORA do padrão). Verbatim:
 * um botão sem entrada no mapa custom cai no índice default ('0'..'3'), e um índice que o design não conhece
 * vira o par `[índice, '#3a4a6a']` — o cinza de fallback.
 */
export function padActionGlyphs(layout: string, custom: PadMap | null): ActionGlyphs {
  const set = PAD_DESIGNS[layout] || PAD_DESIGNS.generic;
  // O `typeof b === 'object'` não é cerimônia: o `PadMap` admite `boolean` além de `PadBinding` — é o
  // sentinela `_skip: true` do assistente de mapeamento. As quatro chaves lidas aqui nunca são ele, então
  // em execução nada muda; o que muda é que a leitura passa a PERGUNTAR em vez de supor.
  const bOf = (k: string, def: string): string => {
    const b = custom && custom[k];
    return b && typeof b === 'object' && typeof b.b === 'number' ? String(b.b) : def;
  };
  const gy = (k: string): readonly [string, string | null] => (set[k] as [string, string] | undefined) || [k, '#3a4a6a'];
  return { action2: gy(bOf('action2', '0')), action3: gy(bOf('action3', '1')), action1: gy(bOf('action1', '2')), action4: gy(bOf('action4', '3')) };
}

/** Glifos do joystick VIRTUAL (toque): sempre o design 'generic' (0/1/2/3), sem mapa custom. */
export function touchActionGlyphs(): ActionGlyphs {
  return padActionGlyphs('generic', null);
}

/**
 * Escolhe QUAL gamepad a legenda descreve: o do Jogador 1, se ele tiver um associado (`players[0].pad`);
 * senão o primeiro conectado. Verbatim do laço do game.js — inclusive o detalhe de que, com `p1pad >= 0` e
 * nenhum pad daquele índice presente, o resultado é `null` (a legenda cai no teclado) em vez de pegar outro.
 */
export function pickLegendPad(pads: readonly (PadLike | null)[], p1pad: number): PadLike | null {
  let gp: PadLike | null = null;
  for (const g of pads) {
    if (!g) continue;
    if (p1pad >= 0) { if (g.index === p1pad) { gp = g; break; } } else if (!gp) gp = g;
  }
  return gp;
}

// ---------------------------------------------------------------------------------------------------------
// ctx / api
// ---------------------------------------------------------------------------------------------------------

export interface ShellCtx {
  /** Os três fatos da cena do TOPO, perguntados a cada uso — a raiz é quem tem a pilha e quem nomeia as
   *  cenas. Getter, e não valor: a casca projeta o estado ATUAL, não o do momento em que foi ligada. */
  fatosDaCena: () => SceneFacts;
  /** VOLTAR AO JOGO. É o que o "Continuar" do menu de pausa faz, e o que a entrada de um jogador novo faz.
   *  Era `setPhase('playing')` daqui mesmo — mas empilhar é da raiz, e "retomar" é o que a casca quer dizer. */
  retomarJogo: () => void;
  /** Quantos jogadores/telas. Estado de RODADA (ADR-0038): vem da instância que a raiz possui.
   *  Era `numPlayers`, um `let` de `core/state` importado como binding vivo — e um `let` de módulo
   *  é compartilhado por qualquer segundo jogo que a mesma página carregue (D13 do `demos`). */
  getNumPlayers: () => number;
  /** Os jogadores. Estado de RODADA, pelo mesmo motivo. `readonly unknown[]` porque cada consumidor
   *  estreita para a SUA fatia — o tipo real é do jogo, não da engine (ADR-0033). */
  getPlayers: () => readonly unknown[];
  /* --- DOM e plataforma --- */
  /** ui/dom.ts `$`. Injetado: o módulo nunca alcança `document`. */
  $: DomQuery;
  /** `window` — só para os dois ouvintes em CAPTURA do modo Print e o adiamento de 80ms. */
  win: ShellWindow;
  /** platform/audio.ts `setMasterMuted` — o nó mestre que cala TUDO na pausa/título (GAG). */
  setMasterMuted: (muted: boolean) => void;
  /** core/a11y-sr `srSay` (educado) e `srAlert` (assertivo). */
  srSay: (msg: string) => void;
  srAlert: (msg: string) => void;

  /* --- o que o game.js AINDA reatribui: getters --- */
  /** `let vpPause` — `buildGameHud` REATRIBUI a array a cada troca de nº de telas. */
  getPauseScreens: () => PauseScreen[];
  /** `let pauseActor` — quem abriu o menu; os submenus de a11y escopam no jogador dele. */
  getPauseActor: () => number;

  /* --- efeitos vizinhos (todos `const`/`function` do game.js; entram como callback) --- */
  /** input/touch.ts via o envelope içado do game.js: some com o direcional virtual. */
  hideTouchControls: () => void;
  /** ui/pause-icons.ts: reflete os `.pi-btn` de todas as telas (estado de a11y). */
  reflectPauseIcons: () => void;

  /* --- legenda do título --- */
  /** Adaptador da Gamepad API — mesmo padrão de input/gamepad.ts (é o que a torna testável sem navegador). */
  getGamepads: () => readonly (PadLike | null)[];
  /** `document.body.classList.contains('touch-mode')` — injetado para não alcançar `document`. */
  isTouchMode: () => boolean;
  /** input/touch.ts `padLayoutFromId` — id do controle → design de botões. */
  padLayoutFromId: (id: string) => string;
  /** input/gamepad.ts `padMapFor` — mapa do assistente para aquele modelo (só usado FORA do padrão). */
  /** O mapa do controle. `PadMap` vem de `input/gamepad`, que é dono dele — a versão escrita aqui,
   *  `Record<string, { b?: number }>`, era uma aproximação: perdia o `boolean` que o mapa admite. */
  padMapFor: (id: string) => PadMap | null;
  /** input/keyboard-runtime.ts `kbFor(i)` — as teclas CONFIGURADAS do jogador `i` (remap respeitado). */
  kbFor: (i: number) => Record<string, string[]>;
  /** ui/settings-controls.ts `keyName` — `KeyboardEvent.code` → rótulo humano. */
  keyName: (code: string) => string;
  /**
   * A palavra CURTA desta posição, na língua do jogo. `null` = o jogo não a usa.
   *
   * ⚠️ Curta e não a longa: a legenda põe a palavra debaixo de um glifo, numa fileira de quatro, e não tem
   * largura para o «Correr / interagir» que a lista de remapeamento usa. A distinção já estava no dicionário
   * (`legend.*` contra `act.*`) e agora atravessa a fronteira COM as palavras — ver `ActionWord.short`.
   */
  rotuloCurto: (acao: string) => string | null;

  /* --- as ações do menu de pausa (cada uma é um callback: TDZ, ver o cabeçalho) --- */
  /** `setQuizLevel(n, announce)` — o ciclo 1..5 do nível de alfabetização. */
  setQuizLevel: (n: number, announce: boolean) => void;
  /** `quizLevel` de core/state.ts — lido para calcular o próximo do ciclo. */
  getQuizLevel: () => number;
  openTypo: () => void;
  openAudio: () => void;
  openMovement: () => void;
  openVisual: () => void;
  openHelp: () => void;
  quitGame: () => void;
  /** game/session.ts: cabe mais uma tela nesta janela? */
  fitsN: (n: number) => boolean;
  /** game/session.ts: cria/ativa o jogador seguinte; `null` = sem pad associado ainda. */
  joinPlayer: (padIdx: number | null) => boolean;
  /** ui/hud.ts: crachá "aperte um botão para entrar" na tela do jogador novo. */
  showWaitingBadge: (i: number) => void;
  /** ui/settings-mobility.ts: escopa o painel Movimento no jogador que abriu. */
  setMotorPlayer: (i: number) => void;
  /** ui/settings-motion.ts `setSelectedPlayer`: idem para o painel Animação. */
  setMotionPlayer: (i: number) => void;
  /** ui/settings-motion.ts `motion.open`. */
  openMotion: () => void;
  /** Abre o menu de Comunicação Aumentada e Alternativa (ui/settings-caa). */
  openCaa: () => void;
  /** ui/settings-empathy.ts `empathy.open`. */
  openEmpathy: () => void;
  /** `let selVizPlayer` do game.js — escopa Visual e Empatia no jogador que abriu. */
  setSelVizPlayer: (i: number) => void;
}

/** A tabela de ações dos `.pm-btn`. Chave = `data-act` do botão (PM_BTNS, de ui/activities-menu.ts). */
export type PauseActs = Record<string, () => void>;

export interface ShellApi {
  /** Projeta no documento a cena que está no topo da pilha AGORA. A raiz chama depois de empilhar/desempilhar.
   *  (Era `setPhase(p)`: a casca gravava o valor E projetava. Empilhar é da raiz — ela é quem nomeia as cenas.) */
  aplicarCena: () => void;
  /** Põe o 1º `.pm-btn` (Continuar) selecionado em CADA tela de pausa. */
  pauseSelect: () => void;
  /** Modo Print: esconde as pausas para ver a tela limpa; qualquer tecla/clique as traz de volta. */
  printMode: () => void;
  /** Repinta `#title-legend` com o dispositivo e o mapeamento vigentes do Jogador 1. */
  updateTitleLegend: () => void;
  /** A tabela de ações do menu de pausa — consumida por ui/pause-icons.ts (`getPauseActs`). */
  pauseActs: PauseActs;
}

export function initShell(ctx: ShellCtx): ShellApi {
  /* ===================== a legenda do título ===================== */

  /** Linha 1+2 quando não há toque nem gamepad: as teclas REALMENTE configuradas do Jogador 1. */
  function keyboardLegend(): [string, string] {
    const m = ctx.kbFor(0);
    const K = (a: string): string => ctx.keyName((m[a] || [])[0] || '?');
    const l1 = legendRow1(`${K('up')} ${K('left')} ${K('down')} ${K('right')}`, 'Enter');
    const l2 = legendRow2({ action2: [K('action2'), null], action3: [K('action3'), null], action1: [K('action1'), null], action4: [K('action4'), null] }, ctx.rotuloCurto);
    return [l1, l2];
  }

  function updateTitleLegend(): void {
    const el = ctx.$<HTMLElement>('#title-legend');
    if (!el) return; // 2 ROWS, com o que está CONFIGURADO p/ o jogador da tela
    let l1: string, l2: string;
    if (ctx.isTouchMode()) {                       // joystick VIRTUAL: 0/1/2/3 + START
      l1 = legendRow1('✜', 'START');
      l2 = legendRow2(touchActionGlyphs(), ctx.rotuloCurto);
    } else {
      const p0 = ctx.getPlayers()[0] as { pad?: number } | undefined;
      const p1pad = p0 && typeof p0.pad === 'number' && p0.pad >= 0 ? p0.pad : -1;
      const gp = pickLegendPad(ctx.getGamepads(), p1pad);
      if (gp) {                                    // joystick FÍSICO: design do modelo + mapa custom do wizard
        const layout = gp.mapping === 'standard' ? ctx.padLayoutFromId(gp.id) : 'generic';
        const custom = gp.mapping !== 'standard' ? ctx.padMapFor(gp.id) : null;
        l1 = legendRow1('✜', 'START');
        l2 = legendRow2(padActionGlyphs(layout, custom), ctx.rotuloCurto);
      } else {
        [l1, l2] = keyboardLegend();               // TECLADO: teclas configuradas (remap respeitado)
      }
    }
    el.innerHTML = legendHtml(l1, l2);
    const w = ctx.$<HTMLElement>('#title-wait');
    if (w) w.hidden = ctx.getNumPlayers() <= 1;             // MP: aviso "Aguarde o Jogador 1"
  }

  /* ===================== seleção e Print ===================== */

  function pauseSelect(): void {
    ctx.getPauseScreens().forEach((sp) => {
      const items = [...sp.querySelectorAll<HTMLElement>(PM_VISIBLE_ITEMS)];
      items.forEach((b) => b.classList.remove('pm-sel'));
      if (items[0]) items[0].classList.add('pm-sel'); // 1º item (Continuar) selecionado em cada tela
    });
  }

  function printMode(): void {
    ctx.getPauseScreens().forEach((sp) => { sp.hidden = true; }); // vê a tela limpa; qualquer botão volta
    const back = (e?: Event): void => {
      if (e && e.preventDefault) { try { e.preventDefault(); } catch { /* noop */ } }
      ctx.win.removeEventListener('keydown', back, true);
      ctx.win.removeEventListener('pointerdown', back, true);
      if (ctx.fatosDaCena().pauseMenu) { ctx.getPauseScreens().forEach((sp) => { sp.hidden = false; }); pauseSelect(); }
    };
    // 80ms de atraso: o próprio evento que ACIONOU o Print não pode ser o que o desfaz.
    ctx.win.setTimeout(() => {
      ctx.win.addEventListener('keydown', back, true);
      ctx.win.addEventListener('pointerdown', back, true);
    }, 80);
    ctx.srSay(t('sr.print.on'));
  }

  /* ===================== a troca de fase ===================== */

  /** A metade IMPURA: pega a projeção pronta e a carimba no documento. */
  function applyPhaseView(v: PhaseView): void {
    // A pausa GLOBAL não é procurada: ela foi aposentada na Etapa 2, e a casca deixou de a segurar em
    // 2026-09-08. Ver a nota no `PhaseView`, onde o campo estava.
    const t = ctx.$<HTMLElement>('#title-overlay');
    if (t) t.hidden = v.titleOverlayHidden;
    ctx.getPauseScreens().forEach((sp) => { sp.hidden = v.screenPauseHidden; });
  }

  /** O estado do `#touch-controls` ANTES de qualquer coisa desta troca de fase mexer nele. */
  function readTouchControls(): TouchControlsState | null {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    return tc ? { hidden: tc.hidden, wasOn: tc.dataset.wasOn === '1' } : null;
  }

  /** A metade IMPURA do plano de toque: recebe o estado lido ANTES do hide e grava o plano de volta. */
  function applyTouchControls(f: SceneFacts, before: TouchControlsState | null): void {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (!tc || !before) return;
    const after = touchControlsPlan(f, before, ctx.getNumPlayers());
    // Só escreve o que MUDOU — é o que torna o applier equivalente linha a linha ao original (que, no ramo
    // 'paused' já-escondido, não toca em nada; e cujos `delete` nos outros ramos são no-op quando não havia flag).
    if (after.hidden !== before.hidden) tc.hidden = after.hidden;
    if (after.wasOn !== before.wasOn) { if (after.wasOn) tc.dataset.wasOn = '1'; else delete tc.dataset.wasOn; }
  }

  function applyFocus(f: PhaseFocus): void {
    if (f === 'game-region') { const gr = ctx.$<HTMLElement>('#game-region'); if (gr) gr.focus(); return; }
    if (f === 'pause-menu') { pauseSelect(); ctx.reflectPauseIcons(); return; }
    updateTitleLegend();
    const b = ctx.$<HTMLElement>('#tm-main button');
    if (b) b.focus();
  }

  /**
   * Projeta a cena do topo no documento. Chamada pela raiz DEPOIS de ela mexer na pilha — a casca não empilha
   * nem desempilha, e é essa separação que faz o `Phase` sumir daqui: quem troca de cena sabe os nomes, quem
   * projeta só precisa dos três fatos.
   */
  function aplicarCena(): void {
    const f = ctx.fatosDaCena();
    const v = phaseView(f);
    // LER ANTES DE ESCONDER. Era aqui o defeito: `hideTouchControls()` roda logo abaixo e já põe `tc.hidden`
    // em true, então o plano — que rodava depois — via o pad como se ele já estivesse desligado, nunca gravava
    // o `wasOn`, e o ramo que o traz de volta ao retomar era inalcançável. No celular: pausar sumia com o
    // direcional e retomar não o devolvia.
    const touchStateBeforeHiding = readTouchControls();
    if (v.hideTouchControls) ctx.hideTouchControls(); // menu ativo (título/pausa) = sem controle virtual
    // GAG: na pausa, silencia TODO o som do jogo (loops de ambiente/chuva inclusive) — volta ao retomar.
    ctx.setMasterMuted(v.masterMuted);
    applyPhaseView(v);
    applyTouchControls(f, touchStateBeforeHiding); // o estado é o de ANTES do hide — ver o comentário acima
    // ORDEM verbatim: o aria-pressed vem DEPOIS do bloco de toque.
    //
    // No TÍTULO o atributo SAI, em vez de virar `false`. Ali o botão significa "iniciar", e `aria-pressed`
    // num botão que não alterna nada faz o leitor de tela anunciar um estado que não existe — pior que não
    // anunciar nada. `titleOverlayHidden` é verdadeiro fora do título.
    const pb = ctx.$<HTMLElement>('#touch-start');
    if (pb) {
      if (v.titleOverlayHidden) pb.setAttribute('aria-pressed', String(v.pausePressed));
      else pb.removeAttribute('aria-pressed');
    }
    applyFocus(v.focus);
  }


  /* ===================== a tabela do menu de pausa ===================== */

  // Ações do menu de pausa (compartilhadas pelos menus por tela). Ao abrir um submenu de a11y, escopa ao
  // jogador que agiu (pauseActor) — o diálogo abre na aba dele.
  const pauseActs: PauseActs = {
    resume: () => ctx.retomarJogo(),
    // O botão ABC era um CICLO de duas posições; virou a porta do menu de CAA (ADR-0028), onde a caixa da
    // letra é uma escolha entre outras. Ele não sumiu — quem usava o atalho continua a um clique da escolha,
    // em vez de ter de descobrir onde ela foi parar. A ação `letra` sumiu junto com o ciclo: um nome por coisa.
    caa: () => ctx.openCaa(),
    nivel: () => ctx.setQuizLevel(ctx.getQuizLevel() % 5 + 1, true), // L3: cicla 1..5
    tipo: () => ctx.openTypo(),
    // R-splash 2: só AUMENTA (nunca diminui); a tela nova ESPERA um botão do jogador entrar
    addplayer: () => {
      const n = ctx.getNumPlayers();
      if (n >= 4) { ctx.srAlert(t('sr.screens.maxPlayers')); return; }
      if (!ctx.fitsN(n + 1)) { ctx.srAlert(t('sr.screens.wontFitOneMore')); return; }
      if (!ctx.joinPlayer(null)) return;
      const p = ctx.getPlayers()[ctx.getNumPlayers() - 1] as ShellPlayer;
      p.waiting = true;
      ctx.showWaitingBadge(p.i);
      ctx.retomarJogo();
      ctx.srAlert(t('sr.player.pressToJoin', { n: p.i + 1 }));
    },
    audio: () => ctx.openAudio(),
    motora: () => { ctx.setMotorPlayer(ctx.getPauseActor()); ctx.openMovement(); },
    anim: () => { ctx.setMotionPlayer(ctx.getPauseActor()); ctx.openMotion(); },
    visual: () => { ctx.setSelVizPlayer(ctx.getPauseActor()); ctx.openVisual(); },
    empatia: () => { ctx.setSelVizPlayer(ctx.getPauseActor()); ctx.openEmpathy(); },
    print: () => printMode(),
    quit: () => ctx.quitGame(),
    ajuda: () => ctx.openHelp(),
  };

  return { aplicarCena, pauseSelect, printMode, updateTitleLegend, pauseActs };
}
