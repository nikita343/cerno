/**
 * The Cerno mark and wordmark.
 *
 * The glyph is the app icon (`app/icon.svg`) inlined so it can be sized and
 * recoloured without a network round trip: the "C" uses `currentColor` so it
 * inverts with the theme, while the corner bracket keeps the fixed brand red in
 * both. One component for the landing nav, the auth cards and the footer, so
 * the logo can only ever look like itself.
 */
export function LogoMark({
  size = 28,
  className,
}: {
  size?: number | string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 136 136"
      width={size}
      height={size}
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M69.2359 98.8352C63.8417 98.8352 59.0977 97.5829 55.0039 95.0785C50.9101 92.5259 47.7073 88.9859 45.3955 84.4587C43.1318 79.8832 42 74.5854 42 68.5651C42 62.5929 43.1318 57.3432 45.3955 52.8159C47.7073 48.2405 50.9101 44.7005 55.0039 42.1961C59.0977 39.6435 63.8417 38.3672 69.2359 38.3672C73.6668 38.3672 77.6161 39.2341 81.0838 40.968C84.5515 42.6536 87.4172 45.0618 89.6808 48.1923C91.9445 51.2747 93.3412 54.8869 93.871 59.0289H81.3728C80.9875 56.091 79.6871 53.731 77.4717 51.949C75.2562 50.1188 72.5109 49.2037 69.2359 49.2037C66.1535 49.2037 63.4564 50.0225 61.1446 51.66C58.8809 53.2494 57.123 55.4889 55.8708 58.3787C54.6186 61.2684 53.9925 64.688 53.9925 68.6373C53.9925 72.4903 54.6186 75.8857 55.8708 78.8237C57.123 81.7616 58.8809 84.0493 61.1446 85.6868C63.4564 87.2762 66.1535 88.0709 69.2359 88.0709C72.5109 88.0709 75.2562 87.1558 77.4717 85.3256C79.6871 83.4954 80.9875 81.1114 81.3728 78.1735H93.871C93.3412 82.3154 91.9445 85.9517 89.6808 89.0823C87.4172 92.2128 84.5515 94.6209 81.0838 96.3066C77.6161 97.9923 73.6668 98.8352 69.2359 98.8352Z"
        fill="currentColor"
      />
      <path
        d="M128 112C128 120.837 120.837 128 112 128H68V114H114V68H128V112ZM68 22H22V68H8V24C8 15.1634 15.1634 8 24 8H68V22Z"
        fill="#FF003D"
      />
    </svg>
  );
}

/**
 * Mark plus the "cerno." wordmark. `tone="onDark"` flips the word white for the
 * dark CTA and footer; the bracket and the accent full stop stay red.
 */
export function Logo({
  size = 26,
  className,
  tone = "default",
}: {
  size?: number;
  className?: string;
  tone?: "default" | "onDark";
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        color: tone === "onDark" ? "#f5f5f4" : "var(--text)",
      }}
    >
      <LogoMark size={size} />
      <span
        style={{
          fontSize: `${size * 0.9}px`,
          fontWeight: 700,
          letterSpacing: "-0.045em",
          lineHeight: 1,
        }}
      >
        cerno<span style={{ color: "var(--accent)" }}>.</span>
      </span>
    </span>
  );
}
