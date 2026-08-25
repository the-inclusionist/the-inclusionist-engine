// SPDX-License-Identifier: GPL-3.0-or-later
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
import { t } from '../core/i18n.js';
import { DEFAULTS } from '../core/state.js';
import type { LetterCase } from '../core/state.js';
import { CAA_SETS, CAA_BY_KEY, caaMotivo, type CaaSet } from './caa-sets.js';
import { markChanged, markMenuChanged } from './changed-mark.js';

/** A caixa de letra que cada entrada de LETRA representa — a ponte entre o catálogo e `letterCase`. */
const CASO_POR_CHAVE: Readonly<Record<string, LetterCase>> = {
  'letras-mistas': 'mixed',
  'letras-maiusculas': 'upper',
};

/** A entrada do catálogo que corresponde à caixa de letra atual. Pura, testável em node. */
export function chaveSelecionada(caso: LetterCase): string {
  return caso === 'upper' ? 'letras-maiusculas' : 'letras-mistas';
}

/** Uma linha do menu. Indisponível vira `disabled` + o motivo no rótulo — nunca um botão que não faz nada. */
export function caaRowHtml(s: CaaSet, selecionada: boolean): string {
  const motivo = caaMotivo(s);
  const nota = s.nota ? `<br><span class="opt-hint" style="margin:0">${s.nota}</span>` : '';
  const lic = s.licenca ? `<br><span class="opt-hint" style="margin:0">Licença: ${s.licenca}</span>` : '';
  const marca = motivo ? `<br><span class="opt-hint" style="margin:0"><strong>${t(motivo)}</strong></span>` : '';
  const estado = selecionada ? '❚❚ Ligado' : '▶ Desligado';
  return (
    `<div class="ctrl-row"><span><strong>${s.nome}</strong>${nota}${lic}${marca}</span>` +
    `<button class="mode-btn switch${selecionada ? ' is-on' : ''}" data-caa="${s.key}" type="button"` +
    `${s.disponivel ? '' : ' disabled'} aria-pressed="${selecionada}"` +
    ` aria-label="${s.nome}${motivo ? ', ' + t(motivo) : ''}">${estado}</button></div>`
  );
}

/** O corpo do menu, em três seções — a seção diz de quem é a vez de agir. */
export function caaListHtml(caso: LetterCase): string {
  const sel = chaveSelecionada(caso);
  const bloco = (titulo: string, tag: string, sets: readonly CaaSet[]): string =>
    sets.length
      ? `<h3 class="panel-sub">${titulo} <span class="panel-sub__tag">${tag}</span></h3>` +
        sets.map((s) => caaRowHtml(s, s.key === sel)).join('')
      : '';
  return (
    bloco(t('caa.secao.agora'), t('caa.secao.agoraTag'), CAA_SETS.filter((s) => s.disponivel)) +
    bloco(t('caa.secao.preparo'), t('caa.secao.preparoTag'),
      CAA_SETS.filter((s) => !s.disponivel && s.tier !== 'negotiating')) +
    bloco(t('caa.secao.negociacao'), t('caa.secao.negociacaoTag'),
      CAA_SETS.filter((s) => s.tier === 'negotiating'))
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
    el.querySelectorAll<HTMLButtonElement>('button[data-caa]').forEach((b) => {
      b.addEventListener('click', () => {
        const chave = b.dataset.caa;
        const set = chave ? CAA_BY_KEY[chave] : undefined;
        // Botão indisponível já vem `disabled`; a guarda existe para o dia em que alguém remover o atributo
        // "só para testar" — um conjunto que não está aqui não pode virar a escolha da criança por acidente.
        if (!set || !set.disponivel) return;
        const caso = CASO_POR_CHAVE[set.key];
        if (!caso) return;
        ctx.setLetterCase(caso);
        render();
        ctx.srSay(t('sr.caa.escolha', { v: set.nome }));
      });
    });
    refreshMarks();
  }

  /** A marca de "saiu do padrão" (ADR-0029), na linha escolhida e no botão do menu. */
  function refreshMarks(): void {
    const mudou = ctx.getLetterCase() !== DEFAULTS.letterCase;
    const el = ctx.$<HTMLElement>('#caa-list');
    el?.querySelectorAll<HTMLElement>('.is-changed').forEach((x) => markChanged(x, false));
    const sel = el?.querySelector<HTMLElement>(`button[data-caa="${chaveSelecionada(ctx.getLetterCase())}"]`);
    markChanged(sel?.closest<HTMLElement>('.ctrl-row') ?? null, mudou);
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
