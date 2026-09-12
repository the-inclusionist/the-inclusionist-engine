// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE GENRE TAXONOMY AND THE CATALOGUE READER, shared by `taxonomia-de-generos.mjs` and
// `acomodacoes-por-genero.mjs` (ADR-0145, the Dev's correction of 2026-09-12).
//
// Both scripts must read the catalogue the same way and key the same categories the same way; a copy in each
// would let one count 380 games and the other 379 with nothing saying which is right.
//
// ⚠️ THIS IS JUDGEMENT WRITTEN AS DATA, so it can be disagreed with one row at a time: edit an entry and run
// the scripts again. The guards live in the scripts, not here — this module only holds the table.
import { readFileSync, existsSync } from 'node:fs';

export const CATALOGO_PADRAO = 'C:/Users/candi/Claude/minigames-catalog-v2.html';

/**
 * Reads the `minigames-catalog-v2.html` cards. The catalogue does NOT travel in this repository (ADR-0058 says
 * whose it is), so a missing path is a stated error and not a silent zero.
 */
export function lerCatalogo(caminho, uso) {
  if (!existsSync(caminho)) {
    console.error(`catalogue not found: ${caminho}\npass the path: ${uso}`);
    process.exit(2);
  }
  const html = readFileSync(caminho, 'utf8');
  const limpo = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  const categorias = [...html.matchAll(/<article class="card[^"]*"[\s\S]*?<\/article>/g)].map((m) => {
    // the game's NAME is the item without its <small> descriptor: «Co-op puzzle <small>cada jogador…</small>»
    const titulos = [...m[0].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((li) => limpo(li[1].replace(/<small[\s\S]*?<\/small>/g, '')));
    return { nome: limpo((m[0].match(/<h3[^>]*class="card-title"[^>]*>([\s\S]*?)<\/h3>/) ?? [, ''])[1]), jogos: titulos.length, titulos };
  });
  if (!categorias.length) { console.error('no category read — did the catalogue markup change?'); process.exit(2); }
  return categorias;
}

/* ===================== THE TAXONOMY, PINNED =====================
 * `https://en.wikipedia.org/wiki/List_of_video_game_genres`, revision 1367745358 of 2026-08-04T23:25:35Z.
 * Only the sections the mapping uses, with the page's own section NUMBER, so each row can be checked by hand
 * against the revision.
 *
 * 📌 Section 11 («by purpose») is here but is NOT treated as genre: the page itself separates it, which is the
 * same cut the Dev's correction asked for.
 */
export const REVISAO = { id: 1367745358, data: '2026-08-04T23:25:35Z' };
export const SECOES = Object.freeze({
  '1': 'Action', '1.1': 'Platform games', '1.2': 'Shooter games', '1.2.1': 'First-person shooters',
  '1.3': 'Fighting games', '1.5': 'Stealth games', '1.7': 'Rhythm games',
  '2': 'Action-adventure', '2.1': 'Survival horror',
  '3': 'Adventure', '3.2': 'Graphic adventures', '3.3': 'Visual novels',
  '4': 'Puzzle', '4.2': 'Logical game', '4.2.1': 'Physics game', '4.3': 'Hidden object game',
  '4.6': 'Traditional puzzle game',
  '5': 'Role-playing',
  '6': 'Simulation', '6.1': 'Construction and management simulation',
  '7': 'Strategy',
  '8': 'Sports', '8.1': 'Racing', '8.2': 'Sports game',
  '10': 'Other notable genres', '10.1': 'Board game or card game', '10.2': 'Casino game', '10.6': 'Horror game',
  '10.7': 'Idle game', '10.8': 'Party game', '10.11': 'Trivia game', '10.12': 'Typing game',
  '11': 'Video game genres by purpose', '11.2': 'Art game', '11.5': 'Educational game',
  '12': 'Sandbox / open world games', '12.1': 'Sandbox', '12.2': 'Creative',
});

/** What a category name IS when it is not a genre: the axes the Dev's correction separated. */
export const RAZOES = new Set(['era', 'tecnica-de-render', 'perspectiva', 'modo-de-jogadores', 'mecanica', 'proposito', 'multigenero']);

/**
 * The two non-genre axes of the taxonomy, with their only valid values. Each category declares the SET of
 * values its games span — a category is a backlog shelf, and «Esportes» holds both golf and tennis.
 *
 * 📌 `atras` is the chase camera (Out Run, Subway Surfers): not first person, and it still moves the horizon,
 * which is what motion sickness answers to.
 */
export const EIXOS_DA_TAXONOMIA = Object.freeze({
  perspectiva: new Set(['lado', 'topo', 'isometrica', 'primeira-pessoa', 'atras', 'plana']),
  jogadores: new Set(['solo', 'local']),
});

/* ===================== THE 35 CATEGORIES → THE TAXONOMY =====================
 * `generos` = Wikipedia sections. `naoE` = what the category is when its NAME is not a genre.
 * `perspectiva` / `jogadores` = the sets its games span. `proposito` = «by purpose» sections (11.x), usually none.
 * `porJogo` = the genres of EACH game, only on a shelf whose name is not a genre and so has no `generos` of its
 * own. Keyed by the game's name as the catalogue writes it, without the <small> descriptor.
 */
export const generosDoJogo = (categoria, titulo) => MAPA[categoria].porJogo?.[titulo] ?? MAPA[categoria].generos;
export const MAPA = {
  'Arcade Clássico': { generos: ['1'], naoE: 'era', nota: 'an ERA; its games are mostly action', perspectiva: ['topo', 'lado'], jogadores: ['solo', 'local'], proposito: [] },
  'Shooters / Tiros': { generos: ['1.2'], perspectiva: ['topo', 'lado'], jogadores: ['solo', 'local'], proposito: [] },
  'Endless Runner': { generos: ['1.1'], perspectiva: ['lado', 'atras'], jogadores: ['solo'], proposito: [] },
  'Puzzle Lógico': { generos: ['4.2'], perspectiva: ['topo'], jogadores: ['solo'], proposito: [] },
  'Puzzle de Palavras': { generos: ['4'], nota: 'the page has no word-puzzle subsection; it stays in top-level Puzzle', perspectiva: ['plana'], jogadores: ['solo'], proposito: [] },
  'Puzzle Físico': { generos: ['4.2.1'], perspectiva: ['lado'], jogadores: ['solo'], proposito: [] },
  'Memória': { generos: ['4.6'], perspectiva: ['plana', 'topo'], jogadores: ['solo'], proposito: [] },
  'Platformer': { generos: ['1.1'], perspectiva: ['lado'], jogadores: ['solo'], proposito: [] },
  'Corrida / Racing': { generos: ['8.1'], perspectiva: ['topo', 'lado', 'atras'], jogadores: ['solo', 'local'], proposito: [] },
  'Esportes': { generos: ['8.2'], perspectiva: ['lado', 'topo', 'atras'], jogadores: ['solo', 'local'], proposito: [] },
  'Cartas': { generos: ['10.1'], perspectiva: ['plana'], jogadores: ['solo', 'local'], proposito: [] },
  'Tabuleiro': { generos: ['10.1'], perspectiva: ['topo'], jogadores: ['solo', 'local'], proposito: [] },
  'Cassino / Sorte': { generos: ['10.2'], perspectiva: ['plana'], jogadores: ['solo'], proposito: [] },
  'Simulação / Idle': { generos: ['6', '10.7'], perspectiva: ['topo', 'plana'], jogadores: ['solo'], proposito: [] },
  'RPG / Aventura': { generos: ['5', '3'], perspectiva: ['topo', 'primeira-pessoa'], jogadores: ['solo'], proposito: [] },
  'Estratégia': { generos: ['7'], perspectiva: ['topo'], jogadores: ['solo'], proposito: [] },
  'Ritmo / Música': { generos: ['1.7'], perspectiva: ['plana', 'lado'], jogadores: ['solo'], proposito: [] },
  'Digitação': { generos: ['10.12'], perspectiva: ['plana'], jogadores: ['solo', 'local'], proposito: [] },
  'Desenho / Criativo': { generos: ['12.2'], perspectiva: ['plana'], jogadores: ['solo'], proposito: [] },
  'Educativo / Quiz': { generos: ['10.11'], nota: 'half GENRE (quiz), half PURPOSE (educational)', perspectiva: ['plana'], jogadores: ['solo'], proposito: ['11.5'] },
  'Reação / Reflexo': { generos: ['1'], naoE: 'mecanica', nota: 'reacting fast is a MECHANIC that crosses genres', perspectiva: ['plana', 'primeira-pessoa'], jogadores: ['solo'], proposito: [] },
  'Party / Microgames': { generos: ['10.8'], perspectiva: ['plana', 'topo', 'lado'], jogadores: ['solo', 'local'], proposito: [] },
  'Stealth / Furtivo': { generos: ['1.5'], perspectiva: ['topo'], jogadores: ['solo'], proposito: [] },
  'Luta / Fighting': { generos: ['1.3'], perspectiva: ['lado', 'primeira-pessoa'], jogadores: ['solo', 'local'], proposito: [] },
  'Terror / Atmosfera': { generos: ['10.6', '2.1'], perspectiva: ['lado', 'topo', 'primeira-pessoa'], jogadores: ['solo'], proposito: [] },
  'Sandbox / Sim Físico': { generos: ['12.1', '4.2.1'], perspectiva: ['lado', 'topo'], jogadores: ['solo'], proposito: [] },
  'Pseudo-3D / Raycasting': { generos: ['1.2.1'], naoE: 'tecnica-de-render', nota: 'a TECHNIQUE; raycasters are almost all first-person shooting', perspectiva: ['primeira-pessoa', 'atras'], jogadores: ['solo'], proposito: [] },
  'Isométrico': { generos: ['5', '7'], naoE: 'perspectiva', nota: 'a PERSPECTIVE; isometric games are almost all RPG and strategy', perspectiva: ['isometrica'], jogadores: ['solo'], proposito: [] },
  // 📌 THE DEV'S CHOICE, 2026-09-12 («Opção A para todos»): the shelf is a player mode, so the genre is read
  // per GAME. Each of the ten was offered with alternatives; these are the first ones, which he took.
  'Multiplayer Local': { generos: [], naoE: 'modo-de-jogadores', nota: 'a PLAYER MODE that crosses any genre', perspectiva: ['topo', 'lado', 'plana'], jogadores: ['local'], proposito: [],
    porJogo: {
      'Pong 2P': ['8.2'], 'Tank battle 2P': ['1.2'], 'Co-op puzzle': ['4'], 'Split-screen race': ['8.1'],
      'Bomberman-like 2-4P': ['1'], 'Sumô / push-out arena': ['1.3'], 'Duelo de reflexo': ['10.8'],
      'Capturar bandeira local': ['1.2'], 'Quiz para 2 jogadores': ['10.11'], 'Co-op de apertar botões': ['1.7'],
    } },
  // ⚠️ MY READING, not yet confirmed by the Dev — the same per-game cut he applied above. Correct a row, rerun.
  'Experimentais / Arte': { generos: [], naoE: 'proposito', nota: 'the page itself files «art game» under «by purpose»', perspectiva: ['plana', 'primeira-pessoa'], jogadores: ['solo'], proposito: ['11.2'],
    porJogo: {
      'Generative art toy': ['12.2'], 'Music visualizer game': ['12.2'], 'Walking simulator mini': ['3'],
      'Zen / no-goal toys': ['4'], 'One-button games': ['1'], 'ASMR clickers': ['10.7'],
      'Brinquedos contemplativos': ['12.1'], 'Poemas interativos': ['3'],
    } },
  'Cozinha Produção': { generos: ['6.1'], perspectiva: ['topo', 'plana'], jogadores: ['solo'], proposito: [] },
  'Point-and-Click / Hidden': { generos: ['3.2', '4.3'], perspectiva: ['plana'], jogadores: ['solo'], proposito: [] },
  'Narrativo Detetive': { generos: ['3', '3.3'], perspectiva: ['plana'], jogadores: ['solo'], proposito: [] },
  'Labirinto Exploração': { generos: ['1'], naoE: 'mecanica', nota: 'the maze is a MECHANIC; the page does not list «maze» as a genre', perspectiva: ['topo'], jogadores: ['solo'], proposito: [] },
  // ⚠️ MY READING, not yet confirmed by the Dev. A mashup is TWO genres by definition, so each game names both.
  'Híbridos / Mashups': { generos: [], naoE: 'multigenero', nota: 'multi-genre BY DEFINITION — each game names its two', perspectiva: ['topo', 'lado'], jogadores: ['solo'], proposito: [],
    porJogo: {
      'Snake roguelite': ['1', '5'], 'Breakout RPG': ['1', '5'], 'Tetris com combate': ['4', '1'],
      'Match-3 com inimigo': ['4', '5'], 'Runner com cartas': ['1.1', '10.1'], 'Quiz com batalha RPG': ['10.11', '5'],
      'Plataforma com puzzle de chaves': ['1.1', '4'], 'Labirinto com stealth': ['1.5'], 'Tower defense com cartas': ['7', '10.1'],
      'Ritmo com shooter': ['1.7', '1.2'], 'Memória com terror leve': ['4.6', '10.6'], 'Fishing RPG curto': ['8.2', '5'],
      'Mini dungeon com dados': ['5', '10.1'], 'Clicker com boss fight': ['10.7', '1'], 'Auto-battler com deckbuilder': ['7', '10.1'],
    } },
};
