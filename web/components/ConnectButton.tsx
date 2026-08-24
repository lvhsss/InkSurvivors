"use client";

// `<w3m-button />` is the Web3Modal v5 custom element. It renders a connect
// button when no wallet is present and a wallet badge once connected, opening
// the unified modal (MetaMask / Coinbase Wallet / WalletConnect mobile / etc).
export function ConnectButton() {
  return <w3m-button balance="hide" size="sm" />;
}
