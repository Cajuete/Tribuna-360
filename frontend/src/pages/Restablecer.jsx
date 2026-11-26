import AlertBanner from '../components/AlertBanner';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/auth-context';
import { recoveryCallbackError, recoveryCallbackType, recoveryClient } from '../api/recovery-auth';

export default function Restablecer() {
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [linkError, setLinkError] = useState(
    recoveryClient ? '' : 'Falta configurar la URL y la clave pública de Supabase en el frontend.'
  );
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [signOutWarning, setSignOutWarning] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    if (!recoveryClient) return undefined;

    let active = true;
    const { data: { subscription } } = recoveryClient.auth.onAuthStateChange((event, session) => {
      if (active && event === 'PASSWORD_RECOVERY' && session) {
        setRecoveryReady(true);
      }
    });

    recoveryClient.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) {
          setLinkError('No se pudo validar el enlace. Solicita uno nuevo.');
        } else if (recoveryCallbackError) {
          setLinkError('El enlace no es válido o ha expirado. Solicita uno nuevo.');
        } else if (recoveryCallbackType === 'recovery' && data.session) {
          setRecoveryReady(true);
        } else {
          setLinkError('El enlace no es válido o ha expirado. Solicita uno nuevo.');
        }
      })
      .catch(() => {
        if (active) setLinkError('No se pudo validar el enlace. Solicita uno nuevo.');
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const nextErrors = {};
    if (form.password.length < 8 || !/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/\d/.test(form.password)) {
      nextErrors.password = 'Mínimo 8 caracteres, con una mayúscula, una minúscula y un número.';
    }
    if (form.confirm !== form.password) nextErrors.confirm = 'Las contraseñas no coinciden.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!recoveryClient || !recoveryReady) {
      setError('El enlace de recuperación no está activo. Solicita uno nuevo.');
      return;
    }

    setSending(true);
    try {
      const { error: updateError } = await recoveryClient.auth.updateUser({ password: form.password });
      if (updateError) throw updateError;

      const { error: signOutError } = await recoveryClient.auth.signOut({ scope: 'global' });
      if (signOutError) {
        console.error('[PasswordRecovery] La contraseña cambió, pero no se pudieron cerrar todas las sesiones:', signOutError.message);
        setSignOutWarning('La contraseña se cambió, pero no se pudieron cerrar las demás sesiones. Vuelve a iniciar sesión y contacta al soporte si notas actividad desconocida.');
      }

      logout();
      setRecoveryReady(false);
      setDone(true);
    } catch (requestError) {
      console.error('[PasswordRecovery] No se pudo actualizar la contraseña:', requestError.message);
      setError('No se pudo cambiar la contraseña. El enlace quizá expiró o ya fue utilizado; solicita uno nuevo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <img src="images/hero.png" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-contain" />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/95 via-gray-950/80 to-gray-950/95" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[280px] h-[280px] sm:w-[600px] sm:h-[600px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-md mx-auto px-6 py-14">
        <div className="card p-8 border border-white/10">
          <div className="flex justify-center mb-5">
            <Logo />
          </div>

          {done ? (
            <>
              <div className="flex justify-center mb-4">
                <CircleCheck className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="section-title text-2xl text-center mb-3">¡Contraseña actualizada!</h2>
              <p className="text-sm text-gray-400 text-center mb-6">
                La contraseña anterior ya no sirve para iniciar sesión. Este dispositivo cerró sesión; vuelve a entrar con tu nueva contraseña.
              </p>
              <AlertBanner message={signOutWarning} type="info" onClose={() => setSignOutWarning(null)} className="text-sm text-amber-300 text-center mb-5" />
              <Link to="/login" className="btn btn-primary w-full text-center block">Ir a iniciar sesión</Link>
            </>
          ) : linkError ? (
            <>
              <div className="flex justify-center mb-4">
                <CircleAlert className="w-10 h-10 text-rose-400" />
              </div>
              <h2 className="section-title text-2xl text-center mb-3">Enlace no disponible</h2>
              <p className="text-sm text-gray-400 text-center mb-6">{linkError}</p>
              <Link to="/olvide-contrasena" className="btn btn-primary w-full text-center block">Solicitar nuevo enlace</Link>
            </>
          ) : !recoveryReady ? (
            <div className="py-8 text-center text-gray-300">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
              Validando el enlace de recuperación...
            </div>
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
                      onClick={() => setShowPassword(value => !value)}
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

              <AlertBanner message={error} type="error" onClose={() => setError(null)} className="mt-4" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
