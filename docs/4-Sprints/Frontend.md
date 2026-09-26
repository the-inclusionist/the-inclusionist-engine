# Frontend (SDD phase d)

Two distinct UIs, two approaches:

## DOM educational activities (Duolingo-style / Playground, ex-Quizizz — out-of-engine)

A real, component-rich UI. Architecture decided in
**[ADR-0002](../2-Architecture/adr/ADR-0002-dom-activities-ui-light-dom-web-components.yaml)**:

- **Web Components (Custom Elements) in light DOM** — **no Shadow DOM** (it breaks cross-boundary ARIA references:
  `aria-labelledby` / `aria-activedescendant` / `aria-controls`; a11y pillar #1 wins). The footgun is Shadow DOM
  specifically, not custom elements.
- **Atomic Design** (Brad Frost: atoms → molecules → organisms → templates → pages) — the organizing method.
- **Storybook (CSF)** + **Chromatic** — isolated component development + visual-regression testing.
- **Activates** when the DOM-activities app is built (≈ Phase 6).

## The canvas game (PixiJS) + thin in-game menus

**Not** targets for any of the above — no Storybook, no component framework. Visual regression here is the **preview
screenshot harness** (compare rendered frames), and the DOM a11y shell stays the light `ui/dom.ts` module.
