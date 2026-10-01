import React from 'react';

// A small, hand-drawn icon set used throughout the app (sidebar nav, KPI
// tiles, landing page). Deliberately built from plain primitives (line,
// rect, circle, polygon) rather than freehand curves, so every icon
// renders exactly as intended. All icons inherit color via currentColor
// so they pick up link/button/tile colors automatically.

function Base({ size = 20, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

// Chat bubble with a tail and a handset — reads as WhatsApp on its green tile.
export const WhatsAppIcon = (props) => (
  <Base strokeWidth="1.8" {...props}>
    <circle cx="12.5" cy="11.5" r="8.5" />
    <polygon points="4,21 5.6,16.2 8.8,19" />
    <polyline points="9.5,8.5 10.5,8 11.6,10.2 10.8,11.1 12.9,13.2 13.8,12.4 16,13.5 15.5,14.5" />
  </Base>
);

export const MailIcon = (props) => (
  <Base {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <polyline points="3.5,6 12,13 20.5,6" />
  </Base>
);

export const LinkIcon = (props) => (
  <Base {...props}>
    <rect x="2.5" y="9" width="10" height="6" rx="3" transform="rotate(-45 7.5 12)" />
    <rect x="11.5" y="9" width="10" height="6" rx="3" transform="rotate(-45 16.5 12)" />
    <line x1="9.5" y1="14.5" x2="14.5" y2="9.5" />
  </Base>
);

export const ShareIcon = (props) => (
  <Base {...props}>
    <circle cx="18" cy="5.5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="18.5" r="2.5" />
    <line x1="8.2" y1="10.8" x2="15.8" y2="6.7" />
    <line x1="8.2" y1="13.2" x2="15.8" y2="17.3" />
  </Base>
);

export const FilePdfIcon = (props) => (
  <Base {...props}>
    <polygon points="6,3 14,3 19,8 19,21 6,21" />
    <polyline points="14,3 14,8 19,8" />
    <line x1="9" y1="13" x2="16" y2="13" />
    <line x1="9" y1="16.5" x2="14" y2="16.5" />
  </Base>
);

export const DownloadIcon = (props) => (
  <Base {...props}>
    <line x1="12" y1="3" x2="12" y2="15" />
    <polyline points="7,10 12,15 17,10" />
    <line x1="4" y1="20" x2="20" y2="20" />
  </Base>
);

export const FileTextIcon = (props) => (
  <Base {...props}>
    <polygon points="6,3 14,3 19,8 19,21 6,21" />
    <polyline points="14,3 14,8 19,8" />
    <line x1="9" y1="12" x2="16" y2="12" />
    <line x1="9" y1="15.5" x2="16" y2="15.5" />
    <line x1="9" y1="19" x2="13" y2="19" />
  </Base>
);

export const MenuIcon = (props) => (
  <Base {...props}>
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </Base>
);

export const GridIcon = (props) => (
  <Base {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Base>
);

export const BarChartIcon = (props) => (
  <Base {...props}>
    <line x1="5" y1="20" x2="5" y2="14" />
    <line x1="12" y1="20" x2="12" y2="6" />
    <line x1="19" y1="20" x2="19" y2="11" />
  </Base>
);

export const StoveIcon = (props) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="3.2" />
    <line x1="12" y1="2" x2="12" y2="5.5" />
    <line x1="12" y1="18.5" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5.5" y2="12" />
    <line x1="18.5" y1="12" x2="22" y2="12" />
  </Base>
);

export const CoffeeIcon = (props) => (
  <Base {...props}>
    <rect x="4" y="8" width="13" height="11" />
    <rect x="17" y="10" width="4" height="5" />
    <line x1="8" y1="2" x2="8" y2="5" />
    <line x1="12" y1="2" x2="12" y2="5" />
  </Base>
);

export const ClipboardCheckIcon = (props) => (
  <Base {...props}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <rect x="9" y="2" width="6" height="3" rx="1" />
    <polyline points="8,13 11,16 16,9" />
  </Base>
);

export const StorefrontIcon = (props) => (
  <Base {...props}>
    <polygon points="3,9 21,9 18,4 6,4" />
    <rect x="4" y="9" width="16" height="11" />
    <rect x="10" y="14" width="4" height="6" />
  </Base>
);

export const LogOutIcon = (props) => (
  <Base {...props}>
    <polyline points="9,4 5,4 5,20 9,20" />
    <line x1="21" y1="12" x2="9" y2="12" />
    <polyline points="16,7 21,12 16,17" />
  </Base>
);

export const CheckCircleIcon = (props) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="8,12.5 11,15.5 16,9" />
  </Base>
);

export const ThermometerIcon = (props) => (
  <Base {...props}>
    <rect x="10" y="3" width="4" height="12" rx="2" />
    <circle cx="12" cy="18" r="3" />
  </Base>
);

export const TrashIcon = (props) => (
  <Base {...props}>
    <line x1="4" y1="7" x2="20" y2="7" />
    <rect x="6" y="7" width="12" height="14" />
    <line x1="9" y1="4" x2="15" y2="4" />
    <line x1="9" y1="4" x2="9" y2="7" />
    <line x1="15" y1="4" x2="15" y2="7" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </Base>
);

export const AlertTriangleIcon = (props) => (
  <Base {...props}>
    <polygon points="12,3 22,20 2,20" />
    <line x1="12" y1="9" x2="12" y2="14" />
    <line x1="12" y1="17" x2="12" y2="17.2" />
  </Base>
);

export const XCircleIcon = (props) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <line x1="9" y1="9" x2="15" y2="15" />
    <line x1="15" y1="9" x2="9" y2="15" />
  </Base>
);

export const ShieldIcon = (props) => (
  <Base {...props}>
    <polygon points="12,3 19,6 19,12 12,21 5,12 5,6" />
    <polyline points="9,12 11,14 15,9" />
  </Base>
);

export const GraduationCapIcon = (props) => (
  <Base {...props}>
    <polygon points="12,4 22,9 12,14 2,9" />
    <line x1="6" y1="11" x2="6" y2="16" />
    <line x1="18" y1="11" x2="18" y2="16" />
    <line x1="6" y1="16" x2="18" y2="16" />
  </Base>
);

export const CopyIcon = (props) => (
  <Base {...props}>
    <rect x="4" y="4" width="12" height="12" />
    <rect x="8" y="8" width="12" height="12" />
  </Base>
);

export const DoorOpenIcon = (props) => (
  <Base {...props}>
    <rect x="5" y="3" width="11" height="18" />
    <circle cx="13" cy="12" r="0.9" fill="currentColor" />
    <line x1="16" y1="3" x2="20" y2="5" />
    <line x1="20" y1="5" x2="20" y2="19" />
    <line x1="16" y1="21" x2="20" y2="19" />
  </Base>
);

export const TrendingUpIcon = (props) => (
  <Base {...props}>
    <polyline points="3,17 10,10 14,14 21,6" />
    <polyline points="16,6 21,6 21,11" />
  </Base>
);

export const LayersIcon = (props) => (
  <Base {...props}>
    <polygon points="12,3 22,8 12,13 2,8" />
    <polyline points="2,13 12,18 22,13" />
    <polyline points="2,17.5 12,22.5 22,17.5" />
  </Base>
);

export const UserIcon = (props) => (
  <Base {...props}>
    <circle cx="12" cy="8" r="4" />
    <polygon points="4,21 4,18 8,15 16,15 20,18 20,21" />
  </Base>
);

export const CalendarIcon = (props) => (
  <Base {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="7" y1="2" x2="7" y2="6" />
    <line x1="17" y1="2" x2="17" y2="6" />
  </Base>
);

export const PlayIcon = (props) => (
  <Base {...props}>
    <polygon points="6,4 20,12 6,20" fill="currentColor" stroke="none" />
  </Base>
);

export const ClipboardEmptyIcon = (props) => (
  <Base {...props}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <rect x="9" y="2" width="6" height="3" rx="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </Base>
);

export const CameraIcon = (props) => (
  <Base {...props}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <polygon points="9,7 10,4 14,4 15,7" />
    <circle cx="12" cy="13.5" r="3.8" />
  </Base>
);

export const MessageIcon = (props) => (
  <Base {...props}>
    <polygon points="3,4 21,4 21,16 10,16 5,20 5,16 3,16" />
    <line x1="7" y1="8.5" x2="17" y2="8.5" />
    <line x1="7" y1="12" x2="13" y2="12" />
  </Base>
);

export const DoorClosedIcon = (props) => (
  <Base {...props}>
    <rect x="5" y="3" width="14" height="18" />
    <circle cx="15" cy="12" r="0.9" fill="currentColor" />
  </Base>
);

export const SearchIcon = (props) => (
  <Base {...props}>
    <circle cx="10" cy="10" r="6" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
  </Base>
);

export const MapPinIcon = (props) => (
  <Base {...props}>
    <polygon points="12,2 18,9 12,21 6,9" />
    <circle cx="12" cy="9" r="2.5" />
  </Base>
);

export const BriefcaseIcon = (props) => (
  <Base {...props}>
    <rect x="3" y="8" width="18" height="12" rx="1" />
    <rect x="8" y="4" width="8" height="4" rx="1" />
    <line x1="3" y1="14" x2="21" y2="14" />
  </Base>
);

// --- Mobile app (design handoff "SOPY App") ---------------------------

export const BellIcon = (props) => (
  <Base {...props}>
    <polygon points="12,3 16.5,5.5 17.5,10 17.5,15 20,18 4,18 6.5,15 6.5,10 7.5,5.5" />
    <line x1="10" y1="21" x2="14" y2="21" />
  </Base>
);

// Paper plane. Points toward the reading end, so it flips in Arabic.
export const SendIcon = (props) => (
  <Base {...props} className={`icon-flip ${props.className || ''}`}>
    <polygon points="3,11 21,3 13,21 11,13" />
  </Base>
);

// Chevrons that follow reading direction ("back" points right in Arabic).
export const ChevronStartIcon = (props) => (
  <Base strokeWidth="1.8" {...props} className={`icon-flip ${props.className || ''}`}>
    <polyline points="15,5 8,12 15,19" />
  </Base>
);

export const ChevronEndIcon = (props) => (
  <Base strokeWidth="1.8" {...props} className={`icon-flip ${props.className || ''}`}>
    <polyline points="9,5 16,12 9,19" />
  </Base>
);

export const ChevronDownIcon = (props) => (
  <Base strokeWidth="1.8" {...props}>
    <polyline points="6,9 12,15 18,9" />
  </Base>
);

export const LockIcon = (props) => (
  <Base {...props}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <polyline points="8,11 8,7.5 12,4.5 16,7.5 16,11" />
  </Base>
);

export const PlusIcon = (props) => (
  <Base strokeWidth="1.8" {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Base>
);

export const MinusIcon = (props) => (
  <Base strokeWidth="1.8" {...props}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </Base>
);

export const CheckIcon = (props) => (
  <Base strokeWidth="1.8" {...props}>
    <polyline points="5,12.5 10,17 19,7" />
  </Base>
);

export const XIcon = (props) => (
  <Base strokeWidth="1.8" {...props}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </Base>
);

export const ClockIcon = (props) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12,7 12,12 15.5,14" />
  </Base>
);
