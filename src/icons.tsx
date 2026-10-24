// Minimal line-icon set (inline SVG, no external dependency).
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => <Svg {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></Svg>;
export const IconBrain = (p: P) => (
  <Svg {...p}>
    <path d="M12 5.5c-1-1.6-3.4-2-4.8-.6-1.6-.1-3 1.3-2.8 3-1.5.8-1.9 2.9-.8 4.2-.8 1.5 0 3.5 1.7 3.9.3 1.8 2.3 2.9 4 2.2.8 1 2 1.3 2.7.8" />
    <path d="M12 5.5c1-1.6 3.4-2 4.8-.6 1.6-.1 3 1.3 2.8 3 1.5.8 1.9 2.9.8 4.2.8 1.5 0 3.5-1.7 3.9-.3 1.8-2.3 2.9-4 2.2-.8 1-2 1.3-2.7.8" />
    <path d="M12 5.5v13.5M8.5 9.5c1.2.3 1.8 1.4 1.5 2.5M15.5 9.5c-1.2.3-1.8 1.4-1.5 2.5M8 15c.8-.6 2-.6 2.6.2M16 15c-.8-.6-2-.6-2.6.2" />
  </Svg>
);
export const IconLibrary = (p: P) => <Svg {...p}><path d="M4 4.5h4v15H4zM10 4.5h4v15h-4z" /><path d="m16 5.2 3.8-1 3.2 14.6-3.8 1z" transform="translate(-2.5 .3)" /></Svg>;
export const IconBookmark = (p: P) => <Svg {...p}><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" /></Svg>;
export const IconBookmarkFilled = (p: P) => <Svg {...p}><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" fill="currentColor" /></Svg>;
export const IconSettings = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);
export const IconSearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>;
export const IconSpark = (p: P) => <Svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></Svg>;
export const IconArrowRight = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const IconArrowLeft = (p: P) => <Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>;
export const IconExternal = (p: P) => <Svg {...p}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>;
export const IconRotateL = (p: P) => <Svg {...p}><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5" /></Svg>;
export const IconRotateR = (p: P) => <Svg {...p}><path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5" /><path d="M20 4v4.5h-4.5" /></Svg>;
export const IconZoomIn = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M11 8v6M8 11h6" /></Svg>;
export const IconZoomOut = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M8 11h6" /></Svg>;
export const IconReset = (p: P) => <Svg {...p}><path d="M3 12h3M18 12h3M12 3v3M12 18v3" /><circle cx="12" cy="12" r="5" /></Svg>;
export const IconPlay = (p: P) => <Svg {...p}><path d="M7 5v14l11-7z" /></Svg>;
export const IconPause = (p: P) => <Svg {...p}><path d="M8 5v14M16 5v14" /></Svg>;
export const IconLayers = (p: P) => <Svg {...p}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></Svg>;
export const IconInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const IconAlert = (p: P) => <Svg {...p}><path d="M12 4 2.5 20h19z" /><path d="M12 10v4.5M12 17.5h.01" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const IconX = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconDoc = (p: P) => <Svg {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const IconMap = (p: P) => <Svg {...p}><path d="m3 6 6-2.5 6 2.5 6-2.5v14.5l-6 2.5-6-2.5-6 2.5z" /><path d="M9 3.5v14.5M15 6v14.5" /></Svg>;
export const IconShield = (p: P) => <Svg {...p}><path d="M12 3 4.5 6v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9V6z" /><path d="m9 12 2 2 4-4" /></Svg>;
