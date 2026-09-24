---
title: Licences of AI image generators — compatibility with our case
type: research
status: draft (validate with legal counsel)
created: 2026-06-01
---

Historical study (2026-06-01): kept as a record; the current state lives in `docs/LICENSES.md` and `docs/research/compliance-legal.md`.

# AI image-generation licences × our case

**Our case:** a **free** educational game, **open source under GPL-3.0 right now** (no BSL); **non-FOSS
art** (see its own section). [Today: the code licence is AGPL-3.0-or-later (`package.json`), changed on 2026-08-25 per ADR-0010 pillar 10.] The art is **data/code** (arrays + hex palette), **not PNG**. Flow:
**AI generates a reference spritesheet → a human writes an algorithm that reproduces similar art as
data → public repo → third parties (including companies in China/the Nordics) can copy and deploy.**

> ⚠️ **This is not a legal opinion** — it is an engineering risk assessment of the text of the ToS.
> Items marked ⚖️ require an IP lawyer in the jurisdiction(s).

## Two principles that decide everything

**1. Idea × expression.** Copyright protects **specific expression**, never an idea/style/method.
A pixel-art *style* (e.g. a green 16×16 slime that bounces in 4 frames) is **not** protectable; the
**specific arrangement of pixels** of a generated image **may** be — *if* someone holds copyright
in it (see principle 2). → **Re-deriving** the look with our own pixels = copying the **idea** (low
risk). **1:1 pixel-tracing** (sampling the exact pixels) = copying the **expression** (risk). ⚖️
**Hard rule for the team: never 1:1 pixel-tracing.** Reimplement the *style* as original data.

**2. AI output may have no copyright — and that cuts both ways.** The US Copyright Office (2025;
*Thaler*; *Zarya*) holds that a purely prompt-generated image **has no human authorship → no
copyright**. In favour: if the reference has no copyright, there is nothing to infringe (only the
**contract**/ToS remains). Against: your AI-derived art-as-data is also **weak in protection** — a
third party that copies the repo is not easily barred (but the **code** remains protected under
BSL/GPL). The trap: the **contract (ToS) binds you even when copyright does not** (e.g. a clause saying you
own the output **and** one saying you may not use the output to train/compete coexist).

## Verdict per service (for OUR flow)

| Service | Owner of the output | Redistribute in a public repo | Derivative/compete restriction | Indemnification | Verdict |
|---|---|---|---|---|---|
| **PixelLab.ai** | **You** | **Yes** (use, modify and distribute … for any purpose) | only no **training a model** with the images | none | 🟢 **SAFE** (best contractual fit) |
| **ComfyUI + SDXL/SD1.5** (Open RAIL-M) | You | Yes | only prohibited use (illegal/harmful); no revenue cap | none | 🟢 **SAFE** (self-hosted) |
| **ComfyUI + FLUX.1 [schnell]** (Apache 2.0) | You | Yes | none | none | 🟢 **SAFE** (Apache = GPL-compatible) |
| **Scenario.gg** | **Assigned to you** | Yes | base: no cap | — | 🟢 **SAFE** (focused on game assets) |
| **Adobe Firefly** (paid) | Commercial use | Yes | standard | ✅ **YES (it indemnifies!)** | 🟢 **SAFE + the only one with indemnification** |
| **Magnific/Freepik** (paid) | You | Yes, but AI output is **excluded** from their legal protection | standard | partial | 🟡 **RISK** — the live ToS blocked the fetch; **re-read** ⚖️ |
| **Leonardo / Recraft** | paid: you / **free: the service (public)** | paid: yes / **free: no** | standard | — | 🟡 **only on the paid plan** (free = AVOID) |
| **SD 3/3.5** (Stability Community) | You | Yes | **the licence dies above US$1M/year** | — | 🟡 **RISK for 3rd-party deployment** (the revenue cap travels with the model) |
| **Midjourney** | You (>US$1M requires Pro) | Yes | US$1M cap; **zero indemnification** | none | 🟡 **RISK** (revenue cap) |
| **OpenAI gpt-image/DALL·E** | Assigned to you | Yes | usage policies | none | 🟡 **OK only as a reference** (the assignment may be empty) |
| **FLUX.1 [dev]** (BFL NC) | usable output, **non-commercial model**; you indemnify BFL | model not for commercial deployment | **no training/competing** | you→BFL (one-sided) | 🔴 **AVOID** (a 3rd party cannot run the model) |
| **Higgsfield.ai** | a **perpetual licence over your inputs AND outputs** for training | no explicit permission | broad | you→company (one-sided) | 🔴 **AVOID** |

## Bottom line for us

1. **The step from reference to hand-written data algorithm is our best legal defence** —
   it copies the **idea/style** (not protectable), not the **expression**. *Hard rule: never
   1:1 pixel-tracing; reimplement the look as original data; record which tool/plan
   generated each reference.*
2. **Recommended stack** (survives the test of a company in China/the Nordics copying and deploying it):
   **PixelLab.ai**, **SDXL/SD1.5**, **FLUX.1 schnell (Apache)**, **Scenario.gg**. If there is budget
   for 1 indemnified tool, **Adobe Firefly**.
3. **Avoid terms with a revenue cap** in a public repo (SD3/3.5, Midjourney) and **FLUX dev /
   Higgsfield**.
4. **🟢 A shortcut we already have:** **the Dev's own Nanobanana** art is already **IP-clean and authorised**
   (CLAUDE.md §2.11). Using it as the reference **entirely eliminates** the generators' IP question.
   *The red team's recommendation: start with it.*

## Licence strategy for OUR art (requirement: NON-free art)

The Dev requires that **our characters NOT be free to use** (e.g. not appear in adult
products). **A fundamental conflict with FOSS:** a **FOSS/GPL licence cannot restrict the field of
use** (freedom 0; OSI no. 6, "No Discrimination Against Fields of Endeavor"). If the art-as-data is in the
repo under the GPL, **anyone can use it for any purpose**. One cannot have, at the same time,
art that is **(i) FOSS** and **(ii) restricted in use**.

**Decision:** the project will be **FOSS code (GPL-3.0) + non-FOSS ART** — **conditional on
acceptance by the funding sources** (if a funder requires free art, reassess case by case) and
with a **SELECTIVE trademark** (not every character/game will be registered). Mechanisms, from the most robust to
the weakest:
1. **Registered trademark** of the characters (names + signature design). **The mainstay of
   protection** — it bars use that causes confusion/dilution of the mark, **independent of copyright** (so
   it survives the uncopyrightability of AI output).
2. **An own (non-FOSS) art licence** over the **art data** (sprite/palette) and/or the
   **character-composition algorithms**: forbids adult/derogatory use, requires attribution,
   forbids open sublicensing. It keeps the **engine** FOSS and isolates the **art** in a restricted slice.
3. **Human authorship** in the procedural algorithm: the more the human creates/selects/modifies (vs.
   a pure prompt), **the stronger the copyright** over the art — making licence (2) enforceable.

**Critical caveat:** **AI-derived art may be uncopyrightable** → licence (2) may be
**unenforceable** on its own; that is why (1) the **trademark** is indispensable.

**Check on the generator (PixelLab is the best candidate):** does the licence allow us to (a) use it in
**free software** (✔ any purpose), (b) **redistribute** the derived art (✔), and (c) **impose our own
terms downstream** — here uncopyrightability limits us; the robustness comes from the **trademark**.

**Explicit trade-off:** this **dents** the ideal that any company copies and deploys EVERYTHING (P10): the
engine is free, but the **characters are not** — a third party must respect the art licence / the
trademark, or swap the art. It is common in OSS games (free code + restricted assets) and **acceptable**
given the child-protection requirement. FOSS-purist calls for funding usually look only at the **code** (ok);
few may require free assets (flag).

⚖️ **For a lawyer:** the idea×expression line per sprite; Magnific's live ToS; whether the no-training clause
reaches algorithmic extraction (almost certainly not); enforceability of ToS against
third parties that did not accept them; the BSL 1.1 + AI-derived art combination.

*(Primary sources with URLs are in the subagent's report; reconfirm before publishing.)*
