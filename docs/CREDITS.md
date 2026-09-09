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

> Os pesos das vozes são **baixados uma vez** (de um host público) e rodam **100% localmente** depois — nenhum áudio de
> criança sai do dispositivo. Ver `the-inclusionist-docs · docs/2-Architecture/adr/ADR-0065-three-neural-voices-owned-by-the-engine-and-cached-on-first-use.yaml`.

## Arte — Liberated Pixel Cup — CC BY-SA 3.0

A atribuição do [Liberated Pixel Cup](https://github.com/OpenGameArt/LiberatedPixelCup) é **por recurso**, e por
isso não cabe nesta página em prosa: o repositório do LCP guarda ficheiros de autoria separados para originais e
derivados, e a cadeia lê-se recurso a recurso.

**Ela mora em [`../art/lcp/ATTRIBUTION.csv`](../art/lcp/ATTRIBUTION.csv)** — caminho, autor, fonte, licença e de que
recursos cada um derivou. É a mesma forma que o `LICENSES.md` §4 já usa para as 100 gerações do PixelLab: um
ficheiro tabular ao lado do apontador em prosa, porque um livro-razão que cresce com o catálogo não se mantém à mão.

⚠️ **Atribuição aqui é condição de uso, não linha de crédito.** Os dois braços da licença exigem-na, e um recurso
sem autor conhecido **não entra** — «não consegui descobrir» não é licença. O gate
`tests/lcp-quarantine.node.test.js` reprova a entrada vazia, a entrada órfã e o recurso sem entrada, e a árvore
está em **quarentena** por uma razão que o [`LICENSES.md`](LICENSES.md) §3 e o **ADR-0107** explicam: misturar o LCP
com a arte própria licenciaria em share-alike a obra de alguém que não está neste repositório para discordar.

**Hoje o livro está vazio** — o LCP foi decidido em 2026-09-08 e ainda não entrou.
