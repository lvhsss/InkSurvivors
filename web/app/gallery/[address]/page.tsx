import type { Address } from "viem";
import { isAddress } from "viem";

import { Header } from "@/components/Header";
import { GalleryGrid } from "./GalleryGrid";

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const owner = address;
  const valid = isAddress(owner);
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 flex-1">
        <header className="mb-6">
          <p className="heading-pixel text-[10px] tracking-widest text-[#00e5ff]">
            GALLERY
          </p>
          <h1 className="mt-2 heading-pixel text-xl sm:text-2xl text-white break-all">
            {owner}
          </h1>
          <p className="mt-2 text-white/60 text-xl font-mono">
            All tokens held by this address, rendered directly from{" "}
            <code className="text-[#00e5ff]">tokenURI()</code>.
          </p>
        </header>

        {valid ? (
          <GalleryGrid owner={owner as Address} />
        ) : (
          <div className="border border-[#ff3366] bg-[#ff3366]/10 p-4 text-[#ff3366] text-xl font-mono">
            Not a valid 0x address.
          </div>
        )}
      </main>
    </div>
  );
}
