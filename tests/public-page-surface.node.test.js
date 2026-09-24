// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A CARTRIDGE READS FROM THE PAGE IS CONTRACT, AND NOTHING HOLDS IT BUT THIS (issue #164, ADR-0170).
//
// 📏 Measured on 2026-09-13 across the seven sibling game repositories: they read `--tap`, `--ui-fs`, `--maxw`,
// `--accent`; style or query `.pi-btn`, `.pm-btn`, `#vp-pause-0`, `[data-pi]`; and use engine dictionary keys in
// `data-i18n`. The TypeScript surface gate sees none of it — `--barra-a11y-h` changed meaning (#160) and passed.
//
// 📌 The list lives in `docs/6-DevOps-SRE/public-page-surface.json`, beside the TypeScript snapshot, and every name in it
// says who reads it. This gate holds the two halves: the engine still WRITES every listed name, and no listed name is
// kept for nobody.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const LISTA = JSON.parse(readFileSync(join(RAIZ, 'docs', '6-DevOps-SRE', 'public-page-surface.json'), 'utf8'));
const CSS = readFileSync(join(RAIZ, 'app', 'css', 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function fontes(dir, fora = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fontes(p, fora);
    else if (nome.endsWith('.ts')) fora.push(readFileSync(p, 'utf8'));
  }
  return fora;
}
const JS = fontes(join(RAIZ, 'app', 'js')).join('\n');
const DICIONARIOS = Object.fromEntries(['pt', 'en', 'es'].map((l) => [l, readFileSync(join(RAIZ, 'app', 'js', 'i18n', `${l}.ts`), 'utf8')]));

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A whole token in the engine's code — or a template that builds it (`pi-cvd-${tipo}` writes `pi-cvd-protan`). */
function oCodigoEscreve(nome) {
  if (new RegExp(`(?<![\\w-])${escapar(nome)}(?![\\w-])`).test(JS)) return true;
  const partes = nome.split('-');
  for (let i = partes.length - 1; i > 0; i--) if (JS.includes(`${partes.slice(0, i).join('-')}-\${`)) return true;
  return false;
}
const aFolhaDefine = (v) => new RegExp(`${escapar(v)}\\s*:`).test(CSS);
const aFolhaSeleciona = (c) => new RegExp(`\\.${escapar(c)}(?![\\w-])`).test(CSS);
const dataset = (d) => `dataset.${d.slice(5).replace(/-([a-z])/g, (_, x) => x.toUpperCase())}`;

const SECOES = ['cssVariables', 'mountedClasses', 'styledClasses', 'ids', 'dataAttributes', 'dictionaryKeys'];

describe('the page surface a cartridge reads (issue #164, ADR-0170)', () => {
  it('🎯 [Zero] the list is not empty — an empty list would pass every case below', () => {
    for (const s of SECOES) expect(Object.keys(LISTA[s] ?? {}).length, `section ${s} is empty`).toBeGreaterThan(0);
  });

  it('🔴 [Right] every listed CSS variable is still written — by the stylesheet or by the root', () => {
    const perdidas = Object.keys(LISTA.cssVariables).filter((v) => !aFolhaDefine(v) && !JS.includes(`'${v}'`));
    expect(perdidas, 'a variable games read is no longer written — a break: write the migration note').toEqual([]);
  });

  it('🔴 [Right] every listed class the engine mounts is still styled AND still written by its code', () => {
    const semEstilo = Object.keys(LISTA.mountedClasses).filter((c) => !aFolhaSeleciona(c));
    const semEscrita = Object.keys(LISTA.mountedClasses).filter((c) => !oCodigoEscreve(c));
    expect(semEstilo, 'classes the stylesheet no longer styles').toEqual([]);
    expect(semEscrita, 'classes the engine no longer mounts').toEqual([]);
    expect(Object.keys(LISTA.styledClasses).filter((c) => !aFolhaSeleciona(c)), 'styled classes gone from the sheet').toEqual([]);
  });

  it('🔴 [Right] every listed id and data attribute is still in the engine code', () => {
    expect(Object.keys(LISTA.ids).filter((i) => !oCodigoEscreve(i)), 'ids the engine no longer writes or reads').toEqual([]);
    const perdidos = Object.keys(LISTA.dataAttributes).filter((d) => !JS.includes(d) && !JS.includes(dataset(d)));
    expect(perdidos, 'data attributes the engine no longer writes or reads').toEqual([]);
  });

  it('🔴 [Right] every listed dictionary key is in the three languages', () => {
    const faltas = [];
    for (const k of Object.keys(LISTA.dictionaryKeys)) {
      for (const [l, txt] of Object.entries(DICIONARIOS)) if (!txt.includes(`'${k}':`)) faltas.push(`${l} ${k}`);
    }
    expect(faltas, 'a key games use is missing from a dictionary').toEqual([]);
  });

  it('🎯 [Zero] no name is kept for nobody — each says which repository or record reads it', () => {
    const orfaos = [];
    for (const s of SECOES) {
      for (const [nome, leitores] of Object.entries(LISTA[s])) {
        const validos = Array.isArray(leitores) ? leitores.filter((l) => /^(game-[\w-]+|pixi-[\w-]+) \S+:\d+$|^ADR-\d{4}$/.test(l)) : [];
        if (!validos.length || validos.length !== leitores.length) orfaos.push(`${s} ${nome}`);
      }
    }
    expect(orfaos, 'a listed name with no reader, or a reader that is not «repo file:line» nor «ADR-NNNN»').toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   P0 a section emptied                                   🔴 [Zero] list
//   P1 `--maxw` no longer defined in the stylesheet        🔴 variables
//   P2 `--barra-a11y-h` no longer set by the root          🔴 variables
//   P3 `.pm-sel` selector gone from the stylesheet         🔴 classes
//   P4 the root mounts `rodape-da-tela` under another name 🔴 classes
//   P5 `vp-pause-0` renamed in the root                    🔴 ids
//   P6 `menu.close` removed from es                        🔴 keys
//   P7 a listed name with an empty reader list             🔴 [Zero] nobody
