// SPDX-License-Identifier: GPL-3.0-or-later
// i18n — internacionalização (ver docs/plano-i18n.md).
// O idioma padrão (pt) é import ESTÁTICO → dicionário pronto antes do game.js rodar (boot síncrono, sem
// refatorar o init para async). Os demais entram sob demanda ao trocar de idioma, via import.meta.glob (o
// Vite gera um chunk por locale e o SW cacheia). import.meta.glob (em vez de import(`…${code}.ts`) cru) é o
// jeito nativo do Vite: casa arquivos .ts no build de forma explícita, sem depender do glob "adivinhado".
import pt from '../i18n/pt.js';
import * as store from '../platform/storage.js';

type LocaleDict = Record<string, string>;

const AVAILABLE = ['pt', 'en', 'es'];
const base: LocaleDict = pt;                // dicionário-base (fallback), tipado
const DICTS: Record<string, LocaleDict> = { pt: base }; // dicionários já carregados (pt embutido)
const STORE_KEY = store.KEYS.lang;

// carregadores preguiçosos por locale (chaves: '../i18n/en.ts', '../i18n/es.ts', '../i18n/pt.ts'); pt já é estático.
const loaders = import.meta.glob<{ default: LocaleDict }>('../i18n/*.ts');

let locale = 'pt';
let dict: LocaleDict = base;

// Traduz uma chave; fallback em cadeia: locale → pt → a própria chave. Interpola {param}.
export function t(key: string, params?: Record<string, string | number>): string {
  let s = key in dict ? dict[key] : (key in base ? base[key] : key);
  if (params) for (const k in params) s = s.replaceAll('{' + k + '}', String(params[k]));
  return s;
}

export function getLocale(): string { return locale; }
export function availableLocales(): string[] { return AVAILABLE.slice(); }

// Aplica as traduções declarativas do HTML: [data-i18n] → textContent; [data-i18n-aria] → aria-label.
export function applyDom(root: ParentNode = document): void {
  root.querySelectorAll('[data-i18n]').forEach((el) => { const k = el.getAttribute('data-i18n'); if (k) el.textContent = t(k); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { const k = el.getAttribute('data-i18n-aria'); if (k) el.setAttribute('aria-label', t(k)); });
}

async function ensure(code: string): Promise<LocaleDict> {
  if (DICTS[code]) return DICTS[code];
  const load = loaders[`../i18n/${code}.ts`];
  if (!load) return base; // idioma sem arquivo → cai no pt
  const mod = await load();
  DICTS[code] = mod.default;
  return DICTS[code];
}

// Troca o idioma (carrega sob demanda), persiste, atualiza <html lang>, reaplica o DOM e avisa a UI.
export async function setLocale(code: string): Promise<void> {
  if (!AVAILABLE.includes(code)) code = 'pt';
  dict = await ensure(code);
  locale = code;
  store.set(STORE_KEY, code);
  document.documentElement.lang = (code === 'pt') ? 'pt-BR' : code;
  applyDom(document);
  window.dispatchEvent(new CustomEvent('i18n:change', { detail: { locale } }));
}

function pickDefault(): string {
  const saved = store.get(STORE_KEY, null);
  if (saved && AVAILABLE.includes(saved)) return saved;
  const nav = ((navigator.language || 'pt').slice(0, 2)).toLowerCase();
  return AVAILABLE.includes(nav) ? nav : 'pt';
}

// Boot: aplica pt (síncrono) e, se o idioma preferido for outro, troca de forma assíncrona (não bloqueia).
export function initI18n(): string {
  applyDom(document);
  const def = pickDefault();
  if (def !== 'pt') setLocale(def);
  return locale;
}

const i18n = { t, getLocale, availableLocales, applyDom, setLocale, initI18n };
export default i18n;
if (typeof window !== 'undefined') (window as Window & { __i18n?: unknown }).__i18n = i18n; // exposto p/ teste/preview
