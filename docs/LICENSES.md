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
funções pertence ao empregador (Lei nº 9.609/1998, art. 4º), e é por isso que a publicação sob AGPL é
objeto de **pedido** no requerimento — ato do Poder Executivo — e não decisão de quem escreveu o código.

⚠️ **E é AQUI que essa titularidade fica dita, não no nome do pacote.** O escopo era `@pm-monte` para
carregar esse fato (ADR-0036); passou a ser **`@the-inclusionist`** (**ADR-0071**), porque nome é lido por
quem não vai abrir o repositório, e um escopo com o nome da Prefeitura publicado por servidor **antes do
ato** é reivindicação pública de nome alheio. A regra é a mesma do **ADR-0066 §2**: a posse se declara
DENTRO — neste ficheiro, na `LICENSE` e nos registros —, onde lê quem pretende usar.

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

## 4 · Inventário da arte — por enquanto, só a do PixelLab

O ADR-0066 §3 põe este inventário entre as condições para qualquer repositório virar público, e o §2 desta
página dizia que ele ainda não existia. Existe agora, **com o alcance que o Dev deu: apenas a arte gerada
no PixelLab.**

### O que foi gerado, e onde está registrado

**100 gerações**, de 2026-06-01 em diante, com data, ferramenta, custo estimado e **o prompt de cada uma**:
[`research/auditoria-creditos-pixellab.csv`](research/auditoria-creditos-pixellab.csv). O prompt está lá de
propósito — é o que permite a alguém de fora refazer a pergunta *"de onde veio esta imagem?"* sem depender da
memória de ninguém.

### O regime, e a restrição que viaja junto

Conforme a pesquisa de licenças (`research/LICENCAS-GERACAO-IMAGEM.md`), o PixelLab.ai é o gerador com os
termos mais limpos do levantamento: **a titularidade da imagem é de quem gerou**, o uso comercial é
permitido — *"usar, modificar e distribuir … para qualquer fim"* —, e **não há exigência de atribuição**.

⚠️ **E há UMA restrição, que não é nossa e por isso não podemos dispensá-la: as imagens não podem ser usadas
para TREINAR MODELO.** Isso importa aqui por dois motivos concretos:

1. A arte deste projeto **não é FOSS** (§2), então a licença de arte própria é nossa para escrever — e ela
   tem de **carregar esta restrição adiante**, ou concederíamos a terceiros mais do que recebemos.
2. O alvo declarado é **arte procedural semântica** (`plano-arte-procedural.md`): imagem semântica + paletas.
   Se algum dia essa geração passar por um modelo treinado nos próprios assets, esta linha é a que diz que
   não pode.

### O que este inventário NÃO cobre, e por quê

**ARTE PRÓPRIA NÃO EXISTE.** Não é que esteja fora do inventário — não há nenhuma para inventariar, e é por
isso que esta seção cobre só o PixelLab.

O Dev passa a produzi-la **depois de o Município aceitar o arranjo inteiro**: o código sob **AGPL-3.0** e a
arte sob **licença CC adequada**. Enquanto essa aceitação não estiver documentada, não há arte própria e
não há o que licenciar.

⚠️ **E arte não vai para AGPL — vai para CC.** A AGPL é licença de PROGRAMA (Lei 9.609); arte é obra da Lei
9.610 e o instrumento usual dela é o Creative Commons. Está escrito aqui porque a versão anterior deste
parágrafo levantava, como se fosse dúvida em aberto, a hipótese de a arte própria virar AGPL. Não era
dúvida: era erro, sobre uma coisa que ainda não existe.

**Qual CC** é escolha para quando houver arte a licenciar, e não antes. O §2 desta página fica de pé como
está: ele descreve o regime da arte que EXISTE hoje.

---

## O que este ficheiro NÃO faz

- **Não é parecer jurídico.** É a declaração de escopo que um leitor precisa para não assumir que a AGPL da
  raiz alcança tudo. Onde há dúvida de propriedade intelectual, a fonte é a Procuradoria — que o requerimento
  aciona no pedido `c`.
- **Não substitui o `CREDITS.md`**, que é onde mora a atribuição. Fato duplicado apodrece.
- **Não lista a arte própria peça a peça** — e agora isso é ALCANCE e não omissão: o §4 inventaria a
  arte do PixelLab e diz, na mesma seção, por que a arte própria ainda não entrou.
