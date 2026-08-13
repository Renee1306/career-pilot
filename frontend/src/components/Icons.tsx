/** Inline SVG icons, shared by the top nav, landing page and dashboard.
 *  Deliberately not an icon package - same "no new frontend dependency"
 *  precedent as the rest of this codebase. Every icon inherits `currentColor`
 *  and sizes off the `size` prop so it can sit in any coloured surface. */

interface IconProps {
  size?: number;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function IconCompass({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8" />
    </svg>
  );
}

export function IconSearch({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function IconBriefcase({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export function IconDocument({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

export function IconGrid({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconSparkle({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M18.5 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" />
    </svg>
  );
}

export function IconChart({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="4" y1="20" x2="4" y2="12" />
      <line x1="10" y1="20" x2="10" y2="4" />
      <line x1="16" y1="20" x2="16" y2="9" />
      <line x1="22" y1="20" x2="22" y2="15" />
    </svg>
  );
}

export function IconCalendar({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

export function IconMail({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

export function IconChat({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
    </svg>
  );
}

export function IconTarget({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
    </svg>
  );
}

export function IconCheck({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={3}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconArrowRight({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}

export function IconArrowUpRight({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="8 7 17 7 17 16" />
    </svg>
  );
}

export function IconPlus({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconTrophy({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v1a4 4 0 0 0 3 3.9M17 6h3v1a4 4 0 0 1-3 3.9" />
      <line x1="12" y1="14" x2="12" y2="18" />
      <line x1="8" y1="20" x2="16" y2="20" />
    </svg>
  );
}

/** Brand marks for OAuth buttons - full-colour/filled rather than the stroke style above,
 *  since these need to stay recognizable as the provider's actual logo. */

export function IconGoogle({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20c11.045 0 20-8.955 20-20 0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C40.971 35.205 44 30 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export function IconGithub({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.11-.02-2.01-3.2.7-3.88-1.36-3.88-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.43-2.69 5.41-5.25 5.7.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.66.79.55C20.71 21.39 24 17.08 24 12 24 5.73 18.27.5 12 .5z" />
    </svg>
  );
}

export function IconGlobe({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
    </svg>
  );
}
