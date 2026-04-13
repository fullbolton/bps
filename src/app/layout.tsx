import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
