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
import { ACTIONS, isAction, type Action } from '../core/actions.js';
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

/** Physical key code -> short readable label. Only 'Space' has a word to translate; the rest are glyphs and
 *  bare letters, identical in every language (that is why this is a chain of replaces and not a table). */
export function keyName(code: string): string {
  return String(code)
    .replace('Arrow', '↔')
    .replace('Key', '')
    .replace('Space', t('key.space'))
    .replace('ShiftLeft', 'Shift')
    .replace('ShiftRight', 'Shift');
}

/**
 * Which OTHER player already owns `code`, among `schemes` (one entry per player, same order as player index) —
 * or -1 if free. `mapRef` (the scheme currently being edited) is excluded by reference, mirroring the original
 * `keyUsedByOther(code, mapRef)` closing over `kbFor`/numPlayers in game.js. Built over a Map (code -> owner
 * index) so a scheme with many bound keys doesn't cost a full re-scan per lookup.
 */
export function keyUsedByOther(code: string, mapRef: KeyScheme, schemes: readonly KeyScheme[]): number {
  const owners = new Map<string, number>();
  schemes.forEach((m, i) => {
    if (m === mapRef) return;
    for (const a of ACTIONS) for (const c of m[a] || []) if (!owners.has(c)) owners.set(c, i);
  });
  return owners.get(code) ?? -1;
}

/**
 * Qual OUTRA ação DO MESMO esquema já tem `code` — ou `null` se nenhuma.
 *
 * ⚠️ O IRMÃO QUE FALTAVA AO `keyUsedByOther`, E A FALTA ERA INVISÍVEL NUM JOGO DE UM JOGADOR (#126). Aquele
 * exclui o esquema em edição **por referência**; com um jogador só, `schemesFor()` devolve exatamente esse
 * esquema, então a guarda varre uma lista vazia e **nunca pode disparar**. A criança que põe `W` numa ação
 * nova continua com `W` na antiga, e passa o jogo inteiro com as duas a disparar juntas.
 *
 * ⚠️ E O DEFEITO É O PIOR FEITIO POSSÍVEL, escrito no cabeçalho do `input/default-bindings` desde sempre:
 * «as duas ações disparam juntas, e a criança vê uma ação dupla intermitente que ninguém consegue reproduzir
 * de propósito». Numa tela que ela abriu **porque** não conseguia usar os controles padrão.
 *
 * ⚠️ A guarda entre JOGADORES não estava partida — estava inalcançável. Medido na auditoria: com dois
 * assentos ela funciona e recusa certo. O que faltava era a verificação dentro do mesmo esquema.
 *
 * Devolve a AÇÃO e não um booleano, porque o anúncio tem de dizer qual — «essa tecla já está em uso» manda a
 * criança procurar o que a função já sabe.
 */
export function acaoQueJaTem(code: string, mapRef: KeyScheme, exceto: Action): Action | null {
  for (const a of ACTIONS) {
    if (a === exceto) continue;
    if ((mapRef[a] || []).includes(code)) return a;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

interface CaptureState { action: Action; mapRef: KeyScheme; player: number }

export function initSettingsControls(ctx: SettingsControlsCtx): SettingsControlsApi {
  let kb = ctx.kb;
  let capture: CaptureState | null = null;
  let lastPlayer = 0;

  function schemesFor(): KeyScheme[] {
    const n = ctx.getNumPlayers();
    return Array.from({ length: n }, (_, i) => ctx.kbFor(i));
  }

  /**
   * COMO ESTE JOGO CHAMA esta posição. Um sítio só, porque três pontos precisavam dela e cada um a ia
   * buscar por sua conta — e um deles ia buscá-la à tabela errada (#125).
   *
   * O recuo é o id ABSTRATO da posição: `action3` é feio, mas é verdade. Uma palavra errada não é.
   */
  function palavraDaAcao(a: Action): string {
    return ctx.acoesDoJogo().find((x) => x.acao === a)?.rotulo ?? a;
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
      const posto = (sel: string, txt: string): void => {
        const el2 = tabs.querySelector<HTMLElement>(sel);
        if (el2) el2.textContent = txt;
      };
      posto('[data-modo="pre"]', antes ?? '');
      posto('[data-modo="v"]', n === 1 ? t('ctrl.mode.one') : t('ctrl.mode.many', { n }));
      posto('[data-modo="pos"]', depois ?? '');
    }

    const map = ctx.kbFor(player);
    // ⚠️ O `rotulo` SAIU DO MARKUP (issue #106) e entra logo abaixo por `textContent`. Ele é a PALAVRA do
    // jogo — vem do preset —, e um jogo vive noutro repositório (ADR-0083): esta árvore não revê esse texto.
    // `data-act="${a}"` fica, e a diferença é a razão: `a` é o nome ABSTRATO da ação, que a engine enumera em
    // `core/actions`. É separação que o ADR-0086 fez, e é ela que torna um dos dois seguro e o outro não.
    el.innerHTML = ctx.acoesDoJogo().map(({ acao: a }) =>
      `<div class="ctrl-row"><span><b class="ctrl-nome"></b>: ${(map[a] || []).map(keyName).map((k) => `<kbd>${k}</kbd>`).join(' ')}</span>` +
      `<button class="mode-btn" data-act="${a}" type="button">${t('ctrl.change')}</button></div>`
    ).join('');

    // As palavras do jogo, por API do DOM — que escapa por construção. A ordem casa porque é a mesma lista.
    //
    // ⚠️ O `aria-label` DESCEU PARA CÁ, E É A CORREÇÃO DA #125. Ele era montado no template acima a partir do
    // `ACT_LABEL`, que ficou a ser a tabela do JOGO DE PLATAFORMA quando a #106 mudou o rótulo visível para o
    // `acoesDoJogo()`. Medido no `game-soccer`: **«Alterar tecla de undefined do Jogador 1» em seis de doze
    // botões**, enquanto uma criança que vê lia «Conter» na mesma linha. E um `aria-label` SOBREPÕE-SE ao
    // texto visível, então quem depende do leitor de tela ouvia a palavra errada nos outros seis — que é pior
    // do que não ter `aria-label` nenhum, e invisível de dentro da engine, porque a plataforma é o único
    // consumidor para o qual a tabela está certa.
    //
    // ⚠️ E DESCEU POR `setAttribute` E NÃO PARA O TEMPLATE, de propósito: o `rotulo` é TEXTO DO JOGO. Metê-lo
    // num `aria-label="…"` dentro de um template literal seria interpolar texto de fora em markup — o mesmo
    // motivo pelo qual o `.ctrl-nome` já entrava por `textContent`.
    {
      const linhas = el.querySelectorAll<HTMLElement>('.ctrl-row');
      const palavras = ctx.acoesDoJogo();
      for (let i = 0; i < linhas.length && i < palavras.length; i++) {
        const nome = linhas[i]!.querySelector<HTMLElement>('.ctrl-nome');
        if (nome) nome.textContent = palavras[i]!.rotulo;
        const botao = linhas[i]!.querySelector<HTMLElement>('button[data-act]');
        if (botao) botao.setAttribute('aria-label', t('ctrl.changeKeyAria', { acao: palavras[i]!.rotulo, n: player + 1 }));
      }
    }

    el.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((b) => {
      b.addEventListener('click', () => {
        // ⚠️ `isAction` E NÃO SÓ `if (!act)`: o valor vem de um atributo do DOM, e desde a #118 o esquema só
        // aceita as quatorze posições. Uma captura iniciada sobre uma posição inventada gravaria uma tecla
        // numa chave que transporte nenhum lê — a criança carregaria a tecla nova e nada aconteceria.
        const act = b.dataset.act;
        if (!act || !isAction(act)) return;
        capture = { action: act, mapRef: map, player };
        b.textContent = t('ctrl.pressing'); // estava cravado em português dentro do motor (#125)
        ctx.srAlert(t('sr.ctrl.pressNewKey', { acao: palavraDaAcao(act), n: player + 1 }));
      });
    });
    // A prosa volta para o rodapé depois de as linhas serem reconstruídas (CLAUDE.md §4, #109).
    ctx.fillExplain?.(ctx.$<HTMLElement>('#options .overlay__card'));
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
    const aqui = acaoQueJaTem(e.code, capture.mapRef, capture.action);
    if (aqui) {
      ctx.srAlert(t('sr.ctrl.keyTakenHere', { acao: palavraDaAcao(aqui) }));
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
