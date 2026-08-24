"use client";

import dynamic from "next/dynamic";

// Dynamic-load `Web3Provider` with `ssr: false` so the Web3Modal/WalletConnect
// module tree (which references browser-only globals like `indexedDB` at module
// init time) never executes during Next.js's server-side prerender pass.
const Web3Provider = dynamic(
  () => import("../components/Web3Provider").then((m) => m.Web3Provider),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  return <Web3Provider>{children}</Web3Provider>;
}
