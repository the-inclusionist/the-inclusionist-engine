<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Estudo — acelerar o Kokoro fp32 no navegador (meta: RTF < 1)

**Motivação:** na avaliação do Dev, **Kokoro fp32 pt-BR (`pf_dora`/`pm_alex`/`pm_santa`) = 4.5/5**, o melhor som — mas
**RTF ~2.5** single-thread (lento). Piper faber-medium é 4/5 e RTF ~0.3 (rápido). Projeto é **a11y-first** → não baixar a
régua de qualidade; fazer o Kokoro **caber** (RTF < 1). Estudo em rodadas.

## Rodada 1 — o mapa das opções (feito)

- **sherpa-onnx-wasm é CPU-only** — o build usa `-DSHERPA_ONNX_ENABLE_GPU=OFF` e a lib estática ORT-wasm (CPU). Logo,
  **via sherpa** os únicos aceleradores são **multi-thread (`numThreads`)** e **SIMD** (já ligado). Sem WebGPU.
- **WebGPU (onnxruntime-web) é o maior ganho** — Kokoro-82M no WebGPU roda **RTF << 1** em qualquer laptop com GPU dos
  últimos ~5 anos ([bench](https://quick-tts.com/blog/kokoro-webgpu-benchmarks.html)). Mas WebGPU **não** está no sherpa;
  seria via `onnxruntime-web` (JSEP) + **fonemização pt-BR nossa** (o ORT só roda o `.onnx`; os tokens de fonema a gente
  prepara — via espeak-ng, que já temos, ou Misaki).
- **Multi-thread (sherpa CPU)** = ganho modesto: `numThreads=4` deve levar RTF 2.5 → ~1 num CPU de 4+ núcleos (a medir).
  Precisa de `crossOriginIsolated` (COOP/COEP) + o build **pthread** (já temos em `sherpa-wasm/tts/`).

## Avenidas, ranqueadas

| # | Abordagem | Ganho esperado | Custo | Hardware-alvo (escola fraca) |
|---|---|---|---|---|
| **1** | **Pré-síntese + cache** do conjunto FINITO de narração (fonemas, letras, sílabas, palavras comuns, strings de UI) — gera 1× (no 1º uso/build), toca do cache | **RTF irrelevante** (playback instantâneo), qualidade 4.5/5 | autoria/cache; só texto novo precisa de síntese ao vivo | ✅ funciona em **qualquer** hardware |
| **2** | **WebGPU** via onnxruntime-web (fora do sherpa) + fonemização espeak nossa | **RTF << 1** (0.1–0.3) | portar o *frontend* do Kokoro (espeak→tokens); WebGPU só em Chrome 113+ com GPU | ⚠️ Chromebook/Positivo velho pode **não** ter WebGPU |
| **3** | **Multi-thread** sherpa CPU (`numThreads=4` + pthread + COOP/COEP) | RTF 2.5 → ~1 (a medir) | já temos o build; medir agora | ⚠️ CPU fraco (2 núcleos) ganha pouco |
| 4 | Modelo **fp16** | marginal no WASM-CPU; ajuda no WebGPU | trocar modelo | — |

## Leitura estratégica (bate com o ADR-0022 — tiered por hardware)

- **Baseline (hardware fraco):** **Piper faber-medium** (RTF ~0.3 na CPU, roda em tudo). Já validado 4/5.
- **Qualidade máxima:** **Kokoro fp32** — via **pré-síntese** (opção 1, funciona em tudo) e/ou **WebGPU** (opção 2, hardware
  bom). A pré-síntese pode tornar o problema de velocidade **irrelevante** para a alfabetização, cujo vocabulário é
  **finito e pequeno** (≈34 fonemas + letras + sílabas + palavras-chave).

## Rodada 2 — multi-thread (sherpa CPU) MEDIDO = morto

`?engine=tts&threads=4` + `crossOriginIsolated=true` → Kokoro fp32 **RTF ~2.2** (era ~2.5 single-thread). **Ganho ~zero.**
O sherpa-wasm-CPU não paraleliza o Kokoro. **Avenida 3 descartada.** (Piper na mesma máquina: RTF ~0.25 — rápido.)

## DECISÃO (Dev)

**Kokoro → `onnxruntime-web` (WebGPU); Piper fica no sherpa.** Prioridade: **fazer o Kokoro rápido primeiro** (meta < 2 s,
ideal < 1 s); a **fonemização pt-BR é passo POSTERIOR** (não gravar fonemas, não pré-síntese — foi cortado). Também pesa
contra o Piper: qualidade **imprevisível** entre modelos + **1 download por voz** (pt/en/es = ~3 GB), inviável.

## Rodada 3 — provar a velocidade no WebGPU (em teste)

`docs/research/kokoro-webgpu-lab.html`: roda o Kokoro-82M via **kokoro-js (onnxruntime-web + WebGPU)** com voz EN só p/
**medir o RTF** (idioma não muda a velocidade; g2p pt-BR vem depois). Se RTF < 1 → caminho provado.

## Próximas rodadas

- **Rodada 2 (medir):** rodar `?engine=tts&threads=4` (sherpa CPU multi-thread) e anotar o RTF real do Kokoro fp32 —
  decide se a opção 3 sozinha chega perto de 1.
- **Rodada 3 (WebGPU):** estudar/prototipar Kokoro via `onnxruntime-web` + WebGPU + fonemização espeak (opção 2) — o maior
  salto; verificar o formato dos tokens que o `model.onnx` espera (inputs `tokens`, `style`, `speed`) e como o sherpa
  monta os fonemas (fonte: `offline-tts-kokoro-*`).
- **Rodada 4 (pré-síntese):** desenhar o pipeline de pré-geração + cache do vocabulário finito (opção 1) — provável
  vencedor para o jogo.

Fontes: [sherpa build (GPU OFF)](https://github.com/k2-fsa/sherpa-onnx/blob/master/build-wasm-simd-tts.sh) ·
[Kokoro WebGPU bench](https://quick-tts.com/blog/kokoro-webgpu-benchmarks.html) ·
[ORT-web WebGPU](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html) ·
[ORT-web numThreads](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html).
