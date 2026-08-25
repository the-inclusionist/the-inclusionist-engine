// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de core/layers — a ORDEM-Z canônica e a cadeia de pós-processo (project node: dados puros).
//
// POR QUE ISTO EXISTE. `Z` e `POST_FX_ORDER` são um registro: números e nomes que ninguém executa, e que por
// isso nenhum teste alcançava. Só que o ADR-0020 promete propriedades sobre eles — a ordem das camadas, a
// folga entre elas, e qual passe vem por último —, e uma promessa que nada verifica é uma promessa até alguém
// mexer. A cadeia de pós-processo acabou de ser EMENDADA (o limitador de flash passa a ser o último, depois da
// correção de a11y); esta é a aferição que impede a redação antiga de voltar por descuido.
import { describe, it, expect } from 'vitest';
import { Z, POST_FX_ORDER } from '../app/js/core/layers.js';

describe('POST_FX_ORDER — a cadeia de pós-processo', () => {
  it('[Right] FLASH_LIMIT é o ÚLTIMO passe, depois de A11Y_CORRECTION', () => {
    // A distinção que a emenda de 2026-08-24 introduziu: CORREÇÃO decide como a imagem se parece e precisa ver
    // o composto final; SEGURANÇA decide se ela pode fazer mal e precisa ver o quadro que chega ao olho. Um
    // limitador antes da correção limita uma imagem que já não existe — e uma matriz de daltonismo redistribui
    // luminância por definição, então ela pode reabrir a oscilação que o limitador acabou de fechar.
    expect(POST_FX_ORDER.at(-1)).toBe('FLASH_LIMIT');
    expect(POST_FX_ORDER.indexOf('FLASH_LIMIT')).toBeGreaterThan(POST_FX_ORDER.indexOf('A11Y_CORRECTION'));
  });

  it('[Right] A11Y_CORRECTION vem depois do CRT — senão o CRT re-tinge e desfaz a correção', () => {
    expect(POST_FX_ORDER.indexOf('A11Y_CORRECTION')).toBeGreaterThan(POST_FX_ORDER.indexOf('CRT_VIGNETTE'));
    expect(POST_FX_ORDER.indexOf('A11Y_CORRECTION')).toBeGreaterThan(POST_FX_ORDER.indexOf('EMPATHY_SIM'));
  });

  it('[Zero] nenhum passe repetido — a cadeia é uma sequência, não um multiconjunto', () => {
    expect(new Set(POST_FX_ORDER).size).toBe(POST_FX_ORDER.length);
  });
});

describe('Z — a ordem-z canônica', () => {
  const nomes = Object.keys(Z);

  it('[Right] o jogador fica ENTRE os itens e os efeitos da frente', () => {
    // Duas decisões confirmadas do ADR-0020, e a primeira é contraintuitiva: coletáveis ficam ATRÁS do jogador
    // (barril do DK, Yoshi, chave do SMW), e não à frente.
    expect(Z.ITEMS).toBeLessThan(Z.PLAYER);
    expect(Z.PLAYER).toBeLessThan(Z.VFX_FRONT);
  });

  it('[Right] a natureza CERCA o jogador: há um par atrás e um à frente, de flora e de fauna', () => {
    // O straddle é pedido de design (imersão): bichos e plantas aparecem dos dois lados do ator.
    expect(Z.FLORA_BACK).toBeLessThan(Z.PLAYER);
    expect(Z.FAUNA_BACK).toBeLessThan(Z.PLAYER);
    expect(Z.FLORA_FRONT).toBeGreaterThan(Z.PLAYER);
    expect(Z.FAUNA_FRONT).toBeGreaterThan(Z.PLAYER);
  });

  it('[Right] o céu está no fundo e o paralaxe sobe do mais distante ao mais próximo', () => {
    expect(Z.SKY).toBeLessThan(Z.PARALLAX_4);
    expect(Z.PARALLAX_4).toBeLessThan(Z.PARALLAX_3);
    expect(Z.PARALLAX_3).toBeLessThan(Z.PARALLAX_2);
    expect(Z.PARALLAX_2).toBeLessThan(Z.PARALLAX_1);
    expect(Z.PARALLAX_1).toBeLessThan(Z.TILES);
  });

  it('[Invariant] todo Z é inteiro e único — dois nomes no mesmo número seriam empate silencioso', () => {
    const vals = nomes.map((k) => Z[k]);
    for (const v of vals) expect(Number.isInteger(v)).toBe(true);
    expect(new Set(vals).size, 'há dois nomes de camada com o mesmo Z').toBe(vals.length);
  });

  it('[Invariant] o passo de 1000 é a folga: nenhuma CAMADA encosta na vizinha', () => {
    // A folga é o que permite inserir uma camada nova sem renumerar as outras, e elementos concretos entram por
    // `Z.BANDA + offset` pequeno (bengala = PLAYER+10, cadeira = PLAYER+20). Se duas camadas ficassem a menos de
    // 1000 uma da outra, esses offsets começariam a invadir a banda seguinte.
    //
    // MENU_MAX fica DE FORA porque não é uma camada: é o teto da faixa reservada aos menus, e por isso está a 1
    // de TRANSITION de propósito. Escrevi este caso sem essa distinção e ele acusou os dois — a invariante
    // estava certa e o conjunto sobre o qual eu a afirmava, errado. O registro guarda duas espécies de número.
    const CAMADAS = nomes.filter((k) => k !== 'MENU_MAX');
    const ordenados = CAMADAS.map((k) => Z[k]).sort((a, b) => a - b);
    for (let i = 1; i < ordenados.length; i++) {
      expect(ordenados[i] - ordenados[i - 1], `folga menor que 1000 perto de ${ordenados[i]}`).toBeGreaterThanOrEqual(1000);
    }
  });

  it('[Boundary] a faixa reservada aos menus tem 10000 de largura e nada entra dentro dela', () => {
    // Menus aninhados sobem +1000 por nível dentro de MENU..MENU_MAX. Uma camada nova posta nessa faixa
    // colidiria com o terceiro ou quarto nível de menu — e só em runtime, num submenu fundo que raramente abre.
    expect(Z.MENU_MAX - Z.MENU).toBe(9999);
    expect(Z.TRANSITION).toBeGreaterThan(Z.MENU_MAX);
    const dentro = nomes.filter((k) => k !== 'MENU' && k !== 'MENU_MAX' && Z[k] >= Z.MENU && Z[k] <= Z.MENU_MAX);
    expect(dentro, 'camada dentro da faixa reservada aos menus').toEqual([]);
  });
});
