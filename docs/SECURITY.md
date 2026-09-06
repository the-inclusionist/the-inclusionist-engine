# Security Policy

*The Inclusionist* is an accessibility-first educational game **used by children** in Brazilian public
schools. We treat two classes of issue as top priority: **child-safety / privacy** (any leak or misuse of
student data — LGPD/COPPA) and classic **application security** (XSS, injection, insecure randomness, etc.).

## Reporting a vulnerability

**Please do not open a public issue for security problems.** Use GitHub's private channel:
**[Report a vulnerability](https://github.com/the-inclusionist/the-inclusionist-engine/security/advisories/new)**
— a draft security advisory, visible only to the maintainers until a fix ships.
If you cannot reach it, email the maintainer instead; a report that arrives is worth more than a report
filed in the right place.

> ⚠️ **This address changed on 2026-09-06.** It used to be a *confidential issue* on GitLab, and that project
> is now archived — a report filed there would have reached nobody. If you have an older copy of this file,
> the GitLab link in it is dead.

Include, when possible: affected version/commit, reproduction steps, impact, and any suggested remediation.
Reports about **exposure of children's data** are welcome even if you are unsure they qualify.

### What to expect

- **Acknowledgement:** within 5 business days.
- **Triage & severity:** we map to CVSS and to our non-negotiable pillars (child data privacy is critical
  regardless of CVSS). See `2-Architecture/adr/ADR-0017-compliance-and-data-governance.yaml`.
- **Fix window:** critical/high issues are prioritized over feature work.
- **Credit:** we credit reporters in the advisory unless you prefer to stay anonymous.

## Supported versions

This is a pre-1.0 project under active development; only the **latest `main`** (and the current Cloudflare
Pages deploy built from it) is supported. There are no back-ported security fixes for older tags.

## Scope notes

- The **VLibras** widget is a third-party gov.br embed (interim); issues in *that* widget should go to its
  upstream project, though we welcome a heads-up so we can mitigate on our side.
- Automated scanning in place, stated exactly: **gitleaks** over the whole git history, **semgrep** for
  static analysis, and **`npm audit --omit=dev --audit-level=high`**, all as blocking jobs in
  `.github/workflows/ci.yml`. This policy covers what those cannot catch.
- ⚠️ **Corrected 2026-09-06 — this section used to name CodeQL and Dependabot as already in place, and
  neither was.** CodeQL left when the project moved hosts in August and cannot simply return: GitHub's code
  scanning and secret scanning are free only on **public** repositories, and on a private one they require
  GitHub Advanced Security, which is paid. Dependabot was ruled out in the same move for being GitHub-only;
  it is available again and **has not been switched on**. A security policy that lists protections it does
  not have is worse than one that lists none, because a reporter calibrates against it.
