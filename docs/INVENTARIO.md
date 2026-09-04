# Inventário de documentação

O que este projeto precisa ter escrito, contra o que tem. Cada secção é uma lista de trabalho, não
uma classificação: **o que criar** é o que falta, **o que não decide** é o que existe e não serve
para decidir nada, **duplicados** são dois ficheiros que decidem a mesma coisa e ainda não têm
regra de qual ganha.

A lista dos problemas vem de um catálogo externo de 108 problemas de engenharia de software; os
vereditos vêm de ler **este** repositório. A coluna da evidência é sempre daqui.

## O que torna este ficheiro falso

Três coisas, e todas as três alguém vai fazer a seguir a ler isto:

1. **Um documento da lista «o que criar» passa a existir.** A linha fica a mentir no momento em que
   o ficheiro é criado, e não no dia em que alguém repara.
2. **Um ficheiro nomeado aqui é movido, renomeado ou apagado.** Todos os caminhos abaixo são chaves
   sobre entrada mutável: nenhum deles se defende sozinho.
3. **Uma linha de «não se aplica» passa a aplicar-se.** Cada uma delas diz qual é o referente que
   falta no projeto — no dia em que esse referente aparece, o problema aparece com ele.

Nenhuma delas é detetável a olho. Quem mexer numa das três **edita este ficheiro na mesma alteração**,
ou ele apodrece — e um inventário podre é pior do que ausente, porque quem o abre decide pelo texto
errado.

Levantado em 2026-09-03.


| secção | quantos |
|---|---|
| [o que criar](#o-que-criar) | 12 |
| [o que existe e não decide](#o-que-existe-e-não-decide) | 16 |
| [duplicados](#duplicados) | 20 |
| [peso morto](#peso-morto) | 4 |
| [não decide nada](#não-decide-nada) | 4 |
| [já coberto](#já-coberto) | 68 |
| [não se aplica](#não-se-aplica) | 12 |

## O que criar — 12

Cada linha é um documento que este projeto não tem e precisa. `onde` é a proposta de caminho; muda-se se o projeto tiver outra convenção. **`o que o desatualiza` escreve-se dentro do documento**, e é a parte que costuma ficar de fora.

| artefato | onde | por que este projeto precisa | o que o desatualiza |
|---|---|---|---|
| **analysis dataset specification** | `docs/measurement/analysis-dataset-specification-<name>.md` | docs/5-Refactoring/plano-modularizacao.md:6 and :34 (`3838 linhas`) against docs/5-Refactoring/plano-modularizacao-mapa.md:3 (`v4.164.23, 3555 linhas`) and the same file's line 101 (`Medido no game.js de 2786 linhas: 220 funcoes top-level, 64 globais mutaveis… | Non-exploratory analysis code applies, to a field of the raw schema, a transformation whose effect differs from the treatment declared for that field in `dados/preparacao.yaml` — a `fillna(0)` where the specification de…<br>*teste:* `test_undeclared_cleaning_transformation.py` |
| **back-out procedure** | `docs/runbooks/rollout-plan.md` | vite.config.ts:65 (`registerType: 'autoUpdate'`) with :53-54 ('aplica a versão nova no próximo load'); .gitlab-ci.yml:75-87 (`pages_deploy`, the only deploy job, with no counterpart); CI-CD.md:28-29 ('no manual version bump is needed for clients to update');… | In an environment restored to the baseline: (a) some back-out step exits non-zero or demands interactive input — the step that will not run alone is the step nobody can run at three in the morning; or (b) after running…<br>*teste:* `test_back_out_runs_and_restores_the_previous_state.py` |
| **client brief** | `docs/plan/client-brief.md` | docs/2-Architecture/adr/ADR-0037 more-information: 'The requerimento filed with the Município de Monte Aprazível is the external document this record depends on.' (a citação nomeava ficheiro e versão até 04/09; errata declarada no próprio ADR-0037) The failure is already recorded: ADR-0055 more-informatio… | (a) a delivery whose `versao_analisada` differs from the version in production, with no addendum and no recorded re-analysis — the error in full, and the most expensive of all: the external auditor, translator, reviewer…<br>*teste:* `test_third_party_worked_on_a_different_version.py` |
| **conflict resolution policy** | `architecture.md` | app/js/consumer-quiz/main-quiz.ts:125-128 (imports `platform/storage` and `initSettingsTypo`, writing the shared scope); app/js/platform/storage.ts:44-47 (the shared scope, and 'O segundo consumidor (o quiz) já lê a fonte escolhida no jogo de plataforma') and… | For an object with a declared `politica`, with two writes A and B from the same `chave_de_versao` interleaved so they overlap: (a) both return success, the final state corresponds to only one of them, and there is no ev…<br>*teste:* `test_the_losing_write_is_returned_to_its_author.py` |
| **deprecation policy** | `docs/support-matrix.md` | package.json:16-25 (the `exports` map with open subpath globs) and its own comment at lines 7-14 ('A build step and a `types` condition are owed at the moment this package is first published, not before'); ADR-0055 section 2 line 145 (`engine -> demos, gamifi… | a deprecation mark exists without `desde` or without `remover_em`, or with `remover_em - desde` shorter than the window for its class; OR a public symbol present at the base revision is absent at HEAD and was not marked…<br>*teste:* `test_deprecated_removed_before_the_deadline_and_without_a_signal.py` |
| **disaster recovery plan** | `docs/runbooks/disaster-recovery-plan.md` | app/js/platform/storage.ts:33-53 and KEYS (lines 85-126: `modocego`, `caneDiv`, `ttsEngine`, `ttsVoice`, `fontKey`, `touchmap`, `easyP(i)` — ~40 keys, localStorage only, no export path) against docs/2-Architecture/adr/ADR-0037-there-is-no-save-and-no-child-da… | There is a system in the plan whose configured interval between copies is greater than the declared `perda_maxima`, or whose configured retention is less than the required one, or whose copies sit in the same region/acc…<br>*teste:* `test_backup_cadence_does_not_meet_the_stated_data_loss.py` |
| **disaster recovery test (DR test)** *(prática)* | `docs/runbooks/disaster-recovery-test.md` | .gitlab-ci.yml:40-43 (`npm run check:precache`, and the comment recording '97 of 141 entries were frozen on 2026-08-25'); no file under tests/ mentions offline, serviceWorker or precache; docs/6-DevOps-SRE/SLO.md defers all reliability targets; docs/2-Archite… | (a) the documented `procedimento_de_reposicao` exits with an error, does not exist, or requires an undocumented interactive step; or (b) some `consulta_de_aceitacao` returns a result other than expected after the restor…<br>*teste:* `test_restore_within_recovery_time.py` |
| **forensic readiness plan** | `docs/runbooks/forensic-readiness-plan.md` | app/js/core/loop.ts:35-41 — the error is caught, `parado` is set, `opcoes.aoFalhar?.(erro)` is called if wired and the error object is discarded; nothing writes to app/js/platform/storage.ts. ADR-0054 confirmation: '⚠️ WHAT IS NOT YET DONE: the composition ro… | Running the runbook against a broken instance of a class with no declared exception: (a) an artefact in `artefactos_exigidos` is absent from the destination at the end of the run; or (b) the sealing instant of some arte…<br>*teste:* `test_collection_before_service_restore.py` |
| **roaming network profile (GSMA IR.21) update for the changed or added node** | `docs/roaming-network-profile-update-for-the-changed-or-added-node.md` | docs/ARCHITECTURE.md line 95 still publishes the OLD scope — 'consumindo pacotes versionados @jrocha-io/* (tts/audio/logging/model-fetch) do repo inclusionist-commons' — while ADR-0055 §1 and its consulted list say the scope is @pm-monte. This is the failure… | (a) A configuration file marks a value `@published-parameter: <id>` (or `visivel_externamente: true`) and no entry of the profile declares that id: the parameter by which a third party reaches us exists only in our own…<br>*teste:* `test_published_parameters_match_the_running_configuration.py` |
| **rollout plan** | `docs/runbooks/rollout-plan.md` | vite.config.ts:65 (`registerType: 'autoUpdate'`); .gitlab-ci.yml:78-87 (`pages_deploy` gated only on `main` plus two variables, no stages); CI-CD.md:21-26 (both delivery shapes publish `dist/` wholesale on every push to `main`); Feature-Flags.md:3-5, :9 and :… | A flag is tied to a plan and its configured exposure exceeds the `populacao_pct` of the current phase; or a flag has no plan at all and exposure greater than zero; or a phase of the plan has no `criterio_de_aborto`, or…<br>*teste:* `test_flag_exposed_beyond_its_phase_and_phase_without_abort_criterion.py` |
| **training evaluation plan** | `docs/training/training-evaluation-plan.md` | grep for 'issue #7' / 'field test' across docs/ returns only the four ADR confirmation clauses above; there is no docs/training/, no evaluation plan, and no docs/compliance/ directory yet. The external commitment that would need one: requerimento item 39.m, a… | For an intervention whose effective date is in the past: (a) its `indicador_primario` comes from a source with `natureza: auto_relato` — the error exactly, measuring the satisfaction of the people who received it instea…<br>*teste:* `test_effectiveness_measured_in_the_indicator_not_in_the_survey.py` |
| **upgrade plan** | `specs/NNN-atualizacao-<dependency>/plan.md` | package.json:46 (`@mintplex-labs/piper-tts-web` still a devDependency) against docs/research/tts-sherpa-onnx-plan.md ('replacing the discontinued `@mintplex-labs/piper-tts-web`'); package.json:51 (`pixi.js: 7.4.2`, exact) and :59-63 (`overrides`); Security-Pi… | (a) a symbol of the upgraded package is used on any path of the repository — including one no test executes — that does not exist in the target version, as introspected from the package installed in an isolated environm…<br>*teste:* `test_symbol_used_that_the_new_version_lacks.py` |

<details><summary>o problema que cada um responde</summary>

- **analysis dataset specification** — dois relatórios sobre o mesmo facto dão números diferentes, e ninguém consegue dizer que origens alimentaram o número publicado nem que decisão de limpeza ou de agregação o produziu
- **back-out procedure** — descoberto o problema depois do corte, não existe estado definido a que voltar nem se sabe a partir de que instante voltar deixou de ser possível
- **client brief** — o trabalho começa sem nada que o declare existente, lhe fixe âmbito e justificação comprometidos e nomeie quem tem autoridade sobre recursos, pelo que a decisão de continuar ou parar é tomada sem referência escrita ao que foi prometido e ninguém sabe quem pode decidir o que
- **conflict resolution policy** — duas alterações concorrentes produzem estados divergentes que nunca voltam a convergir, e a fusão automática escolhe um vencedor sem que o autor da alteração perdida saiba que ela foi descartada
- **deprecation policy** — algo de que outros dependem é retirado de serviço sem prazo de aviso declarado, pelo que o consumidor descobre a retirada quando o recurso deixa de responder
- **disaster recovery plan** — descobre-se que a cópia não repõe precisamente no dia em que ela é precisa, e o tempo de retorno prometido é um número estimado que nunca foi medido
- **disaster recovery test (DR test)** — a resiliência prometida nunca foi observada a acontecer, e o tempo de resposta ou de recuperação prometido é um número que ninguém mediu em condições reais
- **forensic readiness plan** — o sinal que sustentaria o diagnóstico desaparece antes de alguém o congelar — pela reposição do serviço, pelo corte de energia, por o aparelho estar noutras mãos — e depois não se consegue reconstituir que ação produziu que efeito
- **roaming network profile (GSMA IR.21) update for the changed or added node** — os parâmetros pelos quais outra organização me alcança — identificadores, endereços, certificados, prefixos — vivem na configuração dela, e nada obriga a republicá-los quando mudam: a alteração está correta do meu lado, tudo local está saudável, e a falha aparece só do lado de quem não a causou, invisível de onde foi provocada e sem dono onde é sofrida
- **rollout plan** — um defeito só descoberto em produção atinge toda a população de uma vez, e a decisão de continuar ou parar cabe ao juízo de quem está a lançar no meio do lançamento
- **training evaluation plan** — a intervenção é declarada bem-sucedida com base na satisfação de quem a recebeu, e ninguém verifica se o comportamento chegou ao trabalho nem se o indicador que a motivou se moveu
- **upgrade plan** — a subida de versão parte os clientes que ainda falam a forma antiga, ou lê o estado que a versão anterior escreveu com outro esquema

</details>

## O que existe e não decide — 16

O ficheiro está lá e é aberto por quem procura a resposta. O que falta é a decisão: **reescrever, não criar**. É a lista mais barata de resolver e a mais caras de ignorar — um documento que descreve sem decidir custa a leitura e não paga nada.

| artefato | ficheiro | a decisão que falta |
|---|---|---|
| **GO Product Roadmap** | `docs/ROADMAP.md` | docs/ROADMAP.md is the file every other document sends you to for the plan — CLAUDE.md:51-53 states that the backlog lives in GitLab issues and 'ROADMAP.md guarda só a estratégia/ordem', and ARCHITECTURE.md maps it as the canonical roadmap. Open it and it dec… |
| **SOUP list** | `docs/CREDITS.md` | docs/CREDITS.md is this repository's register of third-party components and reads like one: Clarity (MIT, with the full licence text), sherpa-onnx (Apache-2.0), Piper (MIT), eSpeak NG (GPL-3.0), the pt-BR voices. It even decides one thing well — 'crédito acom… |
| **build recipe** | `docs/2-Architecture/CI-CD.md` | docs/2-Architecture/CI-CD.md is the canonical page for CD and opens with 'the pipeline in one page'. Its §CD names two mutually exclusive deployment shapes, asserts 'exactly one must be live', and then decides NEITHER — and it never states the build command t… |
| **compatibility matrix** | `docs/2-Architecture/plano-versionamento.md` | `docs/2-Architecture/plano-versionamento.md` is the repository's versioning policy — the exact shape this problem asks for — and it is unusually convincing: a table of what `__BUILD__.version` shows in four situations, a bump table (`feat`->minor, `fix`->patc… |
| **content maintenance plan** | `docs/ARCHITECTURE.md` | docs/ARCHITECTURE.md claims the role in the strongest terms available — 'START HERE — this is THE map. The first doc to open on ANY prompt (for the AI and any LLM it coordinates)' and 'Any change to structure, a filename, or a naming convention is reflected h… |
| **data archiving policy** | `docs/2-Architecture/adr/ADR-0037-there-is-no-save-and-no-child-data.yaml` | ADR-0037 is the most convincing document in this repository — a complete YADR with four decision drivers, three considered options with pros and cons, a graded consequences block and a `confirmation` section — and it is the document a reader consults to answe… |
| **data residency policy** | `docs/2-Architecture/DFD.md` | DFD.md exists for one job — to mark the trust boundaries before anything crosses them — and it asserts that nothing has: `no identifier leaves the browser. There is no PII flow to diagram yet.` The code crosses two boundaries today, both into systems that are… |
| **incident communications plan** | `docs/SECURITY.md` | `docs/SECURITY.md` is the only document shaped like an incident-communications plan, and it reads like one: a reporting channel, an acknowledgement window ('within 5 business days'), a triage rule (CVSS plus the non-negotiable pillars), a fix window, and a cr… |
| **item bank** | `docs/2-Architecture/adr/ADR-0007-ai-content-human-curation.yaml` | ADR-0007 is titled 'AI-generated content is gated by human curation — the human is accountable' and its confirmation asserts, as a statement of fact, that 'No AI-generated content reaches children without a recorded human review/approval; the curation policy… |
| **opportunity solution tree** | `docs/1-Discovery/User-Stories.md` | docs/1-Discovery/User-Stories.md is indexed by CLAUDE.md:148-152 and by ARCHITECTURE.md as the canonical requirements artefact of the software layer — the place where each item's user and benefit are supposed to be recorded — and it has exactly the right shap… |
| **prompt registry** | `docs/research/auditoria-creditos-pixellab.csv` | The repository does hold texts that govern the output of a system: the prompts given to the AI image tools that produced the character and tileset art, and the project's own legal analysis makes their wording consequential — LICENCAS-GERACAO-IMAGEM.md:86 argu… |
| **recertification policy** | `docs/ARCHITECTURE.md` | ARCHITECTURE.md has the maximum possible authority for this problem and provides nothing that forces its own re-examination. It opens by commanding every reader and every agent to start there — 'START HERE - this is THE map. The first doc to open on ANY promp… |
| **secrets management policy** | `docs/6-DevOps-SRE/Security-Pipeline.md` | The repository does hold a credential that can publish to the production site: `CLOUDFLARE_API_TOKEN`, in GitLab CI variables and — per CLAUDE.md §6 — on the Dev's own Windows machine, because wrangler's interactive OAuth is banned there. `docs/6-DevOps-SRE/S… |
| **security configuration baseline** | `docs/2-Architecture/STRIDE.md` | The deployment surface exists and is exactly as described: app/public/_headers is the edge configuration, and it configures ONLY Cache-Control — every security-relevant header is left at the vendor default. There is no Content-Security-Policy, no Permissions-… |
| **system security and privacy plan (SSP)** | `docs/2-Architecture/adr/ADR-0037-there-is-no-save-and-no-child-data.yaml` | ADR-0037 is an accepted architectural decision record that asserts, in the imperative and with a clause telling the reader not to soften it later, that this system handles no data of the relevant kind at all: 'THE PRIVACY POSITION, stated so it is not softene… |
| **technical debt register** | `docs/research/LACUNAS-V3-vs-V4.md` | LACUNAS-V3-vs-V4.md has the exact shape of a debt register — 8.4 KB, a ranked table of 11 ALTO / 11 MÉDIO / 3 BAIXO items, each with a v3 line reference and a `Por que importa` column, closing with a 10-step `Roadmap de paridade proposto`. It decides nothing… |

<details><summary>a evidência, ficheiro a ficheiro</summary>

- `docs/ROADMAP.md` — docs/ROADMAP.md:3-6 (the executable roadmap is the issue board), :22-23 ('detail per phase (steps + done-criteria) is in the corresponding roadmap issue'), :31-35 (the stale current-state block) against CLAUDE.md:65-68, where the MVP was redefined on 2026-08-28; the period that WAS fixed with metrics is docs/research/AVALIACAO-ADVERSARIAL-PREMORTEM.md:85-110.
- `docs/CREDITS.md` — docs/CREDITS.md:44-64 (no version for sherpa-onnx, Piper, eSpeak NG or any voice; 'deve ser confirmada por voz antes de distribuição formal'); the vendored, unlocked weights under docs/research/sherpa-wasm/vits-piper-pt_BR-*/; docs/SECURITY.md:35-36 vs docs/6-DevOps-SRE/Security-Pipeline.md:8-15; the counter-example app/js/ui/caa-sets.ts:44-60 (tier + licence + availability per set)
- `docs/2-Architecture/CI-CD.md` — docs/2-Architecture/CI-CD.md:19-29 ('Two shapes are possible and they are mutually exclusive — exactly one must be live') vs README.md:49-59 (the dashboard table) vs docs/2-Architecture/plano-versionamento.md:64-70 ('ajuste no build command (você, no dashboard)') vs .gitlab-ci.yml:70-87
- `docs/2-Architecture/plano-versionamento.md` — plano-versionamento.md:30-31 ('**Não** publica em registry (é app, não pacote)') against package.json:16-25 (exports map) and ADR-0055:145-146 (PACKAGE edges); plano-versionamento.md:37-38 ('o `release-it` jamais rodou um release'); no `CHANGELOG.md` in the repository root; package.json:59-63 `overrides.vite-plugin-pwa.vite = $vite` — a live version-compatibility conflict that no document records.
- `docs/ARCHITECTURE.md` — docs/ARCHITECTURE.md:3-7 vs :34 ('is migrating') vs :130-132 ('Migration: complete' + names PILARES, REGISTRO — absent from the tree); CLAUDE.md:90,92,97-98 pointing to docs/plano-*.md while the files sit under docs/2-Architecture/, docs/3-Sprint-Design/, docs/5-Refactoring/; README.md:12,63
- `docs/2-Architecture/adr/ADR-0037-there-is-no-save-and-no-child-data.yaml` — app/js/platform/storage.ts:85-126 (KEYS: `wheelchair: 'incl_wheelchair'`, `hearingloss: 'incl_hearingloss'`, `modocego: 'incl_modocego'`, `easyP: (i) => 'incl_easy_p' + i`) and storage.ts:53 (`é dado da criança, não meu para apagar`), against ADR-0037 consequences (`The whole LGPD surface leaves this repository. Not mitigated — absent.`) and decision-outcome (`the Inclusionist stores NOTHING abou…
- `docs/2-Architecture/DFD.md` — app/js/ui/webcam.ts:46-51 (`s.src = 'https://webgazer.cs.brown.edu/webgazer.js'`, loaded lazily on first use, `Precisa de internet no 1º uso`) and .gitlab-ci.yml:87 (`wrangler pages deploy dist/`), against docs/2-Architecture/DFD.md:3-4 (`no identifier leaves the browser`) and :16 (`Trust boundaries: the device, the LAN, the self-hosted backend`).
- `docs/SECURITY.md` — docs/SECURITY.md:35-36 ('Automated scanning is already in place: **CodeQL** ... **Dependabot** ...') refuted by docs/6-DevOps-SRE/Security-Pipeline.md:8-9 and :15-17, and by .gitlab-ci.yml:23-24 ('Dependabot has NO GitLab equivalent on Free; the `npm audit` gate below is what guards us for now'); SECURITY.md:18-24 ('What to expect') decides only the inbound channel; ADR-0036:121 ('A window with t…
- `docs/2-Architecture/adr/ADR-0007-ai-content-human-curation.yaml` — The item bank that exists: app/js/game/activity-content.ts:22-28 (SILABAS_WORDS — fifteen two-syllable words, hand-written, the whole literacy pool) and app/js/game/literacy-distractors.ts:26-36 (ferreiroDistractors generates four wrong answers per item at runtime). Neither carries a reviewer, a date or a review record, and no docs/ file holds one. ADR-0007 confirmation lines 51-53 assert otherwi…
- `docs/1-Discovery/User-Stories.md` — docs/1-Discovery/User-Stories.md:10-21 (the five seed items and the 'Backlog form only; not yet tied to traceability IDs (deferred)' status); the covered half is docs/educational/Learning-Objectives.md (Mager + BNCC form, observable objective with approval criterion); CLAUDE.md:148-152 is what points a reader at the empty file.
- `docs/research/auditoria-creditos-pixellab.csv` — docs/research/auditoria-creditos-pixellab.csv:1 (header `entrada(prompt/edit/template)`) and :2,10,15 (prompts cut mid-word, unmarked); docs/research/LICENCAS-GERACAO-IMAGEM.md:86; no prompts stored under app/ or tools/
- `docs/ARCHITECTURE.md` — docs/ARCHITECTURE.md lines 3-7 (START HERE + the same-commit freshness rule) against line 131 ('Migration: complete ... ARCHITECTURE, ROADMAP, PILARES, REGISTRO'); a glob of docs/*.md returns ARCHITECTURE.md, ROADMAP.md, CONTRIBUTING.md, CREDITS.md, SECURITY.md — no PILARES.md, no REGISTRO.md; CLAUDE.md lines 160-166 ('Migracao em curso') contradicting it; docs/2-Architecture/CI-CD.md line 34 vs…
- `docs/6-DevOps-SRE/Security-Pipeline.md` — .gitlab-ci.yml:74 ('Requires CI/CD variables CLOUDFLARE_API_TOKEN (masked, protected) and CLOUDFLARE_ACCOUNT_ID') and :87 (`npx wrangler pages deploy`); CLAUDE.md:140-141 ('Nunca o OAuth interativo do npx wrangler → usar CLOUDFLARE_API_TOKEN'); against docs/6-DevOps-SRE/Security-Pipeline.md:5 ('no server, no secret handling yet') and :24-25 ('no auth and handles no data at rest').
- `docs/2-Architecture/STRIDE.md` — app/public/_headers (Cache-Control only; no CSP/Permissions-Policy/X-Content-Type-Options in any file under app/); docs/2-Architecture/STRIDE.md:15,17 ('SRI for any CDN dep'; 'nothing leaves the device') vs app/index.html:454 (remote script, no integrity attribute) and app/js/ui/webcam.ts:2-4 (WebGazer from a CDN, webcam gaze control)
- `docs/2-Architecture/adr/ADR-0037-there-is-no-save-and-no-child-data.yaml` — app/js/platform/storage.ts lines 85-126, the KEYS registry: onebtn 'incl_onebtn', wheelchair 'incl_wheelchair', modocego 'incl_modocego', caneDiv 'incl_cane_div', hearingloss 'incl_hearingloss', cbsafe 'incl_cbsafe', vizP(i) 'incl_viz_p'+i, easyP(i) 'incl_easy_p'+i — all written through set()/setBool() as plain localStorage strings. Lines 43-53 of the same file decide these belong to the SHARED s…
- `docs/research/LACUNAS-V3-vs-V4.md` — docs/research/LACUNAS-V3-vs-V4.md row A2 (`Tela de PAUSA inexistente`, 🔴 ALTO) against docs/2-Architecture/adr/README.md ADR-0044 (`a pausa fica com UMA lista de sete opções (resume primeiro, quit último)`) and app/js/ui/pause-icons.ts; and the roadmap line `José define/reordena`. The real debt is nameable elsewhere: docs/5-Refactoring/plano-modularizacao-mapa.md sizes `~34 módulos, em 3 tiers po…

</details>

## Duplicados — 20 pares

Dois ficheiros que decidem a mesma coisa. **20 julgados** — `ficam_os_dois` 10 · `fica_B` 6 · `fundir` 4.

`ficam_os_dois` é uma correção da passada anterior: o par não era duplicado. Sobram **10** a resolver.

- `docs/1-Discovery/plano-acessibilidade.md` × `docs/2-Architecture/adr/ADR-0011-visual-accessibility.yaml (and ADR-0013 for the motor/Easy half)` → **`fundir`**  *(plano sucedido)*
  - largar A: Which of the thirteen palettes plays which role (P1 direct light, P2-P3 light, P4-P5 washed, P6 vivid, P9-P10 dark, P11-P13 very dark) and which triples pair at ~3:1 for the colour mode (P1xP6xP11, P2xP7xP12, P3xP8xP13). No ADR carries it: ADR-0018 names only the Okabe-Ito CB-safe palette, and game-
  - largar B: Everything currently true about contrast: three selectable levels with 3:1 as the default and the recorded reason 7:1 was refused for the world (it flattens pixel art into yellow/black/white), the 2026-08-27 amendment that menus are born at 7:1 while the world's default is untouched, the daltonizati
  - **fazer:** Move the palette-role table, the seven reduced-motion toggles and the Easy x0.7 into ADR-0011/ADR-0013 (or an art-data doc), then delete plano-acessibilidade.md and repoint ADR-0011's '[plano-acessibilidade]' citation at their new home.
- `docs/1-Discovery/plano-audio-fase-f.md` × `docs/2-Architecture/adr/ADR-0014-auditory-accessibility.yaml` → **`fundir`**  *(plano sucedido)*
  - largar A: How the audio is actually built. The bus topology (osc/filtered noise -> gainCategoria[cat] -> StereoPanner -> _masterGain -> hearing-loss -> destination), the synthesis recipe per category (looped filtered-noise layers for ambient, short-envelope noise timbred by surface material for footsteps, the
  - largar B: The role partition A gets wrong, plus decisions A never had: blind mode = audio aids WITHOUT darkening the screen while blind-EMPATHY is the black screen; sound per-player audio output (setSinkId) and the rule that volume/TTS/blind-mode are editable only by whoever has a private output; hearing-loss
  - **fazer:** Delete section 4 and decisions 3 and 5 of the plan (the preset tied to viz='blind' 'ja que a tela e preta') and rewrite the trigger as blind MODE per ADR-0014/ADR-0046, keeping the rest of the file as the audio design detail ADR-0014 already delegates to.
- `docs/1-Discovery/plano-tts-fase-f5.md` × `docs/2-Architecture/adr/ADR-0022-tts-sherpa-onnx-wasm-runtime.yaml (which supersedes ADR-0021, which superseded this file)` → **`fica_B`**  *(plano sucedido)*
  - largar A: nenhum. Every question A could answer, B answers more currently and with measurements instead of expectations: which engines have real pt-BR (B: Kokoro-js and KittenTTS are English-only in the browser, so they are not per-language options); what a voice costs (B measures model.onnx at 61 MB and a sh
  - largar B: The entire live TTS design: sherpa-onnx-wasm as the runtime with the universal-loader approach that makes a voice a data change, Cloudflare R2 hosting and why HuggingFace could not serve raw model files, the three-locale engine-owned roster (en_US, pt_BR, es_MX) after jeff was removed by ear, why in
  - **fazer:** Delete docs/1-Discovery/plano-tts-fase-f5.md and repoint ADR-0014's '[plano-tts-fase-f5 - full neural build is issue-tracked]' citation at ADR-0022.
- `docs/2-Architecture/C4-Context.md` × `docs/ARCHITECTURE.md (which declares itself as holding 'files, code layout, system context' and is the map the coverage pass would have reached first)` → **`ficam_os_dois`**
  - largar A: Which systems the game talks to at runtime and how each one arrives: VLibras as an online read-only widget, WebGazer lazy-loaded from a CDN on first use, PixiJS 7.4.2 bundled and tree-shaken, Cloudflare Pages as host. VLibras and WebGazer appear in no package.json, so this table is their only enumer
  - largar B: Where every file lives and what each holds: the repository tree, the docs/ tree by SDD phase with a line per canonical document, the app/js/ folder-to-module table, the naming conventions, and the standing rules (dead docs are deleted, engine constants live only in core/constants.ts, the Z-order liv
  - **fazer:** Keep both unchanged and add one row to ARCHITECTURE.md's file table sending the reader to C4-Context.md for actors, edge dependencies and non-goals.
- `docs/2-Architecture/plano-engine.md` × `docs/2-Architecture/adr/ADR-0035-the-engine-is-ours-phaser-is-read-not-imported.yaml (with ADR-0027, ADR-0030 and ADR-0036)` → **`fica_B`**  *(plano sucedido)*
  - largar A: nenhum. Its only non-decision content is the section-3 subsystem table's 'Estado hoje' column - a current-structure description, which is the one thing on the survival list - and that column is both wrong and superseded: it lists core/loop, core/state, core/world and core/tiles as 'a extrair' when a
  - largar B: The scope premise that is now true and the argument for it: the target is every game in a 383-subgenre catalogue rather than this one game; the engine is not a renderer (PixiJS is), so the choice is about a renderer's cost and not a missing capability; Phaser is read but never forked and never impor
  - **fazer:** Delete docs/2-Architecture/plano-engine.md and repoint its citers at ADR-0035/ADR-0036 for scope and ARCHITECTURE.md section 3 for the module map.
- `docs/2-Architecture/plano-typescript-vite.md` × `docs/2-Architecture/adr/ADR-0019-adopt-typescript-vite.yaml, and docs/2-Architecture/CI-CD.md for the deploy rule` → **`fica_B`**  *(plano sucedido)*
  - largar A: nenhum, and the last candidate falls on inspection. The stage/lot diary is progress state, and ADR-0019's confirmation field reports it more currently (53 of 54 modules under app/js are .ts). The Deploy section's rule that exactly one delivery path may be live is decided in CI-CD.md with both shapes
  - largar B: Why the toolchain changed and what it bought: types as a gate over the modules, a smaller payload on the target hardware, vite-plugin-pwa retiring the hand-made sw.js and the manual INCL_VERSION bump, and the statement that 'no build / no bundler' stops being a preference so its mentions in the old 
  - **fazer:** Delete docs/2-Architecture/plano-typescript-vite.md and remove ADR-0019's two pointers to it (the context line and the more-information line).
- `docs/3-Sprint-Design/bdd/README.md` × `docs/educational/Learning-Objectives.md (and docs/3-Sprint-Design/Test-Plan.md, which delegates the educational half back to this file)` → **`ficam_os_dois`**
  - largar A: In what FORM pedagogical acceptance is written and who it is written for: one .feature per activity, authored in pt-BR with '# language: pt' because the audience is Brazilian educators, keyed by BNCC code rather than by the deferred FEAT-### ceremony, scoped to what the learner does and what counts 
  - largar B: WHAT counts as success, per activity, with a degree: ten rows of BNCC code + observable verb + condition + mastery criterion ('>= 80% (3x)', '3 vitorias', 'forma a palavra (3x)') across alf1-alf6 and the four mathematics activities, plus the project's domain standard of three wins per light reward. 
  - **fazer:** Keep both and fix two lines in A instead of the file: give the example a degree taken from B's table, and replace its stale 'ver SRS.md' reference with a link to Learning-Objectives.md, which absorbed the SRS.
- `docs/4-Sprints/TDD.md` × `docs/CONTRIBUTING.md` → **`fica_B`**
  - largar A: One sentence, and it is not a document's worth: the stack-negative 'not Jest/PyTest/JUnit - those belong to other stacks the SDD schema lists generically', which stops a reader importing the schema's generic vocabulary. Everything else in the file is stated elsewhere and usually better - CONTRIBUTIN
  - largar B: The whole way of working: language policy (English everywhere, pt-BR only for intrinsically Brazilian domain content), Conventional Commits and the Co-Authored-By trailer, the validation gate before 'done', where the backlog lives and how labels carry priority, the 'documentation is actionable' cut 
  - **fazer:** Move the 'not Jest/PyTest/JUnit' sentence into CONTRIBUTING's Tests bullet, delete docs/4-Sprints/TDD.md, and point ARCHITECTURE.md's 4-Sprints row at plano-testes.md for the patterns.
- `docs/5-Refactoring/Engineering-Rules.md` × `docs/2-Architecture/adr/README.md` → **`fica_B`**
  - largar A: nenhum, and keeping it costs something. Its lifecycle half is B's subject, stated by B in more detail and with the clause A lacks: since 2026-08-27 a record that states the WRONG decision is AMENDED in place, dated, with the original text kept - so A's absolute 'never an edit to an accepted record' 
  - largar B: The whole ADR discipline and the index that makes it navigable: the YADR key order, the two shapes and why bundle records have no considered-options, the validator that catches prose whose ': ' silently turns a list item into a mapping, the naming rule, the supersede/amend distinction with the Dev's
  - **fazer:** Delete docs/5-Refactoring/Engineering-Rules.md and point ARCHITECTURE.md's 5-Refactoring row at adr/README.md for the lifecycle and plano-modularizacao.md for the refactoring rules.
- `docs/5-Refactoring/plano-tts-lab-modularizacao.md` × `docs/2-Architecture/adr/ADR-0030-engine-axis-is-a-declared-contract.yaml` → **`ficam_os_dois`**
  - largar A: How the TTS lab is cut into product: the four packages and what each owns (@jrocha-io/tts = the TtsEngine port, SynthRequest/Voice/SynthMetrics, the four adapters and the registry; audio = the AudioPlayer port and the persistent AudioContext with capped normalisation; logging = the Logger port; mode
  - largar B: A different subject entirely: along which axis THIS repository splits into engine and game. The measurement that three subsystems split in the same place, so the axis is what the game DECLARES and not the genre; the four options and why a genre layer regroups the findings instead of resolving them; 
  - **fazer:** Keep both; the duplication verdict was wrong - B never mentions @jrocha-io or a TTS port, and the plan itself names ADR-0023/0024/0025 as the decisions it executes. Instead, move the plan to inclusionist-lab, where its subject now lives, and before moving it correct the final clause of its CONCLUIDO
- `docs/educational/Curriculum-Map.md` × `docs/2-Architecture/adr/ADR-0043-a-known-debt-gets-a-budget-that-only-goes-down.yaml` → **`ficam_os_dois`**
  - largar A: Which skill each existing activity covers and which stage it belongs to — the ten-row matrix — and the rule that an activity descends to the Reuna prerequisite instead of blocking the child. It is a coverage inventory, which is the one thing an ADR is not supposed to hold.
  - largar B: Why a red typecheck gate was answered with a descending budget rather than `continue-on-error`, and the two-clause shape (zero outside the converting file, at most ORCAMENTO inside it) that the precache, engine-boundary and i18n gates reuse.
  - **fazer:** Keep both, and open an issue against `Curriculum-Map.md` alone: fill the `Habilidade (BNCC?)` column with real BNCC codes, because the rule it declares (gap becomes issue) cannot be executed against a standard the matrix never names.
- `docs/educational/alfabetizacao.idd.md` × `docs/2-Architecture/adr/ADR-0045-the-run-button-becomes-a-latch-and-its-other-jobs-move-to-the-jump.yaml` → **`ficam_os_dois`**
  - largar A: Which six literacy games exist, in what order, against which Ferreiro hypothesis each one sits, and what separates game 2 from game 3 (the `hearSyl=quizLevel===2` flag). Also the only place that records that VLibras translation is REMOTE (`traducao2-dth.vlibras.gov.br`) and therefore breaks the offl
  - largar B: Why the jump is contextual when `toggleRun` is on, why the cane probe reads `botaoDeCorrerEngatado` and not `correndoAgora`, and which four classes of carryable object may be thrown or dropped. Nothing in the literacy document touches input, physics or carrying.
  - **fazer:** Keep both and delete the pairing: the two files share no decision, so record `duplica` as an artefact of the catalogue-row match and leave `alfabetizacao.idd.md` alone.
- `docs/research/LICENCAS-GERACAO-IMAGEM.md` × `docs/research/compliance-legal.md` → **`ficam_os_dois`**
  - largar A: Which image generator may be used for THIS flow, per supplier: that SD 3/3.5 and Midjourney carry a revenue trip-wire that travels with the model into a third party's deployment, that FLUX.1 dev and Higgsfield are forbidden, that Firefly is the only indemnified one. Plus the idea-versus-expression r
  - largar B: Everything outside section 5: the regime table per region, RN-01..04, the ABNT geometry, section 6.5's extra standards and the funding-source list. Section 5 is one of six sections and the only one that overlaps.
  - **fazer:** Keep both, cut compliance-legal.md section 5 down to its conclusion plus the pointer it already carries (`Detalhe: LICENCAS-GERACAO-IMAGEM.md`), and open an ADR for the art-licence decision — it is currently decided twice in `research/` and zero times in `adr/`, even though compliance-legal.md's own
- `docs/research/PESQUISA-ALTO-CONTRASTE.md` × `docs/2-Architecture/adr/ADR-0011-visual-accessibility.yaml` → **`fundir`**
  - largar A: Two things, and only the second is fatal. (i) Why CLAHE and VCEA lose, with sources (Zuiderveld 1994; Sensors 2015) and the cost model — a histogram per frame, per tile, times up to four viewports at 60fps on a school Positivo. The ADR keeps the conclusion and the reason in one line, so this is evid
  - largar B: Eleven other visual-accessibility decisions the study never touches — the two configurable outlines, the TEA mode, the CB-safe palette scope, the 16px UI floor, and the 2026-08-24 amendment that moved the colour-blind corrections out of the Empathy menu. B is not droppable under any reading.
  - **fazer:** Move section 6's threshold and measurement method into `docs/1-Discovery/NFR.md` (where ADR-0011's own header sends testable thresholds) and the four alternatives with their sources into ADR-0011 as `considered-options` / `pros-and-cons`, then replace the study with a pointer — the file's body is th
- `docs/research/PESQUISA-DALTONIZACAO.md` × `docs/2-Architecture/adr/ADR-0011-visual-accessibility.yaml` → **`ficam_os_dois`**
  - largar A: Which published table each of the 120 numbers comes from, and how to re-derive any one of them: Machado 2009 Table 1 at severity 1.0 checked on the authors' UFRGS page, Fidaner's M_err checked against `daltonize.py`, and the composition C = I + M_err(I - Sim) that produces the six matrices. Also the
  - largar B: The other eleven decisions of the bundle, and the accepted status of the sRGB-on-both-paths clause. Same as the pair above: B never leaves.
  - **fazer:** Keep both and reduce section 4 to a cross-reference to ADR-0011, so the values and their sources stay here and the decision clauses (Brettel deferred, sRGB on both paths) are stated in exactly one place.
- `docs/research/compliance-legal.md` × `docs/2-Architecture/adr/ADR-0017-compliance-and-data-governance.yaml` → **`ficam_os_dois`**
  - largar A: Why the 420x180 Libras panel complies (ABNT NBR 15290: height >= 1/2, width >= 1/4 — 25% x 100%), what GB/T 37668, EN 301 549 and the China 40-minute youth lock demand, which funding sources are in play, and the per-point confidence marks. ADR-0017 carries none of it: it is seven one-line decisions.
  - largar B: The accepted, dated, immutable record of local-law-wins and RN-01..04 — the thing a reader is entitled to treat as settled. The research file marks itself `resumos de engenharia, NAO aconselhamento juridico`; it cannot be the authority.
  - **fazer:** Keep both: the division is declared in A's own header (analysis here, testable rules in NFR.md, decisions in adr/) and each file holds only its half, so change nothing in this pair.
- `docs/research/requerimento-secao-tratamento-de-dados.md` × `docs/2-Architecture/DFD.md` → **`ficam_os_dois`**
  - largar A: Which legal basis applies to a record depending on where it came from — own-municipality school, another network, a private clinic, or a family that registered itself — and that only the fourth rests on consent, so a revocation collapses that registration alone. Also the tenancy rule (database or sc
  - largar B: At what point the PII data-flow diagram must be drawn, and what it must cover — the trigger is the local Student Manager or xAPI/Caliper/LTI telemetry, and the crossings are where STRIDE.md applies. It decides nothing else: the file is a placeholder that says so.
  - **fazer:** Keep both, and fix the false sentence in DFD.md — `no identifier leaves the browser` is contradicted by `app/js/ui/webcam.ts:46-51`, which loads WebGazer from a third-party CDN — then link its Area C section to this document instead of restating the claim.
- `docs/research/requerimento-v7-alteracoes.md` × `docs/research/auditoria-creditos-pixellab.csv` → **`ficam_os_dois`**
  - largar A: Why the v7 requerimento says what it says where it differs from v6: that the ronde francesa families are detected and never shipped, and that naming a download address would itself be distribution those licences forbid; that Mulberry replaced ARASAAC as the packaged default over the AGPLv3 NonCommer
  - largar B: Which tool, which operation and which prompt produced each art reference, and at what credit cost — which is the evidence for the hard rule stated in `LICENCAS-GERACAO-IMAGEM.md` (`registrar qual ferramenta/plano gerou cada referencia`). It is the provenance record, thin and truncated mid-word, but 
  - **fazer:** Keep both and repair the CSV instead of deciding between them: re-export it with the full `entrada` column, since a provenance log truncated at ~110 characters cannot prove which prompt produced which sprite.
- `docs/research/tts-engines-comparison.md` × `docs/2-Architecture/adr/ADR-0022-tts-sherpa-onnx-wasm-runtime.yaml` → **`fica_B`**  *(plano sucedido)*
  - largar A: One live measurement and one dead survey. The measurement: `faber-medium` carries a standard-BR accent on sentences and a slightly Angolan one on isolated letters, syllables and words, and `pt_PT-tugao-medium` hisses — which is why isolated tokens were routed away from the neural engine. The survey 
  - largar B: The entire runtime decision and everything amended into it: Approach B, R2 hosting, runtime-cache on first use with the 200 MB arithmetic that forced it, jeff removed by ear, and the measured reason `int8` is out (RTF 5.6 against 2.5, plus silent output on ORT-web).
  - **fazer:** Put a superseded banner at the top of `tts-engines-comparison.md` pointing to ADR-0022 and `tts-sherpa-onnx-plan.md`, delete the bolded `This is the engine for the phoneme drill`, and raise one open question before retiring the file: it says Piper reads isolated letters poorly while ADR-0022 line 75
- `docs/research/tts-ncnn-vs-onnx.md` × `docs/2-Architecture/adr/ADR-0022-tts-sherpa-onnx-wasm-runtime.yaml` → **`fundir`**
  - largar A: Under what condition NCNN would be reopened — `se e quando o alvo for um app nativo embarcado` — and the refusal of the easy argument, that sherpa-ncnn technically does run vits-piper TTS in WASM, so `NCNN cannot do TTS` would have been false. ADR-0022 lines 165-166 already carry the conclusion and 
  - largar B: Everything the runtime decision is made of. The study justifies one clause of it and nothing else.
  - **fazer:** Add NCNN as a fourth entry in ADR-0022's `considered-options`, carrying its cons (small TTS zoo, models would have to be converted and hosted, ARM-binary edge irrelevant where model download dominates) and its revisit condition, then replace the study with the source list — an option that was genuin

## Peso morto — 4

Existe, e responde a um problema que este projeto não tem. Não é um erro de escrita: é trabalho feito para outro projeto que ficou aqui.

| ficheiro | o problema que responde, e que este projeto não tem |
|---|---|
| `docs/3-Sprint-Design/data-model/Migrations.md` | It answers DB schema evolution, and there is no database. The file says so in its own first line ('Not needed now (no DB yet)') and its trigger has not fired: `docs/3-Sprint-Design/data-model/DBML.md` is the corpus DB it waits on, there is no `prisma/` anywhe… |
| `docs/3-Sprint-Design/data-model/Normalization.md` | A normalization policy in a project with no table. Unlike its neighbour Migrations.md it does not declare itself deferred — it opens with '**Default:** normalize to **3NF**' in the present tense, as a rule in force — and its Records table, the place where the… |
| `docs/6-DevOps-SRE/SLO.md` | The problem it would answer requires a service this organisation operates, and there is none: the PWA is static on Cloudflare Pages, which owns its own uptime, and there is no customer holding an SLA — the document's own opening paragraph states all of this.… |
| `docs/7-Async-Systems/README.md` | An entire SDD phase folder whose only file is the README announcing that the folder is empty — verified: `docs/7-Async-Systems/` contains this file and nothing else. The problem it would answer needs a broker, a queue or an event stream between a producer and… |

## Não decide nada — 4

Nem para um problema deste projeto, nem para outro.

| ficheiro | |
|---|---|
| `docs/educational/Pedagogical-Model.md` | It exists to decide which learning theory governs which domain, and for the only domain that exists the decision is made elsewhere and this file says so: 'Deta… |
| `docs/game-design/LM-GM-Map.md` | Every row of the table is explicitly a CANDIDATE insertion point and the Status section says 'Seed only. Fill as each genre is studied.' The eight pairings wer… |
| `docs/research/ESTUDO-FONTES.md` | The file demotes itself in its own section 0: typography.md is CANONICO and 'este ESTUDO-FONTES.md e a PESQUISA-FONTES-CONDICOES-LETRAMENTO.md foram rascunhos… |
| `docs/research/PESQUISA-FONTES-CONDICOES-LETRAMENTO.md` | It disclaims decision in its own section 0: the level is 'pesquisa basica/exploratoria (1a passada)' and the findings are to be treated 'como hipoteses, nao ve… |

## Já coberto — 68

Nada a fazer. A lista existe por uma razão: sem ela, a próxima leitura volta a propor o que já está escrito.

| artefato | ficheiro |
|---|---|
| CSF Target Profile | `docs/1-Discovery/NFR.md` |
| SLO specification | `docs/1-Discovery/NFR.md` |
| acceptance criteria | `docs/educational/Learning-Objectives.md` |
| accepted variance register | `docs/2-Architecture/adr/ADR-0043-a-known-debt-gets-a-budget-that-only-goes-down.yaml` |
| accessibility statement | `docs/research/AUDITORIA-E13-axe.md` |
| alerting and detection strategy (ADS) | `docs/2-Architecture/adr/ADR-0043-a-known-debt-gets-a-budget-that-only-goes-down.yaml` |
| audit trail specification | `docs/2-Architecture/adr/README.md` |
| branching strategy | `docs/4-Sprints/Commits.md` |
| brand identity statement (core identity, extended identity, value proposition) | `docs/game-design/typography.md` |
| break in series | `docs/research/AUDITORIA-E13-axe.md` |
| capacity plan | `docs/2-Architecture/adr/ADR-0022-tts-sherpa-onnx-wasm-runtime.yaml` |
| change control procedure | `CLAUDE.md` |
| classification scheme | `app/js/core/constants.ts` |
| client money segregation policy | `docs/2-Architecture/adr/ADR-0058-five-systems-nine-repositories-and-multi-tenant-from-day-one.yaml` |
| coding standard | `docs/2-Architecture/adr/ADR-0043-a-known-debt-gets-a-budget-that-only-goes-down.yaml` |
| compensating transaction design | `docs/2-Architecture/adr/ADR-0040-mode-is-derived-from-activity-not-stored.yaml` |
| compliance calendar | `docs/2-Architecture/adr/ADR-0053-the-annual-report-is-a-ci-gate-or-it-is-nothing.yaml` |
| component specification | `docs/2-Architecture/adr/ADR-0030-engine-axis-is-a-declared-contract.yaml` |
| coordinate reference system (CRS) definition | `docs/2-Architecture/adr/ADR-0001-integer-real-pixel-canvas-scale.yaml` |
| coverage matrix | `docs/6-DevOps-SRE/CI-QA.md` |
| data exploration report | `docs/research/README.md` |
| dead letter queue (DLQ) runbook | `app/js/platform/interruptible-speech.ts` |
| dependency map | `docs/2-Architecture/adr/ADR-0030-engine-axis-is-a-declared-contract.yaml` |
| drain procedure | `docs/2-Architecture/adr/ADR-0054-a-frame-that-throws-stops-the-loop-and-says-so.yaml` |
| ephemeral environment design | `docs/3-Sprint-Design/Test-Plan.md` |
| executed qualification protocol | `docs/2-Architecture/adr/ADR-0053-the-annual-report-is-a-ci-gate-or-it-is-nothing.yaml` |
| exit plan | `docs/2-Architecture/adr/ADR-0026-move-hosting-to-gitlab.yaml` |
| feature consistency specification | `docs/2-Architecture/adr/ADR-0048-the-journey-is-four-screens-and-the-adult-logs-in-not-the-child.yaml` |
| game design document (GDD) | `docs/2-Architecture/adr/README.md` |
| identity resolution ruleset | `app/js/platform/storage.ts` |
| information security policy | `docs/2-Architecture/adr/ADR-0010-non-negotiable-pillars.yaml` |
| input action map and per-device bindings (the abstract action set, the suggested binding for each supported controller profile, and the hand-tracking equivalent of every action) | `docs/2-Architecture/adr/ADR-0013-motor-input-accessibility.yaml` |
| issue log | `docs/2-Architecture/adr/ADR-0043-a-known-debt-gets-a-budget-that-only-goes-down.yaml` |
| learning objectives | `docs/educational/Learning-Objectives.md` |
| legitimate interest assessment (LIA / balancing test) | `docs/2-Architecture/adr/ADR-0056-the-child-data-never-leaves-in-a-readable-form.yaml` |
| module guide | `docs/2-Architecture/adr/ADR-0030-engine-axis-is-a-declared-contract.yaml` |
| nonconformity report | `docs/2-Architecture/adr/ADR-0043-a-known-debt-gets-a-budget-that-only-goes-down.yaml` |
| operating environment map and zone configuration (site map with keep-out zones, speed-restricted zones, one-way lanes, docking and charging stations, door and lift interfaces) | `docs/game-design/plano-editor-mapa.md` |
| override policy | `docs/2-Architecture/adr/ADR-0048-the-journey-is-four-screens-and-the-adult-logs-in-not-the-child.yaml` |
| patch series cover letter (with per-revision patch changelog) | `CLAUDE.md` |
| performance baseline | `docs/research/tts-kokoro-speed-study.md` |
| platform tuning profile | `docs/research/tts-sherpa-onnx-plan.md` |
| player verb specification | `docs/2-Architecture/adr/ADR-0045-the-run-button-becomes-a-latch-and-its-other-jobs-move-to-the-jump.yaml` |
| preventive maintenance plan (PM plan) | `docs/6-DevOps-SRE/Security-Pipeline.md` |
| privacy notice | `app/index.html` |
| production readiness checklist | `docs/3-Sprint-Design/Test-Plan.md` |
| reconciliation plan | `docs/research/LACUNAS-V3-vs-V4.md` |
| recruiting screener | `docs/research/AUDITORIA-E13-axe.md` |
| reference documentation | `docs/ARCHITECTURE.md` |
| reprocessing procedure | `scripts/check-precache.mjs` |
| runbook | `CLAUDE.md` |
| schedulability analysis | `docs/research/requerimento-v8-alteracoes.md` |
| scope statement | `docs/2-Architecture/adr/ADR-0003-tiered-sdd-documentation-subset.yaml` |
| shared responsibility model | `docs/2-Architecture/CI-CD.md` |
| signature policy | `docs/2-Architecture/adr/ADR-0052-professionals-author-activities-and-someone-answers-for-them.yaml` |
| software schedule | `docs/5-Refactoring/plano-modularizacao-mapa.md` |
| software verification plan | `docs/research/AUDITORIA-E13-axe.md` |
| stability policy (API stability policy) | `docs/1-Discovery/NFR.md` |
| statistical analysis plan (SAP) | `CLAUDE.md` |
| story map | `docs/2-Architecture/adr/ADR-0048-the-journey-is-four-screens-and-the-adult-logs-in-not-the-child.yaml` |
| strangler fig migration plan | `docs/5-Refactoring/plano-modularizacao.md` |
| target trial protocol | `docs/2-Architecture/adr/ADR-0056-the-child-data-never-leaves-in-a-readable-form.yaml` |
| technical strategy | `docs/2-Architecture/adr/ADR-0010-non-negotiable-pillars.yaml` |
| test design specification | `docs/3-Sprint-Design/plano-testes.md` |
| test security plan | `docs/2-Architecture/adr/ADR-0048-the-journey-is-four-screens-and-the-adult-logs-in-not-the-child.yaml` |
| vulnerability disclosure policy (VDP) | `docs/SECURITY.md` |
| wireframe | `docs/2-Architecture/adr/ADR-0044-one-menu-per-screen-exit-first-and-narration-that-can-be-interrupted.yaml` |
| worked example | `docs/2-Architecture/adr/ADR-0049-every-reward-is-deterministic-and-the-only-celebration-is-growth.yaml` |

## Não se aplica — 12

Não são lacunas. Cada linha diz **qual é o referente que falta neste projeto** — e é por isso que estão aqui: sem esta lista, a próxima leitura reporta-as como falhas, e alguém escreve um documento sobre uma coisa que não existe.

| artefato | o referente que falta |
|---|---|
| IANA registration entry (method / status code / field name) | Nothing here crosses an organizational boundary as data. The build emits two HTML pages and a bundle; there is no HTTP API of its own, no header, method or status code it defines, and no wire protocol with a counterparty. The one invented format — the glyph t… |
| account reconciliation procedure | There is no period and there are no two sides to bring into agreement. The project holds no ledger, no money, no transactions, no cut-off date and no counterparty statement to compare against: it stores nothing on a server (ADR-0037) and the only figures it p… |
| authorization matrix | There is no request, no principal and no per-owner record. The repository builds a static client-only PWA: no server, no endpoint, no account, no session, no role. The only persisted data is the device's own `localStorage`, readable by every module on that de… |
| bidirectional (RTL) mirroring specification | The document asked for is the RTL/bidi mirroring specification, and there is no writing direction in this repository that can reverse. The three shipped dictionaries are app/js/i18n/{pt,en,es}.ts, and the roadmap of future locales was checked against exactly… |
| breach notification procedure | There is no personal datum in this repository to breach, so there is nothing whose leak would start a legal clock. This is not an omission — it is a decision, taken explicitly and defended: ADR-0037 retires the progress save and states 'the Inclusionist store… |
| matchmaking design | There is no rule in this repository that assigns an opponent, a rarity or a purchase, so there is nothing whose odds could be undeclared. What is absent, each by an explicit decision rather than by omission: (a) no matchmaking and no queue — multiplayer is fo… |
| metering and rating model | Nothing here is billed, metered or owed. The game is free by constitution (ADR-0010, pillar 10: AGPL code, free of charge, grant-funded), there is no account, no order, no invoice and no service credit; the only counter in the product is the in-game point, an… |
| mutually exclusive experiments | There is no experiment to interfere with, and no variant assignment of any kind. Feature-Flags.md is explicit that there is no service — 'no Unleash/LaunchDarkly - those are for a fleet we don't have' — a flag is a boolean read once at boot with a URL or loca… |
| partner sandbox testing procedure | No test, script or job in this repository writes into anyone else's environment. CI installs npm packages, builds, and runs Playwright/Vitest against a local preview server; the only outbound write is `wrangler pages deploy` into the project's own Cloudflare… |
| rules of engagement (RoE) | No intrusive act against anyone's running system exists in this repository. There is no server, no account, no API and no third-party system it probes: the whole product is a static client bundle. The pentest is not merely unscheduled, it is explicitly held b… |
| safety message | There is no warning in this product for the mechanism to format. It is a static browser game: no equipment, no hazard class, no regulated device, no IFU obligation, and app/index.html carries no caution, notice or advisory of any kind. The one health risk a g… |
| security classification guide (SCG) | There is no datum in this repository carrying a confidentiality level that a derivation could strip. What is absent: any classified or restricted-circulation data at all — no server, no credential store, no accounts (ADR-0005: the child never logs in), no chi… |

## Nota: 4 vinham como falta e tinham documento

O emparelhador por nome não os reconheceu. Ficam registados porque foram a única coisa que a segunda leitura mudou na primeira.

- `docs/game-design/typography.md` — It is the only place that states the licence blockers as an action list and the only place that ranks faces per role; the ADR records decisions and points back here for the evidence. The row match is…
- `docs/research/tts-sherpa-onnx-plan.md` — The claim is checkable and I checked it: `EXPORTED_RUNTIME_METHODS` appears in exactly two files in the whole repository, this one and tts-kokoro-speed-study.md — there is no build script anywhere. T…
- `docs/research/requerimento-v8-alteracoes.md` — Alteration 9 enumerates, before the fact, three ways this feature would cause harm and closes each: the record is NOT an interview (Lei 13.431 organises the hearing precisely to avoid repeated accoun…
- `docs/research/tts-kokoro-speed-study.md` — The success criterion is in the title — `meta: RTF < 1` — and round 1 ranks four avenues with their expected gains BEFORE any of them is measured. Round 2 then measures and reports `RTF ~2.2 (era ~2.…

---

Levantado a partir de um catálogo de 108 problemas de engenharia de software, aplicado a este repositório. Este ficheiro é auto-suficiente: nada aqui precisa do catálogo para ser lido ou executado.
