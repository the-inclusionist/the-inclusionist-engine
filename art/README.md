# `art/` — a arte importada, e o livro-razão que diz de onde veio

Esta pasta guarda arte de fora. Não é uma quarentena, e já foi: até 2026-09-09 chamava-se `art/lcp/` e
existia para segurar uma parede à volta de material CC BY-SA. A parede saiu quando o **ADR-0133** trocou a
pergunta — deixou de ser *«a que família a licença pertence»* e passou a ser **«o projeto pode usar isto»**.

## As quatro perguntas

1. **Podemos DERIVAR?** O pipeline é uma máquina de obra derivada, e recolorir já é derivar.
2. **Pode ser usada COMERCIALMENTE?** Não porque o projeto venda: porque a arte **nunca pode ser mais
   estreita que o código**. A AGPL convida uso comercial, e um sprite não pode travar quem ela convida.
3. **Podemos CONVEIAR o ficheiro no que publicamos?** 🎯 Esta não aprova nem recusa — **ROTEIA**. Quem pode
   ser conveiado viaja connosco; quem não pode é obtido por quem instala, da origem. Ver «A entrega», abaixo.
4. **Alguma coisa VIAJA da fonte para a nossa saída?** Se não viaja, custa uma linha no livro. Se viaja
   copyleft, é a terceira porta.

## As três portas

| porta | o que é | o que a linha do livro carrega |
|---|---|---|
| `licenca` | uma licença pública que já foi medida e passou | o identificador (`CC0-1.0`, `CC-BY-4.0`, `OGA-BY-3.0`, `MIT`…) |
| `concessao` | o autor escreveu a permissão, sem nome de licença conhecido | a **URL** onde a concessão está escrita |
| `ponte` | copyleft CC BY-SA, convertido em `GPL-3.0-only` na nossa saída | licença de origem, `licenca-de-saida` e de que derivou |

📌 **Um nome novo não é recusado, é REFERIDO.** Se a licença ainda não foi medida, a linha reprova com a
mensagem a dizer o que fazer: responder as quatro perguntas num registo e acrescentar o nome. É a diferença
entre uma lista e um estrangulamento.

🔴 **E o que não tem porta nenhuma: ND e NC.** O ND proíbe derivar, e o pipeline não conseguiria nem trocar
a paleta. O NC deixaria a arte mais estreita que o código, e a fronteira dele é genuinamente indefinida —
uma implantação municipal fica em cima dela.

## As fontes admitidas (decisão do Dev, 2026-09-09)

Estas quatro entram **antes de qualquer arte do próprio projeto**:

| fonte | porta | o que a licença exige de nós |
|---|---|---|
| **Kenney** · `kenney.nl/assets` | `licenca` · CC0-1.0 | nada. A linha do livro é por proveniência |
| **ansimuz** · `ansimuz.itch.io` | `licenca` · CC0-1.0 | nada — mas **por pacote**: o perfil não concede |
| **Tiny Swords** · `TS_old version_CC0 Licensed` | `licenca` · CC0-1.0 | nada; a linha cita o `LICENSE` de dentro do zip |
| **Tiny Swords** · Free Pack atual | `concessao` · entrega `pessoa` | os termos do autor, a URL na linha, e o ficheiro **não entra** |
| **Liberated Pixel Cup** | `ponte` · CC-BY-SA-3.0 → `GPL-3.0-only` | atribuição, aviso GPL, **fonte modificável**, e só adaptação |

## O livro-razão

`ATTRIBUTION.csv` — uma linha por recurso, e o gate `tests/arte-licencas-aceites.node.test.js` reprova um
ficheiro sem linha e uma linha sem ficheiro.

| coluna | o que carrega |
|---|---|
| `caminho` | a partir da raiz do repositório; tem de começar por `art/` |
| `autor` | quem fez. Vazio **reprova** — «não consegui descobrir» não é licença |
| `fonte` | a **URL** da página de origem. Vazia ou sem URL **reprova** |
| `porta` | `licenca` · `concessao` · `ponte` |
| `licenca` | o identificador, ou a URL da concessão, ou a licença de origem da ponte |
| `licenca-de-saida` | só na ponte, e tem de ser exactamente `GPL-3.0-only` |
| `entrega` | `repositorio` (viaja connosco) ou `pessoa` (quem instala obtém, da origem) |
| `derivado-de` | de que recursos este derivou, separados por `;`. Obrigatório na ponte |

## 🎯 A entrega — a pergunta 3 não aprova, ROTEIA

«Podemos conveiar isto?» não é critério de admissão: decide **por onde o ficheiro chega**.

- **`repositorio`** — podemos redistribuir, então a arte viaja connosco e o gate exige que o ficheiro exista.
- **`pessoa`** — não podemos redistribuir. A linha existe no livro, mas o **ficheiro NÃO entra nesta árvore
  nem no pacote**; quem instala obtém-no da origem. O gate afirma a **ausência**: se o ficheiro aparecer cá,
  reprova.

⚠️ **E a distinção não é subtil num pacote de assets.** Uma concessão que permite usar a arte **num jogo**
não permite **equipar uma engine com o pacote inteiro** e entregá-lo a trezentos jogos — isso é reempacotar,
que é o que a frase do autor recusa. Pedir-lhe autorização seria pedir licença exactamente para aquilo.

📌 **O precedente é o ADR-0108**, e é idêntico: a fonte Ronde não pode ser empacotada, então oferece-se o
download e a opção fica desabilitada enquanto o ficheiro não estiver presente.

🔴 **E a versão automática disto não existe, medido em 2026-09-09:** nem `itch.io` nem `kenney.nl` mandam
cabeçalho CORS, e o itch não tem link directo estável (`/download` responde 404 sem sessão). O buscador de
pesados funciona com o Hugging Face e o jsDelivr porque **eles** mandam o cabeçalho. A engine não consegue
buscar de lá — só uma pessoa consegue. ⚠️ Isso não afecta o Kenney, que é CC0: como podemos redistribuir,
servimo-lo nós, e o CORS deixa de importar. **O obstáculo só morde onde a licença já nos proibia de servir.**

⚠️ **A coluna `fonte` é uma URL por uma razão que foi medida.** Uma declaração a jusante é indício e não
autoridade: o `ElizaWy/LPC` declara tudo CC BY 3.0 ou OGA-BY 3.0, e uma das páginas que os créditos dele
citam concede só CC-BY-SA 3.0 e GPL 3.0. A conferência contra a origem precisa de rede e está na
[#140](https://github.com/the-inclusionist/the-inclusionist-engine/issues/140).

**Hoje o livro está vazio.** Nenhum recurso entrou ainda.
