"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { WagmiProvider } from "wagmi";

import { wagmiConfig, wcProjectId } from "@/lib/wagmi";

const queryClient = new QueryClient();

let web3ModalInitialised = false;
function initWeb3ModalOnce() {
  if (web3ModalInitialised) return;
  web3ModalInitialised = true;
  createWeb3Modal({
    wagmiConfig,
    projectId: wcProjectId,
    themeMode: "dark",
    enableAnalytics: false,
  });
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initWeb3ModalOnce();
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
