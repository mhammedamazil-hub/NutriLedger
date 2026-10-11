/** NutriLedger mark: a leaf resting on a ledger line. Same artwork as the app icons. */
export function Logo({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="64" height="64" rx="15" fill="#245B43" />
      <path d="M17 45C17 29 28.5 17.5 47.5 16.5C47.5 34.5 36 45 17 45Z" fill="#F7F7F2" />
      <path d="M19 43L39 23" stroke="#245B43" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M14 51.5H50" stroke="#9CCBB0" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
