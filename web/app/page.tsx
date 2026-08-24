import { Header } from "@/components/Header";
import { InkProgress } from "@/components/InkProgress";
import { HomeSwitcher } from "@/components/HomeSwitcher";
import { MintWidget } from "@/components/MintWidget";
import { openseaCollectionUrl } from "@/lib/contract";

const TWITTER_URL = "https://twitter.com/EpochSurvivors";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#101112] text-white selection:bg-[#7132f5] selection:text-[#0a0a0a]">
      <Header />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6">
        <HomeSwitcher>
          {/* Hero + Mint */}
          <section className="py-16 sm:py-24 grid md:grid-cols-[1.2fr_1fr] gap-10 md:gap-16 items-start">
            <div className="flex flex-col">
              <div className="inline-block border border-[#7132f5] text-[#7132f5] px-3 py-1.5 heading-pixel text-[9px] tracking-widest w-fit mb-8">
                ROLL 0 IS COMING
              </div>

              <h1 className="heading-pixel text-3xl sm:text-4xl md:text-5xl leading-[1.3] text-white">
                THE FIRST 1,000 <br />
                <span className="text-[#7132f5]">WILL THINK</span> <br />
                <span className="text-white/60">THEY ARE SAFE.</span>
              </h1>

              <p className="mt-8 text-xl leading-relaxed text-white/70 max-w-lg font-mono">
                They are wrong. 10,000 supply. 1 survival rule. Every 1,000
                mints the chain rerolls every living survivor in one global
                block. No loops, no off-chain oracles, no upgrades. The math is
                final.
              </p>

              {/* Flat stats */}
              <div className="mt-12 grid grid-cols-3 gap-px bg-white/15 border border-white/15">
                <div className="bg-[#0a0a0a] p-5 sm:p-6 text-center">
                  <div className="heading-pixel text-xl text-[#3f00c3]">
                    30%
                  </div>
                  <div className="mt-3 text-xs tracking-widest text-white/50 uppercase">
                    die
                  </div>
                </div>
                <div className="bg-[#0a0a0a] p-5 sm:p-6 text-center">
                  <div className="heading-pixel text-xl text-[#7132f5]">
                    45%
                  </div>
                  <div className="mt-3 text-xs tracking-widest text-white/50 uppercase">
                    mutate
                  </div>
                </div>
                <div className="bg-[#0a0a0a] p-5 sm:p-6 text-center">
                  <div className="heading-pixel text-xl text-white">25%</div>
                  <div className="mt-3 text-xs tracking-widest text-white/50 uppercase">
                    survive
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <MintWidget />
              <a
                href={TWITTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ink Survivors on Twitter"
                className="heading-pixel text-[10px] sm:text-xs tracking-widest text-center border border-white/20 px-4 py-3 text-white/80 hover:text-[#7132f5] hover:border-[#7132f5] transition-none"
              >
                FOLLOW INKSURVIVORS ON TWITTER
              </a>
            </div>
          </section>

          <section className="pb-12">
            <InkProgress />
          </section>

          {/* Rule cards */}
          <section className="pb-16 sm:pb-24 border-t border-white/15 pt-12 sm:pt-16">
            <div className="grid sm:grid-cols-3 gap-px bg-white/15 border border-white/15">
              <div className="bg-[#0a0a0a] p-6 sm:p-8">
                <div className="heading-pixel text-[11px] text-[#7132f5] mb-5">
                  ALIVE ROLL
                </div>
                <p className="text-white/70 leading-relaxed font-mono">
                  30% sudden death → grave. Diminishing trait gains
                  45/30/15/5/1. Otherwise survive unchanged.
                </p>
              </div>

              <div className="bg-[#0a0a0a] p-6 sm:p-8">
                <div className="heading-pixel text-[11px] text-[#3f00c3] mb-5">
                  GRAVE ROLL
                </div>
                <p className="text-white/70 leading-relaxed font-mono">
                  5% necromancy → Zombie (only from grave, never direct). 95%
                  stay buried.
                </p>
              </div>

              <div className="bg-[#0a0a0a] p-6 sm:p-8">
                <div className="heading-pixel text-[11px] text-white mb-5">
                  ZOMBIE LOCK
                </div>
                <p className="text-white/70 leading-relaxed font-mono">
                  Exponentially weighted trait count, then permanently frozen.
                  Never mutates again.
                </p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="pb-16 sm:pb-24 flex flex-col items-center">
            <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
              <a
                href={TWITTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="heading-pixel text-[10px] tracking-widest border border-[#7132f5] px-6 sm:px-8 py-4 sm:py-5 text-[#7132f5] hover:bg-[#7132f5] hover:text-[#0a0a0a] transition-none"
              >
                FOLLOW INKSURVIVORS
              </a>
              <a
                href={openseaCollectionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="heading-pixel text-[10px] tracking-widest border border-white/20 px-6 sm:px-8 py-4 sm:py-5 text-white/70 hover:text-white hover:border-white transition-none"
              >
                OPENSEA
              </a>
            </div>
          </section>
        </HomeSwitcher>
      </main>

      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-6">
        <p className="text-white/50 text-sm sm:text-base leading-snug text-center font-mono">
          experimental on-chain art · unaudited · mints are final · you are responsible for the wallet you connect.
        </p>
      </div>

      <footer className="border-t border-white/15 py-10 sm:py-14 flex flex-col items-center justify-center">
        <div className="text-white/40 heading-pixel text-[9px] tracking-widest uppercase text-center px-4">
          ON-CHAIN ART · 10,000 SUPPLY · NO CDN
        </div>
      </footer>
    </div>
  );
}
