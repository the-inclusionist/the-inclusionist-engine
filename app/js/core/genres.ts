// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * THE ENGINE'S GENRE LIST — the Dev's transcription of the Wikipedia list of video game genres (ADR-0156 §1).
 *
 * Optional (ADR-0153): a cartridge MAY declare one, and nobody assigns one to a game (§5). The transcription is the
 * decision and the page only its source, so families and genres are written as the Dev wrote them. A family name is not a
 * declarable genre, except MMO, which the list gives as both. Not in the list, and so not declarable: the by-purpose genres
 * and sandbox / open world (§4).
 */
export interface Genre {
  readonly name: string;
  readonly family: string;
  /** Casino game is refused (§2); Horror game is to be avoided (§3). */
  readonly mark?: 'refused' | 'avoid';
}

const F = (family: string, names: readonly string[]): Genre[] => names.map((name) => ({ name, family }));

export const GENRES: readonly Genre[] = Object.freeze(([
  ...F('Action', ['Platform games', 'Shooter games', 'First-person shooters', 'Hero shooters', 'Light gun shooters',
    "Shoot 'em ups", 'Fighting games', "Beat 'em up games", 'Stealth games', 'Survival games', 'Rhythm games',
    'Battle royale games']),
  ...F('Action-adventure', ['Survival horror', 'Metroidvania']),
  ...F('Adventure', ['Text adventures', 'Graphic adventures', 'Visual novels', 'Interactive movie']),
  ...F('Puzzle', ['Breakout clone game', 'Logical game', 'Physics game', 'Programming game', 'Puzzle-platform game',
    'Hidden object game', 'Reveal the picture game', 'Tile-matching game', 'Traditional puzzle game']),
  ...F('Role-playing', ['Action RPG', 'CRPG', 'MMORPG', 'Roguelikes', 'Tactical RPG', 'Sandbox RPG',
    'First-person party-based RPG', 'Monster-taming']),
  ...F('Simulation', ['Construction and management simulation', 'Life simulation', 'Vehicle simulation']),
  ...F('Strategy', ['4X game', 'Artillery game', 'Auto battler', 'Auto chess', 'MOBA', 'RTS', 'RTT', 'Tower defense', 'TBS',
    'TBT', 'Wargame', 'Grand strategy wargame']),
  ...F('Sports', ['Racing', 'Sports game']),
  ...F('MMO', ['MMO']),
  ...F('Other notable genres', ['Board game or card game']),
  { name: 'Casino game', family: 'Other notable genres', mark: 'refused' },
  ...F('Other notable genres', ['Digital collectible card game', 'Digital therapeutic video game', 'Gacha game']),
  { name: 'Horror game', family: 'Other notable genres', mark: 'avoid' },
  ...F('Other notable genres', ['Idle game', 'Party game', 'Photography game', 'Social deduction game', 'Trivia game',
    'Typing game']),
] as Genre[]).map((g) => Object.freeze(g)));

/** Is a declared genre acceptable? EMPTY means conformant; any line refuses the boot (a malformed declaration). */
export function genreProblems(genre: unknown): string[] {
  if (genre === undefined) return [];
  if (typeof genre !== 'string') return ['genre: must be a genre name from the engine\'s list (ADR-0156), or absent'];
  const g = GENRES.find((x) => x.name === genre);
  if (!g) return [`genre: «${genre}» is not in the engine's genre list (ADR-0156) - declare what the game plays like, or no genre`];
  if (g.mark === 'refused') return [`genre: Casino game is prohibited in this engine (ADR-0156 §2) - a cartridge that declares it does not boot`];
  return [];
}

/** The line `problems` carries for an accepted genre with a mark: Horror game plays, and the author reads why to avoid it. */
export function genreWarning(genre: unknown): string | null {
  const g = typeof genre === 'string' ? GENRES.find((x) => x.name === genre) : undefined;
  return g?.mark === 'avoid'
    ? `genre: Horror game is marked avoid - it is hard to make work for children (ADR-0156 §3); consider what else the game plays like`
    : null;
}
