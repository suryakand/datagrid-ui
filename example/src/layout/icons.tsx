/* 16px stroke icons, sized by the parent's font-size. */

const base = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IconTable = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M9 9v11" />
  </svg>
);

export const IconImage = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m4 18 5-4 4 3 3-2 4 3" />
  </svg>
);

export const IconPulse = () => (
  <svg {...base}>
    <path d="M2 12h4l3-8 4 16 3-8h6" />
  </svg>
);

export const IconPalette = () => (
  <svg {...base}>
    <path d="M12 3a9 9 0 1 0 0 18c1.7 0 2-1.2 1.2-2-.8-.9-.5-2 .8-2H17a4 4 0 0 0 4-4c0-5-4-10-9-10Z" />
    <circle cx="8" cy="11" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="8" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="11" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconSun = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const IconMoon = () => (
  <svg {...base}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);

export const IconGithub = () => (
  <svg {...base}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-1-2.6c3-.3 6.2-1.5 6.2-6.7A5.2 5.2 0 0 0 19.9 5a4.9 4.9 0 0 0-.1-3.6s-1.1-.3-3.7 1.4a12.7 12.7 0 0 0-6.6 0C6.9 1.1 5.8 1.4 5.8 1.4A4.9 4.9 0 0 0 5.7 5a5.2 5.2 0 0 0-1.4 3.6c0 5.2 3.2 6.4 6.2 6.7a3.4 3.4 0 0 0-1 2.6V22" />
  </svg>
);

export const IconMenu = () => (
  <svg {...base}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
