// Fonts scoped to the public landing page only (Precision Monolith look:
// Archivo headings + Public Sans body). Exposed as CSS variables and applied
// to the landing root wrapper so the authenticated app (its own theme) is
// untouched.
import localFont from "next/font/local";

export const archivo = localFont({
  src: "./fonts/archivo.woff2",
  weight: "100 900",
  variable: "--font-archivo",
  display: "swap",
});

export const publicSans = localFont({
  src: "./fonts/public-sans.woff2",
  weight: "100 900",
  variable: "--font-public-sans",
  display: "swap",
});
