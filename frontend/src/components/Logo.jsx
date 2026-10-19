export default function Logo({ size = 'md' }) {
  const sm = size === 'sm';
  const mark = sm ? 34 : 46;

  return (
    <span className="flex items-center gap-2.5 select-none">
      <svg
        width={mark}
        height={mark}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        style={{ filter: 'drop-shadow(0 6px 16px rgba(16,185,129,.55))' }}
      >
        <defs>
          <linearGradient id="lg360" x1="0" y1="0" x2="48" y2="48">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="55%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#a3e635" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="21" stroke="url(#lg360)" strokeWidth="3" />
        <ellipse cx="24" cy="24" rx="21" ry="9" stroke="url(#lg360)" strokeWidth="1.8" opacity="0.75" />
        <ellipse
          cx="24"
          cy="24"
          rx="9"
          ry="21"
          stroke="url(#lg360)"
          strokeWidth="1.8"
          opacity="0.45"
          transform="rotate(28 24 24)"
        />
        <circle cx="24" cy="24" r="6" fill="url(#lg360)" />
        <circle cx="40.5" cy="12.5" r="3.4" fill="#a3e635" />
      </svg>
      <span className={sm ? 'text-[1.35rem] leading-none' : 'text-[1.9rem] leading-none'}>
        <span className="firma">Tribuna 360</span>
        <svg width="100%" height="7" viewBox="0 0 120 7" preserveAspectRatio="none" className="block mt-0.5" aria-hidden="true">
          <defs>
            <linearGradient id="lgFirma" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#a3e635" />
            </linearGradient>
          </defs>
          <path
            d="M2 5 C 26 1.5, 74 1, 118 4"
            stroke="url(#lgFirma)"
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </span>
    </span>
  );
}
