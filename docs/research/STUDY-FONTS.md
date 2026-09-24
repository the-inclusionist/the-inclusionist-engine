Historical study (2026-06-02): kept as a record; the current state lives in `docs/game-design/typography.md`, `app/js/ui/fonts.ts` and `app/css/style.css`.

# Font study — The Inclusionist / EdSP

> Goal: consolidate or propose changes to the project's set of fonts. **Where the study converges with the current choice, the font becomes official**; where it diverges, a **proposal** follows for the Dev to decide. Date: 2026-06-02.

## 0. OFFICIAL ROSTER (the Dev's decision, 2026-06-02)

> ⭐ **CANONICAL document:** `../game-design/typography.md` (the former `referencia-tipografica-projeto-v6` — the Dev's complete research: orders of preference per role, empirical evidence and ABNT/DOI references). This `STUDY-FONTS.md` and `RESEARCH-FONTS-CONDITIONS-LITERACY.md` were **drafts that fed v6** — in case of conflict, **the canonical one prevails**.

### Core of defaults (what goes in as the default in the game)
- **General default:** **Atkinson Hyperlegible** (OFL) — legibility/low vision; a "0" with its own stroke, distinct 1/l/I.
- **Literacy:** **Andika** (SIL OFL) — beginning readers; alternative forms of a/g/t as per the BNCC.
- **Optional (dyslexia/dyscalculia/ADHD):** **Lexend** (OFL) — selectable at any time.
- **Mathematics (column arithmetic/tables):** **Atkinson Hyperlegible Mono** (OFL) — clear digits + fixed width; formulas via **STIX Two Math** (MathJax) or **KaTeX**.
- **Braille (to embed):** **Braille CC0** (public domain) — no licensing pain.
- **Other fonts in the study** (screens, titles, small sizes, books, writing, code, chemistry, icons, calligraphic, **and OpenDyslexic/Dyslexie**) → **are NOT canonical**; used **only when necessary**, following v6's orders of preference. (Accessibility for dyslexia is solved by **spacing**, not by switching fonts — see below.)

### Spacing — what actually solves it (v6 §1/§7)
*The real reading gain comes from spacing, not from a *magic font*.* That is why the **game's *dyslexia mode* is a SPACING TOGGLE**, not a font switch. [Today: the BDA spacing (0.18em/0.63em) is the default for every non-cursive face since 2026-09-12 (ADR-0149 §2, `app/css/style.css`); it is no longer a dyslexia-mode toggle.]

**DEFAULT spacing (WCAG 2.2 §1.4.12 minimums):**
| Measure | Value |
|---|---|
| Line spacing (line-height) | **1.5×** (150%) |
| Between letters (letter-spacing) | **0.12em** |
| Between words (word-spacing) | **0.16em** |
| Between paragraphs | **2.0×** |

**DYSLEXIA toggle (British Dyslexia Association + spacing studies):**
- Rule: **space between words ≥ 3.5× the space between letters**; line spacing 1.5/150% (ideal); letter spacing **≈35% of the average letter width**, **without overdoing it** (excess reduces legibility).
- For the core sans faces (Atkinson, Inter, Andika), average width ≈ **0.5em** → 35% ≈ **0.17–0.18em**.
- **Toggle values:** `letter-spacing: 0.18em` · `word-spacing: 0.63em` (= 3.5×0.18) · `line-height: 1.5`.

**Colour/contrast:** a **cream/pastel** background (not pure white), dark text. **Economy of families** (few families, many weights).

### Licences that require action before embedding (v6 §6)
Clash Display (ITF), APHont/Luciole (restrictive), Bembo/Plantin Infant + Sassoon (paid, Monotype), **Kindergarten Pro** (BR, paid, aimed at print → confirm app use with Just in Type), Braille Neue (no open licence → use Braille CC0), iA Writer Quattro/MonoLisa/Victor Mono (check the terms). A free lead for BR cursive: **Letra Escolar Brasileira (UFRGS)** — check the licence (it may spare us Kindergarten).

*§3 below is the initial comparative study (draft); the living reference is v6.*

## 1. Project constraints (pillars that weigh on the choice)

- **A11y first (WCAG 2.2 AAA + GAG).** Dominant criterion: real legibility and character differentiation (I/l/1, O/0, rn/m), not aesthetics.
- **i18n (Nordic portfolio) + PT-BR.** Every text font must cover the Portuguese diacritics (á â ã à ç é ê í ó ô õ ú) **and** the Nordic ones (å ä ö ø æ œ ð þ í ý). Decorative fonts (calligraphic/blackletter) may have partial coverage → they need a fallback.
- **Offline (PWA + Electron + Capacitor).** No dependency on a CDN: **every font is self-hosted** (`@font-face` + subset `woff2` in the bundle). This turns *using the font* into ***packaging/embedding** the font* → the relevant licence is **embedding in an app/web/eBook**, not just *desktop*.
- **Licence: GPL-3.0 code + non-FOSS _assets_ allowed.** Fonts go in as an **asset** (like the art): an embedded proprietary font **does not contaminate** the GPL code, as long as it is distributed under its own embedding licence. Even so, **preferring libre (OFL)** reduces friction; paid ones only where there is a pedagogical reason. [Today: the code licence is AGPL-3.0-or-later (`package.json`), changed on 2026-08-25 per ADR-0010 pillar 10.]
- **BR public-school hardware (Positivo/Chromebook).** woff2 subset per language; avoid too many weights; `font-display: swap`.

## 2. Evaluation criteria (each font is scored on these axes)

1. **Legibility/evidence** (research, not opinion).
2. **Character differentiation** (critical for low vision and dyslexia).
3. **Glyph coverage** (PT + Nordic).
4. **Licence for embedding** (web/app/eBook) and **cost**.
5. **Availability** (Google Fonts/SIL → trivial self-hosting vs. a commercial foundry).
6. **Pedagogical fit** (when applicable: handwriting/literacy).

## 3. Summary table (verdict)

| Role | Current (the Dev's) | Licence | The study's verdict |
|---|---|---|---|
| **Default UI** | Atkinson Hyperlegible | OFL (Braille Institute) | ✅ **OFFICIAL** — converges |
| **Accessible alt.** | OpenDyslexic | OFL | ⚠️ **DIVERGES** — keep as a subjective _option_; **add Lexend** (better evidence) as the default alternative |
| **Book/reading serif** | Literata → Garamond (fb) | OFL (Literata) | ✅ **OFFICIAL** — converges (Literata is designed for long on-screen reading) |
| **Default serif (screen)** | Merriweather → Times (fb) | OFL (Merriweather) | ✅ **OFFICIAL** — converges |
| **Default sans** | Ubuntu → Lato → Arial/Helvetica (fb) | **UFL** (non-OFL) / OFL (Lato) | 🟡 **OFFICIAL with a caveat** — Ubuntu can be embedded, but it is UFL; see §6. A 100%-OFL alternative: **promote Lato to default** |
| **English calligraphic** | Great Vibes, Pinyon Script | OFL | ✅ **OFFICIAL** — converges (decorative use; fallback for missing glyphs) |
| **Blackletter** | UnifrakturCook, UnifrakturMaguntia | OFL | ✅ **OFFICIAL** — converges (decorative) |
| **Ball-and-stick (children)** | Comic Neue | OFL | 🟡 **OFFICIAL with a proposal** — Comic Neue works; **evaluate Andika** (SIL, made for literacy/beginning readers, true ball-and-stick, full coverage) |
| **Pedagogical handwriting — BR** | **Kindergarten Pro** (paid) | **Commercial** | ✅ **KEEP** (non-negotiable) — the de facto standard of BR publishers; license embedding (§6) |
| **Pedagogical handwriting — EU/CA/US** | **Learning Curve** (supposedly paid) | **FREE for commercial use** | ✅ **KEEP** — **correction: it is NOT paid** (Blue Vinyl/Jess Latham); a licence saving (§6) |

## 4. Analysis per role

### 4.1 Default UI — Atkinson Hyperlegible ✅
Created by the **Braille Institute** for **low vision**, with **exaggerated** character differentiation (each letter as distinct as possible: I/l/1, O/0). It is the best match for the a11y pillar for UI/HUD. **Converges → official.** (OFL, on Google Fonts → trivial self-hosting; covers Latin Extended, fine for PT+Nordic.)

### 4.2 Accessible alternative — OpenDyslexic ⚠️ (diverges)
The **evidence is weak/negative**: a peer-reviewed study (Wery & Diliberto, 2017) found no gain in speed/accuracy and readers **preferred Arial/Helvetica/Verdana** to OpenDyslexic. Typographers' recommendation (Pimp my Type, Access-Ability) is the same: *dyslexia* fonts lack robust support; what helps is **good general legibility + differentiation**.
- **Proposal:** keep OpenDyslexic as an **option** (some people subjectively _prefer_ it, and that has comfort/choice value — it aligns with GAG's *let the user choose*), **without selling it as more effective**. As the **de facto default alternative**, add **Lexend** (OFL; designed on the basis of reading-proficiency research — "reading proficiency"). The a11y selector would then offer: *Atkinson (default) · Lexend (high legibility) · OpenDyslexic (personal preference)*.

### 4.3 Book/reading serif — Literata ✅
**Literata** (Google, OFL) was designed for **Google Play Books** — long reading on e-ink/LCD screens. Perfect for *simulating books* in the activities. Garamond fallback (system/EB Garamond OFL). **Converges → official.**

### 4.4 Default serif (screen) — Merriweather ✅
**Merriweather** (OFL) is a high-legibility serif designed for screens (generous x-height, moderate contrast). Times fallback (system). **Converges → official.**

### 4.5 Default sans — Ubuntu 🟡 (licence caveat)
**Ubuntu** is highly legible, but it is under the **Ubuntu Font License (UFL)**, **not OFL**. The UFL **allows packaging/embedding/redistributing** the font (and documents made with it need not be UFL), so it **can be used** in the PWA/app. Caveat: the UFL is *font copyleft* and has its own rules (the font/derivatives cannot be relicensed) — a governance friction that OFL does not have.
- **Proposal:** keep Ubuntu as the default **OR** promote **Lato** (already your 2nd) to default to be **100% OFL** across the whole sans stack. A governance decision, not a legibility one (both are excellent). Fallbacks Lato → Arial/Helvetica (system). 

### 4.6 English calligraphic — Great Vibes / Pinyon Script ✅
Both OFL (Google Fonts). **Decorative** use (titles, certificates, *nice handwriting*). Glyph coverage is smaller (focus on basic Latin + some accents) → **always with a fallback** (Literata/Atkinson) for texts with Nordic characters. **Converges → official** in the decorative role.

### 4.7 Blackletter — UnifrakturCook / UnifrakturMaguntia ✅
Both OFL. UnifrakturMaguntia has good German/Latin coverage; decorative use (medieval/gothic themes). **Converges → official.** (Confirmed: "Maguntia" = **UnifrakturMaguntia**.)

### 4.8 Children's ball-and-stick — Comic Neue 🟡 (proposal)
**Comic Neue** (OFL) is the *clean* version of Comic Sans — friendly, informal, good for children. It works as a friendly print-handwriting face. **However** it is not a true pedagogical "ball-and-stick" (the primer's block letter).
- **Proposal:** for the **literacy ball-and-stick letter** (BR starts with block/ball-and-stick before cursive), evaluate **Andika** (SIL, OFL) — designed **specifically for literacy and beginning readers**, with unambiguous "ball-and-stick" letterforms (single-storey a, single-loop g), full Latin coverage. Suggestion: **Andika = ball-and-stick/literacy**, **Comic Neue = *friendly/informal*** (speech balloons, dialogue), distinct roles.

### 4.9 Pedagogical handwriting fonts (paid) — licensing analysis → §6

## 5. Convergences × Divergences (executive summary)

- **Already official (converges):** Atkinson Hyperlegible (UI), Literata (book), Merriweather (serif), Great Vibes/Pinyon (calligraphic), UnifrakturCook/Maguntia (blackletter), Learning Curve (Anglo cursive), Kindergarten Pro (BR cursive — kept by decision).
- **Diverges / proposal (the Dev's decision):**
  1. **OpenDyslexic** → a subjective option + **add Lexend** as the high-legibility alternative.
  2. **Sans**: Ubuntu (UFL) vs **promoting Lato (OFL)** to default — licence governance.
  3. **Ball-and-stick**: **Andika** for literacy; Comic Neue moves to *friendly/informal*.

## 6. Licensing of the pedagogical fonts (the sensitive point)

> The Dev's decision: **using Kindergarten Pro (BR) and Learning Curve (EU/CA/US) is non-negotiable.** The study analyses what is possible/necessary — without proposing to abandon them.

### 6.1 Learning Curve (EU/CA/US) — **finding: it is NOT paid**
**Learning Curve** (and **Learning Curve Pro**, with *Dashed*/*Dings* versions for tracing) by **Jess Latham / Blue Vinyl Fonts** is **free for personal AND commercial use** (available on Font Squirrel with a usage licence, and on bvfonts.com). 
- **Implication:** **no licence cost** and it **can be self-hosted** (`@font-face`/woff2) in the app. The author asks, as support, that one consider buying his other fonts — optional.
- **Action:** confirm the specific EULA of the downloaded package (Font Squirrel shows the licence) and **archive the licence `.txt`** next to the asset (`/fonts/learning-curve/LICENSE`). Risk: **low**.

### 6.2 Kindergarten Pro (BR) — **commercial, requires an embedding licence**
The **Kindergarten** family is the **de facto standard of Brazilian publishers** for literacy material (a package of ~10 fonts: 4 cursives that simulate school handwriting + **Kindergarten Dashed** for dotted tracing), respecting the tradition of the **cartilha** (primer). The **Pro** version is **commercial**.
- **What is needed (PWA/Electron/Capacitor = embedding):** an **_app/web embedding_ licence** (not just desktop). Typical foundry models: per **app**, per **brand**, or per **monthly active users** — a cost of tens to hundreds of USD per usage tier; eBook/broadcast add up.
- **Actions (to do before embedding):**
  1. **Identify the exact foundry/distributor** of "Kindergarten **Pro**" (there are homonymous variations; confirm authorship and EULA — probably of Brazilian origin tied to textbook material).
  2. Request a **quote for an embedding licence for app + web** covering PWA, Electron (desktop) and Capacitor (mobile), and **free/funded distribution** (the game is free — confirm whether the foundry charges per downloads/users).
  3. Check the **right to subset** (subset woff2) — some EULAs forbid modifying/subsetting; we need it for the size on school hardware.
  4. **Archive the licence** and the receipt; keep the font **outside the GPL code** (a non-FOSS asset, like the art).
- **Risk/friction:** **medium-high** (cost + embedding terms + subsetting). **Mitigation while the licence is not closed:** use an **OFL placeholder** for BR cursive during development (e.g. the free literacy cursives from the "Be-a-bá"/dafont collection with a commercial licence) and **swap in Kindergarten Pro in the production build**, isolating the paid dependency.

### 6.3 Why two distinct pedagogical fonts (BR × EU/CA/US)?
It is not a whim: **handwriting models differ by curriculum**. **Brazil** teaches **ball-and-stick first and then vertical cursive** (it replaced Palmer/roundhand); the material must match the Brazilian **cartilha** → **Kindergarten**. EU/Anglo use another cursive stroke → **Learning Curve**. Using the *wrong* font per region **conflicts with the local school material** — hence the separation is pedagogical, not aesthetic.

## 7. Glyph coverage / i18n (mandatory check before making it official)

- **Cover PT + Nordic (Latin Extended):** Atkinson, Literata, Merriweather, Lato, Ubuntu, Lexend, Andika — OK.
- **Partial coverage (decorative) → need a fallback:** Great Vibes, Pinyon Script (basic Latin+; check ø/å/æ), UnifrakturCook/Maguntia (German ok; check Nordic). **Rule:** decorative faces **never** alone in multilingual running text — always `font-family: 'Great Vibes', 'Literata', sans-serif`.
- **Pedagogical (Kindergarten/Learning Curve):** confirm the PT accents (ã, õ, ç) — for EU/US the Nordic coverage of the cursive must be tested; if it is missing, the cursive is used only where that language's curriculum asks for it.

## 8. Technical implementation (when it gets wired)

- **Self-host** in `/fonts/<familia>/` with **woff2 subset per language** (`unicode-range`); `font-display: swap`; preload only the default UI (Atkinson) and the font of the current screen.
- **CSS tokens** per role: `--font-ui`, `--font-ui-alt`, `--font-book`, `--font-serif`, `--font-sans`, `--font-script`, `--font-fraktur`, `--font-print` (ball-and-stick), `--font-cursive` (regional). Switching the font = switching the token, not the markup.
- **Accessibility selector** (Options): UI = Atkinson / Lexend / OpenDyslexic; + size and spacing (line-height ≥1.5, adjustable letter-spacing) — this usually helps **more** than the font itself.
- **Paid ones isolated**: Kindergarten Pro goes only into the production build, outside the public GPL repository (like the non-FOSS art); the public repo references an OFL placeholder.

## 9. Pending items for the Dev to decide (to close the official roster)
1. **OpenDyslexic**: accept it as an _option_ + **adopt Lexend** as the default alternative? (recommended)
2. **Sans**: keep **Ubuntu (UFL)** or switch the default to **Lato (OFL)**? (I recommend Lato for governance)
3. **Ball-and-stick**: adopt **Andika** for literacy and move Comic Neue to *friendly*? (recommended)
4. **Kindergarten Pro**: authorise contacting the foundry for a quote for **embedding (app+web+mobile) + subset**? (needed before embedding)

## Sources
- [Wery & Diliberto — effect of OpenDyslexic on reading (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5629233/)
- [Pimp my Type — Dyslexia friendly fonts: are they any good?](https://pimpmytype.com/dyslexia-fonts/)
- [Access-Ability — The Nuance of Dyslexia Friendly Fonts in Games](https://access-ability.uk/2024/06/21/the-nuance-of-dyslexia-friendly-fonts-in-games/)
- [Max Kohler — The Development of Atkinson Hyperlegible](https://www.maxkohler.com/notes/2021-02-16-atkinson-hyperreadable/)
- [Learning Curve Pro on Font Squirrel (licence)](https://www.fontsquirrel.com/license/learning-curve-pro) · [Blue Vinyl Fonts (bvfonts.com)](https://www.bvfonts.com/fonts/details.php?id=76)
- [Primarium — Brazil (school handwriting model)](https://primarium.info/countries/brazil/)
- [Kindergarten and Be-a-bá — BR literacy fonts](https://fontebeaba.wordpress.com/)
- [Canonical — Ubuntu Font Licence FAQ](https://canonical.com/legal/font-licence/faq) · [LWN — Ubuntu font and libre licensing](https://lwn.net/Articles/409813/)
- [Monotype — App License (embedding in apps)](https://foundrysupport.monotype.com/hc/en-us/articles/10840068991636-App-License)
