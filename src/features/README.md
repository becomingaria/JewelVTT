# Features

Jewel VTT is a **visual tabletop display**: one screen that the GM drives
and the players look at. It has an old-school (OSR, early-90s PC RPG)
feel: pixel art, chunky bevelled windows, dithering, chiptune blips. It
should still feel calm, readable and easy to use.

Each feature lives in its own folder here and plugs in through one
`FeatureModule` (its `index.ts`). `registry.ts` lists them all, and
`host/` mounts their pieces. **Building a feature should mean adding
files in your folder, not editing core files.**

## The plug-in points (`types.ts`)

| Field | What it's for |
|---|---|
| `AppLayer` | Mounted once at the app root: panels, HUD, dialogs, background logic, `useBoardSlice` registration |
| `BoardOverlay` | Mounted inside the board container above the humbugs; gets `camera` |
| `BoardUnderlay` | Same, but below the humbugs (floors, terrain, frames). Draw only, pointer-events: none |
| `overlayZ` / `underlayZ` | Overlays: light 20, fog 30, dungeon tool input 40, measure/templates 50, slides tool input 45, hex tool input 35. Underlays: hex terrain 10, slide frames 15, dungeon floor 20 |
| `HumbugBadge` | Drawn on every humbug (return `null` when not relevant): HP bars, conditions, light icon |
| `tools` | Buttons in the left tool dock. `kind: "mode"` = exclusive board tool (read `useActiveTool()`), `kind: "action"` = runs `onTrigger` |
| `commands` | Shown in the command palette; may have hotkeys |
| `humbugMenu` | Extra right-click entries on humbugs |
| `help` | Sections added to the How-to guide |
| `mapKindDefaults` | Refine grid/style defaults for new boards of a map kind |

## Shared services

- `board-bridge.ts`: read `useHumbugs()`, `useSelection()`, `useCamera()`,
  `pointerWorldStore`. Write with `addHumbugs`, `updateHumbugs`,
  `removeHumbugs`, `selectHumbugs`. **Each write is one undo step.** For live
  drags, call `updateHumbugs(..., { undoable: false })` repeatedly, then once
  with `undoable: true` on release. `humbugBase(position)` makes the common
  fields. `GRID_SIZE` = 32 world units per square.
- `undoGroup(label, () => { ... })`: everything undoable done inside becomes
  ONE undo step (humbug edits, `pushUndo`, `fog.reveal`...).
- `pushUndo({ label, undo, redo })`: undo for your own state (fog cells,
  initiative order...). Apply the change first, then push.
- `useBoardSlice(key, value, apply)` (from `utils/board-store`): saves your
  state with the board (files and autosave). Prefix keys with your feature
  id, e.g. `"fog-light:fog"`. Call it inside your `AppLayer`.
- `grid.ts`: **the** cell scheme for square and hex grids: `cellAt`,
  `cellCenter`, `cellPolygon`, `cellDistance`, `cellNeighbors`, `cellsWithin`,
  `cellsInRect`, `cellKey`/`parseCellKey`. Use it for anything per-cell (fog,
  floors, terrain, templates) so features line up.
- `services.ts`: cross-feature facades.
  - `logEvent()` / `useLog()`: the session log (the dice feature owns the
    panel and saving).
  - `rollDice(expr, { label })`: the dice feature registers the real engine
    (tray, sound, log); there's a basic fallback.
  - `fog.reveal(cells)` / `fog.hide` / `fog.isRevealed`: the fog-light
    feature registers it; it works on square and hex grids.
- `map-kind.ts`: `MAP_SCALE[kind]`: 10 ft per square on dungeon maps, 5 ft
  on freeform boards, 6 miles per hex on hex crawls.
- `map-kind.ts`: `useMapKind()`: `"freeform" | "dungeon" | "hexcrawl" | "slides"`.
  Use `mapKinds` on tools to show them only where they make sense.
- `view-state.ts`: layers (`layerOf`, `useLayerState`), `useTableMode()`,
  `useActiveTool()` / `setActiveTool()`.
- `prefs.ts`: `usePrefs()`, `useReducedMotion()`, `prefersReducedMotion()`.
- `sound.ts`: `playSfx(name)`. It's silent unless the viewer turned sound on.
- Humbug fields reserved for features (`types/humbug.types.ts`): `layer`,
  `groupId`, `light`, `ext[featureId]`; tokens also have `name`, `hp`,
  `conditions`, `sizeCategory`.
- `host/FeatureIcon.tsx`: `IconFrame` for your own icons (24×24,
  `currentColor`, 1.8 stroke). Put your icons in your folder. **Don't add to
  `components/Icon.tsx`.**

## Coordinates

World units, with one grid square = `GRID_SIZE` (32). Convert with
`camera.worldToScreen(x, y)` / `camera.containerToWorld(x, y)`; both handle
the 2.5D tilt. Overlays are absolutely positioned inside the board container
(`position: absolute; inset: 0`). Hex helpers are in `utils/humbug.utils.ts`
(`HEX_W`, `HEX_R`, `HEX_ROW`, `nearestHexCenter`): pointy-top, odd rows
offset.

## Hotkeys (reserved, so features never collide)

Core: `T I M K P C D H F V B ?`, `⌘S ⌘O ⌘E ⌘A`, `⌘Z ⌘⇧Z ⌘C ⌘X ⌘V`, Delete, arrows, Esc,
Shift (hold to pan).

| Feature | Keys |
|---|---|
| theme | `⌘,` (settings) |
| fog-light | `G`, `Shift+G` |
| dice | `R`, `Shift+R`, `Y`, `Shift+Y` |
| tracker | `N`, `Shift+N`, `U`, `Shift+U` |
| measure | `L`, `Shift+L`, `Q` |
| dungeon | `W`, `S`, `Shift+W`, `Shift+S` |
| hexcrawl | `E`, `Shift+E`, `X`, `Shift+X` |
| workflow | `⌘K`, `⌘G`, `⌘⇧G`, `Shift+A` |
| table-slides | `Shift+T`, `Shift+P`, `O`, and PageUp/PageDown/arrows/Space while presenting |

Hotkeys never fire while typing (the host checks for this). Esc always drops
the active tool first.

## Accessibility checklist (every feature)

- Everything works from the keyboard: real `<button>`s, Tab order, Enter/Space,
  Esc closes. Dialogs and panels move focus in and give it back on close.
- Visible `:focus-visible` ring (3px, high contrast).
- `aria-label` on icon-only buttons; `aria-pressed` on toggles; `role="dialog"`
  plus `aria-labelledby` on panels; `aria-live="polite"` for results (dice,
  turn changes).
- Colour is never the only signal: add icon, pattern, text or shape. Respect
  `html[data-colourblind]`.
- Text contrast is at least 4.5:1. Pixel fonts only for headings and
  decoration; body text stays readable, and switches to a plain font under
  `html[data-readable-font]`.
- Hit targets are at least 32×32 px (40 in the dock). This is a table display.
- Motion: check `useReducedMotion()` / `html[data-reduced-motion]`. Replace
  animation with an instant change. No flashing more than 3×/s, ever.
- Scale with `--ui-scale` (panels use `zoom: var(--ui-scale)`).

## No-annoyance checklist

- Sound is off by default and only plays through `playSfx` (respects prefs).
  Nothing auto-plays.
- No modal pop-ups the user didn't ask for. Prefer inline panels, toasts
  (`utils/toast`) and undo over "Are you sure?".
- Every board change is undoable. Confirm only for things undo can't restore.
- Panels remember open/closed state and position per viewer (localStorage,
  wrapped in try/catch).
- Effects (CRT, flicker, title cards, colour cycling) are subtle, can be
  skipped (click/Esc), and can be turned off.
- Don't steal focus or the pointer. Tools end with Esc or a second click on
  their dock button.
- Nothing covers the board centre permanently. Panels dock to edges and
  collapse.
- Table Mode (`useTableMode()`): hide GM-only details and editing chrome.

## Look

Original art only: pixel icons drawn on the 24×24 grid, procedural
textures, CSS. Old-school genre conventions (blue graph-paper dungeons,
cross-hatching, hex maps, bevelled windows, dithering) are fair game.
**Don't copy art, names, logos or UI from any specific existing game or
product.**

Use the theme tokens (`--jv-*`, defined by the theme feature in
`features/theme/tokens.css`) for colours instead of hard-coding them. Until
the theme lands, fall back like `var(--jv-panel-bg, #fff)`.

Starter tokens (theme defines the final values):
`--jv-panel-bg --jv-panel-fg --jv-panel-border --jv-accent --jv-accent-fg
--jv-muted --jv-danger --jv-success --jv-focus --jv-shadow --jv-font-display
--jv-font-body --jv-font-mono --jv-bevel-light --jv-bevel-dark`
