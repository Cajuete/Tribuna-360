import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, CircleAlert, Loader2 } from 'lucide-react';
import { authService } from '../api/auth.service';
import { useAuth } from '../context/auth-context';
import Logo from '../components/Logo';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const homeFor = (role) => {
  if (role === 'superadmin' || role === 'club_admin') return '/admin';
  if (role === 'gate_operator') return '/scanner';
  return '/';
};

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const fe = {};
    if (!form.email.trim()) fe.email = 'Escribe tu email.';
    else if (!EMAIL_RE.test(form.email.trim())) fe.email = 'El formato del email no es válido.';
    if (!form.password) fe.password = 'Escribe tu contraseña.';
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSending(true);
    try {
      const res = await authService.login(form.email.trim(), form.password);
      if (res.status === 'success') {
        login(res.data.user, res.data.token, remember);
        navigate(homeFor(res.data.user?.role), { replace: true });
      }
    } catch (err) {
      const msg = String(err?.message || '');
      setError(
        msg.includes('fetch') || msg.includes('Network')
          ? 'No se pudo conectar con el servidor. Revisa que el backend esté activo.'
          : msg || 'No se pudo iniciar sesión.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <img src="images/hero.png" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/95 via-gray-950/80 to-gray-950/95" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-md mx-auto px-6 py-14">
        <div className="card p-8 border border-white/10">
          <div className="flex justify-center mb-5">
            <Logo />
          </div>
          <span className="eyebrow block text-center">Bienvenido de nuevo</span>
          <h2 className="section-title text-3xl mt-2 mb-7 text-center">Iniciar Sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input pl-10"
                />
              </div>
              {fieldErrors.email && <p className="text-xs text-rose-400 mt-1">{fieldErrors.email}</p>}
            </div>

            <div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Contraseña"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="input pl-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-xs text-rose-400 mt-1">{fieldErrors.password}</p>}
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4"
                />
                Recordarme
              </label>
              <Link to="/olvide-contrasena" className="text-emerald-400 hover:text-emerald-300 font-semibold">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button type="submit" disabled={sending} className="btn btn-primary w-full">
              {sending && <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />}
              {sending ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {error && (
            <div className="alert-error mt-4 flex items-start gap-2">
              <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

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
    </div>
  );
}
