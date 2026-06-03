// A padlock glyph drawn as an inline SVG so it is perfectly symmetric and
// centers exactly inside its container. The emoji 🔒 has asymmetric side
// bearings that vary by platform (Apple Color Emoji paints it left-of-centre),
// which made the locked station markers look off-centre on the transit map.
export function LockIcon({
  size,
  color = 'currentColor',
}: {
  size: number
  color?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="block"
    >
      {/* shackle — symmetric arc centred on x=12 */}
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      {/* body — centred on x=12 */}
      <rect x="5" y="11" width="14" height="9" rx="2" fill={color} />
    </svg>
  )
}
