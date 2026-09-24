# The Project's Typographic Reference — v6

**Project:** basic education in games, from early childhood to secondary school, with a focus on inclusion.
**Purpose of this document:** gather every typeface in one place, with each group's order of preference, the reason for each choice and the licence items still pending.
**Date:** 2 June 2026 · **Version:** v6 (adds section 8, References, in ABNT with DOI).

> **Key to the preference signs** (used in the rankings throughout the text)
> `>` better than · `≥` a little better than · `=` equal for the purpose · `>>` much better than
>
> The signs measure **fitness for the purpose**, not reading performance. They weigh design, on-screen quality, the family's robustness and the licence. See the evidence base in section 7 and the sources in section 8.

> 📌 **This is the reference; what the engine SHIPS is in the code** — `app/public/vendor/fonts.css` (the bundled
> faces) and `app/js/ui/fonts.ts` (the catalogue, each face's role and minimum size, and the typography cycle).
> Checked on 2026-09-24, the shipped choices differ from this reference in four places, all decided after v6:
>
> - **The default face is Atkinson Hyperlegible**, for everyone. Andika is not the default of the literacy stage
>   (§3.1): it is the literacy PAIR at the start of the typography cycle — Andika in UPPER CASE, then Andika in mixed
>   case — followed by Atkinson (where the cycle starts), Lexend and the country's handwriting face (ADR-0149 §1).
> - **The default spacing is the British Dyslexia Association's, not the WCAG floor** of §1.2: 0.18em between
>   letters and 0.63em between words (word ≥ 3.5× letter), on the default face and not only on a dyslexia setting
>   (ADR-0149 §2; `--ls`/`--ws` in `app/css/style.css`, pinned by `tests/settings-typo.browser.test.js`).
> - **Handwriting is Playwrite, by country** (ADR-0150): the Brazilian, US, Canadian, Mexican, Argentinian,
>   Spanish, Portuguese, British and other Playwrite faces, with the coloniser's hand as the fallback for a country
>   with none of its own. It is shown 25% larger (the faces' 20 px floor over a 16 px base), and the calligraphic
>   faces are used only inside school activities, never in the HUD or menus. The paid cursives of §5.3 are not shipped.
> - **OpenDyslexic is shipped as a user's choice with no claim of efficacy** (issue #87 item 3), as §3.3 asks;
>   Dyslexie is not shipped. Clash Display is not shipped (§2.2, §6), and a test holds that absence
>   (`tests/fontes-empacotadas.node.test.js`).

---

## Contents

- [1. Principles that matter more than the typeface](#1-principles-that-matter-more-than-the-typeface)
- [2. Reading core](#2-reading-core)
  - [2.1 Sans serif for long text](#21-sans-serif-for-long-text)
  - [2.2 Sans serif for display (signs and notices)](#22-sans-serif-for-display-signs-and-notices)
  - [2.3 Sans serif for small text](#23-sans-serif-for-small-text)
  - [2.4 Serif for long text](#24-serif-for-long-text)
  - [2.5 Serif for display](#25-serif-for-display)
  - [2.6 Writing](#26-writing)
- [3. Audiences and literacy stages](#3-audiences-and-literacy-stages)
  - [3.1 Early-childhood literacy](#31-early-childhood-literacy)
  - [3.2 EJA (youth and adult education)](#32-eja-youth-and-adult-education)
  - [3.3 Dyslexia, dyscalculia and ADHD](#33-dyslexia-dyscalculia-and-adhd)
  - [3.4 Low vision and tired eyes](#34-low-vision-and-tired-eyes)
  - [3.5 Libras and deafness](#35-libras-and-deafness)
  - [3.6 Braille](#36-braille)
- [4. Specific domains](#4-specific-domains)
  - [4.1 Mathematics](#41-mathematics)
  - [4.2 Code](#42-code)
  - [4.3 Chemistry, Greek and foreign names](#43-chemistry-greek-and-foreign-names)
  - [4.4 Symbols and icons](#44-symbols-and-icons)
- [5. Calligraphic and decorative](#5-calligraphic-and-decorative)
- [6. Licence items pending](#6-licence-items-pending)
- [7. Appendix: why spacing beats the typeface](#7-appendix-why-spacing-beats-the-typeface)
- [8. References](#8-references)

---

## 1. Principles that matter more than the typeface

The choice of typeface matters less than it seems. Three rules weigh more.

**1.1 Colour and contrast.** Use a cream or pastel background, with dark text. Avoid pure white.

**1.2 Adjustable spacing.** Let the user adjust the text's spacing. Start from the WCAG 2.2 minimums, criterion 1.4.12:

| Measure | Minimum (× font size) |
|---|---|
| Line height | 1.5 |
| Between letters | 0.12 |
| Between words | 0.16 |
| Between paragraphs | 2.0 |

**1.3 Economy of families.** Use few families and many weights of each. The reading core is already complete. Do not add more text, display or serif faces.

---

## 2. Reading core

### 2.1 Sans serif for long text

`Source Sans 3 ≥ Inter ≥ Open Sans = Lato > Roboto Flex > Ubuntu > Noto Sans >> IBM Plex Sans > Arial = Helvetica > Verdana`

Noto Sans comes in when the criterion is covering many languages. The last three serve as a fallback, when they already exist on the device. Verdana has good letter spacing, but its design is old.

### 2.2 Sans serif for display (signs and notices)

`Clash Display ≥ Space Grotesk > Sora ≥ Plus Jakarta Sans >> Montserrat = Poppins`

**For numbers, the order changes:** `Sora ≥ Plus Jakarta >> Montserrat = Poppins`.

Montserrat and Poppins have a "1" with no serif and a very round "0". So do not use them on a sign with a number, such as a price or a code. When you need numbers in display, prefer **Lexend** or **Outfit**; both are free and have clear digits.

> 🔴 **Clash Display** cannot be adopted by the engine. The licence was read on 2026-09-12: it is «Closed Source», under the
> ITF Free Font License, whose §02 forbids distributing the file through a repository, application or public server and
> serving it as a selectable font to third parties (ADR-0150, erratum). In the order above, Space Grotesk replaces it.

### 2.3 Sans serif for small text

`Inter ≥ IBM Plex Sans > Geist`

Source Sans 3 bridges to long text. **Inter** solves both cases at once and has reliable fixed-width numbers. So it also serves as the numbers face and slims down the set.

### 2.4 Serif for long text

`Literata ≥ Source Serif 4 ≥ Newsreader > Merriweather = Lora > Spectral > Domine > Bitter >> Georgia > Garamond > Times`

Georgia does better than Times on screen, because it was made for it. Garamond is too thin for a small screen.

### 2.5 Serif for display

`Playfair Display > DM Serif Display ≥ Fraunces > Bodoni Moda`

> ⚠️ **Accessibility caution:** Playfair and Bodoni have very thin strokes, which vanish for people with low vision. On a notice everyone needs to read, prefer DM Serif or go back to a display sans.

### 2.6 Writing

For long, calm writing, use **iA Writer Quattro**. It is almost monospaced and helps concentration.

---

## 3. Audiences and literacy stages

### 3.1 Early-childhood literacy

The default face is **Andika**. It is from SIL, it is free and it was made for people learning to read. It carries alternative forms of "a", "g" and "t".

For the serif version, there are **Bembo Infant** and **Plantin Infant**. Both are from Monotype and are paid. Treat them as a premium option. **Sassoon Primary** is also premium and paid.

> 📌 **A pedagogical rule that weighs more than taste:** choose between the single-storey and double-storey "a" and "g" according to the letter the school teaches children to write. Follow the BNCC, not aesthetics. For the youngest, prioritise size and letter height.

### 3.2 EJA (youth and adult education)

For young people and adults, use **Lexia Readable**. It follows the logic of literacy, but without a childish air.

### 3.3 Dyslexia, dyscalculia and ADHD

`Atkinson Hyperlegible ≥ Lexend > Andika > Open Sans/Verdana = Comic Neue >> Dyslexie and OpenDyslexic`

Offer Dyslexie and OpenDyslexic only as the user's choice. Research shows no reading gain from them.

> 📌 **What really matters is spacing.** Expose controls for the space between letters, words, lines and paragraphs, starting from the WCAG minimums (section 1.2). Make sure the space between words is larger than the space between letters; without that, words merge. Reduce visual clutter and avoid deliberately difficult typefaces.

### 3.4 Low vision and tired eyes

`Atkinson Hyperlegible = Atkinson Hyperlegible Next > APHont ≥ Luciole > Lexend = Verdana > Andika`

> ⚠️ **APHont** and **Luciole** have licences more restrictive than the OFL. Confirm commercial use before adopting them.

### 3.5 Libras and deafness

Use the **SuttonSignWriting** script to write signs. It is free.

> 📌 **Scope notice:** Libras is not just one more typeface; it is a system of its own. The main form of inclusion should be the interpreter's video, plus sign writing. Treat Libras in a separate track, not as typography.

### 3.6 Braille

The default face to bundle is **Braille CC0**. It is in the public domain. You can use it in any project, paid or not, printed or digital. It is the option with no licensing headache.

There is also **Braille Neue**. It combines braille and the Latin letter in the same glyph, so that sighted and blind people can read together. But it has no open licence: the official site only points to contacting the author. Use it only under a licence; otherwise, render the braille as an SVG layer.

> ⚠️ **Important correction:** Iosevka Charon, Cascadia Code and Noto Sans **are not braille fonts**. They are ordinary fonts. They only show braille dots when they have the right Unicode coverage, and that does not make them teaching fonts. For pure Unicode braille, **DejaVu Sans** covers the block and is free. Those three serve for code and ASCII art.

---

## 4. Specific domains

This section covers lower secondary (fundamental II) and upper secondary (médio), when the content becomes more technical.

### 4.1 Mathematics

**Column arithmetic and tables:** use **Atkinson Hyperlegible Mono**. It has fixed width and clear numbers, and it beats JetBrains Mono in this role because of its digits.

**Formulas in MathJax:** use **STIX Two Math**. Latin Modern Math is the alternative, with a LaTeX air. If you use **KaTeX**, the problem goes away: it ships its own fonts.

**Numbers in body text:** Atkinson solves it through its design. The "0" has its own stroke and the "1" is not confused with "l" or "I". Turn on fixed-width numbers on arithmetic screens.

### 4.2 Code

| Typeface | Width |
|---|---|
| Victor Mono | narrow |
| JetBrains Mono | balanced (the basis of iA Writer Quattro) |
| MonoLisa | wider |

### 4.3 Chemistry, Greek and foreign names

Here what matters is character coverage. **Noto Sans**, **Noto Serif** and the **IBM Plex** family solve it. They carry real subscript and superscript, as in H₂O and CO₂, and the Greek alphabet, such as π, Δ and λ.

> 📌 Before trusting it, test H₂O, π and ½ in your body face.

### 4.4 Symbols and icons

**Interface icons:** use **Material Symbols** (more complete) or **Lucide** (lighter and prettier).

**The same emoji on every device:** use **Noto Emoji** (outline) or **Noto Color Emoji** (colour). Emoji helps communicate with people who read little.

---

## 5. Calligraphic and decorative

> ⚠️ **Restricted use.** Use these faces only in a title, a badge, an ornament or when teaching the stroke itself. Never use them in text the child needs to read to play. The BDA and the WCAG advise against them for reading, because they tire and confuse.

**5.1 English calligraphic:** Great Vibes · Pinyon Script.

**5.2 German blackletter:** UnifrakturCook (more legible) · UnifrakturMaguntia (more authentic).

**5.3 Children's cursive:**

| Style | Typeface | Status |
|---|---|---|
| Ball-and-stick | Comic Neue | free |
| English cursive | Learning Curve | free |
| Brazilian cursive | Kindergarten Pro | paid (FTD, Ática, Moderna, Saraiva) |

> ⚠️ **Kindergarten Pro** is paid and needs care: the licence targets printed material. Confirm with Just in Type whether it covers use in an app before buying.
>
> 🔎 **A free alternative to investigate:** the "Letra Escolar Brasileira", the family from the UFRGS thesis, made for teaching handwriting in Brazilian schools. Check the licence, because it may save the cost of Kindergarten without losing the right stroke. The free Beaba family does not qualify (personal use only); its commercial version is also paid.

---

## 6. Licence items pending

Most of the faces are free (OFL, Apache, CC0 or ISC). Keep a copy of each licence in the repository. The faces below require action before bundling.

| Typeface | Status | What to do |
|---|---|---|
| Clash Display | ITF Free Font License (Closed Source) | 🔴 **Not bundleable** — §02 forbids distribution and use as a selectable font by third parties |
| APHont | Restrictive | Confirm commercial use |
| Luciole | Restrictive | Confirm embedded use |
| Bembo Infant and Plantin Infant | Monotype, paid | Get a quote for an app licence |
| Sassoon Primary | Paid | Get a quote if it is to be used |
| Kindergarten Pro | Paid, aimed at print | Confirm use in an app before buying |
| Braille Neue | No open licence | License it from the author or use Braille CC0 |
| MonoLisa, iA Writer Quattro, Victor Mono | Mixed | Check each one's terms |

---

## 7. Appendix: why spacing beats the typeface

This section summarises the evidence review and explains the choices above.

**7.1 "Dyslexia fonts" show no gain.** OpenDyslexic and Dyslexie failed in controlled studies. Wery and Diliberto found no improvement in 2017 (ref. 1); nor did Kuster and colleagues, in 2018 (ref. 2). Many readers even prefer Arial.

**7.2 The real gain comes from spacing.** Zorzi and colleagues showed this in 2012, in PNAS (ref. 3). The benefit attributed to dyslexia fonts is, in fact, their spacing. Marinus and colleagues confirmed it in 2016 (ref. 4).

**7.3 The serif-versus-sans fight is a false one.** What weighs is stroke contrast. Minakata and Beier showed this in 2022 (ref. 5).

**7.4 Numbers and dyscalculia are a gap.** There is almost no study. The closest evidence tested difficult fonts on arithmetic and found nothing (Meyer and colleagues, 2015 — ref. 6). On the legibility of numerals, the design work of Beier and colleagues (2018) is the best reference (ref. 7).

**7.5 Lexend has a weak basis.** Its study had only twenty students and was not peer-reviewed (ref. 8). Keep it as an option, not as a fixed default.

**7.6 Atkinson Hyperlegible is plausible, not proven.** It has a good design, but no independent peer-reviewed proof (ref. 9).

**7.7 Two guides support adjustable spacing.** They are WCAG 2.2, criterion 1.4.12 (ref. 10), and the British Dyslexia Association's style guide, from 2023 (ref. 11).

---

## 8. References

References in ABNT (NBR 6023), with DOI or a primary link. Where the source is paid or closed-access, that is flagged. The type designers' documents (refs. 12–17) support the design and licence decisions.

**Empirical evidence (peer-reviewed studies)**

1. WERY, J. J.; DILIBERTO, J. A. The effect of a specialized dyslexia font, OpenDyslexic, on reading rate and accuracy. **Annals of Dyslexia**, v. 67, n. 2, p. 114-127, 2017. DOI: 10.1007/s11881-016-0127-1. Available at: https://doi.org/10.1007/s11881-016-0127-1. Accessed: 2 Jun. 2026.

2. KUSTER, S. M. *et al.* Dyslexie font does not benefit reading in children with or without dyslexia. **Annals of Dyslexia**, v. 68, n. 1, p. 25-42, 2018. DOI: 10.1007/s11881-017-0154-6. Available at: https://doi.org/10.1007/s11881-017-0154-6. Accessed: 2 Jun. 2026.

3. ZORZI, M. *et al.* Extra-large letter spacing improves reading in dyslexia. **Proceedings of the National Academy of Sciences (PNAS)**, v. 109, n. 28, p. 11455-11459, 2012. DOI: 10.1073/pnas.1205566109. Available at: https://doi.org/10.1073/pnas.1205566109. Accessed: 2 Jun. 2026.

4. MARINUS, E. *et al.* A special font for people with dyslexia: does it work and, if so, why? **Dyslexia**, v. 22, n. 3, p. 233-244, 2016. DOI: 10.1002/dys.1527. Available at: https://doi.org/10.1002/dys.1527. Accessed: 2 Jun. 2026. (Closed access; author's PDF available.)

5. MINAKATA, K.; BEIER, S. The dispute about sans serif versus serif fonts: an interaction between serif and stroke contrast. **Acta Psychologica**, v. 228, 103623, 2022. DOI: 10.1016/j.actpsy.2022.103623. Available at: https://doi.org/10.1016/j.actpsy.2022.103623. Accessed: 2 Jun. 2026.

6. MEYER, A. *et al.* Disfluent fonts don't help people solve math problems. **Journal of Experimental Psychology: General**, v. 144, n. 2, p. e16-e30, 2015. DOI: 10.1037/xge0000049. Available at: https://doi.org/10.1037/xge0000049. Accessed: 2 Jun. 2026.

7. BEIER, S.; BERNARD, J.-B.; CASTET, E. Numeral legibility and visual complexity. *In*: **DRS2018**: Design Research Society Conference, Limerick, 2018. DOI: 10.21606/drs.2018.246. Available at: https://doi.org/10.21606/drs.2018.246. Accessed: 2 Jun. 2026.

**Sources of weak evidence, or guides (cited with a caveat)**

8. SHAVER-TROUP, B.; JOCKIN, T. **Lexend**: change the way the world reads. Fluency study with 20 participants, not peer-reviewed. Available at: https://www.lexend.com/. Accessed: 2 Jun. 2026.

9. BRAILLE INSTITUTE OF AMERICA. **Atkinson Hyperlegible Font**. Design documentation; no independent peer-reviewed validation. Available at: https://www.brailleinstitute.org/freefont/. Accessed: 2 Jun. 2026.

10. WORLD WIDE WEB CONSORTIUM (W3C). **Understanding Success Criterion 1.4.12: Text Spacing (WCAG 2.2)**. Available at: https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html. Accessed: 2 Jun. 2026.

11. BRITISH DYSLEXIA ASSOCIATION. **Dyslexia Style Guide 2023**: creating dyslexia friendly content. Available at: https://www.bdadyslexia.org.uk/advice/employers/creating-a-dyslexia-friendly-workplace/dyslexia-friendly-style-guide. Accessed: 2 Jun. 2026.

**Type designers and licences**

12. SIL INTERNATIONAL. **Andika**: a literacy font (SIL Open Font License). Available at: https://software.sil.org/andika/. Accessed: 2 Jun. 2026.

13. TAKAHASHI, K. **Braille Neue**: a universal typeface. Licence not open; contact the author. Available at: http://brailleneue.com/. Accessed: 2 Jun. 2026.

14. **Braille CC0** (Creative Commons Zero v1.0 Universal — public domain). Available at: https://www.ggbot.net/fonts. Accessed: 2 Jun. 2026.

15. JUST IN TYPE. **Kindergarten Pro / Fonte Beaba**: fontes para alfabetização (commercial licence, aimed at print). Available at: https://www.fontebeaba.com/fonte-kindergarten-pro. Accessed: 2 Jun. 2026.

16. UNIVERSIDADE FEDERAL DO RIO GRANDE DO SUL (UFRGS). **Letra Escolar Brasileira**: design de uma família tipográfica para o ensino da escrita manual. Lume/UFRGS repository. Available at: https://lume.ufrgs.br/handle/10183/199539. Accessed: 2 Jun. 2026.

17. SUTTON, V. **SignWriting (SuttonSignWriting)**: a writing system for signs. Available at: https://www.signwriting.org/. Accessed: 2 Jun. 2026.

> **Note.** This list covers what supports the decisions in this document. The complete scoping review, with the other sources (Rello & Baeza-Yates, Galliussi, Walker & Reynolds, among others) and their notes on strength of evidence, is in the document "Fonts & Typography in Education and Inclusion: A Scoping Review".
