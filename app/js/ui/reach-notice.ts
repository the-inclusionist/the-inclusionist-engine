// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/reach-notice.ts — A TELA QUE DIZ, ANTES DE COMEÇAR, que o controle desta criança não alcança este jogo.
// Segunda metade da issue #112; a aritmética é do `input/transports` (ADR-0079 §3).
//
// ⚠️ POR QUE ISTO NÃO É POLIMENTO. O controle de tela tem NOVE slots desde sempre, e o conjunto de ações
// passou a CATORZE em 2026-09-06 (ADR-0085). Um jogo de doze ações num tablet é uma combinação real — e num
// tablet de escola pública o toque não é o caminho alternativo, é o ÚNICO. Sem esta tela, a criança descobre
// no meio da partida que não alcança uma ação e conclui que o jogo está partido, sem ter como saber que não
// está. A resposta honesta é uma frase ANTES, e não meia tela jogável.
//
// ⚠️ ELA INFORMA, NÃO RECUSA — e essa é a decisão que sustenta todo o resto. A detecção de teclado é
// imprecisa por natureza: não há API que diga «há um teclado físico ligado», e um tablet COM teclado responde
// «toque» ao `pointer:coarse && hover:none` que o projeto usa. Se esta tela barrasse, esse tablet levaria uma
// recusa FALSA num jogo que ele joga. Informando, o erro custa uma frase a mais e nunca uma porta fechada.
//
// ⚠️ E O TEXTO É MOLDADO À PARTE DO DOM de propósito: as frases são a coisa que precisa de ser lida com
// cuidado e traduzida para três idiomas, e o project node consegue afereri-las sem navegador nenhum.
import type { Alcance } from '../input/transports.js';

/** `core/i18n.t` — injetado para o núcleo continuar puro e para o teste poder ver as chaves cruas. */
export type Tradutor = (chave: string, params?: Record<string, string | number>) => string;

/**
 * AS FRASES DO AVISO, na ordem em que são lidas. Vazio = não há nada a dizer, e é o caso comum.
 *
 * ⚠️ A ÚLTIMA LINHA TEM DUAS FORMAS, e a diferença entre elas é a diferença entre ajudar e mentir:
 *
 *   · há transporte que serviria se ligado → «ligue um controle», que é acionável.
 *   · não há nenhum → dizer «ligue um controle» seria mandar a criança procurar uma coisa que não resolve.
 *     Nesse caso o problema é do JOGO, que pede mais posições do que qualquer transporte deste aparelho
 *     oferece, e a frase honesta é outra.
 */
export function linhasDoAviso(a: Alcance, t: Tradutor): string[] {
  if (a.ok) return [];

  const nome = (id: string): string => t('reach.nome.' + id);
  const linhas = [t('reach.titulo', { pedidas: a.pedidas })];

  for (const c of a.curtos) {
    linhas.push(t('reach.curto', { transporte: nome(c.id), lugares: c.slots }));
  }

  // ⚠️ A TERCEIRA FRASE, e ela existe porque um transporte pode CHEGAR a todas as ações e ainda assim não
  // deixar a criança jogar (ADR-0104). Medido: a plataforma pede nove ações, o controle de tela tem nove
  // lugares, e o cartão nunca aparecia — mas correr, andar e pular ao mesmo tempo são três dedos, e um
  // telemóvel que reconhece dois não os dá. A criança tentava, não acontecia nada, e concluía que o jogo
  // estava partido. Uma frase antes de começar é a resposta honesta; meia tela jogável não é.
  for (const s of a.naoSeguram) {
    linhas.push(t('reach.naoSegura', { transporte: nome(s.id), segura: s.holds, pedidas: a.seguraPedidas }));
  }

  linhas.push(a.serviriamSeLigados.length
    ? t('reach.ligue', { saida: a.serviriamSeLigados.map(nome).join(t('reach.ou')) })
    : t('reach.semSaida'));

  return linhas;
}

export interface ReachNoticeCtx {
  /** `querySelector` do documento deste jogo. */
  procurar: (sel: string) => HTMLElement | null;
  /** `document.createElement`. Injetado como tudo o mais que toca o documento. */
  criar: (tag: string) => HTMLElement;
  t: Tradutor;
  /** Anúncio assertivo. Uma criança cega tem de OUVIR isto — ela não vai ver o cartão. */
  srAlert: (texto: string) => void;
}

/** O id do cartão. Estável porque o teste e a folha de estilo o procuram. */
export const REACH_NOTICE_ID = 'reach-notice';

/**
 * Mostra o aviso, se houver o que dizer. Devolve `true` quando mostrou.
 *
 * ⚠️ MONTA POR NÓS E NÃO POR `innerHTML`. As frases passam por `t()` e um dicionário é conteúdo que muda sem
 * passar por revisão de código — é exatamente a fronteira que a issue #106 mapeia. `textContent` fecha a
 * questão sem precisar de escapar nada.
 */
export function mostrarAvisoDeAlcance(ctx: ReachNoticeCtx, a: Alcance): boolean {
  const linhas = linhasDoAviso(a, ctx.t);
  if (linhas.length === 0) return false;

  const dentro = ctx.procurar('#game-region');
  if (!dentro) return false; // sem a marcação do hospedeiro não há onde mostrar; o `problems` já o denuncia

  const fora = ctx.criar('div');
  fora.id = REACH_NOTICE_ID;
  fora.className = 'overlay';

  const cartao = ctx.criar('div');
  cartao.className = 'overlay__card';
  cartao.setAttribute('role', 'dialog');
  cartao.setAttribute('aria-modal', 'true');
  cartao.setAttribute('tabindex', '-1');

  for (const [i, texto] of linhas.entries()) {
    const p = ctx.criar('p');
    p.textContent = texto;
    if (i === 0) p.className = 'reach-notice__titulo';
    cartao.appendChild(p);
  }

  // ⚠️ O BOTÃO É O QUE FAZ DISTO UM AVISO E NÃO UMA PORTA FECHADA. Ver o cabeçalho: a detecção de teclado
  // erra, e o erro só é aceitável enquanto a criança puder seguir em frente.
  const seguir = ctx.criar('button');
  seguir.setAttribute('type', 'button');
  seguir.className = 'mode-btn';
  seguir.textContent = ctx.t('reach.continuar');
  seguir.addEventListener('click', () => fora.remove());
  cartao.appendChild(seguir);

  fora.appendChild(cartao);
  dentro.appendChild(fora);

  // O foco vai para o cartão, não para o botão: a criança tem de OUVIR o motivo antes de encontrar a saída.
  // (Se fosse para o botão, o leitor de tela leria «Jogar assim mesmo» e o resto ficaria para quem procurasse.)
  cartao.focus();
  ctx.srAlert(linhas.join(' '));
  return true;
}
