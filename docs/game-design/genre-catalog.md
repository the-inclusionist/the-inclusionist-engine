# Genre catalog — the minigame starting-point (35 genres)

The content backlog: 35 genres / 280+ subgenres, each a mechanics **palette** to build minigames from (distilled from
the Dev's "JS Minigames" v2.0.0 catalog, which is written in Portuguese: each genre's original name follows it in
italics). **Density** = scope of a single build (light = whole game in one pass, medium = focused slice, dense =
vertical slice recommended; the catalog's own words are *leve*, *médio* and *denso*).

> 📌 **Since 2026-09-12 (ADR-0152) this catalog is a study sample, not a list to build.** Do not use its size as a cost
> or as the reason for a contract decision; measure the real consumers.

> ⚠️ **Ethics + age filter (ADR-0006):** every genre must pass before adoption — **no gambling-for-stakes** (reframe
> "luck" as probability/risk *learning*, never wagering), **no compulsion loops** (idle/clicker mechanics may teach,
> never trap for dopamine), **age-appropriate** (horror/tense genres only for older grades, if at all). The catalog is
> a palette, not a mandate.

| # | Genre | Density | Notes / flags |
|---|---|---|---|
| 1 | Classic Arcade (*Arcade Clássico*) | light | Snake, Pong, Breakout, Space Invaders, Pac-Man, Frogger… |
| 2 | Shooters (*Shooters / Tiros*) | medium | top-down, twin-stick, shmup, bullet-hell |
| 3 | Endless Runner | light | Dino, Flappy, Doodle Jump |
| 4 | Logic Puzzle (*Puzzle Lógico*) | light | Match-3, Tetris, Sokoban, Sudoku, Nonogram, Flow |
| 5 | Word Puzzle (*Puzzle de Palavras*) | light | Hangman, Wordle, crosswords, syllables/rhymes — **fits literacy** |
| 6 | Physics Puzzle (*Puzzle Físico*) | medium | Angry Birds, Cut the Rope, Plinko, dominoes |
| 7 | Memory (*Memória*) | light | Concentration, Simon, spot-the-difference |
| 8 | Platformer | medium | **the genre the engine grew out of**, now `game-platformer` — it is no longer "the MVP": what the MVP is has not been decided (ADR-0152) (single/side-scroll, precision, gravity-flip) |
| 9 | Racing (*Corrida / Racing*) | medium | top-down, pseudo-3D, time trial |
| 10 | Sports (*Esportes*) | light | basketball, penalty kick, minigolf, bowling, darts |
| 11 | Cards (*Cartas*) | medium | solitaire, blackjack, one-battle deckbuilder |
| 12 | Board (*Tabuleiro*) | medium | tic-tac-toe, Connect 4, checkers, chess, reversi, battleship |
| 13 | Casino / Luck (*Cassino / Sorte*) | light | ⚠️ **reframe as probability learning** — no wagering (ADR-0006) |
| 14 | Simulation / Idle (*Simulação / Idle*) | medium | ⚠️ **no compulsion loops** — use for management/learning |
| 15 | RPG / Adventure (*RPG / Aventura*) | dense | turn-based, dungeon crawler, mini roguelike |
| 16 | Strategy (*Estratégia*) | dense | tower defense, tactics, auto-battler |
| 17 | Rhythm / Music (*Ritmo / Música*) | medium | tap-to-beat, falling-notes, musical Simon |
| 18 | Typing (*Digitação*) | light | WPM, word-fall — **fits literacy/keyboard skills** |
| 19 | Drawing / Creative (*Desenho / Criativo*) | light | canvas, pixel-art, connect-the-dots, symmetry |
| 20 | Educational / Quiz (*Educativo / Quiz*) | light | **our current** math/literacy minigames |
| 21 | Reaction / Reflex (*Reação / Reflexo*) | light | reaction time, aiming, timing |
| 22 | Party / Microgames | medium | WarioWare (5s), local hot-seat |
| 23 | Stealth (*Stealth / Furtivo*) | medium | vision cones, patrols |
| 24 | Fighting (*Luta / Fighting*) | medium | button-mash, timing duel, parry |
| 25 | Horror / Atmosphere (*Terror / Atmosfera*) | medium | ⚠️ **age-gate** — older grades only, if at all |
| 26 | Sandbox / Physics Sim (*Sandbox / Sim Físico*) | medium | falling-sand, Game of Life, fluids — **fits science** |
| 27 | Pseudo-3D / Raycasting | dense | Wolfenstein/Doom-like, Mode-7 |
| 28 | Isometric (*Isométrico*) | medium | Q*bert, mini city-builder, iso puzzle |
| 29 | Local Multiplayer (*Multiplayer Local*) | light | co-op / hot-seat — **fits ADR-0008 (4/screen)** |
| 30 | Experimental / Art (*Experimentais / Arte*) | light | generative-art, visualizer, one-button, zen |
| 31 | Cooking & Production (*Cozinha & Produção*) | medium | assemble a recipe, conveyor belt, quality control |
| 32 | Point-and-Click / Hidden | medium | hidden-object, escape-room, fix the machine |
| 33 | Narrative & Detective (*Narrativo & Detetive*) | medium | visual novel, CYOA, investigation — **needs dialogue tree (Ink/Yarn)** |
| 34 | Maze & Exploration (*Labirinto & Exploração*) | light | maze, fog of war, random generation |
| 35 | Hybrids / Mashups (*Híbridos / Mashups*) | dense | Snake-roguelite, Tetris-combat, Quiz-RPG… |

## Method

1. Build a genre as a **lúdico** (fun first).
2. In its **beat chart**, mark **strategic points** to insert a classroom activity.
3. Reward *gently* on winning the activity (no dopamine spikes — ADR-0006).
4. Record the mechanic↔learning link in **`LM-GM-Map.md`**; the objective in `../educational/Learning-Objectives.md`.

Each genre adopted for a game becomes a GitHub issue (per-game one-sheet + its learning objective).
