import { TRAIT_GROUPS, type TraitEntry, type TraitGroup } from "@/lib/traitManifest.generated";
import {
  dropInfoFor,
  P_DEATH_PCT,
  P_GAIN_BY_COUNT_PCT,
  P_RESURRECT_PCT,
} from "@/lib/traitDrops";

const ART_BG = "#5cb8e6";

function frameSvg(svg: string) {
  // Source SVGs use no fill on a transparent canvas; wrap with the sky tile so
  // pixel art reads on a light page. Inject a checkered fallback via CSS-bg
  // already on the parent, so any transparent pixels show through.
  return svg.replace(
    /<svg([^>]*?)>/,
    (_match, attrs: string) =>
      `<svg${attrs} preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" style="display:block;width:100%;height:100%;image-rendering:pixelated;background:${ART_BG}">`,
  );
}

function TraitCard({
  entry,
  perTrait,
  variant = "trait",
}: {
  entry: TraitEntry;
  perTrait?: string;
  variant?: "trait" | "state";
}) {
  return (
    <article className="pixel-border-soft bg-paper">
      <div
        className="pixelated aspect-square w-full"
        role="img"
        aria-label={entry.name}
        dangerouslySetInnerHTML={{ __html: frameSvg(entry.svg) }}
      />
      <div className="border-t border-ink/15 px-2 py-1.5 flex items-baseline justify-between gap-2">
        <span className="heading-pixel text-[9px] text-ink truncate">
          {entry.name}
        </span>
        <span
          className={`text-[11px] font-mono ${variant === "state" ? "text-muted" : "text-rune"}`}
        >
          {perTrait ?? (variant === "state" ? "state" : "+1 trait")}
        </span>
      </div>
    </article>
  );
}

function GroupSection({ group }: { group: TraitGroup }) {
  if (group.traits.length === 0 && group.states.length === 0) return null;
  const info = dropInfoFor(group.slug);

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink/15 pb-2">
        <div>
          <h3 className="heading-pixel text-xs text-ink uppercase">
            {group.name}
          </h3>
          {info.sublabel ? (
            <p className="mt-1 text-muted text-base leading-none">
              {info.sublabel}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <span className="heading-pixel text-[10px] text-rune">
            {info.groupChance}
          </span>
          <p className="text-muted text-base leading-none mt-1">
            {group.traits.length}{" "}
            {group.traits.length === 1 ? "trait" : "traits"}
            {group.states.length
              ? ` · ${group.states.length} state${group.states.length === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
      </header>

      {group.traits.length > 0 ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          {group.traits.map((entry) => (
            <TraitCard
              key={entry.id}
              entry={entry}
              perTrait={info.perTrait?.[entry.slug]}
            />
          ))}
        </div>
      ) : null}

      {group.states.length > 0 ? (
        <div className="pt-1">
          <div className="heading-pixel text-[10px] text-muted mb-2">
            STATES (not gainable as traits)
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {group.states.map((entry) => (
              <TraitCard
                key={entry.id}
                entry={entry}
                variant="state"
                perTrait="ink state"
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function TraitGallery() {
  return (
    <section className="space-y-8">
      <header>
        <h2 className="heading-pixel text-base sm:text-lg text-ink">
          TRAIT POOL
        </h2>
      </header>

      {TRAIT_GROUPS.map((group) => (
        <GroupSection key={group.slug} group={group} />
      ))}

      <InkMath />
    </section>
  );
}

function InkMath() {
  const gainCols = P_GAIN_BY_COUNT_PCT.map((pct, i) => ({
    label: i === P_GAIN_BY_COUNT_PCT.length - 1 ? `${i}+` : `${i}`,
    pct,
  }));

  return (
    <section className="pixel-border-soft bg-paper p-4 sm:p-5 space-y-3">
      <h3 className="heading-pixel text-[11px] text-ink">INK MATH</h3>
      <p className="text-ink/70 text-base leading-snug">
        Every 1,000 mints closes an ink. Every live token rolls.
      </p>

      <ul className="grid sm:grid-cols-3 gap-3 text-base">
        <li className="pixel-border-soft bg-white p-3">
          <div className="heading-pixel text-[9px] text-muted">DEATH</div>
          <div className="mt-1 text-ink">
            <span className="heading-pixel text-rune text-sm">
              {P_DEATH_PCT}%
            </span>{" "}
            of live tokens become Tombstones each ink.
          </div>
        </li>
        <li className="pixel-border-soft bg-white p-3">
          <div className="heading-pixel text-[9px] text-muted">RESURRECT</div>
          <div className="mt-1 text-ink">
            Tombstones roll{" "}
            <span className="heading-pixel text-rune text-sm">
              {P_RESURRECT_PCT}%
            </span>{" "}
            per ink → Zombie (five independent 50% rolls).
          </div>
        </li>
        <li className="pixel-border-soft bg-white p-3">
          <div className="heading-pixel text-[9px] text-muted">GROUP WEIGHT</div>
          <div className="mt-1 text-ink">
            Skin <span className="font-mono">×1</span>, every other group{" "}
            <span className="font-mono">×5</span>. Skin is the rarest gain
            (~3.85% of any +1 roll).
          </div>
        </li>
      </ul>

      <div className="pt-1">
        <div className="heading-pixel text-[10px] text-muted mb-2">
          +1 TRAIT BY CURRENT COUNT (DIMINISHING RETURNS)
        </div>
        <div className="grid grid-cols-7 gap-2 text-center">
          {gainCols.map((col) => (
            <div key={col.label} className="pixel-border-soft bg-white py-2">
              <div className="text-muted text-[10px] uppercase">
                {col.label}
              </div>
              <div className="heading-pixel text-rune text-sm">{col.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
