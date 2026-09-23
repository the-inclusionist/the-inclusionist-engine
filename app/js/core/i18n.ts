// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n — internacionalização (ver docs/plano-i18n.md).
// O idioma padrão (pt) é import ESTÁTICO → dicionário pronto antes do game.js rodar (boot síncrono, sem
// refatorar o init para async). Os demais entram sob demanda ao trocar de idioma, via import.meta.glob (o
// Vite gera um chunk por locale e o SW cacheia). import.meta.glob (em vez de import(`…${code}.ts`) cru) é o
// jeito nativo do Vite: casa arquivos .ts no build de forma explícita, sem depender do glob "adivinhado".
import pt from '../i18n/pt.js';

type LocaleDict = Record<string, string>;

const AVAILABLE = ['pt', 'en', 'es'];
const base: LocaleDict = pt;                // dicionário-base (fallback), tipado
const DICTS: Record<string, LocaleDict> = { pt: base }; // dicionários já carregados (pt embutido)
/**
 * The port the chosen language is kept through (ADR-0178): `platform/storage` has this shape.
 *
 * 🔴 AND IT CARRIES THE BROWSER TOO, since 2026-09-22 (ADR-0221 step 7g). This module used to write
 * `document.documentElement.lang`, dispatch on `window` and read `navigator.language` — three reaches into globals from
 * `core`, the layer ADR-0173 defines as «what the engine IS, without a browser». The health ratchet measured them (step 7d)
 * and the Dev chose to split rather than to move the module: the decisions stay here, the page effects arrive as two
 * optional hooks that `platform/locale-host` builds and the composition root passes in.
 *
 * ⚠️ Both are OPTIONAL, and absent they mean «no page to tell»: a node test, a worker, a second engine in the same process.
 * Before this split those three lines threw there instead.
 */
export interface LocalePort {
  get(key: string, fallback: string | null): string | null;
  set(key: string, value: string): unknown;
  readonly KEYS: { readonly lang: string };
  /** What the HOST does once a language is kept: `<html lang>`, re-translating the markup, telling the page. */
  readonly applied?: (locale: string, tag: string) => void;
  /** The language the host prefers when nothing is stored (the browser's `navigator.language`). */
  readonly preferred?: () => string | null;
}
let localePort: LocalePort | null = null;
/** Gives this module the port for the chosen language; the composition root calls it before `initI18n`. */
export function loadLocale(p: LocalePort): void { localePort = p; }

/* ===================== O DICIONÁRIO DE QUEM CONSOME A ENGINE =====================
 *
 * O achado 2 do `consumer-quiz` dizia que os dicionários são do jogo de plataforma e que um segundo jogo
 * herda 253 chaves para usar um punhado — "peso morto no pacote". Estava certo para um consumidor que mora
 * DENTRO deste repositório, porque as chaves dele cabem em `../i18n/pt.ts`.
 *
 * ⚠️ DE FORA, O MESMO ACHADO DEIXA DE SER PESO E VIRA PAREDE. Os locales entram pelo `import.meta.glob` logo
 * abaixo, e esse glob é resolvido NO BUILD DESTA ENGINE, contra ESTA pasta. Um jogo que instala
 * `@the-inclusionist/engine` não tem como pôr arquivo lá dentro, e `DICTS` é privado. Sem esta camada ele
 * fica sem NENHUM caminho para as próprias chaves — e o pilar 3 não abre exceção para consumidor.
 *
 * CAMADA SEPARADA, e não `DICTS[code] = {...DICTS[code], ...extra}`: `DICTS.pt` É o objeto importado de
 * `../i18n/pt.ts`. Mesclar ali mutaria o dicionário da própria engine, e dois jogos na mesma página herdariam
 * as strings um do outro. `tests/i18n-consumer-dict.node.test.js` prende exatamente isso.
 */
const EXTRA: Record<string, LocaleDict> = {};

/**
 * Registra as chaves DESTE jogo para um idioma. Chamável antes de o idioma existir — quem registra `en` antes
 * de qualquer `setLocale('en')` é atendido quando a troca acontecer.
 *
 * ⚠️ NÃO REAPLICA O DOM, de propósito. `applyDom` precisa de uma RAIZ, e alcançar o `document` global por
 * baixo de quem chama é o achado 15, que já custou uma correção. Um consumidor que registre depois de o
 * markup estático ter sido traduzido chama `applyDom(raiz)` ele mesmo — e o caso normal é registrar no boot,
 * antes de existir texto na tela.
 */
export function registerDict(code: string, entries: LocaleDict): string[] {
  const refused: string[] = [];
  const accepted: LocaleDict = {};
  for (const chave in entries) {
    if (hasMarkup(entries[chave])) refused.push(chave);
    else accepted[chave] = entries[chave]!;
  }
  if (refused.length) {
    // Alto, e não em silêncio: quem escreveu a string tem de saber que ela não entrou. Descartar calado
    // faria a chave crua aparecer na tela sem nada explicando, e isso lê-se como defeito da engine.
    try {
      console.error('[inclusionist] i18n: chaves recusadas por conterem marcação — ' + refused.join(', '));
    } catch { /* noop */ }
  }
  EXTRA[code] = { ...EXTRA[code], ...accepted };
  return refused;
}

/**
 * THE KEYS A CARTRIDGE REGISTERED IN ONE OF THE THREE LANGUAGES AND NOT IN ANOTHER (study item E4; ADR-0010 pillar 3),
 * one line per missing language, for `problems`. 📏 Measured: the games that register a dictionary do it in pt, en and es,
 * and nothing checked it — a key forgotten in one language shows Portuguese there, and nobody is told.
 * A cartridge that registered nothing is not accused: strings it never gave the engine, the engine cannot see.
 */
export function dictionaryGaps(): string[] {
  const registered = new Set<string>();
  for (const code of AVAILABLE) for (const chave in EXTRA[code] ?? {}) registered.add(chave);
  if (!registered.size) return [];
  const SHOW = 5;
  const linhas: string[] = [];
  for (const code of AVAILABLE) {
    const faltam = [...registered].filter((chave) => !(chave in (EXTRA[code] ?? {})));
    if (!faltam.length) continue;
    const resto = faltam.length > SHOW ? ` (and ${faltam.length - SHOW} more)` : '';
    linhas.push(`the cartridge's dictionary lacks ${code} for ${faltam.slice(0, SHOW).join(', ')}${resto}: `
      + `a child playing in ${code} reads the fallback there (registerDict)`);
  }
  return linhas;
}

/**
 * A string traz marcação?
 *
 * ⚠️ POR QUE ISTO EXISTE AQUI, E NÃO NOS ~15 SINKS QUE CONSOMEM i18n. O gate
 * `tests/i18n-without-markup.node.test.js` varre os dicionários DESTA árvore e prova que nenhuma entrada tem
 * tag. Ele não alcança — e não tem como alcançar — o `EXTRA`: são strings que um JOGO regista em tempo de
 * execução, de outro repositório (ADR-0083), e um teste desta árvore não as vê.
 *
 * ⚠️ E ELAS GANHAM DO DICIONÁRIO DA ENGINE. `resolver` consulta `EXTRA` primeiro, então um jogo pode sobrepor
 * QUALQUER chave — inclusive as que a engine cola em markup. Sem este cheque, «i18n» tinha deixado de
 * significar «texto que alguém desta árvore reviu», e nada registava a mudança.
 *
 * A verificação vai na FRONTEIRA e não nos sinks porque a fronteira é UMA: toda string de um jogo passa por
 * aqui. Quinze sinks seriam quinze lugares para esquecer, e o esquecimento não deixa rasto.
 *
 * O crivo é deliberadamente grosseiro — `<` seguido de letra ou de barra, e `&` de entidade. Ele recusa
 * `a < b` escrito com espaço? Não: `< ` não casa. Recusa «5<10»? Não, o dígito não casa. O que ele recusa é
 * o que se parece com uma tag, e uma frase de interface que precise disso precisa de outra frase.
 */
function hasMarkup(valor: string | undefined): boolean {
  return typeof valor === 'string' && (/<[a-zA-Z/!?]/.test(valor) || /&[a-zA-Z#][a-zA-Z0-9]*;/.test(valor));
}

/**
 * A cadeia de resolução, em cinco degraus. Ela ESPELHA a que já existia (`locale → pt → a própria chave`),
 * com o consumidor colado a cada degrau em vez de empilhado por cima:
 *
 *   1. consumidor no idioma corrente · 2. engine no idioma corrente ·
 *   3. consumidor em pt · 4. engine em pt · 5. a própria chave
 *
 * O degrau 3 é o que faz um jogo que só escreveu pt seguir LEGÍVEL quando a criança troca para inglês: ela lê
 * português, exatamente como já lê hoje quando falta chave na engine. Degradar é melhor que calar, e é a
 * mesma escolha que o `.catch` mudo do `initI18n` já faz para o chunk que não carrega.
 *
 * O degrau 2 vir ANTES do 3 é a única ordem defensável: idioma certo da engine vale mais que idioma errado do
 * consumidor. A inversão daria "Potência de 2" numa interface em espanhol que tinha a tradução na mão.
 */
function resolveKey(key: string): string {
  const fromGame = EXTRA[locale];
  if (fromGame && key in fromGame) return fromGame[key];
  if (key in dict) return dict[key];
  const fromGameInPt = EXTRA.pt;
  if (fromGameInPt && key in fromGameInPt) return fromGameInPt[key];
  return key in base ? base[key] : key;
}

/* ===================== OS CARREGADORES, E POR QUE DEIXARAM DE SER UM GLOB =====================
 *
 * Isto era `import.meta.glob<{default: LocaleDict}>('../i18n/*.ts')`, e a razão escrita no topo do arquivo
 * continua verdadeira para este repositório: o Vite gera um chunk por locale e o service worker o cacheia.
 *
 * ⚠️ O QUE MUDOU FOI O DESTINO DO ARQUIVO, NÃO O ARGUMENTO. Medido em 2026-09-05 no primeiro build de
 * pacote (`tsc -p tsconfig.pkg.json`): a linha SOBREVIVE ao emit, intacta, em `dist-pkg/core/i18n.js` —
 * e ali ela é falsa em dois níveis ao mesmo tempo.
 *   · O `tsc` não é o Vite: ele copia `import.meta.glob(...)` como chamada comum. Num consumidor que não
 *     transforme o módulo, `import.meta.glob` é `undefined` e a chamada estoura no carregamento.
 *   · E mesmo transformado, o padrão diz `*.ts` — ao lado do arquivo EMITIDO só existem `.js`. O glob casaria
 *     zero arquivos, `ensure()` cairia no `return base`, e todo idioma que não fosse pt viraria português
 *     SEM ERRO NENHUM. É o modo de falhar que este projeto já pagou uma vez, quando uma regex morreu em
 *     silêncio com a checagem verde.
 *
 * ENUMERADO, ENTÃO — e o preço é MENOR do que eu escrevi antes de medir. O glob varria três arquivos que a
 * constante `AVAILABLE` logo acima JÁ ENUMERA, então não havia descoberta nenhuma a preservar.
 *
 * ⚠️ E O CODE-SPLITTING NÃO SE PERDE, o que eu tinha suposto que se perderia. O que o Vite divide é o
 * `import()` DINÂMICO, e ele continua aqui — a primeira versão deste comentário dizia que o custo eram
 * "~63 KB de parse a mais", e o build de 2026-09-05 mostrou o contrário na saída: `dist/assets/en-*.js`
 * (24,8 KB) e `dist/assets/es-*.js` (26,7 KB) seguem como chunks próprios, exatamente como com o glob. Quem
 * fica em pt nunca os avalia. O custo real é UM: três linhas a manter à mão no dia em que entrar um quarto
 * idioma — e `AVAILABLE` já era essa lista, então é o mesmo dia e o mesmo arquivo. */
const loaders: Record<string, () => Promise<{ default: LocaleDict }>> = {
  en: () => import('../i18n/en.js'),
  es: () => import('../i18n/es.js'),
};

let locale = 'pt';
let dict: LocaleDict = base;

// Traduz uma chave; a cadeia de fallback está em `resolver()` logo acima. Interpola {param}.
export function t(key: string, params?: Record<string, string | number>): string {
  let s = resolveKey(key);
  if (params) for (const k in params) s = s.replaceAll('{' + k + '}', String(params[k]));
  return s;
}

export function getLocale(): string { return locale; }

/**
 * THE BCP-47 TAG OF THE CURRENT LANGUAGE — what `<html lang>` says and what the browser's speech and recognition are given.
 *
 * Each language carries the REGION its flag stands for (the Dev, 2026-09-16: «Brasil, Estados Unidos e México. Cada bandeira indica a
 * localização para qual o app está configurado»): pt-BR, en-US, es-MX. It was pt-BR with `en` and `es` bare, so the browser picked the
 * variant; the language button now states the place. Voices are still matched on the language alone (`voicesForLocale`), so a region
 * narrows nothing a child can hear.
 */
const REGION_OF: Readonly<Record<string, string>> = { pt: 'pt-BR', en: 'en-US', es: 'es-MX' };
export function bcp47(code: string = locale): string { return REGION_OF[code] ?? code; }
function availableLocales(): string[] { return AVAILABLE.slice(); }

// Aplica as traduções declarativas do HTML: [data-i18n] → textContent; [data-i18n-aria] → aria-label.
export function applyDom(root: ParentNode): void {
  root.querySelectorAll('[data-i18n]').forEach((el) => { const k = el.getAttribute('data-i18n'); if (k) el.textContent = t(k); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { const k = el.getAttribute('data-i18n-aria'); if (k) el.setAttribute('aria-label', t(k)); });
}

async function ensure(code: string): Promise<LocaleDict> {
  if (DICTS[code]) return DICTS[code];
  const load = loaders[code];
  if (!load) return base; // idioma sem arquivo → cai no pt
  const mod = await load();
  DICTS[code] = mod.default;
  return DICTS[code];
}

// Troca o idioma (carrega sob demanda), persiste, atualiza <html lang>, reaplica o DOM e avisa a UI.
export async function setLocale(code: string): Promise<void> {
  // first, before anything changes: a language switched and then refused would leave the page half moved (ADR-0178)
  const port = localePort;
  if (!port) throw new Error('core/i18n: setLocale kept a language before loadLocale — the composition root loads the stored settings first (ADR-0178)');
  if (!AVAILABLE.includes(code)) code = 'pt';
  dict = await ensure(code);
  locale = code;
  port.set(port.KEYS.lang, code);
  // 📌 The three page effects — `<html lang>`, re-translating the markup, telling the page — in ONE call to the host, which
  // is what keeps this module free of `document` and `window` (ADR-0173, ADR-0221 step 7g).
  port.applied?.(locale, bcp47(code));
}

function pickDefault(): string {
  const saved = localePort ? localePort.get(localePort.KEYS.lang, null) : null;
  if (saved && AVAILABLE.includes(saved)) return saved;
  const nav = ((localePort?.preferred?.() || 'pt').slice(0, 2)).toLowerCase();
  return AVAILABLE.includes(nav) ? nav : 'pt';
}

/** Promessa do carregamento pedido no boot. Resolve na hora quando o idioma é pt (dicionário estático). */
let pending: Promise<void> = Promise.resolve();

/**
 * Boot: aplica pt (síncrono, para a página nunca ficar em branco) e, se o idioma preferido for outro, PEDE a
 * troca — que é assíncrona, porque os outros locales são chunks sob demanda.
 *
 * Continua devolvendo o locale de forma síncrona e NÃO bloqueia por si: quem precisar esperar chama
 * `localeReady()`. Foi essa separação que faltava — ver o comentário lá embaixo.
 *
 * `root` ENTRA em vez de ser lido do global, e foi o `boot/createGame()` que cobrou (item 13): a raiz de
 * composição recebe o documento do hospedeiro por injeção e não tinha como repassá-lo — esta linha alcançava
 * o `document` global por baixo dela. Num navegador dá no mesmo; no project `node` é a diferença entre
 * bootar contra um DOM de mentira e não bootar. O padrão continua sendo o global, então nenhum chamador
 * muda: é a mesma regra do `applyDom` logo acima.
 */
export function initI18n(root: ParentNode): string {
  applyDom(root);
  const def = pickDefault();
  // `.catch` mudo de propósito: um chunk de locale que não carrega degrada para pt, e degradar é MUITO melhor
  // que travar o boot. Sem ele, um `await localeReady()` lá fora derrubaria o jogo inteiro por causa do idioma.
  if (def !== 'pt') pending = setLocale(def).catch(() => { /* fica em pt */ });
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
export function localeReady(): Promise<void> { return pending; }

const i18n = { t, getLocale, availableLocales, applyDom, setLocale, initI18n, localeReady, registerDict };
export default i18n;
// 🔴 A EXPOSIÇÃO EM `window.__i18n` SAIU DAQUI (ADR-0221 passo 7g): ela era o quarto alcance a um global neste módulo, e
// pendurar-se numa janela é trabalho de quem TEM uma. Quem o faz agora é `platform/locale-host.exposeI18n`, que a raiz
// chama — o objecto exposto é exactamente este `default`.
