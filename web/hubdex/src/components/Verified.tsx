export default function Verified({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} role="img" aria-label="Verified">
      <title>Verified</title>
      <path fill="#1d9bf0" d="M12 1l2.6 2.1 3.3-.3 1.3 3.1 3.1 1.3-.3 3.3L24 12l-2.1 2.6.3 3.3-3.1 1.3-1.3 3.1-3.3-.3L12 23l-2.6-2.1-3.3.3-1.3-3.1L1.7 16.6 2 13.3 0 12l2.1-2.6-.3-3.3 3.1-1.3 1.3-3.1 3.3.3z"/>
      <path fill="#fff" d="M10.6 14.7l-2.3-2.3-1.2 1.2 3.5 3.5 6.3-6.3-1.2-1.2z"/>
    </svg>
  );
}
