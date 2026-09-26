# Notice — the Piper voices are withdrawn from The Inclusionist engine

**Date:** 2026-09-14 · **Decision:** ADR-0207 (`docs/2-Architecture/adr/`) · **Work:** issue #193

## What we learned

While reading licences to mirror third-party model files, we followed each Piper voice back to where it starts. Three of the four
Piper voices the engine offered are fine-tuned from another voice, as their model cards say (`huggingface.co/rhasspy/piper-voices`,
read on 2026-09-14):

| voice | its model card | its own dataset licence |
|---|---|---|
| `pt_BR-faber-medium` | «Finetuned from U.S. English lessac voice» | CC0 |
| `en_US-amy-medium` | «Finetuned from U.S. English lessac voice» | «See URL» (unconfirmed) |
| `en_US-ryan-medium` | «Finetuned from U.S. English lessac voice» | CC BY-NC-SA 4.0 |

The `lessac` voice is trained on the **Blizzard 2013** dataset (Centre for Speech Technology Research, University of Edinburgh). Its
licence limits use to research purposes, does not allow the materials to be distributed, and excludes the development of voice
synthesis products or services.

Whether a voice fine-tuned from `lessac` is bound by that licence is a legal question we have not settled — we are not lawyers. We
could not show that the voices were licensed for what this project does with them, so we stopped using them.

The fourth voice, `es_MX-claude-high`, states no starting checkpoint on its model card. It is withdrawn with the others.

## What we did

- Removed the Piper runtime, its four voices and its phonemizer from the engine. A test fails if any of them returns.
- The browser's own voice speaks first. The only neural voice is **Kokoro-82M** (Apache-2.0 weights trained on permissive audio),
  loaded through a port the game fills.

## If you build a game on the engine

Remove the Piper provider from your game and rebuild it. The migration note is in `docs/6-DevOps-SRE/Breaking-Changes.md`.

If you hold rights in these voices or their data, or know their lineage better than their model cards do, please open an issue.
