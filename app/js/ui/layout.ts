// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/layout.ts — ESCALA do jogo (Estágio 4, Tier 1). Trava o #game-region num múltiplo inteiro de PIXELS REAIS
// de 320×180 (por jogador) e reescala as vars de UI escopadas ao canvas. Deps: ui/dom ($), core/screens,
// render/crt (crtScanVars). A contagem de jogadores entra por `initLayout`. fpsTick/configureRender seguem no main.js.
//
// JÁ NÃO RESERVA ESPAÇO PARA O INTÉRPRETE. Reservava 380px à direita quando o painel do VLibras "abria", e o
// jogo deslocava para a esquerda — decisão revista pelo Dev: o intérprete deve aparecer NA FRENTE da tela
// enquanto um áudio toca, e sumir. E a reserva estava sendo aplicada O TEMPO TODO, porque o detector de
// "aberto" lia um div vazio (ver o cabeçalho de ui/vlibras): o canvas vivia em `left: -136`, fora da tela,
// com ou sem modo pessoa surda. O acoplamento vlibras↔layout desaparece junto.
import { $ } from './dom.js';
import { screenBaseSize } from '../core/screens.js';

import { crtScanVars } from '../render/crt.js';

/**
 * A RÉGUA DO ALVO DE TOQUE, INDEXADA PELA ALTURA DO VIEWPORT (ADR-0095, decisão do Dev).
 *
 * ⚠️ O ALVO DEIXOU DE SER UM NÚMERO E PASSOU A SER UMA FUNÇÃO DA TELA, e o motivo é um custo que o gate de
 * `pausa-44px` já tinha MEDIDO e deixado por resolver: a 640×360 o cartão de pausa não cabe e a lista ROLA.
 * Remedido em 06/09, porque o cartão mudou desde então: 391 px de conteúdo para 349 visíveis, ou seja 42 px
 * de excesso (o comentário antigo dizia 413/353). Um alvo de 44 px que exige rolagem para ser alcançado
 * pode custar mais dedo do que um de 24 px que está à vista.
 *
 * Os três degraus são os do Dev, e os dois extremos são as duas normas — não números de gosto:
 *
 *     altura ≥ 720   44 px   WCAG 2.2 · 2.5.5 Target Size (Enhanced) — AAA
 *     altura ≥ 540   34 px   o degrau do meio
 *     altura <  540  24 px   WCAG 2.2 · 2.5.8 Target Size (Minimum)  — AA
 *
 * ⚠️ ISTO É «MARCAR HONESTAMENTE ONDE SÓ DÁ AA», que é regra escrita do projeto — e não uma renúncia
 * silenciosa. O que se perde em 360 está registrado com número no ADR-0095: a 96 px/pol, 24 CSS px são
 * 6,4 mm, abaixo do alvo de polegar de 9,6 mm que o painel de toque deste jogo cita. É por isso que o
 * ESPAÇAMENTO entre alvos passa a ser o que protege o dedo onde o tamanho não pode — a mesma saída que a
 * própria 2.5.8 dá na sua exceção de spacing.
 */
export const REGUA_DE_ALVO: readonly { readonly altura: number; readonly alvo: number }[] = Object.freeze([
  { altura: 720, alvo: 44 },
  { altura: 540, alvo: 34 },
  { altura: 0, alvo: 24 },
]);

/**
 * O menor alvo de toque aceitável num viewport desta altura, em CSS px.
 *
 * ⚠️ NUNCA DEVOLVE MENOS DE 24: abaixo disso não é «AA num aparelho pequeno», é furar o piso da WCAG. Uma
 * tela mais baixa que 360 não compra o direito de encolher mais — compra o direito de mostrar menos itens.
 */
/**
 * OS NÓS DO JOGO QUE INVADEM O RECTÂNGULO DA BARRA DE ACESSIBILIDADE (ADR-0148 §3).
 *
 * 🔴 MEDIDO no `dist/quiz.html` em 2026-09-12, e a queixa do Dev é literal na tela: `#title-icons` é
 * `position:absolute` DENTRO do `#game-region`, em (123,15) 337×44 — e o `H2.quiz-pergunta`, o título da
 * pergunta, ocupa os mesmos pixels. A criança que procura o modo cego encontra texto por cima dos botões.
 *
 * ⚠️ E NADA FALHAVA. Não há erro, não há tipo, não há consola: só uma fila de botões tapada — e quem mais
 * depende dela é precisamente quem não vê que ela está tapada.
 *
 * 📌 PURA E COM AS CAIXAS INJECTADAS, para o crivo a poder conduzir sem navegador. Quem mede é quem chama;
 * o que esta função decide é o que CONTA como invasão, que é a parte que se erra.
 *
 * ⚠️ IGNORA OS DESCENDENTES DA PRÓPRIA BARRA: os botões dela intersectam-na por definição, e contá-los faria
 * o crivo acusar sempre — o defeito que o ADR-0106 §2 chama de afogar o que se pode resolver.
 */
export interface CaixaNomeada { readonly nome: string; readonly caixa: Caixa; readonly daBarra: boolean; }
export interface Caixa { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export function invasoresDaBarra(barra: Caixa | null, nos: readonly CaixaNomeada[]): string[] {
  // Uma barra sem área não reserva nada — e acusar contra um rectângulo de zero seria acusar toda a gente.
  if (!barra || barra.w <= 0 || barra.h <= 0) return [];
  // ⚠️ O GUARDA DE ÁREA ZERO FAZ TRABALHO, e eu quase o tirei por uma leitura errada. Uma mutação que o
  // removia ficou VERDE, e a minha conclusão — «as desigualdades estritas já excluem quem não tem área» —
  // era falsa: elas excluem um nó DEGENERADO NA FRONTEIRA, não um em geral. Uma risca de largura zero
  // atravessando a barra passa nas quatro comparações. 📌 Contentores de altura ou largura zero são comuns
  // em markup gerado, e acusá-los seria ruído puro — que é como se ensina um consumidor a ignorar a linha.
  return nos
    .filter((n) => !n.daBarra && n.caixa.w > 0 && n.caixa.h > 0)
    .filter((n) => n.caixa.x < barra.x + barra.w && barra.x < n.caixa.x + n.caixa.w
      && n.caixa.y < barra.y + barra.h && barra.y < n.caixa.y + n.caixa.h)
    .map((n) => n.nome);
}

export function alvoMinimoDeToque(alturaCss: number): number {
  const h = Number.isFinite(alturaCss) ? alturaCss : 0;
  for (const degrau of REGUA_DE_ALVO) if (h >= degrau.altura) return degrau.alvo;
  return 24;
}

// A CONTAGEM DE JOGADORES entra por injeção desde 2026-08-26. Era `numPlayers`, um `let` de `core/state`
// importado como binding vivo — e um `let` de módulo é compartilhado por qualquer segundo jogo que a
// mesma página carregue (D13 do `demos`, ADR-0038). O que entra aqui é o GETTER da rodada que a raiz
// possui; o `let` que sobra guarda a função, não o número.
let _numJogadores: () => number = () => 1;
/** Liga a contagem de jogadores. Chamado uma vez pela raiz, antes do primeiro `layout()`. */
export function initLayout(deps: { numJogadores: () => number }): void { _numJogadores = deps.numJogadores; }

/**
 * A CASCA QUE DÁ O ESPAÇO DISPONÍVEL — por id OU por classe, e as duas formas valem o mesmo.
 *
 * ⚠️ ERA SÓ `#stage-wrap`, E ISSO DEIXOU A ENGINE SEM ESCALA NO PRÓPRIO HOST. O `app/index.html` do jogo
 * trazia `<div id="stage-wrap">`; quando o cartucho saiu (issue #111) sobrou o `app/quiz.html`, que tem
 * `<div class="stage-wrap">`. A procura por id falhava, `layout()` fazia early-return, e **nada reportava
 * nada**: um `return` silencioso é indistinguível de «não havia o que fazer». O comentário do próprio
 * `quiz.html` dizia «mesmo id que ui/layout escala» — quem o escreveu acreditava que corria.
 *
 * O consumidor não erra ao usar a classe: um documento pode ter várias telas, e um id é único. Aceitar as
 * duas é o que torna a engine consumível por quem não copiou o markup dela.
 */
function cascaDoPalco(): HTMLElement | null {
  return $<HTMLElement>('#stage-wrap') ?? $<HTMLElement>('.stage-wrap');
}

export function layout(): void {
  const wrap = cascaDoPalco(); if (!wrap) return;
  wrap.style.paddingRight = '0px';
  const availW = wrap.clientWidth || 320;
  const availH = wrap.clientHeight || 180;
  // E11: a grade de telas define a base (1=320×180, 2=640×180, 3-4=640×360)
  const n = _numJogadores();
  // (`screenGrid(n)` SAIU em 2026-08-26: `cols`/`rows` eram desestruturados e nunca lidos — a escala sai de
  //  `screenBaseSize`, logo abaixo. Era uma chamada paga a cada `layout()` por nada. `noUnusedLocals` achou.)
  const { w: baseW, h: baseH } = screenBaseSize(n);
  // Piso k=2: CADA viewport tem no mínimo 640×360. Assim 2×2 = 1280×720 cabe num Chromebook do governo (1366×768).
  const MIN_K = 2;
  // ADR-001 (CORRIGIDO 2026-07-04): ESCALA travada em PIXELS REAIS INTEIROS. Cada pixel de arte = kDev pixels
  // FÍSICOS (inteiro) → scanlines SEMPRE regulares e arte uniforme em QUALQUER dpr. Tolera ≤5px lógicos de corte
  // por lado (o −10): base·kDev − avail·dpr ≤ 10·kDev ⇒ kDev ≤ avail·dpr/(base−10). (José escolheu inteiro-REAL.)
  const dpr = window.devicePixelRatio || 1;
  const kDev = Math.max(Math.round(MIN_K * dpr), Math.floor(Math.min(availW * dpr / (baseW - 10), availH * dpr / (baseH - 10))));
  const k = kDev / dpr; // fator LÓGICO/CSS (kDev = fator em pixels REAIS, inteiro)
  // ESCALA das vars de UI é ESCOPADA ao #game-region: só a UI DENTRO do canvas (menus/HUD/pausa/quiz) escala com o
  // k. Fora do canvas (barra de topo, painel de debug) herda o :root → texto SEMPRE 16px, toque 44px (José).
  const gr = $<HTMLElement>('#game-region'); if (gr) {
    gr.style.width = (baseW * k) + 'px'; gr.style.height = (baseH * k) + 'px';
    gr.style.setProperty('--hud-fs', Math.max(9, Math.round(180 * k * 0.052)) + 'px');
    gr.style.setProperty('--ui-fs', (8 * k) + 'px');   // base LÓGICA 8px × k (16px em k=2)
    gr.style.setProperty('--tap', (22 * k) + 'px');    // toque 22px × k (44px em k=2, piso WCAG)
    // ⚠️ O PISO DA RÉGUA (ADR-0095), e ele é OUTRA COISA que o `--tap`. O `--tap` é o tamanho PREFERIDO e
    // cresce com a escala do canvas; `--alvo-min` é o CHÃO por altura de tela — 24 px abaixo de 540, 34 a
    // partir de 540, 44 a partir de 720. Um botão isolado usa o preferido; um item de LISTA, que tem de
    // caber inteiro na tela, usa o chão.
    //
    // ⚠️ A ALTURA É A DO ESPAÇO DISPONÍVEL, e não a da sub-tela de um jogador: o dedo toca o aparelho, não
    // o viewport lógico. Em quatro telas divididas cada uma tem 180 px de alto, e encolher o alvo por causa
    // disso seria ler o número errado — o aparelho continua o mesmo.
    gr.style.setProperty('--alvo-min', alvoMinimoDeToque(availH) + 'px');
  }
  crtScanVars(); // scanlines re-alinham quando a escala k muda
  if (/[?&]debug=true/.test(location.search)) console.info(`[escala] kDev=${kDev}× px REAIS (canvas físico ${baseW * kDev}×${baseH * kDev} = múltiplo INTEIRO de ${baseW}×${baseH}); CSS ${Math.round(baseW * k)}×${Math.round(baseH * k)} (k=${k.toFixed(3)}, dpr=${dpr})`);
}
