import { Header } from "@/components/Header";
import { TokenDetail } from "./TokenDetail";

export default async function TokenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = rawId.trim();
  const isValid = /^\d+$/.test(id);
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 flex-1">
        {isValid ? (
          <TokenDetail tokenId={BigInt(id)} />
        ) : (
          <div className="border border-[#ff3366] bg-[#ff3366]/10 p-4 text-[#ff3366] text-xl font-mono">
            Invalid token id.
          </div>
        )}
      </main>
    </div>
  );
}
