<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Por que ONNX e não NCNN para o TTS neural (estudo)

Justifica a escolha do runtime **ONNX** (via sherpa-onnx-wasm) em vez de **NCNN** (via sherpa-ncnn), decidida em
**[ADR-0022](../2-Architecture/adr/ADR-0022-tts-sherpa-onnx-wasm-runtime.yaml)**.

## O que o estudo confirmou

A hipótese era: **NCNN é mais focado em STT/ASR e tem menos variedade em alta fidelidade.** O estudo **confirma** isso.
Um detalhe técnico a registrar (pra não errar em decisões futuras): o **sherpa-ncnn** *tecnicamente* também roda
vits-piper TTS e WASM ([repo](https://github.com/k2-fsa/sherpa-ncnn)) — ou seja, "faz TTS" —, mas o **foco de projeto**
do NCNN é inferência enxuta em ARM/embarcado, e o **ecossistema de TTS** ali é muito menor. Portanto a decisão por ONNX
se apoia em variedade + fidelidade + maturidade WASM (abaixo), exatamente na linha do que você apontou.

## Por que ONNX mesmo assim (os motivos que valem)

| Critério | ONNX (sherpa-onnx) | NCNN (sherpa-ncnn) | Vence |
|---|---|---|---|
| **Ecossistema de vozes** | **7 famílias TTS** (VITS/Piper, Matcha, **Kokoro**, Kitten, ZipVoice, PocketTTS, Supertonic), 80+ idiomas; o csukuangfj publica **~50 vozes vits-piper** + Kokoro multi-lang **já em ONNX** | Zoo de TTS **bem menor**; poucas vozes pré-convertidas p/ NCNN — teríamos que **converter e hospedar** cada uma | **ONNX** |
| **Fidelidade / expressividade** | fp32/fp16, boa fidelidade; sobra compute no navegador | Otimizado p/ **ARM de baixo poder** (Android/iOS/Raspberry Pi), quantização agressiva → foco em tamanho/latência, não em alta fidelidade | **ONNX** |
| **Maturidade em WASM** | **ONNX Runtime Web** (Microsoft) maduro; sherpa-onnx-wasm TTS documentado, com HF Spaces + já **validado no nosso lab** | WASM existe, mas o caminho TTS-em-WASM é **menos provado/documentado** | **ONNX** |
| **Alvo de projeto do runtime** | genérico (servidor, desktop, browser) | brilha em **embarcado/mobile nativo** (binário minúsculo, SIMD ARM, sem deps) — vantagem que **não se traduz** no navegador, onde download do modelo + runtime WASM dominam | **ONNX** (p/ browser) |

## Conclusão

Nosso alvo é **navegador do cliente (WASM)**, e a métrica que importa é **variedade + fidelidade das vozes**
disponíveis **prontas**. As vozes que queremos (todas as vits-piper pt/en/es do Kuang + Kokoro multi-lang) existem **em
ONNX**; em NCNN seria trabalho de conversão/hospedagem para ganhar, no browser, uma vantagem (binário ARM enxuto) que
não é o nosso gargalo. A vantagem real do NCNN — rodar em hardware muito fraco (ARM/RPi) — pode ser reavaliada **se e
quando** o alvo for um app nativo embarcado; para o PWA no navegador, **ONNX vence**.

Fontes: [sherpa-ncnn (repo)](https://github.com/k2-fsa/sherpa-ncnn) · [sherpa-onnx TTS (DeepWiki)](https://deepwiki.com/k2-fsa/sherpa-onnx/3.2-text-to-speech-(tts)) · [catálogo de vozes](https://k2-fsa.github.io/sherpa/onnx/tts/all/).
