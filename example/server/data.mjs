/**
 * Deterministic in-memory stock universe.
 *
 * Seeded so every restart produces the same symbols and the README/screenshots
 * stay honest; only the live price tick moves after boot.
 */

const SECTORS = [
  'Technology',
  'Financials',
  'Health Care',
  'Energy',
  'Consumer Discretionary',
  'Consumer Staples',
  'Industrials',
  'Utilities',
  'Real Estate',
  'Materials',
  'Communication Services',
];

const EXCHANGES = ['NASDAQ', 'NYSE'];
const RATINGS = ['BUY', 'HOLD', 'SELL'];

const NAME_HEAD = [
  'Northwind', 'Contoso', 'Aperture', 'Cyberdyne', 'Initech', 'Umbrella',
  'Stark', 'Wayne', 'Tyrell', 'Soylent', 'Massive', 'Vandelay', 'Wonka',
  'Gringotts', 'Duff', 'Globex', 'Hooli', 'Pied Piper', 'Prestige',
  'Blue Sun', 'Weyland', 'Abstergo', 'Oscorp', 'Virtucon', 'Nakatomi',
];

const NAME_TAIL = [
  'Holdings', 'Industries', 'Systems', 'Labs', 'Energy', 'Capital',
  'Pharma', 'Motors', 'Networks', 'Foods', 'Materials', 'Realty',
  'Bancorp', 'Utilities', 'Media', 'Robotics', 'Dynamics', 'Partners',
];

/** mulberry32 — tiny seeded PRNG, so the universe is reproducible. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n, dp = 2) => Number(n.toFixed(dp));

function makeSymbol(random, taken) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (;;) {
    const length = random() < 0.35 ? 3 : 4;
    let symbol = '';
    for (let i = 0; i < length; i += 1) {
      symbol += letters[Math.floor(random() * letters.length)];
    }
    if (!taken.has(symbol)) {
      taken.add(symbol);
      return symbol;
    }
  }
}

export function buildUniverse(count = 480) {
  const random = rng(20260906);
  const taken = new Set();
  const now = Date.now();

  return Array.from({ length: count }, (_, index) => {
    const symbol = makeSymbol(random, taken);
    const name =
      `${NAME_HEAD[Math.floor(random() * NAME_HEAD.length)]} ` +
      `${NAME_TAIL[Math.floor(random() * NAME_TAIL.length)]}`;

    const price = round(2 + random() * 780);
    const changePct = round((random() - 0.48) * 9);
    const change = round((price * changePct) / 100);

    return {
      symbol,
      name,
      sector: SECTORS[Math.floor(random() * SECTORS.length)],
      exchange: EXCHANGES[Math.floor(random() * EXCHANGES.length)],
      price,
      change,
      changePct,
      open: round(price - change),
      // 52-week band always contains the current price.
      high52: round(price * (1.02 + random() * 0.55)),
      low52: round(price * (0.45 + random() * 0.5)),
      volume: Math.floor(50_000 + random() * 42_000_000),
      marketCap: Math.floor(price * (1_000_000 + random() * 320_000_000)),
      // Left null ~8% of the time so the blank / notBlank filters have
      // something real to match on.
      peRatio: random() < 0.08 ? null : round(4 + random() * 60),
      dividendYield: random() < 0.35 ? 0 : round(random() * 6.5),
      lastTrade: new Date(now - Math.floor(random() * 21) * 86_400_000).toISOString(),
      rating: RATINGS[Math.floor(random() * RATINGS.length)],
      onWatchlist: random() < 0.18,
      analyst: random() < 0.5 ? 'M. Okonkwo' : 'R. Halvorsen',
      notes: '',
    };
  });
}

/**
 * Nudges every price by a fraction of a percent. Called on a timer so the
 * grid's refresh button visibly does something.
 */
export function tick(rows) {
  for (const row of rows) {
    const drift = (Math.random() - 0.5) * 0.014;
    const next = Math.max(0.5, row.price * (1 + drift));
    row.price = round(next);
    row.change = round(row.price - row.open);
    row.changePct = row.open ? round((row.change / row.open) * 100) : 0;
    row.high52 = round(Math.max(row.high52, row.price));
    row.low52 = round(Math.min(row.low52, row.price));
    row.lastTrade = new Date().toISOString();
  }
}

export { SECTORS, EXCHANGES, RATINGS };
