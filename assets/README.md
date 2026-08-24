# GraveShift on-chain assets

Hand-authored 32×32 pixel-art primitives compiled into a Solidity library
(`Assets.sol`) and concatenated by the Renderer inside a single outer SVG.

## Files

```
assets/
├── source/             trait taxonomy — one folder per group, one SVG per trait
│   ├── background/     6 canonical colors: 1 tombstone-reserved, 1 zombie-reserved, 4 live
│   ├── skin/           base/tombstone/zombie state markers + gainable skins
│   ├── underwear/      torso/leg cover
│   ├── hand/           held items
│   ├── mouth/          face overlays (cigar, glasses, spit)
│   ├── head/           headwear / hats / halos
│   └── 1of1/           full-frame 1/1 overrides (MIN-37)
├── build.mjs           codegen: source/<group>/<trait>.svg → Assets.sol
├── preview.mjs         eyeballing helper → preview/index.html + showcase.html
├── preview/            generated HTML + Chrome-headless screenshot
├── refs/               MS-Paint reference images downloaded from MIN-1
└── Assets.sol          AUTO-GENERATED — do not edit by hand
```

## Build

```
pnpm build:assets    # source/<group>/<trait>.svg → Assets.sol (idempotent)
pnpm preview:assets  # write preview/index.html + showcase.html
```

`build:assets` is the only step on the engineering critical path —
SolidityEng imports `Assets.sol` directly.

The build performs two optimization passes on each minified primitive:

1. **Group by fill color.** Per-pixel rects from the pixel-art editor are
   regrouped under `<g fill="#X">…</g>` so the fill attribute lives once per
   color instead of once per pixel.
2. **Horizontal then vertical run coalescing.** Adjacent same-color pixels
   inside a color group are merged into a single wider/taller rect.

Both passes are byte-only optimizations — they require zero overlaps between
rects of different colors and the build validates that before regrouping.

## Trait taxonomy

| folder       | role                          | player-gainable traits                | state markers (NOT rollable)   |
|--------------|-------------------------------|---------------------------------------|--------------------------------|
| `background` | backdrop, every token         | ids 2,3,5,6 (4 live colors)           | id 1 Tombstone, id 4 Zombie    |
| `skin`       | body / state                  | `alien`, `ape` *(rarest group)*       | `base`, `tombstone`, `zombie`  |
| `underwear`  | torso / boxer                 | `underwear-1`, `underwear-2`          | —                              |
| `hand`       | held item                     | `banana`, `harp`, `sword`, `torch`, `wand` | —                          |
| `mouth`      | face overlay                  | `cigar`, `glasses`, `spit`            | —                              |
| `head`       | headwear                      | `clown`, `crown`, `halo`, `hood`, `UFO`, `wiz_hat` | —                 |
| `1of1`       | full-frame override (MIN-37)  | — (deterministic at mint, NOT rollable) | `austronaut`, `dracula`, `master`, `superman` |

### 1/1s (MIN-36/37)

1/1s are mutually exclusive with every other trait — when assigned, the
Renderer emits only the 1/1 fragment, no other layers. They are deterministic
at mint (SolidityEng owns the assignment math) and never appear in the ink
mutation roll table. Primitives live in `AssetsOneOfOne.sol` (externalised,
public functions called via DELEGATECALL) and are mirrored via
`Assets.oneOfOne*()` internal wrappers.

Folder name `1of1` is not a valid Solidity identifier — the codegen renames
it to `oneOfOne` for library and function names. Function names follow the
same `<group><Trait>` PascalCase convention (`oneOfOneAustronaut`,
`oneOfOneDracula`, `oneOfOneMaster`, `oneOfOneSuperman`).

### Background id schema (locked 2026-05-19, MIN-13)

Filename pattern `source/background/<NN>-<kind>[-<label>].svg`, kind ∈
{`tombstone`, `zombie`, `live`}. Build aborts if the file ordering, count, or
kind constraints drift; SolidityEng addresses backgrounds by the `NN` id.

| id | hex       | kind      | filename                            | Solidity helper                       |
|----|-----------|-----------|-------------------------------------|---------------------------------------|
| 1  | `#282828` | tombstone | `01-tombstone.svg`                  | `Assets.backgroundTombstoneId()`      |
| 2  | `#5CB8E7` | live      | `02-live-blue.svg`                  | `Assets.backgroundLiveAt(0)`          |
| 3  | `#FFBB53` | live      | `03-live-orange.svg`                | `Assets.backgroundLiveAt(1)`          |
| 4  | `#33357C` | zombie    | `04-zombie.svg`                     | `Assets.backgroundZombieId()`         |
| 5  | `#63197C` | live      | `05-live-purple.svg`                | `Assets.backgroundLiveAt(2)`          |
| 6  | `#EA6874` | live      | `06-live-red.svg`                   | `Assets.backgroundLiveAt(3)`          |

Solidity gating helpers in `Assets.sol`:

- `backgroundCount()` → 6
- `backgroundLiveCount()` → 4
- `backgroundTombstoneId()` → 1, `backgroundZombieId()` → 4
- `backgroundLiveAt(uint8 i)` → maps 0..3 to the 4 live ids (2,3,5,6)
- `backgroundIsLive(id)`, `backgroundIsTombstone(id)`, `backgroundIsZombie(id)`
- `backgroundById(id)` → the SVG fragment (reverts on 0 or > 6)

Notes for SolidityEng locking trait IDs:

- **Skin is the rarest gainable group.** Rollable Skin traits are `alien`,
  `ape`, and `zombie` (the zombie overlay doubles as a live-gainable skin —
  MIN-17). `base` and `tombstone` remain *state markers* the contract selects
  deterministically based on token state and never appear in the random-trait
  roll table. When `zombie` is rolled on an Alive token the Renderer composes
  `background[live] + skinBase + skinZombie + ...` (overlay), distinct from
  the Zombie *status* path which is `background[zombie] + skinZombie` (no
  base).
- **Tombstone is fully static.** When a token's state = Tombstone, the
  Renderer composes exactly `Assets.backgroundById(1) + skinTombstone` and
  skips every other group regardless of stored trait IDs.
- **Zombies use the reserved background.** Zombies render against
  `Assets.backgroundById(4)` (#33357C). They skip Skin rolls but stack
  head / hand / mouth / underwear.
- **Live tokens roll only over the 4 live ids.** Use
  `backgroundLiveAt(roll % backgroundLiveCount())` so reserved ids (1, 4)
  never appear in the live id space.

## Grid

* Logical canvas: **32 × 32**, top-left origin, one `<rect>` per pixel cell.
* Outer SVG attributes (emitted by Renderer, not by primitives):
  `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"`.
* Each primitive returns only the **inner** fragment — no `<svg>` wrapper.
* All source SVGs must have `viewBox="0 0 32 32"`; `build.mjs` rejects anything
  else.

### Zones

| rows  | reserved for                                 |
|-------|----------------------------------------------|
| 0–3   | head trait headroom (hat tips, halos, UFO)   |
| 4–13  | head + face                                  |
| 14–27 | torso + arms + underwear                     |
| 28–31 | legs + feet                                  |

`head*` primitives must not paint below row 12. `hand*` primitives live to
the right of the body (cols ~22–30) so they don't overlap the torso
silhouette.

## Layer order (Renderer concat)

```
background  →  skin  →  underwear  →  hand  →  mouth  →  head
```

* `background` paints the backdrop (single solid-color rect).
* `skin` paints the body. For state markers (`base`, `tombstone`, `zombie`)
  the body is also the state silhouette.
* `underwear`, `hand`, `mouth`, `head` are trait overlays.
* For **Tombstone state**, the Renderer composes only `background[gray] +
  skinTombstone` — every other group is suppressed regardless of stored
  trait IDs.

## Palette

The palette is no longer strictly enforced after the May-18 refresh — each
hand-authored primitive may introduce its own shading tones for MS-Paint
texture (e.g. `skinTombstone` uses 8 shades of gray for stone depth).
Solid groups across primitives still share these recurring hues:

| usage              | hex(es)                                              |
|--------------------|------------------------------------------------------|
| outline / eyes     | `#000000`                                            |
| base human skin    | `#f4d4a4`                                            |
| white              | `#ffffff` (underwear, harp strings, eye highlights)  |
| red                | `#e94545` (boxer dots, jewel, torch wisps)           |
| gold               | `#ffe04a` / `#c8a02c` (crown / halo / harp / staff buckle) |
| wizard purples     | `#6b4baf` / `#3f2a78` / `#c8a1ff` (wiz hat + wand)   |
| greys              | `#c0c0c0` / `#6b6b6b` / `#3a3a3a` (hood, sword blade)|
| zombie green       | `#2ea84a`                                            |
| ape brown          | `#5e3a1f` / `#8a5a2b`                                |
| live backgrounds   | `#5cb8e7` / `#ffbb53` / `#63197c` / `#ea6874` (4 live, MIN-13) |
| tombstone bg       | `#282828` (locked — Tombstone-only, MIN-13)          |
| zombie bg          | `#33357c` (locked — Zombie-only, MIN-13)             |

If you add a new tone, prefer reusing one already in the table above.

## Authoring conventions

* Source SVGs may be authored either per-pixel (one `<rect width="1" height="1">`
  per cell) or pre-grouped — `build.mjs` reflows them anyway. Per-pixel is
  what pixel-art editors export, so just paste and commit.
* Always emit explicit `width` and `height` on every `<rect>`. SVG defaults
  rect width/height to `0` and renders nothing without them.
* No two rects of different colors may share a pixel. The build validates
  this; a violation aborts the build (regrouping would change z-order).
* Trait files must be named with characters that survive a camelCase
  conversion: alphanumerics + `_` + `-` are fine, but the generated function
  name is `<group><PascalTrait>` (`skin/wiz_hat.svg` → `headWizHat()`).

## Acceptance check

Open `preview/index.html` in a browser — it renders every primitive in
isolation grouped by trait folder, the three canonical states (Base Human /
Tombstone / Zombie), and several mixed-composition characters.

`preview/showcase.png` is a Chrome-headless snapshot of the four canonical
compositions; attached to MIN-9.
