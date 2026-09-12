// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/pause-icons — the PER-SCREEN pause menu (`.screen-pause`) and the accessibility icon bar (`.pi-btn`).
// Extracted VERBATIM from game.js (Estágio 4): PAUSE_ICONS, buildScreenPause, calmMode/applyCalm, iconAct,
// iconLabel, reflectIconBtn, reflectPauseIcons and hasPrivateOutput.
//
// WHY THE ICON BAR IS ITS OWN SLICE: the ten `.pi-btn` buttons are the ONLY place in the game where a state
// owned by another subsystem (blind mode, TTS, Libras, TEA/reduced-motion, toggle-keys, contrast, CVD) is both
// mutated AND read back as an `aria-label`. That round-trip — "the label must tell the truth about the state" —
// is the whole reason `iconLabel` exists, and it is what the pure functions below make testable in node.
//
// `iconAct` IS A DISPATCHER (its ctx list is long by nature: seven subsystems, one button each), so it is
// implemented here as a TABLE (`ICON_ACTS`) rather than the original if/else chain. Same order, same
// guards, same announcements — only the shape changed.
//
// WHAT STAYS IN game.js (injected):
//   · `pauseActor`      — read by the gamepad (input/gamepad.ts ctx) and the keyboard router, and by
//                         openHelp()/openOptions(); this module only WRITES it (`setPauseActor`).
//   · `pauseActs`       — the `.pm-btn` action table; every entry calls a panel that still lives in game.js
//                         (openTypo/openAudio/openMovement/motion.open/openVisual/empathy.open/printMode/
//                         quitGame/openHelp/setPhase/applyLetra/setQuizLevel/joinPlayer/fitsN/vpScreens).
//                         Injected LAZILY (`getPauseActs`) because it is a `const` declared ~1200 lines below
//                         the init site — an eager reference would hit its temporal dead zone.
//   · `vpPause`         — the array of built pause screens; game.js rebuilds it in buildGameHud() and reads it
//                         in setPhase/navPause/printMode/pauseSelect/__incl. Injected as a getter.
//   · `rm`/`saveRM`     — the reduced-motion flags object, co-owned with ui/settings-motion (same reference).
//   · `PM_BTNS`/`QL_NAME` — owned by ui/activities-menu; injected, never copied.


import type { PlayerView } from '../core/entity.js';
import type { NavKeys } from '../input/edges.js'; // a MESMA intenção que teclado, controle, olhar e fala montam
import { t } from '../core/i18n.js';
import { CONTRAST_LEVELS } from './settings-visual.js';
import { CURTO_DO_TEMA, CURTO_DA_CORRECAO } from './visual-axes-panel.js';
import {
  proximoTema, proximaCorrecao, temAltoContraste, PADRAO,
  type Tema, type Correcao, type VisualState,
} from '../render/viz-axes.js';
import type { MotionSceneFlags, MotionSceneKey, MotionCharDef } from './settings-motion.js';
import type { AudioCatState } from './settings-audio.js';
import { anunciarItem } from './item-announcement.js';
import { rotuloAcessivel } from '../core/rotulo-acessivel.js';
import { passoNoAnel } from '../core/anel.js'; // da FOLHA, e não de ui/menu-nav: ver a nota lá
// LIGAÇÃO VIVA (ESM): o índice pode ser desligado no menu, e o valor aqui acompanha sem assinatura.
import { menuIndexOn, DEFAULTS, setModoCegoValue } from '../core/state.js';
// ⚠️ IMPORT DIRETO DE `platform/storage`, e não uma peça a mais no `ctx`, e a escolha é sobre quem pode
// esquecer: `initPauseIcons` é chamado pela raiz de composição de CADA jogo, e um `store` injetado é um
// campo que um consumidor pode omitir — e omiti-lo faria o nível TEA voltar a não persistir, em silêncio,
// exactamente no jogo que se esqueceu. É a mesma forma que `ui/fonts` usa, e `ui/` depender de `platform/`
// não inverte camada nenhuma.
import * as store from '../platform/storage.js';
import { definirAlternanciaDeMarcha } from './settings-motor.js';
import { recusaDaAlternancia } from './latch-refusal.js';
import { PM_BTNS, PM_OPTIONS_BTNS, PM_JOGO_BTNS } from './activities-menu.js';
import { CHAVES_DE_CENA, ANIMACOES_DO_PERSONAGEM, lerCenaGuardada, guardarCena } from './motion-scene.js';

/**
 * A LEGENDA de um ícone da barra de acessibilidade — uma função, e não três cópias da mesma expressão.
 *
 * Ela é escrita em TRÊS momentos que parecem diferentes e são o mesmo: o cursor direcional pousa no ícone
 * (`ui/menu-nav`), o dedo o aciona, e o mouse ou o foco passa por cima. Enquanto eram três linhas soltas, o
 * índice do ADR-0044 teria de ser acrescentado em três lugares — e a chance de um ficar para trás é a mesma
 * que este repositório já pagou dezesseis vezes com o `DomQuery`.
 *
 * O `aria-label` já conta o ESTADO ("Alto contraste, ativado"): é ele que o `reflectIconBtn` reescreve a cada
 * mudança, e é por isso que a legenda o lê de volta em vez de recompor o texto por conta própria.
 */
export function legendaDoIcone(barra: ParentNode, el: HTMLElement): string {
  const icones = [...barra.querySelectorAll<HTMLElement>('.pi-btn')];
  // A regra "rótulo declarado vence" nasceu AQUI e valia só para os dez ícones. Virou `core/rotulo-acessivel`
  // e agora vale para o menu inicial e para a lista de pausa também — uma resposta para "como se chama este
  // controle", e não três.
  return anunciarItem(
    { rotulo: rotuloAcessivel(el), posicao: icones.indexOf(el) + 1, total: icones.length },
    menuIndexOn,
  );
}

// ---------------------------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------------------------

export interface PauseIcon {
  /** `data-pi` key — the dispatch key of iconAct/iconLabel/reflectIconBtn. */
  k: string;
  /** The emoji glyph rendered inside the button. */
  e: string;
  /** i18n KEY of the base name; also the `aria-label` when the icon carries no state (or is `soon`). */
  n: string;
  /** Under construction: the button announces itself and does nothing else. */
  soon?: boolean;
}

/** The accessibility shortcut bar at the top of every pause screen (and of the splash `#title-icons`).
 *  Sound-bound icons (blind/TTS) require a private audio output; webcam/voice are still `soon`.
 *  VERBATIM from game.js in order and behaviour; the names became i18n keys in the Fase-5 pass. */
// `n` é a CHAVE i18n do nome do ícone (o emoji `e` não traduz — é o mesmo glifo em toda língua).
export const PAUSE_ICONS: readonly PauseIcon[] = [
  { k: 'blind', e: '🦯', n: 'icon.blind' },
  { k: 'tts', e: '🗨️', n: 'icon.tts' },
  { k: 'libras', e: '🤟', n: 'icon.libras' },
  { k: 'tea', e: '🧩', n: 'icon.tea' },
  { k: 'altmove', e: '☝️', n: 'icon.altmove' }, // ☝️ e não 🦾: o gesto é UM DEDO tocando, que é o que a alternância pede (pedido do Dev)
  { k: 'contrast', e: '🌗', n: 'icon.contrast' },
  { k: 'cvd', e: '🚥', n: 'icon.cvd' },
  { k: 'face', e: '🧑', n: 'icon.face', soon: true },
  { k: 'eyes', e: '👀', n: 'icon.eyes', soon: true },
  { k: 'voice', e: '👄', n: 'icon.voice', soon: true },
  /*
   * O DÉCIMO PRIMEIRO (ADR-0149 §1), e ele entra no FIM por uma razão de ordem e não de importância: quem
   * navega a barra por teclado já aprendeu onde estão os dez, e inserir no meio deslocaria todos eles — o
   * mesmo custo que o §2 do ADR-0044 recusa pagar no cartão de pausa.
   *
   * 📌 UM CICLO E NÃO UMA PORTA. O painel de tipografia continua a existir nas Configurações com as suas
   * trinta faces; este botão é a escolha que se faz SEM sair da tela, numa pressão, e por isso é uma lista
   * curta e curada em vez de um menu.
   */
  { k: 'tipografia', e: '🔤', n: 'icon.tipografia' },
];

const ICON_BY_KEY: ReadonlyMap<string, PauseIcon> = new Map(PAUSE_ICONS.map((ic) => [ic.k, ic]));
export function pauseIcon(k: string): PauseIcon | undefined { return ICON_BY_KEY.get(k); }

/** TEA cycle: 0 = normal · 1 = calmo (reduces) · 2 = silencioso (switches off). Never touches TTS/blind mode. */
export const CALM_NAMES: readonly string[] = ['calm.off', 'calm.quiet', 'calm.silent'];

/**
 * O nível TEA guardado, saneado. Fora de 0..2 devolve o padrão — dado do navegador é dado de fora, e um
 * nível inventado escolheria `CALM_NAMES[3]`, que é `undefined`, e o anúncio ao leitor de tela sairia vazio.
 */
export function saneiaNivelTea(bruto: number): number {
  return Number.isInteger(bruto) && bruto >= 0 && bruto < CALM_NAMES.length ? bruto : DEFAULTS.calmMode;
}

/** Lê o nível TEA do armazenamento. Chamado no `init`, nunca no import. */
function lerNivelTea(): number {
  return saneiaNivelTea(store.getNum(store.KEYS.tea, DEFAULTS.calmMode));
}
/** The audio categories `applyCalm` governs. TTS/sonar/guarda/guia stay untouched — a calm player still needs them. */
export const CALM_AUDIO_CATS: readonly string[] = ['ambient', 'music', 'earcons', 'interact'];
/** Colour-vision-deficiency cycle, in `player.viz` values. */
export const CVD_SEQ: readonly string[] = ['normal', 'fix-protan', 'fix-deuter', 'fix-tritan'];
/** i18n keys of the CVD announcement names, indexed the same as CVD_SEQ.
 *
 * ⚠️ POSITION 0 IS `cvd.tricro` AND NOT `cvd.off`, AND THE TWO KEYS ARE NOT INTERCHANGEABLE.
 * This list names the four CHOICES of the cycle, so position 0 is a way of seeing — trichromatic
 * vision, the one that needs no correction — and it is said as one. `cvd.off` below is a FALLBACK
 * for `s.viz` values that are not corrections at all, and 13 of the 16 viz modes are exactly that:
 * the three simulations, the three contrast levels, the five low-vision modes and blind mode.
 * Announcing "trichromatic vision" there would have the software assert what the child sees, while
 * she is simulating not seeing it. The choice is named; the fallback is switched off. */
export const CVD_NAMES: readonly string[] = ['cvd.tricro', 'cvd.protan', 'cvd.deuter', 'cvd.tritan'];
/** `player.viz` → i18n key of the label used by iconLabel (anything else falls back to the 'off' key). */
export const CVD_LABELS: Readonly<Record<string, string>> = {
  'fix-protan': 'cvd.protan', 'fix-deuter': 'cvd.deuter', 'fix-tritan': 'cvd.tritan',
};

// ---------------------------------------------------------------------------------------------
// Shapes this module reads but does not own
// ---------------------------------------------------------------------------------------------

/** The slice of a player object the pause icons touch. `players` (core/state) is typed `unknown[]`. */
/**
 * A fatia que os ícones de pausa tocam — derivada de core/entity, e SEM assinatura de índice.
 *
 * Havia uma (`[prop: string]: unknown`), posta ali porque `applyCalm` escreve por nome calculado
 * (`p[c.prop] = …`). Era andaime: `c.prop` tem tipo `MotionCharProp`, que é a união literal
 * `'rmWalk' | 'rmBreath' | 'rmFlavor'`, e o TypeScript verifica acesso por chave literal sem precisar de
 * assinatura nenhuma — bastava que os três campos tivessem nome, que é o que a derivação deu.
 *
 * E ela custava caro: uma assinatura de índice aceita QUALQUER propriedade, com valor `unknown`. Enquanto
 * existiu, um erro de digitação em qualquer campo deste objeto compilava em silêncio. Quem a denunciou foi
 * tipar `core/state.players` como `Player[]`: o compilador recusou converter um `Player` — que não tem
 * assinatura de índice — para ela, e essa recusa é a informação.
 */
export type PausePlayer = PlayerView<'visual' | 'toggleMove' | 'walkDir' | 'audioSink' | 'rmWalk' | 'rmBreath' | 'rmFlavor'>;

/** One `.pm-btn` descriptor — the shape of game.js's PM_BTNS (owned by ui/activities-menu). */
export interface PauseMenuButton {
  act: string;
  /** Só é lido quando o botão tem rótulo dinâmico; ver a nota em `PauseBtnDef` (ui/activities-menu). */
  lbl?: string;
  /** Dynamic label (the ABC cycle) — rendered from `lbl`, not from i18n, and NOT given `data-i18n`. */
  letra?: boolean;
  /** Dynamic label (the literacy level) — rendered from quizLevel + qlName. Currently dormant: no PM_BTNS
   *  entry sets it, but the branch is live code and is ported verbatim. */
  nivel?: boolean;
}

// ---------------------------------------------------------------------------------------------
// PURE LOGIC — no `document`, no ctx. This is the half that carries the accessibility contract.
// ---------------------------------------------------------------------------------------------

/** Everything the label/visual of ONE icon depends on, gathered in one value. */
export interface IconStateSnapshot {
  modoCego: boolean;
  ttsOn: boolean;
  librasOn: boolean;
  calmMode: number;
  toggleMove: boolean;
  /**
   * O estado visual em DOIS EIXOS (#104).
   *
   * ⚠️ ERA `viz: string`, E O COMENTÁRIO DIZIA: «shared by the contrast and CVD icons (they overwrite each
   * other; **that is by design**)». Não era desenho — era o campo único a impor-se, e a frase é o defeito
   * escrito como se fosse decisão. Os dois ícones sempre ciclaram DENTRO do seu eixo (`nextContrast` e
   * `nextCvd` existem desde sempre, separados); só não tinham onde guardar o resultado sem apagar o vizinho.
   */
  visual: VisualState;
  /** False disables the blind/TTS icons: those need an audio output nobody else is listening to. */
  privateOutput: boolean;
  /**
   * O aparelho em uso EXIGE a alternância? (ADR-0113 cláusula 3.)
   *
   * ⚠️ Em olhos, rosto, gestos e fala ela é o que faz a entrada funcionar, logo não há escolha a oferecer.
   * O ícone fica desabilitado COM MOTIVO, como o painel — e não pode divergir dele: as duas superfícies
   * escrevem o mesmo valor, e uma que aceitasse o clique enquanto a outra recusa deixaria a criança com
   * dois botões que discordam sobre o mesmo ajuste.
   *
   * 🔴 OPCIONAL PORQUE O GATE DA FORMA ME APANHOU: eu escrevi-o obrigatório, e o
   * `tests/superficie-publica` reprovou com «ENTROU como obrigatório» — que é uma MUDANÇA QUEBRANTE do
   * pacote, porque quem constrói este snapshot passa a ter de o preencher. Foi para isto que o gate da
   * FORMA (`2f2582f`) foi escrito, e é a primeira vez que ele apanha um campo A ENTRAR e não a sair.
   * Ausente significa «ninguém me disse», que degrada para «não exijo» — o comportamento de hoje.
   */
  alternanciaExigida?: boolean;
}

/** A player has private output when nobody else is on the same sink. Single screen ⇒ always private.
 *  Pure form of game.js's hasPrivateOutput (see the report: it had no other caller left). */
export function hasPrivateOutputIn(list: readonly PausePlayer[], count: number, i: number): boolean {
  if (count <= 1) return true;
  const p = list[i];
  if (!p || !p.audioSink) return false;
  return !list.some((q, j) => j !== i && q && q.audioSink === p.audioSink);
}

/** TEA cycle step. */
export function nextCalmMode(cur: number): number { return (cur + 1) % 3; }

/** Next high-contrast level. An unlisted `viz` (e.g. a CVD filter) is treated as index 0 ⇒ jumps to 'hc-direto'. */
export function nextContrast(cur: string | undefined): string {
  let idx = CONTRAST_LEVELS.indexOf(cur as string);
  idx = idx < 0 ? 0 : idx;
  return CONTRAST_LEVELS[(idx + 1) % CONTRAST_LEVELS.length];
}

/** Next CVD filter. NOTE the asymmetry with nextContrast: an unlisted `viz` maps to index 1 ('fix-protan'),
 *  not 0 — verbatim from game.js (`idx = idx<0 ? 1 : (idx+1)%seq.length`). */
export function nextCvd(cur: string | undefined): { idx: number; mode: string } {
  let idx = CVD_SEQ.indexOf(cur as string);
  idx = idx < 0 ? 1 : (idx + 1) % CVD_SEQ.length;
  return { idx, mode: CVD_SEQ[idx] };
}

/** What `applyCalm` does to ONE audio category, given the TEA level. Extracted so the (destructive) volume
 *  clamp at level 1 is visible and testable — see the report. */
export function calmAudioPlan(calmMode: number, vol: number): { on: boolean; vol: number } {
  if (calmMode === 0) return { on: true, vol };
  if (calmMode === 1) return { on: true, vol: Math.min(vol, 0.3) };
  return { on: false, vol };
}

/** What `applyCalm` does to the scene/character reduced-motion flags. */
export function calmMotionPlan(calmMode: number): { sceneReduced: boolean; charFrozen: boolean } {
  return { sceneReduced: calmMode >= 1, charFrozen: calmMode === 2 };
}

/** The `aria-label` of one icon — it MUST reflect the current state, on/off or level. This is the whole
 *  point of the function: a toggle that looks pressed but does not say so is invisible to a screen reader. */
export function computeIconLabel(k: string, s: IconStateSnapshot): string {
  const ic = ICON_BY_KEY.get(k);
  if (!ic) return '';
  // O estado vira SEMPRE um parâmetro (`{v}`), nunca uma concatenação: 'on'/'off' eram palavras inglesas
  // presas numa frase em português, e uma língua que anteponha o estado ao nome precisa do dicionário para
  // reordenar. `nomeDoIcone: estado` é a moldura; o estado é o conteúdo, e ele também é traduzido.
  if (ic.soon) return t('icon.soon', { nome: t(ic.n) });
  const rotulo = (v: string): string => t('icon.state', { nome: t(ic.n), v: t(v) });
  if (k === 'blind') return rotulo(s.modoCego ? 'state.on' : 'state.off');
  if (k === 'tts') return rotulo(s.ttsOn ? 'state.on' : 'state.off');
  if (k === 'libras') return rotulo(s.librasOn ? 'state.on' : 'state.off');
  // TEA e daltonismo usam um nome CURTO aqui, diferente do nome do botão: o rótulo já diz o nível, e
  // repetir a lista de níveis do nome ("(calmo / silencioso)", "(protan/deutan/tritan)") a diria duas vezes.
  // Era assim antes da conversão, com o texto curto embutido — preservado, não reinventado.
  if (k === 'tea') return t('icon.state', { nome: t('icon.tea.short'), v: t(CALM_NAMES[s.calmMode]!) });
  if (k === 'altmove') return rotulo(s.toggleMove ? 'state.on' : 'state.off');
  if (k === 'contrast') return rotulo(CURTO_DO_TEMA[s.visual.tema]);
  if (k === 'cvd') return t('icon.state', { nome: t('icon.cvd.short'), v: t(CURTO_DA_CORRECAO[s.visual.correcao]) });
  return t(ic.n);
}

/** The visual state of one icon button. `active` is what becomes `aria-pressed`. */
export interface IconVisual {
  /** `.pi-on` — the yellow "this is on" state. */
  on: boolean;
  /** `.pi-dis` — greyed out (blind/TTS without a private audio output). */
  dis: boolean;
  /** `.pi-calm` — TEA level 1 only (white); level 2 uses `.pi-on` instead. */
  calm: boolean;
  /** `.pi-cvd-protan` | `.pi-cvd-deuter` | `.pi-cvd-tritan`, or '' — the two-tone background IS the on-signal. */
  cvd: string;
  /** aria-pressed: on OR calm OR a CVD tint. */
  active: boolean;
}

/** Pure form of reflectIconBtn's branching. A `soon` icon lands on all-false — it never claims to be on. */
export function computeIconVisual(k: string, s: IconStateSnapshot): IconVisual {
  let on = false, dis = false, calm = false, cvd = '';
  if (k === 'blind') { on = s.modoCego; dis = !s.privateOutput; }
  else if (k === 'tts') { on = s.ttsOn; dis = !s.privateOutput; }
  else if (k === 'libras') { on = s.librasOn; }
  else if (k === 'tea') { on = s.calmMode === 2; calm = s.calmMode === 1; }
  else if (k === 'altmove') { on = s.toggleMove; dis = !!s.alternanciaExigida; }
  else if (k === 'contrast') { on = temAltoContraste(s.visual); }
  else if (k === 'cvd') {
    // ⚠️ O FUNDO DE DUAS CORES É O SINAL DE LIGADO deste ícone, e agora ele lê o EIXO da correção — que
    // continua a dizer o mesmo quando o tema também está ligado, coisa que a chave única não conseguia: com
    // `hc-direto-7` no campo, a correção da criança desaparecia do ícone que existe para a mostrar.
    if (s.visual.correcao !== 'tricro') cvd = 'pi-cvd-' + s.visual.correcao;
  }
  return { on, dis, calm, cvd, active: on || calm || !!cvd };
}

/** The CSS classes reflectIconBtn clears before applying a fresh visual — in the original order. */
export const ICON_STATE_CLASSES: readonly string[] = ['pi-calm', 'pi-cvd-protan', 'pi-cvd-deuter', 'pi-cvd-tritan'];

// --- markup (pure string builders; the DOM shell below just assigns them) ---

/** One `.pi-btn`. `soon` icons get `.pi-soon` and the "under construction" suffix baked into the aria-label.
 *  The label is the RESTING one: reflectIconBtn overwrites it with the stateful label as soon as the bar is
 *  reflected. `ic.n` is an i18n key, so it must be resolved here too — the markup is rendered once at build
 *  time and would otherwise ship the raw key to a screen reader. */
export function iconBtnMarkup(ic: PauseIcon): string {
  return '<button class="pi-btn' + (ic.soon ? ' pi-soon' : '') + '" type="button" data-pi="' + ic.k +
    '" aria-label="' + (ic.soon ? t('icon.soon', { nome: t(ic.n) }) : t(ic.n)) + '">' + ic.e + '</button>';
}

/**
 * OS ÍCONES QUE ESTE JOGO CONSEGUE MESMO ACCIONAR (ADR-0106 §5).
 *
 * ⚠️ NENHUMA ETAPA PODE ENTREGAR BOTÃO MORTO, e o registo diz porquê com todas as letras: «uma barra que
 * oferece a uma criança um caminho e depois o recusa é pior do que uma barra que ela vê que não está lá,
 * porque a primeira ensina-lhe que o caminho não é para ela».
 *
 * ⚠️ E O CONTRASTE E A COR SÃO O CASO REAL, medido em 2026-09-08 e diferente dos outros seis campos
 * «acidentais»: eles não são estado que um cartucho calhou de guardar — precisam de um `render/viz-setters`,
 * cujo contexto tem **34 campos** do grafo de render de UM jogo (`parallaxLayers`, `decoSprites`,
 * `getPowerups`, `rebuildCoins`, `worldSprite`…). O `createGame` não monta isso, e um quiz não tem nada
 * disso para montar. Então aqui a engine não pode oferecer um padrão — o que ela pode é **não fingir**.
 *
 * ⚠️ Isto NÃO é o mesmo que `soon`. `soon` é «ainda não construímos»; isto é «este jogo não tem por onde», e
 * um botão que anuncia «em breve» diria a coisa errada.
 */
export interface AccionaveisDoJogo {
  /** Há quem escreva o TEMA (o alto contraste)? Sem ele, o ícone `contrast` não é montado. */
  readonly tema: boolean;
  /** Há quem escreva a CORREÇÃO de cor? Sem ela, o ícone `cvd` não é montado. */
  readonly correcao: boolean;
  /**
   * ESTE JOGO SEGURA ALGUMA TECLA? — `GameDeclaration.seguraTeclas`, o campo do ADR-0115.
   *
   * 🔴 Sem ele o ícone `altmove` não é montado, e a AUSÊNCIA é a decisão. A alternância existe para quem não
   * consegue manter uma tecla premida; num jogo onde nada se segura ela não tem o que travar, e um controle
   * que não faz nada ensina a uma criança que o ajuste de que ela depende está partido.
   *
   * ⚠️ E ISTO É UMA AUSÊNCIA DIFERENTE DA DO ADR-0113 cláusula 3, que também vive neste ficheiro: lá o
   * controle fica DESABILITADO com o motivo, porque o aparelho EXIGE a alternância e ela não se pode
   * desligar. Aqui não há nada a travar, e um controle que explica por que não faz nada continua a ser um
   * controle que não faz nada.
   *
   * ⚠️ É FUNÇÃO E NÃO VALOR, e a razão é a mesma do ADR-0084: uma resposta lida uma vez envelhece em
   * silêncio. Aqui envelhecia no pior sítio — o `reflectPauseIcons` existe justamente porque «a tabela de
   * acções deste jogo pode ter mudado desde a montagem» (ADR-0106 §5), e refrescava a partir de um booleano
   * congelado no arranque. Com um `createGame` a servir vários cartuchos (ADR-0142), o ícone descrevia o
   * jogo que arrancou primeiro. O contrato nunca esteve errado: `GameDeclaration.seguraTeclas` já é função.
   */
  readonly seguraTeclas: () => boolean;
  /**
   * Alguém sabe andar no ciclo de tipografia? (ADR-0149 §1.)
   *
   * ⚠️ OPCIONAL, e o padrão é `false` por omissão do chamador — ao contrário do `seguraTeclas`, que é
   * obrigatório porque os dois valores dele erram. Aqui não: `false` esconde um ícone que não faria nada,
   * que é exactamente o que o §5 do ADR-0106 quer. A assimetria é a mesma dos dois escritores visuais.
   */
  readonly tipografia?: boolean;
}

/**
 * @deprecated O nome dizia «escritores VISUAIS» e a pergunta deixou de ser só visual quando o `seguraTeclas`
 * entrou (ADR-0115). Use `AccionaveisDoJogo`. O alias fica para o consumidor não pagar duas quebras no mesmo
 * major — uma pelo campo novo e outra pelo nome.
 */
export type EscritoresVisuais = AccionaveisDoJogo;

export function iconesQueAccionam(escritores: AccionaveisDoJogo): readonly PauseIcon[] {
  // ⚠️ POR ÍCONE, e não um booleano para os dois — e foi uma MUTAÇÃO SOBREVIVENTE que o mostrou. Com uma
  // única bandeira, `&&` e `||` produziam o mesmo resultado nos casos que eu tinha escrito, porque todos
  // tiravam os DOIS escritores. O `&&` escondia um ícone que FUNCIONA quando só um escritor falta, e o `||`
  // mostrava um que NÃO funciona. Os dois erram, em direcções opostas, e a pergunta certa nunca foi «este
  // jogo tem escritores visuais» — é «este ÍCONE tem quem o accione».
  // 📌 E o `altmove` entra pela MESMA porta, que é o achado: «este jogo segura teclas?» é a mesma pergunta
  // que «este ícone tem quem o accione», feita a um campo do contrato em vez de a um escritor injectado.
  // Um terceiro ramo, e não uma regra nova.
  return PAUSE_ICONS.filter((ic) => (ic.k === 'contrast' ? escritores.tema
    : ic.k === 'cvd' ? escritores.correcao
      : ic.k === 'altmove' ? escritores.seguraTeclas()
        // 📌 O QUARTO RAMO, e é a mesma pergunta feita ao ciclo de tipografia (ADR-0149): o ícone existe
        // quando alguém sabe andar nele. Sem isso seria um botão que anuncia e não muda nada.
        : ic.k === 'tipografia' ? escritores.tipografia
          : true));
}

/**
 * OS TRÊS ITENS QUE A ENGINE ACCIONA SOZINHA, e que por isso nunca dependem do `getPauseActs` de um jogo.
 *
 * 📏 Lidos do despacho, e não decididos aqui: `options`/`pmback` trocam qual lista está no cartão e
 * `acessibilidade` leva o cursor à barra rápida — os três são tratados neste módulo e voltam antes de a
 * tabela do jogo ser consultada.
 */
// ⚠️ QUATRO desde 2026-09-12: `opcoesdojogo` entra pela MESMA razão que `options` já estava — ele não faz
// nada ao jogo, troca qual lista está no cartão, e é tratado neste módulo antes de a tabela do jogo ser
// consultada. Não é a engine a reclamar um item do jogo: o que é do jogo é o CONTEÚDO da lista que ele abre.
export const ITENS_DA_ENGINE: ReadonlySet<string> = new Set(['options', 'opcoesdojogo', 'pmback', 'acessibilidade']);

/**
 * OS ITENS DO MENU QUE ESTE JOGO CONSEGUE MESMO ACCIONAR (ADR-0106 §5).
 *
 * ⚠️ HOJE UM ITEM SEM ACÇÃO É UM BOTÃO MORTO, E EM SILÊNCIO. O despacho faz `const fn = acts[act]; if (fn)
 * fn();` — quem carrega num item que o jogo não implementou não recebe erro, não recebe anúncio, não recebe
 * nada. Para quem vê, parece que o clique falhou; para quem navega por leitor de tela, o menu leu-lhe um
 * item que não existe. É exactamente o que o §5 chama de pior do que a ausência: «uma barra que oferece um
 * caminho e depois o recusa ensina-lhe que o caminho não é para ela».
 */
export function itensQueAccionam(
  botoes: readonly PauseMenuButton[],
  acts: Record<string, (() => void) | undefined>,
): readonly PauseMenuButton[] {
  return botoes.filter((b) => ITENS_DA_ENGINE.has(b.act) || typeof acts[b.act] === 'function');
}

/**
 * A LISTA RAIZ, com uma regra a mais: `options` é uma PORTA, e uma porta para uma sala vazia também é um
 * botão morto.
 *
 * ⚠️ Esta é a parte que um filtro item-a-item não apanha. Se todos os painéis de ajuste forem filtrados —
 * um jogo que não monta nenhum —, o item `options` sobrevive (a engine acciona-o) e abre uma lista sem nada.
 * A criança atravessa uma porta e fica presa num submenu vazio, cuja única saída é o `pmback` que também
 * sumiu com ele.
 */
export function raizQueAcciona(
  raiz: readonly PauseMenuButton[],
  opcoes: readonly PauseMenuButton[],
  acts: Record<string, (() => void) | undefined>,
  // ⚠️ TERCEIRO ARGUMENTO OPCIONAL, e o padrão é a lista VAZIA de propósito: quem já chamava com três
  // argumentos continua a receber o que recebia, e um jogo que não declare nada do seu é exactamente o caso
  // do vazio — logo o padrão é também a resposta certa, e não um remendo para não partir chamadores.
  doJogo: readonly PauseMenuButton[] = [],
): readonly PauseMenuButton[] {
  const vivas = (bs: readonly PauseMenuButton[]): number =>
    itensQueAccionam(bs, acts).filter((b) => b.act !== 'pmback').length;
  let viva = itensQueAccionam(raiz, acts);
  if (vivas(opcoes) === 0) viva = viva.filter((b) => b.act !== 'options');
  // 📌 A MESMA REGRA PARA A PORTA NOVA, e é o gate que o ADR-0146 nomeia: um jogo sem nada seu não recebe
  // «opções do jogo». Afirmar a ausência é o caso; oferecer a porta e abrir uma sala vazia é o que o §5 do
  // ADR-0106 chama de pior do que a ausência.
  if (vivas(doJogo) === 0) viva = viva.filter((b) => b.act !== 'opcoesdojogo');
  return viva;
}

/** The whole icon bar. Used by the pause screen AND by the splash `#title-icons` (which built the same string
 *  by hand in game.js — that duplication dies with this export).
 *  O parâmetro é ADITIVO e o padrão é a lista inteira: quem já chamava sem argumentos não muda de resultado. */
export function iconsMarkup(icones: readonly PauseIcon[] = PAUSE_ICONS): string {
  return icones.map(iconBtnMarkup).join('');
}

/** One `.pm-btn`. Dynamic labels (`letra`/`nivel`) are rendered eagerly and carry NO `data-i18n`, so
 *  i18n.applyDom() cannot overwrite them. */
/**
 * ⚠️ O RÓTULO DINÂMICO ENTRA PRONTO (item 19), e a mudança conserta DUAS coisas de uma vez.
 *
 * A linha era `'📚 Nível ' + level + ' · ' + qlName[level]` — e ela tinha dois defeitos que só se enxergam
 * juntos:
 *
 *   1. FRONTEIRA. `level` vinha de `core/state.quizLevel` e `qlName` de uma tabela do jogo. Um menu de pausa
 *      da ENGINE montava o rótulo de uma atividade de alfabetização — conteúdo pedagógico, não mecânica.
 *   2. IDIOMA. "Nível" é pt-BR CRU dentro de um módulo de engine. O gate do item 14 vigia o `main.js` e não
 *      alcança `ui/`, então esta linha atravessou a i18n inteira sem ser vista. Num build em inglês, o menu
 *      de pausa de uma criança dizia "📚 Nível 2 · …".
 *
 * Agora o jogo entrega a frase montada (`dynLabel`), e a engine só a coloca no botão. O jogo é quem sabe o
 * que é um nível, quem sabe o nome dele e quem sabe em que idioma dizê-lo.
 */
export function pmBtnMarkup(
  b: PauseMenuButton, dynLabel: (b: PauseMenuButton) => string | null, tr: (key: string) => string,
): string {
  const dyn = b.letra || b.nivel;
  const lbl = dynLabel(b) ?? (dyn ? (b.lbl ?? '') : tr('pause.' + b.act));
  return '<button class="pm-btn' + (b.letra ? ' pm-letra' : '') + (b.nivel ? ' pm-nivel' : '') +
    '" role="menuitem" type="button" data-act="' + b.act + '"' +
    (dyn ? '' : (' data-i18n="pause.' + b.act + '"')) + '>' + lbl + '</button>';
}

/**
 * Qual das duas listas o cartão de pausa está mostrando.
 *
 * DUAS listas no markup, UMA visível — e a escondida carrega `hidden`, que a tira da árvore de acessibilidade
 * inteira. É o que faz "um menu por tela" (ADR-0044 §5) valer para quem escuta e não só para quem vê, e é o
 * que permite o anel dar a volta DENTRO da lista visível sem nunca atravessar para a outra.
 */
// ⚠️ TRÊS desde 2026-09-12 (ADR-0146): `jogo` é a lista do que é DESTE jogo, ao lado da lista do que a
// criança carrega entre jogos. A regra de cima não muda por serem três — UMA visível, as outras `hidden`,
// que é o que tira as escondidas da árvore de acessibilidade inteira.
export type PauseSub = 'raiz' | 'opcoes' | 'jogo';

/**
 * Os itens navegáveis de um cartão de pausa — os da lista VISÍVEL, e só eles.
 *
 * Uma constante porque TRÊS módulos a consultam (a navegação em `ui/menu-nav`, a seleção inicial em
 * `ui/shell` e a troca de submenu aqui). Enquanto fosse `.pm-btn` escrito três vezes, bastaria um deles
 * esquecer o `:not([hidden])` para o anel atravessar para a lista invisível — e a criança ouviria itens de um
 * menu que não está na tela.
 */
// 🔴 `:not([hidden])` ON THE ITEM TOO (2026-09-12): the engine hides an item with no actuator (`refrescarItensDaPausa`),
// and without it the ring stepped onto «Ajuda» hidden in the quiz — measured in dist — and «N de M» counted it.
export const PM_ITENS_VISIVEIS = '.pause-menu:not([hidden]) .pm-btn:not([hidden])';

/** O innerHTML de UMA `.pause-menu`: a lista, e só ela. */
export function pauseMenuHtml(
  bs: readonly PauseMenuButton[], sub: PauseSub, dynLabel: (b: PauseMenuButton) => string | null,
  tr: (key: string) => string,
): string {
  return '<div class="pause-menu" role="menu" data-sub="' + sub + '"' + (sub === 'raiz' ? '' : ' hidden') + '>' +
    bs.map((b) => pmBtnMarkup(b, dynLabel, tr)).join('') + '</div>';
}

/**
 * Troca a lista visível de UM cartão de pausa, e põe o cursor no PRIMEIRO item da lista que entrou.
 *
 * Livre (e não um método do `init`) de propósito: `ui/menu-nav` precisa dela para o "não" voltar da lista de
 * opções à raiz, e não tem acesso às tabelas de botões. Como as duas listas já existem no markup, a troca é
 * só DOM — nada a re-renderizar, nada a injetar.
 */
export function mostrarSubmenuDaPausa(sp: HTMLElement, sub: PauseSub): HTMLElement | null {
  sp.querySelectorAll<HTMLElement>('.pause-menu').forEach((m) => { m.hidden = m.dataset.sub !== sub; });
  const primeiro = sp.querySelector<HTMLElement>(PM_ITENS_VISIVEIS);
  sp.querySelectorAll<HTMLElement>('.pm-sel,.pi-sel').forEach((b) => b.classList.remove('pm-sel', 'pi-sel'));
  if (primeiro) primeiro.classList.add('pm-sel');
  return primeiro;
}

/**
 * A BARRA RÁPIDA DE ACESSIBILIDADE — dez alternadores e a legenda que os explica (ADR-0044, item 7).
 *
 * Saiu do cartão de pausa e passou a viver no HUD. O motivo é de uso, não de arrumação: é DURANTE a partida
 * que uma criança precisa mudar um ajuste que está a atrapalhando, e não depois de pausar. E o motivo
 * secundário é estrutural — sem ela, o cartão deixa de ter duas zonas e vira uma LISTA, o que é o que
 * finalmente autoriza o anel (a XAG 106 permite laço para menu linear e o proíbe para grade).
 *
 * A LEGENDA VIAJA JUNTO. Ela é a dica que substitui, para quem não vê, o `title` que só o mouse revela;
 * deixá-la no cartão tornaria a barra do HUD muda.
 */
export function quickBarMarkup(icones: readonly PauseIcon[] = PAUSE_ICONS): string {
  return '<div class="pause-icons" role="group" aria-label="' + t('pause.iconBarAria') + '">' + iconsMarkup(icones) +
    '</div><p class="pause-icons-cap" aria-live="polite"></p>';
}

/**
 * O QUE UMA INTENÇÃO SIGNIFICA DENTRO DO MODO `accessibility` (ADR-0044, item 7).
 *
 * O registro listou este modo entre as consequências NEGATIVAS da decisão, e disse por quê: "um modo em que
 * se entra e não se sabe sair é a própria armadilha de que este registro trata — então a saída dele (START ou
 * VOLTAR) é parte da decisão, e não um detalhe de implementação".
 *
 * Daí a forma desta função: SAIR vem primeiro, e vem por DUAS portas. Não é redundância. VOLTAR é a saída de
 * tudo no jogo, e é o que quem já o conhece tenta primeiro; START é o botão que ABRE a pausa, e a pausa é de
 * onde se entrou aqui — quem se perde tenta voltar por onde veio. Ter só uma das duas seria apostar que a
 * criança adivinhe qual delas foi escolhida.
 *
 * E a precedência é decisão também: um controle registra mais de uma borda no mesmo quadro (dedos apertam
 * junto), e nesse quadro `sair` não pode ficar atrás de `ativar`.
 */
export type AcaoNaBarra = 'sair' | 'ativar' | 'andar' | 'nada';
export function acaoNaBarra(k: NavKeys, temStart: boolean): AcaoNaBarra {
  if (temStart || k.no) return 'sair';
  if (k.yes) return 'ativar';
  if (k.up || k.down || k.left || k.right) return 'andar';
  return 'nada';
}

export interface ScreenPauseMarkupOpts {
  /** Screen/player index (0-based); the dialog label and the "· Jogador N" suffix are 1-based. */
  player: number;
  /** Live player count — the suffix only appears in multiplayer. */
  numPlayers: number;
  /** A lista RAIZ: os sete itens do ADR-0044, `resume` primeiro e `quit` último. */
  pmButtons: readonly PauseMenuButton[];
  /** O submenu de opções: os sete painéis de ajuste, com o "Voltar" na frente. */
  optionsButtons: readonly PauseMenuButton[];
  /** O submenu do JOGO (ADR-0146). Ausente = só o «voltar», que é o caso de um jogo que não declara nada. */
  jogoButtons?: readonly PauseMenuButton[];
  /** Rótulo pronto de um botão DINÂMICO, ou `null` se aquele botão não tem um. Quem monta a frase é o jogo. */
  dynLabel: (b: PauseMenuButton) => string | null;
  t: (key: string) => string;
}

/** The full innerHTML of a `.screen-pause`. Pure — every input is a parameter. */
export function screenPauseMarkup(o: ScreenPauseMarkupOpts): string {
  // O NOME ACESSÍVEL DO DIÁLOGO passa pelo dicionário. Era texto cru, e MEDIDO num jogo em inglês o efeito
  // era este: o título visível dizia "Paused" e o nome do diálogo, "Menu de pausa do jogador 1". Quem enxerga
  // lia em inglês; quem escuta recebia o menu anunciado em português — a mesma assimetria do item 4 do
  // ADR-0044, um nível acima. E `aria-label`, não `aria-labelledby`: o `<h2>` é rótulo VISUAL, e é por isso
  // que escondê-lo num quadro apertado não tira o nome do diálogo de quem escuta.
  return '<div class="pause-card" role="dialog" aria-modal="true" aria-label="' + t('pause.cardAria', { n: o.player + 1 }) + '">' +
    '<h2><span data-i18n="pause.title">' + o.t('pause.title') + '</span>'
    // ⚠️ O SUFIXO DO ASSENTO ERA `' · Jogador ' + (o.player + 1)` — PORTUGUÊS CRU dentro de um módulo de
    // engine, e num jogo em inglês lia-se «Paused · Jogador 2». Agora é chave, e vive num `<span>` próprio
    // porque o `refrescarItensDaPausa` precisa de um sítio para o REPINTAR: como `pause.cardSeat` leva um
    // parâmetro, o `data-i18n` de `applyDom` — que chama `t(k)` sem parâmetros — não serve aqui.
    // 📌 `t` do módulo e não `o.t`, pela mesma razão que a linha do `aria-label` acima já usa: a porta
    // injectada é `(key) => string` e não atravessa parâmetros.
    + '<span class="pause-seat">' + (o.numPlayers > 1 ? t('pause.cardSeat', { n: o.player + 1 }) : '') + '</span></h2>' +
    pauseMenuHtml(o.pmButtons, 'raiz', o.dynLabel, o.t) +
    pauseMenuHtml(o.optionsButtons, 'opcoes', o.dynLabel, o.t) +
    // ⚠️ A TERCEIRA LISTA ENTRA SEMPRE NO MARKUP, mesmo com um jogo que não declare nada — e não é desperdício:
    // é a mesma razão pela qual as outras duas são montadas inteiras e escondidas depois (ver a nota do
    // `buildScreenPause`). A tabela do jogo chega TARDE, e uma lista filtrada na montagem apagava para sempre
    // o que só passou a existir depois do boot. Quem decide o que se VÊ é o `refrescarItensDaPausa`.
    pauseMenuHtml(o.jogoButtons ?? PM_JOGO_BTNS, 'jogo', o.dynLabel, o.t) +
    '<p class="pause-legend"></p></div>';
}

// ---------------------------------------------------------------------------------------------
// Injection contract
// ---------------------------------------------------------------------------------------------

export interface PauseIconsCtx {
  /**
   * O DOCUMENTO onde a pausa e a barra são CONSTRUÍDAS. Ausente, vale o global.
   *
   * ⚠️ ISTO É O ACHADO 15 OUTRA VEZ, e o `boot/create-game` já o descreve no próprio cabeçalho: «`initI18n()`
   * chamava `applyDom(document)`, o GLOBAL, por baixo de quem a chamasse. Num navegador dá no mesmo e por
   * isso sobreviveu; num teste de lógica pura é a diferença entre bootar e não bootar, e num futuro com dois
   * documentos (uma engine em iframe, um editor ao lado do jogo) seria a diferença entre traduzir o documento
   * certo e o outro.»
   *
   * 📏 Medido em 2026-09-08: as duas metades que constroem DOM (`buildScreenPause`, `buildQuickBar`) faziam
   * `document.createElement` no global. Enquanto a raiz de composição de cada jogo era um `main.ts` a correr
   * num navegador, dava no mesmo — e foi por isso que sobreviveu. Deixa de dar assim que a ENGINE monta,
   * porque o `createGame` recebe o documento por `host.doc` e pode estar a montar noutro.
   */
  doc?: Document;
  /** Quantos jogadores/telas. Estado de RODADA (ADR-0038): vem da instância que a raiz possui.
   *  Era `numPlayers`, um `let` de `core/state` importado como binding vivo — e um `let` de módulo
   *  é compartilhado por qualquer segundo jogo que a mesma página carregue (D13 do `demos`). */
  getNumPlayers: () => number;
  /** Os jogadores. Estado de RODADA, pelo mesmo motivo. `readonly unknown[]` porque cada consumidor
   *  estreita para a SUA fatia — o tipo real é do jogo, não da engine (ADR-0033). */
  getPlayers: () => readonly unknown[];
  // --- announcements (core/a11y-sr; injected because they reach `document` at call time) ---
  /** aria-live "polite" — every successful toggle announces its NEW state. */
  srSay: (text: string) => void;
  /** aria-live "assertive" — the two refusals (`soon` icon, shared audio output). */
  srAlert: (text: string) => void;
  /**
   * Chamado depois de TODA saída do modo barra, com a tela e se foi silenciosa. Ausente, não se faz nada.
   * Existe para a raiz descongelar o jogo pela porta que for (ADR-0155) — a barra não sabe de fases.
   */
  aoSairDaBarra?: (i: number, silencioso: boolean) => void;

  // --- the per-screen pause menu ---
  /**
   * As BARRAS RÁPIDAS por tela (`.screen-a11y`), na ordem dos jogadores.
   *
   * Existe pelo mesmo motivo de `getPauseScreens`: `buildGameHud` REATRIBUI a array a cada remontagem, então
   * o que se injeta é o getter e não a array. E existe separada da pausa porque, desde o item 7, a barra não
   * mora mais dentro dela — o daltonismo é POR JOGADOR, e refletir os ícones exige achar a barra daquela tela.
   */
  getA11yBars: () => readonly HTMLElement[];
  /*
   * ⚠️ AS DUAS PASSARAM A OPCIONAIS (ADR-0106 §4), e o comentário que estava aqui já dizia porquê sem o
   * notar: «PM_BTNS — owned by ui/activities-menu; injected, never copied». Se a dona é a ENGINE, pedir ao
   * jogo que a devolva é o mesmo acidente dos outros sete campos. O registo fecha o §4 com a frase que isto
   * cumpre: «a engine entrega uma lista padrão, para que um jogo que não contribui com nada tenha uma».
   *
   * Ausentes, valem `PM_BTNS` / `PM_OPTIONS_BTNS`. Quem passa a sua continua a mandar.
   */
  /** PM_OPTIONS_BTNS — o submenu de opções. Mesma dona, mesmo motivo: ninguém tem duas cópias de uma lista. */
  optionsButtons?: readonly PauseMenuButton[];
  /** A lista do JOGO (ADR-0146). Ausente = `PM_JOGO_BTNS`, que é só o «voltar» — e a porta cai sozinha. */
  jogoButtons?: readonly PauseMenuButton[];
  /** PM_BTNS — the `.pm-btn` list. Owned by ui/activities-menu; injected, never copied. */
  pmButtons?: readonly PauseMenuButton[];
  /** QL_NAME — literacy-level names, for the (dormant) `nivel` button. Same owner as pmButtons. */
  /**
   * O RÓTULO de um botão dinâmico, pronto — ou `null` quando aquele botão não tem um (item 19).
   *
   * Era `quizLevel` (importado de `core/state`) mais `qlName` (tabela do jogo), e este módulo montava a
   * frase. Um menu de pausa da ENGINE não sabe o que é nível de alfabetização, nem em que idioma dizê-lo.
   * Função e não valor, porque o rótulo muda em execução — de nível E de idioma.
   */
  /*
   * ⚠️ OS TRÊS SÃO DO JOGO POR NATUREZA (ADR-0106 mede-os assim) E MESMO ASSIM FICARAM OPCIONAIS, e a
   * distinção importa: ser do jogo por natureza diz de QUEM é a resposta certa, não que a ausência dela deva
   * impedir a pausa de existir. Um jogo que não tem rótulo dinâmico, nem tabela de acções, nem ator de pausa
   * continua a merecer um cartão — com o que sobra depois do filtro do §5, que é honesto em vez de vazio.
   *
   * Ausentes: `dynLabel` vale «sem rótulo dinâmico», `getPauseActs` vale «tabela vazia» (e aí só ficam os
   * itens que a ENGINE acciona) e `setPauseActor` não regista nada — que é o que o `createGame` já faz hoje,
   * agora sem obrigar cada consumidor a escrever a mesma função vazia.
   */
  /** O rótulo dinâmico, pronto — ou `null`. Ausente: nenhum botão deste jogo tem rótulo dinâmico. */
  dynLabel?: (b: PauseMenuButton) => string | null;
  /** The `.pm-btn` action table. LAZY: `pauseActs` is a `const` declared far below the init site in game.js. */
  getPauseActs?: () => Record<string, (() => void) | undefined>;
  /** Records which player opened the menu. `pauseActor` itself stays in game.js — the gamepad, the keyboard
   *  router, openHelp() and openOptions() all read it there. */
  setPauseActor?: (i: number) => void;
  /*
   * ⚠️ `getPauseScreens` SAIU EM 2026-09-08, e a razão é o próprio ADR-0106: era um campo OBRIGATÓRIO com
   * ZERO leitores dentro deste módulo. Medido nos três lados — na engine (`git grep ctx.getPauseScreens` em
   * `ui/pause-icons` devolve zero), nos testes (só os fixtures o forneciam) e no cartucho (o
   * `game-platformer` passava-o em `main.ts:1094` para nada).
   *
   * 📌 NÃO CONFUNDIR com o homónimo do `ui/shell`, que é de outro ctx e TEM cinco leitores a sério — é ele
   * que esconde e mostra os cartões por fase. Este era a segunda cópia da mesma pergunta, feita a quem não a
   * usava; os 300 jogos teriam de a responder na mesma.
   */

  // --- blind mode (game.js owns `modoCego` + persistence + the cane/extras rebuild) ---
  getModoCego: () => boolean;
  setModoCego?: (on: boolean) => void;

  // --- TTS (platform/audio mixer; the panel refresh lives in ui/settings-audio) ---
  /**
   * O mixer por categoria. NULO até `initAudioMixer()` — `platform/audio` o declara
   * `Record<string, CatState> | null` porque o import dele é PURO (não lê localStorage), e quem inicializa
   * é o boot do consumidor. Este ctx pedia não-nulo, o que era uma promessa que a fonte não faz.
   */
  getAudioCat: () => Record<string, AudioCatState> | null;
  /** Re-applies a category's gain node after `on`/`vol` changed. */
  setCatGain: (k: string) => void;
  /** Repaints the TTS row of the auditory panel. See BUG #1 in the report: in game.js this call is behind a
   *  `typeof reflectTTS==='function'` guard on a symbol that no longer exists, so it never fires. The guard is
   *  ported verbatim as `reflectTtsPanelEnabled` below rather than silently fixed. */
  reflectTtsPanel: () => void;
  /** Verbatim port of game.js's dead guard: `typeof reflectTTS === 'function'`. Pass `false` to preserve
   *  today's behaviour (the panel is NOT refreshed), `true` to restore the intended call. */
  reflectTtsPanelEnabled: boolean;

  // --- Libras (ui/vlibras; both reach `document` at call time) ---
  isLibrasOn: () => boolean;
  toggleLibras: () => void;

  // --- TEA / reduced motion (the `rm` object is co-owned with ui/settings-motion — same reference) ---
  /*
   * ⚠️ ESTES QUATRO FICARAM PARA TRÁS NA ETAPA 1a, e o gate da FORMA foi quem o mostrou. Em 2026-09-08 eles
   * passaram a opcionais no `SettingsMotionCtx` — e AQUI continuaram obrigatórios, porque são duas cópias da
   * mesma pergunta e eu só tratei uma. A lista de campos obrigatórios lida do retrato de forma acusou-os.
   *
   * 📌 É o mesmo defeito que o próprio ADR-0106 descreve: uma coisa que cada consumidor tem de se lembrar de
   * passar, em dois sítios em vez de um. Ausentes, valem o que o `ui/motion-scene` sabe responder.
   */
  rm?: MotionSceneFlags;
  rmKeys?: readonly MotionSceneKey[];
  rmChar?: readonly MotionCharDef[];
  saveRM?: () => void;

  // --- motor + visual (both mutate state and rebake textures in game.js) ---
  setToggleMove?: (i: number, on: boolean) => void;
  /**
   * QUAL APARELHO ESTE JOGADOR ESTÁ A USAR (ADR-0113).
   *
   * 📌 O ícone `altmove` desta barra é a OUTRA superfície que escreve a alternância — a mesma razão pela
   * qual o escritor voltou para a engine (ADR-0106 §4). Sem este campo, ele escreveria só a chave antiga
   * enquanto o painel escreve as duas, e as duas superfícies divergiriam em silêncio.
   */
  transporteEmUso?: (jogador: number) => string;
  setPlayerViz?: (i: number, mode: string) => void;
  /** Os escritores POR EIXO (#104): mexer no tema não apaga a correção, e vice-versa. */
  setTemaDoJogador?: (i: number, tema: Tema) => void;
  setCorrecaoDoJogador?: (i: number, correcao: Correcao) => void;
  /**
   * ANDA UM PASSO NO CICLO DE TIPOGRAFIA e devolve a face que ficou (ADR-0149 §1).
   *
   * 📌 UM CAMPO E NÃO DOIS (ler + escrever), porque quem tem de saber a posição é quem guarda o ciclo, e
   * espalhá-la em dois sítios é a forma de eles divergirem. Este módulo só precisa do NOME da face para
   * anunciar — o resto é da raiz.
   *
   * ⚠️ AUSENTE = O ÍCONE NÃO É MONTADO, pela mesma regra dos dois escritores visuais acima: um ícone que não
   * acciona é pior do que um ícone a menos (ADR-0106 §5).
   */
  ciclarTipografia?: () => string | null;
  /**
   * ESTE JOGO SEGURA ALGUMA TECLA? — o valor de `GameDeclaration.seguraTeclas` (ADR-0115). Sem ele o ícone
   * `altmove` não é montado.
   *
   * ⚠️ OBRIGATÓRIO, e vai contra a direcção do ADR-0106, que passou a tornar campos deste ctx OPCIONAIS para
   * a engine poder montar sozinha. A excepção tem razão medida: os campos que ganharam padrão têm um padrão
   * SEGURO — o modo cego começa desligado, a lista de botões vem da engine. Aqui não há: `true` monta um
   * controle que pode não fazer nada, e `false` esconde um de que uma criança depende. Os dois lados erram, e
   * é essa a condição que o `holdsAtOnce` já usou para ser obrigatório também.
   *
   * 📌 Quem passa pelo `createGame` não escreve isto: a raiz lê a declaração, que já é obrigatória. O campo
   * só é visível para um cartucho que chame `initPauseIcons` por fora — e é exactamente esse que não pode
   * ficar em silêncio.
   *
   * ⚠️ FUNÇÃO, não valor — ver a nota no campo homónimo de `EscritoresVisuais`. Um cartucho que monte isto
   * por fora passa `() => this.declaration.seguraTeclas()` e não o resultado dela.
   */
  seguraTeclas: () => boolean;
}

export interface PauseIconsApi {
  /** Builds one `.screen-pause` (hidden), wired for click + hover/focus caption. Caller appends it. */
  buildScreenPause: (i: number) => HTMLElement;
  /** Monta a BARRA RÁPIDA (`.screen-a11y`) da tela `i`, já fiada. Chamada por ui/hud.ts, uma por tela. */
  buildQuickBar: (i: number) => HTMLElement;
  /**
   * OS ÍCONES QUE ESTA INSTÂNCIA MONTA — já filtrados pelo §5 do ADR-0106.
   *
   * ⚠️ Existe para que quem monta a barra do TÍTULO não repita o filtro. A barra do título não pode usar
   * `buildQuickBar` (ele põe `tabIndex = -1`, e o próprio comentário lá diz porquê: no título não se está a
   * jogar), então ela chama `iconsMarkup` directamente — e sem este acessor teria de recalcular quais ícones
   * accionam, que é uma segunda cópia da mesma decisão.
   */
  iconesMontados: readonly PauseIcon[];
  /** ENTRA no modo `accessibility` da tela `i` — a metade da barra da pausa rápida (ADR-0155). Não mexe na fase. */
  entrarNaBarra: (i: number) => void;
  /** SAI do modo e devolve o direcional ao personagem. `silencioso` = sai para outro ecrã, não para o jogo. */
  sairDaBarra: (i: number, silencioso?: boolean) => void;
  /** A tela `i` está com o direcional na BARRA em vez de no personagem? Perguntado a cada quadro. */
  naBarraDe: (i: number) => boolean;
  /** Um passo dentro do modo. `temStart` é a borda do botão de pausa — a segunda saída (ADR-0044, item 7). */
  navBar: (i: number, k: NavKeys, temStart?: boolean) => void;
  /** Runs the icon `k` for screen `i`. Does NOT reflect — callers reflect after, as game.js always did. */
  iconAct: (k: string, i: number) => void;
  /** The state-reflecting `aria-label` of icon `k` for screen `i`. */
  iconLabel: (k: string, i: number) => string;
  /** Applies classes + aria-pressed + aria-label to ONE `.pi-btn`. */
  reflectIconBtn: (b: HTMLElement, i: number) => void;
  /** Reflects every `.pi-btn` inside `root` in screen `i`'s scope. `#title-icons` uses i=0 (splash = J1). */
  reflectIconsIn: (root: ParentNode | null, i: number) => void;
  /** Reflects every pause screen (each in its own player's scope). */
  reflectPauseIcons: () => void;
  /** Applies the current TEA level to scene motion, character motion and the five audio categories. */
  applyCalm: () => void;
  getCalmMode: () => number;
  /** Sets the TEA level WITHOUT applying it (applyCalm is the apply step) — for tests and future restore. */
  setCalmMode: (n: number) => void;
  /** Snapshot of everything the label/visual of screen `i` depends on. Exposed for tests and debugging. */
  iconState: (i: number) => IconStateSnapshot;
}

// ---------------------------------------------------------------------------------------------
// DOM-facing shell
// ---------------------------------------------------------------------------------------------

export function initPauseIcons(ctx: PauseIconsCtx): PauseIconsApi {
  // ⚠️ O NÍVEL TEA PASSOU A PERSISTIR EM 2026-09-07 (issue #61). Este comentário dizia «deliberately NOT
  // persisted — verbatim: game.js never wrote it to storage», e o **verbatim** é o que o desqualificava como
  // decisão: foi PRESERVADO na extração do monólito, não escolhido. O ADR-0028 diz que todo menu persiste, e
  // este é um controlo de menu que vive na barra rápida.
  //
  // O custo de não persistir era da criança que mais precisa dele: quem usa o modo SILENCIOSO voltava a
  // pô-lo a cada sessão — e é para quem o barulho inesperado custa mais. Um ajuste que se esquece não é um
  // ajuste, é uma tarefa diária.
  //
  // ⚠️ LÊ NO INIT, NUNCA NO IMPORT: a regra vale para todo o projeto e aqui tem custo concreto — um teste que
  // importasse este módulo passaria a depender do `localStorage` do ambiente, e um nível herdado de outro
  // caso é uma falha que aparece longe da causa.
  let calmMode = lerNivelTea();

  const P = (): readonly PausePlayer[] => ctx.getPlayers() as readonly PausePlayer[];

  /*
   * ⚠️ A ALTERNÂNCIA DE MARCHA PASSOU A TER PADRÃO DA ENGINE (ADR-0106 §4, etapa 1b). Quem injecta continua a
   * mandar; quem não injecta deixa de ficar sem ela — que era o caso dos cinco jogos sem barra.
   *
   * O `store` vem do import directo deste módulo e não do `ctx`, porque é assim que este ficheiro já persiste
   * o resto: uma chave injectada é um campo que um consumidor pode omitir, e omiti-la faria escrever num nome
   * torto.
   */
  const setToggleMove = ctx.setToggleMove
    ?? ((i: number, on: boolean) => definirAlternanciaDeMarcha(
      {
        players: P(), store, srSay: ctx.srSay, getNumPlayers: ctx.getNumPlayers,
        // ⚠️ ATRAVESSA, e não se resolve aqui: o ícone e o painel têm de escrever a MESMA coisa. Resolver
        // o aparelho num deles e não no outro é como duas superfícies da mesma engine passam a discordar.
        transporteEmUso: ctx.transporteEmUso,
      }, i, on));

  /*
   * ⚠️ O MODO CEGO IDEM, e aqui o padrão é literalmente o que o `core/state` já decidiu que um setter faz:
   * «grava, persiste, avisa» — e nada mais. Os efeitos de jogo (refazer os extras do nível) são REACÇÃO, e
   * quem reage assina `on('modoCego', …)`. O anúncio não se perde para quem não injecta: este ícone já diz
   * `sr.icon.blindOn`/`Off` por si, logo abaixo.
   */
  const setModoCego = ctx.setModoCego ?? setModoCegoValue;

  /** O documento onde se constroi. Resolvido a cada uso, e por globalThis — em node o identificador
   *  document nem existe, e um ?? sobre ele lançaria ReferenceError em vez de cair no padrão. */
  const docDaMontagem = (): Document => ctx.doc ?? (globalThis as { document?: Document }).document as Document;

  /*
   * ⚠️ O CONTRASTE E A COR SÓ APARECEM SE HOUVER QUEM OS ESCREVA (ADR-0106 §5).
   *
   * 📏 Medido em 2026-09-08, e é o que separa este caso dos outros seis campos «acidentais»: eles eram estado
   * que um cartucho calhou de guardar, e a engine pôde reclamá-los. Estes precisam de um
   * `render/viz-setters`, cujo contexto pede **34 campos** do grafo de render de UM jogo — `parallaxLayers`,
   * `decoSprites`, `getPowerups`, `rebuildCoins`, `worldSprite`. O `createGame` não monta isso, e um quiz não
   * tem nada disso para montar. A engine não pode dar um padrão aqui; o que ela pode é não FINGIR.
   *
   * Decidido uma vez, no arranque, e não a cada montagem de barra: o conjunto de escritores de um consumidor
   * não muda a meio de uma partida, e recalcular por tela faria as telas discordarem entre si.
   */
  const iconesDoJogo = iconesQueAccionam({
    tema: Boolean(ctx.setTemaDoJogador),
    correcao: Boolean(ctx.setCorrecaoDoJogador),
    // 📌 Sem `Boolean(...)`: os dois de cima perguntam «existe escritor?» a um campo opcional; este é uma
    // RESPOSTA que o jogo deu, e envolvê-la faria um `undefined` de um ctx mal montado virar `false` —
    // esconder o controle em silêncio, que é metade do defeito que este campo existe para não cometer.
    seguraTeclas: ctx.seguraTeclas,
    tipografia: Boolean(ctx.ciclarTipografia),
  });

  /*
   * ⚠️ RESOLVIDOS UMA VEZ, no arranque, pela mesma razão do `settings-motion`: o `rm` é mutado in-place e
   * partilhado por REFERÊNCIA com quem desenha a cena, e resolvê-lo a cada uso criaria um objecto novo por
   * chamada — o interruptor deixaria de alcançar o desenho, sem erro nenhum.
   *
   * 📌 O `getPauseActs` fica FUNÇÃO e não valor, porque a laziness dele é a razão de ele existir assim: no
   * cartucho a tabela é um `const` declarado ~1200 linhas abaixo, e lê-la aqui cairia na zona morta temporal.
   */
  const rm: MotionSceneFlags = ctx.rm ?? lerCenaGuardada();
  const rmKeys: readonly MotionSceneKey[] = ctx.rmKeys ?? CHAVES_DE_CENA;
  const rmChar: readonly MotionCharDef[] = ctx.rmChar ?? ANIMACOES_DO_PERSONAGEM;
  const saveRM: () => void = ctx.saveRM ?? (() => guardarCena(rm));
  /*
   * ⚠️ ESTES TRÊS SÃO LIDOS A CADA CHAMADA, e não resolvidos uma vez como o `rm` acima. A diferença é
   * deliberada e um teste apanhou-me a errá-la: congelar `ctx.getPauseActs` no arranque partiu um caso que
   * TROCA a tabela depois do `init` — e trocar depois é legítimo, porque a laziness deste campo existe
   * precisamente por a tabela chegar tarde. Um padrão não pode custar a ligação tardia que o campo tem.
   *
   * O `rm` é o contrário e por isso fica congelado: ali o que importa é a IDENTIDADE do objecto, partilhada
   * por referência com quem desenha a cena.
   *
   * A anotação de tipo é necessária: sem ela o padrão `() => ({})` infere `{}`, que não aceita indexação por
   * string, e o compilador passaria a recusar `acts[act]` — o despacho inteiro.
   */
  const dynLabel = (b: PauseMenuButton): string | null => (ctx.dynLabel ? ctx.dynLabel(b) : null);
  const getPauseActs = (): Record<string, (() => void) | undefined> => (ctx.getPauseActs ? ctx.getPauseActs() : {});
  const setPauseActor = (i: number): void => { if (ctx.setPauseActor) ctx.setPauseActor(i); };

  function hasPrivateOutput(i: number): boolean { return hasPrivateOutputIn(P(), ctx.getNumPlayers(), i); }
  /** A recusa da alternância para este jogador agora, ou `null`. Recalculada: o aparelho em uso muda. */
  function recusaAgora(i: number) { return ctx.transporteEmUso ? recusaDaAlternancia(ctx.transporteEmUso(i)) : null; }

  function iconState(i: number): IconStateSnapshot {
    const p = P()[i] || {};
    const cat = ctx.getAudioCat();
    return {
      modoCego: ctx.getModoCego(),
      ttsOn: !!(cat && cat.tts && cat.tts.on),
      librasOn: ctx.isLibrasOn(),
      calmMode,
      toggleMove: !!p.toggleMove,
      // ⚠️ `DEFAULTS.viz` E NÃO `''` (issue #61). A cadeia vazia funcionava por ACIDENTE: não casa
      // `hc-direto` nem `fix-*`, então os dois ícones ficavam apagados pelo motivo certo por engano. O padrão
      // passou a ter nome em `core/state`, e `render/viz-modes` já declarava esse modo com `kind:'normal'` —
      // o que não faz nada. Dizer o padrão em vez de o deduzir é o que torna a marca do ADR-0029 possível
      // aqui, porque ela lê `DEFAULTS` e mais nada.
      visual: p.visual ?? PADRAO,
      privateOutput: hasPrivateOutput(i),
      alternanciaExigida: recusaAgora(i) !== null,
    };
  }

  // --- TEA ---------------------------------------------------------------------------------

  function applyCalm(): void {
    const plan = calmMotionPlan(calmMode);
    for (const k of rmKeys) rm[k] = plan.sceneReduced;
    saveRM();
    // "silencioso" freezes the character too. Iterates the WHOLE players array (not just numPlayers) — verbatim.
    for (const p of P()) for (const c of rmChar) p[c.prop] = plan.charFrozen;
    const cat = ctx.getAudioCat();
    for (const k of CALM_AUDIO_CATS) {
      const c = cat && cat[k];
      if (!c) continue;
      const next = calmAudioPlan(calmMode, c.vol);
      c.on = next.on; c.vol = next.vol;
      ctx.setCatGain(k);
    }
    // TTS/sonar/guarda/guia stay intact on purpose: TEA is about noise, not about losing navigation.
  }

  // --- icon actions (the dispatcher, as a table) ---------------------------------------------

  const ICON_ACTS: Record<string, (i: number) => void> = {
    blind: () => {
      setModoCego(!ctx.getModoCego());
      ctx.srSay(t(ctx.getModoCego() ? 'sr.icon.blindOn' : 'sr.icon.blindOff'));
    },
    tts: () => {
      const cat = ctx.getAudioCat();
      if (!cat || !cat.tts) return; // a guarda que `iconLabel` e `applyCalm` já tinham e esta ação não
      cat.tts.on = !cat.tts.on;
      ctx.setCatGain('tts');
      if (ctx.reflectTtsPanelEnabled) ctx.reflectTtsPanel();
      ctx.srSay(t(cat.tts.on ? 'sr.audio.ttsOn' : 'sr.audio.ttsOff'));
    },
    libras: () => {
      ctx.toggleLibras();
      ctx.srSay(t(ctx.isLibrasOn() ? 'sr.icon.librasOn' : 'sr.icon.librasOff'));
    },
    tea: () => {
      calmMode = nextCalmMode(calmMode);
      store.set(store.KEYS.tea, calmMode); // ADR-0028: todo menu persiste. Ver a nota no `let` acima.
      applyCalm();
      ctx.srSay(t('sr.icon.tea', { v: t(CALM_NAMES[calmMode]!) }));
    },
    altmove: (i) => {
      // verbatim: `players[i].toggleMove` with no `||{}` guard (unlike contrast/cvd below).
      setToggleMove(i, !P()[i].toggleMove);
    },
    // ⚠️ OS DOIS ÍCONES DEIXARAM DE SE APAGAR UM AO OUTRO (#104). Eles SEMPRE ciclaram dentro do seu eixo —
    // `nextContrast` e `nextCvd` existem separados desde sempre —, mas escreviam os dois no mesmo campo, e
    // por isso mexer num zerava o outro. O snapshot dizia isso como se fosse desenho: «they overwrite each
    // other; that is by design». Agora cada um escreve no seu eixo e o outro fica onde estava.
    // ⚠️ AS DUAS GUARDAS NÃO SÃO CINTO E SUSPENSÓRIOS. Sem escritor, o ícone nem sequer é montado
    // (`iconesDoJogo`), então este ramo não deveria ser alcançável pela barra — mas `iconAct` é EXPORTADO e
    // qualquer consumidor pode chamá-lo por chave. Sem a guarda, essa chamada rebentaria; com ela, não faz
    // nada e não anuncia — que é o mesmo que dizer a verdade: este jogo não tem por onde.
    contrast: (i) => {
      if (!ctx.setTemaDoJogador) return;
      const v = proximoTema((P()[i] || {}).visual ?? PADRAO);
      ctx.setTemaDoJogador(i, v.tema);
      ctx.srSay(t('sr.visual.contrast', { v: t(CURTO_DO_TEMA[v.tema]) }));
    },
    /*
     * O CICLO DE TIPOGRAFIA (ADR-0149 §1): uma pressão muda a CAIXA e a FACE de uma vez.
     *
     * 📌 A guarda é a mesma dos dois abaixo e pela mesma razão escrita ali: sem quem accione, o ícone nem é
     * montado — mas `iconAct` é EXPORTADO e um consumidor pode chamá-lo por chave. Sem ela, essa chamada
     * rebentava; com ela, não faz nada e não anuncia, que é dizer a verdade.
     *
     * ⚠️ ANUNCIA A FACE E NÃO A POSIÇÃO. «Posição 3 de 5» não diz nada a ninguém; o nome da face é o que a
     * criança reconhece, e é a mesma razão pela qual o ADR-0074 proíbe `action2` chegar a uma pessoa.
     */
    tipografia: () => {
      if (!ctx.ciclarTipografia) return;
      const face = ctx.ciclarTipografia();
      if (face) ctx.srSay(t('sr.typo.font', { fam: face }));
    },
    cvd: (i) => {
      if (!ctx.setCorrecaoDoJogador) return;
      const v = proximaCorrecao((P()[i] || {}).visual ?? PADRAO);
      ctx.setCorrecaoDoJogador(i, v.correcao);
      ctx.srSay(t('sr.icon.cvd', { v: t(CURTO_DA_CORRECAO[v.correcao]) }));
    },
  };

  function iconAct(k: string, i: number): void {
    const ic = ICON_BY_KEY.get(k);
    if (ic && ic.soon) {
      ctx.srAlert(t('sr.icon.underConstruction', { nome: t(ic.n) }));
      return;
    }
    if ((k === 'blind' || k === 'tts') && !hasPrivateOutput(i)) {
      ctx.srAlert(t('sr.icon.needsPrivateOutput'));
      return;
    }
    // ⚠️ A MESMA RECUSA DO PAINEL, na mesma forma que as duas acima: DIZER e voltar. Aceitar o clique e
    // ignorá-lo é a outra metade do que o ADR-0076 proíbe, e aqui há um agravante — este ícone e o
    // `#opt-altmove` escrevem o MESMO valor, logo um a aceitar enquanto o outro recusa daria à criança dois
    // botões que discordam sobre o mesmo ajuste.
    if (k === 'altmove') {
      const recusa = recusaAgora(i);
      if (recusa) { ctx.srAlert(t(recusa.chave)); return; }
    }
    const act = ICON_ACTS[k];
    if (act) act(i);
  }

  // --- reflection --------------------------------------------------------------------------

  function iconLabel(k: string, i: number): string { return computeIconLabel(k, iconState(i)); }

  function reflectIconBtn(b: HTMLElement, i: number): void {
    const k = b.dataset.pi || '';
    const st = iconState(i);
    const v = computeIconVisual(k, st);
    b.classList.remove(...ICON_STATE_CLASSES);
    if (v.calm) b.classList.add('pi-calm');
    if (v.cvd) b.classList.add(v.cvd);
    b.classList.toggle('pi-on', v.on);
    b.classList.toggle('pi-dis', v.dis);
    /*
     * 🔴 A ISSUE #128, E ELA É DE UMA LINHA: `pi-dis` é CLASSE CSS. A criança que enxerga vê o ícone
     * apagado; a que navega por leitor de tela não recebe nada — o botão anuncia-se accionável e não
     * responde. `aria-disabled` espelha o mesmo facto para quem ouve.
     *
     * ⚠️ E `aria-disabled` e NÃO `disabled`: o segundo tira o botão da ordem de tabulação, e quem navega
     * por teclado deixaria de o alcançar — logo deixaria de poder ouvir POR QUE ele não responde. É a
     * mesma escolha que o `#opt-altmove` faz no painel, pela mesma razão.
     */
    if (v.dis) b.setAttribute('aria-disabled', 'true');
    else b.removeAttribute('aria-disabled');
    b.setAttribute('aria-pressed', String(v.active));
    // ⚠️ TODO ÍCONE RECEBE RÓTULO, `soon` INCLUÍDO — e o guarda que aqui estava dizia por que não: «`soon`
    // buttons keep the label the markup gave them (same string)». A segunda metade continua certa (não há
    // estado a reportar), mas «mesma string» era verdade só enquanto a marcação e o reflexo corressem no
    // MESMO IDIOMA — e desde que a engine passou a montar a barra (ADR-0106 etapa 2) deixam de correr.
    // O `initI18n` carrega en/es de forma assíncrona; a marcação nasce em pt e só o reflexo a corrige.
    // 📌 Medido num navegador: cinco ícones em inglês e três ainda em «(em construção)», na mesma barra.
    b.setAttribute('aria-label', computeIconLabel(k, st));
  }

  function reflectIconsIn(root: ParentNode | null, i: number): void {
    if (!root) return;
    root.querySelectorAll<HTMLElement>('.pi-btn').forEach((b) => reflectIconBtn(b, i));
  }

  /**
   * Reflete os ícones de TODAS as telas. Varre as BARRAS e não mais os cartões de pausa: desde o item 7 do
   * ADR-0044 os ícones vivem no HUD, e um cartão de pausa não contém `.pi-btn` nenhum.
   */
  /**
   * OS CARTÕES QUE ESTA INSTÂNCIA CONSTRUIU. Privado, e é a resposta a um problema que eu próprio criei.
   *
   * ⚠️ O `PauseIconsCtx` tinha um `getPauseScreens` e eu removi-o hoje, com razão: tinha ZERO leitores. Agora
   * este módulo precisa de alcançar os cartões — e a saída certa NÃO é repor o campo. Quem os construiu foi
   * ele; guardar o que construiu não pede nada a consumidor nenhum, e um campo de ctx é mais uma coisa que
   * cada um dos 300 jogos teria de se lembrar de passar.
   */
  const cartoes: HTMLElement[] = [];

  /**
   * ESCONDE OS ITENS QUE ESTE JOGO NÃO CONSEGUE ACCIONAR — recalculado, e não decidido no arranque.
   *
   * ⚠️ ESTA FUNÇÃO EXISTE POR UM DEFEITO DE TEMPO. O cartão era FILTRADO no `buildScreenPause`, e o
   * `getPauseActs` é um getter precisamente porque a tabela CHEGA TARDE — «`pauseActs` is a `const` declared
   * far below the init site», diz o próprio campo. Um consumidor que siga esse padrão documentado montava um
   * cartão sem os itens cuja acção só existiu depois do boot, e nunca mais os recuperava.
   *
   * 📌 A avaliação passou para o ÚLTIMO instante possível: o `ui/shell` chama `reflectPauseIcons()` quando a
   * fase vira `pause-menu`, ou seja quando a pausa ABRE. O §5 continua respeitado — a criança nunca vê um
   * item que não acciona —, e agora também vê os que passaram a accionar.
   */
  /**
   * O NOME DO CARTÃO — o que se VÊ e o que se OUVE — repintado no idioma corrente.
   *
   * 🔴 MEDIDO em 2026-09-12, no `dist/quiz.html` com `documentElement.lang === 'en'`: o cartão de pausa
   * mostrava «Paused», «Resume», «Accessibility», «Typography» — tudo em inglês — e anunciava-se a quem usa
   * leitor de tela como **«Menu de pausa do jogador 1»**. A chave existe nos três dicionários; o que falha é
   * o TEMPO, o mesmo do ficheiro `barra-no-idioma-do-arranque`: o `initI18n` aplica pt de forma síncrona e
   * pede en/es de forma assíncrona, a marcação nasce nesse intervalo, e um `aria-label` colado não tem como
   * ser corrigido depois — `applyDom` só alcança `[data-i18n]` e `[data-i18n-aria]`.
   *
   * ⚠️ E `data-i18n-aria` NÃO SERVIRIA AQUI: `applyDom` chama `t(k)` sem parâmetros, e esta chave leva o
   * número do assento. Um `data-i18n-aria` deixaria a pessoa a ouvir «Player {n} pause menu», com as chavetas.
   *
   * 🎯 Por isso repinta-se aqui: `refrescarItensDaPausa` já corre a cada `reflectPauseIcons()`, ou seja a
   * cada vez que a pausa ABRE. O idioma vale no instante em que a criança a abre, que é o instante certo.
   *
   * ⚠️ QUEM PERDIA ERA SÓ QUEM ESCUTA, e é isso que faz este defeito ser da família que o ADR-0044 item 4
   * nomeia: para quem vê, o cartão estava inteiro em inglês e nada havia a notar. O canal partido era o
   * único canal de outra criança.
   */
  function renomearCartao(cartao: HTMLElement, i: number): void {
    const card = cartao.querySelector<HTMLElement>('.pause-card');
    if (card) card.setAttribute('aria-label', t('pause.cardAria', { n: i + 1 }));
    const assento = cartao.querySelector<HTMLElement>('h2 .pause-seat');
    if (assento) assento.textContent = ctx.getNumPlayers() > 1 ? t('pause.cardSeat', { n: i + 1 }) : '';
  }

  function refrescarItensDaPausa(): void {
    const acts = getPauseActs();
    const raiz = ctx.pmButtons ?? PM_BTNS;
    const opcoes = ctx.optionsButtons ?? PM_OPTIONS_BTNS;
    const doJogo = ctx.jogoButtons ?? PM_JOGO_BTNS;
    const vivos = new Set([
      ...raizQueAcciona(raiz, opcoes, acts, doJogo).map((b) => b.act),
      ...itensQueAccionam(opcoes, acts).map((b) => b.act),
      ...itensQueAccionam(doJogo, acts).map((b) => b.act),
    ]);
    // ⚠️ `filter(Boolean)` VIROU ÍNDICE EXPLÍCITO, e a razão é a linha do nome logo abaixo: os cartões são
    // indexados por JOGADOR, montar só a tela 2 deixa um buraco no índice 0 — e `filter` fechava o buraco,
    // o que renumerava os assentos. O guarda de `undefined` que ele dava fica, escrito à mão.
    for (let i = 0; i < cartoes.length; i++) {
      const cartao = cartoes[i];
      if (!cartao) continue;
      renomearCartao(cartao, i);
      for (const btn of cartao.querySelectorAll<HTMLElement>('.pm-btn')) {
        // ⚠️ `hidden` e não `remove()`: reaparecer tem de ser possível, porque a tabela pode crescer outra vez
        // (um jogo que só liga «sair» depois da primeira fase). Remover seria decidir uma vez de novo.
        btn.hidden = !vivos.has(btn.dataset.act ?? '');
      }
    }
  }

  function reflectPauseIcons(): void {
    ctx.getA11yBars().forEach((bar, i) => reflectIconsIn(bar, i));
    refrescarItensDaPausa();
  }

  // --- the pause screen ----------------------------------------------------------------------

  /**
   * Troca a lista visível E ANUNCIA o primeiro item da lista que entrou.
   *
   * O anúncio não é enfeite: quem não enxerga acabou de mudar de menu e o cursor pulou para outro lugar. Sem
   * a fala, a única pista de que a tela mudou seria o silêncio. O índice "N de M" vem junto (item 3), e é ele
   * que diz de quantos itens é a lista nova.
   */
  function anunciarLista(sp: HTMLElement, sub: PauseSub): void {
    const primeiro = mostrarSubmenuDaPausa(sp, sub);
    if (!primeiro) return;
    const itens = [...sp.querySelectorAll<HTMLElement>(PM_ITENS_VISIVEIS)];
    ctx.srSay(anunciarItem(
      { rotulo: primeiro.textContent || '', posicao: 1, total: itens.length }, menuIndexOn,
    ));
  }

  /* ===================== O MODO `accessibility` (ADR-0044, item 7) ===================== */

  /**
   * Quem está com o direcional dirigindo a BARRA em vez do personagem.
   *
   * Vida de RODADA (ADR-0038): mora no closure desta instância, não é persistido, e some com a partida. Um
   * modo de entrada que sobrevivesse ao reinício seria a armadilha voltando pela porta dos fundos — a criança
   * abriria o jogo no dia seguinte e o personagem não andaria.
   */
  const naBarra = new Set<number>();

  /** O cursor da barra da tela `i`, ou o primeiro ícone quando ainda não há cursor. */
  function iconeSelecionado(bar: HTMLElement): HTMLElement | null {
    return bar.querySelector<HTMLElement>('.pi-sel') || bar.querySelector<HTMLElement>('.pi-btn');
  }

  /** Põe o cursor num ícone, escreve a legenda e ANUNCIA — a legenda é o canal de quem não vê o ícone. */
  function selecionarIcone(bar: HTMLElement, el: HTMLElement): void {
    bar.querySelectorAll<HTMLElement>('.pi-sel').forEach((x) => x.classList.remove('pi-sel'));
    el.classList.add('pi-sel');
    const cap = bar.querySelector('.pause-icons-cap');
    if (cap) cap.textContent = legendaDoIcone(bar, el);
    ctx.srSay(legendaDoIcone(bar, el));
  }

  /**
   * ENTRA no modo: o direcional passa a dirigir a barra da tela `i`.
   *
   * 🔴 E JÁ NÃO RETOMA O JOGO (ADR-0155). Até ali o modo era «para usar DURANTE a partida» e entrar chamava
   * `acts.resume()`; desde que o START é a PAUSA RÁPIDA, a barra é usada com o jogo CONGELADO, e retomar ao
   * entrar descongelaria o mundo no instante em que a criança pediu que parasse. Quem entra decide a fase.
   *
   * O anúncio diz como SAIR, e diz na hora de entrar. É a linha que desarma a armadilha que o próprio
   * ADR-0044 anotou como consequência negativa desta decisão: quem não enxerga aperta a direção, o personagem
   * não anda, e sem esta frase não há nada na tela que explique — porque a tela não é o canal dessa criança.
   */
  function entrarNaBarra(i: number): void {
    const bar = ctx.getA11yBars()[i];
    const primeiro = bar && iconeSelecionado(bar);
    if (!bar || !primeiro) return;
    naBarra.add(i);
    ctx.srSay(t('sr.a11y.barEnter'));
    selecionarIcone(bar, primeiro);
  }

  /**
   * SAI do modo e devolve o direcional ao personagem. Anuncia, porque a devolução também é informação.
   *
   * `silencioso` é para quem sai da barra para OUTRO ecrã e não para o jogo — o SELECT, que troca a pausa rápida
   * pelo cartão (ADR-0155): «de volta ao jogo» dito aí seria mentira, com o cartão a abrir por cima.
   *
   * 📌 E `aoSairDaBarra` corre em TODA saída — Voltar, START ou quem chame isto —, porque a raiz tem de
   * descongelar o jogo por qualquer porta. Uma saída que só um caminho conhecesse deixava o outro com a criança
   * de volta ao personagem num mundo parado.
   */
  function sairDaBarra(i: number, silencioso = false): void {
    if (!naBarra.delete(i)) return;
    const bar = ctx.getA11yBars()[i];
    if (bar) {
      bar.querySelectorAll<HTMLElement>('.pi-sel').forEach((x) => x.classList.remove('pi-sel'));
      const cap = bar.querySelector('.pause-icons-cap');
      if (cap) cap.textContent = '';
    }
    if (!silencioso) ctx.srSay(t('sr.a11y.barExit'));
    ctx.aoSairDaBarra?.(i, silencioso);
  }

  /** A tela `i` está com o direcional na barra? É o que o roteamento de entrada pergunta a cada quadro. */
  const naBarraDe = (i: number): boolean => naBarra.has(i);

  /**
   * UM PASSO dentro do modo. `temStart` é a borda do botão que abre a pausa — a segunda saída.
   *
   * A barra é uma fileira, então as QUATRO direções andam nela: para quem navega sem ver, "cima" numa lista
   * de uma linha só não pode ser um beco. E anda em ANEL, como todo menu do jogo desde o item 1.
   */
  function navBar(i: number, k: NavKeys, temStart = false): void {
    if (!naBarra.has(i)) return;
    const bar = ctx.getA11yBars()[i];
    if (!bar) return;
    const acao = acaoNaBarra(k, temStart);
    if (acao === 'sair') { sairDaBarra(i); return; }
    const icones = [...bar.querySelectorAll<HTMLElement>('.pi-btn')];
    if (!icones.length) return;
    const cur = iconeSelecionado(bar);
    const idx = cur ? icones.indexOf(cur) : 0;
    if (acao === 'ativar') { setPauseActor(i); if (cur) cur.click(); return; }
    if (acao === 'andar') {
      const d = (k.down || k.right) ? 1 : -1;
      selecionarIcone(bar, icones[passoNoAnel(icones.length, idx, d)]);
    }
  }

  function buildScreenPause(i: number): HTMLElement {
    const sp = docDaMontagem().createElement('div');
    sp.className = 'screen-pause';
    sp.hidden = true;
    sp.dataset.player = String(i);
    /*
     * ⚠️ MONTA A LISTA INTEIRA E ESCONDE DEPOIS — e a versão anterior desta linha FILTRAVA aqui, o que estava
     * errado por uma razão de TEMPO. O comentário que estava neste sítio dizia «montar é o primeiro instante
     * em que a resposta existe»; não é. O `getPauseActs` é um getter precisamente porque a tabela chega
     * TARDE — «`pauseActs` is a `const` declared far below the init site», diz o próprio campo —, e o
     * `createGame` monta durante o próprio `createGame(...)`. Filtrar aqui apagava para sempre todo item cuja
     * acção só passou a existir depois do boot.
     *
     * Quem decide o que se VÊ é o `refrescarItensDaPausa`, a cada `reflectPauseIcons()` — que o `ui/shell`
     * dispara quando a fase vira `pause-menu`, ou seja quando a pausa ABRE. O §5 continua respeitado (a
     * criança nunca vê um item que não acciona) e agora também vê os que passaram a accionar.
     */
    sp.innerHTML = screenPauseMarkup({
      player: i,
      numPlayers: ctx.getNumPlayers(),
      pmButtons: ctx.pmButtons ?? PM_BTNS,
      optionsButtons: ctx.optionsButtons ?? PM_OPTIONS_BTNS,
      jogoButtons: ctx.jogoButtons ?? PM_JOGO_BTNS,
      dynLabel: dynLabel, t,
    });
    cartoes[i] = sp;
    refrescarItensDaPausa(); // o §5 vale já na montagem, e não só na primeira abertura

    sp.addEventListener('click', (e) => {
      const target = e.target as Element | null;
      const b = target && target.closest<HTMLElement>('.pm-btn');
      if (b) {
        setPauseActor(i);
        const act = b.dataset.act || '';
        // NAVEGAÇÃO DENTRO DO CARTÃO fica aqui, e não na tabela de ações: `options` e `pmback` não fazem nada
        // ao jogo — trocam qual lista está na tela. A tabela vive em `ui/shell`, que não conhece este `sp`.
        // ⚠️ TRÊS PORTAS AGORA, e o `pmback` volta sempre à RAIZ — de qualquer das duas listas. Escrito como
        // tabela e não como encadeado de `if`, porque uma quarta lista seria mais uma linha e não mais um ramo.
        const PARA: Record<string, PauseSub> = { options: 'opcoes', opcoesdojogo: 'jogo', pmback: 'raiz' };
        if (PARA[act]) { anunciarLista(sp, PARA[act]!); return; }
        // `acessibilidade` leva o cursor à BARRA RÁPIDA. Enquanto ela mora dentro do cartão, "entrar no modo"
        // é pôr o cursor nela — e a saída continua sendo a saída da pausa, que é a mesma de sempre. Quando o
        // item 7 levar a barra para o HUD, esta linha o segue; o que o item SIGNIFICA não muda.
        // ⚠️ O ITEM SAIU DA RAIZ (ADR-0151) e só o alcança uma lista que o JOGO passe; para ela o comportamento
        // antigo fica aqui, explícito — fechar o cartão e jogar com a barra —, já que `entrarNaBarra` deixou de
        // retomar sozinho (ADR-0155).
        if (act === 'acessibilidade') { getPauseActs().resume?.(); entrarNaBarra(i); return; }
        const acts = getPauseActs();
        const fn = acts[act];
        if (fn) fn();
        return;
      }
    });
    return sp;
  }

  /**
   * A BARRA RÁPIDA de uma tela: os dez alternadores, a legenda, e a fiação dos dois.
   *
   * Ela é IRMÃ da `.screen-exp` e não filha, e isso é a decisão do #82 aplicada: a barra é CONTROLE, não
   * experiência. O modo empatia degrada a experiência de propósito — simulação é criar dificuldade onde a
   * facilidade não existe —, e degradar o que existe para DAR acesso seria o contrário do que ele serve.
   */
  function buildQuickBar(i: number): HTMLElement {
    const bar = docDaMontagem().createElement('div');
    bar.className = 'screen-a11y';
    bar.dataset.player = String(i);
    bar.innerHTML = quickBarMarkup(iconesDoJogo);
    // FORA DA ORDEM DE TABULAÇÃO durante a partida (ADR-0044, item 7). Dez paradas entre a criança e o jogo
    // seria o preço de deixá-los lá — e o alcance por teclado não se perde: ele passa a ser o modo
    // `accessibility`, que se abre pela pausa. A barra do TÍTULO não é afetada: lá não se está jogando, e o
    // `tabindex` é posto AQUI, no elemento, e não no markup que as duas compartilham.
    bar.querySelectorAll<HTMLElement>('.pi-btn').forEach((b) => { b.tabIndex = -1; });

    const cap = bar.querySelector('.pause-icons-cap');
    bar.addEventListener('click', (e) => {
      const ib = (e.target as Element | null)?.closest<HTMLElement>('.pi-btn');
      if (!ib) return;
      setPauseActor(i);
      iconAct(ib.dataset.pi || '', i);
      reflectPauseIcons(); // must run BEFORE reading the label back — that is what makes the caption honest
      if (cap) cap.textContent = legendaDoIcone(bar, ib);
    });

    // Legenda = o `aria-label` do botão, para que passar o mouse ou focar diga a MESMA verdade que um leitor
    // de tela anunciaria. Uma fonte só para quem vê e para quem escuta.
    //
    // E ELA SOME AO SAIR. Antes ficava: a última explicação apontada permanecia por cima do jogo até alguém
    // apontar outra. Numa barra que agora vive na TELA DE JOGO isso é uma faixa de texto parada em cima da
    // partida — o Dev viu e disse o que é: explicação só enquanto o mouse estiver no botão.
    //
    // A EXCEÇÃO É O CURSOR DO MODO `accessibility`: quando ele está pousado num ícone, a legenda é a única
    // coisa que diz onde ele está, e apagá-la ao mexer o mouse cegaria o modo. Daí a pergunta pelo `.pi-sel`.
    const limpar = (): void => { if (cap && !bar.querySelector('.pi-sel')) cap.textContent = ''; };
    bar.querySelectorAll<HTMLElement>('.pi-btn').forEach((b) => {
      const show = (): void => { if (cap) cap.textContent = legendaDoIcone(bar, b); };
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show);
      b.addEventListener('mouseleave', limpar);
      b.addEventListener('blur', limpar);
    });
    return bar;
  }

  return {
    buildScreenPause, buildQuickBar, entrarNaBarra, sairDaBarra, naBarraDe, navBar,
    iconesMontados: iconesDoJogo,
    iconAct, iconLabel, reflectIconBtn, reflectIconsIn, reflectPauseIcons,
    // ⚠️ O `setCalmMode` PERSISTE TAMBÉM, e sanea. Ele é a outra porta para o mesmo valor — se só o ciclo do
    // ícone gravasse, um nível posto por aqui sobreviveria à sessão e não ao fecho da aba, que é a metade
    // pior do defeito: o ajuste parece ter pegado e some depois.
    applyCalm,
    getCalmMode: () => calmMode,
    setCalmMode: (n) => { calmMode = saneiaNivelTea(n); store.set(store.KEYS.tea, calmMode); },
    iconState,
  };
}
