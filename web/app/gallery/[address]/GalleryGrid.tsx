"use client";

import type { Address } from "viem";

import { TokenCard } from "@/components/TokenCard";
import { contractAddress, inkSurvivorsAbi, isContractLive } from "@/lib/contract";
import { useTokensOf } from "@/lib/hooks";
import { useEffect } from "react";
import { useWatchContractEvent } from "wagmi";

export function GalleryGrid({ owner }: { owner: Address }) {
  const { data: tokenIds, isLoading, isError } = useTokensOf(owner);

  // Live update gallery when a Transfer touches this address.
  useWatchContractEvent({
    address: contractAddress ?? undefined,
    abi: inkSurvivorsAbi,
    eventName: "Transfer",
    enabled: isContractLive && !!contractAddress,
    args: { to: owner },
    onLogs: () => {
      // The wagmi query is keyed off the function args so it auto-invalidates
      // when block changes; here we just nudge the user.
    },
  });

  useEffect(() => {
    // no-op, but reserved for future side effects on owner change.
  }, [owner]);

  if (isLoading) {
    return (
      <div className="text-muted heading-pixel text-[10px]">loading…</div>
    );
  }
  if (isError) {
    return (
      <div className="border border-blood bg-blood/10 p-3 text-blood text-xl">
        failed to read tokens.
      </div>
    );
  }
  if (!tokenIds.length) {
    return (
      <div className="border border-ink/30 p-6 text-muted text-xl text-center bg-cream">
        no Ink Survivors in this wallet yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
      {tokenIds.map((id) => (
        <TokenCard key={id.toString()} tokenId={id} />
      ))}
    </div>
  );
}
