// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FIXTURE'S STANDALONE SHELL (ADR-0140 §2), in miniature: a real one calls `createGame`; this one asks the engine what it would
// refuse and starts the cartridge in its region. What matters to the build is that it names the engine, which the APP bundles.
import { cartridgeRefusals } from '@the-inclusionist/engine';
import cartridge from '../src/index.js';

const region = document.querySelector<HTMLElement>('#game-region') ?? document.body;
const refused = cartridgeRefusals(cartridge.declaration, cartridge.hooks);
if (refused.length) region.textContent = refused.join('\n');
else cartridge.create({ region }).update(1);
