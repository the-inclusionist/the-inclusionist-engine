# O que governa o quê

Este projeto tem **duas licenças e um terceiro regime**, e confundi-los seria afirmar direito que não se
tem. Este ficheiro diz apenas **qual regra alcança qual coisa**. As atribuições estão em
[`CREDITS.md`](CREDITS.md); as razões, nos registros citados em cada linha.

| o quê | regime | onde se decide |
|---|---|---|
| **Código** | **AGPL-3.0-or-later** | ADR-0064 · texto integral em [`../LICENSE`](../LICENSE) |
| **Arte própria** | **NÃO é FOSS** — direito autoral do autor, uso restrito | ADR-0010 pilar 10 · `research/LICENCAS-GERACAO-IMAGEM.md` |
| **Conteúdo de terceiros** | a licença que o autor escolheu, preservada | requerimento, pedido `g` |

---

## 1 · O código é AGPL-3.0-or-later

Todo programa deste repositório. O `-or-later` é deliberado.

**Por que AGPL e não GPL:** a GPL obriga quem **conveia**, e rodar serviço não é conveiar — a seção 0 da
própria GPL separa `propagate` de `convey`. Um fornecedor que pegasse este código, melhorasse e hospedasse
a sala de aula como serviço **não deveria a fonte a ninguém**. A seção 13 da AGPL fecha exatamente isso, e é
o argumento que o requerimento faz ao Município na alínea `e`. Ver **ADR-0064**.

⚠️ **Titularidade patrimonial: o MUNICÍPIO, não o desenvolvedor.** Software produzido no exercício das
funções pertence ao empregador (Lei nº 9.609/1998, art. 4º). É por isso que o escopo do pacote é
`@pm-monte` e não o do autor (**ADR-0036**), e é por isso que a publicação sob AGPL é objeto de **pedido** no
requerimento — ato do Poder Executivo — e não decisão de quem escreveu o código.

## 2 · A arte NÃO é AGPL, e isso é decisão, não omissão

Programa é o que a **Lei nº 9.609/1998** define. **Arte segue a Lei nº 9.610/1998** e pertence a quem a fez.
Estender a AGPL à arte daria mais do que a lei pede **e** disporia de direito alheio.

⚠️ **E há uma razão de produto, não só jurídica:** o requisito é que os personagens **não** sejam de uso
livre — não aparecerem em produto adulto, por exemplo. Isso é **incompatível com FOSS por construção**:
licença livre não pode restringir campo de uso (liberdade 0; critério 6 da OSI, "sem discriminação de área
de atuação"). Não existe arte simultaneamente livre e de uso restrito. A escolha foi feita com o
trade-off escrito: **código FOSS + arte não-FOSS**.

**A proteção é uma pilha de três, do mais forte ao mais fraco** (`research/LICENCAS-GERACAO-IMAGEM.md`):

1. **Marca registrada** dos personagens — nome e design-assinatura. É o esteio, porque barra uso que cause
   confusão ou diluição **independentemente de copyright**. Seletiva: nem todo personagem é registrado.
2. **Licença de arte própria**, não-FOSS, sobre os dados de arte e os algoritmos de composição.
3. **Autoria humana no algoritmo procedural** — quanto mais o humano cria, seleciona e modifica (em vez de
   apenas pedir a um gerador), mais forte o copyright, e mais exequível a licença (2).

⚠️ **E a ressalva que ordena a pilha:** arte derivada de IA **pode ser incopyrightável** — o US Copyright
Office já o disse —, o que pode tornar a licença (2) **inexequível sozinha**. Por isso a marca é
indispensável, e não um reforço opcional. Escrito aqui porque é o ponto em que a proteção falha em
silêncio se ninguém souber.

## 3 · Conteúdo de terceiros mantém a licença de quem o fez

Nem tudo aqui é nosso, e o que não é **não muda de licença por estar neste repositório**. É o que o pedido
`g` do requerimento pede que conste dos autos: a relação nominal desses elementos e de suas licenças.

- **Código de terceiros** — Clarity (MIT), sherpa-onnx (Apache-2.0), Piper (MIT), eSpeak NG (GPL-3.0).
  Detalhe e atribuição em [`CREDITS.md`](CREDITS.md).
- **Vozes** — licença por voz, no `MODEL_CARD` de cada pacote. **A confirmar por voz antes de distribuição
  formal** — está assim no `CREDITS.md` e continua verdade.
- **Pictogramas** — a camada é decidida pela **LICENÇA e por mais nada** (**ADR-0028**): Mulberry,
  Blissymbolics e Tawasol sob CC BY-SA são embutíveis; ARASAAC é **baixado, nunca redistribuído**; Sclera,
  PCS, SymbolStix e Widgit aparecem no menu como **indisponíveis, aguardando negociação**.
  ⚠️ E o **SA** alcança o que nós alterarmos: um pictograma reajustado à paleta de alto contraste
  (ADR-0011) ou à grade de pixels continua CC BY-SA.
- **Tipografias** — roster e restrições no **ADR-0012**. ⚠️ Ronde e as alternativas OPTIFrench-Script e
  Merveille são **gratuitas só para uso pessoal e NÃO podem ser empacotadas**: oferece-se download, e a
  opção fica desabilitada quando nenhuma está presente.

---

## O que este ficheiro NÃO faz

- **Não é parecer jurídico.** É a declaração de escopo que um leitor precisa para não assumir que a AGPL da
  raiz alcança tudo. Onde há dúvida de propriedade intelectual, a fonte é a Procuradoria — que o requerimento
  aciona no pedido `c`.
- **Não substitui o `CREDITS.md`**, que é onde mora a atribuição. Fato duplicado apodrece.
- **Não lista a arte peça a peça.** A auditoria do que foi gerado e com que prompts está em
  `research/auditoria-creditos-pixellab.csv`; esta página diz o regime, não o inventário.
