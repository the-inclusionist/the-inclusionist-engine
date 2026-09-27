// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE'S FACES ANSWER TO THE TYPOGRAPHIC CATALOGUE (ADR-0176, issue #172).
//
// The Dev: «ao invés de deixar na engine, deixei as fontes no arquivo json… não faça alterações no catálogo, apenas se adeque
// a usá-lo». 📏 Measured on 2026-09-13 against `catalogo_tipografico.json`: Comic Neue was not in it; seven faces of the menu
// (Space Grotesk, Sora, Plus Jakarta Sans, Playfair Display, DM Serif Display, Fraunces, Bodoni Moda) were drawn at 16 px
// under a floor of 20; iA Writer Quattro and OpenDyslexic have `cobertura: null` — not verified, which is not «none».
//
// 📌 The catalogue is READ here, never written (its instructions §10). Keyed by `id` (§3.2), never by family name.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_GROUPS, OFERECIVEIS, fontRole, faceScale, faceFamilies, BASE_EM_PX } from '../app/js/ui/fonts.js';

const CATALOGO = JSON.parse(readFileSync(join(process.cwd(), 'research', 'catalogo_tipografico.json'), 'utf8'));
const POR_ID = new Map(CATALOGO.fontes.map((f) => [f.id, f]));
const TODAS = FONT_GROUPS.flatMap((g) => g.items);
/** The catalogue's `ativo` families: what the engine may package. */
const ATIVAS = new Set(CATALOGO.fontes.filter((f) => f.status === 'ativo').map((f) => f.familia));
/**
 * A face whose stack ENDS in an `ativo` family after its own: the «fallback declarado» the catalogue asks of a
 * `referencia_externa` face it may not package — the ronde, whose stack ends in Cookie (ADR-0154).
 */
const comRecuo = (it) => { const fams = faceFamilies(it); return fams.length > 1 && ATIVAS.has(fams[fams.length - 1]); };
/**
 * Offered for Portuguese with coverage NOT VERIFIED (`null`). Kept in the menu while the Dev decides: R3 asks `pt_br: true`,
 * and removing a face for dyslexia from the menu is their call, not a gate's (issue #172). Each line says what is missing.
 */
const COBERTURA_NAO_VERIFICADA = {
  opendyslexic: 'OpenDyslexic: GitHub source, coverage not measured in the catalogue',
  ronde: 'Ronde Script: referencia_externa, coverage not measured in the catalogue; its fallback Cookie covers pt_br',
};

describe('the engine\'s faces and the typographic catalogue (ADR-0176)', () => {
  it('🎯 [Zero] the catalogue is read and the engine has faces to hold to it', () => {
    expect(CATALOGO.fontes.length, 'the catalogue is empty').toBeGreaterThan(100);
    expect(CATALOGO._meta.total, 'the catalogue\'s _meta is out of step with its entries').toBe(CATALOGO.fontes.length);
    expect(TODAS.length).toBeGreaterThan(40);
  });

  it('🔴 [Right] every face names a catalogue id, of the same family, and the status allows it (R4)', () => {
    const problemas = [];
    for (const it of TODAS) {
      const c = POR_ID.get(it.id);
      if (!c) { problemas.push(`${it.k}: id «${it.id}» is not in the catalogue`); continue; }
      if (!it.fam.split(',').map((x) => x.trim()).includes(c.familia)) problemas.push(`${it.k}: «${it.fam}» is not the catalogue's «${c.familia}»`);
      const permitido = it.off || comRecuo(it) ? ['ativo', 'referencia_externa'] : ['ativo'];
      if (!permitido.includes(c.status)) problemas.push(`${it.k}: catalogue status «${c.status}»${c.motivo ? ` — ${c.motivo}` : ''}`);
    }
    expect(problemas).toEqual([]);
  });

  it('🔴 [Right] the reading menu offers layer A only (R1)', () => {
    const daCamadaB = OFERECIVEIS.filter((it) => POR_ID.get(it.id)?.camada !== 'A').map((it) => `${it.k} (${POR_ID.get(it.id)?.camada})`);
    expect(daCamadaB, 'a display face would carry what is needed to play').toEqual([]);
  });

  it('🔴 [Right] no face is drawn below its catalogue floor (R2) — neither its declared minimum nor the size the menu gives it', () => {
    const abaixo = [];
    for (const it of TODAS) {
      const piso = POR_ID.get(it.id)?.piso_tamanho_px;
      if (typeof piso !== 'number') continue;
      const minimo = it.minPx ?? BASE_EM_PX;
      if (minimo < piso) abaixo.push(`${it.k}: minimum ${minimo} px under the floor ${piso}`);
      if (fontRole(it) === 'geral' && BASE_EM_PX * faceScale(it) < piso) abaixo.push(`${it.k}: offered at ${BASE_EM_PX * faceScale(it)} px under ${piso}`);
    }
    expect(abaixo).toEqual([]);
  });

  it('🔴 [Right] a face offered for Portuguese covers Portuguese (R3) — or is named as not verified', () => {
    const sem = OFERECIVEIS.filter((it) => !it.off)
      .filter((it) => POR_ID.get(it.id)?.cobertura?.pt_br !== true && !(it.k in COBERTURA_NAO_VERIFICADA))
      .map((it) => `${it.k}: cobertura ${JSON.stringify(POR_ID.get(it.id)?.cobertura)}`);
    expect(sem).toEqual([]);
  });

  it('🎯 [Zero] the not-verified list holds only faces still offered and still unverified', () => {
    for (const k of Object.keys(COBERTURA_NAO_VERIFICADA)) {
      const it = OFERECIVEIS.find((x) => x.k === k);
      expect(it, `${k} left the menu: take it off the list`).toBeTruthy();
      expect(POR_ID.get(it.id)?.cobertura, `${k} was measured in the catalogue: take it off the list`).toBeNull();
    }
  });

  it('🔴 [Right] Playwrite BR is the handwriting group\'s general face (the Dev)', () => {
    const mao = FONT_GROUPS.find((g) => g.g === 'font.group.hand');
    const gerais = mao.items.filter((it) => fontRole(it) === 'geral' && !it.off).map((it) => it.k);
    // 📌 The ronde is offered too, BY NAME (ADR-0108 §4) — its `role` is absent on purpose so the menu shows it — and since
    // ADR-0154 it is no longer disabled. It is an option of the group, not its general face.
    expect(gerais).toEqual(['pwbr', 'ronde']);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   T1 Comic Neue back in the handwriting group                     🔴 status/id · general face
//   T2 Sora without its floor (`minPx:20` removed)                   🔴 floor
//   T3 `faceScale` returns 1 always                               🔴 floor (offered size)
//   T4 Press Start 2P offered in the menu (papel geral)              🔴 layer A only
//   T5 a face given an id of another family                         🔴 status/id
//   T6 Quattro taken off the not-verified list                       🔴 coverage
