# game-design/ — game craft layer

The game-craft artifacts adopted in **[ADR-0009](https://github.com/the-inclusionist/the-inclusionist-docs/blob/main/docs/2-Architecture/adr/ADR-0009-game-documentation-subset.yaml)** — the
"how the game plays" side, parallel to `../educational/` (the "what is learned" side). Kept **light**: 200+ minigames
means per-game docs are one-sheets, not full GDDs.

## The approach (Dev's goal)

Build the minigames as **lúdicos** (genuinely playful) first, then insert **classroom activities at strategic
points**, rewarding the child *gently* after they win the activity — the same path taken with the math/literacy
minigames so far. The artifact that names *where* a mechanic can carry a learning objective is the **LM-GM map**.

## Artifacts

- **[genre-catalog.md](genre-catalog.md)** — the 35-genre starting-point catalog (the content backlog of minigames).
- **`LM-GM-Map.md`** *(to create)* — Learning-Mechanic ↔ Game-Mechanic mapping: which minigame mechanic can carry
  which learning mechanic (ties `genre-catalog` ↔ `../educational/Learning-Objectives.md`). The insertion-point artifact.
- **[Art-Bible.md](Art-Bible.md)** ✅ — visual style guide (index of the visual system).
- **[character-animation.md](character-animation.md)** ✅ — layered character + animation spec (was `ANIMACOES-PERSONAGEM`).
- **[typography.md](typography.md)** ✅ — canonical font system, evidence-based (was `referencia-tipografica-projeto-v6`).
- **[Game-Feel.md](Game-Feel.md)** ✅ — juice/feel/camera (ADR-0018; audio-feel points to `../1-Discovery/plano-audio-fase-f.md`).
- **[LM-GM-Map.md](LM-GM-Map.md)** ✅ — the learning↔game-mechanic insertion-point map (seed).
- **Art pipeline plans:** [plano-arte-procedural.md](plano-arte-procedural.md) · [plano-tiled-aseprite.md](plano-tiled-aseprite.md).
- **Level design:** [plano-cenario-cidade.md](plano-cenario-cidade.md) (the city level; its beat chart marks activity insertion points).
- **Per-game one-sheets** — a short pitch + core loop + its learning objective, created as each minigame is built.
- **Engine (TDD)** stays in `../2-Architecture/` + `../2-Architecture/plano-engine.md`; **map/art tooling** in `plano-editor-mapa.md`.

## Not here (ADR-0009)

Networking (netcode/replication/determinism/lag-comp) is **deferred to the internet-MP tier** (ADR-0008); matchmaking,
MMO sharding, virtual economy, and live-ops are **rejected** (cooperative, no monetization, anti-dark-pattern).
