import type { SVGProps } from 'react'

// 同一組線條圖示，粗細統一。

function Icon({ children, size = 20, strokeWidth = 1.8, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
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
  )
}

type P = { size?: number; className?: string }

export const ImageIcon = (p: P) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
  </Icon>
)
export const LinkIcon = (p: P) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
  </Icon>
)
export const SendIcon = (p: P) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M4 12 20 4l-5 16-3.5-6.5z" />
    <path d="m11.5 13.5 4-4" />
  </Icon>
)
export const ChevronDownIcon = (p: P) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)
export const ChevronUpIcon = (p: P) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="m6 15 6-6 6 6" />
  </Icon>
)
export const ArrowDownIcon = (p: P) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
)
export const FlagIcon = (p: P) => (
  <Icon {...p}>
    <path d="M5 21V4" />
    <path d="M5 5h12l-2 4 2 4H5" />
  </Icon>
)
export const XIcon = (p: P) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
)
export const SpinnerIcon = ({ className = '', ...p }: P) => (
  <Icon className={`spin ${className}`} strokeWidth={2.4} {...p}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </Icon>
)
export const BanIcon = (p: P) => (
  <Icon strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </Icon>
)
export const ChatIcon = (p: P) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V16h-.5A2.5 2.5 0 0 1 4 13.5z" transform="translate(.5 .5)" />
  </Icon>
)
export const AlertIcon = (p: P) => (
  <Icon strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.2v.1" />
  </Icon>
)
