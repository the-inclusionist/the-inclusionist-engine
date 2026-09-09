# Test Plan

Formalizes what we already do, as a per-feature / per-release **checklist**. The automated suites are the source of
truth (Vitest node + browser); this plan is the human checklist around them, plus the checks a machine can't run yet.

## Per feature (before marking an issue done)

- [ ] Unit/logic covered by Vitest **node** (ZOMBIES + Right-BICEP); each extracted module born with a test.
- [ ] Render/DOM covered by Vitest **browser** (Playwright) where it touches PIXI/DOM.
- [ ] Boot verified in the preview: canvas >= 1 and `window.__incl` (real boot, not just a title screenshot).
- [ ] `tsc --noEmit` and `vitest run` green (Dev runs Node).
- [ ] Acceptance criteria in the issue "Done when" met; for educational activities, the Gherkin `.feature` passes
  (see `bdd/README.md`).

## Per release

- [ ] Full Vitest suite green in CI (`.github/workflows/ci.yml`).
- [ ] `vite build` clean; PWA updates (content-hash SW) verified in the preview.
- [ ] Accessibility spot-check: keyboard-only, screen-reader captions (`aria-live`), reduced-motion, high-contrast.

## ⚠️ The defect class that reddened two repositories: a test that measures the MACHINE

On 2026-09-08 CI ran four game repositories for the first time and two went red. **Seven failures, none of
them a defect in a game** — three tests measuring the machine: its LANGUAGE (`navigator.language`), its SPEED
(a fixed `setTimeout`), and its INSTALLED FONTS. A test like this is green on the developer's laptop for
years and red the first time it meets a different computer, which is the CI runner, which is also the school
Chromebook.

### 📏 Measured across the catalogue on 2026-09-09 — 225 test files, five repositories

| repository | BLIND wait (sleep and hope) | polling with a condition (the CURE) | `sleep(0)` flush (NOT a wait) | font METRIC | system language |
|---|---|---|---|---|---|
| `game-soccer` | 🔴 **29** (up to **900 ms**) | 11 | 0 | 0 | 0 |
| `game-chess` | 🔴 **4** | 7 | 6 | 0 | 0 |
| `game-whackwhack` | 0 | 0 | 0 | 🔴 **2** | 0 |
| `pixi-15-puzzle` | 0 | 0 | 0 | 🔴 **1** | 0 |
| `game-2048` | ✅ clean | | | | |
| `game-platformer` | ✅ clean | | | | |
| **the engine itself** | ✅ **0** | 0 | 1 | 0 | 0 |

⚠️ **THE DETECTOR OVER-REPORTED TWICE BEFORE THESE NUMBERS WERE TRUE, and both corrections belong here more
than the numbers do.**

1. `while (Date.now() < until) await sleep(16)` is waiting for a CONDITION — it is the fix applied to
   `game-soccer`, not the fault. Counting it as a defect made the total three times too large and reported the
   repair as damage.
2. 📌 `setTimeout(fn, 0)` is a **macrotask flush** — yielding one turn to the event loop so queued work
   settles. It is a deliberate idiom, not «sleep and hope», and it does not encode the machine's speed. Six of
   the ten hits first attributed to `game-chess` were flushes: its real number is **four**.

🎯 A detector that cannot tell a fix from a fault is worse than no detector, because its output looks like
evidence. Both versions of this table were published before the third one was true.

### 🔴 And the biggest finding is that one repair was left half done

`game-soccer` had ONE blind wait replaced by `waitFor` and was called fixed. **Twenty-nine remain**, at 900 ms,
400 ms, 350 ms — and none of them is a flush, so that number survived both corrections. It passes today
because the runner is fast; every one of those lines is a green that depends on a machine, and the red of
2026-09-08 was simply the first one to break. 📌 «Uma causa achada não é a causa toda» — the lesson was already
written down, and the same repository paid for it twice.

### The two rules, and the second is the one that hides

1. **NEVER wait on the clock — wait on the CONDITION.** `waitFor(() => x === true, { timeout })` passes as fast
   as the machine allows and fails with a reason. A fixed sleep encodes today's CPU into the assertion.
2. ⚠️ **A FONT-METRIC test has TWO legs, and copying it copies only the first.** It is valid when (a) the face
   is monospaced at 1em against a proportional control — pin that with a case — AND (b) **the family is not
   installed on the machine**. If it is installed, `font-family` resolves from the SYSTEM, the vendored
   `@font-face` is never consulted, and renaming that declaration so it can never match leaves the file GREEN.
   📌 The second leg is a property of the MACHINE and cannot be asserted from inside the test: it only shows up
   by breaking the `@font-face` on purpose and seeing whether anything fails. `tests/fonte-arcade.browser.test.js`
   in this repository carries the method with both legs documented; `game-whackwhack` copied it with one.

📌 `document.fonts.ready` and `fonts.load` are NOT this defect — they wait for a DECLARED face and are correct.
The defect is comparing measured widths.

## Hardware batteries (prospective — run when the devices exist)

We do **not** own the target hardware yet (public-school Positivo / Chromebook). Build these batteries now, run them
**when the devices arrive** — they do not block development.

### ⚠️ The Chromebook battery is FOUR players with peripherals — decided by the Dev, 2026-09-08

Verbatim: *«Teclado para dois jogadores é para teclado full. Se a criança joga num chromebook, não há como
jogar dois jogadores e pronto. Teste no chromebook é para quatro jogadores mas usando teclado completo ligado
ao dispositivo assim como 4 controles via USB.»*

Two things are fixed by that, and neither is derivable from the code:

1. **Two players on one keyboard requires a FULL keyboard.** A Chromebook's built-in keyboard does not carry
   two seats, and that is the answer rather than a limitation to work around — the two-player split depends on
   the numpad, and a Chromebook has none.
2. **The Chromebook battery is a FOUR-player test**: a full keyboard attached to the device, plus **four USB
   gamepads**. It is not the device on its own; it is the device as it would sit in a classroom, peripherals
   included.

📌 This also feeds the open question in **#112** — *what «places» means for a keyboard*. It does not answer it
whole, but it settles the two-player case: a Chromebook's own keyboard does **not** carry two seats, and the
reach screen has to be able to say so **before** the child starts, instead of the child finding out by trying.

⚠️ And it is why #112 depends on this battery from two sides: the card must be **seen** on this device
(issue #8) and its sentence must be **understood** by a child (issue #7).

- [ ] Two players on the Chromebook's own keyboard is correctly reported as UNREACHABLE, not attempted.
- [ ] Four players: full keyboard + 4 USB gamepads, all four seats reachable and remappable.
- [ ] Boots and holds interactive FPS on the low-end target.
- [ ] Integer real-pixel scaling holds on the device's actual dpr (see ADR-0001) — uniform pixels, even scanlines.
- [ ] Touch targets meet the physical-mm sizing on the real screen.
- [ ] Offline (PWA) works after first load with no network.

---

## 🔴 O TRABALHO DE CAMPO MORA AQUI DESDE 2026-09-09 (ADR-0126) — e ele é o trabalho que nunca acontece

Quatro itens estavam abertos no tracker de issues (#6, #7, #8, #13) e nenhum era um problema resolvível por
código: **produzem ACHADOS**, e um achado é insumo de trabalho, não o trabalho. Uma issue de campo não tem
commit que a feche — é por isso que a #7 era a issue aberta há mais tempo do repositório.

⚠️ **E O RISCO DESTA MUDANÇA ESTÁ ESCRITO NO PRÓPRIO REGISTO QUE A DECIDIU:** *«fieldwork leaving the tracker
risks it becoming invisible — it is already the work that never happens»*. Um documento é mais fácil de não
abrir do que um ticket. A contramedida é esta secção existir com **critérios de conclusão marcáveis** e com o
que cada sessão DEVE produzir — porque o que torna trabalho de campo real não é estar listado, é alguém saber
o que traz de volta.

📌 **Cada achado que precisar de código vira uma issue NESSE momento**, com a evidência anexada. É a quarta
casa do ADR-0126, e é ela que impede a regra de apagar informação.

### Auditoria manual com leitor de tela — NVDA/JAWS/VoiceOver (era a #6)

Jogar o jogo **só** pelo leitor de tela, sem olhar para o ecrã, em desktop e iOS. Documentar pontos de atrito.
Cobre o **gate 4 do ADR-001**.

- [ ] Uma partida completa sem olhar, em NVDA (Windows).
- [ ] Uma partida completa sem olhar, em VoiceOver (iOS).
- [ ] Cada ponto de atrito registado com a TELA, a AÇÃO e o que o leitor disse — as três, senão não se conserta.
- [ ] Os atritos que precisam de código viram issues, uma por defeito.

### Teste de campo com cinco crianças, uma com NEE (era a #7)

Observar **sem dirigir** (Mom Test); anotar quais minijogos prendem mais. Cobre o **gate 5 do ADR-001**, que é
o último para `fully_ratified`.

- [ ] Cinco crianças, pelo menos uma com necessidade educativa especial.
- [ ] Observação sem instrução: o que ela faz sozinha, não o que faz quando lhe dizem.
- [ ] A frase da tela de alcance (#112) é LIDA por uma criança sem um adulto a explicá-la.
- [ ] Anotado o que prendeu e o que ela abandonou — o abandono é o dado mais caro e o mais fácil de não anotar.

### Validação no hardware-alvo — tablet Positivo + Chromebook (era a #8)

Desempenho, acessibilidade (ChromeVox no Chromebook) e Lighthouse ≥ 90 (mobile / 3G / CPU 4×). Cobre os
**gates 1 e 2 do ADR-001**. Corre **quando os aparelhos existirem**; ver a bateria de hardware acima, que já
tem o escopo de quatro jogadores decidido pelo Dev.

- [ ] Lighthouse ≥ 90 em mobile com estrangulamento de 3G e CPU 4×.
- [ ] ChromeVox atravessa o jogo inteiro no Chromebook.
- [ ] O cartão de alcance (#112) é VISTO neste aparelho — é a metade que a #7 não dá.

### Auditoria final WCAG 2.2 + GAG (era a #13)

Auditoria pós-tudo: axe + Lighthouse + GAG item a item à mão + gates do ADR-001, com relatório **honesto de AA
contra AAA**. Complementa o gate do axe em CI, que já corre.

- [ ] axe e Lighthouse limpos no build servido, não no dev.
- [ ] GAG percorrido item a item, à mão.
- [ ] Relatório que diz onde é AA e não AAA, **por critério** — o pilar 2 proíbe vender «AAA em bloco».
