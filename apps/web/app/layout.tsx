import type { Metadata, Viewport } from "next";
import { COUNTRIES } from "@/lib/countries";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "NinaCal — 23 years of fire, one calendar",
  description:
    `NinaCal harmonizes Aqua/MODIS and Suomi-NPP/VIIRS detected hotspot-days into one 2003–2025 activity calendar for ${COUNTRIES.length} countries worldwide.`,
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "NinaCal — 23 years of fire, one calendar",
    description:
      `A harmonized 2003–2025 calendar of satellite detected hotspot-days for ${COUNTRIES.length} countries, built on NASA FIRMS data.`,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0a09",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
