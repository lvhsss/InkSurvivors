// Codegen: walks assets/source/<group>/<trait>.svg, strips the outer <svg>
// wrapper, minifies whitespace, and emits assets/Assets.sol — a Solidity
// library exposing one pure function per primitive returning the inner SVG
// string. Function names are camelCase `<group><Trait>`.
//
// Folder = trait group (background, hand, head, mouth, skin, underwear).
// File   = trait inside that group (e.g. skin/alien.svg -> skinAlien()).
//
// Idempotent: running twice with no source changes produces no diff.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(here, "source");
const outFile = resolve(here, "Assets.sol");

// Trait groups whose primitives are EXTERNALISED into their own
// public-function libraries (deployed separately and DELEGATECALL'd into).
// Anything not listed here is inlined into the small `Assets` aggregator.
//
// Rationale: GraveShift's combined runtime size exceeded EIP-170 (24,576 B)
// because every SVG string literal was inlined via internal calls. By moving
// the three largest groups (skin, head, hand) into their own libraries with
// `public` selectors, the body of those primitives lives in separate
// deployments and `GraveShift` only carries DELEGATECALL stubs.
//
// If you add a new heavy group, append it here AND wire up Renderer.sol to
// call the new library directly.
const EXTERNAL_GROUPS = new Set(["skin", "head", "hand", "1of1"]);

// Some groups are still too large for a single externalised library — the
// EIP-170 24 KB runtime-bytecode cap is enforced by the chain at deploy.
// `1of1` is the canonical case: 4 full-frame 32x32 primitives at ~7 KB
// runtime each sum to ~28 KB, busting the cap. Listed groups are split into
// `N` chunked sub-libraries (alphabetical filename order). The `Assets`
// aggregator's forwarder picks the right chunk per primitive, so call sites
// like `Assets.oneOfOneDracula()` are unchanged.
const EXTERNAL_GROUP_CHUNKS = { "1of1": 2 };

// Player-gainable traits per group. State markers (skinBase, skinTombstone,
// skinZombie) are emitted as Solidity functions for the Renderer but MUST NOT
// appear in the gainable trait roll table — SolidityEng reads this list when
// encoding ID ranges and group weights.
//
// `background` is intentionally absent — its gainability is derived per-file
// from the `<index>-<kind>[-<label>].svg` filename convention (kind ∈
// {live, tombstone, zombie}). See parseBackgroundMeta() below.
const PLAYER_GAINABLE = {
  hand: null,
  head: null,
  mouth: null,
  underwear: null,
  // `zombie` doubles as a state marker (used by Zombie status) AND a
  // live-gainable overlay applied over `skinBase` when an Alive token rolls
  // it. State markers excluded from rolls: base, tombstone.
  skin: ["alien", "ape", "zombie"],
  // 1/1s are deterministically assigned at mint, NOT rollable via ink
  // mutation, and are mutually exclusive with all other traits (full-frame
  // overrides). Empty array = every entry is state-only.
  "1of1": [],
};

// Map folder name → Solidity identifier prefix. Folders may use lexical
// shorthand that's not a valid identifier (e.g. `1of1`); the codegen renames
// them so library/function names stay Solidity-legal.
const GROUP_SOLIDITY_NAME = {
  "1of1": "oneOfOne",
};

function solidityGroupName(group) {
  return GROUP_SOLIDITY_NAME[group] ?? group;
}

// background filenames must match `<NN>-<kind>[-<label>].svg`.
// kind ∈ {tombstone, zombie, live}. NN is a zero-padded 1-based id matching
// alphabetical sort order — that id is what SolidityEng will use to address
// the background slot.
function parseBackgroundMeta(traitName) {
  const m = traitName.match(/^(\d{2})-(tombstone|zombie|live)(?:-([a-z0-9]+))?$/);
  if (!m) {
    throw new Error(
      `background/${traitName}.svg: filename must be <NN>-<kind>[-<label>].svg (kind: tombstone|zombie|live)`
    );
  }
  return { id: Number(m[1]), kind: m[2], label: m[3] ?? null };
}

function extractBackgroundHex(inner, file) {
  const m = inner.match(/fill="(#[0-9a-fA-F]{6})"/);
  if (!m) throw new Error(`${file}: background must declare a 6-digit hex fill`);
  return m[1].toLowerCase();
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

function extractInner(svg, file) {
  const wrap = svg.match(/<svg([^>]*)>([\s\S]*)<\/svg>\s*$/);
  if (!wrap) throw new Error(`${file}: no <svg> wrapper found`);
  const attrs = wrap[1];
  const inner = wrap[2];
  const vb = attrs.match(/viewBox="([^"]+)"/);
  if (!vb || vb[1].trim() !== "0 0 32 32") {
    throw new Error(`${file}: viewBox must be "0 0 32 32" (got ${vb?.[1] ?? "none"})`);
  }
  return inner;
}

function minify(s) {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*=\s*/g, "=")
    .trim();
}

// Parse rects out of the inner SVG fragment, inheriting any group fill.
// Hand-authored SVGs come from pixel-art editors as one <rect> per pixel
// with an inline fill, which is brutally byte-heavy. We re-emit them grouped
// by color with horizontal runs coalesced.
function parseRects(inner) {
  const rects = [];
  const stack = [];
  let i = 0;
  while (i < inner.length) {
    const lt = inner.indexOf("<", i);
    if (lt < 0) break;
    const gt = inner.indexOf(">", lt);
    if (gt < 0) break;
    const tag = inner.slice(lt, gt + 1);
    if (tag.startsWith("<g ")) {
      const m = tag.match(/fill="([^"]+)"/);
      stack.push(m ? m[1] : null);
    } else if (tag.startsWith("</g>")) {
      stack.pop();
    } else if (tag.startsWith("<rect")) {
      const attrs = {};
      for (const m of tag.matchAll(/(\w+)="([^"]+)"/g)) attrs[m[1]] = m[2];
      const fill = attrs.fill ?? stack[stack.length - 1];
      if (!fill) throw new Error("rect with no fill (no inline, no group)");
      rects.push({
        x: Number(attrs.x ?? "0"),
        y: Number(attrs.y ?? "0"),
        w: Number(attrs.width ?? "1"),
        h: Number(attrs.height ?? "1"),
        fill: fill.toLowerCase(),
      });
    }
    i = gt + 1;
  }
  return rects;
}

// Merge runs of horizontally-adjacent same-color, same-row, same-height rects
// into a single wider rect. Preserves z-order: only adjacent entries within
// the same color bucket can merge, and grouping by color is safe because
// validateNoOverlaps() guarantees no two rects of different colors share a
// pixel.
function coalesceHoriz(rects) {
  const byFill = new Map();
  const order = [];
  for (const r of rects) {
    if (!byFill.has(r.fill)) {
      byFill.set(r.fill, []);
      order.push(r.fill);
    }
    byFill.get(r.fill).push(r);
  }
  const out = new Map();
  for (const fill of order) {
    // pass 1: horizontal merge — same y, h, adjacent x
    const list = byFill.get(fill).slice().sort((a, b) => a.y - b.y || a.x - b.x);
    const h1 = [];
    for (const r of list) {
      const last = h1[h1.length - 1];
      if (last && last.y === r.y && last.h === r.h && last.x + last.w === r.x) {
        last.w += r.w;
      } else {
        h1.push({ ...r });
      }
    }
    // pass 2: vertical merge — same x, w, adjacent y
    h1.sort((a, b) => a.x - b.x || a.w - b.w || a.y - b.y);
    const h2 = [];
    for (const r of h1) {
      const last = h2[h2.length - 1];
      if (last && last.x === r.x && last.w === r.w && last.y + last.h === r.y) {
        last.h += r.h;
      } else {
        h2.push({ ...r });
      }
    }
    out.set(fill, h2);
  }
  return { order, byFill: out };
}

function validateNoOverlaps(rects, file) {
  const cells = new Map();
  for (const r of rects) {
    for (let dx = 0; dx < r.w; dx++) {
      for (let dy = 0; dy < r.h; dy++) {
        const key = `${r.x + dx},${r.y + dy}`;
        const prior = cells.get(key);
        if (prior && prior !== r.fill) {
          throw new Error(
            `${file}: pixel (${r.x + dx},${r.y + dy}) painted twice with different fills (${prior} then ${r.fill}); regroup would change z-order`
          );
        }
        cells.set(key, r.fill);
      }
    }
  }
}

function regroup(inner, file) {
  const rects = parseRects(inner);
  validateNoOverlaps(rects, file);
  const { order, byFill } = coalesceHoriz(rects);
  return order
    .map((fill) => {
      const body = byFill
        .get(fill)
        .map(
          (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`
        )
        .join("");
      return `<g fill="${fill}">${body}</g>`;
    })
    .join("");
}

const groups = readdirSync(sourceDir)
  .filter((g) => statSync(resolve(sourceDir, g)).isDirectory())
  .filter((g) =>
    readdirSync(resolve(sourceDir, g)).some((f) => f.endsWith(".svg")),
  )
  .sort();

const primitives = [];
const byGroup = {};
// background metadata, populated as we walk source/background/.
// Used to emit `Assets.background*` helpers and the taxonomy comment.
const backgroundMeta = [];

for (const group of groups) {
  const dir = resolve(sourceDir, group);
  const files = readdirSync(dir).filter((f) => f.endsWith(".svg")).sort();
  byGroup[group] = [];
  for (const file of files) {
    const traitName = basename(file, ".svg");
    const fnName = camelCase(solidityGroupName(group)) + pascalCase(traitName);
    const raw = readFileSync(resolve(dir, file), "utf8");
    const minified = minify(extractInner(raw, `${group}/${file}`));
    const inner = regroup(minified, `${group}/${file}`);
    if (inner.includes("'")) {
      throw new Error(`${group}/${file}: contains a single quote — change attr quoting`);
    }
    const bytes = Buffer.byteLength(inner, "utf8");
    primitives.push({ group, traitName, fnName, inner, bytes });
    byGroup[group].push({ traitName, fnName, bytes });
    if (group === "background") {
      const meta = parseBackgroundMeta(traitName);
      // ID is sequential by sorted order; cross-check against the filename's
      // declared NN prefix so a typo doesn't silently produce a renumbered set.
      const expectedId = backgroundMeta.length + 1;
      if (meta.id !== expectedId) {
        throw new Error(
          `background/${file}: declared id ${meta.id} but sequential position is ${expectedId}; rename the file to fix the order`
        );
      }
      const hex = extractBackgroundHex(inner, `${group}/${file}`);
      backgroundMeta.push({ id: meta.id, kind: meta.kind, label: meta.label, hex, fnName });
    }
  }
}

if (backgroundMeta.length === 0) {
  throw new Error("no background SVGs found under source/background/");
}
const bgTombstones = backgroundMeta.filter((b) => b.kind === "tombstone");
const bgZombies = backgroundMeta.filter((b) => b.kind === "zombie");
const bgLives = backgroundMeta.filter((b) => b.kind === "live");
if (bgTombstones.length !== 1) {
  throw new Error(
    `background: exactly 1 tombstone-reserved entry required, got ${bgTombstones.length}`
  );
}
if (bgZombies.length !== 1) {
  throw new Error(
    `background: exactly 1 zombie-reserved entry required, got ${bgZombies.length}`
  );
}
if (bgLives.length < 1) {
  throw new Error("background: at least 1 live-gainable entry required");
}

if (!primitives.length) {
  console.error("no source SVGs found under", sourceDir);
  process.exit(1);
}

const taxonomyComment = groups
  .map((g) => {
    if (g === "background") {
      const live = bgLives.map((b) => `${b.id}=${b.hex}`).join(", ") || "<none>";
      const tomb = bgTombstones.map((b) => `${b.id}=${b.hex}`).join(", ") || "<none>";
      const zomb = bgZombies.map((b) => `${b.id}=${b.hex}`).join(", ") || "<none>";
      return [
        `// background  live (gainable IDs): ${live}`,
        `//             tombstone-reserved:  ${tomb}`,
        `//             zombie-reserved:     ${zomb}`,
      ].join("\n");
    }
    const gainable = PLAYER_GAINABLE[g];
    const traits = byGroup[g].map((p) => p.traitName);
    const tag = gainable === null
      ? `gainable: ${traits.join(", ") || "<none>"}`
      : `gainable: ${gainable.join(", ")}   state-only: ${traits.filter((t) => !gainable.includes(t)).join(", ") || "<none>"}`;
    return `// ${g.padEnd(11)} ${tag}`;
  })
  .join("\n");

const bgTombstoneId = bgTombstones[0].id;
const bgZombieId = bgZombies[0].id;
const bgLiveIds = bgLives.map((b) => b.id);
const bgLiveAtBody = bgLiveIds
  .map((id, i) => `        if (i == ${i}) return ${id};`)
  .join("\n");
const bgHelpers = `    // -------- background metadata --------
    // Solidity-side gating so the Renderer and InkMath can address backgrounds
    // by id without re-deriving the kind from a hex literal.

    /// @notice Total background primitives (live + reserved).
    function backgroundCount() internal pure returns (uint8) {
        return ${backgroundMeta.length};
    }

    /// @notice The single background id reserved for the Tombstone state.
    function backgroundTombstoneId() internal pure returns (uint8) {
        return ${bgTombstoneId};
    }

    /// @notice The single background id reserved for the Zombie state.
    function backgroundZombieId() internal pure returns (uint8) {
        return ${bgZombieId};
    }

    /// @notice Count of live-gainable background ids (rollable by Alive tokens).
    function backgroundLiveCount() internal pure returns (uint8) {
        return ${bgLiveIds.length};
    }

    /// @notice Maps a 0-indexed roll into the actual background id space (live
    ///         ids are non-contiguous because reserved ids interleave them).
    function backgroundLiveAt(uint8 i) internal pure returns (uint8) {
${bgLiveAtBody}
        revert("background: live index out of range");
    }

    /// @notice True iff \`id\` is the Tombstone-reserved background.
    function backgroundIsTombstone(uint8 id) internal pure returns (bool) {
        return id == ${bgTombstoneId};
    }

    /// @notice True iff \`id\` is the Zombie-reserved background.
    function backgroundIsZombie(uint8 id) internal pure returns (bool) {
        return id == ${bgZombieId};
    }

    /// @notice True iff \`id\` is a live-gainable background.
    function backgroundIsLive(uint8 id) internal pure returns (bool) {
        return ${bgLiveIds.map((id) => `id == ${id}`).join(" || ")};
    }

    /// @notice Dispatch by id → background primitive SVG fragment. Reverts on 0
    ///         so callers must gate id == 0 before calling.
    function backgroundById(uint8 id) internal pure returns (string memory) {
${backgroundMeta.map((b) => `        if (id == ${b.id}) return ${b.fnName}();`).join("\n")}
        revert("background: id out of range");
    }
`;

// -----------------------------------------------------------------------
// Emit externalised sub-libraries (one per heavy group).
// Each function is `public pure` so it lives in its own deployed bytecode
// and is called via DELEGATECALL from the Renderer.
// -----------------------------------------------------------------------
function libNameForGroup(group, chunkSuffix = "") {
  return "Assets" + pascalCase(solidityGroupName(group)) + chunkSuffix;
}

// Map a primitive's intra-group position → chunk suffix (e.g. "A", "B"). When
// EXTERNAL_GROUP_CHUNKS doesn't list the group, the suffix is the empty
// string so existing single-library groups (skin/head/hand) emit unchanged.
function chunkSuffixForPrimitive(group, indexInGroup, groupSize) {
  const splits = EXTERNAL_GROUP_CHUNKS[group] ?? 1;
  if (splits <= 1) return "";
  const per = Math.ceil(groupSize / splits);
  const chunkIdx = Math.floor(indexInGroup / per);
  return String.fromCharCode(65 + chunkIdx); // A, B, C, ...
}

// Pre-compute chunk suffix per primitive so the aggregator wrappers can
// reference the right sub-library.
{
  const counters = {};
  for (const p of primitives) {
    counters[p.group] = (counters[p.group] ?? 0) + 1;
  }
  const seen = {};
  for (const p of primitives) {
    if (!EXTERNAL_GROUPS.has(p.group)) {
      p.chunkSuffix = "";
      continue;
    }
    const i = seen[p.group] ?? 0;
    seen[p.group] = i + 1;
    p.chunkSuffix = chunkSuffixForPrimitive(p.group, i, counters[p.group]);
  }
}

const externalFiles = [];
for (const group of groups) {
  if (!EXTERNAL_GROUPS.has(group)) continue;
  const fns = primitives.filter((p) => p.group === group);
  // Group primitives by chunk suffix so we emit one library per chunk.
  const byChunk = new Map();
  for (const fn of fns) {
    const key = fn.chunkSuffix;
    if (!byChunk.has(key)) byChunk.set(key, []);
    byChunk.get(key).push(fn);
  }
  for (const [chunkSuffix, chunkFns] of byChunk) {
    const libName = libNameForGroup(group, chunkSuffix);
    const fileName = `${libName}.sol`;
    const filePath = resolve(here, fileName);
    const header = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// AUTO-GENERATED by assets/build.mjs. DO NOT EDIT BY HAND.
// Externalised primitives for the "${group}" group${chunkSuffix ? ` (chunk ${chunkSuffix})` : ""}.
// Functions are \`public\` so the Solidity linker deploys this library
// separately and callers go through DELEGATECALL — keeping every deployed
// contract under the EIP-170 24 KB runtime size limit.

library ${libName} {`;
    const body = chunkFns
      .map(({ group: g, traitName, fnName, inner, bytes }) =>
        [
          `    /// @dev ${g}/${traitName} - ${bytes} bytes`,
          `    function ${fnName}() public pure returns (string memory) {`,
          `        return '${inner}';`,
          `    }`,
        ].join("\n")
      )
      .join("\n\n");
    writeFileSync(filePath, `${header}\n${body}\n}\n`);
    externalFiles.push(filePath);
  }
}

// -----------------------------------------------------------------------
// Emit the small `Assets` aggregator.
// Holds: inlined primitives for non-externalised groups, the background
// metadata helpers, and internal wrappers that forward each externalised
// primitive to its sub-library so existing `Assets.skinAlien()` call sites
// keep compiling without churning Renderer.sol on every group reshuffle.
// -----------------------------------------------------------------------
const externalImports = (() => {
  const libs = new Set();
  for (const p of primitives) {
    if (!EXTERNAL_GROUPS.has(p.group)) continue;
    libs.add(libNameForGroup(p.group, p.chunkSuffix));
  }
  return [...libs]
    .sort()
    .map((lib) => `import {${lib}} from "assets/${lib}.sol";`)
    .join("\n");
})();

const header = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// AUTO-GENERATED by assets/build.mjs from assets/source/<group>/<trait>.svg.
// DO NOT EDIT BY HAND. Regenerate with \`pnpm build:assets\`.
//
// Each function returns the minified inner SVG fragment (no <svg> wrapper) for
// a single 32x32 primitive. The Renderer concatenates them inside one outer
// <svg viewBox="0 0 32 32"> in strict layer order:
//
//   background -> skin -> underwear -> hand -> mouth -> head
//
// 1/1 tokens render as a single full-frame primitive from \`1of1\` and skip the
// layered stack entirely (deterministically assigned at mint, mutually
// exclusive with every other trait).
//
// Naming: <group><Trait> camelCase. Group = folder (1of1 → \`oneOfOne\` in
// identifiers), Trait = file basename.
//
// Heavy groups (skin, head, hand) live in dedicated \`Assets<Group>\`
// libraries with \`public\` functions to keep GraveShift under the EIP-170
// runtime size limit. Light groups (background, mouth, underwear) stay inlined
// here. The wrappers below preserve the historical \`Assets.<fn>()\` call
// surface so the Renderer / InkMath don't need to import each sub-library.
//
// Trait taxonomy (SolidityEng: lock IDs against this list):
${taxonomyComment}

${externalImports}

library Assets {`;

const inlinedBody = primitives
  .filter((p) => !EXTERNAL_GROUPS.has(p.group))
  .map(({ group, traitName, fnName, inner, bytes }) =>
    [
      `    /// @dev ${group}/${traitName} - ${bytes} bytes`,
      `    function ${fnName}() internal pure returns (string memory) {`,
      `        return '${inner}';`,
      `    }`,
    ].join("\n")
  )
  .join("\n\n");

const wrappersBody = primitives
  .filter((p) => EXTERNAL_GROUPS.has(p.group))
  .map(({ group, traitName, fnName, bytes, chunkSuffix }) => {
    const libName = libNameForGroup(group, chunkSuffix);
    return [
      `    /// @dev ${group}/${traitName} - ${bytes} bytes (lives in ${libName})`,
      `    function ${fnName}() internal pure returns (string memory) {`,
      `        return ${libName}.${fnName}();`,
      `    }`,
    ].join("\n");
  })
  .join("\n\n");

const body = [inlinedBody, wrappersBody].filter(Boolean).join("\n\n");

const footer = `}\n`;

writeFileSync(outFile, `${header}\n${body}\n\n${bgHelpers}${footer}`);

const summary = primitives
  .map((p) => {
    const home = EXTERNAL_GROUPS.has(p.group)
      ? `→ ${libNameForGroup(p.group, p.chunkSuffix)}`
      : "  (inlined)";
    return `  ${(p.group + "/" + p.traitName).padEnd(28)} ${String(p.bytes).padStart(4)}B  ${p.fnName}() ${home}`;
  })
  .join("\n");
console.log(`wrote ${outFile}`);
for (const ef of externalFiles) console.log(`wrote ${ef}`);
console.log(summary);
