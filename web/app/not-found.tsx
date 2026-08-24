import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-[#0a0a0a] text-white">
      <div className="border border-[#7132f5] px-3 py-1.5 heading-pixel text-[9px] tracking-widest text-[#7132f5]">
        404
      </div>
      <h1 className="mt-6 heading-pixel text-4xl sm:text-6xl md:text-7xl text-white leading-tight">
        LOST IN THE CRYPT
      </h1>
      <p className="mt-6 max-w-md text-white/70 text-lg sm:text-xl font-mono">
        That page never made it past the roll.
      </p>
      <Link
        href="/"
        className="mt-10 heading-pixel text-[10px] sm:text-xs tracking-widest border border-[#7132f5] px-6 py-4 text-[#7132f5] hover:bg-[#7132f5] hover:text-[#0a0a0a] transition-none"
      >
        BACK TO MINT
      </Link>
    </div>
  );
}
