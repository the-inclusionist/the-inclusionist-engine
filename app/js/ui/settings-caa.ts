// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-caa.ts — O SÉTIMO MENU: COMUNICAÇÃO AUMENTADA E ALTERNATIVA (ADR-0028, issue #57).
//
// O catálogo (quem existe, sob qual licença, em qual camada) mora em ./caa-sets.js; aqui só a tela. DI por
// ctx, como os painéis irmãos: nada de global fora do que for injetado.
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
//
// ========================= O KIT DE PAINEL, E POR QUE AS LINHAS DEIXARAM DE SER CADEIAS =========================
// 🔴 Este painel construía as linhas como HTML em cadeia (`'<div class="ctrl-row">…'`) e refazia a lista inteira
// por `innerHTML` a cada render. O kit (`ui/mount-panel` + `ui/panel-widgets`) constrói NÓS, e a adopção dele
// pelos nove painéis é o ADR-0129, fechado pelo Dev em 22/09 com «Sim, terminamos a adoção».
//
// 🎯 A diferença que paga a conversão não é estética: a regra de menu do `CLAUDE.md` §4 — rótulo curto à vista,
// TODA a prosa num único `.opt-hint` dentro do `<span>` — passa a valer POR CONSTRUÇÃO, porque é o
// `controlRow` que a escreve. Em cadeia ela valia por convenção, e uma convenção repetida em quatro ficheiros
// é uma convenção que diverge.
//
// 📌 E a montagem passa a ser UMA VEZ, com o render a REFLECTIR: era a lista inteira refeita a cada clique, o
// que obrigava a religar as escutas em cada render e fazia o foco cair. Reetiquetar em vez de reconstruir é o
// que o `labelRow` existe para fazer (ver o cabeçalho dele: o painel capturava o texto no intervalo de
// arranque, onde o idioma ainda é o de recuo).
import { t } from '../core/i18n.js';
import { DEFAULTS } from '../core/state.js';
import type { LetterCase } from '../core/state.js';
import { CAA_SETS, CAA_BY_KEY, caaReason, type CaaSet } from './caa-sets.js';
import { markChanged, markMenuChanged } from './changed-mark.js';
import { controlRow, labelRow, sectionHeader, type ControlRowSpec } from './panel-widgets.js';
import type { PanelShellCtx } from './panel-shell.js';
import { toggleLabel } from './dom.js';

/**
 * A linha das LETRAS é um INTERRUPTOR, não duas opções (decisão do Dev). Ligado = só maiúsculas; desligado =
 * maiúsculas e minúsculas. Uma pergunta binária apresentada como duas linhas obriga a criança a comparar as
 * duas para descobrir que são a mesma pergunta.
 */
export function upperCaseOn(caso: LetterCase): boolean {
  return caso === 'upper';
}

/** O id do controle de um conjunto. Sai do `key` do catálogo, que é único por construção (`CAA_BY_KEY`). */
export const caaControlId = (key: string): string => `caa-set-${key}`;

/** O interruptor das letras. Sempre disponível: é o piso offline, e nunca dependeu de arquivo nenhum. */
export function lettersRowSpec(): ControlRowSpec {
  return { id: 'caa-caixa-alta', rotulo: t('caa.letras'), dica: t('caa.letras.dica') };
}

/**
 * Uma linha do menu: RÓTULO CURTO e nada mais à vista.
 *
 * Tudo o que explica — nota, licença, situação — entra num único `.opt-hint`, que é o que a casca
 * (`fillExplain`) reconhece e MOVE para o rodapé. A primeira versão pendurava três blocos de prosa dentro da
 * linha, e o Dev viu o resultado: o menu virou um manual, mais parecido com um arquivo de configuração do que
 * com um menu de videogame. A explicação já tinha um lugar; eu é que não a pus lá.
 *
 * O `rotuloAria` guarda o motivo, para quem navega por teclado ouvir por que a linha não responde sem precisar
 * caçar o rodapé. O `disabled` é do CONTROLE e não do texto: a situação some do rótulo, nunca do botão.
 */
export function caaRowSpec(s: CaaSet): ControlRowSpec {
  const reason = caaReason(s);
  const explains = [s.nota, s.licenca ? `Licença: ${s.licenca}` : '', reason ? t(reason) : '']
    .filter(Boolean).join(' · ');
  return {
    id: caaControlId(s.key),
    rotulo: s.nome,
    ...(explains ? { dica: explains } : {}),
    rotuloAria: `${s.nome}${reason ? ', ' + t(reason) : ''}`,
  };
}

/**
 * As três seções do menu, na ordem da decisão: a seção diz de QUEM é a vez de agir.
 *
 * 📌 Cada uma produz as próprias linhas em vez de filtrar o catálogo, porque a primeira não sai do catálogo —
 * as letras são um interruptor e não um conjunto, e foi essa a decisão do Dev que as tirou da lista. Uma
 * tabela em que a primeira linha é a excepção de todas as outras mente sobre o que ela é.
 */
export const CAA_SECTIONS: ReadonlyArray<{ title: string; tag: string; rows: () => ControlRowSpec[] }> = [
  { title: 'caa.secao.agora', tag: 'caa.secao.agoraTag', rows: () => [lettersRowSpec()] },
  {
    title: 'caa.secao.preparo',
    tag: 'caa.secao.preparoTag',
    rows: () => CAA_SETS.filter((s) => s.tier !== 'negotiating').map(caaRowSpec),
  },
  {
    title: 'caa.secao.negociacao',
    tag: 'caa.secao.negociacaoTag',
    rows: () => CAA_SETS.filter((s) => s.tier === 'negotiating').map(caaRowSpec),
  },
];

/**
 * Monta o interior do menu UMA VEZ. Chamada de novo, REETIQUETA em vez de reconstruir.
 *
 * ⚠️ Reetiquetar e não reconstruir, pela razão que o `labelRow` já escreve: as escutas ligam-se no arranque, e
 * refazer a linha deixaria um controle no documento e sem escuta — um botão morto com aparência de vivo
 * (ADR-0106 §5). E o texto foi capturado no intervalo de arranque, onde o idioma ainda é o de recuo.
 */
export function mountCaaInside(ctx: PanelShellCtx, list: HTMLElement): void {
  for (const section of CAA_SECTIONS) {
    const specs = section.rows();
    const header = sectionHeader(ctx, t(section.title), t(section.tag), specs.length);
    if (header && !list.querySelector(`[data-caa-section="${section.title}"]`)) {
      header.setAttribute('data-caa-section', section.title);
      list.appendChild(header);
    }
    for (const spec of specs) {
      const old = ctx.procurar('#' + spec.id)?.closest<HTMLElement>('.ctrl-row');
      if (old) labelRow(old, spec);
      else list.appendChild(newRow(ctx, spec));
    }
  }
}

/**
 * Uma linha nova, com o que o kit não sabe deste painel: a chave do conjunto e a trava.
 *
 * Nenhum conjunto está disponível hoje. Um botão que não faz nada é pior que a ausência, porque gasta a
 * confiança — então ele vem travado, e o motivo já está no `rotuloAria` para quem navega por teclado.
 */
function newRow(ctx: PanelShellCtx, spec: ControlRowSpec): HTMLElement {
  const { linha: row, controle: control } = controlRow(ctx, spec);
  if (spec.id === 'caa-caixa-alta') { row.id = 'caa-letras'; return row; }
  const key = spec.id.replace('caa-set-', '');
  control.setAttribute('data-caa', key);
  if (!CAA_BY_KEY[key]?.disponivel) control.setAttribute('disabled', '');
  return row;
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
   *  ao abrir: reetiquetar uma linha devolve a dica para dentro dela, e sem esta chamada o menu vira manual
   *  de novo ao primeiro clique — foi exatamente o que aconteceu. */
  fillExplain: (card: HTMLElement | null) => void;
  restoreFocus?: (id: string) => boolean;
}

export interface SettingsCaaApi {
  render: () => void;
  open: () => void;
  close: () => void;
}

export function initSettingsCaa(ctx: SettingsCaaCtx): SettingsCaaApi {
  /*
   * 📌 O CTX DO KIT SAI DO PRÓPRIO NÓ DA LISTA, e não de um `document` global nem de um campo novo no contrato.
   * `ownerDocument` é o documento onde aquela lista VIVE — que é exactamente o documento em que as linhas têm
   * de nascer —, então o alcance global deste módulo continua ZERO (ADR-0221 passo 7d) e `SettingsCaaCtx`, que
   * é superfície publicada, não ganha membro obrigatório (ADR-0172).
   */
  const panelCtx = (list: HTMLElement): PanelShellCtx => ({
    procurar: (sel) => ctx.$<HTMLElement>(sel),
    criar: (tag) => list.ownerDocument.createElement(tag),
  });

  function reflect(): void {
    const b = ctx.$<HTMLButtonElement>('#caa-caixa-alta');
    if (!b) return;
    const on = upperCaseOn(ctx.getLetterCase());
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
    // O texto do interruptor é o ESTADO; o nome dele está no `<strong>` ao lado e no `aria-label`.
    b.textContent = toggleLabel(on);
  }

  function render(): void {
    const el = ctx.$<HTMLElement>('#caa-list');
    if (!el) return;
    mountCaaInside(panelCtx(el), el);
    reflect();
    ctx.fillExplain(ctx.$<HTMLElement>('#caa .overlay__card'));
    refreshMarks();
  }

  /** A marca de "saiu do padrão" (ADR-0029), na linha escolhida e no botão do menu. */
  function refreshMarks(): void {
    const changed = ctx.getLetterCase() !== DEFAULTS.letterCase;
    markChanged(ctx.$<HTMLElement>('#caa-letras'), changed);
    markMenuChanged(ctx.$<HTMLElement>('[data-act="caa"]'), [changed]);
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

  /*
   * As escutas ligam-se UMA VEZ, na lista, por delegação — e é a montagem única que o permite. Antes cada
   * render refazia os nós, logo cada render religava tudo; e a escuta dos conjuntos era um corpo com um guarda
   * e mais nada depois dele, que é código inerte com aparência de proteção. O que protege um conjunto
   * indisponível é o `disabled` do próprio botão, escrito onde ele nasce.
   */
  const list = ctx.$<HTMLElement>('#caa-list');
  if (list) list.addEventListener('click', (ev) => {
    const hit = (ev.target as HTMLElement | null)?.closest<HTMLElement>('#caa-caixa-alta');
    if (!hit) return;
    const turnOn = !upperCaseOn(ctx.getLetterCase());
    ctx.setLetterCase(turnOn ? 'upper' : 'mixed');
    render();
    ctx.srSay(t(turnOn ? 'sr.caa.caixaAltaOn' : 'sr.caa.caixaAltaOff'));
  });

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
