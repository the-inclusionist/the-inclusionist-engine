// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-caa.ts — O SÉTIMO MENU: COMUNICAÇÃO AUMENTADA E ALTERNATIVA (ADR-0028, issue #57).
//
// O catálogo (quem existe, sob qual licença, em qual camada) mora em ./caa-sets.js; aqui só a tela. DI por
// ctx, como os seis painéis irmãos: nada de global fora do que for injetado.
//
// O QUE ESTE MENU É HOJE, dito sem maquiagem: um seletor de caixa de letra que já mostra, ao lado, os sete
// conjuntos de pictogramas que virão. Só as duas caixas de letra funcionam — os pictogramas são milhares de
// arquivos que ainda não entraram no repositório, e três deles dependem de negociação que não é nossa.
//
// Mostrar o que não funciona seria desonesto se o menu não dissesse POR QUE. Ele diz, e com duas respostas
// diferentes de propósito: "em preparação" (a licença está resolvida, o trabalho é nosso) e "aguardando
// negociação" (a permissão é de outra pessoa). Um educador que lê a primeira sabe esperar; que lê a segunda
// sabe que esperar não adianta. Esconder tudo o que ainda não anda faria o educador concluir que o jogo não
// faz pictograma nenhum — que é a conclusão errada, e a que mais custa a quem precisa deles.
//
// LETRA vs PICTOGRAMA: a escolha de caixa é `letterCase` (core/state). NÃO existe um `caaMode` paralelo, e
// isso é decisão: enquanto só duas opções forem escolhíveis, uma segunda variável para a mesma pergunta
// seria duplicação com aparência de arquitetura. Ver a nota em core/state.
import { toggleLabel } from './dom.js';
import { t } from '../core/i18n.js';
import { DEFAULTS } from '../core/state.js';
import type { LetterCase } from '../core/state.js';
import { CAA_SETS, CAA_BY_KEY, caaReason, type CaaSet } from './caa-sets.js';
import { markChanged, markMenuChanged } from './changed-mark.js';

/**
 * A linha das LETRAS é um INTERRUPTOR, não duas opções (decisão do Dev). Ligado = só maiúsculas; desligado =
 * maiúsculas e minúsculas. Uma pergunta binária apresentada como duas linhas obriga a criança a comparar as
 * duas para descobrir que são a mesma pergunta.
 */
export function upperCaseOn(caso: LetterCase): boolean {
  return caso === 'upper';
}

/** O interruptor das letras. Sempre disponível: é o piso offline, e nunca dependeu de arquivo nenhum. */
export function lettersRowHtml(ligado: boolean): string {
  return (
    '<div class="ctrl-row" id="caa-letras"><span><strong>Letras maiúsculas</strong>' +
    '<span class="opt-hint">Ligado: o jogo inteiro em caixa alta, como a alfabetização brasileira costuma ' +
    'começar. Desligado: maiúsculas e minúsculas, a escrita do dia a dia.</span></span>' +
    `<button class="mode-btn switch${ligado ? ' is-on' : ''}" id="caa-caixa-alta" type="button"` +
    ` aria-pressed="${ligado}" aria-label="Letras maiúsculas">${toggleLabel(ligado)}</button></div>`
  );
}

/**
 * Uma linha do menu: RÓTULO CURTO e nada mais à vista.
 *
 * Tudo o que explica — nota, licença, situação — entra num único `.opt-hint`, que é o que a casca
 * (`fillExplain`) reconhece e MOVE para o rodapé. A primeira versão pendurava três blocos de prosa dentro da
 * linha, e o Dev viu o resultado: o menu virou um manual, mais parecido com um arquivo de configuração do que
 * com um menu de videogame. A explicação já tinha um lugar; eu é que não a pus lá.
 *
 * O `disabled` fica: a situação some do TEXTO, não do controle. E o `aria-label` guarda o motivo, para quem
 * navega por teclado ouvir por que a linha não responde sem precisar caçar o rodapé.
 */
export function caaRowHtml(s: CaaSet, selecionada: boolean): string {
  const motivo = caaReason(s);
  const explica = [s.nota, s.licenca ? `Licença: ${s.licenca}` : '', motivo ? t(motivo) : '']
    .filter(Boolean).join(' · ');
  const hint = explica ? `<span class="opt-hint">${explica}</span>` : '';
  const estado = toggleLabel(selecionada);
  return (
    `<div class="ctrl-row"><span><strong>${s.nome}</strong>${hint}</span>` +
    `<button class="mode-btn switch${selecionada ? ' is-on' : ''}" data-caa="${s.key}" type="button"` +
    `${s.disponivel ? '' : ' disabled'} aria-pressed="${selecionada}"` +
    ` aria-label="${s.nome}${motivo ? ', ' + t(motivo) : ''}">${estado}</button></div>`
  );
}

/** O corpo do menu, em três seções — a seção diz de quem é a vez de agir. */
export function caaListHtml(caso: LetterCase): string {
  const bloco = (titulo: string, tag: string, corpo: string): string =>
    corpo ? `<h3 class="panel-sub">${titulo} <span class="panel-sub__tag">${tag}</span></h3>${corpo}` : '';
  const sets = (f: (s: CaaSet) => boolean): string => CAA_SETS.filter(f).map((s) => caaRowHtml(s, false)).join('');
  return (
    bloco(t('caa.secao.agora'), t('caa.secao.agoraTag'), lettersRowHtml(upperCaseOn(caso))) +
    bloco(t('caa.secao.preparo'), t('caa.secao.preparoTag'), sets((s) => s.tier !== 'negotiating')) +
    bloco(t('caa.secao.negociacao'), t('caa.secao.negociacaoTag'), sets((s) => s.tier === 'negotiating'))
  );
}

export interface SettingsCaaCtx {
  $: <T extends Element = Element>(sel: string) => T | null;
  srSay: (msg: string) => void;
  /** Leitura viva de core/state `letterCase` (o binding é reatribuído pelo setter). */
  getLetterCase: () => LetterCase;
  /** `setLetterCaseValue` de core/state MAIS a reflexão que o jogo precisa (re-render do quiz, rótulos). */
  setLetterCase: (c: LetterCase) => void;
  frontOverlay: (el: HTMLElement | null) => void;
  /** Move a prosa das linhas para o rodapé (ui/settings-panel `fillExplain`). Chamado a CADA render, e não só
   *  ao abrir: `render()` reconstrói as linhas, e sem esta chamada a explicação volta para dentro delas — foi
   *  exatamente o que aconteceu, e o menu virou manual de novo ao primeiro clique. */
  fillExplain: (card: HTMLElement | null) => void;
  restoreFocus?: (id: string) => boolean;
}

export interface SettingsCaaApi {
  render: () => void;
  open: () => void;
  close: () => void;
}

export function initSettingsCaa(ctx: SettingsCaaCtx): SettingsCaaApi {
  function render(): void {
    const el = ctx.$<HTMLElement>('#caa-list');
    if (!el) return;
    el.innerHTML = caaListHtml(ctx.getLetterCase());
    const alta = el.querySelector<HTMLButtonElement>('#caa-caixa-alta');
    if (alta) alta.addEventListener('click', () => {
      const ligar = !upperCaseOn(ctx.getLetterCase());
      ctx.setLetterCase(ligar ? 'upper' : 'mixed');
      render();
      ctx.srSay(t(ligar ? 'sr.caa.caixaAltaOn' : 'sr.caa.caixaAltaOff'));
    });
    el.querySelectorAll<HTMLButtonElement>('button[data-caa]').forEach((b) => {
      b.addEventListener('click', () => {
        const set = b.dataset.caa ? CAA_BY_KEY[b.dataset.caa] : undefined;
        // Nenhum conjunto está disponível hoje, e todos vêm `disabled`. A guarda existe para o dia em que
        // alguém remover o atributo "só para testar": um conjunto que não está no jogo não pode virar a
        // escolha da criança por acidente, deixando a tela sem nada para desenhar.
        if (!set || !set.disponivel) return;
      });
    });
    ctx.fillExplain(ctx.$<HTMLElement>('#caa .overlay__card'));
    refreshMarks();
  }

  /** A marca de "saiu do padrão" (ADR-0029), na linha escolhida e no botão do menu. */
  function refreshMarks(): void {
    const mudou = ctx.getLetterCase() !== DEFAULTS.letterCase;
    markChanged(ctx.$<HTMLElement>('#caa-letras'), mudou);
    markMenuChanged(ctx.$<HTMLElement>('[data-act="caa"]'), [mudou]);
  }

  function open(): void {
    const ov = ctx.$<HTMLElement>('#caa');
    if (!ov) return;
    render();
    ov.hidden = false;
    ctx.frontOverlay(ov);
    const f = ov.querySelector<HTMLElement>('button');
    if (f) f.focus();
  }

  function close(): void {
    const ov = ctx.$<HTMLElement>('#caa');
    if (!ov) return;
    ov.hidden = true;
    ctx.restoreFocus?.('caa');
  }

  const closeBtn = ctx.$<HTMLElement>('#caa-close');
  if (closeBtn) closeBtn.addEventListener('click', close);

  // ---- restaurar os padrões DESTE menu (ADR-0028) ----
  // O menu tem uma escolha só, então o reset é uma linha — mas vale dizer para onde ele volta: maiúsculas, que
  // é onde a alfabetização brasileira costuma começar. Uma criança que trocou a caixa e não consegue mais ler
  // a tela precisa de um caminho de volta que termine no que a professora dela usa.
  const resetBtn = ctx.$<HTMLElement>('#caa-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    ctx.setLetterCase(DEFAULTS.letterCase);
    render();
    ctx.srSay(t('sr.caa.reset'));
  });

  return { render, open, close };
}
