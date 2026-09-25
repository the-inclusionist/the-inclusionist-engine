// SPDX-License-Identifier: AGPL-3.0-or-later
// A FONT OFFERED IN THE MENU MUST LOAD — or the menu lies.
//
// ========================= WHY =========================
// If nothing links `vendor/fonts.css`, the whole typography panel is affected: it offers its families, the child picks
// one, the menu marks it active — and the browser draws the system font, because no `@font-face` was loaded. No error
// anywhere. The choice is recorded, persisted and announced; it just does not happen.
//
// ⚠️ IT IS THE SAME SHAPE AS ADR-0094: offering what cannot be delivered. There the neural engine stopped appearing in
// the menu when the port does not exist; here the way out is the reverse — the engine must LINK the sheet, because the
// fonts are its own and travel in the package through the `./assets/vendor/*` port.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_GROUPS, faceFamilies } from '../app/js/ui/fonts.js';

/** The typographic catalogue's active families (ADR-0176): what may be packaged. */
const ATIVAS = new Set(JSON.parse(readFileSync(join(process.cwd(), 'research', 'catalogo_tipografico.json'), 'utf8'))
  .fontes.filter((f) => f.status === 'ativo').map((f) => f.familia));

const RAIZ_REPO = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const ler = (...p) => readFileSync(join(RAIZ_REPO, ...p), 'utf8');

const CSS = ler('app', 'public', 'vendor', 'fonts.css');
/** The families `fonts.css` declares — what the browser actually knows how to draw. */
const DECLARADAS = new Set([...CSS.matchAll(/font-family:\s*['"]?([^;'"]+)/g)].map((m) => m[1].trim()));

/**
 * Every catalogue item, marked with whether it is OFFERABLE (not `.off`), with the families of its stack: a stack loads when
 * ANY of them is declared — the ronde's three are never packaged and it loads through Cookie, the last (ADR-0154).
 */
const ITENS = FONT_GROUPS.flatMap((g) => g.items.map((it) => ({ fam: it.fam, fams: faceFamilies(it), oferecivel: !it.off })));
/** Does any family of this item's stack have an `@font-face`? */
const carrega = (i) => i.fams.some((f) => DECLARADAS.has(f));

/**
 * 🔴 AND THE SHEET MUST BE ABLE TO CHANGE ITS MIND. This file guards that every face offered in the menu loads; the case below
 * guards the other half, a day after the child first opened the game: `vendor/fonts.css` is the INDEX of the families and its
 * name never changes, so marking it `immutable` for a year freezes the list. A family added later appears in the menu (the menu
 * reads the catalogue), the child picks it, and the browser draws the system font — with no error anywhere, the exact shape of
 * the defect `scripts/check-precache.mjs` exists to refuse, one floor up.
 *
 * 📏 Measured on 2026-09-21: the service worker is NOT exposed (Workbox asks for a revisioned entry under
 * `?__WB_REVISION__=…`, a URL the rule never caught). Who is exposed is every client without it — a private window, a browser
 * where the worker does not install, the first load before it installs, and a consumer page that links this sheet and
 * registers no worker at all.
 */
describe('o índice das fontes pode mudar de ideia (issue #73, mesma classe)', () => {
  const CABECALHOS = ler('app', 'public', '_headers');
  /** Each path's rule: `{'/vendor/fonts.css': 'public, no-cache', …}`. */
  const REGRAS = Object.fromEntries([...CABECALHOS.matchAll(/^(\/\S+)\r?\n(?:\s+[^\r\n]+\r?\n)*?\s+Cache-Control:\s*([^\r\n]+)/gm)]
    .map((m) => [m[1], m[2].trim()]));

  it('🎯 [Interface] as regras foram lidas — sem isto o caso abaixo aprovaria um ficheiro vazio', () => {
    expect(Object.keys(REGRAS).length, 'o `_headers` mudou de forma e este crivo deixou de ver as regras').toBeGreaterThan(3);
    expect(REGRAS['/assets/*'], 'os bundles com hash no nome perderam o ano').toContain('immutable');
  });

  it('🔴 [Right] o índice revalida, e as fontes em si continuam imutáveis', () => {
    expect(REGRAS['/vendor/fonts.css'], 'o índice das fontes não tem regra própria').toBeTruthy();
    expect(REGRAS['/vendor/fonts.css'], 'o índice ficou congelado por um ano').not.toContain('immutable');
    expect(REGRAS['/vendor/fonts.css']).toContain('no-cache');
    expect(REGRAS['/vendor/fonts/*'], 'as 346 woff2 perderam o ano, e essas o nome identifica').toContain('immutable');
  });

  it('🔴 [Zero] nenhuma regra apanha a folha E as fontes ao mesmo tempo', () => {
    // ⚠️ A `/vendor/*` beside a narrower rule would make the answer depend on which one Cloudflare applies first — which is
    // not written here and cannot be measured from this repository. Two patterns that do not overlap have no such question.
    expect(REGRAS['/vendor/*'], 'o padrão largo voltou, e com ele a dúvida sobre a precedência').toBeUndefined();
  });
});

describe('uma fonte oferecida no menu carrega de verdade (ADR-0012)', () => {
  it('[Interface] o catálogo e a folha existem e têm tamanho de gente', () => {
    // ⚠️ This floor does not measure quality — it measures that the import resolved and the sheet was read. An empty
    // catalogue or an unreadable sheet give ZERO, and that is what it catches; the real guards are the cases below.
    expect(ITENS.length).toBeGreaterThanOrEqual(12);
    expect(DECLARADAS.size).toBeGreaterThanOrEqual(12);
  });

  it('🔴 [Zero] NENHUMA face declarada fica ÓRFÃ — o sentido que faltava a este crivo', () => {
    /*
     * 📏 The chain is guarded in three directions: a catalogue entry with no `@font-face` fails; an `@font-face` whose woff2
     * does not exist fails; and here, **an `@font-face` with no catalogue entry** fails (it passed GREEN until 2026-09-12).
     *
     * 🔴 That is an ORPHAN face: bytes that enter the precache and that no menu can offer. Nobody picks it and every school
     * downloads it.
     *
     * ⚠️ THE EXCEPTION LIST IS NAMED AND MUST SAY WHY, or it becomes the door the next orphan walks through. They are the
     * faces reached by a CSS VARIABLE instead of chosen in a menu — and, measured, there is ONE.
     */
    const ALCANCADAS_POR_VARIAVEL = Object.freeze({
      // `--font-math` in `app/css/style.css`: the maths digits. It is not a typography choice — it is the face the
      // engine imposes where the digit's shape is the subject matter (ADR-0010, pillar 5).
      'Atkinson Hyperlegible Mono': '--font-math (matemática)',
    });
    // Since the ADR-0176 erratum («Engine empacota tudo por enquanto») a declared face is orphan when the typographic
    // catalogue does not hold it as `ativo` — the catalogue, not the reading menu, says what exists; layer B faces are
    // packaged for ornament and never offered in the reading menu (R1).
    const orfas = [...DECLARADAS].filter((f) => !ATIVAS.has(f) && !(f in ALCANCADAS_POR_VARIAVEL));
    expect(orfas, 'a declared face the typographic catalogue does not hold as active: bytes in the precache nobody can use').toEqual([]);
    expect(ATIVAS.size, 'the catalogue was not read — the case would measure nothing').toBeGreaterThan(100);

    // 📌 THE PAIR, without which the exception list would be the open door: each exception must REALLY be declared. An
    // entry that outlives the file that justified it starts authorising an orphan for free.
    for (const fam of Object.keys(ALCANCADAS_POR_VARIAVEL)) {
      expect(DECLARADAS.has(fam), `a excepção «${fam}» já não existe no fonts.css — tire-a da lista`).toBe(true);
    }
  });

  it('⚠️ [Zero] NENHUMA fonte oferecível fica sem `@font-face`', () => {
    const fantasmas = ITENS.filter((i) => i.oferecivel && !carrega(i)).map((i) => i.fam);
    expect(fantasmas, 'a criança escolhe e o navegador desenha outra coisa, sem erro nenhum').toEqual([]);
  });

  it('⚠️ [Boundary] o crivo só EXIGE face de quem é oferecível — e isso vale sem haver nenhuma desligada', () => {
    // ⚠️ The case measures the RULE with a planted phantom instead of counting instances in the catalogue: a disabled
    // face does not enter the phantom check. A case that needs the catalogue to hold an example of its subject fails when
    // the roster changes, which is the opposite of guarding the roster.
    const fantasma = { fam: 'Fonte Sem Ficheiro', fams: ['Fonte Sem Ficheiro'], oferecivel: false };
    const acusadas = [...ITENS, fantasma].filter((i) => i.oferecivel && !carrega(i)).map((i) => i.fam);
    expect(acusadas, 'uma face DESLIGADA foi cobrada por não ter `@font-face`').toEqual([]);
  });

  it('[Interface] a folha PODE declarar mais do que o menu oferece', () => {
    // `Atkinson Hyperlegible Mono` is in the sheet and not in the menu, and ADR-0012 says why: it is the canonical face of
    // MATHS — «it is a font and it is not a choice». A face with no menu row is legitimate; a menu row with no face is not.
    const soNaFolha = [...DECLARADAS].filter((f) => !ITENS.some((i) => i.fams.includes(f)));
    expect(soNaFolha.length).toBeGreaterThanOrEqual(0);
  });

  it('⚠️ [Right] e o HOST da engine LIGA a folha — senão nada disto chega ao ecrã', () => {
    // Without this line the gate above stays green over a menu that paints nothing: the catalogue agrees with a sheet
    // nobody loaded.
    const host = ler('app', 'quiz.html');
    expect(host, '`vendor/fonts.css` não é carregado pelo único host da engine').toMatch(/vendor\/fonts\.css/);
  });

  it('[Interface] e o pacote entrega a folha ao consumidor', () => {
    // `files` carries `app/public/vendor` and `exports` publishes the assets port. If either falls, the consumer links a
    // path that gives 404 — and the `engine-package` gate does not see it, because it looks at code imports.
    //
    // ⚠️ The port is `./assets/vendor/*` (#119), which promises exactly what travels; a wide `./assets/*` would match all of
    // `app/public/` while `files` ships only `vendor/`. The path the consumer writes, `assets/vendor/fonts.css`, matches
    // either.
    const pkg = JSON.parse(ler('package.json'));
    expect(pkg.files).toContain('app/public/vendor');
    expect(Object.keys(pkg.exports)).toContain('./assets/vendor/*');
    // And the wide port does NOT come back: it promised a folder `files` does not carry.
    expect(Object.keys(pkg.exports), 'a porta larga voltou; ver a #119').not.toContain('./assets/*');
  });
});
