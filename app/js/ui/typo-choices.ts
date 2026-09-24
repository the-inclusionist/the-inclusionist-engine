// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/typo-choices.ts — O QUE UMA ESCOLHA DE TIPOGRAFIA É, sem documento nenhum.
//
// Este módulo responde três perguntas e só três: que faces podem ser escolhidas, que CSS cada escolha comanda,
// e que forma tem a linha que a oferece. Zero DOM, zero ctx, zero estado — é a metade que o projecto node
// consegue exercer inteira, e foi a SUÍTE que marcou esta costura antes de ela existir: os casos puros já
// viviam em `tests/settings-typo.node.test.js` e os de marcação noutro ficheiro.
//
// 📌 Mesmo corte que o `ui/audio-choices` recebeu do `ui/settings-audio` (nota BD), e pela mesma razão: o
// `ui/settings-typo` tinha o trabalho que o nome dele nunca mencionava — achar os nós que ele alcança e nunca
// criou, ligá-los e reflectir a escolha — misturado com a tabela do que uma escolha É.
//
// 🔴 E A RAZÃO IMEDIATA FOI MEDIDA: ao adoptar o kit de painel (nota BI), o `ui/settings-typo` ficou com 183
// linhas contra um tecto de 187 (ADR-0221). Tinha gasto a folga dele, e a mudança honesta seguinte não caberia
// — que é a catraca a apontar para o corte certo em vez de a pedir uma excepção.
import { t } from '../core/i18n.js';
import { FONT_GROUPS, FONT_BY_KEY, fontRole, faceAvailable, type FontItem } from './fonts.js';
import type { ControlRowSpec } from './panel-widgets.js';

/**
 * A key is selectable when it exists in the catalog, is not marked `.off` (licence pending, etc.) — and is
 * `geral`.
 *
 * ⚠️ O TERCEIRO TERMO ENTROU EM 2026-09-07 (issue #87), e sem ele o resto da mudança seria decoração: o menu
 * deixaria de OFERECER as caligráficas e elas continuariam SELECIONÁVEIS por qualquer outro caminho — o
 * `resolveFontKey` de uma chave guardada, um `data-font` num markup de consumidor. «Não está na lista» e «não
 * pode ser escolhida» têm de ser a mesma afirmação, ou a lista é só uma sugestão.
 */
export function isSelectableFont(k: string, installed?: (family: string) => boolean): boolean {
  const it = FONT_BY_KEY[k];
  return !!it && faceAvailable(it, installed) && fontRole(it) === 'geral';
}

export interface FontCssTarget {
  /** Value written to root.dataset.fonte. */
  font: 'padrao' | 'alfabetizacao' | 'dislexia' | 'custom';
  /** Value for the --font-custom CSS property, or null to remove the property. */
  customFamily: string | null;
  /**
   * Is this a JOINED face? (ADR-0149 §3.)
   *
   * 🔴 It drives `data-cursiva` on the root, which is what removes the BDA letter/word spacing. Letter
   * spacing on a joined face pulls the letters apart at exactly the joins that make it cursive — the spacing
   * meant to help reading would destroy the thing being read. The Dev's words: «para manter os conectores».
   *
   * 📌 Read off `FontItem.fb` rather than a new field: the catalogue already tells cursive faces apart, and a
   * second source for the same fact is a second place for it to drift.
   */
  cursive: boolean;
}

/**
 * Maps a selectable font key to the CSS it drives. The three canonical EdSP fonts (atkinson/andika/lexend) use
 * dedicated data-fonte values (Lexend's keeps the BDA letter/word spacing tied to data-fonte="dislexia"); every
 * other catalog font goes through --font-custom with a generic fallback by family (serif/cursive/none).
 */
export function fontCssTarget(k: string, it: FontItem): FontCssTarget {
  // ⚠️ AS TRÊS CANÓNICAS NÃO SÃO CURSIVAS, e responder `false` por elas é afirmação e não descuido: Atkinson,
  // Andika e Lexend são faces de leitura, e é justamente nelas que o espaçamento da BDA tem de valer.
  if (k === 'atkinson') return { font: 'padrao', customFamily: null, cursive: false };
  if (k === 'andika') return { font: 'alfabetizacao', customFamily: null, cursive: false };
  if (k === 'lexend') return { font: 'dislexia', customFamily: null, cursive: false };
  // ⚠️ O CAMPO chama-se `cursiva` e o local não: o campo é superfície publicada e sai na fase 7 do plano do
  // inglês, junto dos outros 310 membros; o que nasce aqui é meu e nasce em inglês. `joined` é a palavra que
  // a própria documentação do campo usa — «is this a JOINED face?» —, e é mais exacta do que «cursiva».
  const joined = it.fb === 'cursive';
  const suffix = it.fb === 'serif' ? ',Georgia,serif' : joined ? ',cursive' : '';
  return { font: 'custom', customFamily: `'${it.fam}'${suffix}`, cursive: joined };
}

export interface TypoRow {
  key: string;
  fam: string;
  selected: boolean;
  disabled: boolean;
  /** Description (+ "— <off reason>" when disabled), or '' when there is none. */
  note: string;
}
export interface TypoGroupView {
  g: string;
  rows: TypoRow[];
}

/**
 * UMA linha da lista, a partir de uma face do catálogo. Extraída em 2026-09-07 (issue #87) porque o gate do
 * mecanismo `.off` precisava de a exercitar com uma face de MENTIRA: as duas únicas entradas desligadas
 * saíram do roster, e um caso que dependa da composição do catálogo reprova sempre que o roster muda.
 *
 * O mecanismo fica, e é preciso: o item 4 da #87 usa-o para a **Ronde**, que só pode ser oferecida se uma de
 * três faces estiver instalada, porque duas delas são gratuitas apenas para uso pessoal e não podem ser
 * empacotadas.
 */
export function fontRow(it: FontItem, fontKey: string, installed?: (family: string) => boolean): TypoRow {
  // ⚠️ A MESMA pergunta que o `isSelectableFont` faz, pela MESMA função. Duas respostas dariam uma linha
  // clicável que o clique recusa — ou, pior, uma linha cinzenta que o `resolveFontKey` aceita por outro
  // caminho. «Não está disponível» e «não pode ser escolhida» têm de ser a mesma afirmação.
  const disabled = !faceAvailable(it, installed);
  // `d` e `off` também guardam CHAVE. O travessão que junta os dois é pontuação, não frase — as duas
  // metades são independentes e cada uma traduz por si.
  const desc = it.d ? t(it.d) : '', reason = it.off ? t(it.off) : '';
  const note = desc ? desc + (disabled ? ' — ' + reason : '') : disabled ? reason : '';
  return { key: it.k, fam: it.fam, selected: fontKey === it.k, disabled, note };
}

/** Pure view-model for the typography list: which row is selected/disabled and its note, per catalog group. */
export function typoGroups(fontKey: string, installed?: (family: string) => boolean): TypoGroupView[] {
  // ⚠️ SÓ AS GERAIS ENTRAM NA LISTA (emenda do ADR-0012, issue #87). As caligráficas existem para a criança
  // APRENDER a ler letra cursiva — isso é matéria, e vive DENTRO das atividades, em botões próprios. Oferecê-
  // las aqui é dar-lhe a matéria como obstáculo em todo lugar onde ela só quer navegar o menu.
  //
  // Um grupo que fique sem nenhuma face geral desaparece da lista, em vez de aparecer como título vazio.
  return FONT_GROUPS.map((g) => ({
    g: t(g.g),  // `g` guarda CHAVE i18n desde o item 14 (ver ui/fonts)
    rows: g.items.filter((it) => fontRole(it) === 'geral').map((it) => fontRow(it, fontKey, installed)),
  })).filter((group) => group.rows.length > 0);
}

/** O id do botão de uma face. Sai da CHAVE do catálogo, que é única por construção (`FONT_BY_KEY`). */
export const typoControlId = (key: string): string => `typo-font-${key}`;

/**
 * O que uma linha de fonte DIZ, antes de existir nó nenhum — a forma que o kit consome.
 *
 * ⚠️ `forma: 'radio'` e não `interruptor`, e isso foi decidido em 2026-09-07: eram dezassete interruptores
 * independentes anunciando «Ligado»/«Desligado» para escolher UMA fonte. A emenda do ADR-0012 diz o contrário
 * em tantas palavras: «THE MENU IS A CHOICE, NOT A TOGGLE […] One font is active; the others are
 * alternatives, not switches.»
 *
 * 📌 A nota entra na DICA — que o `fillExplain` leva ao rodapé — e TAMBÉM no nome acessível, porque quem não
 * vê a linha precisa de ouvir para quem aquela face serve sem ir caçar o rodapé.
 */
export function typoRowSpec(row: TypoRow): ControlRowSpec {
  return {
    id: typoControlId(row.key),
    label: row.fam,
    ...(row.note ? { hint: row.note } : {}),
    shape: 'radio',
    ariaLabel: row.fam + (row.note ? ' — ' + row.note : ''),
  };
}
