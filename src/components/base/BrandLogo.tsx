/** Display the supplied artwork without its large canvas margins; preserve the source pixels. */
export default function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`relative block overflow-hidden shrink-0 mix-blend-multiply ${className}`} style={{ aspectRatio: '964 / 256' }}>
      <img
        src="/images/brand/lucissi-care-logo.png"
        alt="LUCISSI CARE"
        width={2172}
        height={724}
        className="absolute h-auto"
        style={{ width: `${2172 / 964 * 100}%`, maxWidth: 'none', left: `${-132 / 964 * 100}%`, top: `${-228 / 256 * 100}%` }}
      />
    </span>
  );
}
