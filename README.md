# The Inclusionist

[![pipeline](https://gitlab.com/jrocha-dev/the-inclusionist/badges/main/pipeline.svg)](https://gitlab.com/jrocha-dev/the-inclusionist/-/pipelines)

Jogo educativo de plataforma **acessível-primeiro**, em PixiJS, feito para escolas públicas
brasileiras. Alfabetização (base psicogenética de Ferreiro & Teberosky) e matemática dentro de
um platformer que mira **WCAG 2.2 (AAA aspiracional) + Game Accessibility Guidelines (GAG)**:
alto contraste, simulação/correção de daltonismo, baixa visão, modo cego (navegação sonora),
narração TTS, modo cadeirante, um-botão, controles remapeáveis (teclado/gamepad/toque em mm reais),
Libras (VLibras) e tipografia para dislexia. Roda 100% offline como PWA.

Licença: **GPL-3.0-or-later**. Mecânicas de plataforma portadas do
[Clarity, de Adam Brooks (dissimulate)](https://github.com/dissimulate/Clarity) (MIT).

## Estrutura do repositório

```
app/            # fonte do jogo (Vite root)
├─ index.html   #   entrada (Vite)
├─ js/          #   código — ES Modules, em modularização + migração p/ TypeScript
├─ css/         #   estilos
└─ public/      #   estáticos servidos como estão → copiados p/ dist/ no build
   ├─ assets/   #     sprites e cenários (arte GPL-clean)
   ├─ vendor/   #     PixiJS (MIT) e fontes (SIL OFL)
   └─ manifest.webmanifest · icon.svg · _headers
dist/           # saída do build (git-ignored) — é o que o Cloudflare Pages publica
tests/          # testes Vitest (node + browser) — não publicado
vite.config.ts · tsconfig.json · package.json    # toolchain (Vite + TypeScript + Vitest)
docs/ · tools/ · legacy/    # planos/ADRs · scripts de dev · protótipo histórico (não publicados)
```

## Rodar localmente

Toolchain **Vite + TypeScript** (migração incremental — `docs/plano-typescript-vite.md`):

```powershell
npm install
npm run dev        # servidor de dev com HMR (Vite) → http://localhost:5173
npm run build      # build de produção → dist/
npm run preview    # serve o dist/ buildado
npm test           # testes Vitest (node + browser via Playwright); npm run test:node = só a lógica
```

## CI/CD

- **CI** — GitLab CI (`.gitlab-ci.yml`): a cada push na `main` / merge request roda `npm audit`, typecheck,
  os testes Vitest (node + browser), o build check, o gate de a11y (axe) e os scanners SAST + secret
  detection. Sinal 🟢/🔴 no commit/MR; não deploya.
- **CD** — Cloudflare Pages (plano gratuito), conectado a este repo. A cada push na `main`:

  | Configuração | Valor |
  |---|---|
  | Framework preset | **None** |
  | Build command | **`npm run test:node && npm run build`** — testes de lógica barram publicação quebrada |
  | Build output directory | **`dist`** |
  | Root directory | *(raiz do repo)* |

  Publica em `*.pages.dev` (HTTPS grátis); branches/PRs geram *preview deployments*. O cache imutável
  dos assets hasheados do Vite + o `dist/_headers` cuidam da borda.

## Acessibilidade — o que o jogo demonstra

- **WCAG 2.2 (POUR)** e **GAG** como pilares inegociáveis (ver `docs/PILARES-INEGOCIAVEIS.md`).
- Operação 100% por teclado via `e.code` (ABNT/QWERTY/alternativos), gamepad e toque; remapeável.
- Visão: alto contraste, daltonismo (simulação Machado 2009 + correção), baixa visão, modo cego.
- Áudio como reforço, nunca requisito; narração TTS neural offline; legendas.
- Motora: cadeirante, um-botão, modo fácil, botões de toque dimensionados em milímetros reais.
- Surdez: Libras via VLibras (interino/online; motor próprio planejado).

## Status

Protótipo (MVP em construção). Ratificações pendentes: Lighthouse mobile, hardware-alvo real
(tablet/Chromebook de escola), auditoria automatizada (axe-core/Lighthouse/WAVE) e manual
(NVDA/JAWS/VoiceOver), e teste com crianças (incluindo NEE). **Não se alega conformidade
"completa" até o MVP validado.**

## Origem

Antecedido por um *tracer bullet* de 102 versões (v1.0.0 → v3.1.100) que ratificou empiricamente a
arquitetura acessível; o monólito final (`v3.1.100.html`, ~3454 linhas) está preservado no **histórico
git** (recuperável por `git log --all --oneline -- legacy/v3.1.100.html`). A v4 é a reescrita sobre PixiJS.
