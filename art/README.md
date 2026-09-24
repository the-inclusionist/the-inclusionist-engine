# `art/` — the imported art, and the ledger that says where it came from

This folder holds art from outside. It is not a quarantine, and it used to be: until 2026-09-09 it was called `art/lcp/` and
existed to hold a wall around CC BY-SA material. The wall came down when **ADR-0133** changed the
question — it stopped being *which family does the licence belong to* and became **may the project use this**.

## The four questions

1. **May we DERIVE?** The pipeline is a derived-work machine, and recolouring is already deriving.
2. **May it be used COMMERCIALLY?** Not because the project sells: because the art **can never be narrower
   than the code**. The AGPL invites commercial use, and a sprite cannot block whoever it invites.
3. **May we CONVEY the file in what we publish?** 🎯 This one neither approves nor refuses — **it ROUTES**. What can
   be conveyed travels with us; what cannot is fetched from the source by whoever installs. See "The delivery", below.
4. **Does anything TRAVEL from the source to our output?** If nothing travels, it costs a line in the ledger. If
   copyleft travels, it is the third door.

## The three doors

| door | what it is | what the ledger row carries |
|---|---|---|
| `licenca` | a public licence that has already been measured and passed | the identifier (`CC0-1.0`, `CC-BY-4.0`, `OGA-BY-3.0`, `MIT`…) |
| `concessao` | the author wrote the permission, with no known licence name | the **URL** where the grant is written |
| `ponte` | copyleft CC BY-SA, converted into `GPL-3.0-only` in our output | source licence, `licenca-de-saida` and what it derived from |

📌 **A new name is not refused, it is REFERRED.** If the licence has not been measured yet, the row fails with the
message saying what to do: answer the four questions in a record and add the name. That is the difference
between a list and a stranglehold.

🔴 **And what has no door at all: ND and NC.** ND forbids deriving, and the pipeline could not even swap
the palette. NC would make the art narrower than the code, and its boundary is genuinely undefined —
a municipal deployment sits right on it.

## The admitted sources (the Dev's decision, 2026-09-09)

These come in **before any of the project's own art**:

| source | door | what the licence requires of us |
|---|---|---|
| **Kenney** · `kenney.nl/assets` | `licenca` · CC0-1.0 | nothing. The ledger row is for provenance |
| **ansimuz** · `ansimuz.itch.io` | `licenca` · CC0-1.0 | nothing — but **per pack**: the profile grants nothing |
| **Tiny Swords** · `TS_old version_CC0 Licensed` | `licenca` · CC0-1.0 | nothing; the row cites the `LICENSE` inside the zip |
| **Tiny Swords** · current Free Pack | `concessao` · delivery `pessoa` | the author's terms, the URL in the row, and the file **does not come in** |
| **Liberated Pixel Cup** | `ponte` · CC-BY-SA-3.0 → `GPL-3.0-only` | attribution, GPL notice, **modifiable source**, and adaptation only — ⚠️ the modifiable source does not exist yet, so this door is described and not open ([`../docs/LICENSES.md`](../docs/LICENSES.md) §3) |

## The ledger

`ATTRIBUTION.csv` — one row per resource, and the gate `tests/art-licences-accepted.node.test.js` fails a
file with no row and a row with no file.

| column | what it carries |
|---|---|
| `caminho` | from the repository root; it has to start with `art/` |
| `autor` | who made it. Empty **fails** — *I could not find out* is not a licence |
| `fonte` | the **URL** of the source page. Empty or with no URL **fails** |
| `porta` | `licenca` · `concessao` · `ponte` |
| `licenca` | the identifier, or the grant's URL, or the bridge's source licence |
| `licenca-de-saida` | only on the bridge, and it has to be exactly `GPL-3.0-only` |
| `entrega` | `repositorio` (travels with us) or `pessoa` (whoever installs fetches it, from the source) |
| `derivado-de` | which resources this one derived from, separated by `;`. Mandatory on the bridge |

## 🎯 The delivery — question 3 does not approve, it ROUTES

May we convey this? is not an admission criterion: it decides **which way the file arrives**.

- **`repositorio`** — we may redistribute, so the art travels with us and the gate requires the file to exist.
- **`pessoa`** — we may not redistribute. The row exists in the ledger, but the **file does NOT come into this tree
  nor into the package**; whoever installs fetches it from the source. The gate asserts the **absence**: if the file shows up here,
  it fails.

⚠️ **And the distinction is not subtle for an asset pack.** A grant that allows using the art **in a game**
does not allow **equipping an engine with the whole pack** and handing it to every game built on it — that is repackaging,
which is what the author's sentence refuses. Asking them for authorization would be asking permission for exactly that.

📌 **The precedent is ADR-0108**, and it is identical: the Ronde font cannot be packaged, so the
download is offered and the option stays disabled while the file is not present.

🔴 **And the automatic version of this does not exist, measured on 2026-09-09:** neither `itch.io` nor `kenney.nl` sends
a CORS header, and itch has no stable direct link (`/download` answers 404 without a session). The heavy-file
fetcher works with Hugging Face and jsDelivr because **they** send the header. The engine cannot
fetch from there — only a person can. ⚠️ That does not affect Kenney, which is CC0: since we may redistribute,
we serve it ourselves, and CORS stops mattering. **The obstacle only bites where the licence already forbade us to serve.**

⚠️ **The `fonte` column is a URL for a reason that was measured.** A downstream declaration is a clue and not an
authority: `ElizaWy/LPC` declares everything CC BY 3.0 or OGA-BY 3.0, and one of the pages its credits
cite grants only CC-BY-SA 3.0 and GPL 3.0. The check against the source needs a network and is in
[#140](https://github.com/the-inclusionist/the-inclusionist-engine/issues/140).

**Today the ledger is empty.** No resource has come in yet.
