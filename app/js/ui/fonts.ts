// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/fonts.ts — catálogo de fontes (dados) + índice por chave + carga/persistência da escolha. Módulo-folha
// (só depende de storage). A instância `fontKey` e o setGameFont (aplica família/espaçamento) ficam no game.js.
import * as store from '../platform/storage.js';

/**
 * Uma fonte do catálogo. `fam` é o NOME DA FONTE — nome próprio, nunca traduzido. `d` guarda CHAVE i18n da
 * descrição, não o texto: mesma decisão de `VIZ_MODES` e `RM_LABEL`, e pelo mesmo motivo — uma tabela de
 * `const` com texto resolve uma vez, no import, e fica congelada no idioma do boot.
 */
/**
 * O PAPEL de uma face, e é a emenda do ADR-0012 (27/08) posta em dado (issue #87).
 *
 * ⚠️ NÃO É O MESMO QUE O GRUPO. O grupo (`sans`/`serif`/`hand`) é APARÊNCIA e serve para ler a lista; o papel
 * é ONDE A FACE PODE SER USADA, e é regra:
 *
 *   · `geral` — em qualquer lugar. São as únicas que o menu de tipografia oferece.
 *   · `caligrafica` — **só DENTRO das atividades escolares**, nunca no HUD nem nos menus, e por isso **não
 *     aparecem no menu de fonte**. Elas existem para a criança APRENDER a ler letra cursiva, o que é matéria;
 *     usá-las como interface é dar-lhe a matéria como obstáculo em todos os lugares onde ela só quer navegar.
 *
 * ⚠️ E O CORTE NÃO É O GRUPO `hand`. O `comicneue` está lá por aparência — a face é de propósito geral e é
 * frequentemente recomendada para dislexia. Tirá-la do menu removeria uma opção legitimamente acessível. A
 * definição boa é a lista do item 2 da #87, que nomeia as caligráficas dando-lhes tamanho mínimo.
 */
export type FontRole = 'geral' | 'caligrafica';

export type FontItem = {
  k: string; fam: string; fb: string; d?: string; off?: string;
  /** Ausente = `geral`. Só as caligráficas se declaram, porque são a excepção. */
  papel?: FontRole;
  /**
   * O menor tamanho, em px, em que esta face ainda é legível (item 2 da #87, números do Dev).
   *
   * ⚠️ Abaixo disto a face deixa de ser DIFÍCIL e passa a ser ILEGÍVEL, que são coisas diferentes: a
   * dificuldade é o exercício, a ilegibilidade é a criança a desistir. Por isso é gate e não recomendação.
   */
  minPx?: number;
};
/** Um grupo do catálogo. `g` também guarda CHAVE ('font.group.sans'), pelo mesmo motivo. */
export type FontGroup = { g: string; items: FontItem[] };
export const FONT_GROUPS: FontGroup[] = [
  {g:'font.group.sans', items:[
    {k:'atkinson',   fam:'Atkinson Hyperlegible', fb:'sans', d:'font.desc.atkinson'},
    {k:'lexend',     fam:'Lexend',                fb:'sans', d:'font.desc.lexend'},
    {k:'quattro',    fam:'iA Writer Quattro',     fb:'sans', d:'font.desc.quattro'},
    {k:'andika',     fam:'Andika',                fb:'sans', d:'font.desc.andika'},
    {k:'sourcesans', fam:'Source Sans 3',         fb:'sans'},
    {k:'inter',      fam:'Inter',                 fb:'sans'},
    {k:'opensans',   fam:'Open Sans',             fb:'sans'},
    {k:'lato',       fam:'Lato',                  fb:'sans'} ]},
  {g:'font.group.serif', items:[
    {k:'literata',    fam:'Literata',       fb:'serif'},
    {k:'sourceserif', fam:'Source Serif 4', fb:'serif'},
    {k:'newsreader',  fam:'Newsreader',     fb:'serif'} ]},
  // ⚠️ QUATRO FACES SAÍRAM DAQUI EM 2026-09-07 (issue #87, item 3, decisão do Dev):
  //   · `greatvibes` (44 KB) e `ufcook` (20 KB) — peso que o roster não paga;
  //   · `learningcurve` e `kindergarten` — eram entradas `.off` SEM FICHEIRO, isto é, o menu oferecia-as
  //     desabilitadas e nada existia por trás. Uma linha que só serve para dizer «ainda não» é uma linha que
  //     a criança lê e não pode usar.
  {g:'font.group.hand', items:[
    {k:'pinyon',     fam:'Pinyon Script',       fb:'cursive', d:'font.desc.pinyon', papel:'caligrafica', minPx:24},
    {k:'ufmag',      fam:'UnifrakturMaguntia',  fb:'cursive', d:'font.desc.ufmag',  papel:'caligrafica', minPx:20},
    // ⚠️ `comicneue` NÃO é caligráfica, e está neste grupo só por aparência: é uma face de propósito geral,
    // frequentemente recomendada para dislexia. Marcá-la como caligráfica tirá-la-ia do menu — removendo uma
    // opção legitimamente acessível pelo formato do grupo em vez de pelo papel.
    {k:'comicneue',  fam:'Comic Neue',          fb:'cursive', d:'font.desc.comicneue'} ]},
];

/** O papel de uma face; ausente no catálogo quer dizer `geral`. */
export function papelDaFonte(it: FontItem): FontRole { return it.papel ?? 'geral'; }

/** As faces que o MENU pode oferecer: só as gerais (emenda do ADR-0012). */
export const OFERECIVEIS: FontItem[] = FONT_GROUPS.flatMap((g) => g.items).filter((it) => papelDaFonte(it) === 'geral');
export const FONT_BY_KEY: Record<string, FontItem> = {}; FONT_GROUPS.forEach((g) => g.items.forEach((it) => { FONT_BY_KEY[it.k] = it; }));

/** Narrow store shape these need — lets a caller inject a fake without touching real storage. */
export interface FontStore { get(key: string, fallback: string | null): string | null; set(key: string, v: string): void; }

export const FONT_KEY = 'incl_font_k';
export const FONT_KEY_LEGACY = 'incl_fonte'; // pre-Fase-2: 'alfabetizacao' | 'dislexia'

/**
 * A fonte de fábrica, com nome. Atkinson Hyperlegible foi desenhada pelo Braille Institute justamente para
 * quem tem baixa visão — distingue as formas que mais se confundem (I/l/1, O/0). É por isso que ela é o padrão
 * e não uma preferência estética, e é por isso que o "restaurar padrões" da tipografia (ADR-0028) volta para
 * cá: o caminho de volta de um menu de acessibilidade tem que terminar na escolha mais legível, não numa
 * qualquer. Usada em DOIS lugares — o fim da cadeia de boot logo abaixo e o reset do painel —, e uma constante
 * porque duas cópias de um padrão são duas chances de o reset devolver algo que o jogo nunca usou.
 */
export const DEFAULT_FONT_KEY = 'atkinson';

/**
 * Boot choice: validated persisted key (ignores .off fonts) -> legacy-key migration -> DEFAULT_FONT_KEY.
 *
 * ⚠️ E UMA CALIGRÁFICA GUARDADA VOLTA AO PADRÃO (issue #87, 2026-09-07). Antes da emenda do ADR-0012 o menu
 * oferecia as sete caligráficas, então há crianças com `pinyon` ou `ufmag` guardados — e o valor salvo
 * continua a ser escolha delas, que não é nossa para desfazer sem motivo. O motivo existe: a emenda diz que
 * uma caligráfica **não pode ser a face da interface**, e o menu deixou de a oferecer. Deixá-la valer daria
 * uma interface inteira em letra cursiva a quem já não tem como sair dela pelo menu — uma armadilha, e das
 * silenciosas.
 *
 * ⚠️ E UMA CHAVE APAGADA TAMBÉM VOLTA, pelo mesmo caminho: as quatro faces que saíram do roster já não estão
 * no `FONT_BY_KEY`, então quem tinha `greatvibes` guardado cai no padrão em vez de ficar sem face nenhuma.
 */
export function resolveFontKey(s: FontStore): string {
  const k = s.get(FONT_KEY, null);
  if (k && FONT_BY_KEY[k] && !FONT_BY_KEY[k].off && papelDaFonte(FONT_BY_KEY[k]) === 'geral') return k;
  const leg = s.get(FONT_KEY_LEGACY, null);
  if (leg === 'alfabetizacao') return 'andika';
  if (leg === 'dislexia') return 'lexend';
  return DEFAULT_FONT_KEY;
}
export function persistFontKey(s: FontStore, k: string): void { s.set(FONT_KEY, k); }

// Conveniencia sobre o storage real — mesma logica, sem duplicá-la.
export function loadFontKey(): string { return resolveFontKey(store); }
export function saveFontKey(k: string): void { persistFontKey(store, k); }
