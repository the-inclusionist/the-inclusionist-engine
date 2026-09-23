// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-controls — Keyboard-remap panel (Estágio 4): extracted from game.js's renderControls()/keyName()/
// the captureAction+captureMapRef remap flow. Pure logic (key→label, cross-player conflict lookup) is separated
// from the thin DOM-touching render()/handleCaptureKeydown(). DI via initSettingsControls(ctx): `$` (DOM
// selector), `srSay`/`srAlert`, `store` (save/reset persistence), the live `kb` value + `setKB` setter, and the
// shared per-player helpers (`kbFor`/`getNumPlayers`/`applyControls`/`assignControls`) that game.js also uses
// elsewhere (gamepad binding, HUD, other settings panels) and therefore stay there, injected. Overlay open/close
// plumbing (#options hidden toggle, focus management, Escape-closes-dialog) and the pad-button-design select are
// shared/unrelated infra and stay in game.js. `openHelp()` (pause-menu help screen) reuses `keyName`, which is
// exported here instead of duplicated.
//
// ⚠️ ELE TAMBÉM LIA O `ACT_LABEL`, E DEIXOU DE LER EM 2026-09-07. A tela de ajuda do cartucho passou a montar
// as linhas do preset dele (`acoesDoJogo`), que é quem sabe quantas posições este jogo usa e como elas se
// chamam. Com isso o `ACT_LABEL` ficou sem UM leitor sequer — conferido com `git grep` nos dois repositórios,
// e o que resta dele são comentários e a própria declaração. Ver `docs/6-DevOps-SRE/Breaking-Changes.md`.
import { t } from '../core/i18n.js';
import type { DomQuery } from '../core/dom-query.js';
import type { KeyScheme } from '../core/entity.js';
import { isAction, type Action } from '../core/actions.js';
import { keyName, keyUsedByOther, actionAlreadyBound } from './control-choices.js';
import { markChanged } from './changed-mark.js';
import { controlRow } from './panel-widgets.js';
import type { PanelShellCtx } from './panel-shell.js';
import type { KBDefaults } from '../input/keyboard.js';
import type { KeydownEventLike } from '../input/keydown.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** action -> list of physical key codes (KeyboardEvent.code), e.g. {jump:['KeyJ','Space']}. */
// `KeyScheme` mora em `core/entity` desde 2026-08-26: a entidade declara `ctrl: KeyScheme | null`, então
// ela é a dona. A mesma linha estava escrita em SEIS módulos. Reexportada para quem já a importava daqui.
export type { KeyScheme } from '../core/entity.js';

/** Opaque keyboard config (input/keyboard.ts's KBDefaults shape: {solo,p2,p3,p4}) — never indexed directly here;
 *  all per-player reads go through the injected `kbFor`, so this module stays decoupled from its exact shape. */
/** O `KBDefaults` de `input/keyboard`, que é o dono. Este módulo continua NÃO INDEXANDO o valor — toda
 *  leitura por jogador passa pelo `kbFor` injetado —, e é essa disciplina que o desacopla, não um tipo largo. */
export type KeyboardConfig = KBDefaults;

/** Minimal persistence shape this module needs (input/keyboard.ts's saveKB/resetKB — no direct localStorage). */
export interface ControlsStore {
  saveKB(kb: KeyboardConfig): void;
  resetKB(): KeyboardConfig;
}

export interface SettingsControlsCtx {
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /**
   * AS POSIÇÕES QUE ESTE JOGO USA, cada uma com a palavra dele, no idioma vigente.
   *
   * ⚠️ É a fronteira do corte de 2026-09-06. A tela de remapeamento mostrava as OITO linhas de uma tabela
   * deste ficheiro — quer dizer, a engine decidia que todo jogo tem exatamente pular, correr, trocar e
   * especial. Um quiz mostraria quatro linhas para ações que não existem nele, e uma criança tentaria
   * remapear um botão que não faz nada.
   */
  // ⚠️ `acao` é `Action` e não `string` desde a issue #118, e o comentário do `render()` já dizia porquê:
  // «`a` é o nome ABSTRATO da ação, que a engine enumera em `core/actions`» (ADR-0086). Enquanto foi
  // `string`, um jogo podia declarar uma posição que não existe e a linha era desenhada com teclas vazias,
  // sem que nada apontasse o erro — a criança via uma ação que nunca responderia.
  acoesDoJogo: () => readonly { readonly acao: Action; readonly rotulo: string }[];
  /** Screen-reader "polite" announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Screen-reader "assertive" announcement (core/a11y-sr's srAlert) — used for the capture prompt/conflict. */
  srAlert: (msg: string) => void;
  /** Persistence (input/keyboard.ts's saveKB/resetKB), injected. */
  store: ControlsStore;
  /** The live keyboard config object (game.js's `KB`). Mutated in place by successful remaps. */
  kb: KeyboardConfig;
  /** Replaces game.js's `KB` binding wholesale — only used by "restaurar padrões" (reset reassigns, doesn't mutate). */
  setKB: (kb: KeyboardConfig) => void;
  /** Shared helper (game.js): the scheme for a given player index, given `kb`/numPlayers. Not owned by this panel —
   *  other systems (gamepad binding, HUD) call the same game.js function. */
  kbFor: (playerIndex: number) => KeyScheme;
  /**
   * O esquema DE FÁBRICA deste assento (ADR-0029) — o que ele teria se ninguém tivesse remapeado nada.
   *
   * ⚠️ INJECTADO PELA MESMA RAZÃO QUE O `kbFor` LOGO ACIMA: o mapeamento «quantos jogadores → que balde»
   * (`solo`/`p2`/`p3`/`p4`) é do consumidor, e uma segunda cópia dessa regra dentro da engine divergiria da
   * primeira no dia em que um dos dois mudasse.
   *
   * 🎯 E NÃO SE OBTÉM CHAMANDO `store.resetKB()`, embora ele devolva exactamente a configuração de fábrica:
   * o `input/keyboard.resetKB` faz `store.remove(CKEY)` ANTES de devolver a cópia. Usá-lo como leitor
   * apagaria o remapeamento da criança a cada render, e o estrago só apareceria no arranque seguinte.
   */
  kbPadraoFor: (playerIndex: number) => KeyScheme;
  /** Shared: current player count (core/state.ts's numPlayers, read live via game.js). */
  getNumPlayers: () => number;
  /** Shared: propagates `kb` -> the live control aliases (game.js's applyControls). Called after remap/reset. */
  applyControls: () => void;
  /** Shared: propagates `kb` -> each player's `p.ctrl` (game.js's assignControls). Called after remap/reset. */
  assignControls: () => void;
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

export interface SettingsControlsApi {
  /** Re-renders #ctrl-list for the given player index and (re)wires its "Alterar" buttons. Idempotent. */
  render: (selPlayer: number) => void;
  /** True while a key capture is in progress (game.js's menuNavKey gates menu navigation on this). */
  isCapturing: () => boolean;
  /** Cancels any in-progress capture without re-rendering (dialog is closing anyway). */
  cancelCapture: () => void;
  /**
   * Feeds a keydown to the in-progress capture, if any. Returns true when the event was consumed (capture was
   * active — Escape/conflict/success all consume it) so game.js's own keydown handler can early-return exactly
   * like the old inline `if(captureAction){...}` block did. Returns false (no-op) when nothing is being captured.
   */
  /** `KeydownEventLike` de `input/keydown`, que é quem escuta o teclado e portanto é dono da forma do
   *  evento nesta engine. Este manipulador lê só `e.code` e chama `preventDefault()` — um subconjunto —,
   *  mas pedir o `KeyboardEvent` inteiro obrigava o despacho a entregar mais do que tem (ADR-0039). */
  handleCaptureKeydown: (e: KeydownEventLike) => boolean;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no `document`, testable in node)
// ---------------------------------------------------------------------------------------------

/**
 * As oito posições do jogo de plataforma, ligadas às chaves de i18n das palavras DELE.
 *
 * ⚠️ ELA TEM CONSUMIDOR, e eu já disse aqui que não tinha. A afirmação anterior — «sem um único consumidor,
 * nem aqui nem no `game-platformer`» — vinha de uma varredura com um padrão que **excluía o `main.ts`** do
 * cartucho, por ele estar directamente em `app/js/` e o glob exigir um subdirectório. Medido de novo com
 * `git grep`: `game-platformer/app/js/main.ts` importa-a e usa-a na TELA DE AJUDA do menu de pausa (a linha
 * que lista posição ↔ tecla). O `openHelp()` que o cabeçalho original citava não morreu — mudou de
 * repositório com o cartucho (#111) e continua a ler daqui.
 *
 * ⚠️ E ELA CONTINUA A SER A CAUSA DA #125, o que é diferente de estar morta. O defeito era o `aria-label` da
 * tela de remapeamento ser montado a partir dela: oito posições contra as catorze do vocabulário, e as
 * palavras de UM jogo dentro do motor. Esse uso saiu. O que resta é um consumidor para quem a tabela está
 * certa — porque ele É o jogo de plataforma.
 *
 * ⚠️ REMOVÊ-LA NÃO É LIMPEZA, É MIGRAÇÃO. O cartucho já tem `acoesDoJogo()` (`main.ts:122`), derivado do
 * preset dele; a tela de ajuda passar a usá-lo é edição de lá, e só depois disso é que isto pode sair daqui.
 * Enquanto não sair, quem escrever código NOVO na engine pede a palavra ao jogo por `ctx.acoesDoJogo()` — a
 * engine sabe que a posição existe, só o jogo sabe como ela se chama (ADR-0086).
 *
 * Guarda CHAVES e não texto porque uma `const` de módulo é avaliada uma vez no import, e o `dict` do
 * `core/i18n` é um `let` que o `setLocale` reatribui — texto capturado aqui congelaria o idioma no boot.
 */
export const ACT_LABEL: Record<string, string> = {
  left: 'act.left', right: 'act.right', up: 'act.up', down: 'act.down',
  action1: 'act.run', action2: 'act.jump', action4: 'act.swap', action3: 'act.especial',
};

/**
 * ⚠️ A TABELA ACIMA E DÍVIDA DECLARADA, e o cabeçalho dela ficou desatualizado no dia em que o corte
 * aconteceu: ela ainda diz quais são as palavras DESTE jogo — `act.run`, `act.jump` — dentro de um módulo de
 * engine. Continua exportada porque `openHelp()` (a tela de ajuda do menu de pausa) ainda a lê, e mover as
 * duas coisas no mesmo commit misturaria dois assuntos.
 *
 * O que MUDOU é quem manda: a lista de linhas e as palavras vêm agora de `ctx.acoesDoJogo()`, e esta tabela é
 * só o que sobra para o consumidor que ainda não migrou. Quando `openHelp` perguntar ao jogo, ela sai.
 */

/*
 * 🎯 O QUE UMA TECLA É E DE QUEM ELA JÁ É mora em `./control-choices.js` desde 2026-09-22 (nota BL) —
 * `keyName`, `keyUsedByOther` e `actionAlreadyBound`. Este ficheiro ficou com o trabalho que o nome dele
 * sempre descreveu: desenhar a tela, ligar os cliques e conduzir a captura. Sem apelido deixado para trás,
 * pela razão que o corte dos ícones já escreveu: um re-export mantém vivo um caminho que nada aqui usa e faz
 * o retrato da superfície MENTIR, porque ele não vê re-exports (#204).
 *
 * 📌 O `ACT_LABEL` NÃO foi junto, e isso é decisão: ele é dívida DECLARADA com uma migração própria escrita
 * acima (as palavras de UM jogo dentro do motor, à espera de que a tela de ajuda pergunte ao cartucho).
 * Levá-lo para um módulo novo seria mudar a dívida de morada, que é o que os três cortes anteriores
 * recusaram fazer.
 */

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

interface CaptureState { action: Action; mapRef: KeyScheme; player: number }

/** O id do botão de uma posição. Sai do nome ABSTRATO da acção, que é único por construção (`core/actions`). */
export const ctrlControlId = (action: string): string => `ctrl-act-${action}`;

/**
 * A CARA DO BOTÃO: as teclas de agora, uma `<kbd>` cada.
 *
 * ⚠️ Sem nenhuma tecla o botão ficaria com a cara vazia — um alvo de 44 px sem nada a dizer —, e aí volta a
 * palavra «Mudar», que é onde ela ainda significa alguma coisa: não há tecla para mostrar, há uma para pôr.
 *
 * 📌 Por API do DOM e não por cadeia: `keyName` devolve o nome LEGÍVEL de um código, e quem o lê amanhã pode
 * traduzi-lo — texto traduzido interpolado em markup é a porta que a issue #106 fechou.
 */
export function drawKeys(button: HTMLElement, codes: readonly string[]): void {
  button.textContent = '';
  if (!codes.length) { button.textContent = t('ctrl.change'); return; }
  for (const code of codes) {
    const key = button.ownerDocument.createElement('kbd');
    key.textContent = keyName(code);
    button.appendChild(key);
  }
}

export function initSettingsControls(ctx: SettingsControlsCtx): SettingsControlsApi {
  let kb = ctx.kb;
  let capture: CaptureState | null = null;
  let lastPlayer = 0;

  function schemesFor(): KeyScheme[] {
    const n = ctx.getNumPlayers();
    return Array.from({ length: n }, (_, i) => ctx.kbFor(i));
  }

  /**
   * COMO ESTE JOGO CHAMA esta posição, ou `null` se ele não a nomeia. Um sítio só, porque três pontos
   * precisavam dela e cada um a ia buscar por sua conta — e um deles ia buscá-la à tabela errada (#125).
   *
   * 🔴 O RECUO ERA O ID ABSTRATO (`?? a`), DEFENDIDO AQUI COM «`action3` é feio, mas é verdade». Era um
   * defeito, e o ADR-0074 chama-lhe isso em tantas palavras: «o nome que a CRIANÇA lê e ouve — na tela de
   * remapeamento, na bolha de toque, no anúncio — é sempre a palavra do jogo, nunca `action1`. Um nome
   * abstracto que chega a uma pessoa é um defeito.»
   *
   * ⚠️ E ESTAVA A UM TOQUE DE DISTÂNCIA, com o esquema PADRÃO desta engine: ele liga OITO posições e um quiz
   * nomeia três. A criança escolhia «Confirmar», carregava numa tecla que o padrão tinha em `action2`, e o
   * leitor de tela dizia «Essa tecla já é de action2» — precisamente a ela, que é quem não tem outro canal.
   *
   * 📌 A TERCEIRA SAÍDA JÁ ESTAVA DECIDIDA UM MÓDULO ABAIXO, e este ficheiro tinha decidido outra:
   * `core/actions.labellerFrom` devolve `null` «e quem chama decide — uma ausência vira menos um passo, nunca
   * um passo mudo». Duas respostas à mesma pergunta no mesmo repositório é o defeito que o `DomQuery` já
   * custou dezasseis vezes; agora são uma.
   */
  function gameWordFor(a: Action): string | null {
    return ctx.acoesDoJogo().find((x) => x.acao === a)?.rotulo ?? null;
  }

  function render(selPlayer: number): void {
    const el = ctx.$<HTMLElement>('#ctrl-list');
    if (!el) return;
    const n = ctx.getNumPlayers();
    const player = selPlayer >= n ? 0 : selPlayer;
    lastPlayer = player;

    // E3: sem abas de outros jogadores — você edita só o seu controle; só o hint muda com o modo.
    //
    // ⚠️ ESTA FRASE ESTAVA EM PORTUGUÊS CRU DENTRO DO MOTOR (#125), inteira, com o `<strong>` e o plural à
    // mão. Vai pelo `t()` agora — e o realce sobrevive porque o molde é PARTIDO no marcador `{modo}` antes
    // da substituição, em vez de o dicionário carregar markup (que o gate `i18n-sem-markup` proíbe, e com
    // razão: string de dicionário que vira markup é a porta por onde uma tradução passa a ser código).
    const tabs = ctx.$<HTMLElement>('#ctrl-players');
    if (tabs) {
      tabs.hidden = false;
      // O esqueleto por `innerHTML` — ele não tem dado nenhum de fora; o TEXTO entra por `textContent`, que
      // é o mesmo idioma que o `.ctrl-nome` abaixo já usa.
      tabs.innerHTML = '<span class="opt-hint" style="width:100%;margin:0">'
        + '<span data-modo="pre"></span><strong data-modo="v"></strong><span data-modo="pos"></span></span>';
      const [antes, depois] = t('ctrl.editingYours').split('{modo}');
      const setText = (sel: string, txt: string): void => {
        const el2 = tabs.querySelector<HTMLElement>(sel);
        if (el2) el2.textContent = txt;
      };
      setText('[data-modo="pre"]', antes ?? '');
      setText('[data-modo="v"]', n === 1 ? t('ctrl.mode.one') : t('ctrl.mode.many', { n }));
      setText('[data-modo="pos"]', depois ?? '');
    }

    const map = ctx.kbFor(player);
    /*
     * 🎯 AS LINHAS VÊM DO KIT desde 2026-09-22 (ADR-0129, nota BK), e as TECLAS mudaram de lugar: a cara do
     * botão passou a ser a tecla de agora, e a palavra «Mudar» saiu da tela. Decisão do Dev, perguntado em
     * tantas palavras se «Mudar» valia ser mantido: «Não vale, vamos de B».
     *
     * 🔴 E O MOTIVO NÃO FOI GOSTO, FOI UMA COLISÃO MEDIDA. A linha antiga carregava as teclas DENTRO do
     * `<span>` do rótulo, com um `<b>` no lugar do `<strong>` — e era o `<b>` que a tornava invisível ao
     * `fillExplain`, que desiste de qualquer linha sem rótulo curto. Com o `<strong>` que o kit emite, o
     * `fillExplain` passa a agir, e o que ele faz é `span.innerHTML = strong.outerHTML`: 📏 medido numa sonda
     * de navegador, das duas `<kbd>` sobreviviam ZERO, e o «: A Seta esquerda» ia para o rodapé como se fosse
     * explicação. O painel de remapeamento deixaria de mostrar o que está mapeado.
     *
     * 📌 E a saída é a que esta casa já tinha dado uma vez: o `mountSteps` tem o mesmo problema — rótulo mais
     * valor vivo — e resolve-o pondo o valor DENTRO do controle. Aqui o valor é a tecla, e o controle é o
     * botão que a troca.
     *
     * ⚠️ A palavra do jogo continua a entrar por `textContent` (o `controlRow` escreve o `rotulo` assim) e o
     * nome acessível por `setAttribute` (o kit escreve o `rotuloAria` assim). São as duas correcções que as
     * issues #106 e #125 custaram, e o kit preserva-as por construção em vez de por lembrança: `rotulo` é
     * TEXTO DO JOGO, que esta árvore não revê, e um `aria-label` errado SOBREPÕE-SE ao texto visível — foi o
     * «Alterar tecla de undefined do Jogador 1» medido em seis de doze botões do `game-soccer`.
     */
    const panelCtx: PanelShellCtx = { procurar: (sel) => ctx.$<HTMLElement>(sel), criar: (tag) => el.ownerDocument.createElement(tag) };
    el.textContent = '';
    for (const { acao: a, rotulo: label } of ctx.acoesDoJogo()) {
      const { linha: row, controle: control } = controlRow(panelCtx, {
        id: ctrlControlId(a),
        rotulo: label,
        forma: 'button',
        rotuloAria: t('ctrl.changeKeyAria', { acao: label, n: player + 1 }),
      });
      // `data-act` fica, e a diferença com o `rotulo` é a razão: `a` é o nome ABSTRATO da posição, que a
      // engine enumera em `core/actions`, e o `rotulo` é a palavra do JOGO (ADR-0086).
      control.dataset.act = a;
      drawKeys(control, map[a] ?? []);
      el.appendChild(row);
    }

    /**
     * A MARCA DE «SAIU DO PADRÃO» (ADR-0029), e este era o ÚLTIMO menu sem ela.
     *
     * ⚠️ E É O MENU ONDE ELA MAIS FALTAVA, porque é o único cuja razão de existir é mexer: uma criança que
     * remapeou as teclas percorria a lista, ouvia os nomes das acções, e nada lhe dizia onde ela própria tinha
     * alterado. Os três canais do ADR-0029 — cor, forma (anéis) e NOME — passam a valer aqui.
     *
     * ⚠️ O PADRÃO VEM DO CONSUMIDOR (`ctx.kbPadraoFor`) e não de uma tabela lida aqui, pela mesma razão que o
     * `kbFor` é injectado: o mapeamento «quantos jogadores → que balde» (`p2`/`p3`/`p4`) é dele, e uma segunda
     * cópia dessa regra divergiria da primeira.
     *
     * 🎯 E NÃO SE USA O `resetKB` PARA LER O PADRÃO, embora ele devolva exactamente a configuração de fábrica:
     * ele é DESTRUTIVO — `input/keyboard.resetKB` faz `store.remove(CKEY)` antes de devolver a cópia. Chamá-lo
     * a cada render apagaria o remapeamento da criança, e o estrago só apareceria no arranque seguinte.
     *
     * 📌 COMPARA-SE A LISTA DE CÓDIGOS, não a identidade do objecto: reatribuir a MESMA tecla não é uma
     * mudança, e uma criança que experimenta e volta atrás não pode ficar com a marca acesa para sempre.
     */
    {
      const padrao = ctx.kbPadraoFor(player);
      const atual = ctx.kbFor(player);
      const sameKeys = (a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean =>
        (a ?? []).length === (b ?? []).length && (a ?? []).every((k, i) => k === (b ?? [])[i]);
      for (const linha of el.querySelectorAll<HTMLElement>('.ctrl-row')) {
        const act = linha.querySelector<HTMLElement>('button[data-act]')?.dataset.act;
        if (!act || !isAction(act)) continue;
        markChanged(linha, !sameKeys(atual[act], padrao[act]));
      }
    }

    el.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((b) => {
      b.addEventListener('click', () => {
        // ⚠️ `isAction` E NÃO SÓ `if (!act)`: o valor vem de um atributo do DOM, e desde a #118 o esquema só
        // aceita as quatorze posições. Uma captura iniciada sobre uma posição inventada gravaria uma tecla
        // numa chave que transporte nenhum lê — a criança carregaria a tecla nova e nada aconteceria.
        const act = b.dataset.act;
        if (!act || !isAction(act)) return;
        // ⚠️ SEM PALAVRA, NÃO SE PERGUNTA — a regra do `labellerFrom`, aplicada onde ela é visível: «se o jogo
        // não a usa, não há o que mapear; uma ausência vira menos um passo, nunca um passo mudo». As linhas
        // vêm todas de `acoesDoJogo()`, logo isto não acontece hoje — e é essa garantia que fica escrita em
        // vez de assumida, porque quem a partir amanhã acorda um anúncio sem sujeito.
        const palavra = gameWordFor(act);
        if (!palavra) return;
        capture = { action: act, mapRef: map, player };
        b.textContent = t('ctrl.pressing'); // estava cravado em português isInside do motor (#125)
        ctx.srAlert(t('sr.ctrl.pressNewKey', { acao: palavra, n: player + 1 }));
      });
    });
    // A prosa volta para o rodapé depois de as linhas serem reconstruídas (CLAUDE.md §4, #109).
    // ⚠️ NO CARTÃO DE QUEM TEM A LISTA, e não num `#options` fixo: a engine monta este painel com outro id
    // (`#ctrl`, ADR-0151), e o rodapé de um painel que não está aberto não é o desta criança.
    ctx.fillExplain?.(el.closest<HTMLElement>('.overlay__card'));
  }

  function isCapturing(): boolean {
    return capture !== null;
  }

  function cancelCapture(): void {
    capture = null;
  }

  function handleCaptureKeydown(e: KeydownEventLike): boolean {
    if (!capture) return false;
    if (e.code === 'Escape') {
      capture = null;
      render(lastPlayer);
      e.preventDefault();
      return true;
    }
    const other = keyUsedByOther(e.code, capture.mapRef, schemesFor());
    if (other >= 0) {
      ctx.srAlert(t('sr.ctrl.keyTaken', { n: other + 1 }));
      e.preventDefault();
      return true; // não associa: segue capturando
    }
    // A MESMA guarda, dentro do próprio esquema (#126). Recusa em vez de MOVER, e a escolha tem motivo:
    // mover deixaria a ação antiga com lista vazia — que o `bindingProblems` classifica como problema, e que
    // a criança descobriria no meio do jogo, sem anúncio, com uma ação que deixou de existir. Recusar custa
    // dois passos (soltar a antiga, prender a nova) e não perde nada pelo caminho.
    const aqui = actionAlreadyBound(e.code, capture.mapRef, capture.action);
    if (aqui) {
      // ⚠️ `aqui` VEM DO ESQUEMA, e o esquema liga posições que o jogo pode não nomear — é por aqui que o id
      // abstracto chegava a uma criança. Sem palavra, a frase diz a verdade que INTERESSA («a tecla está
      // ocupada aqui») em vez do nome interno: calar seria o defeito gémeo, e dizer `action2` era o defeito.
      const palavra = gameWordFor(aqui);
      ctx.srAlert(palavra
        ? t('sr.ctrl.keyTakenHere', { acao: palavra })
        : t('sr.ctrl.keyTakenHereUnnamed'));
      e.preventDefault();
      return true; // não associa: segue capturando
    }
    capture.mapRef[capture.action] = [e.code];
    ctx.store.saveKB(kb);
    ctx.applyControls();
    ctx.assignControls();
    capture = null;
    render(lastPlayer);
    e.preventDefault();
    return true;
  }

  const resetBtn = ctx.$<HTMLButtonElement>('#ctrl-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      kb = ctx.store.resetKB();
      ctx.setKB(kb);
      ctx.applyControls();
      ctx.assignControls();
      render(lastPlayer);
      ctx.srSay(t('sr.ctrl.reset'));
    });
  }

  return { render, isCapturing, cancelCapture, handleCaptureKeydown };
}
