# CI / CD

The pipeline in one page. The **source of truth is the workflow file** — `.github/workflows/ci.yml`; this doc
explains *intent* and points there, it does not restate the YAML.

> ⚠️ **Reescrito em 2026-09-06.** Esta página descrevia `.gitlab-ci.yml` como fonte da verdade. Aquele ficheiro
> foi **removido**: o projeto no GitLab está arquivado (ADR-0066 §5) e não podia mais rodar. O porte para
> GitHub Actions é o que o ADR-0066 §4 chamou de *trabalho, não cópia* — e duas coisas de facto mudaram, não
> só de endereço. Estão marcadas com ⚠️ abaixo.

## CI (a cada push na `main` e a cada pull request)

Roda em **GitHub Actions**, Node fixado pelo `.node-version`. **Seis jobs**, e o que cada um barra:

| job | o que barra |
|---|---|
| `gate` | cadeia de suprimentos, tipos, testes, build e o orçamento de precache |
| `adr` | os registros — oito checagens, entre elas o ponteiro bidirecional de supersessão |
| `a11y` | axe contra o app **servido** |
| `dco` | `Signed-off-by` em toda pull request |
| `secrets` | segredo em **todo o histórico** |
| `sast` | análise estática |

Dentro do `gate`, na ordem, e a ordem é argumento:

1. **Cadeia de suprimentos** — `npm audit --omit=dev --audit-level=high`. Só as dependências de produção, que
   são as que chegam ao navegador de uma criança. Primeiro, porque uma dependência vulnerável torna o resto
   discutível.
2. **Typecheck** — `tsc --noEmit`, sem orçamento. A dívida de 273 erros da conversão chegou a zero em
   2026-08-26 e o gate de orçamento saiu; erro novo é erro seu.
3. **Testes** — `vitest run`, os dois *projects*: **node** (lógica pura) e **browser**/Playwright (render/DOM).
4. **Build** — `vite build`, que tem de produzir `dist/` limpo.
5. **Orçamento de precache** — `npm run check:precache`. ⚠️ Um `revision: null` numa URL sem hash de build faz
   o service worker instalado servir aqueles bytes **para sempre**; 97 de 141 entradas estavam congeladas em
   2026-08-25, em aparelhos que ninguém alcança.

E fora do `gate`:

6. **a11y** — axe-core contra o preview servindo `dist/`, que é o que uma escola receberia (ver
   `../6-DevOps-SRE/CI-QA.md`).
7. **ADR** — `scripts/validate-adr.py`. Portão que não existia no GitLab: o índice prometia registros
   legíveis por máquina e nada conferia, e cinco de vinte e seis não parseavam.
   🔴 **E desde 2026-09-09 (ADR-0123) a ÁRVORE não mora aqui**: o trabalho faz checkout do
   `the-inclusionist-docs` e corre o validador com `--repo engine=.`, que é a parte que **só este lado
   consegue** — abrir os caminhos de `confirmed-by` marcados `engine:`. No repositório dos registos eles são
   apenas contados, e o validador diz quantos em toda corrida.
   ⚠️ **Sem o segredo `DOCS_READ_TOKEN` o trabalho fica DORMENTE**: anuncia que não buscou nada e não
   conferiu nada, e **não reprova**. É a forma do `check:annual-report` — um portão dormente é um aviso, não
   um passe — e a razão é a do próprio cabeçalho do `ci.yml`: uma `main` vermelha por motivo administrativo
   ensina a não ler o vermelho. O `GITHUB_TOKEN` de um workflow não alcança outro repositório privado
   (medido na corrida `34352635399`, `Not Found`).
8. **DCO** — `Signed-off-by` em toda PR (ADR-0078). Só em pull request: push do mantenedor já é atribuído
   pelo git.
9. ⚠️ **SAST + detecção de segredo — MUDARAM DE FERRAMENTA, e por preço.** Eram os templates do GitLab.
   Os equivalentes nativos do GitHub — *code scanning* (CodeQL) e *secret scanning* — são gratuitos **só em
   repositório público**; em privado exigem GitHub Advanced Security, que é pago, e o ADR-0066 §3 mantém tudo
   privado até o ato. Então são **gitleaks** e **semgrep**, de código aberto, **fixados por versão exata** —
   scanner que muda de regra sozinho é portão cujo veredito ninguém reproduz. O gitleaks corre o **histórico
   inteiro** (`fetch-depth: 0`), porque segredo commitado e depois apagado continua no histórico, e é o
   histórico que fica público. Ver `../6-DevOps-SRE/Security-Pipeline.md`.

⚠️ **E nenhum dos dois é `continue-on-error`.** No GitLab os dois carregavam `allow_failure: true` e estavam
**vermelhos desde que foram incluídos** — morriam num `npm: not found` herdado de um bloco `default:`, e o ✗
cinzento não foi lido por semanas. Portar significa exatamente que agora reprovam.

Pipeline vermelho barra o merge. Manter rápido; suítes pesadas (baterias de hardware-alvo, por exemplo) são
separadas e opt-in.

## CD (deploy)

**Cloudflare Pages.** Duas formas são possíveis e são **mutuamente exclusivas** — exatamente uma pode estar
viva:

- **conectado ao git**: o CF observa o repositório, builda e publica `dist/` a cada push na `main`.
- **upload direto**: o CF não guarda repositório; um passo roda `wrangler pages deploy dist/` com
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` como segredos.

⚠️ **E aqui há uma pendência real da migração, que só se confere no painel da Cloudflare:** a conexão git
apontava para o **GitLab**, que agora está arquivado. Enquanto ela não for reapontada para
`the-inclusionist/the-inclusionist-engine`, um push na `main` **não publica**. Um projeto Pages não troca de
repositório de origem — recriar o projeto é o caminho.

O service worker (vite-plugin-pwa, por content-hash) cuida da invalidação de cache nos dois casos, então
nenhum cliente precisa de bump manual para atualizar.

## Release (versionamento)

Não faz parte do CI. Cortar versão é passo **local e humano**: `release-it` (changelog de Conventional
Commits + tag). O build carimba `__BUILD__` a partir de `git describe`. Ver `plano-versionamento.md`.

⚠️ **E o `npm.publish` do `.release-it.json` está `true` desde 2026-09-05**, o que faz `npm run release`
publicar o pacote **publicamente** no npmjs. A publicação do código é objeto do **pedido `e`** do requerimento
— ato do Poder Executivo — e o ADR-0066 §3 lista o ato entre as condições. Escrito aqui porque é a diferença
entre cortar uma versão e publicar a obra.

## Notas / TODO

- [ ] Reapontar (ou recriar) o projeto do Cloudflare Pages para o repositório do GitHub.
- [ ] Env de Node para o antivírus que reassina TLS, **se** algum dia o CI correr num runner auto-hospedado
  atrás dele (ver `../../CLAUDE.md` §6). Os runners do GitHub são limpos, então não é preciso hoje.
