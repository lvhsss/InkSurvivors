"use client";

import Link from "next/link";

import { ConnectButton } from "./ConnectButton";

const TWITTER_URL = "https://twitter.com/EpochSurvivors";

export function Header() {
  return (
    <header className="border-b border-white/15 bg-[#0b0c0d] sticky top-0 z-30">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 sm:px-6 py-4">
        <Link
          href="/"
          className="heading-pixel text-white text-[10px] sm:text-xs tracking-widest hover:text-[#7132f5] transition-none"
        >
          INK SURVIVORS
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href={TWITTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ink Survivors on Twitter"
            title="@InkSurvivors on Twitter"
            className="heading-pixel text-[9px] sm:text-[10px] tracking-widest border border-white/20 px-2 py-1 sm:px-3 sm:py-1.5 text-white/70 hover:text-[#7132f5] hover:border-[#7132f5] transition-none"
          >
            TWITTER
          </a>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
