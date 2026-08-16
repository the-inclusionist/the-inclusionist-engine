<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Plano — modularizar o TTS-Lab em produto (TS · Vite · DI · pacotes versionados)

> ✅ **CONCLUÍDO (2026-08-02).** As Rodadas 0–6 estão feitas: `inclusionist-commons` tem os 4 pacotes
> `@jrocha-io/*` (tts/audio/logging/model-fetch, 52 testes) com os 4 adapters (Web Speech, eSpeak-NG, sherpa,
> Kokoro-WebGPU); `inclusionist-lab` tem as 3 seções por DI e o monólito foi aposentado. **Pendências só do Dev:**
> publicar os pacotes no GitLab Package Registry (precisa do token), colocar os ~18MB de assets sherpa em
> `public/sherpa-wasm/` (receita em `inclusionist-lab/docs/sherpa-wasm-build.md`), e o deploy Cloudflare.
> A verificação de **áudio neural real** (sherpa/Kokoro) roda na máquina do Dev (assets + download de modelos).

> Decisões que este plano executa: **ADR-0023** (labs = apps de primeira classe) + **ADR-0024** (pacotes versionados;
> sem CDN; COOP/COEP escopado) + **ADR-0025** (o lab vive no repo **hub `inclusionist-lab`**, multi-página, o TTS é a
> subpágina `/tts/`; `the-inclusionist` fica só com o jogo — substitui o "tts-lab repo próprio/submódulo" do 0024).
>
> **Onde o código mora agora:** `inclusionist-lab/src/tts/` (não mais `tts-lab`). As rodadas abaixo que citam "tts-lab"
> valem para essa subpágina. Rodadas 0–3 **concluídas e verificadas** (Seção 1 = eSpeak + Web Speech por DI).
> Método: **rodadas pequenas, cada uma com teste e prova**, o monólito atual (`docs/research/sherpa-lab.html`)
> **fica funcionando até a última rodada**. Nada é "pronto" até o teste do José passar em cada estágio.

## Quem roda o quê

- **IA (eu):** desenho, scaffolding de arquivos (código TS, `package.json`, `tsconfig`, `vite.config`, `_headers`,
  testes), edição, e a pré-validação no preview quando aplicável. **Não tenho Node/registry/CF no sandbox.**
- **José:** cria os repositórios, faz `git submodule`, `npm install`/`build`/`vitest`, **publica** os pacotes
  (`@jrocha-io/*`), configura o **domínio `labs.`** no Cloudflare, e faz push/deploy. Pegadinhas: Avast →
  `NODE_OPTIONS=--use-system-ca` + `UV_NATIVE_TLS=1`; Cloudflare **nunca** por OAuth do wrangler (usar
  `CLOUDFLARE_API_TOKEN`/dashboard).

## Arquitetura alvo

**Ports & adapters + injeção de dependência por construtor** (sem framework de DI; a *composition root* é o `main.ts`
de cada app, que instancia os adapters concretos e injeta nos controllers/engines).

```
@jrocha-io/tts          Port TtsEngine + tipos (SynthRequest, Voice, SynthMetrics) + adapters:
                        WebSpeechEngine · MeSpeakEngine (eSpeak-NG WASM) · SherpaEngine (embrulha o
                        sherpa-onnx-wasm: fetch→FS.writeFile→OfflineTts, + multi-thread) · KokoroWebGpuEngine
                        (onnxruntime-web/kokoro-js) + um registry/factory. → consumido pelo LAB e (depois) pelo tts.ts do jogo.
@jrocha-io/audio        Port AudioPlayer + WebAudioPlayer (o AudioContext persistente + normalização com teto).
@jrocha-io/logging      Port Logger + DomLogger/ConsoleLogger.
@jrocha-io/model-fetch  DAO ModelFetcher (fetch HF/R2 + Cache API + progresso).
tts-lab (repo próprio)  UI (view-controllers finos sobre um componente TaskTable compartilhado) → fala com os
                        engines SÓ pelo port. main.ts = composition root. Deploy → labs.<domínio>.
```

Regra de ouro do design: **a UI e os controllers dependem do PORT, nunca de um engine concreto** — é o que torna a
seção testável com um `FakeTtsEngine` e o que permite o engine vencedor **graduar** para o `tts.ts` do jogo por
dependência (semver), não por reescrita.

## Estratégia de teste (Vitest)

- **node** (lógica pura, sem DOM/WASM): catálogos de voz (MODELS/KOKORO/optgroups), cálculo de **RTF**, **ganho**
  (peak→gain com teto), parse do repo no cache (`csukuangfj/([^/]+)`), mapeamento URL→engine/threads, tabela de
  amostras. Padrões **ZOMBIES** + **Right-BICEP**.
- **browser** (Playwright): `WebAudioPlayer` gera buffer; `DomLogger` anexa; `TaskTable` renderiza linhas; wiring da
  seção com `FakeTtsEngine` (contrato do port). **A síntese neural real NÃO entra no CI** (pesada/não-determinística).

## Estágios (cada um: entregável → prova → quem roda)

| # | Entregável | Prova | Roda |
|---|---|---|---|
| **0** | Stand-up dos repos: `inclusionist-commons` (workspace de pacotes) + `tts-lab` (Vite+TS scaffold, app vazio que monta `main.ts`); registry npm do GitLab com o escopo `@jrocha-io` configurado (era GitHub Packages à época — ADR-0026); `tts-lab` como submódulo em `labs/tts-lab/` | `npm run build` do `tts-lab` emite página; `npm publish --dry-run` de um pacote-stub OK | José (git/registry/CF) com meus arquivos |
| **1** | `@jrocha-io/tts` **domínio puro**: tipos + catálogos (MODELS/KOKORO/KVOICES) + RTF/ganho/parse, **tipados** + testes **node** | `vitest run` (node) verde | IA escreve · José roda |
| **2** | `@jrocha-io/audio`, `@jrocha-io/logging`, `@jrocha-io/model-fetch` (ports + impls) + testes **browser** | `vitest run` (browser) verde | IA · José |
| **3** | Port `TtsEngine` + **WebSpeechEngine** + **MeSpeakEngine** (eSpeak sem CDN — npm/vendored); **Seção 1** do lab ligada por DI | José: seção 1 fala pt/en/es nos 2 motores | IA · José |
| **4** | **SherpaEngine** (embrulha o wasm + FS loader + toggle multi-thread) → **Seção 2**; assets `sherpa-wasm`/`espeak-ng-data` migram p/ o repo do lab; COOP/COEP via `_headers` **só** no `labs.` | José: Piper médio/high + Kokoro fp32 falam; lista de baixados; multi-thread liga | IA · José |
| **5** | **KokoroWebGpuEngine** (kokoro-js **npm**, sem CDN) → **Seção 3**, fp32/fp16/q8 + device webgpu/wasm | José: mede RTF; **resolve o zumbido** comparando fp32/webgpu × fp16 × fp32/wasm | IA · José |
| **6** | Aposentar `docs/research/sherpa-lab.html` (deixar ponteiro/redirect p/ `labs.`); `docs/research/*.md` (estudos) **ficam**; publicar versões `^1` dos pacotes; atualizar ARCHITECTURE | José: `labs.` no ar; game deploy inalterado (sem COOP/COEP, sem código do lab) | IA · José |

## Pegadinhas / riscos (research-first)

- **eSpeak-NG WASM sem CDN:** não há um pacote npm "oficial" limpo garantido; se `mespeak`/`espeak-ng` não bundlar
  bem no Vite, **vendorizar** o WASM+data dentro de `@jrocha-io/tts`. (A definir na Rodada 3, com tabela de opções.)
- **Zumbido do WebGPU** (herdado): não "consertar" às cegas — a Seção 3 dá os eixos fp32/fp16/q8 × webgpu/wasm p/
  **provar** a causa (hipótese: numérico do WebGPU-fp32 no AMD do José). Registrar o resultado no estudo.
- **COOP/COEP:** exige-se p/ o multi-thread do sherpa (SharedArrayBuffer). Fica **só** no `labs.`; o jogo não recebe.
- **Submódulo:** atualizar o lab = bumpar o SHA do submódulo no superprojeto (José roda).
- **Versão/publish:** Changesets (preferido p/ multi-pacote) ou release-it por pacote; bump a cada mudança de commons.

## Saída esperada final (confirmation)

`@jrocha-io/tts`(+audio/logging/model-fetch) publicados e instaláveis; `tts-lab` builda contra eles e deploya em
`labs.<domínio>`; as 3 seções se comportam como o monólito aposentado; e `@jrocha-io/tts` depois vira dependência do
`tts.ts` do jogo. Cada estágio vira **issue** no *The Inclusionist Roadmap* (labels: `research`/`engine` + tipo).
