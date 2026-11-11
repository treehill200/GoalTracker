/** Original logo mark: a target ring with an upward spark. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="13" fill="none" stroke="#E5484D" strokeWidth="3.5" />
      <circle cx="16" cy="16" r="6.5" fill="none" stroke="#3E8EF7" strokeWidth="3" />
      <path d="M16 16 L25 7" stroke="#F5C542" strokeWidth="3" strokeLinecap="round" />
      <path d="M21 6.5 L26 6 L25.5 11" stroke="#F5C542" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
