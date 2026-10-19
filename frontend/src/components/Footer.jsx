import { Link } from 'react-router-dom';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-black/40">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <Logo />
          <p className="text-gray-400 text-sm mt-4 max-w-md">
            Plataforma multi-club para la venta de entradas digitales con QR, merchandising oficial y
            administración de socios. Cada club, su grada, su tienda, su gente.
          </p>
          <div className="hairline mt-6 max-w-xs" />
        </div>

        <div>
          <h4 className="text-white font-display font-bold text-sm uppercase tracking-widest mb-4">
            Plataforma
          </h4>
          <ul className="space-y-2.5 text-sm text-gray-400">
            <li><Link to="/" className="hover:text-emerald-400 transition">Partidos y entradas</Link></li>
            <li><Link to="/tienda" className="hover:text-emerald-400 transition">Tienda del club</Link></li>
            <li><Link to="/socios" className="hover:text-emerald-400 transition">Hazte socio</Link></li>
            <li><Link to="/registro" className="hover:text-emerald-400 transition">Cuenta de hincha</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-display font-bold text-sm uppercase tracking-widest mb-4">
            Para clubes
          </h4>
          <ul className="space-y-2.5 text-sm text-gray-400">
            <li><Link to="/unete" className="hover:text-emerald-400 transition">Únete a Tribuna 360</Link></li>
            <li><Link to="/login" className="hover:text-emerald-400 transition">Panel del club</Link></li>
            <li><Link to="/scanner" className="hover:text-emerald-400 transition">Validador QR</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 text-center text-xs text-gray-500">
        © 2026 Tribuna 360 — Tesis de Ingeniería de Software · Federación Boliviana de Fútbol
      </div>
    </footer>
  );
}
