import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NinaCal — 25 years of fire, one calendar",
  description:
    "NinaCal harmonizes NASA MODIS and VIIRS fire detections into one continuous burning-activity calendar for any region you draw.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "NinaCal — 25 years of fire, one calendar",
    description:
      "A harmonized 2000→today calendar of satellite fire detections, built on NASA FIRMS data.",
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
