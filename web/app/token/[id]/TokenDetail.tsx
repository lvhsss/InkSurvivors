"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { useReadContract, useWatchContractEvent } from "wagmi";

import { SvgFrame } from "@/components/SvgFrame";
import { contractAddress, inkSurvivorsAbi, isContractLive } from "@/lib/contract";
import { useTokenMetadata } from "@/lib/hooks";
import { readTokenState, readTraits } from "@/lib/tokenURI";

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function TokenDetail({ tokenId }: { tokenId: bigint }) {
  const { metadata, loading, error } = useTokenMetadata(tokenId);

  const owner = useReadContract({
    address: contractAddress ?? undefined,
    abi: inkSurvivorsAbi,
    functionName: "ownerOf",
    args: [tokenId],
    query: { enabled: isContractLive && !!contractAddress },
  });

  type HistoryEvent =
    | { kind: "mint"; ink?: bigint; seed?: bigint }
    | { kind: "ink"; ink: bigint; seed: bigint };

  const [history, setHistory] = useState<HistoryEvent[]>(() => [{ kind: "mint" }]);

  useWatchContractEvent({
    address: contractAddress ?? undefined,
    abi: inkSurvivorsAbi,
    eventName: "InkClosed",
    enabled: isContractLive && !!contractAddress,
    onLogs: (logs) => {
      const next = logs.flatMap((log) => {
        const args = (log as unknown as {
          args: { inkIndex?: bigint; seed?: bigint };
        }).args;
        const ink = args?.inkIndex;
        const seed = args?.seed;
        if (ink === undefined || seed === undefined) return [];
        return [{ kind: "ink" as const, ink, seed }];
      });
      if (next.length) setHistory((prev) => [...prev, ...next]);
    },
  });

  // Reset history when token changes.
  useEffect(() => {
    setHistory((prev) =>
      prev.filter((e) => e.kind === "mint" || e.kind === "ink"),
    );
  }, [tokenId]);

  if (loading || !metadata) {
    return (
      <div className="text-muted heading-pixel text-[10px]">loading…</div>
    );
  }
  if (error) {
    return (
      <div className="border border-blood bg-blood/10 p-3 text-blood text-xl">
        {error}
      </div>
    );
  }

  const state = readTokenState(metadata);
  const traits = readTraits(metadata);
  const ownerAddress = owner.data as Address | undefined;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
      <div>
        <SvgFrame
          svg={metadata.svg}
          ariaLabel={metadata.name}
          className="max-w-md"
        />
        <p className="mt-3 text-muted text-lg break-all">
          sourced from <code className="text-rune">tokenURI()</code> ·{" "}
          {metadata.source.slice(0, 32)}…
        </p>
      </div>
      <div>
        <p className="heading-pixel text-[10px] text-rune">SURVIVOR</p>
        <h1 className="mt-1 heading-pixel text-2xl sm:text-3xl text-ink">
          {metadata.name}
        </h1>
        <p className="mt-3 text-ink/80 text-xl">{metadata.description}</p>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-xl">
          <div className="border border-ink/25 bg-paper p-2">
            <dt className="heading-pixel text-[8px] text-muted">state</dt>
            <dd className="text-ink uppercase">
              {state.replace("_", " ")}
            </dd>
          </div>
          <div className="border border-ink/25 bg-paper p-2">
            <dt className="heading-pixel text-[8px] text-muted">owner</dt>
            <dd className="text-ink">
              {ownerAddress ? shortAddress(ownerAddress) : "—"}
            </dd>
          </div>
        </dl>

        <section className="mt-5">
          <h2 className="heading-pixel text-xs text-rune mb-2">TRAITS</h2>
          {traits.length === 0 ? (
            <div className="text-muted text-xl">no traits (yet).</div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xl">
              {traits.map((t) => (
                <li
                  key={`${t.trait_type}-${t.value}`}
                  className="border border-ink/25 bg-paper p-2"
                >
                  <div className="heading-pixel text-[8px] text-muted">
                    {t.trait_type}
                  </div>
                  <div className="text-ink">{t.value}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5">
          <h2 className="heading-pixel text-xs text-rune mb-2">
            MUTATION HISTORY
          </h2>
          <ol className="space-y-1 text-xl">
            {history.map((event, idx) => (
              <li
                key={idx}
                className="border border-ink/20 px-2 py-1 text-ink/80 bg-paper"
              >
                {event.kind === "mint" ? (
                  <>minted into the chain</>
                ) : (
                  <>
                    ink {event.ink.toString()} closed · seed{" "}
                    <code className="text-rune">
                      0x{event.seed.toString(16).slice(0, 10)}…
                    </code>
                  </>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-muted text-lg">
            Past inks are derived on read; this list grows live as new
            InkClosed events fire.
          </p>
        </section>
      </div>
    </div>
  );
}
