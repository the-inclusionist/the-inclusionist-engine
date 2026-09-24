> Historical study (2026-09-12, revised through 2026-09-22): kept as a record; the current state lives in `app/js/core/accommodations.ts` and in the scripts listed under "How to redo it", at the end.

# The accommodations by genre — the study ADR-0145 §3 asked for

**Measured on 2026-09-12** by crossing the **35 categories** and the **380 games** of
`minigames-catalog-v2.html` with each accommodation the engine has or could have. The question, cell by
cell, is the Dev's — **«isto tem ASSUNTO aqui?»** (does this have a subject here?) — and not whether the engine
can write the value. It was the confusion between the two that produced ADR-0145, and this document is the half that
record left undone.

> ⚠️ **The classification is JUDGEMENT; the number is what is measured.** Each cell is a decision of mine about whether the
> accommodation has a subject in that genre; what the machine does is count. Where I get a cell wrong, the error
> propagates to the percentage — so the cells are all written in
> `scripts/`-adjacent code (see "How to redo it", at the end) instead of only the result.

---

## 0 · 🔴 THIS STUDY'S KEY WAS WRONG, and the correction is the Dev's

> «Você está tomando uma lista de pesquisa rápida feita em uma tarde como a lista canônica de gênero para uma
> engine que será usada por milhões de pessoas.» — the Dev, 2026-09-12

The catalogue's 35 categories are a **production backlog**, not a taxonomy. Sections 1–9 below
used them as the genre key, and that has a technical consequence and not only a naming one: the same accommodation
was spread across several keys when what governs it is **a single axis**. `balancoDaCamara` appeared under
*Corrida*, *Pseudo-3D* and *Isométrico* — and what governs it is the **perspective**. `saidaDeAudio` appeared under six
— and what governs it is the **player mode**.

### The taxonomy now comes from Wikipedia, pinned to a revision

<https://en.wikipedia.org/wiki/List_of_video_game_genres>, **revision 1367745358 of 2026-08-04**. Pinned because
a taxonomy taken from a wiki that changes every day, without saying which day it is from, is a list that one day stops
agreeing with itself with nothing to say so.

📌 **And the page itself confirms the cut the Dev asked for:** section 11 is "*Video game genres by purpose*"
(educational, serious, art…) — an AXIS, separated from the genres by the same page that lists them.

### The 35 categories become the COVERAGE PROOF, and they fit

📏 `node scripts/genre-taxonomy.mjs` — **35 of 35 mapped, 380 games**:

| top-level genre (Wikipedia) | categories | games* |
|---|---|---|
| 1 · Action | 10 | 108 |
| 2 · Action-adventure | 1 | 8 |
| 3 · Adventure | 3 | 34 |
| 4 · Puzzle | 6 | 71 |
| 5 · Role-playing | 2 | 16 |
| 6 · Simulation | 2 | 23 |
| 7 · Strategy | 2 | 16 |
| 8 · Sports | 2 | 25 |
| 10 · Other notable genres | 8 | 84 |
| 12 · Sandbox / open world | 2 | 20 |

\* ⚠️ **The column is not a partition**: a two-genre category counts in both (RPG / Aventura falls in 5 and in 3).

### 🔴 Eight categories whose NAME is not a genre — exactly the ones the Dev pointed at

| category | what it actually is |
|---|---|
| Arcade Clássico | an **era** |
| Pseudo-3D / Raycasting | a **rendering technique** → *perspective* axis (1st person) |
| Isométrico | a **perspective** |
| Multiplayer Local | a **player mode** |
| Reação / Reflexo | a **mechanic** |
| Labirinto Exploração | a **mechanic** (the page does not list "maze" as a genre) |
| Experimentais / Arte | a **purpose** — the page itself puts "art game" under "by purpose" |
| Híbridos / Mashups | **multi-genre** by definition |

📌 **And there is a ninth that is half of each:** *Educativo / Quiz* is a genre (trivia, 10.11) **and** a purpose
(educational, 11.5), and that is how the script records it.

⚠️ **Three have no genre at all to assign** — Multiplayer Local, Experimentais/Arte and Híbridos, **33 games**
— and that is not a gap: they are exactly the ones that cut across genres. An accommodation that depends on the genre
has no subject in them **through the genre**, and will have to have it through the axis.

### What is left to do in this phase (2a)

1. ✅ **Re-key the accommodations by the right axes** — done, section 0.1 below.
2. ✅ **Seed the accommodation catalogue from the GAG** — done, section 0.2 below.

---

## 0.1 · The accommodations re-keyed — ONE key each

📏 `node scripts/accommodations-by-genre.mjs`. The first version kept **35 hand-written lists**, one per
category, and so the same question was answered many times and could be answered in different ways. Now
**each accommodation has one key — an axis and the values where it has a subject —, and each category declares once the
values its games cover.** Divergence becomes impossible by construction: there is no second cell
in which to write another answer. Seven guards; **fourteen distinct mutations, fourteen red** — four of them in the new taxonomy guards.

### 🎯 The finding: half of the keys the contract ALREADY ASKS

The plan foresaw four axes (genre, perspective, player mode, purpose). Keyed one by one, the
accommodations fell into **three kinds**, and the middle one is the one that changes phase 2c:

| kind | axes | accommodations |
|---|---|---|
| **taxonomy** — what the game IS | `generos` · `perspectiva` · `jogadores` | audio output, camera sway, Easy Mode, wheelchair, detection, intensity, hint |
| 🎯 **a declaration the contract already has** | `tick` · `seguraTeclas()` · `needsPointer()` · `world()` · `topology()` | game speed, the two toggles, virtual controller, one button only, pointer stabilization, visual simulation, blind mode, audio navigation |
| ⚠️ **a declaration the contract does not ask for yet** | `avatar` · `texto` · `pecas` · `precisao` | character reduction, cane, text speed, lexical difficulty, pieces, suits, hit window |

🔴 **Nine accommodations need no genre at all**: the engine can filter them by what the game has already declared, and
six of those nine the engine already has. It is the rule of ADR-0145 working without the `genero` field — which phase 1h
had already seen in the ☝️, which disappears in a quiz because `seguraTeclas()` is `false`.

📌 **And one axis had to be DERIVED**, and it is the same rule the engine applies: the sonar needs a world
(`world: none` ⇒ "Empathy and sonar are NOT offered", `core/contract.ts` block 8) **and** a direction
(`bearing` returns `{ kind: 'none' }` in `hotspots`, `contract.ts:610`). Keyed only by the topology, blind
mode was given to Desenho, which declares `none` — measured, and corrected before writing this.

### What changed, per accommodation

| accommodation | key | before | after | why |
|---|---|---|---|---|
| blind mode · audio navigation | `espaco ∈ espacial` | 18% | **78%** | §6 said spatial world and counted 6 categories; the contract gives a direction to **every** grid and continuous space — the Tabuleiro (blindfold chess) included |
| one button only | `entrada ∈ acoes` | 36% | **93%** | with scanning, collapsing the actions has a subject in any game of actions — chess included |
| target size | universal | 61% | **100%** | the ruler of phase 5b is the INTERFACE's (menus, pad, bar), and every game has an interface |
| remap keys | universal | 62% | **100%** | every game has confirm and pause, and menus navigated by key |
| cane | `avatar ∈ anda` | 6% | 48% | the cane belongs to whoever walks on foot, and one walks on foot in far more than Platformer and Labirinto |
| gait toggle | `segura ∈ direcao·botao` | 34% | 65% | read in the titles: Tetris holds the drop, pinball holds the flipper |
| run toggle | `segura ∈ botao` | 11% | 36% | ⚠️ generalizes to **any held button** (charge power, block), not only running |
| hit window | `precisao ∈ precisa` | 34% | 53% | Shooters, Corrida, Pseudo-3D and Cartas (Speed) had one and were not counted |
| camera sway | `perspectiva ∈ 1.ª pessoa·atrás` | 6% | 23% | ⚠️ **lost Isométrico** — the isometric camera does not sway; gained the chase camera |
| pointer stabilization | `entrada ∈ ponteiro` | 7% | 23% | **it was "stroke assistance"**: the shaky hand that draws also aims and drags |
| text speed · lexical difficulty | `texto ∈ narrativo·materia` | 18% · 11% | 25% · 25% | ⚠️ lost Simulação and Estratégia, where the text is a label |
| Easy Mode | `generos ∈ 1.1` | 30% | **6%** | its physics (gravity, coins on the ground) is PLATFORM physics; "easier" in general is another accommodation, and the GAG is what names it (step 2) |
| intensity | `generos ∈ 10.6·2.1` | 10% | 2% | ⚠️ flashes left: photosensitivity belongs to scene reduction, which is universal |
| visual simulation | `mundo ∈ element` | 100% | 98% | Desenho declares `none`, and the contract refuses it the simulation |
| virtual controller | `entrada ∈ acoes` | 96% | 93% | Desenho and Sandbox are continuous pointer; Palavras gained (hangman picks letters by action) |
| game speed | `tick ∈ clock` | 82% | 82% | **the total did not change, and the composition did**: Platformer, Runner and Luta came in (the previous version had put them only in the window), Sandbox and Experimentais; Tabuleiro, Narrativo, Point-and-Click and Palavras, which are turn-based, left |

⚠️ **Easy Mode and the wheelchair fell to 22 games, and that is the study working**: mounting them
outside Platformer and Runner would be the switch with no subject that ADR-0145 exists to prevent.

### What this asks of phase 2c

The four axes the contract does not ask yet — **`avatar`, `texto`, `pecas`, `precisao`** — key seven
accommodations, and **the engine has two of them** (the cane and the character reduction, which today mount with no filter). If
they come in as fields, they come in by the rubric of `holdsAtOnce` (no safe default ⇒ mandatory) or by that of
`needsPointer` (safe default ⇒ optional). That decision belongs to 2c, and is not taken here.

> ⚠️ **Sections 1–9 below still stand as the MEASUREMENT of the first version** — their reasoning is
> what produced the lists. **Where a number of theirs contradicts the table above, the one above wins**: the whole of §1,
> §2 (the universals are TWELVE — remap and target size come in, visual simulation goes out), §5 (the tail) and the
> number in §6.

---

## 0.2 · The second column: the GAG level

📏 `node scripts/accommodations-gag.mjs` — reads the [full list](https://gameaccessibilityguidelines.com/full-list/)
live (or `--gag <copy.html>`), classifies **the 105 guidelines** (122 entries: some guidelines are listed
on more than one axis, and each counts at the BEST level it appears at) and crosses each accommodation with the reach of 0.1.

⚠️ **The GAG text does not enter the repository.** The page declares no licence; only the **slugs** (each
guideline's identifier in its URL) and the classification are kept. ⚠️ **And the page has no revision**, so the list
is pinned by fingerprint (sha256 of the axis/level/slug pairs, read on 2026-09-12): if the GAG changes, the script
fails instead of classifying a list that is no longer the one that was read. Six guards; eleven mutations. Two
survived on their own — they are the two defences against the page's sidebar, and each one covers the absence of the
other; removed together, they fail. Neither is inert.

### Where the 105 went

| destination | guidelines |
|---|---|
| **become an accommodation** | **63** |
| authoring — a design rule for whoever writes the game | 18 |
| engine rule — it already does it, with no switch (the note says where) | 10 |
| out of scope — the engine does not have the thing (online chat, vibration, PC window) | 8 |
| process — tests with people, feedback, public page | 5 |
| ⚠️ **conflict with a pillar** | **1** |

🔴 **The conflict is "allow play in both landscape and portrait"** (Advanced/Motor) against **pillar 5**
(320×180, landscape). It is not resolved in a study: it stays named.

### 🎯 The intersection the plan asked for — Basic × the engine does NOT have it

| accommodation | reach | GAG axes | where it was in the plan |
|---|---|---|---|
| target size | 100% | Motor · Vision | phase 5b ✅ |
| 🔴 **difficulty** | **100%** | Cognitive · **General Basic** | **it was not there** |
| 🔴 **one button only** | **93%** | Motor Basic | **phase 6, at 36%** |
| game speed | 82% | Motor Basic | phase 5a ✅ |
| text speed | 25% | Cognitive Basic | phase 5c ✅ |
| lexical difficulty | 25% | Cognitive Basic | phase 6 |
| controller sensitivity | 23% | Motor Basic | **it was not there** |
| camera sway | 23% | Vision Basic | phase 6, at 6% |
| distinguishable suits | 13% | Vision Basic | phase 6 |

📌 **Three readings that change the order of the phases, and none is taken here:**

1. **Difficulty is Basic and universal, and the plan did not have it.** The GAG asks for it in three guidelines — choose,
   change during play, practise without failing. The engine cannot make a game easier; it can **store,
   persist and announce** the choice, and the game reads it — the same shape phase 5a proposes for speed. The
   platform Easy Mode is an instance of it, not the accommodation.
2. **One button only leaves the tail.** In the per-category version it had 36%; keyed and with the level, it is Basic at 93%.
3. **The tail of phase 6 can no longer be ordered by reach alone**: camera sway and suits are Basic, and go
   ahead of Intermediate accommodations with twice the reach.

### What the GAG brought — nineteen accommodations: sixteen new, three the engine already had

By level: **Basic** difficulty, controller sensitivity · **Intermediate** objective reminder,
mono/stereo, interface size, rearranging the interface, skipping a section, macros, aim and
steering assistance, word highlighting, pointer colour, repeated input · **Advanced** repeat the instruction, profiles,
audio description, interval between inputs. And three that **the engine already had and the study was not counting**: controls
help (`ui/help-panel.ts`, phase 1d), sound captions (`captionsOn`) and screen reader (`core/a11y-sr`).

🔴 **A finding in passing, and it is the same pattern as `tick`:** the objective reminder is Intermediate and
universal, and the contract **already asks** every game for `objectiveOf` — with **zero readers** in `app/js`. The data is
declared in every game; what is missing is someone to say it.

### Outside the GAG — and that is not a defect

Thirteen accommodations no guideline asks for: letter case, spoken index, the two empathy simulations,
virtual controller, character reduction, cane, per-player audio output, pointer stabilization, pieces,
Easy Mode, wheelchair and detection. The simulations **are not the accessibility of whoever plays** — they are the empathy
of whoever watches —, and the others are concrete forms of more general guidelines (the cane is a form of the
"sonar-style audio map"; the virtual controller, of "large and well spaced"). ⚠️ Where the concrete form was left
without a guideline, it is because I classified the guideline under the general form: it is judgement, and it is written line by line.

---

## 1 · The result, by reach

| accommodation | does the engine have it? | genres | games | % of the catalogue |
|---|---|---|---|---|
| typography | ✅ | 35/35 | 380 | **100%** |
| letter case (CAA) | ✅ | 35/35 | 380 | **100%** |
| narration (TTS) | ✅ | 35/35 | 380 | **100%** |
| spoken menu index | ✅ | 35/35 | 380 | **100%** |
| Libras | ✅ | 35/35 | 380 | **100%** |
| sound (master + categories) | ✅ | 35/35 | 380 | **100%** |
| hearing simulation | ✅ | 35/35 | 380 | **100%** |
| high contrast | ✅ | 35/35 | 380 | **100%** |
| colour-blindness correction | ✅ | 35/35 | 380 | **100%** |
| visual simulation | ✅ | 35/35 | 380 | **100%** |
| motion reduction (scene) | ✅ | 35/35 | 380 | **100%** |
| virtual controller | ✅ | 33/35 | 363 | 96% |
| **remove/stretch the time** | ❌ | **28/35** | **311** | **82%** |
| remap keys | ✅ | 22/35 | 236 | 62% |
| **target size** | ❌ | **19/35** | **231** | **61%** |
| motion reduction (character) | ✅ | 14/35 | 155 | 41% |
| **one button only** | ❌ | 12/35 | 135 | 36% |
| **hint / highlight** | ❌ | 11/35 | 132 | 35% |
| **hit window** | ❌ | 12/35 | 131 | 34% |
| gait toggle | ✅ | 12/35 | 128 | 34% |
| Easy Mode | ✅ | 11/35 | 113 | 30% |
| **text speed** | ❌ | 6/35 | 69 | 18% |
| audio navigation | ✅ | 6/35 | 67 | 18% |
| blind mode | ✅ | 6/35 | 67 | 18% |
| per-player audio output | ✅ | 6/35 | 66 | 17% |
| run toggle | ✅ | 4/35 | 42 | 11% |
| **lexical difficulty** | ❌ | 4/35 | 41 | 11% |
| **intensity (scares, flashes)** | ❌ | 5/35 | 39 | 10% |
| **alternative pieces / decks** | ❌ | 3/35 | 39 | 10% |
| **stroke assistance** | ❌ | 3/35 | 28 | 7% |
| wheelchair | ✅ | 3/35 | 27 | 7% |
| **camera sway** | ❌ | 3/35 | 22 | 6% |
| **distinguishable suits** | ❌ | 2/35 | 24 | 6% |
| cane spacing | ✅ | 2/35 | 22 | 6% |
| **detection generosity** | ❌ | 1/35 | 9 | 2% |

---

## 2 · The universal ones are ELEVEN, and the engine has all eleven

Eleven accommodations have a subject in all thirty-five genres, and the argument is the same for all of them: **there is text,
there is sound, there is a screen and there is a menu in any game.** They are what fills the «opções gerais» of ADR-0146, and the good
news of this study is that they are **all built** — typography, letter case, narration, spoken index,
Libras, sound, hearing simulation, high contrast, colour-blindness correction, visual simulation and scene
motion reduction.

The virtual controller stays at 96% and not 100% for a reason worth saying: in the two genres left over —
Digitação and Puzzle de Palavras — the finger does not replace the keyboard, because **the keyboard is the game**. A pad of
directionals there would be the button with no subject this study exists to prevent.

---

## 3 · The engine's biggest hole is TIME, and it is not close

> **`semTempo` — 28 of the 35 genres, 311 of the 380 games, 82% of the catalogue. The engine has nothing.**

Eight settings panels, and **none touches time**. A child with a slower motor response, or who
needs one more second to think, is today shut out of four in five games of the catalogue, and there is no
switch anywhere.

The family is bigger than one entry. Adding the **hit window** (34%), time appears in three different
forms that a child feels as the same thing:

- **timer** — the maze against the clock, the WPM test, the 5-second microgame;
- **window** — Guitar Hero, the parry at the right millisecond ("no ms certo", in the catalogue), the oven that burns;
- **pace of the world** — the speed at which the enemies, the pieces or the conveyor move.

📌 And the engine has already decided this question once, on another axis: `padPxPerMm` anchors the touch target in
**real millimetres** because of WCAG 2.5.5. Time has an equivalent norm — **WCAG 2.2.1 "Timing
Adjustable"** — and nothing implements it.

---

## 4 · The second hole is TARGET SIZE, and the engine already knows how to do it

> **`tamanhoDoAlvo` — 19 genres, 231 games, 61%. The engine does not have it, and it has half of it.**

`input/touch` anchors the pad's buttons in the device's real millimetres (WCAG 2.5.5, `padPxPerMm`), with
hand classification and nine slots. That ruler exists and applies to **one** surface: the pad. The cards, the
pieces, the hidden objects, the aim trainer's targets and the match-3 tiles do not know it.

That is cheaper to fix than it looks, and it is the most obvious candidate to **reuse** instead of inventing.

---

## 5 · The per-genre tail is real, and it is small

The Dev's example, quantified: **wheelchair is in 3 of the 35 genres — 27 games, 7% of the catalogue**
(Platformer, Endless Runner and Isométrico, the three where the avatar overcomes vertical obstacles by jumping). Mounting it
universally would put a switch with no subject in front of **93%** of the catalogue.

And it is not alone in that tail:

| accommodation | genres | where |
|---|---|---|
| cane spacing | 2 | Platformer · Labirinto |
| distinguishable suits | 2 | Cartas · Cassino |
| camera sway | 3 | Corrida · Pseudo-3D · Isométrico |
| alternative pieces | 3 | Cartas · Tabuleiro · Cassino |
| stroke assistance | 3 | Desenho · Sandbox · Experimentais |
| run toggle | 4 | Shooters · Platformer · Corrida · Pseudo-3D |
| detection generosity | 1 | Stealth |

---

## 6 · ⚠️ The finding that made me stop the most: BLIND MODE is 6/35

And that does **not** mean a blind child reaches 18% of the catalogue. It means the engine has **two
different mechanisms for the same person**, and only one of them needs space:

- Where there is a **spatial world** to cross — Platformer, Labirinto, Stealth, RPG, Terror, Arcade — the child
  navigates by **cane, sonar and guide**. That is 6 genres and 67 games.
- Where **there is no space** — Cartas, Quiz, Digitação, Tabuleiro, Narrativo — the child plays through **narration and the
  spoken index**, which are universal and already built.

🔴 **So blind mode belongs to the genre and narration is general, and classifying them together would be the error symmetrical to the
wheelchair's:** giving a cane to a card game is as subjectless as giving a wheelchair to chess.
Coverage for those who cannot see stays at 100% — by two paths, not one.

---

## 7 · What this study CORRECTS in ADR-0145 §4

§4 of that record gave an initial classification "as a starting point and not as the answer". The study
confirms almost all of it and corrects one point:

| §4 said | the study measures | verdict |
|---|---|---|
| audio navigation is **general** | **6/35 · 18%** | 🔴 **wrong** — it belongs to the genre, for the reason in §6 above |
| hearing simulation is general | 35/35 | ✅ |
| low-vision/colour-blindness simulation is general | 35/35 | ✅ |
| typography, spoken index, narration are general | 35/35 | ✅ |
| wheelchair belongs to the genre | 3/35 | ✅ |
| Easy Mode (coins on the ground) belongs to the genre | 11/35 | ✅ |
| gait and run toggles belong to the genre | 12/35 and 4/35 | ✅ |
| pieces belong to the genre (board) | 3/35 | ✅ |
| **`umBotaoSo` was left unclassified** | **12/35 · 36%** | **belongs to the genre** |

📌 **`umBotaoSo` is resolved like this:** it has a subject where the game has **more than one action** *and* time
pressure — Arcade, Shooters, Runner, Platformer, Esportes, Ritmo, Reação, Party, Luta, Multiplayer, Híbridos, and
the Experimentais where "one-button games" is already a sub-genre. Where the game is already one-button, or turn-based,
there is nothing to collapse. And **the rule of what collapses into what belongs to the genre too**, which is why it cannot
be general even at 36%.

---

## 8 · What Easy Mode shows about "translating" instead of renaming

Easy Mode appears in 11 genres, but what it **means** today is platform vocabulary: "lower
gravity, higher jump, forgiving pickup, coins on the ground, no hazards and no accidental falls".

🎯 **It is the case that proves the shape the Dev asked for.** The entry is called *difficulty* and it is the same in all eleven; what
each genre declares is **what it does inside** — in Tower Defense it is more starting gold, in Tabuleiro it is
a shallower AI, in Runner it is less speed. Nothing is renamed: `easy` stays `easy` in `Player`, and what
travels by genre is the translation and the effect.

---

## 9 · Where to start, if the criterion is reach

1. **`semTempo`** — 82%, and the engine has nothing. It is the biggest accessibility hole in the catalogue and has its own
   norm (WCAG 2.2.1).
2. **`tamanhoDoAlvo`** — 61%, and half of it already exists (`padPxPerMm`); it is reuse, not invention.
3. **`umBotaoSo`** (36%), **`dicaOuRealce`** (35%), **`janelaDeAcerto`** (34%) — the second group.
4. **`velocidadeDoTexto`** (18%) — small and cheap, and it is the only one in the group that serves whoever reads slowly.
5. The tail (2–11%), when the corresponding genre arrives.

⚠️ **And there is one thing to do BEFORE any of them**, which this study makes urgent:
`ui/settings-mobility` mounts Easy Mode, the gait toggle and the run toggle **for any game**, and
the three measure 30%, 34% and 11%. It is not yet wired to `createGame`; **wiring it before the classification
would hand three switches with no subject to two thirds of the catalogue.**

---

## How to redo it

The crossing is not prose: it is written cell by cell, and the count is derived. To repeat it after
the catalogue changes, or to disagree with a cell and see the effect, there are five files:

- `scripts/lib/taxonomy.mjs` — the catalogue reader, the pinned Wikipedia revision and, per category, the
  genres, the perspective, the players and the purpose;
- `scripts/genre-taxonomy.mjs` — the taxonomy guards and the coverage (section 0);
- `scripts/lib/accommodations.mjs` — per category, the axes of the declaration (`DECL`); per accommodation, its
  key (`ACOM`); the guards and the measurement of reach;
- `scripts/accommodations-by-genre.mjs` — the table in section 0.1;
- `scripts/accommodations-gag.mjs` — the classification of the GAG guidelines by slug and the table in section 0.2.

⚠️ Disagreeing with a cell is editing **one line**: a category's declaration, or an
accommodation's key. ⚠️ **The guards check FORM, not truth** — a forgotten axis, a value that would match zero, a
key with two axes fail; a category declared with the wrong value passes, and that is why the
"why" column of 0.1 exists. The first version (the `EXTRA` map, sections 1–9) is in the history of `scripts/accommodations-by-genre.mjs` (`git log -p`).
