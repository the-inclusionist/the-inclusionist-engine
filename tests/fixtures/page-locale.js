// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/fixtures/page-locale — a translator over THIS file's page, for a browser case with no engine (ADR-0232 D3).
//
// `core/i18n` holds no state since the erratum of 2026-09-25: the language lives in a translator a root builds. A case that
// boots an engine switches through it (`engine.setLocale`); a case that tests a module on its own builds the translator a
// root would — this file's storage, and the page's three effects (`<html lang>`, the markup pass, `i18n:change`).
import { createTranslator } from '../../app/js/core/i18n.js';
import { localeHostHooks } from '../../app/js/platform/locale-host.js';
import { filePort } from './file-storage.js';

/** A translator that keeps the language in this file's storage and tells this file's page, as a root's does. */
export function pageTranslator() {
  const translator = createTranslator({ ...filePort, ...localeHostHooks(document, window, (root) => translator.applyDom(root)) });
  return translator;
}
