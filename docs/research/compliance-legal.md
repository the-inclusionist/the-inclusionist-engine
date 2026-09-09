# Compliance jurídico — análise (research)

> ⚠️ **Resumos de engenharia, NÃO aconselhamento jurídico.** As sínteses de leis (LGPD, COPPA, PIPL/China,
> GDPR/Nórdicos, ABNT, fontes de fomento) precisam ser **validadas com jurídico** antes de publicar/captar. A confiança
> de cada ponto está marcada. Consolida a análise que estava em `the-inclusionist-docs · docs/2-Architecture/adr/ADR-0010-non-negotiable-pillars.yaml` (P4/P5/P6/P10).
>
> As **regras testáveis** derivadas daqui estão em [`../1-Discovery/NFR.md`](../1-Discovery/NFR.md) (RN-01..04, ABNT
> ¼×½). As **decisões** (lei-local-vence, identidade-via-gov, GPL-3.0, arte-não-FOSS) vão em `the-inclusionist-docs · docs/2-Architecture/adr/`.

## 1. Modelo de prioridade — "a lei local da região de implantação vence"

Substitui o antigo "regra mais rígida vence" (autocontraditório: real-name da China × minimização COPPA). **A
legislação local da região onde o produto é implantado prevalece sempre;** os demais regimes são **meta, conforme
possível**. Compliance é **por região**, não um superset global impossível. *(confiança: alta como princípio;
implementação por região a validar)*

## 2. Regimes por região

| Regime | Exige (leitura de engenharia) | Efeito no produto |
|---|---|---|
| **LGPD** (BR) | minimização, consentimento, direitos de acesso/eliminação, logs | local-first; nada pessoal sai do dispositivo por padrão |
| **COPPA** (EUA) | **consentimento verificável do responsável** antes de PII de <13 | verificação do **adulto**, delegada; PII da criança minimizada |
| **PIPL** (China) | dados de criança <14 = sensível; **residência de dados na China**; real-name | **fora do MVP** (China = meta); real-name **só dentro da China** |
| **GDPR / GDPR-K** (UE/Nórdicos) | minimização, proibição de perfilar/publicidade a menor, direitos | sem profiling/ad comportamental de criança; acesso/eliminação |

**Limite honesto:** o **código** pode ser *compliance-ready*, mas **aprovação legal é externa** — ex.: China exige
licença de publicação **版号/ISBN (NPPA)** + localização de dados. Não vendemos "aprovado na China", vendemos
"**arquitetado para ser aprovável**"; só comunicar "aprovável" com **parceria local real** que ateste. *(confiança: média)*

## 3. Regras inegociáveis de dados (RN) — a base das NFR

- **RN-01 — sem dados abertos:** nada de dados abertos de criança. Apenas **anônimos**, via **parceria com instituição
  de renome** (que detém IRB/ética); **nunca PII**; dado bruto fica local/na região. *(o premortem mostrou que dado
  aberto de criança = risco de escândalo que mata a marca — ver `AVALIACAO-ADVERSARIAL-PREMORTEM.md`)*
- **RN-02 — identidade do adulto nunca no jogo:** quem cadastra é o **adulto** (professor/responsável) via **sistema do
  governo** (.gov no BR; RNV só dentro da China). Guardamos no máximo um **token/booleano de consentimento** — não a
  identidade. Isso **não contradiz** LGPD/COPPA: identificar/consentir o adulto é exatamente o exigido, e o PII da
  criança é minimizado.
- **RN-03 — real-name só dentro da China;** anti-addiction de **menor** (China) fica **fora do MVP**.
- **RN-04 — residência de dados:** telemetria de jogadores de um país **fica em servidores daquele país**, salvo se a
  origem permitir armazenar em outro (permissão da **origem E do destino**).

**Síntese "tratar todo usuário como criança"** (a regra mais protetiva por eixo): consentimento (COPPA+PIPL) ·
minimização (GDPR/LGPD, local-first) · residência (RN-04) · sem profiling/ad (COPPA/GDPR-K) · dados de pesquisa
(RN-01) · direitos de acesso/eliminação (GDPR/LGPD).

## 4. Acessibilidade — base legal (janela de Libras)

- **ABNT NBR 15290:2005:** janela de Libras com **altura ≥ ½ da tela** e **largura ≥ ¼ da tela**. Nosso painel 420×180:
  **25% largura × 100% altura → atende**. *(confiança: alta p/ a métrica)*
- Também **Lei 10.436/2002**, **Decreto 5.626/2005**, **LBI 13.146/2015**.
- Regras extras da norma: (i) **nada sobreposto à janela do intérprete** (o avanço de 5px é do intérprete SOBRE o
  jogo, nunca o contrário); (ii) **pele/roupa/cabelo do intérprete contrastantes** entre si e com o fundo.
- Se for para TV/VoD, checar normas de streaming/Ancine. *(confiança: média p/ esse recorte)*

## 5. Fomento × licenciamento

- **Licença:** **código GPL-3.0 desde já** (sem BSL); **arte NÃO-FOSS**; jogo gratuito; bases fora dos jogos = MIT.
- **Tensão dura (arte):** GPL/FOSS **não pode restringir campo de uso** (liberdade 0 / OSI nº 6) → arte sob GPL =
  qualquer um usa em qualquer coisa. Logo a **arte é um recorte NÃO-FOSS** separado do código. Proteção: (a) **marca
  registrada** dos personagens (esteio mais robusto, independe de copyright); (b) licença de arte própria (proíbe uso
  adulto/depreciativo); (c) autoria humana no algoritmo. **Ressalva:** arte derivada de IA pode ser incopyrightável →
  a **marca** é o esteio. Marca é **seletiva** (nem todo personagem/jogo). Detalhe: `LICENCAS-GERACAO-IMAGEM.md`.
- **Fontes (BR):** Rouanet (enquadramento cultural), Ancine/FSA (audiovisual — via animação/Libras), PNLD (didático +
  acessibilidade — atendemos com folga), FAPESP, FINEP, CNPq, BNDES, Lei de Informática. **(Nórdicos/UE):** Nordisk
  Kulturfond, programas da UE, filantropia EdTech, parcerias universitárias. *(confiança: média — elegibilidade de
  "jogo" caso a caso)*
- **Condicional (r4):** a estratégia "código FOSS + arte não-FOSS" está **condicionada à aceitação das fontes de
  fomento** — se um financiador exigir arte livre, reavaliar caso a caso.

## 6.5 Normas adicionais (consulta com professora, 2026-07-05)

Padrões que reforçam os pilares e devem entrar no mapa de conformidade:

- **GB/T 37668-2019 (China) — acessibilidade:** além do WCAG 2.2 — braille eletrônico (adaptado, ainda não testado),
  **tempo suficiente de leitura**, navegação por **teclado** (não só mouse), compatibilidade com **tecnologia
  assistiva de terceiros**. *(confiança: média — validar tradução da norma)*
- **EN 301 549 / EAA (UE) — acessibilidade:** navegação **sem depender de texto** (ícones intuitivos + pistas visuais;
  ex.: os 4 dígitos do filtro = 4 bichinhos com cores primárias/secundárias); **dica quando travado** (3 min sem
  progresso → setas, instruções de botão, animação-demo) sem gerar ansiedade; **design limpo** (sem explosão de cor/som
  — autismo). → operacionalizado em [ADR-0005](https://github.com/the-inclusionist/the-inclusionist-docs/blob/main/docs/2-Architecture/adr/ADR-0005-no-login-access-teacher-activity-code.yaml)
  e [ADR-0006](https://github.com/the-inclusionist/the-inclusionist-docs/blob/main/docs/2-Architecture/adr/ADR-0006-ethical-engagement-wellbeing.yaml).
- **China "Youth Mode":** trava de **40 min** contra fadiga visual/mental (→ ADR-0006 + NFR).
- **Padrão de transparência nórdico:** mesmo com dados na escola, o jogo permite **baixar todas as progressões**
  (portabilidade/transparência).
- **Persistência escola (v2.0):** progresso salvo no **servidor da escola**, com **aprovação dos pais** → a
  responsabilidade LGPD/GDPR passa à **escola/rede** e **fica só lá**. Fora do MVP (v2.0).
- **Analytics fora do jogo:** coleta de comportamento (quais jogos funcionam/são abandonados/quebram) é **anônima** e
  visível **só num painel separado** (outro programa), **inacessível de dentro do jogo**; progresso local (rede da
  escola / casa). Reforça RN-01.

## 6. IP dos geradores de imagem por IA

Mesmo convertendo a imagem em algoritmo, pode haver responsabilidade por **derivar da expressão** específica gerada
pelo serviço. Estado da pesquisa (licenças PixelLab/Magnific/ComfyUI/etc. × nosso caso GPL) em
[`LICENCAS-GERACAO-IMAGEM.md`](LICENCAS-GERACAO-IMAGEM.md).
