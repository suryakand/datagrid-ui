export type Rating = 'BUY' | 'HOLD' | 'SELL';

export interface Stock {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high52: number;
  low52: number;
  volume: number;
  marketCap: number;
  /** Null for companies with no meaningful earnings. */
  peRatio: number | null;
  dividendYield: number;
  /** ISO timestamp. */
  lastTrade: string;
  rating: Rating;
  onWatchlist: boolean;
  analyst: string;
  notes: string;
}
