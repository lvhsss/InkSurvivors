// web/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        cream: "var(--cream)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        edge: "var(--edge)",
        rune: "var(--rune)",
        runeDeep: "var(--runeDeep)",
        blood: "var(--blood)",
        gold: "var(--gold)",
        sky: "var(--sky)",
        artbg: "var(--artbg)",
        bg: "var(--bg)",
        fg: "var(--fg)",
        accent: "var(--accent)",
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
        mono: ['"VT323"', "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;