"use client";

import Link from "next/link";

import { useTokenMetadata } from "@/lib/hooks";
import { readTokenState } from "@/lib/tokenURI";
import { SvgFrame } from "./SvgFrame";

function stateLabel(state: ReturnType<typeof readTokenState>) {
  switch (state) {
    case "grave":
      return "GRAVE";
    case "zombie":
      return "ZOMBIE";
    case "divine_shield":
      return "DIVINE";
    default:
      return "ALIVE";
  }
}

export function TokenCard({ tokenId }: { tokenId: bigint }) {
  const { metadata, loading, error } = useTokenMetadata(tokenId);
  const state = metadata ? readTokenState(metadata) : null;

  return (
    <Link
      href={`/token/${tokenId.toString()}`}
      className="group block"
      prefetch={false}
    >
      <div className="relative">
        {loading || !metadata ? (
          <div className="aspect-square w-full bg-cream pixel-border flex items-center justify-center text-muted heading-pixel text-[10px]">
            loading…
          </div>
        ) : error ? (
          <div className="aspect-square w-full bg-cream pixel-border flex items-center justify-center text-blood text-xs px-2 text-center">
            {error}
          </div>
        ) : (
          <SvgFrame
            svg={metadata.svg}
            state={state ? stateLabel(state) : undefined}
            ariaLabel={metadata.name}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between heading-pixel text-[10px]">
        <span className="text-ink">#{tokenId.toString()}</span>
        <span className="text-rune group-hover:text-blood transition-colors">
          view →
        </span>
      </div>
    </Link>
  );
}
