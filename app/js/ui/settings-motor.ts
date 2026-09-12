// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-motor — MOTOR / MOVIMENTO POR JOGADOR panel (Estágio 4): extracted from game.js's
// renderMovPlayers()/reflectFacil()/reflectAltMove()/setEasy() (~line 2136). Pure logic (per-player tab
// clamp/view-model, the "any player active" predicate, the Modo Fácil announcement text) is separated from the
// thin DOM-touching render/reflect functions. DI via initSettingsMotor(ctx): `$` (DOM selector), `srSay`,
// `store` (platform/storage shape), `players`/`getNumPlayers` (core/state.ts's live state) and `rebuildCoins`
// (coin subsystem, Modo Fácil puts coins on the ground).
//
// ⚠️ `setToggleMove` DEIXOU DE ESTAR NESSA LISTA em 2026-09-08 (ADR-0106 §4, etapa 1b), e o que ela dava como
// razão era o argumento contrário: dizia que ele «fica fora deste módulo porque é PARTILHADO com outra
// superfície da interface» — o ícone `altmove` da pausa. Ser partilhado por duas superfícies da ENGINE é razão
// para a engine o possuir. `definirAlternanciaDeMarcha` mora aqui; o campo do `ctx` ficou OPCIONAL, então
// quem injecta continua a mandar e quem não injecta deixa de ficar sem ele.
// Overlay open/close plumbing (frontOverlay, #movement hidden toggle,
// Escape handling, renderMapHub) is the SHARED helper used by every settings panel and stays in game.js.

import { toggleLabel } from './dom.js';
import type { PlayerView } from '../core/entity.js';
import { t } from '../core/i18n.js';
import { markChanged, markMenuChanged } from './changed-mark.js';
import { DEFAULTS } from '../core/state.js';
import type { DomQuery } from '../core/dom-query.js';
// ⚠️ IMPORT DIRETO, e não uma peça a mais no `ctx`, pela mesma razão que o `ui/pause-icons` importa
// `platform/storage`: um nome de chave injetado é um campo que um consumidor pode omitir, e omiti-lo aqui
// faria o painel escrever num nome torto — que é o defeito que este import acaba de fechar.
import { KEYS } from '../platform/storage.js';
import { gravarAlternancia } from '../input/latch-store.js';
import {
  aplicarAlternancia, BASE_DA_MARCHA, type JogadorDaAlternancia as JogadorDaAlternanciaDaAresta,
} from '../input/latch-sync.js';
import { recusaDaAlternancia } from './latch-refusal.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** Minimal platform/storage.ts shape this module needs. */
export interface MotorStore {
  setBool(key: string, on: boolean): void;
  /** Lê a chave crua. Só a marca do ADR-0029 usa, e para uma pergunta precisa: a criança ESCOLHEU isto? */
  get(key: string): string | null;
}

/** Minimal per-player shape this module reads/writes (core/state.ts's `players` entries carry much more). */
/** As duas escolhas motoras por jogador: modo Fácil e teclas de alternância. */
export type MotorPlayer = PlayerView<'easy' | 'toggleMove' | 'toggleRun' | 'walkDir'>;

export interface SettingsMotorCtx {
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /** Screen-reader announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Persistence (platform/storage.ts), injected. */
  store: MotorStore;
  /** Live player list (core/state.ts's `players` — mutated in place, same reference every call). */
  players: MotorPlayer[];
  /** Live player count (core/state.ts's `numPlayers`); a getter because the value is reassigned over time. */
  getNumPlayers: () => number;
  /** SHARED setter (also used by the pause-menu quick icon `altmove`) — stays in game.js, injected. */
  setToggleMove?: (i: number, on: boolean) => void;
  /**
   * ESTE JOGO SEGURA ALGUMA TECLA? — `GameDeclaration.seguraTeclas` (ADR-0115). Sem ele a linha da
   * alternância fica AUSENTE deste painel.
   *
   * ⚠️ E A ENGINE NÃO DESENHA ESTA LINHA — o markup do `#opt-altmove` é do CARTUCHO, e a engine só o
   * encontra pelo `$`. Logo «não oferecer» aqui não é deixar de renderizar: é tornar a linha ausente para
   * toda a gente, com `hidden`, que a tira da tela E da árvore de acessibilidade. Um `aria-disabled` seria a
   * resposta errada — essa é a da cláusula 3 do ADR-0113, onde o controle EXISTE e está travado com motivo.
   *
   * ⚠️ OBRIGATÓRIO, pela mesma razão que no `PauseIconsCtx`: não há padrão seguro. `true` deixa a linha num
   * jogo onde ela não faz nada; `false` esconde-a de uma criança que depende dela.
   */
  seguraTeclas: boolean;
  /**
   * QUAL APARELHO ESTE JOGADOR ESTÁ A USAR (ADR-0113) — atravessa daqui para a escrita.
   *
   * ⚠️ Opcional pela mesma razão que na `EscritaDaAlternanciaCtx`: sem ele a escrita cai no que já fazia,
   * e exigi-lo quebraria todo consumidor por causa de uma migração a meio.
   */
  transporteEmUso?: (jogador: number) => string;
  /**
   * A ALTERNÂNCIA DO BOTÃO DE CORRER.
   *
   * ⚠️ PASSOU A OPCIONAL (ADR-0106 §1), e a ausência é a notícia: a engine passou a saber respondê-la, por
   * `definirAlternanciaDeCorrida` — ver o que está escrito lá, e o teste é o mesmo que autorizou a irmã da
   * marcha: nenhum dos passos é do jogo. Quem injecta continua a mandar.
   */
  setToggleRun?: (i: number, on: boolean) => void;
  /**
   * A REACÇÃO DO MUNDO ao Modo Fácil (moedas no chão) — do jogo, e por isso OPCIONAL em vez de obrigatória.
   *
   * 📌 O padrão é NÃO FAZER NADA, e é exactamente o que o `ui/pause-icons` já decidiu para o modo cego: «o
   * padrão é literalmente o que o `core/state` já decidiu que um setter faz — grava, persiste, avisa — e nada
   * mais. Os efeitos de jogo são REACÇÃO, e quem reage assina.» A escolha da criança fica gravada e vale para
   * quem a lê; um jogo sem moedas não tem o que refazer, e um que tenha continua a injectar a sua.
   *
   * ⚠️ E A LINHA CONTINUA VIVA SEM ELA — não é um botão morto. `setEasy` escreve `p.easy`, persiste e anuncia
   * antes de chamar isto; o que falta sem a injecção é o remate no mundo, não o efeito.
   */
  rebuildCoins?: () => void;
  /**
   * Move a prosa das linhas para o rodapé (`ui/settings-panel` → `fillExplain`). Chamado a CADA render.
   *
   * ⚠️ NÃO É OPCIONAL POR ELEGÂNCIA: `fillExplain` roda uma vez quando o overlay é frontalizado e move o
   * `.opt-hint` de dentro de cada linha para o rodapé. Este painel RECONSTRÓI as linhas, e as linhas novas
   * voltam com a prosa lá dentro — então a explicação aparece duas vezes, no rodapé e sob o rótulo, a
   * partir do primeiro clique. O `CLAUDE.md` §4 regista exatamente isto, e a issue #109 já o consertou
   * uma vez noutros painéis.
   *
   * Opcional na assinatura porque um consumidor pode montar o painel sem a casca (um teste, o segundo
   * consumidor): sem casca não há rodapé para duplicar.
   */
  fillExplain?: (card: HTMLElement | null) => void;
}

export interface SettingsMotorApi {
  /** Re-renders #movement-players (kept `hidden`, per E3 — see playerTabsHTML) and (re)wires its buttons. */
  renderMovPlayers: () => void;
  /** Reflects the selected player's Modo Fácil onto #opt-facil (+ the #opt-movement bar light). */
  reflectFacil: () => void;
  /** Reflects the selected player's alternância onto #opt-altmove (+ the #opt-movement bar light). */
  reflectAltMove: () => void;
  /** Idem para a alternância do botão de CORRER (#opt-togglerun). */
  reflectToggleRun: () => void;
  /** Sets Modo Fácil for player `i`; mirrors the old setEasy(i,on). */
  setEasy: (i: number, on: boolean) => void;
  /** Selects which player this panel edits (mirrors `selMovPlayer = pauseActor` before opening the panel). */
  setSelPlayer: (i: number) => void;
  /** Currently selected player index. */
  getSelPlayer: () => number;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no `document`, testable in node)
// ---------------------------------------------------------------------------------------------

/** localStorage key for a player's Modo Fácil flag (== platform/storage.ts's `easy_p{i}` pattern). */
export function easyKey(i: number): string {
  // ⚠️ ERA A ÚLTIMA CÓPIA DO LITERAL neste ficheiro, e o irmão logo abaixo (`toggleRunKey`) já regista por
  // extenso porque isso é defeito: «duas cópias de um nome mudam uma de cada vez». O `platform/storage` diz o
  // resto — as chaves são funções «para impedir que um deles escreva num nome torto». Passada em 2026-09-08,
  // ao acrescentar o terceiro irmão; um gate afirma agora que os três concordam com o `KEYS`.
  return KEYS.easyP(i);
}

/**
 * localStorage key da alternância do botão de CORRER, na forma LEGADA (sem transporte).
 *
 * ⚠️ ERA UMA CÓPIA DO LITERAL, com um comentário ao lado a dizer «== `toggleRunP` de platform/storage» — o
 * que é a admissão do defeito escrita como se fosse documentação. Duas cópias de um nome mudam uma de cada
 * vez, e o `platform/storage` já tinha escrito a razão de as chaves serem funções: «virar função aqui é o
 * que impede que um deles escreva num nome torto». Agora delega, e há um nome só.
 *
 * ⚠️ E É A CHAVE LEGADA. O ADR-0104 §C pôs o TRANSPORTE no nome, porque a alternância é do aparelho e não da
 * pessoa; esta continua a ser lida para herdar o que a criança já tinha, e não é escrita. A chave nova é
 * `chaveDaAlternancia`, em `input/latch-scope`.
 */
export function toggleRunKey(i: number): string {
  return KEYS.toggleRunP(i);
}

/** localStorage key da alternância de MARCHA, por jogador. Delega, como os dois irmãos acima. */
export function toggleMoveKey(i: number): string {
  return KEYS.toggleMoveP(i);
}

/**
 * A fatia mínima que a escrita da alternância de marcha toca.
 *
 * ⚠️ `walkDir` ENTRA, e não é detalhe: desligar a alternância tem de PARAR quem está a andar por travamento.
 * Sem isso, a criança desliga o modo e a personagem continua a andar sozinha, sem tecla nenhuma premida —
 * e não há erro nenhum a dizê-lo.
 *
 * ⚠️ E É FATIA PRÓPRIA, e não o `MotorPlayer`, porque os DOIS chamadores têm fatias diferentes: o painel
 * motor traz `easy`/`toggleRun` que isto não lê, e o `PausePlayer` traz o visual e as três do movimento
 * reduzido. Uma fatia mínima é o que deixa os dois passarem sem que nenhum tenha de carregar o do outro.
 * `MotorPlayer` e `PausePlayer` ganharam `walkDir` — quebra declarada, porque o campo é do `PlayerBase` e
 * todo jogador da engine já o tem.
 *
 * 📌 A DEFINIÇÃO MUDOU DE CASA (issue #127) e o NOME fica publicado aqui. Ela vive em `input/latch-sync`, ao
 * lado da regra que a usa, porque a sincronização da aresta toca exactamente estes dois campos — duas cópias
 * do mesmo tipo divergiriam no dia em que a regra ganhasse um terceiro. ⚠️ **Alias e não `export ... from`**:
 * o retrato de nomes deixa re-exports de fora e leria a mudança de casa como remoção, que é a lição da etapa
 * 1a do ADR-0106.
 */
export type JogadorDaAlternancia = JogadorDaAlternanciaDaAresta;

/** O que a escrita precisa de saber. Tudo o que está aqui já vive no `SettingsMotorCtx` e no `PauseIconsCtx`. */
export interface EscritaDaAlternanciaCtx {
  readonly players: readonly JogadorDaAlternancia[];
  readonly store: { setBool(key: string, on: boolean): void };
  readonly srSay: (msg: string) => void;
  readonly getNumPlayers: () => number;
  /**
   * QUAL APARELHO ESTE JOGADOR ESTÁ A USAR (ADR-0113). `input/state.entradaDe(i).emUso` é quem responde.
   *
   * ⚠️ OPCIONAL DE PROPÓSITO, e a razão é o que acontece sem ele: a escrita cai exactamente no que já fazia
   * hoje — só a chave por jogador. Torná-lo obrigatório quebraria todo consumidor que constrói este ctx,
   * por causa de uma migração que ainda não terminou, e o `holdsAtOnce` já mostrou o que isso custa.
   *
   * 📌 E é INJECTADO em vez de importado: `ui/` a ler estado de módulo de `input/` é uma aresta nova entre
   * duas camadas, para poupar um argumento. Este ctx já recebe tudo o resto assim.
   */
  readonly transporteEmUso?: (jogador: number) => string;
}

/**
 * LIGA OU DESLIGA A ALTERNÂNCIA DE MARCHA DE UM JOGADOR — e agora é a engine que o faz (ADR-0106 §4).
 *
 * ⚠️ O COMENTÁRIO QUE JUSTIFICAVA A INJEÇÃO ARGUMENTAVA CONTRA ELA. Ele dizia: «SHARED setter (also used by
 * the pause-menu quick icon `altmove`) — stays in game.js, injected». Ser partilhado por DUAS superfícies da
 * engine é razão para a engine o possuir, não para o cartucho o guardar — e a medição de 2026-09-08 mostra
 * que cada passo já era da engine: `toggleMove` e `walkDir` são campos do `PlayerBase`, a chave é do
 * `platform/storage`, e `sr.motor.toggleMove*` são chaves i18n da engine. Não sobrava efeito de jogo nenhum,
 * o que faz deste o mais limpo dos sete: aqui não há sequer um efeito colateral a injectar.
 */
export function definirAlternanciaDeMarcha(ctx: EscritaDaAlternanciaCtx, i: number, on: boolean): void {
  const p = ctx.players[i];
  if (!p) return;
  // 📌 A REGRA DE DESLIGAR MORA NUM SÍTIO SÓ desde a issue #127: `aplicarAlternancia` põe o valor E pára quem
  // anda por travamento. Ela era duas linhas aqui, e passou a ser partilhada com a sincronização da aresta
  // (`input/latch-sync`) — que resolve a MESMA pergunta ao trocar de aparelho. Duas cópias do «senão a
  // personagem anda sozinha» divergiriam no dia em que uma delas mudasse.
  aplicarAlternancia(p, on);
  // ⚠️ AS DUAS CHAVES, E A ANTIGA NÃO SAI AINDA — é a forma do `p.visual` ao lado do `p.viz` (#104 etapa 1a),
  // e pela mesma razão: quem LÊ ainda é o cartucho, por `KEYS.toggleMoveP(i)` (`main.ts:540`). Parar de a
  // escrever agora faria a criança perder a escolha no arranque seguinte — o defeito que o ADR-0113 nomeia
  // como a cláusula que decide se a decisão custa um ajuste real no dia em que sai.
  ctx.store.setBool(toggleMoveKey(i), on);
  // 📌 E a chave NOVA, quando se sabe o aparelho. `gravarAlternancia` recusa-se nos quatro assistidos, onde
  // não há escolha a guardar (ADR-0113 cláusula 3) — e devolve `false` para quem chama desabilitar o
  // controle com o motivo dito. Aqui a recusa não muda mais nada: o valor em memória continua a ser o que
  // a regra resolve, e é ela que responde `true` naqueles quatro.
  const transporte = ctx.transporteEmUso ? ctx.transporteEmUso(i) : null;
  if (transporte) gravarAlternancia((chave, ligada) => ctx.store.setBool(chave, ligada), BASE_DA_MARCHA, i, transporte, on);
  // 📌 O ANÚNCIO É INCONDICIONAL, ao contrário do `aplicarAlternancia`, que devolve «mudou». A criança
  // carregou no ícone: calar-se porque o valor já era esse deixaria o botão sem resposta para quem ouve.
  ctx.srSay(playerPrefix(i, ctx.getNumPlayers()) + t(on ? 'sr.motor.toggleMoveOn' : 'sr.motor.toggleMoveOff'));
}

/**
 * LIGA OU DESLIGA A ALTERNÂNCIA DO CORRER — a irmã de `definirAlternanciaDeMarcha`, e mais limpa do que ela.
 *
 * 🎯 A RAZÃO DE EXISTIR É A MESMA, e o teste que a autoriza está escrito no comentário da irmã: «cada passo já
 * era da engine». Aqui é ainda mais verdade — `toggleRun` é campo de `PlayerBase`, a chave é
 * `KEYS.toggleRunP(i)` do `platform/storage`, e `sr.motor.toggleRun*` são chaves i18n da engine. **Não há um
 * único efeito de jogo a injectar**, e por isso `SettingsMotorCtx.setToggleRun` deixa de ser obrigatório: um
 * jogo que não o forneça deixa de ficar sem a linha do correr, em vez de a ter morta.
 *
 * ⚠️ E NÃO CHAMA `aplicarAlternancia`, ao contrário da irmã. Aquela pára quem anda por travamento ao desligar,
 * porque a alternância de MARCHA deixa a personagem a andar sozinha; a do correr governa uma trava de
 * velocidade, que não tem como deixar ninguém em movimento. Copiar a linha «por simetria» seria mexer em
 * `walkDir` por causa de um botão que não lhe toca.
 *
 * 📌 O anúncio é INCONDICIONAL, como o da irmã: a criança carregou no botão, e calar-se porque o valor já era
 * aquele deixa o controle sem resposta para quem ouve em vez de ver.
 */
export function definirAlternanciaDeCorrida(ctx: EscritaDaAlternanciaCtx, i: number, on: boolean): void {
  const p = ctx.players[i] as ({ toggleRun?: boolean } | undefined);
  if (!p) return;
  p.toggleRun = on;
  ctx.store.setBool(toggleRunKey(i), on);
  ctx.srSay(playerPrefix(i, ctx.getNumPlayers()) + t(on ? 'sr.motor.toggleRunOn' : 'sr.motor.toggleRunOff'));
}

/** Clamps the selected player back to 0 once it falls outside 0..numPlayers-1 (e.g. player count dropped). */
export function clampSelPlayer(sel: number, numPlayers: number): number {
  return sel >= numPlayers ? 0 : sel;
}

/** Whether ANY player currently uses Modo Fácil or alternância — lights the #opt-movement bar button. */
export function anyMotorActive(players: MotorPlayer[]): boolean {
  return players.some((p) => p.easy || p.toggleMove);
}

/** '❚❚ Ligado' / '▶ Desligado' para #opt-facil e #opt-altmove. Reexporta o de ui/dom, que é o único que
 *  existe desde o item 14 — o corpo daqui era uma cópia, e o comentário já dizia "shared" sem sê-lo. */
export const onOffLabel = toggleLabel;

/**
 * Full innerHTML for #movement-players, given the player count and the active index. Pure string building —
 * no DOM. NOTE (verbatim from game.js, E3): the panel keeps this list `hidden` — a single player edits only
 * their own screen (scope = pauseActor) — but the tabs/buttons are still built and wired for >1 player.
 */
export function playerTabsHTML(numPlayers: number, selected: number): string {
  if (numPlayers <= 1) return '';
  return Array.from(
    { length: numPlayers },
    (_, p) => `<button class="mode-btn${p === selected ? ' is-on' : ''}" data-mp="${p}" type="button">Jogador ${p + 1}</button>`,
  ).join('');
}

/**
 * O 'Jogador N: ' que abre um anúncio quando há mais de uma tela. Uma tela só não leva prefixo — dizer
 * "Jogador 1" para quem está sozinho é ruído, e ruído no leitor de tela custa tempo de escuta.
 */
export function playerPrefix(i: number, numPlayers: number): string {
  return numPlayers > 1 ? t('sr.player.prefix', { n: i + 1 }) : '';
}

/** srSay text for a Modo Fácil change. A frase inteira vem do dicionário — ver `sr.motor.easyOn`. */
export function easyAnnouncement(i: number, numPlayers: number, on: boolean): string {
  return playerPrefix(i, numPlayers) + t(on ? 'sr.motor.easyOn' : 'sr.motor.easyOff');
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

export function initSettingsMotor(ctx: SettingsMotorCtx): SettingsMotorApi {
  // ⚠️ RESOLVIDO UMA VEZ: quem injecta manda, quem não injecta passa a ter. A engine sabe fazê-lo sozinha
  // desde 2026-09-08 — ver definirAlternanciaDeMarcha, e o comentário do campo, que argumentava contra si.
  const setToggleMove = ctx.setToggleMove ?? ((i: number, on: boolean) => definirAlternanciaDeMarcha(ctx, i, on));
  // A irmã, pela mesma regra e pela mesma razão — ver `definirAlternanciaDeCorrida`.
  const setToggleRun = ctx.setToggleRun ?? ((i: number, on: boolean) => definirAlternanciaDeCorrida(ctx, i, on));
  // ⚠️ A REACÇÃO DO MUNDO É DO JOGO, e a ausência dela não é um botão morto: `setEasy` já escreveu, persistiu
  // e anunciou antes de chegar aqui. É o padrão que o `ui/pause-icons` fixou para o modo cego.
  const rebuildCoins = ctx.rebuildCoins ?? ((): void => {});
  let selMovPlayer = 0; // jogador selecionado no painel Acessibilidade motora

  const facilBtn = ctx.$<HTMLElement>('#opt-facil');
  const altMoveBtn = ctx.$<HTMLElement>('#opt-altmove');
  /**
   * A DICA ORIGINAL DA LINHA, guardada uma vez.
   *
   * ⚠️ AQUI A RECUSA VAI E VEM, e é essa a diferença para o precedente. O `render/viz-setters` ACRESCENTA
   * o motivo à dica e nunca o retira, o que é correcto lá: aquela lista é reconstruída a cada render. Este
   * botão é persistente e a criança pode largar a webcam e voltar ao teclado — sem guardar o texto de
   * origem, o motivo acumular-se-ia na linha a cada troca de aparelho.
   */
  const altMoveRow = altMoveBtn?.closest<HTMLElement>('.ctrl-row') ?? null;
  const altMoveHint = altMoveRow?.querySelector<HTMLElement>('.opt-hint') ?? null;
  const dicaOriginal = altMoveHint?.textContent ?? '';

  /*
   * ADR-0115 · A LINHA SOME NUM JOGO QUE NÃO SEGURA NADA — e some para TODA A GENTE.
   *
   * 🔴 `hidden` e não `aria-disabled`: a criança que depende da alternância abre este painel para a ligar, e
   * num quiz não há nada para ela ligar. Um controle desabilitado com um motivo continua a ser um controle
   * que não faz nada — e ainda ocupa um lugar na navegação por teclado, entre dois que funcionam.
   * 📌 A cláusula 3 do ADR-0113 é o caso oposto e continua intacta: lá o aparelho EXIGE a alternância, o
   * controle existe, e fica `aria-disabled` COM o motivo, alcançável para que ela possa lê-lo.
   * ⚠️ E a linha é do CARTUCHO: a engine não a criou e por isso não a destrói. `hidden` é reversível e
   * idempotente; remover markup alheio não é nenhuma das duas coisas.
   */
  if (!ctx.seguraTeclas && altMoveRow) altMoveRow.hidden = true;

  /** A recusa DESTE jogador agora, ou `null`. Recalculada a cada reflexo: o aparelho em uso muda. */
  function recusaAgora(i: number) {
    return ctx.transporteEmUso ? recusaDaAlternancia(ctx.transporteEmUso(i)) : null;
  }
  const toggleRunBtn = ctx.$<HTMLElement>('#opt-togglerun');

  // barra acende se QUALQUER jogador usa Fácil/alternância
  function reflectMovementBtn(): void {
    const b = ctx.$<HTMLElement>('#opt-movement');
    if (b) b.classList.toggle('is-on', anyMotorActive(ctx.players));
    refreshMarks();
  }

  /**
   * A marca de "saiu do padrão" (ADR-0029). Pendurada no reflect que JÁ roda a cada mudança dos dois
   * controles, porque uma marca que precise de uma chamada própria é uma marca que alguém vai esquecer —
   * e uma marca errada manda a criança desfazer o que ela nunca mexeu.
   *
   * O escopo segue o do reset deste menu: as duas PREFERÊNCIAS. Os métodos de entrada (olhos, mapeamento)
   * ficam de fora aqui também — não porque não possam mudar, mas porque o padrão deles não mora em DEFAULTS,
   * e marcar sem uma fonte única de "o que é padrão" seria inventar uma segunda opinião sobre isso.
   */
  function refreshMarks(): void {
    const easy = ctx.players.some((p) => !!p.easy) !== DEFAULTS.easy;
    const alt = ctx.players.some((p) => !!p.toggleMove) !== DEFAULTS.toggleMove;
    // A ALTERNÂNCIA DO CORRER PERGUNTA DIFERENTE, e a diferença é o que ela tem de próprio: ela LIGA SOZINHA
    // no controle de tela. Marcar pelo ESTADO acenderia a marca para 100% de quem joga em tablet, sem ninguém
    // ter tocado em nada — e uma marca sempre acesa não significa nada. Pior: o comentário do reset deste
    // menu já diz que "uma marca errada manda a criança desfazer o que ela nunca mexeu".
    //
    // Então o que marca é a ESCOLHA GUARDADA. Valor salvo significa que alguém mexeu naquele controle; o
    // ligar automático não salva nada, e por isso não marca.
    const runEscolhido = ctx.players.some((p, i) => ctx.store.get(toggleRunKey(i)) != null && !!p.toggleRun !== DEFAULTS.toggleRun);
    markChanged(facilBtn?.closest<HTMLElement>('.ctrl-row') ?? null, easy);
    markChanged(altMoveBtn?.closest<HTMLElement>('.ctrl-row') ?? null, alt);
    markChanged(toggleRunBtn?.closest<HTMLElement>('.ctrl-row') ?? null, runEscolhido);
    markMenuChanged(ctx.$<HTMLElement>('[data-act="motora"]'), [easy, alt, runEscolhido]);
  }

  function reflectFacil(): void {
    const p = ctx.players[selMovPlayer];
    const on = !!(p && p.easy);
    if (facilBtn) {
      facilBtn.classList.toggle('is-on', on);
      facilBtn.setAttribute('aria-pressed', String(on));
      facilBtn.textContent = onOffLabel(on);
    }
    reflectMovementBtn();
  }

  function reflectToggleRun(): void {
    const p = ctx.players[selMovPlayer];
    const on = !!(p && p.toggleRun);
    if (toggleRunBtn) {
      toggleRunBtn.classList.toggle('is-on', on);
      toggleRunBtn.setAttribute('aria-pressed', String(on));
      toggleRunBtn.textContent = onOffLabel(on);
    }
    reflectMovementBtn();
  }

  function reflectAltMove(): void {
    const p = ctx.players[selMovPlayer];
    const on = !!(p && p.toggleMove);
    if (altMoveBtn) {
      altMoveBtn.classList.toggle('is-on', on);
      altMoveBtn.setAttribute('aria-pressed', String(on));
      altMoveBtn.textContent = onOffLabel(on);
      /*
       * ⚠️ A CLÁUSULA 3 DO ADR-0113 NA TELA: onde a alternância é exigida, o controle NÃO SOME — fica
       * `aria-disabled` e o motivo entra na dica, que a casca (`ui/settings-panel.fillExplain`) move para o
       * rodapé. Sumir ensinaria que a coisa não existe; deixá-lo activo faria a criança carregar e não
       * perceber por que nada mudou.
       *
       * 📌 E `aria-disabled` e não `disabled`: um botão desabilitado de verdade SAI da ordem de tabulação, e
       * quem navega por teclado deixaria de o alcançar — logo deixaria de poder LER o motivo. É a mesma
       * escolha que a #128 nomeia como defeito quando é feita ao contrário (só classe CSS, sem `aria`).
       */
      const recusa = recusaAgora(selMovPlayer);
      if (recusa) altMoveBtn.setAttribute('aria-disabled', 'true');
      else altMoveBtn.removeAttribute('aria-disabled');
      if (altMoveHint) altMoveHint.textContent = recusa ? `${dicaOriginal} ${t(recusa.chave)}`.trim() : dicaOriginal;
    }
    reflectMovementBtn();
  }

  function setEasy(i: number, on: boolean): void {
    const p = ctx.players[i];
    if (!p) return;
    p.easy = on;
    ctx.store.setBool(easyKey(i), on);
    reflectFacil();
    rebuildCoins();
    ctx.srSay(easyAnnouncement(i, ctx.getNumPlayers(), on));
  }

  function renderMovPlayers(): void {
    const tabs = ctx.$<HTMLElement>('#movement-players');
    if (!tabs) return;
    const numPlayers = ctx.getNumPlayers();
    selMovPlayer = clampSelPlayer(selMovPlayer, numPlayers);
    tabs.hidden = true; // E3: sem abas — cada jogador edita só o seu (escopo = pauseActor)
    tabs.innerHTML = playerTabsHTML(numPlayers, selMovPlayer);
    tabs.querySelectorAll<HTMLButtonElement>('button[data-mp]').forEach((b) => {
      b.addEventListener('click', () => {
        selMovPlayer = Number(b.dataset.mp);
        renderMovPlayers();
        reflectFacil();
        reflectAltMove();
      });
    });
    // A prosa volta para o rodapé depois de as linhas serem reconstruídas (CLAUDE.md §4, #109).
    ctx.fillExplain?.(ctx.$<HTMLElement>('#movement .overlay__card'));
  }

  if (facilBtn) {
    facilBtn.addEventListener('click', () => setEasy(selMovPlayer, !ctx.players[selMovPlayer].easy));
  }
  if (altMoveBtn) {
    altMoveBtn.addEventListener('click', () => {
      /*
       * ⚠️ RECUSAR DIZENDO, E NÃO EM SILÊNCIO. O precedente (`render/viz-setters`) resolve isto não ligando
       * ouvinte nenhum — pode, porque reconstrói a lista a cada render. Aqui o ouvinte é ligado uma vez, e
       * um `return` mudo seria «aceitar o clique e ignorá-lo», que é a outra metade do que o ADR-0076
       * proíbe. Então a recusa FALA: quem carregou fica a saber por quê, mesmo sem ver a dica.
       */
      const recusa = recusaAgora(selMovPlayer);
      if (recusa) { ctx.srSay(t(recusa.chave)); return; }
      setToggleMove(selMovPlayer, !ctx.players[selMovPlayer].toggleMove);
      reflectAltMove();
    });
  }
  if (toggleRunBtn) {
    toggleRunBtn.addEventListener('click', () => {
      setToggleRun(selMovPlayer, !ctx.players[selMovPlayer].toggleRun);
      reflectToggleRun();
    });
  }

  // ---- restaurar os padrões DESTE menu (ADR-0028) ----
  //
  // O alcance aqui é MENOR que a tela, e de propósito. A Acessibilidade motora hospeda quatro coisas: Modo
  // Fácil, movimento por alternância, o controle pelos olhos (#opt-eyes) e o mapeamento de teclas (#map-hub).
  // O reset devolve as duas PREFERÊNCIAS e não encosta nos dois MÉTODOS DE ENTRADA, por uma razão que vale
  // mais que a simetria:
  //
  //   UM RESET SÓ PODE DESFAZER O QUE ELE TAMBÉM CONSEGUE REFAZER.
  //
  // A criança que joga com os olhos aponta com os olhos. Desligar o controle pela webcam tira dela o ponteiro
  // com que ela clicaria o botão de volta — o reset deixaria de remover uma armadilha para virar uma, e a
  // saída passaria a depender de outra pessoa estar por perto. O mesmo vale para quem remapeou as teclas
  // porque só alcança algumas: devolver o mapa de fábrica é devolver teclas que a mão dela não chega. Esse
  // mapeamento, aliás, já tem o reset dele (#ctrl-reset), onde a escolha é explícita e não um efeito colateral.
  //
  // Por isso o anúncio DIZ o que ficou de fora: um botão que restaura menos do que o nome promete precisa
  // dizer isso em voz alta, ou a criança conclui que ele não funcionou.
  const resetBtn = ctx.$<HTMLButtonElement>('#movement-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    ctx.players.forEach((p, i) => {
      if (p.easy) setEasy(i, false);
      if (p.toggleMove) setToggleMove(i, false);
      if (p.toggleRun) setToggleRun(i, false);
    });
    reflectFacil();
    reflectAltMove();
    reflectToggleRun();
    ctx.srSay(t('sr.motor.reset'));
  });

  reflectFacil();
  reflectAltMove();
  reflectToggleRun();

  return {
    renderMovPlayers,
    reflectFacil,
    reflectAltMove,
    reflectToggleRun,
    setEasy,
    setSelPlayer: (i: number) => { selMovPlayer = i; },
    getSelPlayer: () => selMovPlayer,
  };
}
