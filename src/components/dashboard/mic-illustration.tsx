/* Dekoratívna ilustrácia v úvodnej karte: mikrofón, zvukové vlny a fialová žiara. Čisté SVG, ostré pri každom DPI. */

const LEFT_BARS = [
  { x: 84, h: 16 },
  { x: 108, h: 38 },
  { x: 130, h: 92 },
  { x: 150, h: 40 },
];
const RIGHT_BARS = [
  { x: 284, h: 40, lime: true },
  { x: 306, h: 90, lime: true },
  { x: 328, h: 96, lime: true },
  { x: 350, h: 30, lime: false },
  { x: 374, h: 12, lime: false },
];
const CENTER_Y = 132;

export function MicIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 440 272" aria-hidden="true" focusable="false" className={className} preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="mic-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5a3df0" stopOpacity="0.42" />
          <stop offset="60%" stopColor="#3b26a8" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#1a1240" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mic-ribbon" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#5b3ee6" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#3a26a0" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="mic-ribbon-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4a33c4" stopOpacity="0.1" />
          <stop offset="55%" stopColor="#5a3fe0" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#3c2aa6" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="mic-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2c2470" />
          <stop offset="45%" stopColor="#3d3290" />
          <stop offset="100%" stopColor="#1d1848" />
        </linearGradient>
        <linearGradient id="mic-lower" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#231c5c" />
          <stop offset="50%" stopColor="#2f2678" />
          <stop offset="100%" stopColor="#161236" />
        </linearGradient>
        <linearGradient id="mic-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c6ff4d" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#bef83c" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#bef83c" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mic-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2a2268" />
          <stop offset="50%" stopColor="#4a3cae" />
          <stop offset="100%" stopColor="#221b56" />
        </linearGradient>
        <pattern id="mic-grille" width="4.2" height="4.2" patternUnits="userSpaceOnUse">
          <circle cx="2.1" cy="2.1" r="0.85" fill="#8f86e8" fillOpacity="0.32" />
        </pattern>
        <clipPath id="mic-head">
          <rect x="179" y="44" width="72" height="128" rx="36" />
        </clipPath>
        <filter id="mic-bar-glow" x="-200%" y="-30%" width="500%" height="160%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="mic-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>

      <circle cx="215" cy="132" r="170" fill="url(#mic-glow)" />

      {/* Fialová „stuha“ okolo mikrofónu */}
      <circle cx="215" cy="140" r="150" fill="none" stroke="#2a1d78" strokeOpacity="0.45" strokeWidth="18" />
      <path d="M-12 286 C 40 250, 70 236, 112 226" fill="none" stroke="url(#mic-ribbon)" strokeWidth="34" strokeLinecap="round" />
      <path d="M296 28 C 336 44, 362 74, 368 118" fill="none" stroke="url(#mic-ribbon-top)" strokeWidth="26" strokeLinecap="round" />

      {/* Sústredné kruhy */}
      <circle cx="215" cy="132" r="122" fill="none" stroke="#5b45d6" strokeOpacity="0.38" strokeWidth="1" />
      <circle cx="215" cy="132" r="98" fill="none" stroke="#6a52ee" strokeOpacity="0.5" strokeWidth="1.2" />
      <path d="M100 96 A 122 122 0 0 1 132 46" fill="none" stroke="#bef83c" strokeOpacity="0.28" strokeWidth="1" />

      {/* Tenké linky vľavo */}
      <path d="M34 120h44" stroke="#c9d1ff" strokeOpacity="0.4" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M64 131h10" stroke="#bef83c" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />

      {/* Zvukové vlny */}
      <g filter="url(#mic-bar-glow)" className="mic-bars">
        {LEFT_BARS.map((bar, index) => (
          <rect
            key={`l${bar.x}`}
            x={bar.x - 2}
            y={CENTER_Y - bar.h / 2}
            width="4"
            height={bar.h}
            rx="2"
            fill="#bef83c"
            className="mic-bar"
            style={{ animationDelay: `${index * 160}ms` }}
          />
        ))}
        {RIGHT_BARS.map((bar, index) => (
          <rect
            key={`r${bar.x}`}
            x={bar.x - 2}
            y={CENTER_Y - bar.h / 2}
            width="4"
            height={bar.h}
            rx="2"
            fill={bar.lime ? "#bef83c" : "#a78bfa"}
            className="mic-bar"
            style={{ animationDelay: `${(index + 2) * 140}ms` }}
          />
        ))}
      </g>

      {/* Držiak */}
      <path d="M161 120v16a54 54 0 0 0 108 0v-16" fill="none" stroke="url(#mic-metal)" strokeWidth="7" strokeLinecap="round" />
      <circle cx="161" cy="122" r="6.5" fill="#4a3cae" />
      <circle cx="269" cy="122" r="6.5" fill="#3a2f8e" />
      <circle cx="160" cy="120.5" r="2.2" fill="#8d80f0" fillOpacity="0.7" />

      {/* Stojan */}
      <rect x="210.5" y="188" width="9" height="44" rx="3" fill="url(#mic-metal)" />
      <ellipse cx="215" cy="238" rx="38" ry="8" fill="#241d5e" />
      <ellipse cx="215" cy="235.5" rx="38" ry="6.5" fill="url(#mic-metal)" />

      {/* Hlava mikrofónu */}
      <g clipPath="url(#mic-head)">
        <rect x="179" y="44" width="72" height="128" fill="url(#mic-body)" />
        <rect x="179" y="44" width="72" height="70" fill="url(#mic-grille)" />
        <rect x="179" y="112" width="72" height="60" fill="url(#mic-lower)" />
        <rect x="179" y="111" width="72" height="2" fill="#5a4bc8" fillOpacity="0.6" />
        <ellipse cx="200" cy="66" rx="10" ry="20" fill="#a99cff" fillOpacity="0.14" filter="url(#mic-soft)" />
      </g>
      <path d="M232 49 A 36 36 0 0 1 251 80 V 140" fill="none" stroke="url(#mic-rim)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
