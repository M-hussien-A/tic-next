export type MarketCode =
  | "EGY"
  | "TAD"
  | "DFM"
  | "ADX"
  | "KSE"
  | "DSM"
  | "FRX";

export interface MarketMover {
  symbol: string;
  market: string;
  name: string;
  price: number;
  changePercent: number;
  change: number;
  volume: number;
}

export interface LoginResponse {
  token: string;
}

export interface ApiError {
  error: string;
  status?: number;
}
