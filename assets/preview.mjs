// Builds assets/preview/index.html — a grid of every primitive plus
// composed-character cells that mirror what the Renderer will produce on-chain.
//
// Layer order: background -> skin -> underwear -> hand -> mouth -> head.
// Reads the nested source/<group>/<trait>.svg taxonomy; resolves layer names
// as <group><Trait> camelCase to match Assets.sol function names.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(here, "source");
const outDir = resolve(here, "preview");
mkdirSync(outDir, { recursive: true });

const LAYER_ORDER = ["background", "skin", "underwear", "hand", "mouth", "head"];

// Folder name → Solidity identifier prefix; mirrors build.mjs.
const GROUP_SOLIDITY_NAME = { "1of1": "oneOfOne" };
function solidityGroupName(group) {
  return GROUP_SOLIDITY_NAME[group] ?? group;
}

function camelCase(s) {
  return s
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}
function pascalCase(s) {
  const c = camelCase(s);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

// primitives: { [`${group}/${trait}`]: rawSvg, [`<group><Trait>`]: rawSvg }
const primitives = {};
const indexByGroup = {};
for (const group of readdirSync(sourceDir)) {
  const gdir = resolve(sourceDir, group);
  if (!statSync(gdir).isDirectory()) continue;
  indexByGroup[group] = [];
  for (const f of readdirSync(gdir)) {
    if (!f.endsWith(".svg")) continue;
    const trait = basename(f, ".svg");
    const raw = readFileSync(resolve(gdir, f), "utf8");
    const key = camelCase(solidityGroupName(group)) + pascalCase(trait);
    primitives[`${group}/${trait}`] = raw;
    primitives[key] = raw;
    indexByGroup[group].push({ trait, key });
  }
}

function inner(svg) {
  const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/);
  return m ? m[1] : "";
}

// compose() takes a list of <group><Trait> keys; renders inside one 32x32 SVG.
function compose(keys, { size = 256 } = {}) {
  const layers = keys.map((k) => {
    if (!primitives[k]) throw new Error(`unknown primitive: ${k}`);
    return inner(primitives[k]);
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges" width="${size}" height="${size}">${layers}</svg>`;
}

const sections = [];

// Background metadata mirrors assets/source/background/<NN>-<kind>[-<label>].svg.
// Kept here so the preview can lay out reserved vs. live cells without parsing
// the Solidity output.
const BG_TOMBSTONE = "background01Tombstone";
const BG_ZOMBIE = "background04Zombie";
const BG_LIVE = [
  { key: "background02LiveBlue", hex: "#5CB8E7" },
  { key: "background03LiveOrange", hex: "#FFBB53" },
  { key: "background05LivePurple", hex: "#63197C" },
  { key: "background06LiveRed", hex: "#EA6874" },
];
const BG_DEFAULT_LIVE = BG_LIVE[0].key;

// Section 1 — the three canonical state showcases.
sections.push({
  title: "States (canonical)",
  cells: [
    {
      label: `Base Human (blue bg)\n= ${BG_DEFAULT_LIVE} + skinBase`,
      svg: compose([BG_DEFAULT_LIVE, "skinBase"]),
    },
    {
      label: `Tombstone\n= ${BG_TOMBSTONE} + skinTombstone (NO traits, locked #282828)`,
      svg: compose([BG_TOMBSTONE, "skinTombstone"]),
    },
    {
      label: `Zombie\n= ${BG_ZOMBIE} + skinZombie (locked #33357C)`,
      svg: compose([BG_ZOMBIE, "skinZombie"]),
    },
  ],
});

// Section 2 — backgrounds palette (4 live + 2 reserved) for hex audit.
sections.push({
  title: "Background palette (6 canonical hex)",
  cells: [
    { label: `01-tombstone #282828\nreserved — Tombstone only`, svg: compose([BG_TOMBSTONE]) },
    { label: `02-live-blue #5CB8E7\nlive gainable`, svg: compose(["background02LiveBlue"]) },
    { label: `03-live-orange #FFBB53\nlive gainable`, svg: compose(["background03LiveOrange"]) },
    { label: `04-zombie #33357C\nreserved — Zombie only`, svg: compose([BG_ZOMBIE]) },
    { label: `05-live-purple #63197C\nlive gainable`, svg: compose(["background05LivePurple"]) },
    { label: `06-live-red #EA6874\nlive gainable`, svg: compose(["background06LiveRed"]) },
  ],
});

// Section 3 — skin-on-top-of-base verification per parent MIN-11.
// Renderer order will be `background → base → skin → ...` so every custom skin
// is drawn over skinBase. If a skin SVG leaves transparent holes the base
// pixels show through here — flag any cell where the base body is visible
// inside the skin's silhouette.
const skinOverBaseCells = [];
for (const skin of ["skinAlien", "skinApe", "skinZombie"]) {
  for (const bg of BG_LIVE) {
    skinOverBaseCells.push({
      label: `${skin} OVER skinBase\n${bg.key} ${bg.hex}`,
      svg: compose([bg.key, "skinBase", skin]),
    });
  }
}
sections.push({
  title: "Skin OVER base (board fix: skins layer on top of base, not replace it)",
  cells: skinOverBaseCells,
});

// Section 4 — mixed composed characters in layer order.
sections.push({
  title: "Mixed examples (background→base→skin→underwear→hand→mouth→head)",
  cells: [
    {
      label: "alien wizard\nbgBlue + base + alien + underwear1 + wand + wizHat",
      svg: compose(["background02LiveBlue", "skinBase", "skinAlien", "underwearUnderwear1", "handWand", "headWizHat"]),
    },
    {
      label: "ape king\nbgOrange + base + ape + underwear2 + sword + crown",
      svg: compose(["background03LiveOrange", "skinBase", "skinApe", "underwearUnderwear2", "handSword", "headCrown"]),
    },
    {
      label: "zombie torchbearer\nbgZombie + skinZombie + torch + hood",
      svg: compose([BG_ZOMBIE, "skinZombie", "handTorch", "headHood"]),
    },
    {
      label: "base + harp + halo + cigar\nbgPurple, full-stack divine vibes",
      svg: compose(["background05LivePurple", "skinBase", "underwearUnderwear1", "handHarp", "mouthCigar", "headHalo"]),
    },
    {
      label: "clown w/ banana\nbgRed + base + banana + glasses + clown",
      svg: compose(["background06LiveRed", "skinBase", "handBanana", "mouthGlasses", "headClown"]),
    },
    {
      label: "alien w/ UFO\nbgBlue + base + alien + UFO",
      svg: compose(["background02LiveBlue", "skinBase", "skinAlien", "headUFO"]),
    },
    {
      label: "live-zombie torchbearer (MIN-17)\nbgRed + base + zombieSkin + torch + hood",
      svg: compose(["background06LiveRed", "skinBase", "skinZombie", "handTorch", "headHood"]),
    },
  ],
});

// Section 3 — every primitive in isolation (cream bg for visibility on light theme).
for (const group of LAYER_ORDER) {
  if (!indexByGroup[group]) continue;
  sections.push({
    title: `Group: ${group}`,
    cells: indexByGroup[group].map(({ trait, key }) => ({
      label: `${group}/${trait}\n${key}()`,
      svg: group === "background"
        ? compose([key])
        : compose([BG_DEFAULT_LIVE, key]),
    })),
  });
}

// 1/1s — full-frame overrides, deterministically assigned at mint, mutually
// exclusive with every other trait. Rendered without any other layers.
if (indexByGroup["1of1"]?.length) {
  sections.push({
    title: "1/1s (full-frame overrides — no other traits, no layer stack)",
    cells: indexByGroup["1of1"].map(({ trait, key }) => ({
      label: `1of1/${trait}\n${key}()`,
      svg: compose([key]),
    })),
  });
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>GraveShift assets preview</title>
<style>
  body { background:#111; color:#eee; font:13px ui-monospace,monospace; margin:20px; }
  h1 { margin:0 0 16px; }
  h2 { margin:24px 0 8px; color:#fa3; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:18px; }
  .cell { background:#1b1b1b; padding:12px; border-radius:8px; }
  .cell svg { display:block; image-rendering:pixelated; margin:0 auto; }
  .label { margin-top:8px; text-align:center; color:#9aa; white-space:pre-line; word-break:break-word; }
</style></head><body>
<h1>GraveShift on-chain primitives (32x32, scaled 8x)</h1>
${sections.map((s) => `
<h2>${s.title}</h2>
<div class="grid">
${s.cells.map((c) => `  <div class="cell">${c.svg}<div class="label">${c.label}</div></div>`).join("\n")}
</div>`).join("\n")}
</body></html>`;

const htmlPath = resolve(outDir, "index.html");
writeFileSync(htmlPath, html);
console.log("wrote", htmlPath);

// stand-alone showcase HTML used for the headless screenshot
const showcase = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin:0; padding:0; background:#1a1a2e; display:grid;
    grid-template-columns:repeat(4,256px); gap:12px; padding:12px; }
  .frame { width:256px; height:256px; }
  svg { width:100%; height:100%; image-rendering:pixelated; }
</style></head><body>
<div class="frame">${compose([BG_DEFAULT_LIVE, "skinBase"])}</div>
<div class="frame">${compose([BG_TOMBSTONE, "skinTombstone"])}</div>
<div class="frame">${compose([BG_ZOMBIE, "skinZombie"])}</div>
<div class="frame">${compose(["background02LiveBlue", "skinBase", "skinAlien", "underwearUnderwear1", "handWand", "headWizHat"])}</div>
<div class="frame">${compose(["background03LiveOrange", "skinBase", "skinApe", "underwearUnderwear2", "handSword", "headCrown"])}</div>
<div class="frame">${compose(["background05LivePurple", "skinBase", "underwearUnderwear1", "handHarp", "mouthCigar", "headHalo"])}</div>
<div class="frame">${compose(["background06LiveRed", "skinBase", "handBanana", "mouthGlasses", "headClown"])}</div>
<div class="frame">${compose([BG_ZOMBIE, "skinZombie", "handTorch", "headHood"])}</div>
<div class="frame">${compose(["background06LiveRed", "skinBase", "skinZombie", "handTorch", "headHood"])}</div>
</body></html>`;
writeFileSync(resolve(outDir, "showcase.html"), showcase);
console.log("wrote", resolve(outDir, "showcase.html"));
