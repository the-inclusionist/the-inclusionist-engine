#!/usr/bin/env python3
"""Validate the ADR records: they parse, and they match the shape they declare.

    python scripts/validate-adr.py docs/2-Architecture/adr

The index calls these records "machine-readable ... lint against a schema later".
This is that lint. It exists because for a long time nothing checked, and five of
twenty-six records did not parse at all while nobody noticed.

The third check is the one worth having. `- Decouple: a layer must place itself...`
is valid YAML: the `: ` turns the list item into a mapping, so the file loads
cleanly and the record simply holds the wrong data. No error, no symptom, wrong
content. Quote such items.

Two shapes are legal, per adr/README.md:
  full    — one decision weighed against named alternatives (the default)
  bundle  — `metadata.shape: bundle`, a consolidation of decisions already taken
            (ADR-0011..0018, from the retired REGISTRO-DE-DECISOES log). No
            considered-options, because none were ever weighed.
"""
from __future__ import annotations

import glob
import os
import re
import sys

try:
    import yaml
except ImportError:
    sys.exit("PyYAML is missing: pip install pyyaml")

META_KEYS = ["status", "date", "decision-makers", "consulted", "informed"]

# 🔴 A RAIZ CONTRA A QUAL O `confirmed-by` É CONFERIDO, e ela era `os.getcwd()` escrito no meio da comparação.
#
# 📏 MEDIDO EM 2026-09-09, correndo este validador de FORA do repositório: 122 registos, **113 sãos e 9 com
# problemas** — e os nove eram os nove que têm `confirmed-by`. Nenhum defeito nos registos: a comparação
# resolvia caminhos contra a pasta de onde alguém chamou o comando, e ninguém tinha declarado que era isso.
#
# ⚠️ E A MEDIÇÃO VALE MAIS DO QUE O CONSERTO, porque ela desenha a fronteira de uma decisão em aberto (a
# proposta do Dev de um repositório só para a árvore de ADR): a conferência da FORMA viaja — 113 passaram
# fora da árvore — e a conferência da CONSTRUÇÃO não viaja, porque precisa do código ao lado. São nove
# registos, e são exactamente os que não podem mudar de casa sem perder o que os confirma.
#
# 📌 O padrão continua a ser o `cwd`, para nenhum chamador de hoje mudar de comportamento; o que muda é que a
# raiz passa a ser DECLARÁVEL (`--root=…`) e a ser DITA na mensagem de reprovação. Um caminho em falta deixa
# de parecer um registo mentiroso quando é só o comando a correr do sítio errado.
RAIZ = os.getcwd()

# 🔴 E DESDE A MUDANÇA DE CASA, UM CAMINHO PODE VIVER NOUTRO REPOSITÓRIO. `confirmed-by: engine:app/js/x.ts`
# diz DUAS coisas — que artefacto confirma o registo, e onde ele mora —, e a segunda passou a ser necessária
# no dia em que os registos deixaram de morar ao lado do código (ADR-0123).
#
# ⚠️ SEM A RAIZ DAQUELE REPOSITÓRIO, A CONFERÊNCIA NÃO ACONTECE — e é isso que tem de aparecer. Um crivo que
# não confere nada e imprime «tudo são» é pior do que não existir: é a forma exacta do falso relatório que
# este projecto já apanhou três vezes. Então o que não se confere é CONTADO e DITO no fim, por repositório,
# em toda corrida. Passa-se a raiz com `--repo engine=../SP-the-inclusionist-tracer`.
RAIZES = {}
NAO_CONFERIDOS = {}

# ADR-0057 diz como um registo MUDA. `confirmed-by` diz outra coisa, que faltava: se ele foi CONSTRUÍDO.
#
# A distinção apareceu na issue #95. O ADR-0053 fecha com «⚠️ NOT YET BUILT. This record is the decision; the
# script is its issue» — verdade no dia em que foi escrita, e falsa no dia em que o script nasceu. Não é
# errata (o autor, com os factos daquele dia, teria escrito exactamente aquilo) nem supersessão (a decisão
# não mudou): é uma linha de ESTADO que envelheceu, e o ADR-0057 não tem forma para ela.
#
# ⚠️ A PROSA DA `confirmation` NÃO SE REESCREVE. Ela é histórica e fica como estava; `confirmed-by` é o facto
# de hoje, e vive nos METADADOS, que num YADR são a primeira coisa que se lê. Assim o registo diz as duas
# coisas verdadeiras ao mesmo tempo — o que foi decidido, e que já existe — sem que nenhuma delas minta.
#
# O que a máquina passa a saber: a diferença entre «decidido» e «decidido e construído». Cada caminho listado
# TEM DE EXISTIR, e é aí que a chave paga o próprio custo — foi medido em 2026-09-07 que três issues abertas
# apontavam para ficheiros que tinham saído com o cartucho, e nada dizia. Um `confirmed-by` a apontar para um
# gate apagado seria a mesma coisa, num registo aceite.
CONFIRMED_BY = "confirmed-by"
FULL_KEYS = [
    "metadata", "title", "context-and-problem-statement", "decision-drivers",
    "considered-options", "pros-and-cons-of-the-options", "decision-outcome",
    "more-information",
]
BUNDLE_KEYS = [
    "metadata", "title", "context-and-problem-statement", "decision-outcome",
    "more-information",
]
# Lists that hold prose. A mapping here means a `: ` ate the sentence.
PROSE_LISTS = ["decision-drivers", "considered-options"]

# ADR-0057: `metadata.status` is an ENUM and holds nothing else. The narrative moved to
# `superseded-by`, `supersedes`, `superseded-in-part` and `errata`.
STATUSES = ("proposed", "accepted", "deprecated", "superseded")

# A body that announces its own amendment while the metadata says nothing is the failure that
# actually happened: fifteen records were edited in place on 2026-08-28 and every `status` still
# read `accepted`, so an external diagnostic read one of them as current and it was not.
AMEND_MARKER = re.compile(r"(AMENDED|CORRECTED|COMPLETED 20|Settled 20|EMENDA|Emenda de)")

# ADR-0043 shape: a known debt gets a budget that ONLY GOES DOWN. These are the records that
# predate ADR-0057 and still carry the old form. Entries are REMOVED as the retrofit lands; a
# name that no longer needs to be here is itself a failure, so the list cannot rot upward.
# ZERADA em 2026-09-04. Os quatro registros que guardavam prosa no `status` foram quebrados nos
# campos do ADR-0057. A lista fica, vazia: um orçamento que chegou a zero e some deixa de provar
# que chegou, e a proxima entrada tem de ser uma decisao e nao um esquecimento.
STATUS_DEBT = set()
# ZERADA em 2026-09-04, uma semana depois de ser criada com catorze nomes. Cada entrada saiu por
# classificacao — errata, supersessao, ou conserto do proprio gate — e nenhuma por ser tolerada.
# A lista fica, vazia, pela mesma razao da STATUS_DEBT: orcamento que chega a zero e some deixa de
# provar que chegou.
AMEND_DEBT = set()


def every_list_item(node, path=""):
    """(path, item) for every item of every list anywhere in the document."""
    if isinstance(node, dict):
        for key, value in node.items():
            yield from every_list_item(value, f"{path}.{key}" if path else str(key))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield f"{path}[{index}]", value
            yield from every_list_item(value, f"{path}[{index}]")


def check(path):
    """Return a list of human-readable problems; empty means the record is sound."""
    try:
        doc = yaml.safe_load(open(path, encoding="utf-8"))
    except yaml.YAMLError as exc:
        mark = getattr(exc, "problem_mark", None)
        where = f" (line {mark.line + 1}, col {mark.column + 1})" if mark else ""
        return [f"does not parse: {getattr(exc, 'problem', exc)}{where}"]

    if not isinstance(doc, dict):
        return ["the document root is not a mapping"]

    problems = []
    metadata = doc.get("metadata")
    if not isinstance(metadata, dict):
        return ["`metadata` is missing or is not a mapping"]

    shape = metadata.get("shape", "full")
    if shape not in ("full", "bundle"):
        problems.append(f"metadata.shape is `{shape}`; expected `full` or `bundle`")
        shape = "full"

    for key in (BUNDLE_KEYS if shape == "bundle" else FULL_KEYS):
        if key not in doc:
            problems.append(f"missing `{key}` (shape: {shape})")
    for key in META_KEYS:
        if key not in metadata:
            problems.append(f"metadata is missing `{key}`")

    outcome = doc.get("decision-outcome")
    if isinstance(outcome, dict):
        if shape == "full":
            chosen = outcome.get("chosen-option")
            if not isinstance(chosen, dict) or not {"link", "justification"} <= set(chosen):
                problems.append("decision-outcome.chosen-option needs both `link` and `justification`")
            if "consequences" not in outcome:
                problems.append("decision-outcome is missing `consequences`")
            if "confirmation" not in outcome:
                problems.append("decision-outcome is missing `confirmation` — how would we know it worked?")
        elif "justification" not in outcome:
            problems.append("a bundle needs decision-outcome.justification")
    elif "decision-outcome" in doc:
        problems.append("`decision-outcome` is not a mapping")

    # The silent one: prose that YAML read as structure.
    for key in PROSE_LISTS:
        for index, item in enumerate(doc.get(key) or []):
            if isinstance(item, dict):
                culprit = next(iter(item), "?")
                problems.append(
                    f"{key}[{index}] became a MAPPING instead of text — a `: ` in "
                    f"{culprit[:40]!r} split the sentence. Quote the item."
                )
    for where, item in every_list_item(doc.get("pros-and-cons-of-the-options") or {}, "pros-and-cons"):
        if isinstance(item, dict) and not all(k in ("pros", "cons") for k in item):
            culprit = next(iter(item), "?")
            problems.append(f"{where} became a MAPPING instead of text ({culprit[:40]!r}). Quote the item.")

    # --- ADR-0057: how a record is allowed to change -------------------------
    name = os.path.basename(path)
    status = metadata.get("status")
    if status not in STATUSES and name not in STATUS_DEBT:
        problems.append(
            f"metadata.status is {str(status)[:60]!r}; it must be one of {'/'.join(STATUSES)}. "
            "The narrative goes in `superseded-by`, `supersedes`, `superseded-in-part` or `errata` (ADR-0057)."
        )
    if status == "superseded" and not metadata.get("superseded-by"):
        problems.append("status is `superseded` with no `superseded-by` — a dead end for the reader (ADR-0057)")

    # --- issue #95: a máquina sabe a diferença entre decidido e CONSTRUÍDO --------------------
    if CONFIRMED_BY in metadata:
        alvos = metadata[CONFIRMED_BY]
        if not isinstance(alvos, list) or not alvos:
            problems.append(f"`{CONFIRMED_BY}` must be a non-empty list of repository paths")
        else:
            for alvo in alvos:
                if not isinstance(alvo, str):
                    problems.append(f"`{CONFIRMED_BY}` holds {type(alvo).__name__}; every entry is a path")
                else:
                    repo, _, resto = alvo.partition(":")
                    if not resto:                       # sem prefixo: o caminho é deste repositório
                        repo, resto = "", alvo
                    if repo and repo not in RAIZES:
                        NAO_CONFERIDOS[repo] = NAO_CONFERIDOS.get(repo, 0) + 1
                    elif not os.path.exists(os.path.join(RAIZES.get(repo, RAIZ), resto)):
                        onde = RAIZES.get(repo, RAIZ)
                        problems.append(
                            f"`{CONFIRMED_BY}` names {alvo}, which does not exist under {onde} — a record "
                            "that says it was built, pointing at nothing, is worse than one that says nothing"
                        )
        # Uma PROPOSTA não pode estar confirmada: o que ainda não foi decidido não pode ter sido construído,
        # e um registo nesse estado é ou uma proposta que já correu à frente, ou um `status` esquecido.
        if status == "proposed":
            problems.append(f"status is `proposed` and carries `{CONFIRMED_BY}` — a proposal cannot be built yet")

    # `proposed` is still being written: the immutability rule binds ACCEPTED records (ADR-0057), so a
    # proposal that shows its working is doing the right thing.
    if (status != "proposed"
            and AMEND_MARKER.search(open(path, encoding="utf-8").read())
            and name not in AMEND_DEBT):
        # `supersedes` and `supersedes-in-part` count: a body that says `AMENDED here` is announcing what THIS
        # record does to ANOTHER, and the metadata that declares it is the outgoing pointer, not an erratum.
        declared = {"errata", "superseded-in-part", "superseded-by",
                    "supersedes", "supersedes-in-part"} & set(metadata)
        if not declared:
            problems.append(
                "the body announces an amendment (AMENDED/CORRECTED/COMPLETED/Settled) and the metadata "
                "declares none. Either it is an ERRATUM (add `errata`) or the decision changed and needs a "
                "superseding record (ADR-0057)"
            )
    return problems


def number(path):
    """`ADR-0058` from `.../ADR-0058-five-systems-....yaml`, or None if unparseable."""
    stem = os.path.basename(path)
    return stem[:8] if stem[:4] == "ADR-" and stem[4:8].isdigit() else None


def pointer_problems(files):
    """Cross-file: a supersession is a PAIR, and half of one is worse than none.

    A reader arrives from whichever side they happen to hold. `superseded-by` alone leaves the
    successor silent about what it replaced; `supersedes` alone leaves the old record still
    claiming to govern. Both directions are checked (ADR-0057).
    """
    meta, problems = {}, {}
    for path in files:
        name = number(path)
        if not name:
            continue
        try:
            doc = yaml.safe_load(open(path, encoding="utf-8")) or {}
        except yaml.YAMLError:
            # `check` reports this file as unparseable with the line and column. Crashing here
            # instead would replace 68 verdicts with one traceback, which is the classic way a
            # gate stops gating: it looks broken rather than red, and somebody skips it.
            continue
        meta[name] = (path, doc.get("metadata") or {})

    def note(path, text):
        problems.setdefault(path, []).append(text)

    for name, (path, m) in meta.items():
        target = m.get("superseded-by")
        if target:
            if target not in meta:
                note(path, f"`superseded-by: {target}` names a record that does not exist")
            elif name not in (meta[target][1].get("supersedes") or []):
                note(path, f"`superseded-by: {target}`, but {target} does not list {name} in `supersedes`")
        for replaced in m.get("supersedes") or []:
            if replaced not in meta:
                note(path, f"`supersedes` names {replaced}, which does not exist")
            elif meta[replaced][1].get("superseded-by") != name:
                note(path, f"`supersedes: {replaced}`, but {replaced} does not point back with `superseded-by: {name}`")

        # Partial supersession is a pair too, and it is the EASIER one to leave half-done:
        # nothing about the old record's status changes, so a missing mirror is invisible.
        for entry in m.get("superseded-in-part") or []:
            by = entry.get("by") if isinstance(entry, dict) else entry
            if by not in meta:
                note(path, f"`superseded-in-part` names {by}, which does not exist")
            elif name not in (meta[by][1].get("supersedes-in-part") or []):
                note(path, f"`superseded-in-part: {by}`, but {by} does not list {name} in `supersedes-in-part`")
            elif isinstance(entry, dict) and not entry.get("what"):
                note(path, f"`superseded-in-part: {by}` does not say WHAT part — the reader cannot tell which "
                           "clauses still govern (ADR-0057)")
        # A reference to a record that does not exist is worse than none: it reads as answered.
        # Found by accident in ADR-0010, which sent the reader to ADR-0052 for the Libras levels
        # decided in ADR-0051 — one digit, and the reader arrives at `professionals author activities`.
        for cited in sorted(set(re.findall(r"ADR-\d{4}", open(path, encoding="utf-8").read()))):
            if cited not in meta and cited != name:
                note(path, f"cites {cited}, which does not exist")

        for replaced in m.get("supersedes-in-part") or []:
            if replaced not in meta:
                note(path, f"`supersedes-in-part` names {replaced}, which does not exist")
            else:
                back = meta[replaced][1].get("superseded-in-part") or []
                if not any((e.get("by") if isinstance(e, dict) else e) == name for e in back):
                    note(path, f"`supersedes-in-part: {replaced}`, but {replaced} does not point back")
    return problems


def main():
    global RAIZ
    # ⚠️ UMA PASSAGEM SÓ, e o valor de `--repo` é consumido AQUI. A primeira versão filtrava as opções com um
    # `startswith("--")` e depois lia-as noutro laço — e o `engine=…` de `--repo engine=…` não começa por
    # traço, logo ia parar à lista de argumentos posicionais e era lido como a PASTA dos registos.
    args = []
    resto = list(sys.argv[1:])
    while resto:
        flag = resto.pop(0)
        if flag.startswith("--root="):
            RAIZ = flag[len("--root="):]
        elif flag == "--repo" and resto:
            nome, _, caminho = resto.pop(0).partition("=")
            if caminho:
                RAIZES[nome] = caminho
        elif flag.startswith("--repo="):
            nome, _, caminho = flag[len("--repo="):].partition("=")
            if caminho:
                RAIZES[nome] = caminho
        elif not flag.startswith("--"):
            args.append(flag)
    folder = args[0] if args else "docs/2-Architecture/adr"
    files = sorted(glob.glob(os.path.join(folder, "ADR-*.yaml")))
    if not files:
        sys.exit(f"no ADR-*.yaml found in {folder}")

    crossed = pointer_problems(files)
    failed = 0
    for path in files:
        problems = check(path) + crossed.get(path, [])
        if problems:
            failed += 1
            print(f"FAIL {os.path.basename(path)}")
            for problem in problems:
                print(f"       {problem}")
    print(f"\n{len(files)} records · {len(files) - failed} sound · {failed} with problems")
    # 🔴 O QUE NÃO FOI CONFERIDO É DITO, SEMPRE. Sem esta linha, um repositório que só tem os registos
    # imprimiria «tudo são» sem ter aberto um único artefacto — e essa é a diferença entre um crivo e um
    # carimbo. Passe `--repo engine=<caminho>` para o conferir de verdade.
    for repo in sorted(NAO_CONFERIDOS):
        print(f"⚠️  {NAO_CONFERIDOS[repo]} `confirmed-by` paths in `{repo}` NOT checked "
              f"— pass `--repo {repo}=<path>` to check them")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
