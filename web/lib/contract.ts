import { defineChain } from "viem";
import type { Address } from "viem";
import { inkSurvivorsAbi } from "./abi/InkSurvivors";

// Ink Mainnet Configuration (Chain ID: 57073)
export const targetChain = defineChain({
  id: 57073,
  name: "Ink",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-gel.inkonchain.com"] },
    public: { http: ["https://rpc-gel.inkonchain.com"] },
  },
  blockExplorers: {
    default: { name: "Ink Explorer", url: "https://explorer.inkonchain.com" },
  },
});

export const INK_SURVIVORS_ADDRESS = "YOUR_MAINNET_CONTRACT_ADDRESS_HERE";

export const inkSurvivorsConstants = {
  MAX_SUPPLY: 10_000n,
  MAX_PER_WALLET: 5n,
  MAX_PER_TX: 5n,
  INK_SIZE: 1_000n,
  /** Mint price per token adjusted to 0.00005 ETH */
  MINT_PRICE_WEI: 50_000_000_000_000n,
} as const;

const ENV_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "").trim();
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const isHexAddress = (value: string): value is Address =>
  /^0x[a-fA-F0-9]{40}$/.test(value);

export const contractAddress: Address | null =
  ENV_ADDRESS && isHexAddress(ENV_ADDRESS) && ENV_ADDRESS.toLowerCase() !== ZERO_ADDRESS
    ? (ENV_ADDRESS as Address)
    : null;

export const isContractLive = contractAddress !== null;

export const inkSurvivorsContract = {
  address: contractAddress ?? ZERO_ADDRESS,
  abi: inkSurvivorsAbi,
} as const;

export const mintOpensAt: Date | null = (() => {
  const raw = (process.env.NEXT_PUBLIC_MINT_OPENS_AT ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
})();

// OpenSea Mainnet URL structure for Ink
export const openseaCollectionUrl = contractAddress
  ? `https://opensea.io/assets/ink/${contractAddress}`
  : "https://opensea.io";

export { inkSurvivorsAbi };