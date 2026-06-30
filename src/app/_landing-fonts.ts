// Fonts scoped to the public landing page only (Precision Monolith look:
// Archivo headings + Public Sans body). Exposed as CSS variables and applied
// to the landing root wrapper so the authenticated app (its own theme) is
// untouched.
import { Archivo, Public_Sans } from "next/font/google";

export const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

export const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});
