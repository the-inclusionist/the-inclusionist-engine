// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/fonts.ts — catálogo de fontes (dados) + índice por chave + carga/persistência da escolha. Módulo-folha
// (só depende de storage). A instância `fontKey` e o setGameFont (aplica família/espaçamento) ficam no game.js.
import * as store from '../platform/storage.js';

/**
 * Uma fonte do catálogo. `fam` é o NOME DA FONTE — nome próprio, nunca traduzido. `d` guarda CHAVE i18n da
 * descrição, não o texto: mesma decisão de `VIZ_MODES` e `RM_LABEL`, e pelo mesmo motivo — uma tabela de
 * `const` com texto resolve uma vez, no import, e fica congelada no idioma do boot.
 */
export type FontItem = { k: string; fam: string; fb: string; d?: string; off?: string };
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
  {g:'font.group.hand', items:[
    {k:'greatvibes', fam:'Great Vibes',         fb:'cursive', d:'font.desc.greatvibes'},
    {k:'pinyon',     fam:'Pinyon Script',       fb:'cursive', d:'font.desc.pinyon'},
    {k:'ufcook',     fam:'UnifrakturCook',      fb:'cursive', d:'font.desc.ufcook'},
    {k:'ufmag',      fam:'UnifrakturMaguntia',  fb:'cursive', d:'font.desc.ufmag'},
    {k:'comicneue',  fam:'Comic Neue',          fb:'cursive', d:'font.desc.comicneue'},
    {k:'learningcurve', fam:'Learning Curve',   fb:'cursive', d:'font.desc.learningcurve', off:'font.off.pending'},
    {k:'kindergarten',  fam:'Kindergarten Pro', fb:'cursive', d:'font.desc.kindergarten', off:'font.off.negotiating'} ]},
];
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

/** Boot choice: validated persisted key (ignores .off fonts) -> legacy-key migration -> DEFAULT_FONT_KEY. */
export function resolveFontKey(s: FontStore): string {
  const k = s.get(FONT_KEY, null);
  if (k && FONT_BY_KEY[k] && !FONT_BY_KEY[k].off) return k;
  const leg = s.get(FONT_KEY_LEGACY, null);
  if (leg === 'alfabetizacao') return 'andika';
  if (leg === 'dislexia') return 'lexend';
  return DEFAULT_FONT_KEY;
}
export function persistFontKey(s: FontStore, k: string): void { s.set(FONT_KEY, k); }

// Conveniencia sobre o storage real — mesma logica, sem duplicá-la.
export function loadFontKey(): string { return resolveFontKey(store); }
export function saveFontKey(k: string): void { persistFontKey(store, k); }
