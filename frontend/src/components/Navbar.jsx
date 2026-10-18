import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { token, logout } = useAuth();

  return (
    <header className="bg-gray-800 border-b border-gray-700 py-4 px-6 shadow-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-extrabold text-emerald-400 flex items-center gap-2">
          🏟️ Tribuna 360
        </Link>
        <nav className="space-x-6 flex items-center">
          <Link to="/" className="text-gray-300 hover:text-emerald-400 transition">Partidos</Link>
          <Link to="/scanner" className="text-gray-300 hover:text-emerald-400 transition">Validador QR</Link>
          <Link to="/admin" className="text-gray-300 hover:text-emerald-400 transition">Admin</Link>

          {token ? (
            <button onClick={logout} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm transition">
              Cerrar Sesión
            </button>
          ) : (
            <Link to="/login" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm transition">
              Iniciar Sesión
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}