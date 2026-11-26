import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

export default function FanOnlyRoute({ children, allowGuest = false }) {
  const { token, user, loading } = useAuth();

  if (loading) return <p className="text-center text-gray-400 py-16">Cargando sesión...</p>;
  if (!token) return allowGuest ? children : <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'fan') return children;

  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="card p-8 border border-slate-700">
        <h1 className="text-2xl font-bold text-white">Área exclusiva para hinchas</h1>
        <p className="mt-3 text-gray-300">
          Esta sesión pertenece al personal del club y está reservada para sus funciones. Para comprar,
          cierra sesión e ingresa o crea una cuenta de hincha independiente.
        </p>
        <Link to="/" className="btn btn-outline mt-6 inline-flex px-5 py-2.5">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
