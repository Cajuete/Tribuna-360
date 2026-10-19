import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../api/auth.service';
import { useAuth } from '../context/auth-context';

export default function Register() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await authService.register(form);
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
        <span className="eyebrow block text-center">Cuenta gratuita</span>
        <h2 className="section-title text-3xl mt-2 mb-7 text-center">Crear Cuenta</h2>
        <p className="text-sm text-gray-400 text-center mb-6">
          Registro como hincha (fan). ¿Eres club? Únete a Tribuna 360 desde la página de inicio.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Nombre completo"
            value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
            required
            className="input"
          />
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
            placeholder="Contraseña (mínimo 6 caracteres)"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
            minLength={6}
            className="input"
          />
          <button
            type="submit"
            disabled={sending}
            className="btn btn-primary w-full"
          >
            {sending ? 'Creando cuenta...' : 'Registrarme'}
          </button>
        </form>

        {error && <p className="mt-4 alert-error">{error}</p>}

        <p className="mt-6 text-center text-sm text-gray-400">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
