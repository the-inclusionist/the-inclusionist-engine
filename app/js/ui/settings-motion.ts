// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-motion.ts — "Sensibilidade visual" → painel Movimento (#animation overlay): reduce-motion (WCAG
// 2.3.3 + Pause/Stop/Hide 2.2.2) por PERSONAGEM (andar/respirar/gracinhas) e por CENA (parallax/decor/itens/
// partículas), o botão-mestre "Parar/Retomar todas as animações", a seleção de jogador (selAnimPlayer) e a
// estética CRT (scanlines/vinheta/cantos) — que também mora nesta MESMA tela no game.js original (renderMotion
// escreve os dois blocos no mesmo #motion-list), por isso vem junto. Lógica PURA (rótulos, HTML, allMotionFrozen,
// anúncios) separada do DOM. INJETADO via initSettingsMotion(ctx): $ (seletor), srSay, store (persistência),
// frontOverlay/toggleBtn (helpers compartilhados com os painéis irmãos: visual/audio/typo/empathy/controls/
// motor), e rm/saveRM/RM_KEYS/RM_CHAR (estado de movimento reduzido — fica em game.js porque applyCalm(), o
// modo TEA, também os usa; não é exclusivo deste painel). `players`/`numPlayers` (core/state.ts) e CRT/applyCrt
// (render/crt.ts, já extraído) são importados DIRETO — são módulos-folha, não game.js. A API de render/fx.ts
// NÃO é referenciada aqui: renderMotion() nunca leu/escreveu JUICE (só o painel ?debug o faz) — ver nota no
// retorno da extração antes de assumir que falta wiring.
import { toggleLabel, toggleAria } from './dom.js';

import { CRT, CRT_DEFAULT, applyCrt } from '../render/crt.js';
import { defaultReducedMotion } from '../core/state.js';
import { markChanged, markMenuChanged } from './changed-mark.js';
import { t } from '../core/i18n.js';
import { montarPassos, atualizarPassos, passoSeguinte } from './panel-widgets.js';

import { CHAVES_DE_CENA, ANIMACOES_DO_PERSONAGEM, lerCenaGuardada, guardarCena } from './motion-scene.js';
import { escapeHtml } from '../core/escape-html.js';
import type {
  MotionSceneKey as ChaveDeCenaLeaf,
  MotionCharProp as PropDoPersonagemLeaf,
  MotionCharDef as DefDoPersonagemLeaf,
  MotionPlayer as JogadorDeMovimentoLeaf,
  MotionSceneFlags as BandeirasDeCenaLeaf,
} from './motion-scene.js';

/*
 * ⚠️ O VOCABULÁRIO MUDOU DE CASA, E OS NOMES FICARAM. As cinco declarações que estavam aqui passaram para
 * `ui/motion-scene`, que é quem possui os VALORES — e um gate mandou: escrito ao contrário, o
 * `tests/lotes-passo5` reprovava por CICLO entre os dois módulos.
 *
 * ⚠️ Ficam como ALIAS e não como re-export (`export type { X } from …`) por uma razão medida: o retrato da
 * superfície pública deixa os re-exports de fora de propósito, então re-exportar faria os cinco nomes
 * DESAPARECEREM do retrato deste módulo — e o gate leria uma mudança de casa como uma remoção, que é uma
 * quebra que não existe. O alias diz a mesma coisa e continua visível.
 */
export type MotionSceneKey = ChaveDeCenaLeaf;
export type MotionCharProp = PropDoPersonagemLeaf;
export type MotionCharDef = DefDoPersonagemLeaf;
export type MotionPlayer = JogadorDeMovimentoLeaf;
export type MotionSceneFlags = BandeirasDeCenaLeaf;

export interface SettingsMotionCtx {
  /** Quantos jogadores/telas. Estado de RODADA (ADR-0038): vem da instância que a raiz possui.
   *  Era `numPlayers`, um `let` de `core/state` importado como binding vivo — e um `let` de módulo
   *  é compartilhado por qualquer segundo jogo que a mesma página carregue (D13 do `demos`). */
  getNumPlayers: () => number;
  /** Os jogadores. Estado de RODADA, pelo mesmo motivo. `readonly unknown[]` porque cada consumidor
   *  estreita para a SUA fatia — o tipo real é do jogo, não da engine (ADR-0033). */
  getPlayers: () => readonly unknown[];
  /** Seletor DOM (ui/dom.ts `$`). */
  $: <T extends Element = Element>(sel: string) => T | null;
  /** Anúncio "polite" para leitor de tela (core/a11y-sr.ts). */
  srSay: (text: string) => void;
  /** Persistência (platform/storage.ts) — só o necessário aqui: gravar as flags por jogador. */
  store: { setBool: (key: string, on: boolean) => void };
  /** Empilha o overlay (z-index) + liga o rodapé de explicação — compartilhado por todos os painéis "Sensibilidade". */
  frontOverlay: (el: HTMLElement | null) => void;
  /** Devolve o foco a quem abriu o diálogo (ui/settings-panel `restoreFocus`). Injetado, e não um `#opt-*`
   *  fixo: o id que este módulo focava não existe no documento, então fechar deixava o foco no `<body>`. */
  restoreFocus?: (id: string) => boolean;

  /** Reflete on/off num botão (classe is-on + aria-pressed) — helper genérico usado por vários botões-mestre. */
  toggleBtn: (el: HTMLElement, on: boolean) => void;
  /*
   * ⚠️ AS QUATRO PASSARAM A OPCIONAIS (ADR-0106 §4, etapa 1), e a ausência é que é a notícia: a engine
   * passou a SABER RESPONDÊ-LAS. Elas estavam aqui porque o `applyCalm()` do cartucho também as usava — e
   * isso continua verdade —, mas nenhuma delas continha uma escolha do jogo: `rmKeys` era a união
   * `MotionSceneKey` inteira escrita à mão, `rmChar` as três de `MotionCharProp`, e `rm`/`saveRM` liam e
   * escreviam uma chave de armazenamento da ENGINE com um padrão da ENGINE. Ver `ui/motion-scene`.
   *
   * ⚠️ Quem injecta continua a mandar, e é por isso que a mudança é ADITIVA: um cartucho que já passa o seu
   * objecto continua a partilhá-lo por referência com os oito módulos que o leem a cada quadro. Quem não
   * passa nada deixa de ficar sem movimento reduzido — que é o estado dos cinco jogos sem barra.
   */
  /** Movimento reduzido de CENA (parallax/decor/items/particles) — objeto VIVO, mutado in-place. */
  rm?: MotionSceneFlags;
  /** Persiste `rm` (localStorage 'inclusionist.reducedmotion.v1'). */
  saveRM?: () => void;
  /** As 4 chaves de cena — a MESMA array que applyCalm() itera. */
  rmKeys?: readonly MotionSceneKey[];
  /** Os 3 alvos de movimento reduzido do PERSONAGEM — a MESMA array que applyCalm() itera. */
  rmChar?: readonly MotionCharDef[];
  /**
   * ESTE JOGO TEM UM PERSONAGEM QUE ANDA, RESPIRA OU FAZ GRACINHAS? (ADR-0153, `reducedCharacterMotion`.)
   *
   * 🔴 Sem ele a secção «Personagem» montava em TODO jogo — três interruptores para parar o andar, a respiração e as
   * gracinhas de um personagem que um jogo de tabuleiro não tem. É o botão sem assunto do ADR-0145. `false` tira a
   * secção e as três linhas deixam de contar para o botão-mestre e para o repor.
   *
   * ⚠️ OPCIONAL, com o padrão de SEMPRE (`true`): quem monta este painel fora do `createGame` continua igual.
   */
  comPersonagem?: () => boolean;
  /**
   * The GAME's word for its character (ADR-0153: what applies carries the game's word), the section's title. Optional:
   * absent, the section keeps the engine's own title, as for a panel mounted outside `createGame`.
   */
  rotuloDoPersonagem?: () => string | null;
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

/**
 * Alvo → CHAVE i18n do rótulo. CHAVES, e não texto, pelo motivo de sempre: uma tabela de `const` com texto
 * resolve UMA vez, no import, e fica congelada no idioma do boot.
 *
 * E é UMA tabela onde eram DUAS. A nota anterior dizia que `walk/breath/flavor` ficavam "redundantes com
 * rmChar[].lbl" e que não haviam sido podados "por fidelidade de porte" — havia uma terceira cópia, morta, no
 * main.js. Três tabelas dos mesmos rótulos, sem nada ligando as três: mudar um rótulo pedia três edições e
 * esquecer uma era silencioso. Agora `rmChar[].lbl` guarda a chave DESTA tabela, e a do main.js foi apagada.
 */
export const RM_LABEL: Record<string, string> = {
  parallax: 'rm.parallax', decor: 'rm.decor', items: 'rm.items',
  walk: 'rm.walk', breath: 'rm.breath', flavor: 'rm.flavor', particles: 'rm.particles',
};
// Alvos de cena "em breve" (hoje nenhum — os 4 já agem).
export const RM_SOON: ReadonlySet<MotionSceneKey> = new Set([]);

/** Cabeçalho de seção, com a etiqueta "vale para todos os jogadores".
 *
 *  A etiqueta estava escrita à mão em cada `<h3>` e ia ser repetida pela quarta vez quando a seção nova chegou.
 *  Reunida num ponto só, ela pôde finalmente passar por `t()` — e foi a seção nova que tornou isso urgente: com
 *  o cabeçalho traduzido ao lado de uma etiqueta em português cru, a mistura aparecia na mesma linha da tela.
 *  Os títulos das outras três seções continuam crus; é dívida anterior a esta mudança, contada pelo gate. */
const secao = (titulo: string): string =>
  `<h3 class="panel-sub">${titulo} <span class="panel-sub__tag">${t('rm.sec.all')}</span></h3>`;

const CRT_LBL: Record<'scan' | 'vig' | 'round', string> = { scan: 'rm.crt.scan', vig: 'rm.crt.vig', round: 'rm.crt.round' }; // CHAVES i18n (ver RM_LABEL)
// ⚠️ CHAVES desde 2026-09-12: eram as três palavras em português cru, e o anúncio saía «Rounded corners: grande»
// num jogo em inglês. Passaram pelo dicionário quando os cantos viraram passos ⯇ ⯈ (ADR-0151).
const CRT_ROUND_LEVELS: readonly string[] = ['crt.round.off', 'crt.round.small', 'crt.round.large'];

// ---------------------------------------------------------------------------------------------------------
// Lógica PURA — testável em node, sem `document`.
// ---------------------------------------------------------------------------------------------------------

/** selAnimPlayer nunca aponta pra fora do nº de telas atual. */
export function clampSelectedPlayer(selected: number, total: number): number {
  return selected >= total ? 0 : selected;
}

/** Uma linha de switch "Animado/Congelado" (usada tanto para o personagem quanto para a cena). */
export function motionRowHtml(label: string, frozen: boolean, attr: string, soon: boolean): string {
  const on = !frozen;
  // a tag after the label, from the dictionary and without parentheses (ADR-0159 rule 6)
  const soonTag = soon ? ` <em style="opacity:.7">${t('ui.soon')}</em>` : '';
  const cls = 'mode-btn switch' + (on ? ' is-on' : '');
  // ADR-0159 rules 1 and 12: the switch is named by its row and says its state through `aria-pressed`; its text is the
  // dictionary's on/off word — no glyph, and no Portuguese literal on a page in another language
  return `<div class="ctrl-row"><span>${label}${soonTag}</span><button class="${cls}" ${attr} type="button" aria-pressed="${on}" aria-label="${label}">${toggleLabel(on)}</button></div>`;
}

/** Linhas "Personagem" (por jogador selecionado). */
export function buildCharRowsHtml(rmChar: readonly MotionCharDef[], player: MotionPlayer | undefined): string {
  return rmChar.map((c) => motionRowHtml(t(c.lbl), !!(player && player[c.prop]), `data-rmc="${c.prop}"`, false)).join('');
}

/** Linhas "Cena" (globais, valem para todos os jogadores). */
export function buildSceneRowsHtml(rmKeys: readonly MotionSceneKey[], rm: MotionSceneFlags, labels: Record<string, string>, soon: ReadonlySet<MotionSceneKey>): string {
  return rmKeys.map((k) => motionRowHtml(t(labels[k]), !!rm[k], `data-rm="${k}"`, soon.has(k))).join('');
}

/** Toggle liga/desliga da estética CRT (scanlines/vinheta). */
export function crtToggleRowHtml(label: string, key: string, on: boolean): string {
  const cls = 'mode-btn switch' + (on ? ' is-on' : '');
  return `<div class="ctrl-row"><span>${label}</span><button class="${cls}" data-crt-tgl="${key}" type="button" aria-pressed="${on}" aria-label="${toggleAria(label, on)}">${toggleLabel(on)}</button></div>`;
}

/**
 * Cantos CRT: 3 níveis (0=quadrado · 1=pequeno · 2=grande), escolhidos com ESQUERDA e DIREITA (ADR-0151).
 *
 * ⚠️ DEVOLVE UM LUGAR, e não o controle: este painel desenha por `innerHTML`, e o controle de passos de
 * `ui/panel-widgets` é construído por DOM — sem marcação crua —, então o `render()` troca o lugar pelo controle.
 * Era um `<select>`: uma lista suspensa esconde as posições até abrir, e o Dev pediu que se escolha «apertando
 * para esquerda e direita».
 */
export function crtRoundRowHtml(_label: string, round: number): string {
  // ⚠️ SEM O RÓTULO À PARTE (errata do ADR-0130): o controle de passos escreve «◀ Cantos arredondados: pequeno ▶» na
  // linha inteira. O primeiro argumento fica, para quem já chama com ele; quem dá o nome ao controle é o `spec`.
  return `<div class="ctrl-row ctrl-row--passos"><span data-passos-lugar="round" data-valor="${round}"></span></div>`;
}

/** true quando TUDO (cena + personagem selecionado) já está com movimento reduzido LIGADO, isto é,
 *  congelado — nome fiel ao `rm[k]`/`player[prop]` que representam "reduzido", não "animado". Controla
 *  se o botão-mestre oferece "Retomar" (true) ou "Parar" (false) — mesma variável `allOn` do game.js
 *  original, aqui renomeada por clareza (o valor/comportamento não muda). */
export function allMotionFrozen(rmKeys: readonly MotionSceneKey[], rm: MotionSceneFlags, rmChar: readonly MotionCharDef[], player: MotionPlayer | undefined): boolean {
  // 🔴 SEM PERSONAGEM, A METADE DO PERSONAGEM NÃO PESA — e a versão anterior fazia o contrário, com
  // `rmChar.every((c) => !!(player && player[c.prop]))`, que é SEMPRE FALSO quando não há jogador.
  //
  // 📏 Medido em 2026-09-11, quando a engine passou a montar este painel para todo jogo: num jogo que não
  // declara `players` — um quiz, um puzzle — `allFrozen` ficava preso em `false`, logo o botão-mestre
  // calculava `next = !false = true` a CADA clique. A criança parava todas as animações e **não tinha como
  // as trazer de volta**: o botão continuava a oferecer «Parar» e a fazer o que já estava feito.
  //
  // É a mesma forma do defeito que o `boot/create-game` já regista sobre o modo cego — «ligava uma vez e NÃO
  // HAVIA COMO DESLIGAR» —, e custa mais a quem ligou o congelamento por precisar dele: essa pessoa não
  // experimenta o botão por curiosidade, carrega nele com enjoo.
  //
  // ⚠️ E O CASO QUE COBRIA ISTO FIXAVA O DEFEITO: ele afirmava «sem player nunca dá true» com a razão escrita
  // em termos do mecanismo — «RM_CHAR.every falha» —, e não da pessoa. Um caso que descreve a implementação
  // não pode discordar dela.
  //
  // 📌 Com jogador, nada muda: `!player` é falso e a conta é a de sempre, alvo a alvo.
  return rmKeys.every((k) => rm[k]) && (!player || rmChar.every((c) => !!player[c.prop]));
}

/** allFrozen=true (tudo já congelado) → oferece "Retomar"; caso contrário → oferece "Parar". */
export function motionMasterLabel(allFrozen: boolean): string {
  return t(allFrozen ? 'a11y.resumeAll' : 'a11y.stopAll'); // no glyph in the name (ADR-0159 rule 12), in the page's language
}

/** `label` chega JÁ TRADUZIDO; o que era concatenação (' congelado.') virou moldura com `{alvo}` — é o que
 *  permite a uma língua pôr o estado ANTES do alvo, coisa que uma concatenação não deixa. */
export function sceneMotionAnnouncement(label: string, frozen: boolean): string {
  return t(frozen ? 'sr.rm.frozen' : 'sr.rm.animated', { alvo: label });
}
export function crtToggleAnnouncement(label: string, on: boolean): string {
  return t(on ? 'sr.crt.on' : 'sr.crt.off', { efeito: label });
}
export function crtLevelLabel(level: number): string {
  const chave = CRT_ROUND_LEVELS[level];
  return chave ? t(chave) : '';
}
export function crtRoundAnnouncement(label: string, level: number): string {
  return t('sr.crt.round', { efeito: label, nivel: crtLevelLabel(level) });
}
/** `nowFrozen` = o NOVO valor de rm[k]/player[prop] aplicado pelo botão-mestre (true = acabou de congelar
 *  tudo; false = acabou de descongelar/retomar tudo) — mesma variável `v` do game.js original. */
export function stopResumeAllAnnouncement(nowFrozen: boolean): string {
  return t(nowFrozen ? 'sr.rm.allStopped' : 'sr.rm.allResumed');
}

// ---------------------------------------------------------------------------------------------------------
// Estado do módulo — equivalente a `let selAnimPlayer=0` + `animationOpen=false` do game.js.
// ---------------------------------------------------------------------------------------------------------

let selectedPlayer = 0;
export function getSelectedPlayer(): number { return selectedPlayer; }
/** Chamado de fora (ex.: o atalho "anim" do menu de pausa) antes de open(). */
export function setSelectedPlayer(i: number): void { selectedPlayer = i; }

/** Espelha `animationOpen` do game.js — só LIDO por quem despacha Escape entre os diálogos abertos. */

// ---------------------------------------------------------------------------------------------------------
// Render/DOM — casca fina em torno da lógica pura acima.
// ---------------------------------------------------------------------------------------------------------

export interface SettingsMotionApi {
  render: () => void;
  open: () => void;
  close: () => void;
}

export function initSettingsMotion(ctx: SettingsMotionCtx): SettingsMotionApi {
  /*
   * ⚠️ RESOLVIDAS UMA VEZ, NO ARRANQUE, e não a cada uso. O `rm` é mutado in-place e partilhado por
   * REFERÊNCIA com quem desenha a cena; resolvê-lo a cada leitura criaria um objecto novo por chamada, o
   * interruptor deixaria de alcançar o desenho, e não haveria erro nenhum — o menu diria «reduzido» e a cena
   * continuaria a mexer-se.
   */
  const rm: MotionSceneFlags = ctx.rm ?? lerCenaGuardada();
  const rmKeys: readonly MotionSceneKey[] = ctx.rmKeys ?? CHAVES_DE_CENA;
  const rmCharTodas: readonly MotionCharDef[] = ctx.rmChar ?? ANIMACOES_DO_PERSONAGEM;
  /** Os alvos do personagem QUE TÊM ASSUNTO neste jogo — lido a cada uso, porque o cartucho muda no `mount()`. */
  const rmChar = (): readonly MotionCharDef[] => (ctx.comPersonagem?.() === false ? [] : rmCharTodas);
  const saveRM: () => void = ctx.saveRM ?? (() => guardarCena(rm));

  function reflectMotionBtn(): void {
    const b = ctx.$<HTMLElement>('#opt-animation');
    if (b) b.classList.toggle('is-on', rmKeys.some((k) => rm[k]));
  }

  function updateMotionMaster(): void {
    reflectMotionBtn();
    const m = ctx.$<HTMLElement>('#motion-master');
    if (!m) return;
    const player = (ctx.getPlayers() as readonly MotionPlayer[])[selectedPlayer];
    const allFrozen = allMotionFrozen(rmKeys, rm, rmChar(), player);
    m.textContent = motionMasterLabel(allFrozen);
    ctx.toggleBtn(m, allFrozen);
  }

  function render(): void {
    const el = ctx.$<HTMLElement>('#motion-list');
    if (!el) return;
    selectedPlayer = clampSelectedPlayer(selectedPlayer, ctx.getNumPlayers());

    // E3: sem abas — cada jogador edita só o seu. BUG preservado VERBATIM do game.js (não corrigido, ver
    // retorno da extração): innerHTML='' roda ANTES do querySelectorAll, então o forEach abaixo nunca acha
    // botões — este bloco de wiring é código morto tanto aqui quanto no original.
    const tabs = ctx.$<HTMLElement>('#animation-players');
    if (tabs) {
      tabs.hidden = true;
      tabs.innerHTML = '';
      tabs.querySelectorAll<HTMLButtonElement>('button[data-ap]').forEach((b) => b.addEventListener('click', () => {
        selectedPlayer = Number(b.dataset.ap);
        render();
    // A prosa volta para o rodapé depois de as linhas serem reconstruídas (CLAUDE.md §4, #109).
    ctx.fillExplain?.(ctx.$<HTMLElement>('#animation .overlay__card'));
      }));
    }

    const player = (ctx.getPlayers() as readonly MotionPlayer[])[selectedPlayer];
    const charRows = buildCharRowsHtml(rmChar(), player);
    const sceneRows = buildSceneRowsHtml(rmKeys, rm, RM_LABEL, RM_SOON);
    const crtRows = crtToggleRowHtml(t(CRT_LBL.scan), 'scan', !!CRT.scan) + crtToggleRowHtml(t(CRT_LBL.vig), 'vig', !!CRT.vig) + crtRoundRowHtml(t(CRT_LBL.round), CRT.round);

    el.innerHTML =
      // ⚠️ O SUFIXO DO ASSENTO passou a chave em 2026-09-12: era o nome do jogador concatenado aqui, e a
      // mesma linha existia em `ui/pause-icons`. 📌 Reusa a `pause.cardSeat` em vez de criar uma segunda: é a
      // MESMA frase para a MESMA pessoa, e duas chaves seriam dois sítios para ela divergir entre idiomas.
      //
      // 🔴 E A PRIMEIRA VERSÃO DESTA NOTA CITAVA O LITERAL REMOVIDO, o que o fez voltar a contar: o crivo de
      // prosa crua lê a FORMA sobre o texto do ficheiro e não distingue código de comentário. O teto
      // continuou em 6 com o conserto feito. Comentário que cita o que se tirou desfaz a conta.
      //
      // 📌 Os outros dois rótulos deste subtítulo continuam crus e estão no livro-razão do módulo — são
      // outras duas linhas, e consertá-las de passagem misturava duas decisões num commit.
      // A secção inteira só existe se o jogo tem personagem (ADR-0153): um subtítulo sem linhas seria o mesmo defeito.
      (charRows ? `<h3 class="panel-sub">${escapeHtml(ctx.rotuloDoPersonagem?.() ?? 'Personagem')}${ctx.getNumPlayers() > 1 ? t('pause.cardSeat', { n: selectedPlayer + 1 }) : ''} <span class="panel-sub__tag">por jogador</span></h3>${charRows}` : '') +
      `${secao('Cena')}${sceneRows}` +
      `${secao('Estética CRT')}${crtRows}`;

    el.querySelectorAll<HTMLButtonElement>('button[data-crt-tgl]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.crtTgl as 'scan' | 'vig';
      CRT[k] = CRT[k] ? 0 : 1;
      applyCrt();
      render();
      ctx.srSay(crtToggleAnnouncement(t(CRT_LBL[k]), !!CRT[k]));
    }));
    // OS CANTOS, POR PASSOS ⯇ ⯈ (ADR-0151). O lugar deixado pelo `crtRoundRowHtml` recebe o controle.
    const lugarDosCantos = el.querySelector<HTMLElement>('[data-passos-lugar="round"]');
    if (lugarDosCantos) {
      const doc = el.ownerDocument;
      const spec = () => ({ rotulo: t(CRT_LBL.round), valores: [0, 1, 2].map(crtLevelLabel), atual: CRT.round });
      const passos = montarPassos({ procurar: (sel) => ctx.$<HTMLElement>(sel), criar: (tag) => doc.createElement(tag) }, spec());
      passos.setAttribute('data-crt', 'round');
      lugarDosCantos.replaceWith(passos);
      passos.addEventListener('passo', (ev) => {
        const novo = passoSeguinte(CRT.round, CRT_ROUND_LEVELS.length, (ev as CustomEvent<number>).detail);
        // ⚠️ NA PONTA NÃO SE ANUNCIA NADA: repetir «grande» a quem já está no máximo soaria a um passo dado.
        if (novo === CRT.round) return;
        CRT.round = novo;
        applyCrt();
        // Actualiza o controle NO SÍTIO em vez de redesenhar a lista: redesenhar tirava o foco de quem ajusta.
        atualizarPassos(passos, spec());
        refreshMarks();
        ctx.srSay(crtRoundAnnouncement(t(CRT_LBL.round), CRT.round));
      });
    }
    el.querySelectorAll<HTMLButtonElement>('button[data-rmc]').forEach((b) => b.addEventListener('click', () => {
      const prop = b.dataset.rmc as MotionCharProp;
      const p = (ctx.getPlayers() as readonly MotionPlayer[])[selectedPlayer];
      p[prop] = !p[prop];
      ctx.store.setBool('incl_' + prop + '_p' + selectedPlayer, !!p[prop]);
      render();
    }));
    el.querySelectorAll<HTMLButtonElement>('button[data-rm]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.rm as MotionSceneKey;
      rm[k] = !rm[k];
      saveRM();
      render();
      updateMotionMaster();
      ctx.srSay(sceneMotionAnnouncement(t(RM_LABEL[k]), rm[k]));
    }));

    updateMotionMaster();
    refreshMarks();
  }

  /**
   * A marca de "saiu do padrão" (ADR-0029), contra o padrão CALCULADO — não contra `false`.
   *
   * Numa máquina cujo dono pediu menos movimento, o padrão das cinco linhas de animação é CONGELADO. Marcar
   * contra `false` acusaria "alterado" em cinco linhas que a criança nunca tocou, e mandaria justamente ela
   * desfazer a preferência do próprio sistema. Uma marca errada é pior que marca nenhuma, e aqui ela erraria
   * na direção mais cara.
   */
  function refreshMarks(): void {
    const padraoRm = defaultReducedMotion();
    const el = ctx.$<HTMLElement>('#motion-list');
    const player = (ctx.getPlayers() as readonly MotionPlayer[])[selectedPlayer];
    const mudou: boolean[] = [];
    const marcar = (sel: string, changed: boolean): void => {
      mudou.push(changed);
      markChanged(el?.querySelector<HTMLElement>(sel)?.closest<HTMLElement>('.ctrl-row') ?? null, changed);
    };
    for (const c of rmChar()) marcar(`[data-rmc="${c.prop}"]`, !!(player && player[c.prop]) !== padraoRm);
    for (const k of rmKeys) marcar(`[data-rm="${k}"]`, !!rm[k] !== padraoRm);
    marcar('[data-crt-tgl="scan"]', !!CRT.scan !== !!CRT_DEFAULT.scan);
    marcar('[data-crt-tgl="vig"]', !!CRT.vig !== !!CRT_DEFAULT.vig);
    marcar('[data-crt="round"]', CRT.round !== CRT_DEFAULT.round);
    markMenuChanged(ctx.$<HTMLElement>('[data-act="anim"]'), mudou);
  }

  // ---- restaurar os padrões DESTE menu (ADR-0028) ----
  //
  // O único dos sete cujo padrão NÃO é uma constante: o das cinco linhas de animação é o que o sistema
  // operacional pede (`prefers-reduced-motion`). Devolver `false` aqui RELIGARIA a animação na tela de quem
  // já pediu menos movimento — o reset faria sozinho o que a WCAG 2.3.3 existe para impedir. Por isso ele
  // chama `defaultReducedMotion()` e não escreve o valor à mão.
  //
  // O escopo é TODOS os jogadores, como no menu motor: o painel edita um por vez, mas o reset é do menu, e
  // deixar o jogador 2 congelado porque a aba aberta era a do jogador 1 daria dois estados com um nome só.
  const resetBtn = ctx.$<HTMLButtonElement>('#animation-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    const padraoRm = defaultReducedMotion();
    for (const k of rmKeys) rm[k] = padraoRm;
    saveRM();
    (ctx.getPlayers() as readonly MotionPlayer[]).forEach((p, i) => {
      for (const c of rmChar()) {
        p[c.prop] = padraoRm;
        ctx.store.setBool('incl_' + c.prop + '_p' + i, padraoRm);
      }
    });
    CRT.scan = CRT_DEFAULT.scan; CRT.vig = CRT_DEFAULT.vig; CRT.round = CRT_DEFAULT.round;
    applyCrt();
    render();
    ctx.srSay(t('sr.motion.reset'));
  });

  function open(): void {
    const ov = ctx.$<HTMLElement>('#animation');
    if (!ov) return;
    render();
    ov.hidden = false;
    ctx.frontOverlay(ov);
    const f = ov.querySelector<HTMLElement>('button');
    if (f) f.focus();
  }

  function close(): void {
    const ov = ctx.$<HTMLElement>('#animation');
    if (!ov) return;
    ov.hidden = true;
    if (ctx.restoreFocus && ctx.restoreFocus('animation')) return;
    const b = ctx.$<HTMLElement>('#opt-animation');
    if (b) b.focus(); // recuo: este id nao existe no documento hoje (gancho de uma barra futura)
  }

  const master = ctx.$<HTMLElement>('#motion-master');
  if (master) master.addEventListener('click', () => {
    const player = (ctx.getPlayers() as readonly MotionPlayer[])[selectedPlayer];
    const allFrozen = allMotionFrozen(rmKeys, rm, rmChar(), player);
    const next = !allFrozen;
    for (const k of rmKeys) rm[k] = next;
    saveRM();
    if (player) for (const c of rmChar()) {
      player[c.prop] = next;
      ctx.store.setBool('incl_' + c.prop + '_p' + selectedPlayer, next);
    }
    render();
    ctx.srSay(stopResumeAllAnnouncement(next));
  });

  reflectMotionBtn(); // estado inicial (ex.: prefers-reduced-motion liga por padrão)

  return { render, open, close };
}
