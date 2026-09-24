import type { PlatformId } from "./platform-status";

type PlatformBrandIconProps = {
  platform: PlatformId;
};

const sharedSvgProps = {
  "aria-hidden": true,
  focusable: false,
  viewBox: "0 0 24 24",
} as const;

export default function PlatformBrandIcon({ platform }: PlatformBrandIconProps) {
  return (
    <span className={`platform-card-icon platform-card-icon-${platform}`} aria-hidden="true">
      {platform === "tiktok" && (
        <svg {...sharedSvgProps}>
          <path className="tiktok-shadow-cyan" d="M14.2 3v10.2a4.7 4.7 0 1 1-4-4.65v2.7a2 2 0 1 0 1.3 1.88V3h2.7Z" />
          <path className="tiktok-shadow-pink" d="M15.6 3.2c.35 2.05 1.55 3.3 3.65 3.7v2.75a7.15 7.15 0 0 1-3.65-1.08V3.2Z" />
          <path className="tiktok-mark" d="M14.9 2.5c.35 2.05 1.55 3.3 3.65 3.7v2.75a7.15 7.15 0 0 1-3.65-1.08v5.02a4.7 4.7 0 1 1-4-4.65v2.7a2 2 0 1 0 1.3 1.88V2.5h2.7Z" />
        </svg>
      )}
      {platform === "instagram" && (
        <svg {...sharedSvgProps}>
          <defs>
            <linearGradient id="instagram-card-gradient" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFD600" />
              <stop offset="0.42" stopColor="#FF3A67" />
              <stop offset="1" stopColor="#A727D4" />
            </linearGradient>
          </defs>
          <rect x="3" y="3" width="18" height="18" rx="5.2" fill="none" stroke="url(#instagram-card-gradient)" strokeWidth="2.2" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="url(#instagram-card-gradient)" strokeWidth="2.2" />
          <circle cx="17.4" cy="6.7" r="1.25" fill="#E8468A" />
        </svg>
      )}
      {platform === "facebook" && (
        <svg {...sharedSvgProps}>
          <circle cx="12" cy="12" r="10" fill="#1877F2" />
          <path fill="#fff" d="M13.6 20v-7h2.45l.37-2.85H13.6V8.33c0-.82.23-1.38 1.41-1.38h1.5V4.41c-.26-.03-1.15-.11-2.19-.11-2.17 0-3.66 1.33-3.66 3.76v2.09H8.2V13h2.46v7h2.94Z" />
        </svg>
      )}
      {platform === "reddit" && (
        <svg {...sharedSvgProps}>
          <circle cx="12" cy="12" r="10" fill="#FF4500" />
          <path fill="#fff" d="M18.55 10.2a2.15 2.15 0 0 0-3.58-.92 8.65 8.65 0 0 0-2.28-.63l.48-2.28 1.58.34a1.6 1.6 0 1 0 .18-.86l-2-.43a.45.45 0 0 0-.53.35l-.6 2.8a8.8 8.8 0 0 0-2.75.7 2.15 2.15 0 0 0-3.6.93 2.1 2.1 0 0 0 .53 3.78v.35c0 3.13 2.7 5.67 6.02 5.67s6.02-2.54 6.02-5.67v-.35a2.1 2.1 0 0 0 .53-3.78Zm-9.4 3.22a1.08 1.08 0 1 1 0-2.16 1.08 1.08 0 0 1 0 2.16Zm5.72 3.37c-.83.83-2.4.9-2.87.9-.48 0-2.05-.07-2.88-.9a.42.42 0 0 1 .6-.6c.52.52 1.63.66 2.28.66.64 0 1.75-.14 2.27-.66a.42.42 0 1 1 .6.6Zm-.02-3.37a1.08 1.08 0 1 1 0-2.16 1.08 1.08 0 0 1 0 2.16Z" />
        </svg>
      )}
      {platform === "x" && (
        <svg {...sharedSvgProps}>
          <circle cx="12" cy="12" r="10" fill="#050505" />
          <path fill="#fff" d="M6.45 6h3.43l2.8 3.75L15.96 6h1.58l-4.13 4.93L17.8 18h-3.42l-3.08-4.13L7.84 18H6.25l4.32-5.31L6.45 6Zm2.76 1.13H8.7l6.34 9.74h.52L9.21 7.13Z" />
        </svg>
      )}
    </span>
  );
}
