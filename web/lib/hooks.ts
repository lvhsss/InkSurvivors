"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWatchContractEvent,
} from "wagmi";

import {
  contractAddress,
  inkSurvivorsAbi,
  inkSurvivorsConstants,
  isContractLive,
} from "./contract";
import { parseTokenURI, type TokenMetadata } from "./tokenURI";

const baseContract = contractAddress
  ? ({ address: contractAddress, abi: inkSurvivorsAbi } as const)
  : null;

const DEPLOY_BLOCK = (() => {
  const raw = (process.env.NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK ?? "").trim();
  if (!raw) return undefined;
  try {
    return BigInt(raw);
  } catch {
    return undefined;
  }
})();

export function useChainStats() {
  const enabled = isContractLive && !!baseContract;

  const reads = useReadContracts({
    contracts: enabled
      ? [
          { ...baseContract!, functionName: "totalSupply" },
          { ...baseContract!, functionName: "inkSeedsLength" },
        ]
      : [],
    query: { enabled, refetchInterval: 4_000 },
  });

  useWatchContractEvent({
    address: contractAddress ?? undefined,
    abi: inkSurvivorsAbi,
    eventName: "Transfer",
    enabled,
    onLogs: () => reads.refetch(),
  });

  useWatchContractEvent({
    address: contractAddress ?? undefined,
    abi: inkSurvivorsAbi,
    eventName: "InkClosed",
    enabled,
    onLogs: () => reads.refetch(),
  });

  if (!enabled) {
    return {
      totalSupply: 0n,
      inkCount: 0n,
      isLoading: false,
      isError: false,
    };
  }

  const [totalRes, inkRes] = reads.data ?? [];
  return {
    totalSupply: (totalRes?.result as bigint | undefined) ?? 0n,
    inkCount: (inkRes?.result as bigint | undefined) ?? 0n,
    isLoading: reads.isLoading,
    isError: reads.isError,
  };
}

export function useWalletAllowance() {
  const { address } = useAccount();
  const enabled = isContractLive && !!baseContract && !!address;
  const read = useReadContract({
    address: contractAddress ?? undefined,
    abi: inkSurvivorsAbi,
    functionName: "mintedPerWallet",
    args: address ? [address] : undefined,
    query: { enabled, refetchInterval: 4_000 },
  });

  const minted = useMemo<bigint>(
    () => (read.data as bigint | undefined) ?? 0n,
    [read.data],
  );

  const remaining = inkSurvivorsConstants.MAX_PER_WALLET - minted;
  return {
    minted,
    remaining: remaining < 0n ? 0n : remaining,
    refetch: read.refetch,
    isLoading: read.isLoading,
  };
}

/**
 * Enumerate the tokens currently owned by `owner` by replaying Transfer logs.
 * The deployed InkSurvivors contract intentionally does not ship an O(n)
 * `tokensOfOwner` getter, so we reconstruct ownership client-side from the
 * indexed Transfer event stream and reconcile inbound/outbound transfers in
 * (blockNumber, logIndex) order.
 */
export function useTokensOf(owner?: Address) {
  const client = usePublicClient();
  const [state, setState] = useState<{
    data: bigint[];
    isLoading: boolean;
    isError: boolean;
  }>(() => ({
    data: [],
    isLoading: isContractLive,
    isError: false,
  }));

  const fetchTokens = useCallback(async () => {
    if (!isContractLive || !owner || !client || !contractAddress) {
      setState({ data: [], isLoading: false, isError: false });
      return;
    }
    setState((prev) => ({ ...prev, isLoading: true, isError: false }));
    try {
      const transferEvent = inkSurvivorsAbi.find(
        (item) => item.type === "event" && item.name === "Transfer",
      );
      if (!transferEvent) throw new Error("Transfer event missing from ABI");
      const [incoming, outgoing] = await Promise.all([
        client.getLogs({
          address: contractAddress,
          event: transferEvent,
          args: { to: owner },
          fromBlock: DEPLOY_BLOCK ?? 0n,
          toBlock: "latest",
        }),
        client.getLogs({
          address: contractAddress,
          event: transferEvent,
          args: { from: owner },
          fromBlock: DEPLOY_BLOCK ?? 0n,
          toBlock: "latest",
        }),
      ]);

      type LogLike = {
        blockNumber: bigint | null;
        logIndex: number | null;
        args: { tokenId?: bigint; to?: Address };
      };
      const all = [
        ...(incoming as unknown as LogLike[]),
        ...(outgoing as unknown as LogLike[]),
      ];
      all.sort((a, b) => {
        const bn = (a.blockNumber ?? 0n) - (b.blockNumber ?? 0n);
        if (bn < 0n) return -1;
        if (bn > 0n) return 1;
        return (a.logIndex ?? 0) - (b.logIndex ?? 0);
      });

      const held = new Set<string>();
      for (const log of all) {
        const tokenId = log.args.tokenId;
        if (tokenId === undefined) continue;
        const key = tokenId.toString();
        const wentTo = log.args.to;
        if (wentTo && wentTo.toLowerCase() === owner.toLowerCase()) {
          held.add(key);
        } else {
          held.delete(key);
        }
      }

      const ids = Array.from(held)
        .map((s) => BigInt(s))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      setState({ data: ids, isLoading: false, isError: false });
    } catch {
      setState({ data: [], isLoading: false, isError: true });
    }
  }, [client, owner]);

  useEffect(() => {
    void fetchTokens();
  }, [fetchTokens]);

  useWatchContractEvent({
    address: contractAddress ?? undefined,
    abi: inkSurvivorsAbi,
    eventName: "Transfer",
    enabled: isContractLive && !!contractAddress && !!owner,
    args: owner ? { to: owner } : undefined,
    onLogs: () => {
      void fetchTokens();
    },
  });

  useWatchContractEvent({
    address: contractAddress ?? undefined,
    abi: inkSurvivorsAbi,
    eventName: "Transfer",
    enabled: isContractLive && !!contractAddress && !!owner,
    args: owner ? { from: owner } : undefined,
    onLogs: () => {
      void fetchTokens();
    },
  });

  return state;
}

export function useTokenMetadata(tokenId: bigint | undefined) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    metadata: TokenMetadata | null;
  }>({ loading: false, error: null, metadata: null });

  const read = useReadContract({
    address: contractAddress ?? undefined,
    abi: inkSurvivorsAbi,
    functionName: "tokenURI",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isContractLive && tokenId !== undefined },
  });

  useEffect(() => {
    if (tokenId === undefined) {
      setState({ loading: false, error: null, metadata: null });
      return;
    }
    try {
      const uri = read.data as string | undefined;
      if (!uri) {
        if (read.isError) {
          setState({
            loading: false,
            error: "Failed to read tokenURI from chain.",
            metadata: null,
          });
        } else {
          setState((s) => ({ ...s, loading: read.isLoading, error: null }));
        }
        return;
      }
      const metadata = parseTokenURI(uri);
      setState({ loading: false, error: null, metadata });
    } catch (err) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
        metadata: null,
      });
    }
  }, [tokenId, read.data, read.isLoading, read.isError]);

  return state;
}
