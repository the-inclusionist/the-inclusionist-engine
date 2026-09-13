// SPDX-License-Identifier: AGPL-3.0-or-later
// core/state.ts — estado/cena do jogo (FONTE ÚNICA). Módulo-folha. As 8 mega-variáveis migram do game.js
// UMA A UMA, lidas como binding vivo (import) e escritas por setter.
// Bus mínimo (Map<evento, Set<fn>>) para os poucos leitores "de longe" que virão com os outros subsistemas.

// ⚠️ NO STORAGE IMPORT (ADR-0178, issue #174): the child's settings come through the port `carregarEstado` receives — the
// shape `platform/storage` already has — so `core` does not reach up to `platform` (ADR-0173).

import { velocidadeValida } from './game-speed.js';
import { ritmoDaLegendaValido } from './caption-duration.js';

/** The port the settings are read and written through. `platform/storage` has this shape; a test passes a double. */
export interface PortaDoEstado {
  get(key: string, fallback: string | null): string | null;
  set(key: string, value: string | number | boolean): unknown;
  getBool(key: string, fallback?: boolean): boolean;
  setBool(key: string, on: boolean): unknown;
  getNum(key: string, fallback?: number): number;
  readonly KEYS: {
    readonly letterCase: string; readonly captions: string; readonly menuIndex: string; readonly cbsafe: string;
    readonly ownercolors: string; readonly outfg: string; readonly outbg: string;
  };
}

/** An empty storage: every read gives its fallback. What the bindings hold until the root loads the child's settings. */
const VAZIO: PortaDoEstado = {
  get: (_k, fallback) => fallback,
  set: () => false,
  getBool: (_k, fallback = false) => fallback,
  setBool: () => undefined,
  getNum: (_k, fallback = 0) => fallback,
  KEYS: { letterCase: '', captions: '', menuIndex: '', cbsafe: '', ownercolors: '', outfg: '', outbg: '' },
};

let porta: PortaDoEstado | null = null;

/**
 * ========================= O BARRAMENTO, TIPADO (Fase C do plano) =========================
 *
 * Era `emit(evt: string, val: unknown)`. Duas coisas erradas numa assinatura só:
 *
 *   · O NOME ERA `string`. Um `emit('viz', …)` em vez de `'vizMode'` não é erro em lugar nenhum — é
 *     SILÊNCIO. O assinante certo nunca é chamado, nada fica vermelho, e a única pista é um painel que
 *     parou de se atualizar. Hoje são dezessete pontos de emissão e cada nome aparece UMA vez; a chance de
 *     digitar errado é exatamente a chance de escrever a próxima linha.
 *   · A CARGA ERA `unknown`. Quem assinasse tinha de converter, e a conversão é onde a mentira entra.
 *
 * Agora `EventoDoJogo` é um mapa nome → carga, e `emit`/`on` são genéricos sobre ele. Nome inexistente não
 * compila; carga errada não compila.
 *
 * ✅ ERRATA 2026-09-08: O BARRAMENTO TEM ASSINANTES EM PRODUÇÃO. O parágrafo abaixo dizia «ZERO `on()` em
 * produção (só o teste assina)», e isso deixou de ser verdade no dia em que a engine passou a montar a barra
 * de acessibilidade: o `ui/settings-audio` assina `modoCego` para o botão `#opt-modocego` não mentir o
 * estado, e o `boot/create-game` assina o mesmo evento para a barra montada não mentir o dela. Os dois
 * chegaram pela razão que o parágrafo previa — «painéis que se redesenham quando a criança muda um ajuste» —
 * e chegaram com o contrato já tipado, que era o ponto de ele nascer assim.
 *
 * ⚠️ POR QUE ISTO EXISTIU ANTES DE TER ASSINANTE. Hoje o barramento tem ZERO `on()` em produção (só o teste
 * assina). Um mecanismo sem uso normalmente é dívida — mas este precisa nascer tipado, não ser retipado
 * depois: o ADR-0031 já exige que painéis e atividades se redesenhem quando a criança muda idioma ou fonte,
 * e a casca do `demos` vai reagir a ajuste durante a partida. O primeiro assinante chega com o contrato
 * pronto, em vez de chegar e ser seguido por uma migração.
 */
export interface EventoDoJogo {
  /* --- ENGINE: o que este módulo emite --- */
  numPlayers: number;
  vizMode: string;
  modoCego: boolean;
  letterCase: LetterCase;
  captionsOn: boolean;
  menuIndexOn: boolean;
  cbSafe: boolean;
  ownerColors: boolean;
  hcOutlineFg: OutlineLevel;
  hcOutlineBg: OutlineLevel;
  caneBlockDiv: number;
  wheelchair: boolean;
  oneButton: boolean;
  /** The game speed, a step of `core/game-speed` (ADR-0180): 1 is 100%. */
  gameSpeed: number;
  /** The child's caption reading rate, words a minute (ADR-0183 §4): 125, 145 or 175. */
  captionPpm: number;
  /** The «no strength to hold» empathy simulation (ADR-0181): a held game key reads as one tap. */
  semForca: boolean;

  /* --- JOGO: `game/state` AUMENTA esta interface com `cenario`, `activity`, `quizLevel` e `coins`.
     Ver a declaração de aumento no fim daquele arquivo. A engine não pode nomear a carga de `coins` — é um
     tipo do jogo (ADR-0033/0039) —, e não precisa: quem é dono do evento declara o evento. --- */
}

type Ouvinte<K extends keyof EventoDoJogo> = (val: EventoDoJogo[K]) => void;
const _subs = new Map<keyof EventoDoJogo, Set<(val: never) => void>>();

/** Assina `evt`. Devolve a função que cancela — guardar o retorno é mais barato que lembrar do `off`. */
export function on<K extends keyof EventoDoJogo>(evt: K, fn: Ouvinte<K>): () => void {
  if (!_subs.has(evt)) _subs.set(evt, new Set());
  _subs.get(evt)!.add(fn as (val: never) => void);
  return () => off(evt, fn);
}

export function off<K extends keyof EventoDoJogo>(evt: K, fn: Ouvinte<K>): void {
  const s = _subs.get(evt);
  if (s) s.delete(fn as (val: never) => void);
}

/**
 * Avisa os assinantes de `evt`. EXPORTADO desde 2026-08-25 (item 19) porque `game/state` emite pelos mesmos
 * canais: um segundo mapa de assinantes seria um segundo barramento, e quem assinasse `coins` no lugar errado
 * simplesmente não seria avisado — sem erro, sem teste vermelho.
 *
 * O `try` em volta de cada assinante NÃO é preguiça: um ouvinte que estoura não pode impedir os outros de
 * receber. Um painel quebrado derruba o painel; não derruba o jogo.
 */
export function emit<K extends keyof EventoDoJogo>(evt: K, val: EventoDoJogo[K]): void {
  const s = _subs.get(evt);
  if (s) for (const fn of s) { try { (fn as unknown as Ouvinte<K>)(val); } catch (e) { /* noop */ } }
}

// ========================= `phase` SAIU DAQUI (ADR-0030 C3, passo 3 da Fase B) =========================
// Ele não virou campo de fábrica como os outros doze de RODADA: virou uma PILHA. `core/scenes` já existia,
// testado e sem consumidor; agora a raiz de composição o usa, e `title`/`playing`/`paused` são
// `[titulo]`, `[jogo]` e `[jogo, pausa]`.
//
// A diferença que motivou a troca: `phase === 'paused'` APAGAVA a informação de que há um jogo por baixo. A
// pilha a mantém, e é dela que sai "o mundo continua desenhado, mas não recebe tempo".
//
// E o ADR-0030 registra ALARGAR a união (`'mapa' | 'resultado' | …`) como NÃO-OPÇÃO: um segundo jogo
// continuaria amarrado ao NOSSO vocabulário, e teria de pedir uma constante nova à engine para existir. Por
// isso os três nomes não moram em módulo nenhum da engine — moram na raiz, que é este jogo. Quem é engine
// recebe BOOLEANOS: `mundoRodando()`, `menuDePausa()`, `telaDeTitulo`. É a mesma correção que o
// `consumer-quiz` obrigou a fazer no `menu-nav` (`getPhase()` → `isNavigable()`), registrada em
// `core/constants` como o erro a não repetir.

/* (`quizLevel` SAIU daqui em 2026-08-25, item 19 — está em `game/state`. É o nível da atividade de
 *  alfabetização: conteúdo pedagógico, e nem sequer mecânica de engine. A regra é a do ADR-0033, aplicada ao
 *  estado: o estado COMPARTILHADO guarda o que a engine possui — acessibilidade, idioma, dispositivo.) */


// ========================= O RESTO DA RODADA SAIU DAQUI (ADR-0038, Fase B) =========================
// `ended`, `decorSeed`, `grassDensity`, `selVizPlayer` e `pauseActor` foram para `core/run-state`, na
// segunda fatia do passo 2. Nenhum deles persiste — que é o critério do corte —, e todos eram importados
// APENAS pelo composition root, o que manteve a mudança em dois arquivos, como na primeira fatia.
//
// O CLAMP do `grassDensity` foi junto, e ele é a razão de aquele setter existir: a fração vinha protegida só
// para quem entrasse pelo `window.__incl`, e qualquer outro caminho podia gravar 5 ou -1. Deixá-lo para trás
// transformaria a fábrica num `let` com nome novo.
//
// E a fatia grande saiu em 2026-08-26: `players` e `numPlayers`, com quatorze importadores CADA. Com o
// `phase` indo para a pilha de cenas no mesmo dia, a RODADA saiu INTEIRA daqui — este módulo é só de PÁGINA
// agora, e `tests/lifetime-gate.node.test.ts` afirma isso a cada rodada de testes.


// ========================= `cenario` E `activity` SAÍRAM DAQUI (ADR-0038, Fase B) =========================
// Os dois eram estado de JOGO morando na engine — a mesma exceção que o `coins` e o `quizLevel` já haviam
// deixado no item 19. O corte por LIFETIME do ADR-0038 os classifica como GAME: ambos são persistidos em
// chave `kJogo()`, que é o critério mecânico, e ambos viajam com o cartucho quando o jogo mudar de
// repositório (ADR-0036).
//
// Moram agora em `game/state`, com a MESMA forma — binding vivo + setter que persiste e emite. O que mudou
// foi só o endereço, e é isso que torna a mudança conferível.
//
// Um consumidor precisou de mais que um import novo: `ui/activities-menu` é ENGINE, e o gate de fronteira
// proíbe engine importar de `game/` (a lista dele esvaziou em 2026-08-25). Ele passou a receber
// `getActivityId`/`setActivityId` por injeção, que é o que a raiz de composição existe para fazer.

// --- vizMode: modo visual/cor ativo (persistido em incl_viz). A validação (VIZ_CYCLE) e o default por
//     prefers-contrast ficam no game.js. initVizMode NÃO persiste (o default de mídia deve seguir o SO a cada
//     boot; persistir travaria o rastreio de prefers-contrast). Mudanças do usuário usam setVizModeValue. ---
export let vizMode = 'normal';
export function initVizMode(mode: string): void { vizMode = mode; }
export function setVizModeValue(mode: string): void { const p = armazem('setVizModeValue'); p.set('incl_viz', mode); vizMode = mode; emit('vizMode', mode); }

/* (`coins` SAIU daqui em 2026-08-25, item 19 — está em `game/state`. Ele era `unknown[]` porque `core/` não
 *  podia conhecer o tipo, e esse `unknown` era o SINTOMA: um estado que não consegue declarar o próprio tipo
 *  está na camada errada. Do outro lado da fronteira ele é `unknown[]` ainda, mas por escolha de quem pode
 *  decidir — e o `game/coins` que o consome sabe exatamente o que há dentro.) */

// ========================= `players` E `numPlayers` SAÍRAM DAQUI (ADR-0038, Fase B) =========================
// Os dois são RODADA pelo critério mecânico do ADR-0038 — nenhum é persistido —, e moram em
// `core/run-state`, na instância que a raiz de composição possui.
//
// O `players` era o caso mais caro de todos os treze. Um `export let` é um binding vivo COMPARTILHADO: dois
// jogos na mesma página (que é o que a casca do `demos` faz, ADR-0036) veriam a MESMA lista, e o segundo
// começaria com os jogadores do primeiro ainda dentro. Não haveria erro em lugar nenhum — só uma criança a
// mais na tela.
//
// A referência continua sendo mutada NO LUGAR (`push`/`length`/`players[i]`), e é por isso que a rodada não
// tem setter para ela: trocar a lista inteira deixaria para trás as referências que os módulos já guardaram.
// Quem entra e quem sai é `game/session`, e só ele recebe a lista mutável.
//
// (O tipo continua sendo `Player[]` — a visão da ENGINE. Cada jogo acrescenta campos e estreita por conta
//  própria, que é o que o ADR-0033 desenhou.)

/**
 * OS PADRÕES, com nome. Um valor por linha, e cada um usado em DOIS lugares: a leitura do boot (quando não há
 * nada gravado) e o "restaurar padrões" do menu que o contém (ADR-0028).
 *
 * Existe porque a alternativa é escrever o mesmo padrão duas vezes — uma no `store.getBool(chave, X)` e outra
 * no reset — e este repositório já mostrou quatro vezes o que acontece com duas cópias que ninguém obriga a
 * concordar. Aqui a divergência seria pior que as anteriores: um reset que restaura um valor DIFERENTE do que
 * o jogo usa quando nunca foi configurado deixa a criança num terceiro estado, que não é nem o dela nem o de
 * fábrica, e que ela não tem como nomear para pedir ajuda.
 *
 * `as const` + `Object.freeze` de propósito: um padrão que alguém consiga escrever em tempo de execução deixa
 * de ser padrão.
 */
/**
 * O padrão do MOVIMENTO REDUZIDO não é uma constante — é o que o sistema operacional pede.
 *
 * Mora aqui, ao lado do DEFAULTS, porque a regra do ADR-0029 é que existe UMA fonte sobre o que é padrão, e
 * um padrão calculado não deixa de ser padrão por não caber num objeto congelado. Quem lê isto: a carga do
 * boot (main.js) e o "restaurar padrões" do menu de sensibilidade visual.
 *
 * Por que importa que o reset leia isto em vez de `false`: numa máquina cujo dono pediu menos movimento,
 * devolver `false` RELIGARIA a animação — o reset passaria a fazer, sozinho, exatamente o que a WCAG 2.3.3
 * existe para impedir, e faria isso na tela de quem já tinha dito que não aguenta.
 *
 * `matchMedia` é guardado: este módulo roda no projeto `node` dos testes, onde `window` não existe.
 */
export function defaultReducedMotion(): boolean {
  return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

export const DEFAULTS = Object.freeze({
  // auditiva
  modoCego: false,
  caneBlockDiv: 1,
  captionsOn: true,
  menuIndexOn: true, // o indice nasce LIGADO: quem nao sabe que ele existe e quem mais precisa dele
  // motora
  wheelchair: false,
  oneButton: false,
  gameSpeed: 1,
  captionPpm: 125,
  semForca: false,
  easy: false,        // por jogador (Modo Fácil)
  toggleMove: false,  // por jogador (movimento por alternância)
  // A alternância do botão de CORRER nasce desligada de FÁBRICA — e liga sozinha no controle de tela, que é
  // contexto e não escolha. A distinção importa para a marca do ADR-0029: ver `refreshMarks` em
  // ui/settings-motor, que marca a ESCOLHA guardada e não o estado.
  toggleRun: false,   // por jogador (alternância do botão de correr)
  // visual
  cbSafe: false,
  ownerColors: true,
  lq: 0,              // realce de contraste L→Q desligado
  hcOutlineFg: 1,
  hcOutlineBg: 1,
  // comunicação (hoje só a caixa da letra; o menu de CAA do ADR-0028 amplia isto)
  letterCase: 'upper',
  // ⚠️ AS DUAS ÚLTIMAS ENTRARAM EM 2026-09-07 (issue #61), e não por simetria: elas faltavam, e a falta
  // tinha consequência. A marca do ADR-0029 lê `DEFAULTS` e mais nada — regra que continua certa —, e por
  // isso um valor sem padrão nomeado aqui é um valor que a marca NÃO PODE marcar. Cinco dos sete ícones da
  // barra rápida caíam nisso.
  //
  //   · `calmMode` — o nível TEA (0 normal · 1 calmo · 2 silencioso). Além de não ter padrão, ele não
  //     PERSISTIA: ver a nota de `KEYS.tea` em platform/storage.
  //   · `viz` — o modo de visão. `core/entity` declara `viz: string` sem dizer qual é o padrão, e o snapshot
  //     da barra fazia `p.viz || ''`. Funcionava por acidente: a cadeia vazia não casa `hc-direto` nem
  //     `fix-*`, então os dois ícones ficavam apagados. `'normal'` é o modo que `render/viz-modes` declara
  //     com `kind:'normal'` — o que não faz nada —, e passa a ser dito em vez de deduzido.
  calmMode: 0,
  viz: 'normal',
} as const);

// --- modoCego: MODO CEGO (A12e auditiva). Só as ajudas de áudio — bengala, sonar, guarda de beirada,
//     narração —, sem tela preta; a simulação de cegueira do Modo Empatia é outra coisa e liga esta por cima.
//
//     Migrado do main.js (ADR-0027 passo 4 / #50). Era a variável com MAIS encanamento de injeção do projeto:
//     dezesseis pontos em seis módulos passavam `getModoCego`/`setModoCego` por ctx, e a colisão a lia por
//     closure. Estado que seis módulos consultam não é do composition root; e enquanto for, `createGame()` não
//     pode existir sem capturá-la, que é justamente o teste de fronteira que o ADR-0027 quer rodar.
//
//     O SETTER FAZ TRÊS COISAS E SÓ TRÊS: grava, persiste, avisa. Os efeitos que o main.js pendurava no
//     antigo `setModoCego` — refazer os extras do nível, refletir o painel, anunciar ao leitor de tela — NÃO
//     entram aqui: são reação, e quem reage assina o evento. Um setter que sabe redesenhar a tela é um setter
//     que nenhum teste consegue chamar. ---
export let modoCego: boolean = VAZIO.getBool('incl_modocego', DEFAULTS.modoCego);
export function setModoCegoValue(on: boolean): void {
  if (modoCego === on) return; // a guarda VEM DO ORIGINAL: sem ela o anúncio repetiria a cada clique redundante
  const p = armazem('setModoCegoValue'); p.setBool('incl_modocego', on); modoCego = on; emit('modoCego', on);
}


// --- O ESTADO DO NÍVEL: portão, sólidos-só-cadeirante e power-ups.
//
//     Estes cinco não são preferência de ninguém: são o RESULTADO de `game/level-geometry.setupExtras()`, que
//     lê o mapa e devolve os quatro primeiros de uma vez, mais `buildWcGeom()`, que devolve o quinto. Moravam
//     no main.js porque `core/collision` precisa lê-los a cada consulta de tile e o main.js era o único lugar
//     que as duas pontas alcançavam.
//
//     Agora as duas pontas alcançam `core/state`, que é da mesma camada da colisão. A injeção da colisão FICA
//     como está de propósito: tirá-la tocaria treze arquivos de teste que hoje montam mundos falsos por
//     `initCollision(ctx)`, e trocar treze montagens de teste é mudança de arquitetura, não arrumação. O que
//     este passo faz é menor e suficiente: o main.js deixa de ser DONO do estado, que é o que `createGame()`
//     precisa para existir sem capturá-lo.
//
//     `setLevelExtras` recebe os quatro juntos porque é assim que nascem — uma desestruturação única no
//     main.js, que em ESM não pode mais existir (não se atribui a um binding importado). Separá-los em quatro
//     chamadas convidaria alguém a atualizar três e esquecer a quarta. ---

/**
 * Um tile do portão. O portão é uma LISTA deles, não um objeto com posição — escrevi `{x, y}` na primeira
 * versão e o navegador me desmentiu: `gate` é `[{tx:29,ty:36}, {tx:30,ty:36}, …]`.
 *
 * O `tsc` não podia pegar. Quem chama `setLevelExtras` é o `main.js`, que é JavaScript, então o tipo declarado
 * aqui não tinha do outro lado nada que o contradissesse. É um argumento concreto para o `createGame()` do
 * passo 4 nascer em TypeScript: enquanto o composition root for JS, todo contrato que só ele exercita é uma
 * afirmação sem verificador.
 *
 * Mínimo ESTRUTURAL, como o `PlayerQuiz`: o `MapGateTile` de verdade mora em `game/level-geometry` e é
 * atribuível a este. `core/` não importa de `game/`.
 */
export interface GateTile { readonly tx: number; readonly ty: number }

// ========================= OS EXTRAS DE NÍVEL SAÍRAM DAQUI (ADR-0038, Fase B) =========================
// `powerups`, `gateTiles`, `gate`, `gateOpen` e `wcSolid` eram estado de RODADA em `export let` — o que a
// D13 do `demos` proíbe, e por um motivo concreto: numa casca que carrega jogo após jogo na mesma página, o
// portão aberto no anterior continua aberto no seguinte.
//
// Viraram uma INSTÂNCIA de `createRunState()`, em `core/run-state`, que o composition root possui. A fatia
// foi escolhida por ser conferível: `main.ts` era o único módulo que os importava daqui; todos os outros já
// os recebiam por injeção. O resto da RODADA (`players`, `numPlayers`, `ended`, `decorSeed`, `pauseActor`,
// `selVizPlayer`, `grassDensity`) segue nos próximos passos, um grupo por vez.
//
// O `GateTile` acima FICOU: ele é um TIPO, não estado, e `core/run-state` o importa daqui.

// --- letterCase: as letras aparecem em CAIXA ALTA ou minúscula. É escolha pedagógica, não estética: a
//     alfabetização brasileira costuma começar em caixa alta, e a criança que já passou dessa fase precisa da
//     minúscula. Lido pelo `disp` que o quiz usa em toda letra que exibe ou soletra.
//
// --- captionsOn: legendas dos sons (a11y surdez).
//
//     OS DOIS PERSISTEM (ADR-0028). A pergunta foi feita ao Dev justamente porque nenhum deles tinha chave
//     nem leitura no boot, e inventar persistência seria inventar a decisão. A resposta foi mais ampla que a
//     pergunta: TODO menu de configuração persiste, e todo menu termina com um controle que restaura os
//     próprios padrões. O motivo é de acessibilidade e não de conveniência — uma criança surda que liga as
//     legendas e as encontra desligadas amanhã paga o preço todo dia, e quem mais precisa do menu é quem menos
//     tem margem para perdê-lo.
//
//     `letterCase` MUDOU DE CASA e de valores (ADR-0028, menu de CAA). Era 'lower' | 'upper', num ciclo de duas
//     posições no botão ABC da pausa; virou 'mixed' | 'upper', uma escolha dentro do menu de Comunicação
//     Aumentada e Alternativa, onde convive com os conjuntos de pictogramas.
//
//     'lower' FOI APOSENTADO e vira 'mixed' na leitura. O Dev pediu duas opções — "letras maiúsculas +
//     minúsculas" e "letras maiúsculas somente" —, e a primeira é texto com a caixa NATURAL, não texto forçado
//     em minúscula: forçar minúscula num nome próprio ensina errado. Quem tinha 'lower' salvo aterrissa em
//     'mixed', que é o mais próximo do que ele escolheu — mas se "só minúsculas" tinha uso pedagógico, é uma
//     entrada de volta na tabela e uma linha aqui.
//
//     A DERIVAÇÃO IMPORTA: `caaMode` NÃO existe ainda de propósito. Enquanto só as duas caixas de letra forem
//     escolhíveis, uma segunda variável para a mesma pergunta seria o MODE × activity de novo (#54). Quando um
//     conjunto de pictogramas puder ser escolhido, `caaMode` nasce e `letterCase` passa a derivar dele. ---
export type LetterCase = 'mixed' | 'upper';
export let letterCase: LetterCase = VAZIO.get(VAZIO.KEYS.letterCase, DEFAULTS.letterCase) === 'upper' ? 'upper' : 'mixed';
export function setLetterCaseValue(c: LetterCase): void {
  if (letterCase === c) return;
  const p = armazem('setLetterCaseValue'); p.set(p.KEYS.letterCase, c); letterCase = c; emit('letterCase', c);
}

export let captionsOn = VAZIO.getBool(VAZIO.KEYS.captions, DEFAULTS.captionsOn);
export function setCaptionsOnValue(on: boolean): void {
  const v = !!on;
  if (captionsOn === v) return;
  const p = armazem('setCaptionsOnValue'); p.setBool(p.KEYS.captions, v); captionsOn = v; emit('captionsOn', v);
}

// --- menuIndexOn: o "6 de 10" no fim do anuncio de cada item de menu (ADR-0044, item 3).
//
//     NASCE LIGADO, e a razao e a mesma do modo cego nascer com TTS e sonar: quem precisa do indice para se
//     orientar nao tem como saber que ele existe se ele vier desligado. Quem NAO precisa descobre o ajuste
//     lendo o menu, que e justamente a coisa que essa pessoa consegue fazer.
//
//     PERSISTE em `incl_menuindex` (escopo da CRIANCA, ADR-0027): a preferencia segue com ela de jogo em jogo.
export let menuIndexOn = VAZIO.getBool(VAZIO.KEYS.menuIndex, DEFAULTS.menuIndexOn);
export function setMenuIndexOnValue(on: boolean): void {
  const v = !!on;
  if (menuIndexOn === v) return;
  const p = armazem('setMenuIndexOnValue'); p.setBool(p.KEYS.menuIndex, v); menuIndexOn = v; emit('menuIndexOn', v);
}

// --- cbSafe: PALETA SEGURA PARA DALTONISMO (Okabe-Ito). Não é um filtro sobre a imagem — é a escolha das
//     cores de origem, aplicada IN-PLACE em PCOLOR para que todo mundo que já referencia a array veja a troca. ---
export let cbSafe: boolean = VAZIO.getBool(VAZIO.KEYS.cbsafe, DEFAULTS.cbSafe);
export function setCbSafeValue(on: boolean): void {
  const v = !!on;
  if (cbSafe === v) return;
  const p = armazem('setCbSafeValue'); p.setBool(p.KEYS.cbsafe, v); cbSafe = v; emit('cbSafe', v);
}

// --- ownerColors: no multijogador, cada item aparece na cor de QUEM pode pegá-lo. Desligado, todos veem a cor
//     original — o que é preferível para quem não distingue as cores dos donos. ---
export let ownerColors: boolean = VAZIO.getBool(VAZIO.KEYS.ownercolors, DEFAULTS.ownerColors);
export function setOwnerColorsValue(on: boolean): void {
  const v = !!on;
  if (ownerColors === v) return;
  const p = armazem('setOwnerColorsValue'); p.setBool(p.KEYS.ownercolors, v); ownerColors = v; emit('ownerColors', v);
}

/** Espessura de contorno: 0 nenhum · 1 fino · 2 grosso. Fora da faixa satura, não rejeita. */
export type OutlineLevel = 0 | 1 | 2;
const nivelContorno = (v: number): OutlineLevel => Math.max(0, Math.min(2, v | 0)) as OutlineLevel;

// --- hcOutlineFg / hcOutlineBg: CONTORNOS do alto contraste, e são dois porque servem a critérios diferentes.
//     `fg` contorna o primeiro plano — personagem e itens — e atende a WCAG 2.4.7 (foco visível). `bg` contorna
//     o perímetro externo de plataforma, água e lava, delimitando navegável × não-navegável, e atende a
//     WCAG 1.4.11 (contraste de componente ≥ 3:1). Confundi-los apagaria uma das duas garantias.
//
//     A saturação em 0..2 vem do original e é dupla: no boot (contra um localStorage corrompido) e na escrita
//     (contra um chamador). No main.js isso obrigava a declarar com um valor provisório e reatribuir na linha
//     seguinte, porque a leitura saturada não cabia no mesmo `let`; aqui a função a resolve de uma vez. ---
export let hcOutlineFg: OutlineLevel = nivelContorno(VAZIO.getNum(VAZIO.KEYS.outfg, DEFAULTS.hcOutlineFg));
export function setOutlineFgValue(v: number): void {
  const n = nivelContorno(v);
  if (hcOutlineFg === n) return;
  const p = armazem('setOutlineFgValue'); p.set(p.KEYS.outfg, n); hcOutlineFg = n; emit('hcOutlineFg', n);
}
export let hcOutlineBg: OutlineLevel = nivelContorno(VAZIO.getNum(VAZIO.KEYS.outbg, DEFAULTS.hcOutlineBg));
export function setOutlineBgValue(v: number): void {
  const n = nivelContorno(v);
  if (hcOutlineBg === n) return;
  const p = armazem('setOutlineBgValue'); p.set(p.KEYS.outbg, n); hcOutlineBg = n; emit('hcOutlineBg', n);
}

// --- caneBlockDiv: espaçamento da batida da BENGALA, em blocos pisados. 1 = uma batida por bloco;
//     2 = uma batida a cada meio bloco. Não é preferência de som: é a resolução com que uma criança cega
//     mede a distância que andou, e por isso a colisão a lê a cada passo. ---
export let caneBlockDiv: number = VAZIO.getNum('incl_cane_div', DEFAULTS.caneBlockDiv) || DEFAULTS.caneBlockDiv;
export function setCaneBlockDivValue(div: number): void {
  const d = (+div) || 1; // o `|| 1` vem do original: um valor corrompido no localStorage viraria NaN e a
  if (caneBlockDiv === d) return; //  bengala pararia de bater, que é o modo de falha mais silencioso possível
  const p = armazem('setCaneBlockDivValue'); p.set('incl_cane_div', d); caneBlockDiv = d; emit('caneBlockDiv', d);
}

// --- wheelchair: MODO CADEIRANTE. Muda a geometria do nível inteiro — degraus e escada viram rampas e
//     elevadores, moedas descem para o chão, lava vira chão, e só voo e super-corrida sobrevivem como poderes.
//     Por isso a colisão a lê: `isSolidType` responde diferente com ela ligada. ---
export let wheelchair: boolean = VAZIO.getBool('incl_wheelchair', DEFAULTS.wheelchair);
export function setWheelchairValue(on: boolean): void {
  if (wheelchair === on) return;
  const p = armazem('setWheelchairValue'); p.setBool('incl_wheelchair', on); wheelchair = on; emit('wheelchair', on);
}

// --- oneButton: «um botão por vez», an EMPATHY SIMULATION (ADR-0181): while one game key is held, a second is never
//     accepted. It was described as an accommodation; the Dev: it simulates a motor difficulty. ---
export let oneButton: boolean = VAZIO.getBool('incl_onebtn', DEFAULTS.oneButton);
export function setOneButtonValue(on: boolean): void {
  if (oneButton === on) return;
  const p = armazem('setOneButtonValue'); p.setBool('incl_onebtn', on); oneButton = on; emit('oneButton', on);
}

// --- semForca: «sem força para segurar botão», the second motor empathy simulation (ADR-0181): any sustained contact of a
//     game key reads as one tap. Stored like the other simulations, off by default. ---
export let semForca: boolean = VAZIO.getBool('incl_sem_forca', DEFAULTS.semForca);
export function setSemForcaValue(on: boolean): void {
  const v = !!on;
  if (semForca === v) return;
  const p = armazem('setSemForcaValue'); p.setBool('incl_sem_forca', v); semForca = v; emit('semForca', v);
}

// --- gameSpeed: the game speed the quick bar's hourglass cycles (ADR-0180); `core/loop.startLoop` multiplies the frame time
//     by it. Stored and carried between games; a stored value outside the steps reads as 100%. ---
export let gameSpeed: number = velocidadeValida(VAZIO.getNum('incl_game_speed', DEFAULTS.gameSpeed));
export function setGameSpeedValue(v: number): void {
  const valida = velocidadeValida(v);
  if (gameSpeed === valida) return;
  const p = armazem('setGameSpeedValue'); p.set('incl_game_speed', valida); gameSpeed = valida; emit('gameSpeed', valida);
}

// --- captionPpm: the child's caption reading rate, words a minute (ADR-0183 §4): how long a sound caption stays. One of
//     125, 145, 175; anything else reads as 125. ---
export let captionPpm: number = ritmoDaLegendaValido(VAZIO.getNum('incl_caption_ppm', DEFAULTS.captionPpm));
export function setCaptionPpmValue(ppm: number): void {
  const valido = ritmoDaLegendaValido(ppm);
  if (captionPpm === valido) return;
  const p = armazem('setCaptionPpmValue'); p.set('incl_caption_ppm', valido); captionPpm = valido; emit('captionPpm', valido);
}

/* ===================== THE STORED SETTINGS, LOADED BY THE ROOT (ADR-0178, issue #174) ===================== */


/**
 * The port for a write — or an error. ⚠️ A write before the load would put a default over what the child saved, and nobody
 * would see it; the error names the setter, so the root that calls it too early is found the first time it runs.
 */
function armazem(setter: string): PortaDoEstado {
  if (!porta) throw new Error(`core/state: ${setter} wrote a setting before carregarEstado — it would overwrite the child's stored choice; the composition root loads the settings first (ADR-0178)`);
  return porta;
}

/**
 * Loads the child's stored settings into the bindings, and keeps the port for the setters. The composition root calls it
 * first (`createGame` does); calling it again reads again.
 */
export function carregarEstado(p: PortaDoEstado): void {
  porta = p;
  modoCego = p.getBool('incl_modocego', DEFAULTS.modoCego);
  letterCase = p.get(p.KEYS.letterCase, DEFAULTS.letterCase) === 'upper' ? 'upper' : 'mixed';
  captionsOn = p.getBool(p.KEYS.captions, DEFAULTS.captionsOn);
  menuIndexOn = p.getBool(p.KEYS.menuIndex, DEFAULTS.menuIndexOn);
  cbSafe = p.getBool(p.KEYS.cbsafe, DEFAULTS.cbSafe);
  ownerColors = p.getBool(p.KEYS.ownercolors, DEFAULTS.ownerColors);
  hcOutlineFg = nivelContorno(p.getNum(p.KEYS.outfg, DEFAULTS.hcOutlineFg));
  hcOutlineBg = nivelContorno(p.getNum(p.KEYS.outbg, DEFAULTS.hcOutlineBg));
  caneBlockDiv = p.getNum('incl_cane_div', DEFAULTS.caneBlockDiv) || DEFAULTS.caneBlockDiv;
  wheelchair = p.getBool('incl_wheelchair', DEFAULTS.wheelchair);
  oneButton = p.getBool('incl_onebtn', DEFAULTS.oneButton);
  gameSpeed = velocidadeValida(p.getNum('incl_game_speed', DEFAULTS.gameSpeed));
  semForca = p.getBool('incl_sem_forca', DEFAULTS.semForca);
  captionPpm = ritmoDaLegendaValido(p.getNum('incl_caption_ppm', DEFAULTS.captionPpm));
}
