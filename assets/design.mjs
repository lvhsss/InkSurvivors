// One-shot designer. Defines every primitive as a list of fill-color groups
// each containing axis-aligned rects on a 32x32 grid, and writes one SVG file
// per primitive into assets/source/. The SVGs in source/ are the canonical
// hand-authored artifacts that build.mjs reads.
//
// Re-run with `pnpm design:assets` to regenerate source files in-place.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(here, "source");
mkdirSync(sourceDir, { recursive: true });

// Palette (≤16 colors; documented in README).
const C = {
  black: "#000000",
  skin: "#f4d4a4",
  white: "#ffffff",
  red: "#e94545",
  wizPurple: "#6b4baf",
  wizPurpleDark: "#3f2a78",
  wizPurpleLite: "#c8a1ff",
  goldBright: "#ffe04a",
  goldShade: "#c8a02c",
  greyMid: "#6b6b6b",
  greyDark: "#3a3a3a",
  greyLite: "#c0c0c0",
  brown: "#8a5a2b",
  orange: "#ff7a2a",
  green: "#2ea84a",
  apeBrown: "#5e3a1f",
};

// rect = [x, y, w, h] (h defaults to 1, w defaults to 1)
const r = (x, y, w = 1, h = 1) => [x, y, w, h];

// Eye + mouth + nipples reused across base / zombie / skin overlays.
const featurePixels = [
  r(13, 7, 1, 2),    // left eye
  r(18, 7, 1, 2),    // right eye
  r(14, 10, 3, 1),   // mouth
  r(13, 18),         // left nipple
  r(18, 18),         // right nipple
];

// Skin-area rects (face, torso, arm fills, leg fills). Used by base + skin*.
const skinAreas = [
  r(11, 5, 10, 8),   // head face
  r(10, 14, 12, 9),  // torso block
  r(8, 15, 1, 7),    // left arm interior
  r(23, 15, 1, 7),   // right arm interior
  r(12, 28, 1, 3),   // left leg interior
  r(19, 28, 1, 3),   // right leg interior
];

// Black silhouette / outline shared by base + skin overlays + zombie.
// No antennae — the head zone (rows 0-3) is left empty so head traits compose
// cleanly without anything poking through.
const bodyOutline = [
  // head outline box (cols 10..21, rows 4..13)
  r(10, 4, 12, 1), r(10, 13, 12, 1),
  r(10, 5, 1, 8), r(21, 5, 1, 8),
  // shoulders + arm outlines
  r(7, 14, 3, 1), r(22, 14, 3, 1),
  r(7, 15, 1, 7), r(24, 15, 1, 7),
  r(9, 15, 1, 13), r(22, 15, 1, 13), // arm-inner / torso edges down to boxer bottom
  r(7, 22, 3, 1), r(22, 22, 3, 1),  // arm bottoms (close arm boxes)
  // boxer bottom edge
  r(10, 27, 12, 1),
  // legs
  r(11, 28, 1, 3), r(13, 28, 1, 3),
  r(18, 28, 1, 3), r(20, 28, 1, 3),
  r(10, 31, 4, 1), r(17, 31, 4, 1),
];

const primitives = {
  base: [
    [C.skin, skinAreas],
    [C.white, [
      r(10, 23, 12, 4), // boxers band rows 23..26
    ]],
    [C.red, [
      r(11, 24), r(15, 24), r(19, 24),
      r(13, 26), r(17, 26), r(20, 26),
    ]],
    [C.black, [...bodyOutline, ...featurePixels]],
  ],

  // Wider + shorter tombstone (per CEO feedback). Dome: rows 9..22 with
  // 12-wide interior; base block: rows 23..29, 16-wide interior.
  grave: [
    [C.greyLite, [
      r(13, 10, 6, 1),         // row 10 top interior (6 wide)
      r(12, 11, 8, 1),         // row 11 (8 wide)
      r(11, 12, 10, 1),        // row 12 (10 wide)
      r(10, 13, 12, 10),       // rows 13..22 cols 10..21 (12 wide)
      r(8, 24, 16, 5),         // base interior rows 24..28 cols 8..23
    ]],
    [C.greyMid, [
      // texture / shading flecks
      r(10, 14), r(21, 17),
      r(11, 21), r(19, 22),
      r(15, 18),
      r(9, 26), r(23, 26),
      r(12, 27), r(20, 27),
    ]],
    [C.black, [
      // dome outline (rounded top)
      r(13, 9, 6, 1),          // top (6 wide)
      r(12, 10), r(19, 10),    // row 10 corners
      r(11, 11), r(20, 11),    // row 11 corners
      r(10, 12), r(21, 12),    // row 12 corners
      r(9, 13, 1, 10),         // left side rows 13..22
      r(22, 13, 1, 10),        // right side rows 13..22
      // base block outline
      r(7, 23, 18, 1),         // base top (18 wide)
      r(7, 24, 1, 5),          // left base side rows 24..28
      r(24, 24, 1, 5),         // right base side
      r(7, 29, 18, 1),         // base bottom
      // "RIP" — 3x5 glyphs centered in dome interior, rows 15..19
      // R cols 11..13
      r(11, 15, 2, 1),
      r(11, 16), r(13, 16),
      r(11, 17, 2, 1),
      r(11, 18), r(13, 18),
      r(11, 19), r(13, 19),
      // I col 15
      r(15, 15, 1, 5),
      // P cols 17..19
      r(17, 15, 2, 1),
      r(17, 16), r(19, 16),
      r(17, 17, 2, 1),
      r(17, 18),
      r(17, 19),
    ]],
  ],

  zombie: [
    [C.green, skinAreas],
    [C.white, [
      r(10, 23, 12, 4),
    ]],
    [C.red, [
      r(11, 24), r(15, 24), r(19, 24),
      r(13, 26), r(17, 26), r(20, 26),
      r(13, 7), r(18, 8),     // bloodshot eye glints (red dots in eyes)
    ]],
    [C.greyDark, [
      // stitches + zombie shading
      r(15, 11), r(13, 12), r(17, 12), // stitch around mouth
      r(12, 9), r(19, 9),               // dark patches on cheeks
      r(14, 16), r(15, 16), r(16, 16), r(17, 16), // scar across chest
    ]],
    [C.black, [...bodyOutline, ...featurePixels]],
  ],

  headWizardHat: [
    [C.wizPurple, [
      // cone interior
      r(15, 1, 2, 1),
      r(14, 2, 4, 1),
      r(13, 3, 6, 1),
      r(12, 4, 8, 1),
    ]],
    [C.wizPurpleDark, [
      // brim (wider band)
      r(9, 5, 14, 1),
      r(9, 6, 14, 1),
    ]],
    [C.wizPurpleLite, [
      // sparkles on hat
      r(15, 3), r(13, 4), r(18, 4),
    ]],
    [C.goldBright, [
      // band buckle accent
      r(15, 6, 2, 1),
    ]],
    [C.black, [
      // cone outline
      r(14, 1), r(17, 1),       // shoulders of tip
      r(13, 2), r(18, 2),
      r(12, 3), r(19, 3),
      r(11, 4), r(20, 4),
      r(15, 0, 2, 1),           // top tip black cap
      // brim outline
      r(9, 4, 1, 1), r(22, 4, 1, 1), // pre-brim tabs
      r(8, 5, 1, 2), r(23, 5, 1, 2),
      r(9, 7, 14, 1),           // brim bottom outline
    ]],
  ],

  headHalo: [
    [C.goldBright, [
      r(12, 1, 8, 1),     // top arc of ring (cols 12..19)
      r(10, 2, 2, 1),     // left side curl (cols 10..11)
      r(20, 2, 2, 1),     // right side curl (cols 20..21)
      r(12, 3, 8, 1),     // bottom arc of ring
    ]],
    [C.goldShade, [
      r(13, 3, 6, 1),     // bottom inner shading for depth
    ]],
    [C.black, [
      r(12, 0, 8, 1),     // outline above top arc
      r(10, 1, 2, 1),     // top-left corner (above side curl)
      r(20, 1, 2, 1),     // top-right corner
      r(9, 2, 1, 1),      // far-left outer outline
      r(22, 2, 1, 1),     // far-right outer outline
      r(10, 3, 2, 1),     // bottom-left corner (below side curl)
      r(20, 3, 2, 1),     // bottom-right corner
    ]],
  ],

  headCrown: [
    [C.goldBright, [
      // crown band
      r(10, 5, 12, 2),
      // three peaks
      r(10, 3, 2, 2),  // left peak
      r(15, 2, 2, 3),  // center peak (taller)
      r(20, 3, 2, 2),  // right peak
    ]],
    [C.goldShade, [
      r(10, 6, 12, 1),  // band shadow line
    ]],
    [C.red, [
      r(15, 5), r(16, 5),  // center jewel
    ]],
    [C.wizPurpleLite, [
      r(10, 4),            // left gem
      r(20, 4),            // right gem
    ]],
    [C.black, [
      // outline
      r(10, 2), r(11, 2),    // top of left peak
      r(15, 1, 2, 1),        // top of center peak
      r(20, 2), r(21, 2),    // top of right peak
      r(9, 3, 1, 4),         // left edge
      r(22, 3, 1, 4),        // right edge
      r(12, 3, 3, 1),        // notch between left and center peaks
      r(17, 3, 3, 1),        // notch between center and right peaks
      r(10, 7, 12, 1),       // crown bottom
    ]],
  ],

  // Egg-shaped hood with 3 grey shades for 3D depth. No drawstrings (per
  // CEO feedback — image 1 reference).
  headHoodie: [
    [C.greyMid, [
      r(15, 1, 2, 1),       // top notch (sticks above the egg)
      r(13, 2, 6, 1),        // row 2 top of egg
      r(11, 3, 10, 1),       // row 3 (wider)
      r(10, 4), r(21, 4),    // row 4 cheek corners
      r(9, 5, 2, 8),         // left cheek (cols 9..10 rows 5..12)
      r(21, 5, 2, 8),        // right cheek (cols 21..22 rows 5..12)
    ]],
    [C.greyDark, [
      // shadow band under the rounded top, gives the 3D crease
      r(11, 4, 10, 1),
      // outer-edge shadow ring along the cheeks
      r(9, 12, 14, 1),
    ]],
    [C.greyLite, [
      r(14, 3, 2, 1),        // top highlight pixels
    ]],
    [C.black, [
      r(15, 0, 2, 1),        // top of notch
      r(14, 1), r(17, 1),    // notch sides
      r(12, 2), r(19, 2),    // row 2 corners
      r(10, 3), r(21, 3),    // row 3 corners
      r(9, 4), r(22, 4),     // row 4 corners
      r(8, 5, 1, 8),         // far left outer outline rows 5..12
      r(23, 5, 1, 8),        // far right outer outline rows 5..12
    ]],
  ],

  handWizardStaff: [
    [C.brown, [
      // staff shaft (diagonal-ish, held in right hand area)
      r(26, 8, 1, 14),  // long shaft going up-right of body
    ]],
    [C.wizPurple, [
      // orb
      r(25, 5, 3, 3),
    ]],
    [C.wizPurpleLite, [
      r(26, 5), r(25, 6),  // orb highlights
    ]],
    [C.goldBright, [
      r(25, 8, 3, 1),      // band where orb meets shaft
    ]],
    [C.black, [
      // staff outline
      r(25, 4, 3, 1),      // orb top
      r(24, 5, 1, 3),      // orb left
      r(28, 5, 1, 3),      // orb right
      r(25, 7, 3, 1),      // orb bottom (just above band)
      r(25, 9, 1, 13),     // shaft left edge rows 9..21
      r(27, 9, 1, 13),     // shaft right edge rows 9..21
      r(25, 22, 3, 1),     // staff tip cap
    ]],
  ],

  // Minimalist curled-top lyre (per CEO feedback, image 3 reference). Curls
  // at top, 3 vertical strings, small soundbox at base.
  handGoldenHarp: [
    [C.goldBright, [
      r(24, 12, 2, 2),       // left curl (cols 24..25 rows 12..13)
      r(27, 12, 2, 2),       // right curl
      r(24, 14, 1, 6),       // left post rows 14..19
      r(28, 14, 1, 6),       // right post rows 14..19
      r(23, 20, 7, 1),       // soundbox top
      r(24, 21, 5, 1),       // soundbox bottom (narrower)
    ]],
    [C.goldShade, [
      r(24, 13, 2, 1),       // left curl shadow
      r(27, 13, 2, 1),       // right curl shadow
      r(25, 21, 3, 1),       // soundbox shadow
    ]],
    [C.white, [
      r(25, 14, 1, 6),       // string 1
      r(26, 14, 1, 6),       // string 2
      r(27, 14, 1, 6),       // string 3
    ]],
    [C.black, [
      r(24, 11, 2, 1),       // top of left curl
      r(27, 11, 2, 1),       // top of right curl
      r(23, 12, 1, 8),       // far left outline rows 12..19
      r(29, 12, 1, 8),       // far right outline
      r(22, 20, 1, 2),       // soundbox far-left outline rows 20..21
      r(30, 20, 1, 2),       // soundbox far-right outline
      r(23, 22, 7, 1),       // soundbox bottom outline
    ]],
  ],

  handSword: [
    [C.greyLite, [
      // blade
      r(26, 6, 1, 14),
    ]],
    [C.white, [
      r(26, 7),              // blade highlight
    ]],
    [C.brown, [
      // handle grip
      r(26, 21, 1, 3),
    ]],
    [C.goldBright, [
      // crossguard
      r(24, 20, 5, 1),
      // pommel
      r(26, 24),
    ]],
    [C.black, [
      // blade outline
      r(25, 6, 1, 14),
      r(27, 6, 1, 14),
      r(26, 5),              // blade tip
      // crossguard outline
      r(23, 20), r(29, 20),
      r(24, 19, 5, 1),
      r(24, 21, 5, 1),
      // handle outline
      r(25, 21, 1, 3),
      r(27, 21, 1, 3),
      // pommel outline
      r(25, 24), r(27, 24),
      r(26, 25),
    ]],
  ],

  // Bigger multi-tongue flame (per CEO feedback). Yellow core, orange body,
  // red wisps at the base, with sparse black outline pixels for that hand-
  // drawn pixel-art look.
  handTorch: [
    [C.brown, [
      r(26, 15, 1, 9),       // wooden handle rows 15..23
    ]],
    [C.greyMid, [
      r(24, 13, 5, 1),       // cup top rim
      r(25, 14, 3, 1),       // cup body
    ]],
    [C.greyDark, [
      r(25, 14), r(27, 14),  // cup shadow corners
    ]],
    [C.orange, [
      // flame outer body — wide at base, narrower up
      r(24, 11, 5, 2),       // rows 11..12 cols 24..28 (wide base)
      r(24, 9, 5, 2),        // rows 9..10 cols 24..28
      r(25, 8, 3, 1),        // row 8 narrower
      // rising tongues
      r(26, 5, 1, 3),        // center tongue rows 5..7
      r(24, 7, 1, 2),        // left tongue rows 7..8
      r(28, 7, 1, 2),        // right tongue rows 7..8
    ]],
    [C.goldBright, [
      // bright yellow inner core
      r(25, 10, 3, 2),       // rows 10..11 cols 25..27
      r(26, 7, 1, 3),        // center tongue inner rows 7..9
    ]],
    [C.red, [
      r(26, 4),              // very top tip
      r(23, 11), r(29, 11),  // base wisps (far left + right)
      r(23, 12), r(29, 12),  // more base wisps
    ]],
    [C.black, [
      // flame outline (sparse, hand-drawn vibe)
      r(26, 3),               // top of tip
      r(25, 5), r(27, 5),     // tongue shoulders
      r(24, 6), r(28, 6),     // shoulders below
      r(23, 7, 1, 2),         // far left edge rows 7..8
      r(29, 7, 1, 2),         // far right edge rows 7..8
      r(23, 9, 1, 2),         // base far-left rows 9..10
      r(29, 9, 1, 2),         // base far-right rows 9..10
      // cup outline
      r(23, 13), r(29, 13),
      r(24, 14), r(28, 14),
      r(24, 15, 5, 1),
      // handle outline
      r(25, 15, 1, 9), r(27, 15, 1, 9),
      r(25, 24, 3, 1),
    ]],
  ],

  // Distinct ape face per CEO feedback (image 2 reference): warm brown skin,
  // dark-brown brow ridge, white-pupil eyes, wide flat mouth.
  skinApe: [
    [C.apeBrown, skinAreas],
    [C.brown, [
      r(11, 5, 10, 1),       // forehead highlight (lighter brown top row)
      r(11, 14, 10, 1),      // chest highlight band
    ]],
    [C.greyDark, [
      r(11, 6, 10, 1),       // brow ridge above eyes
      r(11, 11, 10, 1),      // jaw shadow under mouth
    ]],
    [C.black, [
      r(13, 7, 1, 2),        // left eye
      r(18, 7, 1, 2),        // right eye
      r(15, 9), r(16, 9),    // nose holes
      r(13, 10, 6, 1),        // wide flat ape mouth
      r(13, 18), r(18, 18),  // nipples
    ]],
    [C.white, [
      r(13, 7),              // left eye top highlight (pupil shine)
      r(18, 7),              // right eye top highlight
    ]],
  ],

  // Alien overlay (replaces the dropped `skinSolidGold`): grey skin, big
  // checker-gem eyes per image 4 reference. Tagged extra-rare in the rarity
  // table that lives in the contract.
  skinAlien: [
    [C.greyLite, skinAreas],
    [C.greyMid, [
      r(11, 5, 10, 1),       // forehead shadow
      r(11, 11, 10, 1),      // jaw shadow under eyes
      r(10, 22, 12, 1),      // belly shadow
      r(8, 21), r(23, 21),   // arm shadows
    ]],
    [C.greyDark, [
      r(11, 6, 4, 1),        // left brow (wider, sits above the big eye)
      r(17, 6, 4, 1),        // right brow
    ]],
    [C.black, [
      // Big 4x4 gem eyes filling the face. 2x2 checker tiles inside each
      // eye reads cleanly at 32x32. Left eye cols 11..14 rows 7..10.
      r(11, 7, 2, 2),        // left eye: top-left tile
      r(13, 9, 2, 2),        // left eye: bottom-right tile
      // Right eye cols 17..20 rows 7..10.
      r(17, 7, 2, 2),        // right eye: top-left tile
      r(19, 9, 2, 2),        // right eye: bottom-right tile
      r(15, 12, 2, 1),       // small dark mouth line
      r(13, 18), r(18, 18),  // nipples
    ]],
    [C.white, [
      // 2x2 white tiles complete the checker inside each eye.
      r(13, 7, 2, 2),        // left eye: top-right tile
      r(11, 9, 2, 2),        // left eye: bottom-left tile
      r(19, 7, 2, 2),        // right eye: top-right tile
      r(17, 9, 2, 2),        // right eye: bottom-left tile
    ]],
  ],
};

function emit(name, groups) {
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">`
  );
  for (const [color, rects] of groups) {
    if (!rects.length) continue;
    parts.push(`<g fill="${color}">`);
    for (const [x, y, w = 1, h = 1] of rects) {
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`
      );
    }
    parts.push(`</g>`);
  }
  parts.push(`</svg>`);
  return parts.join("\n");
}

for (const [name, groups] of Object.entries(primitives)) {
  const svg = emit(name, groups);
  writeFileSync(resolve(sourceDir, `${name}.svg`), svg + "\n");
}

console.log(
  `wrote ${Object.keys(primitives).length} source SVGs to ${sourceDir}`
);
