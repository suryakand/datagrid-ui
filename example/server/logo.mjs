/**
 * Deterministic SVG company logos.
 *
 * Served as real files over HTTP rather than inlined as data URIs, so the
 * images-in-rows example exercises what a production grid actually does:
 * hundreds of <img> requests, lazy loading, and a fallback when one 404s.
 */

const PALETTE = [
  ['#465fff', '#7592ff'], ['#0ea5e9', '#38bdf8'], ['#10b981', '#34d399'],
  ['#f59e0b', '#fbbf24'], ['#ef4444', '#f87171'], ['#8b5cf6', '#a78bfa'],
  ['#ec4899', '#f472b6'], ['#14b8a6', '#2dd4bf'], ['#f97316', '#fb923c'],
  ['#6366f1', '#818cf8'],
];

/* Same shape family for the same symbol on every request. */
function hash(text) {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) {
    value = (value * 31 + text.charCodeAt(i)) >>> 0;
  }
  return value;
}

export function logoSvg(symbol) {
  const seed = hash(symbol);
  const [from, to] = PALETTE[seed % PALETTE.length];
  const initials = symbol.slice(0, 2);
  const shape = seed % 3;

  const mark =
    shape === 0
      ? '<circle cx="32" cy="32" r="30" fill="url(#g)"/>'
      : shape === 1
        ? '<rect x="2" y="2" width="60" height="60" rx="16" fill="url(#g)"/>'
        : '<path d="M32 2 62 32 32 62 2 32Z" fill="url(#g)"/>';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${symbol}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
  </linearGradient></defs>
  ${mark}
  <text x="32" y="41" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="24" font-weight="700" fill="#fff">${initials}</text>
</svg>`;
}

/** Tiny monochrome avatar for the covering-analyst column. */
export function avatarSvg(name) {
  const seed = hash(name);
  const hue = seed % 360;
  const initials = name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40" role="img" aria-label="${name}">
  <circle cx="20" cy="20" r="20" fill="hsl(${hue} 65% 88%)"/>
  <text x="20" y="26" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="15" font-weight="600" fill="hsl(${hue} 55% 30%)">${initials}</text>
</svg>`;
}
