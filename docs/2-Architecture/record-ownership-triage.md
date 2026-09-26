# Whose record is each one — the triage before anything moves

> Written 2026-09-23, for ADR-0226 («every repository keeps the records about itself»).
>
> 📌 **Dev, 2026-09-23:** «a triagem escrita primeiro, o movimento só para o que for de um jogo, e o validador
> com `--repo` a correr dos dois lados antes e depois». This is the first of those, and nothing has moved yet.

## The method, and why it is reading and not counting

🔴 **The F12 triage failed twice by counting words**, and the lesson it bought applies here unchanged. The first
pass matched substrings, so `cidade` matched inside «acessibilidade» and `senha` inside «desenha», and the
ACCESSIBILITY modules came back flagged as a platformer's furniture. The second pass used word boundaries and
flagged them anyway, because their comments explain themselves with «a lava» and «uma moeda». What settled it was
asking what each module PUBLISHES — and for a record, the equivalent is **reading what it decides**.

So the counts below are a map of where to look, never a verdict. Every record proposed for a move was read.

## What the 228 records are, measured

| by what the `confirmed-by` names | how many |
|---|---|
| engine paths only | 70 |
| more than one repository | 0 |
| no `confirmed-by` at all | 158 |

| by what the PROSE names | how many |
|---|---|
| only the engine | 63 |
| the engine **and** at least one game | 26 |
| only a game | 17 |
| neither | 122 |

⚠️ **The 17 that name only a game are mostly not a game's**, which is exactly why the prose count cannot decide.
Reading them: ADR-0084 («topology is a function because a board can change») names `game-chess` as the EVIDENCE for
a contract decision; ADR-0097 names five games because it is about a hosting ADDRESS; ADR-0120 and ADR-0121 name
four because they are about the engine's pause menu and who consumes it. A record cites a game to make a point far
more often than to belong to one.

## The rule

A record belongs to a repository when **the thing it decides lives there**. Three families stay in `docs`
regardless of which repositories they name:

- **contract** — what a cartridge declares and what the engine guarantees (ADR-0111, ADR-0216, ADR-0224…). It
  belongs to neither side, and a folder cannot say «contract».
- **process, hosting, licences, delivery, curriculum** — what belongs to no single repository (ADR-0057,
  ADR-0058, ADR-0064, ADR-0126, ADR-0128…).
- **the engine's own** — the 70 with engine-only confirmations, and the decisions about what the engine draws,
  speaks, hears and refuses.

## The SIX that move to `game-platformer`

Each line is the sentence in the record that settles it.

> 🔴 **Correction, same day: this section said SEVEN, and ADR-0034 does not move.** It decides the password split
> `core/password` / `game/progress`, and that module did leave with the tile world (ADR-0228) — but ADR-0034 is
> `superseded` by **ADR-0037**, which stays. Moving it splits a supersession pair across two repositories: the
> old half would sit in a game's tree pointing at a successor that game does not have. **A superseded record
> belongs where its successor is.** 📏 Found by copying the files and running the validator on the game's tree,
> not by reading — which is the argument for the order ADR-0229 fixes.

| record | what it decides | the evidence |
|---|---|---|
| **ADR-0016** City scenario & themes | the city level and its themes | «Level-design detail in `../../game-design/plan-city-scenery.md`» |
| **ADR-0041** The letter grid splits | `core/letter-grid` mechanics vs. screen | same — `core/letter-grid` is the platformer's since ADR-0228 |
| **ADR-0042** The City parallax is generated art | `render/city-tiles`, `cenarios/cidade/c2..c4.png` | «both City tiles are data in `render/city-tiles.ts`» |
| **ADR-0061** The no-littering sign bars the CHILD | the recycling activity's rule and its level data | «put a PROIBIDO JOGAR LIXO sign in the platformer level» |
| **ADR-0062** The tenth coin closes a LAP | the round's lifecycle | «The platformer has ten coins as its round objective… `win()` in `game/session`» |
| **ADR-0174** The platformer's title menu leaves the engine | that menu and its 161 dictionary keys | the title says it |

📌 **Three of the six are ADR-0228's wake**: they decide about modules that were the engine's when the record was
written and are the platformer's now. That is the fifth cause the dead-pointer book learned during F12 — a pointer
that did not die and was not renamed, but changed REPOSITORY — and it applies to records exactly as it applied to
test files.

## TWO records are already broken, and F12 broke them

📏 The validator, run before anything moved, says **228 records · 226 sound · 2 with problems** — and both are
`confirmed-by` paths that left with the tile world:

- **ADR-0037** (there is no save) → `engine:tests/password.node.test.js`
- **ADR-0102** (the skip-link outranks the transition) → `engine:app/js/core/layers.ts`,
  `engine:tests/z-order-css.node.test.js`, `engine:tests/layers.node.test.js`

⚠️ **Neither of the two is a game's record**: ADR-0037 is about the project storing no child data, and ADR-0102 is
about an exit being reachable. What has to change is not their address but their CONFIRMATION, which must name the
repository where the proof now lives. That is the repair, and it is separate from the move.

🔴 And it is the exact failure ADR-0123 exists to make visible: the engine's whole suite is green while four
`confirmed-by` point at nothing. Only the validator with `--repo` sees it.

## What happens next, in order

1. The six move, with their `confirmed-by` paths rewritten from `engine:` to `game-platformer:`.
2. ADR-0037 and ADR-0102 get their confirmations repaired in place — an erratum, not a supersession: the decision
   did not change, the address of its proof did (ADR-0057's test).
3. The validator runs again with `--repo` on both sides. The number to beat is **228 · 226 · 2**.
