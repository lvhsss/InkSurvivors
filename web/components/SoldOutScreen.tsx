"use client";

import { openseaCollectionUrl } from "@/lib/contract";

const TWITTER_URL = "https://twitter.com/InkSurvivors";

export function SoldOutScreen() {
  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4 text-white">
      <div className="border border-[#7132f5] px-3 py-1.5 heading-pixel text-[9px] tracking-widest text-[#7132f5]">
        10,000 / 10,000
      </div>

      <h1 className="mt-6 heading-pixel text-4xl sm:text-6xl md:text-8xl text-white leading-tight">
        MINTED OUT
      </h1>

      <p className="mt-6 max-w-xl text-white/70 text-lg sm:text-xl leading-snug font-mono">
        Every survivor has been minted. The chain keeps rolling every 1,000
        inks — the survivors that stayed alive are still on-chain forever.
      </p>

      <div className="mt-10 grid w-full max-w-md gap-3 sm:grid-cols-2">
        <a
          href={openseaCollectionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="heading-pixel text-[10px] sm:text-xs tracking-widest border border-[#7132f5] px-4 py-4 text-[#7132f5] hover:bg-[#7132f5] hover:text-[#0a0a0a] transition-none"
        >
          VIEW ON OPENSEA
        </a>
        <a
          href={TWITTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="heading-pixel text-[10px] sm:text-xs tracking-widest border border-white/20 px-4 py-4 text-white/80 hover:text-white hover:border-white transition-none"
        >
          @INKSURVIVORS
        </a>
      </div>
    </section>
  );
}
