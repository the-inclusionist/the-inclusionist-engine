// SPDX-License-Identifier: AGPL-3.0-or-later
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

/**
 * A etiqueta BCP-47 do idioma corrente — o que se escreve em `<html lang>` e o que se entrega a APIs do
 * navegador que falam (Web Speech) ou comparam idioma.
 *
 * Só o português precisa de região: 'pt' sozinho deixaria o navegador escolher entre pt-PT e pt-BR, e a
 * diferença de prosódia é audível para uma criança brasileira. Inglês e espanhol ficam sem região de
 * propósito — o navegador escolhe a variante local, que é o certo, e fixar 'en-US' imporia sotaque americano
 * a quem estivesse na Índia ou na Nigéria.
 *
 * `setLocale` calculava isto em linha, ao escrever `<html lang>`. Agora os dois leem daqui: uma regra, dois
 * consumidores — que é exatamente a forma que este projeto já viu divergir quatro vezes.
 */
export function bcp47(code: string = locale): string { return code === 'pt' ? 'pt-BR' : code; }
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
  document.documentElement.lang = bcp47(code);
  applyDom(document);
  window.dispatchEvent(new CustomEvent('i18n:change', { detail: { locale } }));
}

function pickDefault(): string {
  const saved = store.get(STORE_KEY, null);
  if (saved && AVAILABLE.includes(saved)) return saved;
  const nav = ((navigator.language || 'pt').slice(0, 2)).toLowerCase();
  return AVAILABLE.includes(nav) ? nav : 'pt';
}

/** Promessa do carregamento pedido no boot. Resolve na hora quando o idioma é pt (dicionário estático). */
let pendente: Promise<void> = Promise.resolve();

/**
 * Boot: aplica pt (síncrono, para a página nunca ficar em branco) e, se o idioma preferido for outro, PEDE a
 * troca — que é assíncrona, porque os outros locales são chunks sob demanda.
 *
 * Continua devolvendo o locale de forma síncrona e NÃO bloqueia por si: quem precisar esperar chama
 * `idiomaPronto()`. Foi essa separação que faltava — ver o comentário lá embaixo.
 *
 * `root` ENTRA em vez de ser lido do global, e foi o `boot/createGame()` que cobrou (item 13): a raiz de
 * composição recebe o documento do hospedeiro por injeção e não tinha como repassá-lo — esta linha alcançava
 * o `document` global por baixo dela. Num navegador dá no mesmo; no project `node` é a diferença entre
 * bootar contra um DOM de mentira e não bootar. O padrão continua sendo o global, então nenhum chamador
 * muda: é a mesma regra do `applyDom` logo acima.
 */
export function initI18n(root: ParentNode = document): string {
  applyDom(root);
  const def = pickDefault();
  // `.catch` mudo de propósito: um chunk de locale que não carrega degrada para pt, e degradar é MUITO melhor
  // que travar o boot. Sem ele, um `await idiomaPronto()` lá fora derrubaria o jogo inteiro por causa do idioma.
  if (def !== 'pt') pendente = setLocale(def).catch(() => { /* fica em pt */ });
  return locale;
}

/**
 * Resolve quando o idioma escolhido no boot terminou de carregar (na hora, se for pt).
 *
 * ========================= POR QUE ISTO PRECISOU EXISTIR =========================
 * O `initI18n()` do main.js era a ÚLTIMA linha do boot, depois de o HUD, os menus de título e as telas de
 * pausa já estarem montados. Para pt isso não custava nada — já estava tudo em português. Para en/es, custava
 * metade da interface: o `applyDom` conserta o markup ESTÁTICO (`data-i18n`), mas o que o JavaScript monta
 * (os botões de cenário, os de atividade) tinha capturado o texto de pt e ninguém reconstruía.
 *
 * O sintoma era desconcertante: `t('cen.cidade')` devolvia "City" e o botão na tela dizia "Cidade".
 *
 * Isto NÃO responde à pergunta maior — QUANDO a interface se reconstrói ao trocar de idioma EM EXECUÇÃO —,
 * que segue com o Dev. Responde à menor, que não tem duas respostas: a interface não se constrói antes de o
 * idioma ser conhecido.
 */
export function idiomaPronto(): Promise<void> { return pendente; }

const i18n = { t, getLocale, availableLocales, applyDom, setLocale, initI18n, idiomaPronto };
export default i18n;
if (typeof window !== 'undefined') (window as Window & { __i18n?: unknown }).__i18n = i18n; // exposto p/ teste/preview
