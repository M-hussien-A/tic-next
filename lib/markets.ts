import type { MarketCode } from "./types";

export const MARKETS: { code: MarketCode; label: string }[] = [
  { code: "EGY", label: "Egypt (EGX)" },
  { code: "TAD", label: "Saudi (Tadawul)" },
  { code: "DFM", label: "Dubai (DFM)" },
  { code: "ADX", label: "Abu Dhabi (ADX)" },
  { code: "KSE", label: "Kuwait (KSE)" },
  { code: "DSM", label: "Qatar (DSM)" },
  { code: "FRX", label: "FX / Forex" },
];

export const DEFAULT_MARKET: MarketCode = "EGY";
