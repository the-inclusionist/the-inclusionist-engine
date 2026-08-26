# Versionamento de build — release-it + carimbo git

Decisão (2026-07-05, José): **release-it** (padrão de indústria; você dispara localmente) + **carimbo de build por
`git describe`** injetado no Vite. Um único esquema serve os dois ambientes:

> **CORRIGIDO EM 2026-08-26.** A versão NÃO vem mais do `git describe` — vem do `package.json`. O motivo é
> um defeito que ficou dois meses no ar: `git describe --tags` só devolve versão se houver TAG ALCANÇÁVEL, e o
> repositório não tinha tag nenhuma (nem local, nem no remoto). O `--always` fazia o que prometeu e caía no
> SHA curto, então o jogo mostrava `vbbfa193` no título em vez da versão. O `package.json` está versionado e
> chega em qualquer clone — raso, sem tags, no CF Pages. Não há como faltar.
>
> O `git describe` FICA, para o que ele é bom: dizer se este build corresponde a uma versão publicada.

| Contexto | `__BUILD__.version` exibido |
|---|---|
| No commit da tag da versão, árvore limpa | `6.36.1` ← versão "de marketing" limpa |
| Adiante da tag | `6.36.1+ab12cd3` (versão + SHA curto, metadados de build do semver) |
| Com mudanças não commitadas | `6.36.1+ab12cd3-dirty` |
| Sem `package.json` legível e sem git | SHA da CF, ou `dev` |

## Como funciona

- **`vite.config.ts`** computa `BUILD = { version, sha, date, env }` no build (Node) e injeta via `define:
  { __BUILD__: … }`. `version` vem do `package.json`; o `git describe` decide se sai limpa ou com `+sha`/`-dirty`. Fallbacks:
  `CF_PAGES_COMMIT_SHA` (clone raso da CF) → `dev`. `date` = data do **commit** (estável entre rebuilds do mesmo commit → não re-hasheia o
  bundle à toa). `env` = `prod` na CF, `local` aqui.
- **`app/js/env.d.ts`** declara `__BUILD__` p/ o `tsc`. **`main.ts`** lê `__BUILD__.version` (tira o `v` inicial; o
  display já prefixa) com fallback defensivo à versão do `package.json`.
- **`.release-it.json`**: `@release-it/conventional-changelog` auto-bumpa a versão pelos **Conventional Commits**
  que já escrevemos (`feat`→minor, `fix`→patch, `BREAKING CHANGE`→major) e gera o `CHANGELOG.md`. **Não** publica
  em registry (é app, não pacote) e **não** dá push sozinho (você controla o push).

## Bootstrap — FEITO em 2026-08-26

A tag-base existe: **`v6.36.1`**, anotada, no commit que a criou. E o número não foi escolhido — foi
CONTADO dos 462 commits em Conventional Commits que se acumularam desde que o `package.json` passou a dizer
`4.164.25` sem nunca ser bumpado (o `release-it` jamais rodou um release: o único `chore(release)` do
histórico é um conserto de config).

O replay, commit a commit, partindo de `4.164.25`:

| tipo | quantos | efeito |
|---|---|---|
| `!` / `BREAKING CHANGE` | 2 | major (zera minor e patch) |
| `feat` | 38 | minor |
| `fix` / `perf` | 65 | patch |
| `refactor`/`docs`/`test`/`chore`/… | 357 | nenhum |

→ **6.36.1**. Os dois `!` são `build!: remove tts-lab submodule` e `chore!: remove the TTS lab code from the
game repo`. Ficou registrado que eles é que levam a versão de 4 para 6; lidos como higiene de repositório em
vez de quebra, o número seria `4.202.1`. A decisão foi ler o que os commits DIZEM.

Sem a tag-base, a primeira execução do `release-it` não teria de onde delimitar e a primeira entrada do
`CHANGELOG.md` sairia com 462 itens.

## Soltar uma release (você roda, quando decidir)

```powershell
npm run release            # bumpa package.json + CHANGELOG.md + commit chore(release) + tag vX.Y.Z (árvore limpa)
git push --follow-tags     # envia commits + a tag → a CF builda e o jogo passa a mostrar vX.Y.Z
```
`release-it` mostra um preview e pede confirmação antes de tocar em qualquer coisa.

## Cloudflare Pages — ajuste no build command (você, no dashboard)

Para a produção mostrar a **tag limpa** (e não o SHA), as tags precisam vir no clone raso da CF. Prefixe o build:
```
git fetch --tags --force && npm run test:node && npm run build
```
Se não fizer isso, o fallback ainda funciona: produção mostra `CF_PAGES_COMMIT_SHA` (curto) em vez da tag.

## Fontes

- [Cloudflare Pages — build env vars](https://developers.cloudflare.com/pages/configuration/build-configuration/) (tem `CF_PAGES_COMMIT_SHA`, **não** tem tag) · [pedido da tag como env var](https://community.cloudflare.com/t/git-tag-available-as-environment-variable-at-build-time/650715)
- [git describe em clone raso precisa das tags](https://github.com/actions/checkout/issues/338)
- [Injeção via Vite `define`](https://vite.dev/guide/env-and-mode) · [git hash no build Vite](https://zegnat.bearblog.dev/adding-the-git-commit-hash-to-my-vite-build/)
- [release-it](https://github.com/release-it/release-it) · [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog) · [`standard-version` descontinuado](https://github.com/conventional-changelog/standard-version)
