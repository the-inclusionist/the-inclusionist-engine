# Créditos e atribuições de terceiros

O código de **The Inclusionist** é AGPL-3.0-or-later. Partes de terceiros abaixo mantêm suas próprias licenças.

## Clarity — Adam Brooks (dissimulate) — MIT

As **mecânicas de plataforma** partiram do projeto **Clarity**, de Adam Brooks (dissimulate), sob licença
**MIT**. O **mapa** (`app/assets/levels/clarity.map.txt`, batizado em homenagem) foi **fortemente adaptado** do
nível do Clarity — com modificações cirúrgicas de layout e mudança de significado de vários tiles — não é uma
cópia, mas uma obra derivada. A atribuição abaixo cobre a porção de origem.

- Código: https://github.com/dissimulate/Clarity
- Jogável: https://codepen.io/dissimulate/pen/AGYEby

Texto da licença MIT (aplicável às porções derivadas do Clarity):

```
MIT License

Copyright (c) Adam Brooks (dissimulate)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> Nota: confirmar o ano/linha exata de copyright no `LICENSE` do repositório do Clarity e alinhar aqui antes de
> qualquer distribuição formal. MIT é compatível com AGPL-3.0 (as porções MIT mantêm seu aviso; o todo é AGPL-3.0).

## Voz neural (TTS) — Next-gen Kaldi, Piper, eSpeak NG

A narração por voz roda **inteiramente no navegador/offline** graças ao trabalho excepcional de:

- **[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)** (projeto **Next-gen Kaldi / k2-fsa**, **Apache-2.0**) — o motor
  de inferência TTS em WebAssembly. Um agradecimento especial a **Fangjun Kuang** ([@csukuangfj](https://github.com/csukuangfj)),
  engenheiro-líder do Next-gen Kaldi (sherpa-onnx, k2, icefall, kaldi-native-fbank; coautor de trabalhos como
  [ZipVoice](https://github.com/k2-fsa/ZipVoice)), que **empacotou as vozes Piper no formato ONNX/sherpa** (repositórios
  `vits-piper-*`) — inclusive **portando a `dii` de pt-PT para pt-BR** — tornando este uso possível. Obrigado.
- **[Piper](https://github.com/rhasspy/piper)** (Michael Hansen / rhasspy, **MIT**) — o sistema TTS VITS por trás das vozes.
- **[eSpeak NG](https://github.com/espeak-ng/espeak-ng)** (**GPL-3.0**) — a fonemização (`espeak-ng-data`) usada pelas vozes.
- **Vozes pt-BR** (`faber`, `jeff`, `miro`, `cadu`) e pt-PT (`dii`) — treinadas pela comunidade Piper a partir de datasets
  de locutores; a licença de cada voz está no `MODEL_CARD` do respectivo pacote e deve ser confirmada por voz antes de
  distribuição formal.
  **O que o jogo de fato embarca hoje é uma voz:** `pt_BR-faber-medium`. As demais permanecem no repositório como
  material de laboratório (`docs/research/sherpa-wasm/`) e continuam creditadas por isso — crédito acompanha o que
  está no repositório, e não apenas o que é distribuído no pacote. O roster de entrega decidido é `en_US`, `pt_BR` e
  `es_MX` (ADR-0065, que supersede o ADR-0022).
- **Licença das vozes do catálogo, lida no `MODEL_CARD` de cada uma em 2026-09-14** (`huggingface.co/diffusionstudio/piper-voices`):

  | voz | dataset | licença do dataset |
  |---|---|---|
  | `pt_BR-faber-medium` | NabuCasa/voice-datasets | **CC0** |
  | `es_MX-claude-high` | HirCoir/Piper-TTS-Spanish | **Apache-2.0** |
  | `en_US-amy-medium` | MycroftAI/mimic3-voices («See URL») | **CC BY-SA 4.0** — a licença do repositório indicado; a voz `amy` não aparece na lista dele, então a procedência não está confirmada |
  | `en_US-ryan-medium` | roholazandie/ryanspeech (Kaggle) | ⚠️ **CC BY-NC-SA 4.0 — uso NÃO comercial** |

  ✅ **Ryan é não comercial, e o projeto também**: o Dev, 2026-09-14 — «nosso projeto não tem fins lucrativos». Amy pede
  atribuição e compartilhamento pela mesma licença.

  🔴 **Faber, Amy e Ryan partem da voz `lessac`** (cada `MODEL_CARD`, lido em 2026-09-14 em `huggingface.co/rhasspy/piper-voices`:
  «Finetuned from U.S. English lessac voice»). A `lessac` foi treinada no conjunto **Blizzard 2013** (CSTR, Universidade de
  Edimburgo), cuja licença limita o uso a pesquisa, proíbe distribuir o material e exclui o desenvolvimento de produtos ou serviços
  de síntese de voz. Se uma voz ajustada a partir dela fica presa a essa licença não está resolvido aqui; por isso as três **não são
  espelhadas** até decisão do Dev (errata do ADR-0203, issue #192). A `es_MX-claude-high` diz «See URL» sobre o treino: a origem
  não foi verificada.

## Kokoro-82M — hexgrad — Apache-2.0

Os pesos são **Apache-2.0** (`huggingface.co/hexgrad/Kokoro-82M`), treinados só com áudio permissivo — entre ele, áudio **CC BY**:
**Koniwa** (CC BY 3.0) e **SIWIS** (CC BY 4.0), creditados aqui. A exportação ONNX usada é a `onnx-community/Kokoro-82M-v1.0-ONNX`.

> Os pesos das vozes são **baixados uma vez** (de um host público) e rodam **100% localmente** depois — nenhum áudio de
> criança sai do dispositivo. Ver `the-inclusionist-docs · docs/2-Architecture/adr/ADR-0065-three-neural-voices-owned-by-the-engine-and-cached-on-first-use.yaml`.

## Arte importada — CC0, CC BY 3.0, CC BY 4.0 ou OGA-BY

A atribuição da arte que vem de fora é **por recurso**, e por isso não cabe nesta página em prosa: a autoria de um
acervo lê-se recurso a recurso, e a cadeia de derivações com ela.

**Ela mora em [`../art/ATTRIBUTION.csv`](../art/ATTRIBUTION.csv)** — caminho, autor, **URL da fonte**, licença e de
que recursos cada um derivou. É a mesma forma que o `LICENSES.md` §4 já usa para as 100 gerações do PixelLab: um
ficheiro tabular ao lado do apontador em prosa, porque um livro-razão que cresce com o catálogo não se mantém à mão.

⚠️ **Atribuição aqui é condição de uso, não linha de crédito.** Três das quatro licenças exigem-na, e um recurso
sem autor conhecido **não entra** — «não consegui descobrir» não é licença. O gate
`tests/arte-licencas-aceites.node.test.js` reprova a entrada vazia, a entrada órfã, o recurso sem entrada, a fonte
sem URL e **qualquer licença fora das quatro** — com ND, NC e share-alike recusados por nome e com o motivo de
cada um, que o [`LICENSES.md`](LICENSES.md) §3 e o **ADR-0133** explicam.

📌 **Não há quarentena, e já houve.** Até 2026-09-09 o Liberated Pixel Cup ia entrar sob CC BY-SA 3.0 atrás de uma
parede (ADR-0107). O Dev recusou o share-alike e a parede saiu com ele: sem arte cujo copyleft viaje, não há o que
segregar.

**Hoje o livro está vazio** — nenhum recurso entrou nunca.
