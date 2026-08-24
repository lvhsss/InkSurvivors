"use client";

import { inkSurvivorsConstants } from "@/lib/contract";
import { useChainStats } from "@/lib/hooks";

function formatBigInt(n: bigint) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function InkProgress() {
  const { totalSupply, inkCount } = useChainStats();
  const { INK_SIZE, MAX_SUPPLY } = inkSurvivorsConstants;
  const intoInk = totalSupply % INK_SIZE;
  const remaining = INK_SIZE - intoInk;
  const pct = Number((intoInk * 1000n) / INK_SIZE) / 10;
  const currentInk = (totalSupply / INK_SIZE) + 1n;
  const closed = inkCount;

  return (
    <section className="grid gap-px sm:grid-cols-2 bg-white/15 border border-white/15">
      <div className="bg-[#0b0c0d] p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <span className="heading-pixel text-[10px] tracking-widest text-white/50 uppercase">
            current roll
          </span>
          <span className="heading-pixel text-[10px] text-[#7132f5]">
            {formatBigInt(closed)} closed
          </span>
        </div>
        <div className="mt-3 heading-pixel text-3xl sm:text-4xl text-white">
          R{currentInk.toString().padStart(2, "0")}
        </div>
        <div className="mt-3 text-white/70 text-lg leading-snug font-mono">
          next roll closes in{" "}
          <span className="text-[#3f00c3]">{formatBigInt(remaining)}</span> mints
        </div>
        <div className="mt-4 h-2 w-full bg-white/10 border border-white/15 overflow-hidden">
          <div
            className="h-full bg-[#7132f5] transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
      </div>

      <div className="bg-[#0a0a0a] p-5 sm:p-6">
        <div className="heading-pixel text-[10px] tracking-widest text-white/50 uppercase">
          total minted
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="heading-pixel text-3xl sm:text-4xl text-white">
            {formatBigInt(totalSupply)}
          </span>
          <span className="text-white/40 text-xl font-mono">
            / {formatBigInt(MAX_SUPPLY)}
          </span>
        </div>
        <div className="mt-3 text-white/70 text-lg font-mono">
          {totalSupply >= MAX_SUPPLY ? (
            <span className="text-[#ff3366] heading-pixel text-[10px]">
              SOLD OUT
            </span>
          ) : (
            <>price · 0.00005 eth + gas · 5 per tx · 5 per wallet</>
          )}
        </div>
      </div>
    </section>
  );
}
