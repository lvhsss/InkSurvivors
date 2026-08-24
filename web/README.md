# Ink Survivors — web

Next.js 14 (App Router) + TypeScript + Tailwind + wagmi v2 + viem.
Public mint site, owner gallery, and per-token detail page for the Ink
Survivors collection. All artwork round-trips from the contract — no CDN.

> Note: the deployed Solidity contract class is `GraveShift` (the on-chain
> `name()` still returns `"GraveShift"`). The product brand is **Ink
> Survivors**; ABI filenames and internal identifiers keep the contract name
> for traceability with `contracts/`.

## Local dev

```sh
pnpm install
pnpm --filter web dev
```

The app runs in **mock mode** out of the box: a static `tokenURI` fixture set
powers the gallery and detail pages so the UI is fully usable without a
deployed contract. To switch to a live contract, copy `.env.example` to
`.env.local` and set `NEXT_PUBLIC_CONTRACT_ADDRESS`.

## ABI handoff (SolidityEng → FrontendEng)

`lib/abi/GraveShift.ts` is the real ABI from
`contracts/artifacts/GraveShift.abi.json` (typed `as const` so wagmi/viem can
infer return types). If the deployed contract diverges, regenerate the file by
re-exporting the `forge build` JSON. The dApp calls:

- constants: `MAX_SUPPLY`, `MAX_PER_WALLET`, `MAX_PER_TX`, `MINT_PRICE`,
  `INK_SIZE`, `BLOCK_THROTTLE`
- reads: `totalSupply()`, `inkSeedsLength()`, `inkSeeds(uint256)`,
  `mintedPerWallet(address)`, `balanceOf(address)`, `ownerOf(uint256)`,
  `tokenURI(uint256)`
- writes: `mint(uint256 quantity) payable` — always called with `quantity=1`
- events: `Transfer`, `InkClosed(uint256 indexed inkIndex, uint256 seed, uint256 mintedAt)`
- custom errors: `BlockThrottle`, `WalletMintLimit`, `SupplyExhausted`,
  `WrongMintPrice`

The contract intentionally omits `tokensOfOwner`; `useTokensOf` reconstructs
ownership by replaying indexed `Transfer` logs. Set
`NEXT_PUBLIC_CONTRACT_DEPLOY_BLOCK` so the log scan starts at the deploy
block (otherwise the client scans from genesis, which most RPC providers cap).

## Pages

- `/` — hero, mint widget (auto-retry on `BlockThrottle`), ink progress.
- `/gallery/[address]` — owned tokens for a wallet, each rendered from
  `tokenURI`.
- `/token/[id]` — single token, traits parsed from metadata JSON, live mutation
  history from `InkClosed`.

## Verification

```sh
NODE_ENV=production pnpm --filter web build  # type-check + production build
pnpm --filter web typecheck                  # tsc only
```

`NODE_ENV=production` matters: Next.js 15 refuses to statically generate the
fallback error pages when `NODE_ENV=development` (or any non-standard value)
leaks into the build environment.
