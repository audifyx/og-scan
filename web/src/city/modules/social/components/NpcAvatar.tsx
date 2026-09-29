/** Small gradient-disc avatar from NPC initials + hue. */

export function NpcAvatar({
  initials,
  hue,
  size = 36,
  verified = false,
}: {
  initials: string;
  hue: number;
  size?: number;
  verified?: boolean;
}) {
  return (
    <span
      className="oxs-avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `linear-gradient(135deg, hsl(${hue},70%,45%), hsl(${(hue + 40) % 360},70%,30%))`,
      }}
      title={verified ? "Verified" : undefined}
    >
      {initials}
      {verified && <i className="oxs-verified">✓</i>}
    </span>
  );
}
