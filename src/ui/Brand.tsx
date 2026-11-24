import type { ReactNode } from 'react';

// annular sector of the board, angles in degrees clockwise from 12 o'clock
function sector(r1: number, r2: number, a1: number, a2: number) {
  const p = (r: number, a: number) => {
    const t = ((a - 90) * Math.PI) / 180;
    return `${(50 + r * Math.cos(t)).toFixed(2)} ${(50 + r * Math.sin(t)).toFixed(2)}`;
  };
  return `M${p(r1, a1)}L${p(r2, a1)}A${r2} ${r2} 0 0 1 ${p(r2, a2)}L${p(r1, a2)}A${r1} ${r1} 0 0 0 ${p(r1, a1)}Z`;
}

const SEGMENTS = Array.from({ length: 20 }, (_, i) => {
  const a1 = i * 18 - 9, a2 = a1 + 18, even = i % 2 === 0;
  return (
    <g key={i}>
      <path d={sector(9, 44, a1, a2)} fill={even ? '#14141c' : '#efe3c4'} />
      <path d={sector(25, 30, a1, a2)} fill={even ? '#e8002d' : '#00a651'} />
      <path d={sector(40, 44, a1, a2)} fill={even ? '#e8002d' : '#00a651'} />
    </g>
  );
});

/** Dartboard with a dart in the bull. Decorative: the brand name sits next to it as text. */
export function Logo({ size = 56 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="49" fill="#0a0a0f" />
      {SEGMENTS}
      <circle cx="50" cy="50" r="9" fill="#00a651" />
      <circle cx="50" cy="50" r="4" fill="#e8002d" />
      <g className="logo-dart">
        <path d="M51 49 L80 20" stroke="#ededf2" strokeWidth="3" strokeLinecap="round" />
        <path d="M80 20 L96 4 L84 10 Z M80 20 L96 4 L90 16 Z" fill="#ffc820" />
      </g>
    </svg>
  );
}

export function BrandBar({ children }: { children?: ReactNode }) {
  return (
    <header className="brand-bar">
      <div className="brand">
        <Logo />
        <div className="brand-text">
          <p className="brand-name">Dartgeloog</p>
          <p className="brand-sub">Turnierplaner</p>
        </div>
      </div>
      {children && <div className="row brand-actions">{children}</div>}
    </header>
  );
}
