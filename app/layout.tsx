import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TickerChart Live — Market Movers",
  description:
    "Live top gainers and losers across TickerChart markets (EGY, TAD, DFM, ADX, KSE, DSM, FRX).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
