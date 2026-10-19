import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../api/auth.service';
import { useAuth } from '../context/auth-context';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await authService.login(form.email, form.password);
      if (res.status === 'success') {
        login(res.data.user, res.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <div className="card p-8">
        <span className="eyebrow block text-center">Bienvenido de nuevo</span>
        <h2 className="section-title text-3xl mt-2 mb-7 text-center">Iniciar Sesión</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
            className="input"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
            className="input"
          />
          <button
            type="submit"
            disabled={sending}
            className="btn btn-primary w-full"
          >
            {sending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {error && <p className="mt-4 alert-error">{error}</p>}

        <p className="mt-6 text-center text-sm text-gray-400">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="text-emerald-400 hover:text-emerald-300 font-semibold">
            Regístrate
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-gray-500">
          ¿Eres club?{' '}
          <Link to="/unete" className="text-lime-400 hover:text-lime-300 font-semibold">
            Únete a Tribuna 360
          </Link>
        </p>
      </div>
    </div>
  );
}
