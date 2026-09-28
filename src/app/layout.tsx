import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";

const geist = localFont({
  src: "./fonts/geist.woff2",
  weight: "100 900",
  variable: "--font-geist-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BPS — B2B Operasyon Platformu",
  description: "Hizmet firmalari icin firma portfoyu, sozlesme, gorev, evrak ve operasyon yonetimi platformu.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
