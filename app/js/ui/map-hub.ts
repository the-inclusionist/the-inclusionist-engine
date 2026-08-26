// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/map-hub — O PAINEL "MAPEAR CONTROLES", dentro do menu de Movimento.
//
// Este módulo é o antigo `renderMapHub()` do main.js (mais o seu ajudante `mapSoon`, que não tinha outro
// chamador). Ele desenha a lista de formas de comandar o jogo — teclado (uma linha por modo de 1 a 4 telas),
// gamepad, e três entradas ainda por construir (olhos e boca, setores de olhar, palavras faladas) — e amarra
// o botão de cada linha ao painel que ela abre.
//
// ======================= É DESTE JOGO, E NÃO ENGINE =======================
// Um segundo jogo da coleção NÃO reusaria este arquivo, e a razão não é o assunto (mapear controles é
// universal) — é o CONTEÚDO. Este painel enumera exatamente os subsistemas de entrada que *The Inclusionist*
// tem hoje e os que ele PROMETE ter: a redação "em construção — chega junto com os subsistemas de webcam e
// fala" é uma declaração de roadmap deste jogo, não uma capacidade do engine. Ele também depende do `#map-hub`
// deste `index.html`, das classes `ctrl-row`/`mode-btn`/`row-off` desta folha de estilo, e de dois painéis
// concretos (`openOptions`, `openPadWiz`). O que É engine já está extraído e mora noutro lugar:
// `input/keyboard.ts` (o esquema), `input/gamepad.ts` (o assistente de mapeamento), `core/screens.ts` (a
// grade). Aqui sobra a VITRINE — e vitrine é do jogo. Daí `ui/`, ao lado de `ui/settings-motor.ts`, que é o
// resto do mesmo menu de Movimento.
//
// ======================= DECIDIR ≠ EXECUTAR =======================
// Três coisas eram uma só, e as duas primeiras são puras:
//   · `MAP_HUB_ROWS` — a TABELA. Rótulo, modo exigido (ou nenhum) e a ação nomeada (`'options'`, `'padwiz'`
//     ou nada, para as três em construção). A ação virou um NOME e não uma função: é o que permite a tabela
//     ser um dado congelado, testável, e o `init` decidir qual painel cada nome abre.
//   · `mapHubStates(np)` / `mapHubMarkup(np)` — o estado de cada linha (desabilitada por estar em construção,
//     ou por o modo dela não ser o número de telas atual) e o HTML que sai disso. A regra que importa e que
//     ninguém via no meio da interpolação: "⌨ Mapear teclado para modo 3 jogadores" só habilita quando o jogo
//     ESTÁ em 3 telas — trocar o mapa de um modo em que você não está mostraria teclas que não valem.
//   · `initMapHub(ctx).render()` — a metade impura: `innerHTML`, `querySelectorAll`, `addEventListener`.
//
// ======================= O AVISO É A PARTE DE ACESSIBILIDADE =======================
// Um botão `disabled` é invisível para quem navega por teclado com leitor de tela: o foco simplesmente pula.
// Por isso as duas mensagens de `srAlert` existem, e por isso elas são exportadas como funções puras
// (`soonMessage`, `wrongModeMessage`): quem clica na linha cinza — por toque, ou porque o leitor lê a linha
// inteira e não só o botão — recebe o MOTIVO em palavras, não silêncio.
// Já foi assim: os botões nasciam com o atributo `disabled`, o `click` deles não disparava, e as duas
// mensagens eram inalcançáveis — medido no navegador: das oito linhas, seis ficavam fora da ordem de foco e
// clicar nelas não dizia nada. Agora é `aria-disabled`, que anuncia o estado sem esconder o botão.
//
// ======================= O QUE FICOU DE FORA, E POR QUÊ =======================
//  · Abrir/fechar o overlay `#movement` (`openMovement`/`closeMovement`, `frontOverlay`, o foco no primeiro
//    botão) FICA no main.js: é a casca compartilhada por TODOS os painéis de configuração, não deste.
//  · `openOptions` e `gamepadApi.openPadWiz()` entram por injeção. O primeiro é do main.js (edita o controle
//    do jogador que abriu a pausa), o segundo é de `input/gamepad.ts`.
//  · O número de telas entra por GETTER (`getNumPlayers`) porque `numPlayers` é reatribuído por
//    `setNumPlayers` a cada troca — e é justamente ele que decide quais linhas ficam cinzas.
//
// ======================= ARMADILHAS DE ORDEM DE BOOT =======================
//  · Zero I/O no import: nada toca o DOM no corpo do módulo. `initMapHub` também não — ele só devolve
//    `render()`, e é `render()` que procura `#map-hub`. Se o elemento não existir, `render()` desiste em
//    silêncio (guard clause), como o original.
//  · `render()` é chamado de dentro de `openMovement`, que é uma DECLARAÇÃO DE FUNÇÃO içada e aparece ANTES
//    deste ponto no main.js. Não há TDZ: `openMovement` só roda a partir de um clique, muito depois do
//    módulo ter avaliado. Ainda assim, a religação deve manter um invólucro `function renderMapHub()` no
//    main.js — declaração içada, como manda a casa — para que a leitura de `openMovement` continue honesta.
//  · O `np` é lido UMA vez por `render()` e fica preso no manipulador de clique daquela renderização. Isso é
//    verbatim e é seguro hoje porque `openMovement` re-renderiza a cada abertura; se um dia o painel puder
//    ficar aberto enquanto o nº de telas muda, esta é a linha a mexer.

import type { DomQuery } from '../core/dom-query.js';
/** Assinatura mínima do seletor de DOM (a mesma de `ui/dom.ts`). */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** Qual painel a linha abre. `null` = ainda não existe subsistema para abrir. */
export type MapHubAction = 'options' | 'padwiz' | null;

/** Uma linha do painel. */
export interface MapHubRow {
  /** Rótulo com o emoji na frente — o emoji é o que `soonMessage` corta para falar. */
  lbl: string;
  /** Nº de telas exigido; `undefined` = vale em qualquer modo. */
  mode?: number;
  /** Em construção: aparece cinza, com "Em breve" no botão. */
  soon?: boolean;
  /** O painel que o botão abre, por nome. */
  act?: MapHubAction;
}

/**
 * A TABELA — congelada. A ordem é a da tela: os quatro modos de teclado, o gamepad, e as três promessas.
 * As três últimas são o roadmap deste jogo (webcam e fala), e é por causa delas que o módulo não é engine.
 */
export const MAP_HUB_ROWS: readonly MapHubRow[] = Object.freeze([
  { lbl: '⌨ Mapear teclado para modo 1 jogador', mode: 1, act: 'options' },
  { lbl: '⌨ Mapear teclado para modo 2 jogadores', mode: 2, act: 'options' },
  { lbl: '⌨ Mapear teclado para modo 3 jogadores', mode: 3, act: 'options' },
  { lbl: '⌨ Mapear teclado para modo 4 jogadores', mode: 4, act: 'options' },
  { lbl: '🎮 Mapear gamepad', act: 'padwiz' }, // L1: assistente (DirectInput e afins) — mapa salvo por modelo
  { lbl: '👁 Mapear olhos e boca', soon: true },
  { lbl: '🎯 Mapear setores de olhar', soon: true },
  { lbl: '🎤 Mapear palavras (fala)', soon: true },
].map((r) => Object.freeze(r)) as MapHubRow[]);

/** O estado visual de uma linha, para o número de telas atual. */
export interface MapHubRowState {
  /** A linha exige um modo diferente do atual. */
  off: boolean;
  /** A linha está cinza (em construção OU modo errado) — é o que vira `row-off` + `disabled`. */
  dis: boolean;
}

/** O estado de cada linha em `np` telas. Fonte única do markup e das duas mensagens de `srAlert`. */
export function mapHubStates(np: number, rows: readonly MapHubRow[] = MAP_HUB_ROWS): MapHubRowState[] {
  return rows.map((r) => {
    const off = !!r.mode && r.mode !== np; // teclado: só o modo em que o jogo ESTÁ fica clicável
    return { off, dis: !!r.soon || off };
  });
}

/** O HTML do painel inteiro — cabeçalho + uma `.ctrl-row` por linha. */
export function mapHubMarkup(np: number, rows: readonly MapHubRow[] = MAP_HUB_ROWS): string {
  const st = mapHubStates(np, rows);
  return '<h3 class="panel-sub">Mapear controles <span class="panel-sub__tag">por jogador</span></h3>' +
    rows.map((it, i) => {
      const dis = st[i]!.dis;
      const note = it.soon ? ' <em style="opacity:.7">(em construção)</em>' : '';
      // `aria-disabled` e NAO `disabled`: o atributo real tira o botao da ordem de foco e engole o clique,
      // entao quem navega por teclado pulava seis das oito linhas e nunca ficava sabendo por que elas nao
      // funcionam — enquanto quem enxerga ve a linha cinza e o "(em construcao)". Com `aria-disabled` o
      // estado e anunciado, o botao continua alcancavel, e as duas frases de srAlert que ja existiam aqui
      // finalmente chegam a alguem. O visual nao muda: quem pinta a linha cinza e a classe `row-off`.
      return `<div class="ctrl-row${dis ? ' row-off' : ''}"><span>${it.lbl}${note}</span>` +
        `<button class="mode-btn" type="button" data-map="${i}"${dis ? ' aria-disabled="true"' : ''}>${it.soon ? 'Em breve' : 'Abrir'}</button></div>`;
    }).join('');
}

/** O rótulo sem o emoji da frente — "👁 Mapear olhos e boca" → "Mapear olhos e boca". */
export function soonName(lbl: string): string {
  return lbl.replace(/^\S+\s/, '');
}

/** O aviso falado de uma linha em construção. */
export function soonMessage(lbl: string): string {
  return soonName(lbl) + ': em construção — chega junto com os subsistemas de webcam e fala.';
}

/** O aviso falado de uma linha cujo modo não é o número de telas atual. */
export function wrongModeMessage(mode: number): string {
  return 'Disponível só no modo ' + mode + ' jogador' + (mode > 1 ? 'es' : '') + '. Troque o nº de telas na barra do topo.';
}

/* ===================== a metade que toca o DOM ===================== */

export interface MapHubCtx {
  /** Seletor de DOM injetado (`ui/dom.ts:$`) — o módulo nunca alcança `document` sozinho. */
  $: DomQuery;
  /** Anúncio assertivo ao leitor de tela (`core/a11y-sr.ts:srAlert`). */
  srAlert: (msg: string) => void;
  /** Nº de telas vivo (`core/state.ts:numPlayers`) — GETTER, porque é reatribuído. */
  getNumPlayers: () => number;
  /** Abre o painel de remapeamento de teclado (`openOptions` do main.js). */
  openOptions: () => void;
  /** Abre o assistente de gamepad (`input/gamepad.ts:openPadWiz`). */
  openPadWiz: () => void;
}

export interface MapHubApi {
  /** Redesenha `#map-hub` e reamarra os botões. Chamado por `openMovement`, a cada abertura do menu. */
  render(): void;
}

export function initMapHub(ctx: MapHubCtx): MapHubApi {
  /** Nome da ação → o painel de verdade. Fora da tabela, para a tabela poder ser dado congelado. */
  function run(act: MapHubAction): void {
    if (act === 'options') ctx.openOptions();
    else if (act === 'padwiz') ctx.openPadWiz();
  }

  function render(): void {
    const el = ctx.$('#map-hub');
    if (!el) return; // o painel não está neste documento — nada a fazer
    const np = ctx.getNumPlayers(); // lido UMA vez; preso no manipulador desta renderização (ver o cabeçalho)
    el.innerHTML = mapHubMarkup(np);
    el.querySelectorAll('button[data-map]').forEach((b) => b.addEventListener('click', () => {
      const it = MAP_HUB_ROWS[Number((b as HTMLElement).dataset['map'])];
      if (!it) return;
      if (it.soon) { ctx.srAlert(soonMessage(it.lbl)); return; }          // em construção: diz o porquê
      if (it.mode && it.mode !== np) { ctx.srAlert(wrongModeMessage(it.mode)); return; } // modo errado: idem
      run(it.act ?? null);
    }));
  }

  return { render };
}
