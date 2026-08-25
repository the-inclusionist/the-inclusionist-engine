<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# E13 — Auditoria de acessibilidade + 5 gates do ADR-001

> Motor **v4.0.0** (PixiJS). Auditoria automatizada executada em 2026-06-01 via **axe-core 4.10.2**
> (injetado por Playwright). Tags: `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`.

## 1. Controles de toque (mobile) — feito

- **Joystick digital** (círculo-base 124px + manopla 58px que desliza para a direção tocada → 8
  direções, com zona morta) no canto inferior esquerdo + **correr** (») e **pular** (⤒) no canto
  inferior direito. **Não cobrem o centro** do gameplay (overlay só nas bordas).
- Botões de ação **56×56 px** e base do joystick **124px** → cumprem **WCAG 2.5.5 Target Size (AAA, 44×44)**.
- Aparecem só em **telas de toque** (`ontouchstart`/`maxTouchPoints`); em desktop ficam ocultos
  (forçar com `?touch=1` ou `window.__incl.showTouch()`).
- Mapeiam para as teclas de **P1** (remapeáveis, E10) via o mesmo `keys` Set → `pointerdown/up`,
  com `touch-action:none` (sem zoom/scroll acidental). Pulo é *edge-triggered* como no teclado.
- **Validado** (Playwright, eventos de ponteiro): mover-direita ✅, pular ✅, alvo 56×56 ✅.

## 2. axe-core — resultado

| Escopo | Violações A/AA | Passes | Revisão manual (incomplete) |
|---|---|---|---|
| **Nosso app** (exclui widget VLibras) | **0** | 23 | 1 — contraste dos botões de toque sobre o canvas |
| Página inteira (com VLibras) | 2–3 transitórias | 24 | + `.vp-more-option` (VLibras) |

- **Nosso código: zero violações WCAG 2.0/2.1/2.2 A e AA.**
- As violações `button-name`/`label` aparecem **apenas** na DOM injetada pelo **widget VLibras**
  (gov.br) — terceiro, **interino**, fora do nosso controle. Será substituído pelo **motor próprio
  em zdog** (pilares P2/P5). Documentado honestamente; não é regressão nossa.
- **Incomplete `color-contrast`** nos botões de toque: o axe não consegue medir o fundo porque os
  botões ficam **sobre o canvas WebGL**. O contraste efetivo é **~16:1** (texto branco `#fff` sobre
  `rgba(13,17,32,.92)` ≈ `#0d1120`) → passa AAA (7:1) na prática; precisa confirmação manual.

## 3. Os 5 gates do ADR-001 (§validation)

| # | Gate | Quem | Status |
|---|---|---|---|
| 1 | **Lighthouse Performance ≥ 90** em emulação Tablet Positivo (mobile + 3G + CPU 4×) | `[JOSE]` | ⏳ pendente — precisa Chrome/Lighthouse no alvo. Dado atual: **60 FPS** estável no desktop de teste (PixiJS WebGL, `renderer.type=1`). |
| 2 | Testar em **Tablet Positivo + Chromebook reais** (perf + a11y, ChromeVox) | `[JOSE]` | ⏳ pendente — requer hardware físico. |
| 3 | **Auditoria automatizada axe + Lighthouse + WAVE** | `[CLAUDE]`/`[JOSE]` | 🟡 **parcial** — **axe ✅ (0 violações no nosso app)**. Lighthouse a11y e WAVE pendentes (precisam CLI/extensão). |
| 4 | **NVDA + JAWS + VoiceOver** (desktop e iOS) manual | `[JOSE]` | ⏳ pendente — jogar só por leitor de tela e anotar fricção. |
| 5 | **Teste com 5 crianças** (incl. 1 com NEE) + Mom Test | `[JOSE]` | ⏳ pendente — campo. Último gate para `fully_ratified`. |

**Resumo:** o que é automatizável por IA está **feito** (gate 3 — axe limpo). Os gates 1, 2, 4 e 5
dependem de **hardware real, leitores de tela locais e crianças** — são `[JOSE]` por natureza
(acesso físico/humano). Conforme pilar P2, o selo **"AAA + GAG complete"** só será afixado quando os
5 gates fecharem.

## 4. Cobertura GAG/WCAG já implementada no v4 (E1–E13)

- **Texto/UI no DOM** (não no canvas) → leitores de tela leem HUD, instruções, quizzes, legendas.
- `aria-live` (status/alert), foco visível (`:focus-visible` 4px), skip-link, `prefers-contrast`,
  `prefers-reduced-motion`.
- **C1** legendas de SFX · **C2** modo assistência · **B2** remap+persistência · **A1** (parcial)
  controles de toque · alvos 44px+ · multiplayer em telas separadas (P7, sem split-screen).

## Como reproduzir a auditoria axe

```js
// numa porta limpa (sem service worker em cache), com a página aberta:
const s=document.createElement('script');
s.src='https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js'; document.head.appendChild(s);
// depois:
axe.run({exclude:[['[vw]'],['[vw-access-button]'],['[vw-plugin-wrapper]']]},
        {runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']})
   .then(r=>console.log(r.violations));   // → []
```
