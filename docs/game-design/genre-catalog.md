# Genre catalog — the minigame starting-point (35 genres)

The content backlog: 35 genres / 280+ subgenres, each a mechanics **palette** to build minigames from (distilled from
the Dev's "JS Minigames" v2.0.0 catalog). **Density** = scope of a single build (leve = whole game in one pass, médio =
focused slice, denso = vertical slice recommended).

> ⚠️ **Ethics + age filter (ADR-0006):** every genre must pass before adoption — **no gambling-for-stakes** (reframe
> "luck" as probability/risk *learning*, never wagering), **no compulsion loops** (idle/clicker mechanics may teach,
> never trap for dopamine), **age-appropriate** (horror/tense genres only for older grades, if at all). The catalog is
> a palette, not a mandate.

| # | Genre | Density | Notes / flags |
|---|---|---|---|
| 1 | Arcade Clássico | leve | Snake, Pong, Breakout, Space Invaders, Pac-Man, Frogger… |
| 2 | Shooters / Tiros | médio | top-down, twin-stick, shmup, bullet-hell |
| 3 | Endless Runner | leve | Dino, Flappy, Doodle Jump |
| 4 | Puzzle Lógico | leve | Match-3, Tetris, Sokoban, Sudoku, Nonogram, Flow |
| 5 | Puzzle de Palavras | leve | Forca, Wordle, Cruzadas, sílabas/rimas — **fits literacy** |
| 6 | Puzzle Físico | médio | Angry Birds, Cut the Rope, Plinko, dominó |
| 7 | Memória | leve | Concentration, Simon, spot-the-difference |
| 8 | Platformer | médio | **our MVP genre** (single/side-scroll, precision, gravity-flip) |
| 9 | Corrida / Racing | médio | top-down, pseudo-3D, time trial |
| 10 | Esportes | leve | basquete, pênalti, minigolfe, boliche, dardos |
| 11 | Cartas | médio | paciência, blackjack, deckbuilder-1-batalha |
| 12 | Tabuleiro | médio | velha, Lig4, damas, xadrez, reversi, batalha naval |
| 13 | Cassino / Sorte | leve | ⚠️ **reframe as probability learning** — no wagering (ADR-0006) |
| 14 | Simulação / Idle | médio | ⚠️ **no compulsion loops** — use for management/learning |
| 15 | RPG / Aventura | denso | turnos, dungeon crawler, roguelike-mini |
| 16 | Estratégia | denso | tower defense, tactics, auto-battler |
| 17 | Ritmo / Música | médio | tap-to-beat, falling-notes, Simon musical |
| 18 | Digitação | leve | WPM, word-fall — **fits literacy/keyboard skills** |
| 19 | Desenho / Criativo | leve | canvas, pixel-art, ligar-pontos, simetria |
| 20 | Educativo / Quiz | leve | **our current** math/literacy minigames |
| 21 | Reação / Reflexo | leve | tempo de reação, mira, timing |
| 22 | Party / Microgames | médio | WarioWare (5s), hot-seat local |
| 23 | Stealth / Furtivo | médio | cones de visão, patrulhas |
| 24 | Luta / Fighting | médio | button-mash, duelo de timing, parry |
| 25 | Terror / Atmosfera | médio | ⚠️ **age-gate** — older grades only, if at all |
| 26 | Sandbox / Sim Físico | médio | falling-sand, Game of Life, fluidos — **fits science** |
| 27 | Pseudo-3D / Raycasting | denso | Wolfenstein/Doom-like, Mode-7 |
| 28 | Isométrico | médio | Q*bert, city-builder-mini, iso puzzle |
| 29 | Multiplayer Local | leve | co-op / hot-seat — **fits ADR-0008 (4/screen)** |
| 30 | Experimentais / Arte | leve | generative-art, visualizer, one-button, zen |
| 31 | Cozinha & Produção | médio | montar receita, esteira, controle de qualidade |
| 32 | Point-and-Click / Hidden | médio | hidden-object, escape-room, consertar máquina |
| 33 | Narrativo & Detetive | médio | visual novel, CYOA, investigação — **needs dialogue tree (Ink/Yarn)** |
| 34 | Labirinto & Exploração | leve | labirinto, neblina-de-guerra, geração aleatória |
| 35 | Híbridos / Mashups | denso | Snake-roguelite, Tetris-combate, Quiz-RPG… |

## Method

1. Build a genre as a **lúdico** (fun first).
2. In its **beat chart**, mark **strategic points** to insert a classroom activity.
3. Reward *gently* on winning the activity (no dopamine spikes — ADR-0006).
4. Record the mechanic↔learning link in **`LM-GM-Map.md`**; the objective in `../educational/Learning-Objectives.md`.

Each genre adopted for a game becomes a GitHub issue (per-game one-sheet + its learning objective).
