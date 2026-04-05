import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BPS — Partner Staff",
  description: "İç ofis operasyon yönetim arayüzü",
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
