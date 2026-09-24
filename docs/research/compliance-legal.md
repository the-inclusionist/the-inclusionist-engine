# Legal compliance — analysis (research)

> ⚠️ **Engineering summaries, NOT legal advice.** The summaries of laws (LGPD, COPPA, PIPL/China,
> GDPR/Nordics, ABNT, funding sources) must be **validated with legal counsel** before publishing/fundraising. The confidence
> of each point is marked. It consolidates the analysis that was in `the-inclusionist-docs · docs/2-Architecture/adr/ADR-0010-non-negotiable-pillars.yaml` (P4/P5/P6/P10).
>
> The **testable rules** derived from here are in [`../1-Discovery/NFR.md`](../1-Discovery/NFR.md) (RN-01..04, ABNT
> ¼×½). The **decisions** (local-law-wins, identity-via-gov, GPL-3.0, non-FOSS art) go in `the-inclusionist-docs · docs/2-Architecture/adr/`.

## 1. Priority model — *the local law of the deployment region wins*

It replaces the old *the strictest rule wins* (self-contradictory: China's real-name × COPPA minimisation). **The
legislation of the region where the product is deployed always prevails;** the other regimes are **a goal, as far as
possible**. Compliance is **per region**, not an impossible global superset. *(confidence: high as a principle;
per-region implementation to be validated)*

## 2. Regimes per region

| Regime | Requires (engineering reading) | Effect on the product |
|---|---|---|
| **LGPD** (BR) | minimisation, consent, rights of access/erasure, logs | local-first; nothing personal leaves the device by default |
| **COPPA** (USA) | **verifiable parental consent** before PII of under-13s | verification of the **adult**, delegated; the child's PII minimised |
| **PIPL** (China) | data of a child under 14 = sensitive; **data residency in China**; real-name | **out of the MVP** (China = a goal); real-name **only inside China** |
| **GDPR / GDPR-K** (EU/Nordics) | minimisation, ban on profiling/advertising to minors, rights | no profiling/behavioural ads for children; access/erasure |

**Honest limit:** the **code** can be *compliance-ready*, but **legal approval is external** — e.g. China requires a
**版号/ISBN (NPPA)** publishing licence + data localisation. We do not sell *approved in China*, we sell
***architected to be approvable***; only claim *approvable* with a **real local partnership** that attests it. *(confidence: medium)*

## 3. Non-negotiable data rules (RN) — the basis of the NFRs

- **RN-01 — no open data:** no open data about children. Only **anonymous** data, via a **partnership with a reputable
  institution** (which holds the IRB/ethics); **never PII**; raw data stays local/in the region. *(the premortem showed that open
  data about children = a scandal risk that kills the brand — see `AVALIACAO-ADVERSARIAL-PREMORTEM.md`)*
- **RN-02 — the adult's identity is never in the game:** whoever registers is the **adult** (teacher/guardian) via a **government
  system** (.gov in BR; RNV only inside China). We store at most a **consent token/boolean** — not the
  identity. This **does not contradict** LGPD/COPPA: identifying the adult and obtaining their consent is exactly what is required, and the child's
  PII is minimised.
- **RN-03 — real-name only inside China;** anti-addiction for **minors** (China) stays **out of the MVP**.
- **RN-04 — data residency:** telemetry of players from a country **stays on servers in that country**, unless the
  origin allows storing it elsewhere (permission from **both the origin AND the destination**).

**The *treat every user as a child* synthesis** (the most protective rule per axis): consent (COPPA+PIPL) ·
minimisation (GDPR/LGPD, local-first) · residency (RN-04) · no profiling/ads (COPPA/GDPR-K) · research data
(RN-01) · rights of access/erasure (GDPR/LGPD).

## 4. Accessibility — legal basis (the Libras window)

- **ABNT NBR 15290:2005:** a Libras window with **height ≥ ½ of the screen** and **width ≥ ¼ of the screen**. Our 420×180 panel:
  **25% width × 100% height → complies**. *(confidence: high for the metric)*
- Also **Lei 10.436/2002**, **Decreto 5.626/2005**, **LBI 13.146/2015**.
- Extra rules of the standard: (i) **nothing overlaid on the interpreter's window** (the 5px overlap is the interpreter's OVER the
  game, never the other way round); (ii) **the interpreter's skin/clothing/hair contrasting** with each other and with the background.
- If it goes to TV/VoD, check the streaming/Ancine standards. *(confidence: medium for that slice)*

## 5. Funding × licensing

- **Licence:** **GPL-3.0 code right now** (no BSL); **NON-FOSS art**; free game; bases outside the games = MIT. [Today: the code licence is AGPL-3.0-or-later (`package.json`), changed on 2026-08-25 per ADR-0010 pillar 10.]
- **Hard tension (art):** GPL/FOSS **cannot restrict the field of use** (freedom 0 / OSI no. 6) → art under the GPL =
  anyone uses it for anything. So the **art is a NON-FOSS slice** separate from the code. Protection: (a) a **registered
  trademark** of the characters (the most robust mainstay, independent of copyright); (b) an own art licence (forbids adult/
  derogatory use); (c) human authorship in the algorithm. **Caveat:** AI-derived art may be uncopyrightable →
  the **trademark** is the mainstay. The trademark is **selective** (not every character/game). Detail: `LICENCAS-GERACAO-IMAGEM.md`.
- **Sources (BR):** Rouanet (cultural framing), Ancine/FSA (audiovisual — via animation/Libras), PNLD (textbook +
  accessibility — we meet it with room to spare), FAPESP, FINEP, CNPq, BNDES, Lei de Informática. **(Nordics/EU):** Nordisk
  Kulturfond, EU programmes, EdTech philanthropy, university partnerships. *(confidence: medium — eligibility of a
  *game* case by case)*
- **Conditional (r4):** the *FOSS code + non-FOSS art* strategy is **conditional on acceptance by the funding
  sources** — if a funder requires free art, reassess case by case.

## 6.5 Additional standards (consultation with a teacher, 2026-07-05)

Standards that reinforce the pillars and must enter the conformance map:

- **GB/T 37668-2019 (China) — accessibility:** beyond WCAG 2.2 — electronic braille (adapted, not yet tested),
  **sufficient reading time**, **keyboard** navigation (not just mouse), compatibility with **third-party assistive
  technology**. *(confidence: medium — validate the translation of the standard)*
- **EN 301 549 / EAA (EU) — accessibility:** navigation **that does not depend on text** (intuitive icons + visual cues;
  e.g. the 4 digits of the filter = 4 little animals in primary/secondary colours); **a hint when stuck** (3 min without
  progress → arrows, button instructions, a demo animation) without causing anxiety; **clean design** (no explosion of colour/sound
  — autism). → operationalised in [ADR-0005](https://github.com/the-inclusionist/the-inclusionist-docs/blob/main/docs/2-Architecture/adr/ADR-0005-no-login-access-teacher-activity-code.yaml)
  and [ADR-0006](https://github.com/the-inclusionist/the-inclusionist-docs/blob/main/docs/2-Architecture/adr/ADR-0006-ethical-engagement-wellbeing.yaml).
- **China "Youth Mode":** a **40 min** lock against visual/mental fatigue (→ ADR-0006 + NFR).
- **Nordic transparency standard:** even with the data at the school, the game allows **downloading all progress**
  (portability/transparency).
- **School persistence (v2.0):** progress saved on the **school's server**, with **parental approval** → the
  LGPD/GDPR responsibility passes to the **school/network** and **stays there alone**. Out of the MVP (v2.0).
- **Analytics outside the game:** collection of behaviour (which games work/are abandoned/break) is **anonymous** and
  visible **only in a separate dashboard** (another program), **inaccessible from inside the game**; local progress (school
  network / home). It reinforces RN-01.

## 6. IP of AI image generators

Even when converting the image into an algorithm, there may be liability for **deriving from the specific expression** generated
by the service. State of the research (PixelLab/Magnific/ComfyUI/etc. licences × our GPL case) in
[`LICENCAS-GERACAO-IMAGEM.md`](LICENCAS-GERACAO-IMAGEM.md).
