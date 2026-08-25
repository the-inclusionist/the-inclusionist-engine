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
//  (os demais achados entram conforme este consumidor for crescendo — TTS, alto contraste, sonar, menu-nav)
import { initI18n, t, applyDom } from '../core/i18n.js';
import { srSay, srAlert } from '../core/a11y-sr.js';

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
  const região = $<HTMLElement>('#game-region');
  if (região) região.addEventListener('keydown', aoTeclado);
  render();
  srSay(t('sr.quiz.bemVindo'));
}

if (typeof document !== 'undefined' && document.getElementById('quiz-app')) bootQuiz();
