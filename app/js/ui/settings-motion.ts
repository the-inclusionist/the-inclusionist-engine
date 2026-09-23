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
import { mountSteps, updateSteps, nextStep, controlRow, labelRow, sectionHeader } from './panel-widgets.js';
import type { PanelShellCtx } from './panel-shell.js';

import { SCENE_KEYS, CHARACTER_ANIMATIONS, readStoredScene, storeScene } from './motion-scene.js';
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
/*
 * 🎯 O MECANISMO «EM BREVE» SAIU INTEIRO com a conversão para nós (ADR-0129), e não por caber mal no kit: ele não
 * tinha assunto. 📏 Medido em 2026-09-23 — `RM_SOON` era um conjunto VAZIO desde que o cartucho deixou este
 * repositório (`b55b88e7`), o `render` passava-o sempre à mão, e nenhum caminho deixava um cartucho fornecer outro.
 * Quem o mantinha vivo eram dois casos que passavam `soon: true` directamente ao construtor.
 *
 * 📌 É a segunda vez que este mecanismo sai por ter perdido o último utilizador: o gémeo dele, o `soon` da barra de
 * ícones, saiu em `760faad` pela mesma razão. A chave `ui.soon` fica nos três dicionários — é ela que o crivo dos
 * rótulos sem parênteses ainda lê, e escrevê-la de novo custa menos do que a decisão de a apagar.
 */

/** Cabeçalho de seção, com a etiqueta "vale para todos os jogadores".
 *
 *  A etiqueta estava escrita à mão em cada `<h3>` e ia ser repetida pela quarta vez quando a seção nova chegou.
 *  Reunida num ponto só, ela pôde finalmente passar por `t()` — e foi a seção nova que tornou isso urgente: com
 *  o cabeçalho traduzido ao lado de uma etiqueta em português cru, a mistura aparecia na mesma linha da tela.
 *  Os títulos das outras três seções continuam crus; é dívida anterior a esta mudança, contada pelo gate. */

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

/**
 * O NOME de cada parte deste interior, e é por ele que a montagem reconcilia.
 *
 * 📌 Uma chave e não uma posição: as linhas do personagem aparecem e desaparecem com o cartucho (ADR-0153), então a
 * montagem tem de saber QUAL linha é qual para reetiquetar a que ficou e tirar a que perdeu o assunto.
 */
const partOfChar = (prop: string): string => `char:${prop}`;
const partOfScene = (key: string): string => `scene:${key}`;
const partOfCrt = (key: string): string => `crt:${key}`;

/** Uma parte do interior: a chave, como se constrói, e como se reescrevem as palavras dela. */
interface MotionPart {
  readonly key: string;
  readonly build: () => HTMLElement;
  readonly write: (el: HTMLElement) => void;
}

/** O que a montagem precisa saber, já traduzido — o kit não decide língua, monta forma. */
export interface MotionInsideSpec {
  /** O título da secção do personagem, ou `null` quando este jogo não tem personagem (ADR-0153). */
  readonly charTitle: string | null;
  /** ⚠️ A etiqueta do personagem é OUTRA, e não é descuido: as três linhas dele valem por JOGADOR, as das outras duas
   *  secções valem para todos. Uma etiqueta só diria a mesma coisa de coisas diferentes. */
  readonly charTag: string;
  readonly charRows: readonly { readonly prop: string; readonly label: string }[];
  readonly sceneTitle: string;
  readonly sceneRows: readonly { readonly key: string; readonly label: string }[];
  readonly crtTitle: string;
  /** A etiqueta de «vale para todos», partilhada pelas secções de cena e de CRT. */
  readonly allTag: string;
  readonly crtToggles: readonly { readonly key: string; readonly label: string }[];
  /** O nome e as posições dos cantos, para o controle de passos (ADR-0151). */
  readonly roundSpec: () => { readonly rotulo: string; readonly valores: readonly string[]; readonly atual: number };
}

/**
 * Monta o interior deste painel e reconcilia-o depois — cria o que falta, reescreve o que ficou, tira o que perdeu o
 * assunto. NUNCA move um nó que já existe.
 *
 * 🔴 ISTO ERA `innerHTML` A CADA RENDER, e o preço está medido: com o cursor nos cantos arredondados, um clique na
 * linha vizinha destruía o controle e o foco caía no `<body>` — a criança que navega por teclado perdia o lugar no
 * painel inteiro. ⚠️ E mover também desfoca, e é por isso que esta função INSERE na posição certa em vez de anexar e
 * reordenar: um nó que muda de pai é removido e reposto, e o navegador tira-lhe o foco na remoção.
 */
export function mountMotionInside(ctx: PanelShellCtx, list: HTMLElement, spec: MotionInsideSpec): void {
  reconcile(list, motionParts(ctx, spec));
}

/**
 * O que este interior TEM, em ordem — e é uma pergunta diferente de «como é que o documento chega lá».
 *
 * ⚠️ Separada do `reconcile` porque a catraca mandou: as duas juntas davam 15 caminhos de decisão contra o tecto 10 de
 * McCabe. Separadas, cada uma é uma frase com nome.
 */
function motionParts(ctx: PanelShellCtx, spec: MotionInsideSpec): MotionPart[] {
  const sectionPart = (key: string, title: string, tag: string, rows: number): MotionPart | null =>
    (rows === 0 ? null : {
      key,
      build: () => sectionHeader(ctx, title, tag, rows) ?? ctx.criar('h3'),
      write: (el) => {
        el.textContent = title + ' ';
        const mark = ctx.criar('span');
        mark.className = 'panel-sub__tag';
        mark.textContent = tag;
        el.appendChild(mark);
      },
    });

  const switchPart = (key: string, id: string, label: string, mark: readonly [string, string]): MotionPart => ({
    key,
    build: () => {
      const { linha: newRow, controle } = controlRow(ctx, { id, rotulo: label, rotuloAria: label });
      controle.setAttribute(mark[0], mark[1]);
      return newRow;
    },
    // ⚠️ SÓ AS PALAVRAS. O estado (classe, `aria-pressed`, o texto do botão) é escrito pelo `reflect` do painel, que é
    // quem sabe o valor — escrevê-lo aqui daria duas respostas à mesma pergunta.
    write: (el) => labelRow(el, { id, rotulo: label, rotuloAria: label }),
  });

  const parts: MotionPart[] = [];
  const charHeader = sectionPart('sec:char', spec.charTitle ?? '', spec.charTag, spec.charTitle ? spec.charRows.length : 0);
  if (charHeader) parts.push(charHeader);
  for (const r of spec.charRows) parts.push(switchPart(partOfChar(r.prop), `motion-char-${r.prop}`, r.label, ['data-rmc', r.prop]));
  const sceneHeader = sectionPart('sec:scene', spec.sceneTitle, spec.allTag, spec.sceneRows.length);
  if (sceneHeader) parts.push(sceneHeader);
  for (const r of spec.sceneRows) parts.push(switchPart(partOfScene(r.key), `motion-scene-${r.key}`, r.label, ['data-rm', r.key]));
  const crtHeader = sectionPart('sec:crt', spec.crtTitle, spec.allTag, spec.crtToggles.length + 1);
  if (crtHeader) parts.push(crtHeader);
  for (const r of spec.crtToggles) parts.push(switchPart(partOfCrt(r.key), `crt-${r.key}`, r.label, ['data-crt-tgl', r.key]));
  parts.push({
    key: partOfCrt('round'),
    build: () => {
      // ⚠️ SEM RÓTULO À PARTE (errata do ADR-0130): o controle de passos escreve «◀ Cantos arredondados: pequeno ▶» na
      // linha inteira, e um rótulo ao lado seria o nome dito duas vezes.
      const row = ctx.criar('div');
      row.className = 'ctrl-row ctrl-row--passos';
      const steps = mountSteps(ctx, spec.roundSpec());
      steps.setAttribute('data-crt', 'round');
      row.appendChild(steps);
      return row;
    },
    write: (el) => {
      const steps = el.querySelector<HTMLElement>('[data-passos]');
      if (steps) updateSteps(steps, spec.roundSpec());
    },
  });

  return parts;
}

/**
 * O documento posto de acordo com a lista: cria o que falta NA POSIÇÃO CERTA, reescreve o que ficou, tira o que já não
 * é pedido.
 *
 * ⚠️ NUNCA MOVE UM NÓ QUE JÁ EXISTE, e não é economia: um nó que muda de pai é removido e reposto, e o navegador
 * tira-lhe o foco na remoção — seria o mesmo defeito que a conversão veio consertar, por outra porta.
 */
function reconcile(list: HTMLElement, parts: readonly MotionPart[]): void {
  let previous: HTMLElement | null = null;
  for (const part of parts) {
    let el = list.querySelector<HTMLElement>(`[data-motion-part="${part.key}"]`);
    if (!el) {
      el = part.build();
      el.dataset.motionPart = part.key;
      list.insertBefore(el, previous ? previous.nextSibling : list.firstChild);
    }
    part.write(el);
    previous = el;
  }
  const keep = new Set(parts.map((p) => p.key));
  for (const el of [...list.querySelectorAll<HTMLElement>('[data-motion-part]')]) {
    if (!keep.has(el.dataset.motionPart ?? '')) el.remove();
  }
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
  const rm: MotionSceneFlags = ctx.rm ?? readStoredScene();
  const rmKeys: readonly MotionSceneKey[] = ctx.rmKeys ?? SCENE_KEYS;
  const rmCharTodas: readonly MotionCharDef[] = ctx.rmChar ?? CHARACTER_ANIMATIONS;
  /** Os alvos do personagem QUE TÊM ASSUNTO neste jogo — lido a cada uso, porque o cartucho muda no `mount()`. */
  const rmChar = (): readonly MotionCharDef[] => (ctx.comPersonagem?.() === false ? [] : rmCharTodas);
  const saveRM: () => void = ctx.saveRM ?? (() => storeScene(rm));

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

  const kitCtx = (list: HTMLElement): PanelShellCtx => ({
    procurar: (sel) => ctx.$<HTMLElement>(sel),
    criar: (tag) => list.ownerDocument.createElement(tag),
  });

  const roundSpec = () => ({ rotulo: t(CRT_LBL.round), valores: [0, 1, 2].map(crtLevelLabel), atual: CRT.round });

  /** O ESTADO de cada interruptor — o que o kit não escreve, porque é o painel que sabe o valor. */
  function reflectSwitches(el: HTMLElement): void {
    const player = (ctx.getPlayers() as readonly MotionPlayer[])[selectedPlayer];
    const writeSwitch = (sel: string, on: boolean, nome: string): void => {
      const b = el.querySelector<HTMLElement>(sel);
      if (!b) return;
      ctx.toggleBtn(b, on);
      b.textContent = toggleLabel(on);
      b.setAttribute('aria-label', toggleAria(nome, on));
    };
    // ⚠️ «Animado» é o CONTRÁRIO de `rm`/`player[prop]`, que guardam «movimento reduzido». O nome fiel está no
    // `allMotionFrozen` e a inversão mora aqui, num sítio só.
    for (const c of rmChar()) writeSwitch(`[data-rmc="${c.prop}"]`, !(player && player[c.prop]), t(c.lbl));
    for (const k of rmKeys) writeSwitch(`[data-rm="${k}"]`, !rm[k], t(RM_LABEL[k]));
    writeSwitch('[data-crt-tgl="scan"]', !!CRT.scan, t(CRT_LBL.scan));
    writeSwitch('[data-crt-tgl="vig"]', !!CRT.vig, t(CRT_LBL.vig));
  }

  /** As escutas, UMA VEZ e por delegação: as linhas do personagem vêm e vão com o cartucho (ADR-0153), e ligar
   *  botão a botão a cada render acumularia uma escuta por passagem em cada um que sobrevivesse. */
  let wired = false;
  function wireOnce(el: HTMLElement): void {
    if (wired) return;
    wired = true;
    el.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement | null)?.closest<HTMLElement>('button');
      if (!b || !el.contains(b)) return;
      const crt = b.dataset.crtTgl as 'scan' | 'vig' | undefined;
      if (crt) {
        CRT[crt] = CRT[crt] ? 0 : 1;
        applyCrt();
        reflectSwitches(el);
        refreshMarks();
        ctx.srSay(crtToggleAnnouncement(t(CRT_LBL[crt]), !!CRT[crt]));
        return;
      }
      const prop = b.dataset.rmc as MotionCharProp | undefined;
      if (prop) {
        const p = (ctx.getPlayers() as readonly MotionPlayer[])[selectedPlayer];
        p[prop] = !p[prop];
        ctx.store.setBool('incl_' + prop + '_p' + selectedPlayer, !!p[prop]);
        render();
        return;
      }
      const k = b.dataset.rm as MotionSceneKey | undefined;
      if (!k) return;
      rm[k] = !rm[k];
      saveRM();
      render();
      updateMotionMaster();
      ctx.srSay(sceneMotionAnnouncement(t(RM_LABEL[k]), rm[k]));
    });
    el.addEventListener('passo', (ev) => {
      const passos = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-crt="round"]');
      if (!passos) return;
      const next = nextStep(CRT.round, CRT_ROUND_LEVELS.length, (ev as CustomEvent<number>).detail);
      // ⚠️ NA PONTA NÃO SE ANUNCIA NADA: repetir «grande» a quem já está no máximo soaria a um passo dado.
      if (next === CRT.round) return;
      CRT.round = next;
      applyCrt();
      updateSteps(passos, roundSpec());
      refreshMarks();
      ctx.srSay(crtRoundAnnouncement(t(CRT_LBL.round), CRT.round));
    });
  }

  function render(): void {
    const el = ctx.$<HTMLElement>('#motion-list');
    if (!el) return;
    selectedPlayer = clampSelectedPlayer(selectedPlayer, ctx.getNumPlayers());

    // E3: sem abas — cada jogador edita só o seu. A faixa fica escondida e vazia, como sempre esteve.
    // 🔴 O BLOCO DE FIAÇÃO QUE VIVIA AQUI ERA CÓDIGO MORTO DECLARADO — `innerHTML=''` corria ANTES do
    // `querySelectorAll`, logo o `forEach` nunca achava botão nenhum — e levava lá dentro a única chamada de
    // `ctx.fillExplain` deste painel, que por isso nunca corria. Saiu com ele; a chamada passou para o fim do render,
    // que é onde as outras sete a fazem.
    const tabs = ctx.$<HTMLElement>('#animation-players');
    if (tabs) {
      tabs.hidden = true;
      tabs.textContent = '';
    }

    mountMotionInside(kitCtx(el), el, {
      // ⚠️ O SUFIXO DO ASSENTO é chave desde 2026-09-12, e reusa a `pause.cardSeat` do cartão: é a MESMA frase para a
      // MESMA pessoa, e duas chaves seriam dois sítios para ela divergir entre idiomas.
      charTitle: rmChar().length
        ? (ctx.rotuloDoPersonagem?.() ?? 'Personagem') + (ctx.getNumPlayers() > 1 ? t('pause.cardSeat', { n: selectedPlayer + 1 }) : '')
        : null,
      // 📌 Os três rótulos de secção continuam crus e estão no livro-razão deste módulo — consertá-los de passagem
      // misturava duas decisões num commit.
      charTag: 'por jogador',
      charRows: rmChar().map((c) => ({ prop: c.prop, label: t(c.lbl) })),
      sceneTitle: 'Cena',
      sceneRows: rmKeys.map((k) => ({ key: k, label: t(RM_LABEL[k]) })),
      crtTitle: 'Estética CRT',
      allTag: t('rm.sec.all'),
      crtToggles: [{ key: 'scan', label: t(CRT_LBL.scan) }, { key: 'vig', label: t(CRT_LBL.vig) }],
      roundSpec,
    });
    reflectSwitches(el);
    wireOnce(el);

    updateMotionMaster();
    refreshMarks();
    // A prosa volta para o rodapé depois de as linhas mudarem (CLAUDE.md §4, #109).
    ctx.fillExplain?.(ctx.$<HTMLElement>('#animation .overlay__card'));
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
    const markRow = (sel: string, changed: boolean): void => {
      mudou.push(changed);
      markChanged(el?.querySelector<HTMLElement>(sel)?.closest<HTMLElement>('.ctrl-row') ?? null, changed);
    };
    for (const c of rmChar()) markRow(`[data-rmc="${c.prop}"]`, !!(player && player[c.prop]) !== padraoRm);
    for (const k of rmKeys) markRow(`[data-rm="${k}"]`, !!rm[k] !== padraoRm);
    markRow('[data-crt-tgl="scan"]', !!CRT.scan !== !!CRT_DEFAULT.scan);
    markRow('[data-crt-tgl="vig"]', !!CRT.vig !== !!CRT_DEFAULT.vig);
    markRow('[data-crt="round"]', CRT.round !== CRT_DEFAULT.round);
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
