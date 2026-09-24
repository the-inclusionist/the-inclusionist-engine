// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-visual — the "Acessibilidade visual" overlay: high-contrast level, L→Q contrast enhancement,
// owner-colored items, CB-safe (Okabe-Ito) palette, color-blocking role colors, and the two outline selects
// (foreground/background). `selVizPlayer` (chosen player), `setPlayerViz`/`setLq`/`setOwnerColors`/`setCbSafe`/
// `setOutlineFg`/`setOutlineBg`/`setRoleColor`/`resetRoleColors` are INJECTED — they mutate PIXI texture caches
// and rebake the world (`_rebakeDirect`/`rebuildExtras`), which stay in game.js. `numPlayers`/`players` are read
// live from core/state.js (same source game.js itself uses). Extracted verbatim from renderVisual() in game.js
// (behavior-preserving) — see docs/5-Refactoring/plano-modularizacao-mapa.md.

import { t } from '../core/i18n.js';
import { mountSteps, updateSteps, nextStep, controlRow, labelRow, type ControlRowSpec } from './panel-widgets.js';
import type { PanelShellCtx } from './panel-shell.js';


// As cores PADRÃO dos quatro papéis, de render/hc-role-data (folha, sem dependências) — a mesma fonte que o
// render/high-contrast usa para repintar os tiles. Aqui elas servem só para dizer se a criança mudou alguma.
import { HC_ROLE_DEF } from '../render/hc-role-data.js';
import { DEFAULTS } from '../core/state.js';
/*
 * 📌 A METADE PURA SAIU PARA `ui/visual-choices` (ADR-0221 passo 7c), e quem apontou a costura foi a SUÍTE: o
 * `tests/settings-visual.node.test.js` importava exactamente aqueles nomes e mais nada, e o projecto node não monta
 * documento — logo quem escreveu aqueles casos teve de saber onde este painel deixa de ser um painel.
 *
 * ⚠️ SEM APELIDO, como nos três cortes iguais que vieram antes (`audio-choices`, `typo-choices`, `control-choices`):
 * um re-export manteria vivo um caminho que nada aqui dentro usa e faria o retrato da superfície mentir, porque ele
 * não vê re-exports (issue #204).
 */
import {
  ROLE_KEYS, ROLE_LABELS, LQ_STEPS, lqLabel, lqPosition, clampSelectedPlayer, rgbToHex, onOffLabel, resolveVisualMode,
  VISUAL_MODES, type RGB, type RoleKey,
} from './visual-choices.js';
// O padrao dos DOIS EIXOS (ADR-0076/#104). A marca pergunta ao modelo novo, nao ao espelho p.viz.
import { DEFAULT_VISUAL as PADRAO_VISUAL } from '../render/viz-axes.js';
import { markChanged, markMenuChanged } from './changed-mark.js';

/** Live snapshot of the state this panel does not own — read fresh on every render(). */
export interface VisualSettings {
  lq: number; // 0..1, L→Q contrast enhancement
  ownerColors: boolean;
  cbSafe: boolean;
  outlineFg: number; // 0=none 1=thin 2=thick
  outlineBg: number;
  roleColors: Record<RoleKey, RGB>;
}

export interface SettingsVisualCtx {
  /** Quantos jogadores/telas. Estado de RODADA (ADR-0038): vem da instância que a raiz possui.
   *  Era `numPlayers`, um `let` de `core/state` importado como binding vivo — e um `let` de módulo
   *  é compartilhado por qualquer segundo jogo que a mesma página carregue (D13 do `demos`). */
  getNumPlayers: () => number;
  /** Os jogadores. Estado de RODADA, pelo mesmo motivo. `readonly unknown[]` porque cada consumidor
   *  estreita para a SUA fatia — o tipo real é do jogo, não da engine (ADR-0033). */
  getPlayers: () => readonly unknown[];
  $: <T extends Element = Element>(sel: string) => T | null;
  srSay: (text: string) => void;
  /** Fresh read of lq/ownerColors/cbSafe/outlineFg/outlineBg/roleColors (game.js live vars). */
  getVisualSettings: () => VisualSettings;
  /** `selVizPlayer` — shared with the Empathy panel; owned by game.js. */
  getSelectedPlayer: () => number;
  setSelectedPlayer: (i: number) => void;
  /** Same setPlayerViz used by the Empathy panel and the physical contrast-cycle shortcut. */
  setPlayerViz: (i: number, mode: string) => void;
  /** Desenha UMA lista de rádio de modos visuais (+ abas por jogador). O MESMO helper que o painel de
   *  empatia usa — de propósito: as três correções mudaram de menu, e mudar junto a aparência delas faria a
   *  criança ter de reaprender um controle que ela já conhecia. */
  /**
   * Os DOIS eixos deste painel (#104). Substituiu o `renderVizGroup`, que fica com o painel de EMPATIA.
   *
   * ⚠️ A lista de sete que este painel oferecia era a forma honesta de contar uma exclusividade REAL, e o
   * `VISUAL_MODES` explica-a em prosa logo acima. Ela deixou de existir: o estado tem dois eixos, e os
   * escritores por eixo mexem num sem tocar no outro.
   */
  renderVisualAxes: (listSel: string, tabsSel: string) => void;
  setLq: (t: number) => void;
  setOwnerColors: (on: boolean) => void;
  setCbSafe: (on: boolean) => void;
  setOutlineFg: (level: number) => void;
  setOutlineBg: (level: number) => void;
  setRoleColor: (key: RoleKey, hex: string) => void;
  resetRoleColors: () => void;
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
  /** Which host-specific rows to draw (see `VisualRowsOffered`). Absent = all, as before. */
  offer?: VisualRowsOffered;
}


/**
 * Lê `player[i].visual` defensivamente, sem importar o tipo do jogador — o mesmo molde do `playerViz` abaixo,
 * e pela mesma razão: `getPlayers()` devolve `readonly unknown[]` porque o tipo real é do JOGO (ADR-0033), e
 * cada consumidor estreita para a SUA fatia.
 *
 * ⚠️ Sem jogador ou sem o campo, devolve o PADRÃO — que é a resposta certa para «esta criança mexeu em
 * alguma coisa?»: quem não existe não mexeu. Inventar `hc7` aqui marcaria um menu que ninguém tocou.
 */
function playerVisual(list: readonly unknown[], i: number): { theme: string; correction: string } {
  const v = (list[i] as { visual?: { tema?: unknown; correcao?: unknown } } | undefined)?.visual;
  return {
    theme: typeof v?.tema === 'string' ? v.tema : PADRAO_VISUAL.tema,
    correction: typeof v?.correcao === 'string' ? v.correcao : PADRAO_VISUAL.correcao,
  };
}

/** Reads player[i].viz defensively (no player at that index -> 'normal'), without a Player type import. */
function playerViz(list: readonly unknown[], i: number): string {
  const p = list[i] as { viz?: unknown } | undefined;
  return typeof p?.viz === 'string' ? p.viz : 'normal';
}


/**
 * The rows a host OFFERS beyond the two every host can drive (contrast enhancement and the safe palette).
 *
 * ⚠️ Owner colours and the colour-blocking roles belong to a game that has item owners and «lava, ladder, water, gate»
 * roles; the engine's own panel (`createGame`) has no writer for either and must not describe a game it does not know.
 * The default keeps every existing consumer's panel exactly as it was.
 */
export interface VisualRowsOffered { readonly owner: boolean; readonly roles: boolean }
const EVERY_ROW_OFFERED: VisualRowsOffered = { owner: true, roles: true };

/** A linha dos ITENS NA COR DO DONO, já traduzida. Interruptor, que é a forma de onze dos dezassete controles medidos. */
function ownerRowSpec(): ControlRowSpec {
  return { id: 'opt-ownercolors', label: t('visual.dono'), hint: t('visual.dono.dica') };
}

/** A linha da PALETA SEGURA (Okabe-Ito), já traduzida. */
function cbSafeRowSpec(): ControlRowSpec {
  return { id: 'opt-cbsafe', label: t('visual.cbsafe'), hint: t('visual.cbsafe.dica') };
}

/**
 * Monta o interior deste painel UMA VEZ. Chamada de novo, REETIQUETA em vez de reconstruir.
 *
 * 🔴 ISTO ERA `innerHTML` A CADA RENDER, e a reconstrução custava mais do que a duplicação de marcação que o kit
 * existe para acabar. 📏 Medido em 2026-09-23: o controle de PASSOS do realce de contraste era refeito a cada render
 * — um clique em qualquer outra linha do painel tirava o cursor de cima dele —, porque o `innerHTML` repunha o lugar
 * vazio e o `mountSteps` construía um elemento novo. E a raiz teve de montar a linha do dono FORA desta lista, com um
 * id próprio (`#opt-dono`), justamente porque um `innerHTML` daqui apagaria qualquer nó que ela inserisse.
 *
 * ⚠️ Reetiquetar e não reconstruir, pela razão que o `labelRow` já escreve: as escutas ligam-se no arranque, e refazer
 * a linha deixaria um controle no documento e sem escuta — um botão morto com aparência de vivo (ADR-0106 §5).
 */
function mountVisualInside(ctx: PanelShellCtx, list: HTMLElement, offered: VisualRowsOffered = EVERY_ROW_OFFERED): void {
  /*
   * 🔴 O REALCE DE CONTRASTE, EM PASSOS E COM A PROSA NO SÍTIO CERTO (ADR-0151). O Dev viu a explicação DENTRO da
   * linha: ela vinha colada ao rótulo e dependia de o hospedeiro passar o `fillExplain` para descer ao rodapé. Mora
   * num `.opt-hint` desde a nascença (`CLAUDE.md` §4), e O RÓTULO VAI PARA DENTRO DOS PASSOS — «◀ Realce de
   * contraste: linear ▶» (errata do ADR-0130). Quem lhe põe o controle é o `render`, que sabe a posição de agora.
   */
  let enhanceRow = list.querySelector<HTMLElement>('.ctrl-row--passos');
  if (!enhanceRow) {
    enhanceRow = ctx.create('div');
    enhanceRow.className = 'ctrl-row ctrl-row--passos';
    const envelope = ctx.create('span');
    const newHint = ctx.create('span');
    newHint.className = 'opt-hint';
    envelope.appendChild(newHint);
    enhanceRow.appendChild(envelope);
    const placeholder = ctx.create('span');
    placeholder.setAttribute('data-passos-lugar', 'lq');
    enhanceRow.appendChild(placeholder);
    list.appendChild(enhanceRow);
  }
  const enhanceHint = enhanceRow.querySelector<HTMLElement>('.opt-hint');
  if (enhanceHint) enhanceHint.textContent = t('visual.lq.dica');

  for (const spec of [...(offered.owner ? [ownerRowSpec()] : []), cbSafeRowSpec()]) {
    const already = ctx.find('#' + spec.id)?.closest<HTMLElement>('.ctrl-row');
    if (already) labelRow(already, spec);
    else list.appendChild(controlRow(ctx, spec).row);
  }

  if (offered.roles) mountRoleColoursRow(ctx, list);
}

/**
 * A linha dos QUATRO PAPÉIS, e a única deste painel que o kit não constrói.
 *
 * 📌 E NÃO POR FALTA DE UMA SEXTA FORMA: o `controlRow` monta «um rótulo, uma dica, UM controle», e esta linha tem
 * CINCO — quatro amostras de cor e o ↺ que as repõe. Inventar uma forma para ela seria dar uma segunda resposta à
 * pergunta «o que é uma linha», que é exactamente o que o kit existe para não deixar acontecer. Fica em nós, com a
 * mesma disciplina do resto: montada uma vez, reetiquetada depois.
 *
 * 📌 A MOLDURA TRADUZ, O NOME DO PAPEL ATRAVESSA (`CLAUDE.md` §A FRONTEIRA, reafirmado pelo Dev em 22/09): «Cor de» é
 * da engine e passa por `t()`; «perigo (lava)» é a palavra do JOGO que monta este painel, e a engine não a traduz nem
 * a inventa — ela atravessa por `{param}`, logo a frase continua verdadeira num cartucho com outros papéis.
 */
function mountRoleColoursRow(ctx: PanelShellCtx, list: HTMLElement): void {
  let row = ctx.find('#opt-role-reset')?.closest<HTMLElement>('.ctrl-row') ?? null;
  if (!row) {
    row = ctx.create('div');
    row.className = 'ctrl-row';
    const envelope = ctx.create('span');
    envelope.appendChild(ctx.create('strong'));
    const newHint = ctx.create('span');
    newHint.className = 'opt-hint';
    envelope.appendChild(newHint);
    row.appendChild(envelope);
    const swatches = ctx.create('span');
    swatches.style.cssText = 'display:flex;gap:.35rem;align-items:center';
    for (const k of ROLE_KEYS) {
      const swatch = ctx.create('input');
      swatch.id = 'opt-role-' + k;
      swatch.setAttribute('type', 'color');
      swatch.style.cssText = 'inline-size:2.2em;block-size:1.8em;padding:0;border:1px solid #666;border-radius:4px;background:none';
      swatches.appendChild(swatch);
    }
    const resetButton = ctx.create('button');
    resetButton.id = 'opt-role-reset';
    resetButton.className = 'mode-btn';
    resetButton.setAttribute('type', 'button');
    resetButton.textContent = '↺';
    swatches.appendChild(resetButton);
    row.appendChild(swatches);
    list.appendChild(row);
  }
  const label = row.querySelector<HTMLElement>('strong');
  if (label) label.textContent = t('visual.papeis');
  const hint = row.querySelector<HTMLElement>('.opt-hint');
  if (hint) hint.textContent = t('visual.papeis.dica');
  for (const k of ROLE_KEYS) {
    ctx.find('#opt-role-' + k)?.setAttribute('aria-label', t('visual.papel.cor', { papel: ROLE_LABELS[k] }));
  }
  ctx.find('#opt-role-reset')?.setAttribute('aria-label', t('visual.papel.repor'));
}

/** Duas cores de papel são a mesma? Comparação por componente — `[0,0,0] === [0,0,0]` é `false` em JS, e
 *  esse `false` diria "alterado" para uma cor que ninguém tocou, mandando a criança desfazer o que não fez. */
// 🎯 DEIXOU DE SER PUBLICADA em vez de mudar de casa: era dívida declarada no livro dos exports e os dois leitores
// dela estão aqui, a um ecrã de distância. Levá-la para `ui/visual-choices` seria mudar a dívida de morada.
function sameRgb(a: RGB | undefined, b: RGB | undefined): boolean {
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// ---------- Thin DOM shell ----------

export interface SettingsVisual {
  /** Rebuilds #visual-list and (re)wires its controls — call whenever the panel should reflect fresh state. */
  render: () => void;
}

export function initSettingsVisual(ctx: SettingsVisualCtx): SettingsVisual {
  /*
   * 📌 O CTX DO KIT SAI DO PRÓPRIO NÓ DA LISTA, e não de um `document` global nem de um campo novo no contrato.
   * `ownerDocument` é o documento onde aquela lista VIVE — que é exactamente o documento em que as linhas têm de
   * nascer —, então o alcance global deste módulo continua ZERO (ADR-0221 passo 7d) e `SettingsVisualCtx`, que é
   * superfície publicada, não ganha membro obrigatório (ADR-0172). É o mesmo molde do `ui/settings-caa`.
   */
  const kitCtx = (list: HTMLElement): PanelShellCtx => ({
    find: (sel) => ctx.$<HTMLElement>(sel),
    create: (tag) => list.ownerDocument.createElement(tag),
  });

  /** A posição do realce é LOCAL ao controle: o `setLq` injectado pode não devolver o valor novo em
   *  `getVisualSettings` até ao próximo render, e reler dali voltaria a posição para trás. */
  let enhanceStep = lqPosition(ctx.getVisualSettings().lq);
  const enhanceSpec = () => ({ label: t('visual.lq'), values: LQ_STEPS.map((v) => t(lqLabel(v))), current: enhanceStep });

  /** As escutas ligam-se UMA VEZ. Um segundo `addEventListener` no mesmo botão dá dois cliques por clique. */
  let wired = false;
  function wireOnce(list: HTMLElement): void {
    if (wired) return;
    wired = true;
    const placeholder = ctx.$<HTMLElement>('[data-passos-lugar="lq"]');
    if (placeholder) {
      const stepper = mountSteps(kitCtx(list), enhanceSpec());
      stepper.id = 'opt-lq';
      placeholder.replaceWith(stepper);
      stepper.addEventListener('passo', (ev) => {
        const nextIndex = nextStep(enhanceStep, LQ_STEPS.length, (ev as CustomEvent<number>).detail);
        if (nextIndex === enhanceStep) return; // na ponta não se anuncia um passo que não aconteceu
        enhanceStep = nextIndex;
        ctx.setLq(LQ_STEPS[enhanceStep] as number);
        updateSteps(stepper, enhanceSpec());
        ctx.srSay(t('sr.visual.lq', { v: t(lqLabel(LQ_STEPS[enhanceStep] as number)) }));
      });
    }
    const oc = ctx.$<HTMLButtonElement>('#opt-ownercolors');
    if (oc) oc.addEventListener('click', () => { ctx.setOwnerColors(!ctx.getVisualSettings().ownerColors); render(); });
    const cb = ctx.$<HTMLButtonElement>('#opt-cbsafe');
    if (cb) cb.addEventListener('click', () => { ctx.setCbSafe(!ctx.getVisualSettings().cbSafe); render(); });
    for (const k of ROLE_KEYS) {
      const inp = ctx.$<HTMLInputElement>('#opt-role-' + k);
      if (inp) inp.addEventListener('change', () => ctx.setRoleColor(k, inp.value));
    }
    const rr = ctx.$<HTMLButtonElement>('#opt-role-reset');
    if (rr) rr.addEventListener('click', () => { ctx.resetRoleColors(); render(); });
  }

  /** O que os controles MOSTRAM — o estado, que antes vinha assado na marcação e agora é escrito a cada render. */
  function reflectControls(s: VisualSettings): void {
    for (const [sel, on] of [['#opt-ownercolors', s.ownerColors], ['#opt-cbsafe', s.cbSafe]] as const) {
      const b = ctx.$<HTMLButtonElement>(sel);
      if (!b) continue;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = onOffLabel(on);
    }
    for (const k of ROLE_KEYS) {
      const inp = ctx.$<HTMLInputElement>('#opt-role-' + k);
      if (inp) inp.value = rgbToHex(s.roleColors[k]);
    }
    const stepper = ctx.$<HTMLElement>('#opt-lq');
    if (stepper) updateSteps(stepper, enhanceSpec());
  }

  function reflectOutlines(): void {
    const s = ctx.getVisualSettings();
    const f = ctx.$<HTMLSelectElement>('#opt-outline-fg');
    if (f) f.value = String(s.outlineFg);
    const b = ctx.$<HTMLSelectElement>('#opt-outline-bg');
    if (b) b.value = String(s.outlineBg);
  }

  // Outline selects live in static HTML outside #visual-list (untouched by innerHTML rebuilds) -> wire once.
  const outFg = ctx.$<HTMLSelectElement>('#opt-outline-fg');
  if (outFg) outFg.addEventListener('change', () => ctx.setOutlineFg(+outFg.value));
  const outBg = ctx.$<HTMLSelectElement>('#opt-outline-bg');
  if (outBg) outBg.addEventListener('change', () => ctx.setOutlineBg(+outBg.value));
  reflectOutlines();

  function render(): void {
    const el = ctx.$<HTMLElement>('#visual-list');
    if (!el) return;

    const rawSelected = ctx.getSelectedPlayer();
    const selected = clampSelectedPlayer(rawSelected, ctx.getNumPlayers());
    if (selected !== rawSelected) ctx.setSelectedPlayer(selected);

    const contrastValue = resolveVisualMode(playerViz(ctx.getPlayers(), selected));
    const settings = ctx.getVisualSettings();
    // ⚠️ `renderEixosVisuais` E NÃO `renderVizGroup` desde a #104: este painel passou a ter DOIS controles,
    // e o `renderVizGroup` continua a servir o painel de EMPATIA, cuja lista de simulações é mesmo exclusiva.
    // Trocar o corpo daquela função em vez de acrescentar esta teria posto os dois eixos na lista de
    // simulações — foi o que quase aconteceu, e o que a separação impede.
    ctx.renderVisualAxes('#visual-modes', '#visual-players');
    void contrastValue; // lido pelo `refreshMarks`, que compara pelo modelo novo e não por este espelho
    mountVisualInside(kitCtx(el), el, ctx.offer);
    wireOnce(el);
    reflectControls(settings);
    reflectOutlines();
    refreshMarks();
    // A prosa volta para o rodapé depois de as linhas serem reconstruídas (CLAUDE.md §4, #109).
    ctx.fillExplain?.(ctx.$<HTMLElement>('#visual .overlay__card'));
  }

  /**
   * A marca de "saiu do padrão" (ADR-0029). Cada linha contra o SEU padrão, e o botão do menu por cima.
   *
   * O contraste é comparado pelo valor RESOLVIDO, não pelo `viz` cru: quem está com uma simulação ou uma
   * O modo visual é comparado pelo valor RESOLVIDO: quem está com uma SIMULAÇÃO ligada (empatia) tem
   * `resolveVisualMode` respondendo 'normal', que é a verdade sobre ESTE menu — aquele modo não saiu do
   * padrão daqui, e é no menu de empatia que a marca precisa aparecer para levar a criança ao lugar certo.
   */
  function refreshMarks(): void {
    const s = ctx.getVisualSettings();
    /**
     * 🔴 A MARCA É POR EIXO DESDE 2026-09-08, e a granularidade que ela recupera foi perdida por mim na #104
     * etapa 4d. Enquanto o `#visual-modes` era UM rádio de sete opções, marcar o contentor era marcar a
     * escolha. A etapa 4d pôs DOIS eixos lá dentro, e uma marca no contentor deixou de dizer QUAL saiu do
     * padrão — que é o terceiro canal do ADR-0029 a perder informação: «a criança cega percorre o menu e OUVE,
     * em ordem, o que saiu do padrão». Ouvir «mudado» sem saber de quê manda-a procurar em oito linhas.
     *
     * ⚠️ E VEM DO MODELO NOVO. Isto era `resolveVisualMode(playerViz(...))`, que lê o `p.viz` que a etapa 1a
     * marcou `@deprecated` — um leitor que ficou para trás na migração.
     *
     * 📌 E A REGRA DA SIMULAÇÃO DEIXA DE SER DERIVADA E PASSA A SER ESTRUTURAL, que é o ganho de fundo. Ela
     * está escrita logo acima: uma simulação de empatia não marca ESTE menu, porque a marca dela pertence ao
     * menu de empatia e é lá que ela leva a criança. Antes isso dependia de o `resolveVisualMode` responder
     * `normal`; agora a simulação vive noutro campo do `VisualState`, e perguntar pelo tema e pela correcção
     * nunca a alcança.
     */
    const visual = playerVisual(ctx.getPlayers(), ctx.getSelectedPlayer());
    const themeChanged = visual.theme !== PADRAO_VISUAL.tema;
    const correctionChanged = visual.correction !== PADRAO_VISUAL.correcao;
    const rowOfCheckedAxis = (axis: string): HTMLElement | null =>
      ctx.$<HTMLElement>(`#visual-modes button[data-eixo="${axis}"][aria-checked="true"]`)
        ?.closest<HTMLElement>('.ctrl-row') ?? null;
    const lqOff = s.lq !== DEFAULTS.lq;
    const owner = s.ownerColors !== DEFAULTS.ownerColors;
    const cb = s.cbSafe !== DEFAULTS.cbSafe;
    const fg = s.outlineFg !== DEFAULTS.hcOutlineFg;
    const bg = s.outlineBg !== DEFAULTS.hcOutlineBg;
    const rolesChanged = ROLE_KEYS.some((k) => !sameRgb(s.roleColors[k], HC_ROLE_DEF[k]));
    const rowOf = (sel: string): HTMLElement | null =>
      ctx.$<HTMLElement>(sel)?.closest<HTMLElement>('.ctrl-row') ?? null;
    markChanged(rowOfCheckedAxis('tema'), themeChanged);
    markChanged(rowOfCheckedAxis('correcao'), correctionChanged);
    markChanged(rowOf('#opt-lq'), lqOff);
    markChanged(rowOf('#opt-ownercolors'), owner);
    markChanged(rowOf('#opt-cbsafe'), cb);
    markChanged(rowOf('#opt-outline-fg'), fg);
    markChanged(rowOf('#opt-outline-bg'), bg);
    markChanged(rowOf('#opt-role-reset'), rolesChanged);
    markMenuChanged(ctx.$<HTMLElement>('[data-act="visual"]'), [themeChanged, correctionChanged, lqOff, owner, cb, fg, bg, rolesChanged]);
  }

  // ---- restaurar os padrões DESTE menu (ADR-0028) ----
  //
  // `p.viz` é UM campo compartilhado com o menu de empatia, então o reset só pode zerá-lo quando o que
  // estiver lá for um modo DESTE menu. Se a criança está com uma simulação de baixa visão ou de cegueira
  // ligada, este botão não tem nada a dizer sobre isso.
  //
  // As correções de daltonismo AGORA entram no que ele zera, e isso mudou com a #60: elas passaram a morar
  // aqui. Desfazê-las é legítimo porque a criança as reencontra no MESMO seletor que acabou de usar — a
  // regra é "um reset só pode desfazer o que ele também consegue refazer", e aqui ela é satisfeita. Por isso
  // o anúncio nomeia o modo visual entre o que voltou.
  //
  // As LEGENDAS (#opt-captions) estão nesta tela mas ficam de fora: quem as liga e persiste é o main.js, e a
  // pergunta de a qual menu elas pertencem está aberta (#58 — são uma acomodação de surdez morando no menu
  // visual). Puxá-las para cá agora responderia essa pergunta por acidente, num commit sobre outra coisa.
  const resetBtn = ctx.$<HTMLButtonElement>('#visual-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    ctx.getPlayers().forEach((_p, i) => {
      const viz = playerViz(ctx.getPlayers(), i);
      if (VISUAL_MODES.includes(viz) && viz !== 'normal') ctx.setPlayerViz(i, 'normal');
    });
    const s = ctx.getVisualSettings();
    if (s.lq !== DEFAULTS.lq) ctx.setLq(DEFAULTS.lq);
    if (s.ownerColors !== DEFAULTS.ownerColors) ctx.setOwnerColors(DEFAULTS.ownerColors);
    if (s.cbSafe !== DEFAULTS.cbSafe) ctx.setCbSafe(DEFAULTS.cbSafe);
    if (s.outlineFg !== DEFAULTS.hcOutlineFg) ctx.setOutlineFg(DEFAULTS.hcOutlineFg);
    if (s.outlineBg !== DEFAULTS.hcOutlineBg) ctx.setOutlineBg(DEFAULTS.hcOutlineBg);
    if (ROLE_KEYS.some((k) => !sameRgb(s.roleColors[k], HC_ROLE_DEF[k]))) ctx.resetRoleColors();
    render();
    ctx.srSay(t('sr.visual.reset'));
  });

  return { render };
}
