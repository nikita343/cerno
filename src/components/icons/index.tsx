/**
 * Icon set.
 *
 * The designs pulled nav glyphs from Iconify's `line-md` set over a CDN and the
 * rest from inline SVG. Both are replaced here by one local set so nothing is
 * fetched at runtime and the bundle stays self-contained. Stroke geometry
 * matches the brief: no fill, `currentColor`, 1.6–1.9 weight, round caps/joins.
 *
 * Size is expressed in `em` by default so an icon scales with whatever font
 * size its container sets — which keeps them correct under the fluid rem ladder.
 */

import type { SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "size"> {
  /** Any CSS length. Defaults to `1em`. */
  size?: string;
}

function Svg({ size = "1em", strokeWidth = 1.7, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------------------------------------------------------------- chevrons */

export const ChevronDown = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <polyline points="6 9.5 12 15.5 18 9.5" />
  </Svg>
);

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.9}>
    <polyline points="14 6 9 12 14 18" />
  </Svg>
);

export const ChevronRight = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.9}>
    <polyline points="10 6 15 12 10 18" />
  </Svg>
);

/* -------------------------------------------------------------------- nav */

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 9.5h17" />
    <path d="M8 3.5v3M16 3.5v3" />
  </Svg>
);

export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 7h11M9 12h11M9 17h11" />
    <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" strokeWidth={2.2} />
  </Svg>
);

export const MailIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="3" />
    <path d="M4 8.5l7.2 4.8a1.5 1.5 0 0 0 1.6 0L20 8.5" />
  </Svg>
);

export const FilterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16l-6.2 7.2v5.4l-3.6 1.9V13.2L4 6Z" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.6" y2="16.6" />
  </Svg>
);

/* ---------------------------------------------------------------- actions */

export const EditIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4.2L19.4 8.8a2.1 2.1 0 0 0 0-3l-1.2-1.2a2.1 2.1 0 0 0-3 0L4 15.8V20Z" />
    <path d="M14.5 6.5l3 3" />
  </Svg>
);

export const MicIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 11a6 6 0 0 0 12 0" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.9}>
    <polyline points="4 12.5 9.5 18 20 6.5" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.9}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 6.5h15" />
    <path d="M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
    <path d="M6.5 6.5l.9 12a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12" />
  </Svg>
);

export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9.5a6 6 0 0 1 12 0c0 3.2.8 5 1.6 6.1a.8.8 0 0 1-.65 1.28H5.05a.8.8 0 0 1-.65-1.28C5.2 14.5 6 12.7 6 9.5Z" />
    <path d="M10 20a2.2 2.2 0 0 0 4 0" />
  </Svg>
);

/* --------------------------------------------------------- filters / meta */

export const FlagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 21V4" />
    <path d="M5 4h10l-2 3 2 3H5" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const TagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4h7l9 9-7 7-9-9V4Z" />
    <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);

/* -------------------------------------------------------------- settings */

export const CogIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 14a1.6 1.6 0 0 0 .32 1.77l.06.06a1.9 1.9 0 1 1-2.7 2.7l-.05-.06a1.6 1.6 0 0 0-1.78-.32 1.6 1.6 0 0 0-1 1.46V20a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a1.9 1.9 0 1 1-2.7-2.7l.06-.05a1.6 1.6 0 0 0 .32-1.78 1.6 1.6 0 0 0-1.46-1H4a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.9 1.9 0 1 1 2.7-2.7l.05.06a1.6 1.6 0 0 0 1.78.32H10a1.6 1.6 0 0 0 1-1.46V4a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.46 1.6 1.6 0 0 0 1.78-.32l.06-.06a1.9 1.9 0 1 1 2.7 2.7l-.06.05a1.6 1.6 0 0 0-.32 1.78V10a1.6 1.6 0 0 0 1.46 1H20a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.46 1Z" />
  </Svg>
);

export const ThemeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 13.2A8.2 8.2 0 1 1 10.8 4a6.4 6.4 0 0 0 9.2 9.2Z" />
  </Svg>
);

export const LogOutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.5" />
    <polyline points="15 16 19.5 12 15 8" />
    <line x1="19.5" y1="12" x2="9.5" y2="12" />
  </Svg>
);

/* ------------------------------------------------------------ empty state */

export const SparkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.5l1.7 4.3 4.3 1.7-4.3 1.7L12 16.5l-1.7-4.3L6 10.5l4.3-1.7L12 4.5Z" />
    <path d="M18 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
  </Svg>
);
