// SPDX-License-Identifier: AGPL-3.0-or-later
// core/tiles.ts — Legend de tiles + parser do mapa em texto-glifo (1 glifo significativo por tile). Módulo-folha,
// ZERO deps. O jogo NÃO lê Tiled/Aseprite em runtime — só este texto-glifo, legível/diffável como ascii art.

// tipo (0–14) → glifo. Terreno = símbolos; power-ups = LETRAS maiúsculas mnemônicas.
export const TYPE_GLYPH: Record<number, string> = {
  1: '.',  // ar (iluminado)
  0: ':',  // ar escuro / região secreta
  2: '#',  // pedra / chão sólido
  6: '=',  // parede dura (sem quicar)
  3: '~',  // água
  4: 'H',  // escada
  5: '^',  // trampolim
  9: 'x',  // lava / perigo
  10: '|', // portão
  11: '*', // chave
  7: 'S',  // power-up super-pulo
  8: 'F',  // power-up voo
  12: 'T', // power-up super-corrida (turbo)
  13: 'U', // power-up ultra-pulo
  14: 'C', // power-up ventosa (cling)
};

// tipo → nome legível (UI e editor de mapa). Uma verdade só.
export const TILE_NAME: Record<number, string> = {
  0: 'ar escuro/secreto', 1: 'ar', 2: 'pedra', 3: 'água', 4: 'escada', 5: 'trampolim', 6: 'parede',
  7: 'super-pulo', 8: 'voo', 9: 'lava/perigo', 10: 'portão', 11: 'chave', 12: 'super-corrida',
  13: 'ultra-pulo', 14: 'ventosa',
};

// glifo → tipo (inverso). Construído do TYPE_GLYPH para não divergir.
export const GLYPH_TYPE: Record<string, number> = Object.fromEntries(
  Object.entries(TYPE_GLYPH).map(([t, g]): [string, number] => [g, +t]),
);

const AIR = 1; // glifo desconhecido / vazio à direita → ar iluminado

// Texto-glifo → grid numérico. Preserva o comprimento de cada linha (mapa é irregular; o buildWorld preenche
// o vazio à direita com ar). Linhas iniciadas por "#!" são meta (nome/autor) e são ignoradas — "#" sozinho é
// parede, então o marcador de meta é "#!" no INÍCIO da linha.
export function parseLevel(text: string): number[][] {
  const rows: number[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('#!')) continue; // meta
    if (line.length === 0) continue;     // linha vazia (ex.: \n final) — nossos mapas não têm linha vazia
    const row: number[] = [];
    for (const ch of line) row.push(ch in GLYPH_TYPE ? GLYPH_TYPE[ch] : AIR);
    rows.push(row);
  }
  return rows;
}

// Grid numérico → texto-glifo (para gerar o .map.txt e para o teste de ida-e-volta). Sem newline final.
export function gridToGlyphs(grid: number[][]): string {
  return grid.map((row) => row.map((t) => TYPE_GLYPH[t] ?? '.').join('')).join('\n');
}

// Sanidade: o legend é uma bijeção sobre 0..14? (glifos únicos e todos os tipos mapeados). Prova que a
// conversão é sem perda para QUALQUER grid. Retorna {ok, unique, invertible, missing}.
export function selfTest() {
  const types = Array.from({ length: 15 }, (_, i) => i);
  const glyphs = types.map((t) => TYPE_GLYPH[t]);
  const missing = types.filter((t) => !(t in TYPE_GLYPH));
  const unique = new Set(glyphs).size === glyphs.length;
  const invertible = types.every((t) => GLYPH_TYPE[TYPE_GLYPH[t]] === t);
  return { ok: missing.length === 0 && unique && invertible, unique, invertible, missing };
}
