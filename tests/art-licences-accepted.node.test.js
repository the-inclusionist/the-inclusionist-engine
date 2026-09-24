// SPDX-License-Identifier: AGPL-3.0-or-later
// THE THREE DOORS ART COMES IN BY — the gates ADR-0133 §confirmation left as debt (#140).
//
// ========================= WHAT THIS FILE ASSERTS, AND WHY IT CHANGED TWICE =========================
// It asserted first that a WALL held, then that every licence was on a CLOSED LIST of four names. Both versions erred the
// same way, and the Dev caught them with the same kind of case: **they refused because a name was not on the list**, not
// because the project could not use the work.
//
// 🎯 ADR-0133 decides by COMPATIBILITY WITH THE PROJECT, in four questions — may we derive? may we use it commercially?
// may we CONVEY the file in what we publish? does anything TRAVEL from the source to the output? — and three doors: the
// author's GRANT, the LICENCE that passes the four, and the BRIDGE, through which copyleft comes in converted to
// `GPL-3.0-only` (the Creative Commons compatibility declaration of 2015-10-08 + §13 of the GPLv3, which allows combining
// a GPLv3 work with an AGPLv3 work in a single work).
//
// ⚠️ AND THAT CHANGES WHAT A GATE CAN ASSERT, which is this file's subject. No machine answers whether a licence allows
// commercial use — it is not a text comparison. What a machine can assert is that **someone wrote the answer**, that the
// row declares WHICH DOOR it came in by, and that what that door demands is there. A new name is not refused: it is
// REFERRED, and the row fails until a record says the four questions were answered for it. That is the difference
// between a list and a stranglehold.
//
// ========================= WHAT THIS FILE CANNOT ASSERT, SAID UP FRONT =========================
// 🔴 IT CHECKS THE ROW, NOT THE GRANT AT THE SOURCE. ADR-0133 asks for more: that the declared licence be checked against
// the source page, because a downstream declaration is a clue and not an authority — `ElizaWy/LPC` declares everything
// CC BY 3.0 or OGA-BY 3.0 while one of the pages it cites grants only CC-BY-SA 3.0 and GPL 3.0. That half NEEDS A NETWORK
// and stays in #140.
//
// ⚠️ AND THE LEDGER IS EMPTY. No resource has come in yet. A check over an empty tree passes for having nothing to
// examine, so the rules live in PURE functions that fixtures drive, and the vacuum case comes FIRST.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));

/** The imported art's tree. It is no longer a quarantine: it is just where outside art lives. */
const ARTE = 'art/';
/** The per-resource ledger. Attribution is a condition of use at most doors, not a credits line. */
const LIVRO = 'art/ATTRIBUTION.csv';
/** The tree's own two files, which are not resources and so do not declare themselves. */
const NAO_SAO_RECURSO = new Set(['art/README.md', LIVRO]);

/**
 * The licences the project has ALREADY MEASURED and recorded as passing the four questions.
 *
 * 📌 This is not the rule — the rule is the four questions, and it lives in ADR-0133. This is the memory of the answers
 * already given, which is what a machine can check. Adding a line here declares that the four were answered for that
 * name, and the place where the answer lives is the record.
 */
const MEDIDAS_COMO_PASSANDO = Object.freeze([
  'CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0', 'OGA-BY-3.0', 'OGA-BY-4.0', 'MIT', 'Apache-2.0',
]);

/**
 * 🔴 NO WAY IN, BY ANY DOOR — and there are only two, since the bridge exists.
 *
 * The refusal is named instead of being whatever is not on the list above for a reason of MESSAGE: the difference between
 * a typo (`cc-by-3.0` in lower case) and a forbidden licence is the most important thing this row can tell whoever reads
 * it.
 */
const SEM_PORTA = Object.freeze([
  { padrao: /(^|[-\s])ND([-\s]|$)|NoDeriv/i, porque: 'ND proíbe derivar, e recolorir já é derivar' },
  { padrao: /(^|[-\s])NC([-\s]|$)|NonCommercial/i, porque: 'NC deixaria a arte mais estreita que o código AGPL' },
]);

/** ADR-0133's three doors. The row declares its own, and each demands something different. */
const PORTAS = Object.freeze(['concessao', 'licenca', 'ponte']);

/**
 * 🎯 THE DELIVERY, which is ADR-0133's question 3 and is NOT an admission criterion.
 *
 * Whether we may convey a file neither approves nor refuses: it ROUTES. What we may convey travels with us
 * (`repositorio`). What we may not is fetched by whoever installs, from the source (`pessoa`), and **enters neither this
 * tree nor the package** — what ADR-0108 already decided for the Ronde font, which cannot be packaged.
 *
 * ⚠️ And the distinction is not subtle for an asset pack: using art IN A GAME is what such a grant usually allows, while
 * equipping an engine with the whole pack and handing it to every game is REPACKAGING. 📌 Neither `itch.io` nor
 * `kenney.nl` sends a CORS header, so an automatic version of this is not even possible — only a person can fetch from
 * there.
 */
const ENTREGAS = Object.freeze(['repositorio', 'pessoa']);
/** The bridge exists only for Creative Commons share-alike, and produces only this output. */
const FONTE_DA_PONTE = /^CC-BY-SA-[34]\.0$/;
const SAIDA_DA_PONTE = 'GPL-3.0-only';

/* ---------- the pure halves: they take lists, so fixtures can drive them ---------- */

/** Reads the ledger. Returns the entries; the first line is the header and the trailing empty one is ignored. */
export function lerLivro(texto) {
  return texto.split(/\r?\n/).slice(1).filter((ln) => ln.trim() !== '').map((ln) => {
    const [caminho, autor, fonte, porta, licenca, saida, entrega, derivadoDe] = ln.split(',');
    return {
      caminho: (caminho ?? '').trim(),
      autor: (autor ?? '').trim(),
      fonte: (fonte ?? '').trim(),
      porta: (porta ?? '').trim(),
      licenca: (licenca ?? '').trim(),
      saida: (saida ?? '').trim(),
      entrega: (entrega ?? '').trim(),
      derivadoDe: (derivadoDe ?? '').split(';').map((s) => s.trim()).filter(Boolean),
    };
  });
}

/**
 * Everything that can be wrong with the ledger, spelled out.
 *
 * ⚠️ THE ORDER OF THE LICENCE QUESTIONS IS THE RULE: first whether it has NO DOOR, and only then whether the declared door
 * accepts that name. The other way round, a `CC-BY-NC-4.0` row would come out as not one of the measured ones, which is
 * true and the wrong half of the truth — whoever reads it will fix the spelling.
 */
export function problemasDoLivro(entradas, vivos) {
  const problemas = [];
  const vistos = new Set();
  for (const e of entradas) {
    if (!e.autor) problemas.push(`sem autor: ${e.caminho} — «não consegui descobrir» não é licença`);
    if (!e.caminho.startsWith(ARTE)) problemas.push(`fora de ${ARTE}: ${e.caminho}`);
    if (vistos.has(e.caminho)) problemas.push(`entrada repetida: ${e.caminho}`);

    // 🎯 The delivery decides which of TWO opposite claims is made about the file, which is why it comes before the
    // orphan: on a `pessoa` row, the file being here is the defect.
    if (!ENTREGAS.includes(e.entrega)) {
      problemas.push(`entrega inválida em ${e.caminho}: «${e.entrega}» — tem de ser uma de ${ENTREGAS.join(', ')}`);
    } else if (e.entrega === 'pessoa') {
      if (vivos.has(e.caminho)) {
        problemas.push(`CONVEIADO SEM PODER em ${e.caminho}: a entrega é «pessoa», e o ficheiro está nesta `
          + `árvore — é exactamente o que a concessão proíbe (ADR-0133, ADR-0108)`);
      }
    } else if (!vivos.has(e.caminho)) {
      problemas.push(`órfão: ${e.caminho} — a entrada nomeia um recurso que não existe`);
    }

    // 🎯 The source URL is the raw material of the check at the source #140 will build: without it stored per resource,
    // the declared licence has nothing to be checked against.
    if (!/^https?:\/\/\S+$/.test(e.fonte)) {
      problemas.push(`fonte sem URL em ${e.caminho}: «${e.fonte}» — a licença declarada tem de poder ser conferida na origem`);
    }

    const semPorta = SEM_PORTA.find((r) => r.padrao.test(e.licenca));
    if (semPorta) {
      problemas.push(`SEM PORTA NENHUMA em ${e.caminho}: «${e.licenca}» — ${semPorta.porque} (ADR-0133)`);
    } else if (!PORTAS.includes(e.porta)) {
      problemas.push(`porta inválida em ${e.caminho}: «${e.porta}» — tem de ser uma de ${PORTAS.join(', ')}`);
    } else if (e.porta === 'licenca' && !MEDIDAS_COMO_PASSANDO.includes(e.licenca)) {
      // 📌 REFERRED, not refused: a new name comes in as soon as a record says the four questions were answered for it.
      // The message has to say so, or it looks like a closed door.
      problemas.push(`licença por medir em ${e.caminho}: «${e.licenca}» — responda as quatro perguntas do `
        + `ADR-0133 num registo e acrescente o nome; medidas até hoje: ${MEDIDAS_COMO_PASSANDO.join(', ')}`);
    } else if (e.porta === 'concessao' && !/^https?:\/\/\S+$/.test(e.licenca)) {
      problemas.push(`concessão sem ponteiro em ${e.caminho}: «${e.licenca}» — uma concessão que ninguém `
        + `consegue abrir é uma lembrança, não uma permissão`);
    } else if (e.porta === 'ponte') {
      if (!FONTE_DA_PONTE.test(e.licenca)) {
        problemas.push(`ponte com fonte errada em ${e.caminho}: «${e.licenca}» — a declaração de `
          + `compatibilidade da Creative Commons cobre CC BY-SA, e mais nada`);
      }
      if (e.saida !== SAIDA_DA_PONTE) {
        problemas.push(`saída errada na ponte em ${e.caminho}: «${e.saida}» — tem de ser exactamente `
          + `${SAIDA_DA_PONTE}; «or-later» reivindicaria uma compatibilidade que não foi declarada`);
      }
      if (e.derivadoDe.length === 0) {
        problemas.push(`ponte sem adaptação em ${e.caminho} — a ponte só abre para uma DERIVADA, e o `
          + `ficheiro original continua na licença dele para toda a gente`);
      }
    }
    vistos.add(e.caminho);
  }
  return problemas;
}

/** Files in the tree that nobody declared. Coming in without an entry is coming in without attribution. */
export function naoDeclarados(vivos, entradas) {
  const declarados = new Set(entradas.map((e) => e.caminho));
  return [...vivos].filter((f) => !declarados.has(f));
}

/* ---------- the real tree ---------- */

function ficheirosDe(rel) {
  const abs = join(RAIZ, rel);
  if (!existsSync(abs)) return [];
  const saida = [];
  const andar = (dir) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) andar(p);
      else saida.push(relative(RAIZ, p).split('\\').join('/'));
    }
  };
  andar(abs);
  return saida;
}

const naArvore = ficheirosDe(ARTE);
const recursosVivos = new Set(naArvore.filter((f) => !NAO_SAO_RECURSO.has(f)));
const entradas = existsSync(join(RAIZ, LIVRO)) ? lerLivro(readFileSync(join(RAIZ, LIVRO), 'utf8')) : [];

/** A sound row, so the cases change ONE field at a time instead of repeating the whole object. */
const linha = (extra = {}) => ({
  caminho: `${ARTE}x.png`, autor: 'Alguém', fonte: 'https://opengameart.org/x',
  porta: 'licenca', licenca: 'CC0-1.0', saida: '', entrega: 'repositorio', derivadoDe: [], ...extra,
});
const so = (extra) => problemasDoLivro([linha(extra)], new Set([`${ARTE}x.png`]));

describe('ADR-0133 · as três portas por onde a arte entra', () => {
  it('⚠️ [Vácuo] a árvore da arte EXISTE e é versionada — sem ela os outros casos passariam por vácuo', () => {
    // First and not last, because the resources tree is EMPTY: the doors were decided and no art has come in yet. This
    // case proves the scan is still alive — and it catches the `.gitignore` trap where it bites: in a clean clone, an
    // ignored folder has neither README nor ledger.
    expect(existsSync(join(RAIZ, LIVRO)), `${LIVRO} não existe — o livro-razão é a atribuição, não um extra`).toBe(true);
    expect(naArvore, 'a varredura de `art/` não achou nem o README nem o livro')
      .toEqual(expect.arrayContaining([...NAO_SAO_RECURSO]));
  });

  it('⚠️ [Interface] todo recurso tem entrada — entrar sem atribuição é violar a licença', () => {
    expect(naoDeclarados(recursosVivos, entradas), 'recurso de arte sem entrada no livro-razão').toEqual([]);
  });

  it('⚠️ [Interface] o livro real não tem órfãos, autor vazio, porta inválida nem fonte sem URL', () => {
    expect(problemasDoLivro(entradas, recursosVivos)).toEqual([]);
  });

  it('[Right] as licenças já medidas passam pela porta `licenca` — senão o gate nunca ficaria verde', () => {
    // ⚠️ The half almost every blacklist gate lacks: proving the permissive side WORKS. Without it, a refusal pattern too
    // wide would make the ledger impossible to fill, and a gate that can never go green is a gate someone switches off.
    for (const licenca of MEDIDAS_COMO_PASSANDO) {
      expect(so({ licenca }), `«${licenca}» devia passar e não passou`).toEqual([]);
    }
  });

  it('🔴 [Right] ND e NC não têm porta nenhuma, e a mensagem diz que é RECUSA e não erro de escrita', () => {
    for (const [licenca, agulha] of [
      ['CC-BY-ND-4.0', 'recolorir já é derivar'],
      ['CC-BY-NC-4.0', 'mais estreita que o código'],
    ]) {
      const p = so({ licenca });
      expect(p.filter((s) => s.startsWith('SEM PORTA')), `«${licenca}» não foi recusada`).toHaveLength(1);
      expect(p[0], `a recusa de «${licenca}» não diz o motivo certo`).toContain(agulha);
      expect(p.some((s) => s.startsWith('licença por medir')), 'saiu como erro de escrita').toBe(false);
    }
  });

  it('🎯 [Right] SHARE-ALIKE já não é recusado: passa PELA PONTE, com saída e adaptação', () => {
    // The case that carries the decision, the inverse of what this file first asserted. The bridge is the Creative
    // Commons compatibility declaration of 2015-10-08 plus §13 of the GPLv3.
    expect(so({
      porta: 'ponte', licenca: 'CC-BY-SA-3.0', saida: 'GPL-3.0-only', derivadoDe: ['fonte/heroi.png'],
    }), 'a ponte devia deixar passar CC BY-SA adaptada').toEqual([]);
  });

  it('⚠️ [Right] a ponte exige `GPL-3.0-only` — «or-later» reivindica o que não foi declarado', () => {
    const p = so({ porta: 'ponte', licenca: 'CC-BY-SA-4.0', saida: 'GPL-3.0-or-later', derivadoDe: ['f.png'] });
    expect(p.some((s) => s.startsWith('saída errada na ponte'))).toBe(true);
  });

  it('⚠️ [Right] a ponte exige ADAPTAÇÃO — o ficheiro original nunca muda de licença', () => {
    const p = so({ porta: 'ponte', licenca: 'CC-BY-SA-3.0', saida: 'GPL-3.0-only', derivadoDe: [] });
    expect(p.some((s) => s.startsWith('ponte sem adaptação'))).toBe(true);
  });

  it('[Right] a ponte não serve para levar uma licença qualquer a GPL', () => {
    const p = so({ porta: 'ponte', licenca: 'MIT', saida: 'GPL-3.0-only', derivadoDe: ['f.png'] });
    expect(p.some((s) => s.startsWith('ponte com fonte errada'))).toBe(true);
  });

  it('🎯 [Right] a porta `concessao` exige um PONTEIRO para a concessão, não um nome', () => {
    // It is Tiny Swords' door: terms written by the author, permissive, with no known licence name.
    expect(so({ porta: 'concessao', licenca: 'https://pixelfrog-assets.itch.io/tiny-swords' }),
      'uma concessão com ponteiro devia passar').toEqual([]);
    const p = so({ porta: 'concessao', licenca: 'o autor deixou' });
    expect(p.some((s) => s.startsWith('concessão sem ponteiro'))).toBe(true);
  });

  it('📌 [Boundary] um nome NOVO é REFERIDO, não recusado — a mensagem tem de dizer como o admitir', () => {
    // The difference between a list and a stranglehold. `Zlib` has nothing wrong with it; nobody has answered the four
    // questions for it yet, and the message must say exactly that.
    const p = so({ licenca: 'Zlib' });
    expect(p.filter((s) => s.startsWith('licença por medir'))).toHaveLength(1);
    expect(p[0], 'a mensagem não diz COMO admitir a licença nova').toContain('quatro perguntas');
    expect(p.some((s) => s.startsWith('SEM PORTA')), 'tratou um nome novo como proibição').toBe(false);
  });

  it('🔴 [Right] uma linha de entrega `pessoa` cujo ficheiro ESTÁ na árvore reprova', () => {
    // Tiny Swords' case, the one the Dev saw: its grant allows using the art IN A GAME, and equipping the engine with the
    // whole pack is repackaging it. The row is declared and the file does NOT come in.
    const p = problemasDoLivro(
      [linha({ porta: 'concessao', licenca: 'https://pixelfrog-assets.itch.io/tiny-swords', entrega: 'pessoa' })],
      new Set([`${ARTE}x.png`]),
    );
    expect(p.filter((s) => s.startsWith('CONVEIADO SEM PODER'))).toHaveLength(1);
  });

  it('⚠️ [Inverse] e a mesma linha SEM o ficheiro na árvore passa — senão não haveria como a declarar', () => {
    // The opposite half, and without it the rule would have no way out: what the `pessoa` delivery asserts is an ABSENCE,
    // and an absence that also failed would make the door impossible to use.
    expect(problemasDoLivro(
      [linha({ porta: 'concessao', licenca: 'https://pixelfrog-assets.itch.io/tiny-swords', entrega: 'pessoa' })],
      new Set(),
    )).toEqual([]);
  });

  it('⚠️ [Right] uma fonte sem URL reprova — é a matéria-prima da conferência na origem', () => {
    expect(so({ fonte: 'opengameart' }).some((s) => s.startsWith('fonte sem URL'))).toBe(true);
  });

  it('⚠️ [Right] um ficheiro SEM ENTRADA reprova — entrar sem atribuição é violar a licença', () => {
    expect(naoDeclarados(new Set([`${ARTE}intruso.png`]), [])).toEqual([`${ARTE}intruso.png`]);
    expect(naoDeclarados(new Set([`${ARTE}x.png`]), [linha()])).toEqual([]);
  });

  it('⚠️ [Right] um recurso SEM AUTOR reprova — «não consegui descobrir» não é licença', () => {
    expect(so({ autor: '' }).some((s) => s.startsWith('sem autor'))).toBe(true);
  });

  it('[Right] uma entrada ÓRFÃ reprova — senão o livro é uma lembrança, não uma medida', () => {
    const p = problemasDoLivro([linha({ caminho: `${ARTE}sumiu.png` })], new Set());
    expect(p.some((s) => s.startsWith('órfão'))).toBe(true);
  });

  it('⚠️ [Interface] o `LICENSES.md` nomeia as três portas E as duas recusas', () => {
    // Without this case the file a lawyer reads could diverge from what the gate asserts — and it is the file that item
    // `g` of the filing asks to be put on record.
    const txt = readFileSync(join(RAIZ, 'docs/LICENSES.md'), 'utf8');
    for (const nome of ['CC0', 'CC BY', 'OGA-BY', 'GPL-3.0-only', 'concess']) {
      expect(txt, `o LICENSES.md não nomeia ${nome}`).toContain(nome);
    }
    // 🎯 And the refusals, which are half the decision: a document that lists only what is allowed reads as a list of
    // examples, which is why ADR-0133 named them instead of leaving them to deduction.
    for (const nome of ['ND', 'NC']) {
      expect(txt, `o LICENSES.md não diz que recusamos ${nome}`).toContain(nome);
    }
  });

  it('⚠️ [Interface] o `CREDITS.md` APONTA para o livro-razão — senão a atribuição fica achável só por quem já sabe', () => {
    const txt = readFileSync(join(RAIZ, 'docs/CREDITS.md'), 'utf8');
    expect(txt, 'o CREDITS.md não aponta para o livro-razão da arte').toContain(LIVRO);
  });
});

// ========================= MUTATIONS CHECKED =========================
// Each applied by script to the file, with an occurrence count before applying.
//   · 🎯 dropping the `GPL-3.0-only` requirement (accepting any output) -> fails the or-later case. It is the bridge
//     mutation that matters most: the Creative Commons declaration covers VERSION 3 and no other, and an or-later notice
//     claims a compatibility nobody declared. Nobody would notice by eye.
//   · dropping the ADAPTATION requirement on the bridge -> fails the case of that name. Without it a CC BY-SA file copied
//     as is would come out as GPL, and the original never changes licence for anyone.
//   · letting the bridge accept any source licence -> fails the MIT case. The bridge is not a universal converter to GPL;
//     it exists only for Creative Commons share-alike.
//   · swapping the order of the questions (door before SEM_PORTA) -> fails the ND/NC cases on their last assertion: the
//     gate would go on failing the row and lose the REASON, which is what the reader needs.
//   · treating a new name as a ban instead of not-yet-measured -> fails the [Boundary]. It is the difference between a
//     list and a stranglehold, and it was the defect the Dev caught twice in one day.
//   · dropping the POINTER guard on the `concessao` door -> fails the case of that name. A grant nobody can open is
//     honoured from memory, which is where every rule of this repository has failed before.
//   · dropping the SOURCE-WITHOUT-URL guard -> fails the case of that name. Without it there is nothing to check at the
//     source.
//   · dropping the EMPTY-AUTHOR / ORPHAN guard -> the cases of those names fail.
//   · emptying `art/` -> fails the [Vácuo] case FIRST, the only one that can catch it with the ledger empty.
