import { useState } from 'react';

/**
 * An <img> in a virtualized grid needs three things the plain tag does not
 * give you: a reserved box so rows never reflow while images arrive, native
 * lazy loading so scrolling does not fire hundreds of requests at once, and a
 * fallback for the ones that fail.
 */
export function CompanyLogo({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        style={{ width: size, height: size }}
        className="grid shrink-0 place-items-center rounded-md bg-gray-200 text-[10px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300"
      >
        {symbol.slice(0, 2)}
      </span>
    );
  }

  return (
    // #region logo-img
    <img
      src={`/api/logo/${symbol}.svg`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      // The explicit box is what keeps the row height stable before the
      // image has loaded.
      style={{ width: size, height: size }}
      className="shrink-0 rounded-md bg-gray-100 object-cover dark:bg-gray-800"
    />
    // #endregion
  );
}

export function AnalystAvatar({ name, size = 24 }: { name: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        style={{ width: size, height: size }}
        className="grid shrink-0 place-items-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300"
      >
        {name.slice(0, 1)}
      </span>
    );
  }

  return (
    <img
      src={`/api/avatar.svg?name=${encodeURIComponent(name)}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full"
    />
  );
}
