import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ReactNode } from "react";
import Providers from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuizMasters India",
  description:
    "India's premium real-money quiz arena — compete, win, and conquer.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0B0D19",
};

interface RootLayoutProps {
  children: ReactNode;
}

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className="
          min-h-screen w-full
          font-sans antialiased
          text-white
          bg-[#0B0D19]
          [font-feature-settings:'cv11','ss01']
          [-webkit-font-smoothing:antialiased]
          [-moz-osx-font-smoothing:grayscale]
        "
      >
        {/* Desktop ambient backdrop glow */}
        <div
          aria-hidden
          className="
            pointer-events-none fixed inset-0 -z-10
            bg-[radial-gradient(ellipse_at_top,_rgba(56,72,255,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(16,185,129,0.10),_transparent_60%)]
          "
        />
        <div
          aria-hidden
          className="
            pointer-events-none fixed inset-0 -z-10
            bg-[linear-gradient(120deg,_rgba(37,99,235,0.06),_rgba(220,38,38,0.05)_35%,_rgba(245,158,11,0.05)_65%,_rgba(16,185,129,0.06))]
          "
        />

        {/* Centered mobile-first phone frame for desktop monitors */}
        <main className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
          {/* Neon indigo halo around the phone frame */}
          <div
            aria-hidden
            className="
              pointer-events-none absolute inset-0 -z-10
              rounded-[2rem]
              shadow-[0_0_80px_-10px_rgba(79,70,229,0.55),0_0_140px_-20px_rgba(37,99,235,0.45)]
              ring-1 ring-white/5
              bg-[#0B0D19]
            "
          />
          {/* Gradient brand border accent */}
          <div
            aria-hidden
            className="
              pointer-events-none absolute inset-0 -z-10
              rounded-[2rem] p-[1px]
              bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)]
              opacity-30
              [mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)]
              [mask-composite:exclude]
            "
          />

          <Providers>
            <div className="relative flex min-h-screen w-full flex-col overflow-hidden rounded-[2rem] bg-[#0B0D19]">
              {children}
            </div>
          </Providers>
        </main>
      </body>
    </html>
  );
};

export default RootLayout;
