Historical study (2026-06-02): kept as a record; the current state lives in `docs/game-design/typography.md`.

# Basic research — Fonts for conditions, literacy and mathematical literacy

> **Level:** **basic/exploratory** research (1st pass). Goal: map what exists and where there is (or is not) evidence. **If the topic becomes relevant, do a formal _scoping review_ later** (inclusion criteria, grading of evidence, target population: BR public-school children). Date: 2026-06-02.

## 0. Methodological warning (important)
Much of the *font for X* literature is **weak**: market opinion, small studies, no control group, or null results. Treat the findings below as **hypotheses**, not truths. The recurring and **well-supported** pattern is: *what helps almost every condition is **general legibility + character differentiation + generous spacing/line spacing**, more than a *magic* font.* Personalisation (letting the user choose font/size/spacing) is the safest recommendation (and it matches GAG).

## 1. Fonts per condition

| Condition | What the literature suggests | Fonts cited | Strength of evidence |
|---|---|---|---|
| **Low vision** | heavy stroke weight, large x-height, **open apertures**, spacing; I/l/1, O/0 differentiation | **Atkinson Hyperlegible** (Braille Institute) | Good (purpose-based design; broad use) |
| **Dyslexia** | no *magic font*; what helps = legibility + differentiation + spacing; asymmetric **b/d/p/q**; line spacing ≥1.5 | Lexend, Atkinson, Comic Sans/Comic Neue, Verdana; OpenDyslexic (subjective preference) | **Weak/mixed** (OpenDyslexic: null study) |
| **ADHD** | simple, clean, **no ornament**, constant stroke thickness; reduce distraction | Lexend, Open Sans, Verdana, clean geometric sans faces | Weak (principles > studies) |
| **Dyscalculia** | little dedicated research; **high comorbidity with dyslexia** (⅓–75%) → inherit the dyslexia principles; **unambiguous numerals**; reduce visual stress (spacing, overlay, off-white background) | Lexia Readable, Lexend; "lining/tabular" numerals | **Very weak** (a real gap) |
| **Aphasia / cognitive deficit** | legible + "readable"; simple forms; short sentences; icon support | clean sans faces (Open Sans, Verdana) | Weak |
| **Astigmatism/myopia/fatigue (prolonged use)** | large x-height, medium stroke, loose spacing, near-monospace helps focus | iA Writer (Quattro), Inter, calm reading fonts | Anecdotal (the user's own report carries design weight) |

## 2. Fonts for literacy (beginning readers)
A **more mature** field (there is design research, e.g. Rosemary Sassoon).
- **Sassoon (Primary/Infant)** — the product of research on how children read/write; **"infant" characters** (single-storey a and g, curved exits on l/t, a serif on capital I), a slightly slanted stroke with *exit strokes* (preparing for cursive). The standard in Anglo schools/publishers. **Commercial.**
- **Andika** (SIL, **OFL, free**) — designed **for literacy and beginning readers**: unambiguous "ball-and-stick" forms, broad Latin coverage. It is the libre equivalent of the *Sassoon* role. → **chosen as the game's default.** [Today: Atkinson Hyperlegible is the default face and Andika is the literacy face, in `app/js/ui/fonts.ts` and `app/css/style.css`.]
- Classic "infant" variants: **Gill Sans Infant, Bembo Infant, Plantin Infant** (commercial).
- **Lexia Readable** — an *adult Comic Sans*, legible even at 8pt.
- Principle: **generous, simple and warm** forms; infant characters; no ornament at all.

## 3. MATHEMATICAL literacy (the requested focus) — gap + guidelines
**There is no consolidated typography *for mathematical literacy* (yet)** with a strong empirical basis. But guidelines can be derived from what matters in numbers/notation:

1. **Unambiguous numerals** (the most critical point): distinguish **0×O**, **1×l×I×7**, **6×b**, **9×g**, **5×S**, **2×Z**. For dyscalculia + visual stress, digit confusion is worse than letter confusion.
2. **"Lining" (cap-height) figures** to align with symbols; and **"tabular" (fixed-width) figures** for **columns/column arithmetic** (units aligned). Fonts with *tabular figures* (e.g. Inter, Lato, Roboto) help column sums.
3. **Correct operators**, not improvisations: use real **× ÷ − ±** (not `x`, `/`, hyphen) — this requires a font with those glyphs or dedicated rendering.
4. **Notation/formulas** (advanced levels): math fonts (**STIX Two Math, Latin Modern Math**) via MathML/MathJax; for **early numeracy**, what counts is the **clear digit in the body font**, not a formula font.
5. **Visual stress** (common in dyscalculia): more spacing between digits, a lightly coloured/off-white background, optional overlays.

**Practical recommendation for the game (early numeracy):** use the body font (Andika/Atkinson — both with well-differentiated digits) with **tabular figures** when there are column sums; reserve a math font only if we get into notation. Andika and Atkinson already cover #1 well; validate #2/#3 in the Soma-Sub modes.

## 4. Next steps (if the topic scales → scoping review)
- Define the **population** (BR children, 6–11, public school) and **outcomes** (reading speed/accuracy, numeric transcription error, fatigue).
- **Grade the evidence** (e.g. GRADE) and separate *plausible design* from *tested*.
- Test **numerals** specifically (digit confusion) with the chosen default font.
- Look for PT-BR/Lusophone literature (most studies are in English).

## Sources
- [Visme — Accessible Fonts: guide](https://visme.co/blog/accessible-fonts/) · [AudioEye — Best Fonts for ADHD](https://www.audioeye.com/post/best-fonts-for-adhd/) · [DesignYourWay — 13 best fonts for accessibility](https://www.designyourway.net/blog/best-fonts-for-accessibility/)
- [Dyslexia UK — The font of all knowledge](https://www.dyslexiauk.co.uk/the-font-of-all-knowledge/) · [Number Dyslexia — best/worst fonts](https://numberdyslexia.com/best-and-worst-fonts-for-dyslexia/) · [Addressing Dyslexia — Numeracy](https://addressingdyslexia.org/supporting-learners-and-families/technology/numeracy/)
- [Mathematics For All — Dyscalculia](https://mathlanguage.wordpress.com/tag/dyscalculia/) · [EdWeek — Dyscalculia & Dyslexia](https://www.edweek.org/teaching-learning/dyscalculia-and-dyslexia-reading-disabilities-offer-insights-for-math-support/2023/05)
- [Sassoon Fonts (Rosemary Sassoon)](https://sassoonfont.co.uk/sassoon-fonts/) · [Fonts.com — Typography for Children](https://www.myfonts.com/pages/fontscom-learning-fyti-situational-typography-typography-for-children) · [Books for Keeps — Typography in Children's Books](http://booksforkeeps.co.uk/issue/154/childrens-books/articles/other-articles/typography-in-childrens-books)
