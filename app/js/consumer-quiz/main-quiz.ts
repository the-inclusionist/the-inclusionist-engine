// SPDX-License-Identifier: GPL-3.0-or-later
// O SEGUNDO CONSUMIDOR — um quiz que NÃO é plataforma (ADR-0027 passo 6, antecipado pelo Dev em 2026-08-25).
//
// NÃO é um jogo ainda. É um INSTRUMENTO DE MEDIDA, e a medida é: o que desta base é ENGINE e o que é o jogo de
// plataforma que ela hospeda? Nenhuma leitura de código responde isso — só um consumidor que não tenha física,
// nem tiles, nem mundo, e que por isso não consiga fingir precisar deles.
//
// A REGRA, e é o que produz a medida:
//
//     SÓ IMPORTA DE core/ input/ render/ platform/ ui/ audio/. NUNCA DE game/.
//
// Quando ele precisar de algo que só existe em `game/`, isso é um ACHADO: anotado no bloco ACHADOS abaixo,
// nunca contornado. Contornar destruiria o instrumento — ele mede exatamente o que seríamos tentados a
// esconder. `tests/engine-boundary.node.test.js` prende a regra para que ela não dependa de disciplina.
//
// ---------------------------------------------------------------------------------------------------------
// ACHADOS — o que a engine ainda não entrega a quem não é plataforma. Cada linha é trabalho do passo 5.
// ---------------------------------------------------------------------------------------------------------
//
//  1. `core/a11y-sr` FUNCIONA SOZINHO. Precisa de dois elementos no documento (`#sr-status`, `#sr-alert`) e de
//     mais nada. É o pedaço mais reutilizável da base — e é bom que seja, porque é o que sustenta o pilar 2.
//
//  2. `core/i18n` FUNCIONA SOZINHO, mas os DICIONÁRIOS são do jogo de plataforma: `sr.motor.*`, `sr.audio.*`,
//     `contrast.*`. Um segundo jogo herda 253 chaves das quais usa um punhado. Não é aresta de importação —
//     é peso morto no pacote, e vira problema no dia em que houver dez jogos.
//
//  3. TTS: LIGA SEM O JOGO, e melhor do que eu esperava. `platform/tts` pede oito coisas por injeção e as
//     oito saem de `platform/audio` — `ensureAC`, `catNode`, `audioOut`, `soundOn`, `volume`, `audioCat`. O
//     consumidor monta o ctx em seis linhas e não reimplementa grafo de áudio nenhum. A pilha sonora é
//     genuinamente da engine.
//     PORÉM: `initAudioMixer()` precisa ser chamado antes, senão `audioCat` é null e o `narrate` cala em
//     silêncio — sem erro, sem aviso. Uma dependência de ORDEM que nada no tipo declara, e que o segundo
//     consumidor descobriu do jeito mais caro: o áudio simplesmente não saía.
//
//  4. A NARRAÇÃO NASCE DESLIGADA (`defaultAudioCat` devolve `on: k !== 'tts'`), e isso é correto — mas revela
//     que os PAINÉIS não são acessório: sem o menu auditivo, a criança não tem como ligar a voz. Um consumidor
//     que quisesse só "a engine, sem os menus" entregaria um TTS que existe e nunca fala.
//
//  5. `ui/settings-typo` + `ui/settings-panel` SERVEM FORA DO GÊNERO, sem uma linha de mudança. As 18 fontes, o
//     rodapé de explicação, a aplicação no documento, o anúncio e o "restaurar padrões" funcionaram no quiz
//     como funcionam no jogo. É a evidência mais forte até agora de que a pilha de menus é da engine.
//
//  6. MAS O CONTRATO DE MARKUP É INVISÍVEL. O ctx do painel pede `$` e `store`; o que ele REALMENTE exige é que
//     o documento do consumidor contenha `#typo`, `#typo-list`, `#typo-preview`, `#typo-close` e `#typo-reset`.
//     Nada no tipo diz isso — descobre-se por tentativa, e o modo de falhar é o pior possível: o painel abre
//     vazio, sem erro. Uma engine que exige ids fixos e não os declara está exigindo que cada consumidor
//     redescubra a mesma lista.
//
//  7. A CORREÇÃO DE DALTONISMO VIAJA. `installCvdFilters(host)` monta os seis filtros SVG em tempo de execução
//     dentro de um host que o consumidor fornece, e `VIZ_FILTER` diz qual `url(#...)` aplicar — em QUALQUER
//     elemento. O quiz ganhou correção protan/deutan/tritan sem PIXI e sem copiar uma linha de markup. É o
//     desenho certo, e vale registrar por contraste com o achado 6: aqui a engine ENTREGA o markup em vez de
//     exigir que o consumidor o adivinhe.
//
//  8. O ALTO CONTRASTE NÃO VIAJA, e a razão é estrutural, não um defeito. Os modos `hcnew` REPINTAM TEXTURAS
//     de tile na PIXI; um quiz não tem tiles, e não há o que repintar. Ou seja: o que o menu chama de
//     "acessibilidade visual" são DUAS pilhas com um nome só —
//        · uma de DOM/CSS (filtros de daltonismo, tipografia, caixa alta) que serve a qualquer jogo;
//        · uma de CANVAS (renderização direta, contornos, cores de papel) que só existe onde há mundo.
//     O painel as apresenta numa lista única de 7 modos, o que é certo para a plataforma e deixa um segundo
//     consumidor podendo oferecer só metade da lista. A divisão do passo 5 precisa cortar AQUI, e este é o
//     tipo de corte que só um consumidor sem tiles revela.
//
//  (faltam: sonar, menu-nav por gamepad, Libras e os botões de toque)
import { initI18n, t, applyDom } from '../core/i18n.js';
import { srSay, srAlert } from '../core/a11y-sr.js';
import { createTts } from '../platform/tts.js';
import { ensureAC, catNode, audioOut, soundOn, volume, audioCat, initAudioMixer } from '../platform/audio.js';
import { initSettingsTypo } from '../ui/settings-typo.js';
import { initSettingsPanel } from '../ui/settings-panel.js';
import * as store from '../platform/storage.js';
import { installCvdFilters } from '../render/cvd-matrices.js';
import { VIZ_MODES, VIZ_FILTER, simulatesDisability } from '../render/viz-modes.js';

/** Uma pergunta. Dado puro, do JOGO — o consumidor traz o seu conteúdo, como qualquer jogo deve trazer. */
interface Pergunta {
  readonly enunciado: string;
  readonly alternativas: readonly string[];
  readonly certa: number;
}

const PERGUNTAS: readonly Pergunta[] = [
  { enunciado: 'Qual animal põe ovos e tem bico?', alternativas: ['Gato', 'Galinha', 'Cavalo', 'Peixe'], certa: 1 },
  { enunciado: 'Quantos lados tem um triângulo?', alternativas: ['Três', 'Quatro', 'Cinco', 'Dois'], certa: 0 },
  { enunciado: 'Qual destas é uma fruta?', alternativas: ['Alface', 'Cenoura', 'Banana', 'Batata'], certa: 2 },
];

let atual = 0;
let foco = 0;
let acertos = 0;
let tts: ReturnType<typeof createTts> | null = null;

const $ = <T extends Element = Element>(sel: string): T | null => document.querySelector<T>(sel);

/** Marcação de uma pergunta. Pura: recebe estado, devolve texto — testável sem DOM. */
export function perguntaHtml(p: Pergunta, selecionada: number): string {
  const alts = p.alternativas.map((a, i) =>
    `<button class="mode-btn quiz-alt${i === selecionada ? ' is-on' : ''}" data-alt="${i}" type="button"` +
    ` role="radio" aria-checked="${i === selecionada}">${a}</button>`).join('');
  return (
    `<h2 class="quiz-pergunta">${p.enunciado}</h2>` +
    `<div class="quiz-alts" role="radiogroup" aria-label="Alternativas">${alts}</div>`
  );
}

/** O próximo índice do foco, com as pontas dando a volta. Puro — é a regra que o teclado e o pad compartilham. */
export function proximoFoco(atualIdx: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return ((atualIdx + delta) % total + total) % total;
}

/** O texto que o leitor de tela ouve ao responder. Separado do DOM porque é o que a criança cega RECEBE. */
export function respostaTexto(acertou: boolean, certa: string): string {
  return acertou ? `Certo! ${certa}.` : `Ainda não. A resposta certa é ${certa}.`;
}

function render(): void {
  const app = $<HTMLElement>('#quiz-app');
  if (!app) return;
  const p = PERGUNTAS[atual];
  if (!p) { app.innerHTML = `<h2 class="quiz-pergunta">Fim! ${acertos} de ${PERGUNTAS.length}.</h2>`; return; }
  app.innerHTML = perguntaHtml(p, foco);
  tts?.narrate(p.enunciado); // a narração do enunciado é do consumidor: a engine só empresta a voz
  app.querySelectorAll<HTMLButtonElement>('button[data-alt]').forEach((b) => {
    b.addEventListener('click', () => responder(Number(b.dataset.alt)));
  });
  const alvo = app.querySelector<HTMLElement>(`button[data-alt="${foco}"]`);
  if (alvo) alvo.focus();
}

function responder(i: number): void {
  const p = PERGUNTAS[atual];
  if (!p) return;
  const acertou = i === p.certa;
  if (acertou) acertos++;
  srAlert(respostaTexto(acertou, p.alternativas[p.certa] ?? ''));
  atual++;
  foco = 0;
  setTimeout(render, 900); // deixa o anúncio ser lido antes de a tela mudar
}

function aoTeclado(e: KeyboardEvent): void {
  const p = PERGUNTAS[atual];
  if (!p) return;
  const total = p.alternativas.length;
  if (e.code === 'ArrowDown' || e.code === 'ArrowRight') { foco = proximoFoco(foco, 1, total); render(); e.preventDefault(); }
  else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') { foco = proximoFoco(foco, -1, total); render(); e.preventDefault(); }
  else if (e.code === 'Enter' || e.code === 'Space') { responder(foco); e.preventDefault(); }
}

/** Boot. Exportado para o teste poder montá-lo num DOM de mentira sem depender do carregamento do módulo. */
export function bootQuiz(): void {
  initI18n();
  applyDom(document);
  // ORDEM OBRIGATÓRIA e não declarada por tipo nenhum: sem `initAudioMixer()`, `audioCat` é null e o
  // `narrate` desiste calado. Ver o achado 3 no cabeçalho.
  initAudioMixer();
  tts = createTts({
    srSay, srAlert, ensureAC, catNode, audioOut,
    getSoundOn: () => soundOn, getVolume: () => volume, getAudioCat: () => audioCat,
  });
  // A CASCA DOS DIÁLOGOS e UM painel emprestados, para medir se a pilha de menus serve fora do gênero.
  const overlays = initSettingsPanel({
    $, $$: <T extends Element = Element>(sel: string): T[] => [...document.querySelectorAll<T>(sel)],
    doc: document, computedZ: (el) => +getComputedStyle(el).zIndex || 0,
  });
  const typo = initSettingsTypo({ $, srSay, store, root: document.documentElement });
  const abrir = $<HTMLElement>('#q-abrir-typo');
  if (abrir) abrir.addEventListener('click', () => {
    const ov = $<HTMLElement>('#typo');
    if (!ov) return;
    typo.render(); ov.hidden = false; overlays.frontOverlay(ov);
    ov.querySelector<HTMLElement>('button[data-font]:not([disabled])')?.focus();
  });
  const fechar = $<HTMLElement>('#typo-close');
  if (fechar) fechar.addEventListener('click', () => { const ov = $<HTMLElement>('#typo'); if (ov) ov.hidden = true; });
  overlays.register('typo', { close: () => { const ov = $<HTMLElement>('#typo'); if (ov) ov.hidden = true; }, inEscapeChain: true });

  // VISÃO: as correções de daltonismo, sem PIXI e sem copiar markup. `installCvdFilters` monta os seis
  // filtros SVG dentro de um host que o consumidor fornece, e `VIZ_FILTER` diz qual `url(#...)` usar.
  const host = $<SVGElement>('#q-cvd');
  const instalados = installCvdFilters(host);
  const seletor = $<HTMLSelectElement>('#q-viz');
  const alvoViz = $<HTMLElement>('#game-region');
  if (seletor && alvoViz && instalados > 0) {
    const opcoes = VIZ_MODES.filter((m) => m.kind === 'normal' || (m.kind === 'filter' && !simulatesDisability(m.key)));
    seletor.innerHTML = opcoes.map((m) => `<option value="${m.key}">${m.nome}</option>`).join('');
    seletor.addEventListener('change', () => {
      alvoViz.style.filter = VIZ_FILTER[seletor.value] || '';
      srSay(seletor.options[seletor.selectedIndex]?.text ?? '');
    });
  }

  const região = $<HTMLElement>('#game-region');
  if (região) região.addEventListener('keydown', aoTeclado);
  render();
  srSay(t('sr.quiz.bemVindo'));
}

if (typeof document !== 'undefined' && document.getElementById('quiz-app')) bootQuiz();
