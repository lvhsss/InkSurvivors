import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./Providers";

export const metadata: Metadata = {
  title: "InkSurvivors",
  description:
    "On-chain pixel survivors. Every 1,000 mints, the chain decides who lives, who graves, who ascends.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
