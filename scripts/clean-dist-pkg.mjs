#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Empties `dist-pkg/` before the package is compiled into it.
//
// `tsc` writes what exists and deletes nothing: a module removed from `app/js` kept its compiled `.js` and `.d.ts` in
// `dist-pkg/`, and `prepack` would publish it. Measured on 2026-09-13: `dist-pkg/ui/activities-menu.js` was still there
// after the module left the engine (issue #171).
import { rmSync } from 'node:fs';

rmSync('dist-pkg', { recursive: true, force: true });
