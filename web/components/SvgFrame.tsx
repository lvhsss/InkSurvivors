"use client";

import clsx from "@/lib/clsx";

type Props = {
  svg: string | null;
  state?: string;
  className?: string;
  ariaLabel?: string;
};

export function SvgFrame({ svg, state, className, ariaLabel }: Props) {
  if (!svg) {
    return (
      <div
        className={clsx(
          "aspect-square w-full bg-cream text-muted flex items-center justify-center pixel-border",
          className,
        )}
      >
        <span className="heading-pixel text-xs">no image</span>
      </div>
    );
  }
  return (
    <div
      className={clsx(
        "relative aspect-square w-full overflow-hidden pixel-border bg-sky",
        className,
      )}
      aria-label={ariaLabel}
    >
      <div
        className="pixelated absolute inset-0"
        role="img"
        aria-label={ariaLabel}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {state ? (
        <span className="absolute top-1 left-1 bg-paper text-ink text-[10px] heading-pixel px-1 py-0.5 border border-ink">
          {state}
        </span>
      ) : null}
    </div>
  );
}
