import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
