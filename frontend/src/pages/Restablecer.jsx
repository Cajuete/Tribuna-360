import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleAlert, CircleCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { authService } from '../api/auth.service';
import Logo from '../components/Logo';

export default function Restablecer() {
  const [token] = useState(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get('access_token');
    window.history.replaceState({}, document.title, window.location.pathname);
    return t || null;
  });
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const fe = {};
    if (form.password.length < 8 || !/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/\d/.test(form.password)) {
      fe.password = 'Mínimo 8 caracteres, con una mayúscula, una minúscula y un número.';
    }
    if (form.confirm !== form.password) fe.confirm = 'Las contraseñas no coinciden.';
    setFieldErrors(fe);
    if (Object.keys(fe).length) return;

    setSending(true);
    try {
      const res = await authService.resetPassword(token, form.password);
      if (res.status === 'success') {
        setDone(true);
        setTimeout(() => navigate('/login', { replace: true }), 2200);
      }
    } catch (err) {
      setError(String(err?.message) || 'No se pudo restablecer la contraseña.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <img src="images/hero.png" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/95 via-gray-950/80 to-gray-950/95" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[280px] h-[280px] sm:w-[600px] sm:h-[600px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-md mx-auto px-6 py-14">
        <div className="card p-8 border border-white/10">
          <div className="flex justify-center mb-5">
            <Logo />
          </div>

          {token === null ? (
            <>
              <div className="flex justify-center mb-4">
                <CircleAlert className="w-10 h-10 text-rose-400" />
              </div>
              <h2 className="section-title text-2xl text-center mb-3">Enlace no válido</h2>
              <p className="text-sm text-gray-400 text-center mb-6">
                Este enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.
              </p>
              <Link to="/olvide-contrasena" className="btn btn-primary w-full text-center block">
                Solicitar nuevo enlace
              </Link>
            </>
          ) : done ? (
            <>
              <div className="flex justify-center mb-4">
                <CircleCheck className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="section-title text-2xl text-center mb-3">¡Contraseña actualizada!</h2>
              <p className="text-sm text-gray-400 text-center">
                Ya puedes iniciar sesión con tu nueva contraseña. Serás redirigido al login...
              </p>
            </>
          ) : (
            <>
              <span className="eyebrow block text-center">Nueva contraseña</span>
              <h2 className="section-title text-3xl mt-2 mb-7 text-center">Restablecer contraseña</h2>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Nueva contraseña"
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      className="input pr-11"
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

                <div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Confirmar contraseña"
                    value={form.confirm}
                    onChange={e => setForm({ ...form, confirm: e.target.value })}
                    className="input"
                  />
                  {fieldErrors.confirm && <p className="text-xs text-rose-400 mt-1">{fieldErrors.confirm}</p>}
                </div>

                <button type="submit" disabled={sending} className="btn btn-primary w-full">
                  {sending && <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />}
                  {sending ? 'Guardando...' : 'Guardar contraseña'}
                </button>
              </form>

              {error && (
                <div className="alert-error mt-4 flex items-start gap-2">
                  <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
