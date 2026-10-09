/**
 * Urho Kaleva Kekkonen, reduced to the two things everyone recognises:
 * the bald dome and the round glasses. Drawn as a silhouette with the
 * features knocked out so it works in the two-colour palette.
 */
export function Kekkonen({ size = 96 }: { size?: number }) {
  return (
    <svg
      className="mascot"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Urho Kaleva Kekkonen"
    >
      <g fill="currentColor">
        {/* shoulders */}
        <path d="M14 120c2-20 16-29 30-33h32c14 4 28 13 30 33Z" />
        {/* neck */}
        <path d="M50 74h20v18H50Z" />
        {/* head */}
        <ellipse cx="60" cy="47" rx="27" ry="33" />
        {/* ears */}
        <ellipse cx="32" cy="50" rx="5" ry="8" />
        <ellipse cx="88" cy="50" rx="5" ry="8" />
      </g>

      <g fill="none" stroke="var(--bg)" strokeWidth="3.6" strokeLinecap="round">
        {/* glasses */}
        <circle cx="48" cy="46" r="10.5" />
        <circle cx="72" cy="46" r="10.5" />
        <path d="M58.5 46h3" />
        <path d="M37.5 44 31 42M82.5 44 89 42" />
        {/* statesmanlike mouth */}
        <path d="M51 66q9 5 18 0" />
      </g>

      {/* shirt and tie */}
      <path d="M52 92l8 13 8-13-8-5Z" fill="var(--bg)" />
      <path d="M60 105l-4 7 4 8 4-8Z" fill="currentColor" />
    </svg>
  )
}
