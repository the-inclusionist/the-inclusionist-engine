# Mapa de Currículo (Escopo e Sequência)

A estrutura **macro**: quais habilidades, em que ordem, em qual etapa, alinhadas à **BNCC** — e **quais têm
jogo/atividade** (cobertura). É a resposta a *"toda habilidade da BNCC do 1º ano de Português tem uma atividade?"* —
a análise de cobertura que justifica a camada currículo separada (Jacobs, *Mapping the Big Picture*, 1997).

Escopo total do projeto: **3 anos de infantil + 9 de fundamental + 3 de médio**, várias disciplinas, 35+ jogos.

## Matriz de cobertura (atividades já no jogo — 1º ano; BNCC a confirmar pelo Dev)

Por etapa → disciplina → habilidade BNCC → atividade que a cobre. Detalhe do objetivo em
[Learning-Objectives.md](Learning-Objectives.md).

| Etapa | Disciplina | Habilidade (BNCC?) | Atividade | Cobertura |
|---|---|---|---|---|
| Fund. 1º ano | Língua Portuguesa | consciência do padrão escrito (pré-silábico) | alf1 Descobrindo palavras | ✅ |
| Fund. 1º ano | Língua Portuguesa | segmentação silábica c/ valor sonoro | alf2 Descobrindo sílabas | ✅ |
| Fund. 1º ano | Língua Portuguesa | sílaba↔letras (silábico-alfabético) | alf3 Montando palavras | ✅ |
| Fund. 1º ano | Língua Portuguesa | relação fonema-grafema | alf4 Grafema e fonema | ✅ |
| Fund. 1º ano | Língua Portuguesa (a11y) | reconhecimento da cela Braille | alf5 Malha de Braille | ✅ |
| Fund. 1º ano | Língua Portuguesa | escrita alfabética de palavras | alf6 Escrevendo palavras | ✅ |
| Fund. 1º ano | Matemática | adição e subtração | Soma-Sub | ✅ |
| Fund. 3º ano? | Matemática | multiplicação | Tabuada | ✅ |
| Fund. 3º–4º? | Matemática | divisão exata | Divisão | ✅ |
| Fund. 4º–5º? | Matemática | frações (soma/subtração) | Frações | ✅ |
| … demais anos/habilidades | | | | **lacuna** (prioriza próximo jogo) |

## Mapa de foco (Instituto Reúna) — pré-requisitos e andaime

Além da habilidade BNCC-alvo, cada atividade se **alicerça no mapa de foco do Instituto Reúna**: se a criança **não
tem desenvolvida** a habilidade necessária para jogar aquele jogo, ela **continua no jogo treinando a habilidade
*necessária àquela*** (o pré-requisito), em vez de travar. É a operacionalização da **ZPD** (ver
[Pedagogical-Model.md](Pedagogical-Model.md)): o jogo desce ao pré-requisito e sobe de volta.

- Cada objetivo carrega, além do código BNCC, seu(s) **pré-requisito(s)** segundo o mapa de foco Reúna.
- A busca por atividade também é por **taxonomia de Bloom** e **habilidade cognitiva** (para uso por
  psicopedagogos/neuropsicólogos/fono/T.O.) — ver [ADR-0005](https://github.com/the-inclusionist/the-inclusionist-docs/blob/main/docs/2-Architecture/adr/ADR-0005-no-login-access-teacher-activity-code.yaml).

## Como usar

- Uma linha por habilidade BNCC da etapa; marca **coberta / parcial / lacuna**; anota o **pré-requisito Reúna**.
- Lacuna vira trabalho (issue) — é assim que se prioriza *qual próximo jogo* fazer.
- Cada atividade referencia seus objetivos em [Learning-Objectives.md](Learning-Objectives.md).

## Status

- [ ] Começar pelo 1º ano do fundamental (alfabetização/matemática — o que já existe no jogo) e crescer por etapa.
- Futuro: a BNCC pode ser representada de forma machine-readable via **1EdTech CASE** (adiado — ver ADR-0004).
