// SPDX-License-Identifier: AGPL-3.0-or-later
// game/tile-roles — a tabela tile → papel semântico (project node: função pura, sem nada).
//
// ESTES CASOS VIERAM DE `high-contrast.node.test.js`, e a mudança de arquivo É o registro: a regra do item 19
// diz que o teste VIAJA COM O MÓDULO, e o módulo mudou de lado. Enquanto a tabela morava em
// `render/high-contrast`, o teste dizia — pela sua localização — que "perigo é o tile 9" era uma verdade da
// engine. É uma verdade DESTE JOGO, e agora o teste fica onde a verdade mora.
//
// O que a tabela decide, em uma frase: quem recebe cor de papel no alto contraste e quem fica no cinza
// estrutural. Errar aqui não quebra nada visível para quem enxerga — o mapa continua desenhado, o jogo
// continua jogável — e pinta a lava de cinza e o chão de laranja para a criança de baixa visão, que é
// exatamente quem não tem como conferir isso na tela.
import { describe, it, expect } from 'vitest';
import { roleOf } from '../app/js/game/tile-roles.js';
import { HC_ROLE_KEYS } from '../app/js/render/hc-role-data.js';
import { TYPE_GLYPH } from '../app/js/core/tiles.js';

describe('roleOf — tile → papel semântico', () => {
  it('[Right] lava(9)=hazard · escada(4)/trampolim(5)=climb · água(3)=water', () => {
    expect(roleOf(9)).toBe('hazard');
    expect(roleOf(4)).toBe('climb');
    expect(roleOf(5)).toBe('climb');
    expect(roleOf(3)).toBe('water');
  });

  it('[Boundary] portão (10) também mapeia climb — branch verbatim do original (na prática nunca chega aqui: o boot remove o tile 10 do grid)', () => {
    expect(roleOf(10)).toBe('climb');
  });

  it('[Inverse] estrutura/ar (0,1,2,6) não tem papel → null (fica no cinza-azulado dessaturado)', () => {
    for (const t of [0, 1, 2, 6]) expect(roleOf(t)).toBeNull();
  });

  it('[Zero] tile desconhecido não tem papel — não inventa cor para o que não conhece', () => {
    // Pintar um tile novo com a cor de um papel errado é pior que não pintá-lo: o cinza estrutural pelo menos
    // não MENTE sobre o que aquilo faz. O default silencioso tem de ser `null`.
    for (const t of [-1, 99, 7, 8, 11, 12, 13, 14]) expect(roleOf(t), 'tile ' + t).toBeNull();
  });

  it('[Interface] todo papel devolvido existe na paleta do color-blocking', () => {
    // As duas listas já se separaram uma vez (ver o cabeçalho de render/hc-role-data): um papel novo no
    // render ganhava cor e não ganhava seletor no painel, sem erro de tipo nenhum. Este caso as reata pelo
    // lado do JOGO — se um dia esta tabela devolver um papel que a paleta não tem, ele fica sem cor.
    const papeis = new Set();
    for (let t = -5; t < 40; t++) { const r = roleOf(t); if (r) papeis.add(r); }
    expect(papeis.size).toBeGreaterThan(0);
    for (const p of papeis) expect(HC_ROLE_KEYS, p).toContain(p);
  });

  it('[Boundary] todo tile COM papel é um tile que existe no mapa de glifos', () => {
    // A tabela e o parser do mapa têm de falar dos mesmos números. Um papel para um tile que o texto-glifo
    // não sabe produzir seria código morto que parece regra — e o `10`, que o boot remove, é justamente o
    // caso-limite: ele EXISTE no glifo, e é por isso que a branch dele pode ficar.
    for (let t = 0; t < 20; t++) {
      if (roleOf(t)) expect(TYPE_GLYPH[t], 'tile ' + t + ' tem papel mas não tem glifo').toBeTruthy();
    }
  });
});

describe('a tabela saiu da engine, e é isso que a mudança vale', () => {
  it('[Right] `render/high-contrast` não define mais tile número nenhum como papel', async () => {
    // O ADR-0027 nomeia esta tabela como o acoplamento nº 1 da base: quatro linhas das quais TODO o alto
    // contraste dependia, morando no módulo de render — o que dizia, pela estrutura, que a numeração dos
    // tiles era assunto da engine. Se `roleOf` voltar para lá, este caso reprova.
    const hc = await import('../app/js/render/high-contrast.js');
    expect(hc.roleOf, 'render/high-contrast voltou a exportar roleOf').toBeUndefined();
  });
});
