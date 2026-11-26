import { Heart } from 'lucide-react';

export default function FollowClubButton({ following, loading = false, onClick, className = '' }) {
  return (
    <button
      type="button"
      aria-pressed={following}
      disabled={loading}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-wait disabled:opacity-60 ${
        following
          ? 'border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
          : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-500/20'
      } ${className}`}
    >
      <Heart className={`h-4 w-4 transition-transform duration-200 ${following ? 'fill-current scale-110' : ''}`} aria-hidden="true" />
      {loading ? 'Guardando...' : following ? 'Siguiendo' : 'Seguir'}
    </button>
  );
}
