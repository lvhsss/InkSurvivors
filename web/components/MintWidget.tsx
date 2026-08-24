"use client";

import { useEffect, useMemo, useState } from "react";
import { BaseError, ContractFunctionRevertedError } from "viem";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import {
  contractAddress,
  inkSurvivorsAbi,
  inkSurvivorsConstants,
  isContractLive,
  mintOpensAt,
  targetChain,
} from "@/lib/contract";
import { useChainStats, useWalletAllowance } from "@/lib/hooks";

const MAX_PER_TX_NUMBER = Number(inkSurvivorsConstants.MAX_PER_TX);
const MAX_PER_WALLET_NUMBER = Number(inkSurvivorsConstants.MAX_PER_WALLET);

const REVERT_BUCKETS = {
  sold_out: ["SupplyExhausted", "SoldOut"],
  wallet_cap: ["WalletMintLimit", "MaxPerWallet"],
  per_tx: ["QuantityExceedsTxLimit", "MaxPerTx"],
  bad_payment: ["WrongMintPrice", "WrongPrice"],
  bad_quantity: ["QuantityInvalid"],
} as const;

type ErrorKind = keyof typeof REVERT_BUCKETS | "rejected" | "other";

function matchesRevert(err: unknown, names: readonly string[]) {
  if (!err) return false;
  if (err instanceof BaseError) {
    const reverted = err.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    );
    if (reverted instanceof ContractFunctionRevertedError) {
      const data = reverted.data;
      if (data && names.includes(data.errorName)) return true;
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  return names.some((name) => new RegExp(name, "i").test(message));
}

function isUserRejection(err: unknown) {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  return /user rejected|user denied|rejected the request|cancelled by user/i.test(
    message,
  );
}

function classifyError(err: unknown): ErrorKind {
  if (!err) return "other";
  if (isUserRejection(err)) return "rejected";
  for (const [kind, names] of Object.entries(REVERT_BUCKETS)) {
    if (matchesRevert(err, names)) return kind as keyof typeof REVERT_BUCKETS;
  }
  return "other";
}

const ERROR_COPY: Record<ErrorKind, string> = {
  sold_out: "Minting failed — every grave is taken.",
  wallet_cap: "Minting failed — this wallet has reached its limit.",
  per_tx: "Minting failed — too many at once, try fewer.",
  bad_payment: "Minting failed — payment did not match the mint cost.",
  bad_quantity: "Minting failed — invalid quantity.",
  rejected: "Minting cancelled in the wallet.",
  other: "Minting failed — try again in a moment.",
};

function formatEth(wei: bigint) {
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function useMintGateCountdown() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!mintOpensAt) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  if (!mintOpensAt) return { open: true, msUntil: 0, label: "" };
  const msUntil = mintOpensAt.getTime() - now;
  return {
    open: msUntil <= 0,
    msUntil,
    label: formatCountdown(msUntil),
  };
}

export function MintWidget() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { totalSupply } = useChainStats();
  const { minted, remaining, refetch: refetchAllowance } = useWalletAllowance();
  const gate = useMintGateCountdown();

  const {
    writeContract,
    data: pendingHash,
    isPending: isMinting,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const receipt = useWaitForTransactionReceipt({
    hash: pendingHash,
    query: { enabled: !!pendingHash },
  });

  const [quantity, setQuantity] = useState(1);

  const remainingNumber = isConnected
    ? Number(remaining > BigInt(MAX_PER_TX_NUMBER) ? BigInt(MAX_PER_TX_NUMBER) : remaining)
    : MAX_PER_TX_NUMBER;
  const quantityCap = Math.max(1, Math.min(MAX_PER_TX_NUMBER, remainingNumber));

  useEffect(() => {
    if (quantity > quantityCap) setQuantity(quantityCap);
    if (quantity < 1) setQuantity(1);
  }, [quantity, quantityCap]);

  useEffect(() => {
    if (receipt.data?.status === "success") {
      refetchAllowance();
    }
  }, [receipt.data?.status, refetchAllowance]);

  const errorKind = useMemo<ErrorKind>(
    () => classifyError(writeError),
    [writeError],
  );
  const wrongChain = isConnected && chainId !== targetChain.id;
  const soldOut = totalSupply >= inkSurvivorsConstants.MAX_SUPPLY;
  const walletCapped = remaining <= 0n && isConnected;
  const inFlight = isMinting || receipt.isFetching || receipt.isLoading;
  const mintLive = isContractLive && gate.open;

  function submitMint() {
    if (!mintLive || !contractAddress) return;
    const q = Math.max(1, Math.min(quantityCap, quantity));
    resetWrite();
    writeContract({
      address: contractAddress,
      abi: inkSurvivorsAbi,
      functionName: "mint",
      args: [BigInt(q)],
      value: inkSurvivorsConstants.MINT_PRICE_WEI * BigInt(q),
    });
  }

  const buttonDisabled =
    !mintLive ||
    soldOut ||
    walletCapped ||
    inFlight ||
    (isConnected && wrongChain && isSwitching);

  const totalCostWei = inkSurvivorsConstants.MINT_PRICE_WEI * BigInt(quantity);
  const totalCostEth = formatEth(totalCostWei);

  let buttonLabel = `MINT ${quantity} · ${totalCostEth} ETH + GAS`;
  if (!gate.open) buttonLabel = `OPENS IN ${gate.label}`;
  else if (!isContractLive) buttonLabel = "DEPLOYING SOON";
  else if (!isConnected) buttonLabel = "CONNECT TO MINT";
  else if (soldOut) buttonLabel = "SOLD OUT";
  else if (walletCapped) buttonLabel = "WALLET MAXED";
  else if (wrongChain) buttonLabel = `SWITCH TO ${targetChain.name.toUpperCase()}`;
  else if (isMinting) buttonLabel = "CONFIRM IN WALLET…";
  else if (receipt.isLoading || receipt.isFetching)
    buttonLabel = "MINTING ON-CHAIN…";

  function handleClick() {
    if (!mintLive || !isConnected) return;
    if (wrongChain) {
      switchChain({ chainId: targetChain.id });
      return;
    }
    submitMint();
  }

  void address;

  const stepperDisabled = !mintLive || inFlight || soldOut || walletCapped;
  const errorMessage = writeError ? ERROR_COPY[errorKind] : null;

  return (
    <div className="border border-white/15 bg-[#0a0a0a] p-5 sm:p-6 text-white">
      <div className="flex items-center justify-between">
        <span className="heading-pixel text-[10px] text-white/50">mint card</span>
        <span className="heading-pixel text-[10px] text-[#7132f5]">
          {targetChain.name.toUpperCase()}
        </span>
      </div>
      <h2 className="mt-3 heading-pixel text-sm sm:text-lg text-white">
        ROLL THE INK
      </h2>
      <p className="mt-3 text-white/70 text-base sm:text-xl leading-snug font-mono">
        one mint, one fate. survive, stack a trait, or grave out — every 1,000
        mints the chain rerolls the living.
      </p>

      {!gate.open && (
        <div className="mt-4 border border-[#7132f5] bg-[#7132f5]/10 px-3 py-3 text-[#7132f5]">
          <div className="heading-pixel text-[9px] tracking-widest text-[#7132f5]/80">
            MINT OPENS IN
          </div>
          <div className="heading-pixel text-2xl sm:text-3xl mt-1 tabular-nums">
            {gate.label}
          </div>
        </div>
      )}

      <div className="mt-5 border border-white/15 bg-[#0a0a0a]">
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={stepperDisabled || quantity <= 1}
            aria-label="decrease quantity"
            className="heading-pixel text-sm w-12 sm:w-14 border-r border-white/15 text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-none"
          >
            −
          </button>
          <div className="flex-1 flex flex-col items-center justify-center px-2 py-2">
            <span className="heading-pixel text-[9px] text-white/50">
              quantity (max {quantityCap})
            </span>
            <input
              type="number"
              min={1}
              max={quantityCap}
              value={quantity}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isNaN(next)) return;
                setQuantity(Math.max(1, Math.min(quantityCap, Math.floor(next))));
              }}
              disabled={stepperDisabled}
              className="heading-pixel mt-1 w-full text-center bg-transparent text-xl text-white outline-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(quantityCap, q + 1))}
            disabled={stepperDisabled || quantity >= quantityCap}
            aria-label="increase quantity"
            className="heading-pixel text-sm w-12 sm:w-14 border-l border-white/15 text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-none"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={buttonDisabled || !isConnected}
        aria-disabled={buttonDisabled || !isConnected}
        className="mt-4 w-full heading-pixel text-xs sm:text-sm py-4 bg-[#7132f5] text-[#0a0a0a] border border-[#7132f5] hover:bg-white hover:border-white disabled:bg-white/10 disabled:text-white/30 disabled:border-white/15 disabled:cursor-not-allowed transition-none"
      >
        {buttonLabel}
      </button>

      <div className="mt-4 grid grid-cols-2 gap-px bg-white/15 border border-white/15">
        <div className="bg-[#0a0a0a] p-3">
          <div className="heading-pixel text-[8px] text-white/50">
            mints left (wallet cap)
          </div>
          <div className="mt-1 text-white font-mono text-xl">
            {isConnected ? `${remaining.toString()} / ${MAX_PER_WALLET_NUMBER}` : "—"}
          </div>
        </div>
        <div className="bg-[#0a0a0a] p-3">
          <div className="heading-pixel text-[8px] text-white/50">
            you minted (this wallet)
          </div>
          <div className="mt-1 text-white font-mono text-xl">
            {isConnected ? minted.toString() : "—"}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 border border-[#ff3366] bg-[#ff3366]/10 p-2 text-[#ff3366] text-lg break-words font-mono">
          {errorMessage}
        </div>
      )}

      {receipt.data?.status === "success" && (
        <div className="mt-4 border border-[#7132f5] bg-[#7132f5]/10 p-2 text-[#7132f5] text-lg break-words font-mono">
          minted — tx{" "}
          <a
            className="underline"
            href={`https://etherscan.io/tx/${receipt.data.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {receipt.data.transactionHash.slice(0, 10)}…
          </a>
          <span className="block mt-1 heading-pixel text-[9px] text-[#7132f5]/70">
            view on explorer →
          </span>
        </div>
      )}
    </div>
  );
}
