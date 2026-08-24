import { http } from "viem";
import { createConfig } from "wagmi";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

import { targetChain } from "./contract";

export const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "";

if (!wcProjectId) {
  throw new Error(
    "NEXT_PUBLIC_WC_PROJECT_ID is required. Set it in web/.env.local (see .env.example).",
  );
}

const metadata = {
  name: "Ink Survivors",
  description: "On-chain pixel survivors. 10,000 supply. Every 1,000 mints, the chain rerolls who lives.",
  url: "https://inksurvivors.xyz",
  icons: [],
};

const connectors = [
  injected({ shimDisconnect: true }),
  coinbaseWallet({ appName: metadata.name, appLogoUrl: metadata.icons[0] }),
  walletConnect({
    projectId: wcProjectId,
    metadata,
    showQrModal: false,
  }),
];

export const wagmiConfig = createConfig({
  chains: [targetChain],
  ssr: false,
  connectors,
  transports: {
    [targetChain.id]: http(),
  },
});