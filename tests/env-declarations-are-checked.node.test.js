// SPDX-License-Identifier: AGPL-3.0-or-later
// THE AMBIENT DECLARATIONS ARE TYPE-CHECKED, even though the project's `tsc` never checks them.
//
// `tsconfig.json` sets `skipLibCheck: true`, and that flag skips EVERY `.d.ts` — not only those under `node_modules`, but
// `app/js/env.d.ts` too. So an error written there is invisible to `npx tsc --noEmit`: the file once kept a type import
// of `./consumer-quiz/kokoro-porta.js` for months after that module was deleted, and nothing went red. This case compiles
// `env.d.ts` on its own with `skipLibCheck: false` and asks for zero diagnostics in it — the check the project flag
// switches off, limited to the one declaration file this repository writes by hand.
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const ENV = fileURLToPath(new URL('../app/js/env.d.ts', import.meta.url));

describe('app/js/env.d.ts is checked despite skipLibCheck', () => {
  it('✅ [Right] compiled alone with skipLibCheck off, it has zero diagnostics', () => {
    const options = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      types: [],
      strict: true,
      noEmit: true,
      skipLibCheck: false,
    };
    // ⚠️ THE LIBRARIES ARE PARSED ONLY FOR WHAT A TYPE ERROR NEEDS (`ParseForTypeErrors`), the mode TypeScript made for a
    // caller that asks for diagnostics and nothing else. Most of the parse is `lib.dom.d.ts`, 1.8 MB whose every member
    // carries a JSDoc block with its MDN reference, and none of that decides a type error in `env.d.ts`. Under the load of
    // several suites at once this case went past the 5 s ceiling while passing alone; the fix is the work shrinking, never
    // the clock growing. 📏 2026-09-25, one cold program in plain Node: ~395 ms → ~330 ms, with the same zero diagnostics.
    const host = ts.createCompilerHost(options);
    host.jsDocParsingMode = ts.JSDocParsingMode.ParseForTypeErrors;
    const program = ts.createProgram({ rootNames: [ENV], options, host });
    const file = program.getSourceFile(ENV);
    expect(file, 'env.d.ts must be part of the program').toBeDefined();
    const messages = [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)]
      .map((d) => {
        const at = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : '?';
        return `line ${at}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
      });
    expect(messages).toEqual([]);
  });
});
