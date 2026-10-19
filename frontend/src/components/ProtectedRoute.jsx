import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

export default function ProtectedRoute({ roles, children }) {
  const { token, user, loading } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <p className="text-center text-gray-400 py-16">Cargando sesión...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
