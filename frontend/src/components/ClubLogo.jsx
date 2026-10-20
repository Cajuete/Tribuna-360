import { useState } from 'react';

const SIZES = {
  sm: 'w-12 h-12 text-base rounded-xl',
  md: 'w-16 h-16 text-xl rounded-2xl',
  lg: 'w-24 h-24 text-3xl rounded-2xl',
  xl: 'w-32 h-32 text-5xl rounded-3xl',
};

const PALETTES = [
  'from-emerald-500 to-teal-700',
  'from-sky-500 to-indigo-700',
  'from-amber-500 to-orange-700',
  'from-rose-500 to-pink-700',
  'from-violet-500 to-purple-700',
  'from-cyan-500 to-blue-700',
  'from-lime-500 to-green-700',
  'from-fuchsia-500 to-rose-700',
];

const STOP_WORDS = new Set(['club', 'deportivo', 'de', 'del', 'la', 'las', 'los', 'el', 'fc', 'cd', 'the', 'y']);

function hashName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function initials(name) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(w => w && !STOP_WORDS.has(w.toLowerCase()));

  if (words.length === 0) return name.trim().slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export default function ClubLogo({ name = '', logoUrl, size = 'md', className = '' }) {
  const [broken, setBroken] = useState(false);
  const dims = SIZES[size] || SIZES.md;

  if (logoUrl && !broken) {
    return (
      <img
        src={logoUrl}
        alt={`Escudo de ${name}`}
        onError={() => setBroken(true)}
        className={`${dims} object-contain bg-black/40 border border-white/10 p-1 shrink-0 ${className}`}
      />
    );
  }

  const palette = PALETTES[hashName(name) % PALETTES.length];

  return (
    <span
      aria-hidden="true"
      className={`${dims} shrink-0 flex items-center justify-center font-display font-extrabold text-white bg-gradient-to-br ${palette} border border-white/15 shadow-lg ${className}`}
    >
      {initials(name)}
    </span>
  );
}
