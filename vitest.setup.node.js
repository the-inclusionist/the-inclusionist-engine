// SPDX-License-Identifier: AGPL-3.0-or-later
// Setup of the "node" project. Nothing to load: `core/i18n` holds no state (ADR-0232 D3, erratum of 2026-09-25) — a file that
// translates builds its own translator (`createTranslator()`, pt; with `filePort` from `tests/fixtures/file-storage.js` when
// it switches the language), and the settings store is a factory (ADR-0232 D4): a file that needs one builds it.
