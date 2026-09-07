# The Inclusionist

[![ci](https://github.com/the-inclusionist/the-inclusionist-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/the-inclusionist/the-inclusionist-engine/actions/workflows/ci.yml)

Jogo educativo de plataforma **acessível-primeiro**, em PixiJS, feito para escolas públicas
brasileiras. Alfabetização (base psicogenética de Ferreiro & Teberosky) e matemática dentro de
um platformer que mira **WCAG 2.2 (AAA aspiracional) + Game Accessibility Guidelines (GAG)**:
alto contraste, simulação/correção de daltonismo, baixa visão, modo cego (navegação sonora),
narração TTS, modo cadeirante, um-botão, controles remapeáveis (teclado/gamepad/toque em mm reais),
Libras (VLibras) e tipografia para dislexia. Roda 100% offline como PWA.

**Licenças — e são duas, não uma.** O **código** é **AGPL-3.0-or-later** (ADR-0064: sob GPL, um servidor
de sala hospedado não deveria a fonte a ninguém; a seção 13 da AGPL fecha isso). A **ARTE NÃO é AGPL** —
programa é o que a Lei 9.609 define, arte segue a Lei 9.610 e pertence a quem a fez. O que governa o quê
está em [`docs/LICENSES.md`](docs/LICENSES.md); as atribuições, em [`docs/CREDITS.md`](docs/CREDITS.md).

Mecânicas de plataforma portadas do
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

- **CI** — **GitHub Actions** (`.github/workflows/ci.yml`), a cada push na `main` e a cada pull request.
  Seis serviços, nenhum decorativo:

  | job | o que barra |
  |---|---|
  | `gate` | `npm audit --omit=dev`, typecheck, Vitest (node + browser), build, orçamento de precache |
  | `adr` | o validador dos registros — oito checagens, entre elas o ponteiro bidirecional de supersessão |
  | `a11y` | axe contra o app **servido**, não contra a fonte |
  | `dco` | `Signed-off-by` em toda PR (ADR-0078); pushes do mantenedor ficam de fora |
  | `secrets` | **gitleaks** sobre o histórico INTEIRO (`fetch-depth: 0`), com `--redact` |
  | `sast` | **semgrep**, versão fixada |

  ⚠️ **Os dois scanners são de código aberto e não os nativos do GitHub, e a razão é preço:** *code
  scanning* (CodeQL) e *secret scanning* são gratuitos **só em repositório público**; em privado exigem
  GitHub Advanced Security, que é pago — e o ADR-0066 §3 mantém tudo privado até o ato. Ficam fixados por
  versão exata, porque scanner que muda de regra sozinho é portão cujo veredito ninguém reproduz.

  ⚠️ **O `.gitlab-ci.yml` foi REMOVIDO, não desativado.** O projeto no GitLab está arquivado (ADR-0066 §5),
  então aquele ficheiro não podia mais rodar — e descrevia como vigentes dois scanners que carregavam
  `allow_failure: true` e estavam vermelhos havia semanas. O histórico o guarda; o cabeçalho do `ci.yml`
  documenta o porte linha a linha.

- **CD** — ⚠️ **NÃO HÁ NENHUM**, hoje. Informado pelo Dev em 2026-09-07: **nenhum projeto do Cloudflare Pages
  está conectado a repositório nenhum**. A ressalva anterior — «a conexão apontava para o GitLab, que agora
  está arquivado» — descrevia um deploy desapontado; o estado atual é mais simples e mais grave de confundir:
  **push não é publicação**, e `dist/` só chega a alguém por um passo manual.
  A tabela abaixo fica como a RECEITA de quando houver conexão, e não como descrição do que existe:

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
