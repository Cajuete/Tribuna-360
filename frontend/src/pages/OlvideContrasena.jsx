import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CircleAlert, CircleCheck, Loader2, Mail } from 'lucide-react';
import { authService } from '../api/auth.service';
import Logo from '../components/Logo';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OlvideContrasena() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError('Escribe un email válido.');
      return;
    }
    setSending(true);
    try {
      const res = await authService.forgotPassword(email.trim());
      if (res.status === 'success') setSent(true);
    } catch (err) {
      setError(String(err?.message) || 'No se pudo enviar el correo.');
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

          {sent ? (
            <>
              <div className="flex justify-center mb-4">
                <CircleCheck className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="section-title text-2xl text-center mb-3">Correo enviado</h2>
              <p className="text-gray-300 text-center text-sm">
                Si existe una cuenta con <span className="text-white font-semibold">{email.trim()}</span>,
                recibirás un correo con las instrucciones para restablecer tu contraseña.
              </p>
              <p className="text-xs text-gray-500 text-center mt-3">
                Revisa la carpeta de spam si no lo ves en unos minutos.
              </p>
              <Link to="/login" className="btn btn-primary w-full mt-6 text-center block">
                Volver a iniciar sesión
              </Link>
            </>
          ) : (
            <>
              <span className="eyebrow block text-center">Recuperar acceso</span>
              <h2 className="section-title text-3xl mt-2 mb-3 text-center">¿Olvidaste tu contraseña?</h2>
              <p className="text-sm text-gray-400 text-center mb-7">
                Escribe el email de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input pl-10"
                  />
                </div>

                <button type="submit" disabled={sending} className="btn btn-primary w-full">
                  {sending && <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />}
                  {sending ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </form>

              {error && (
                <div className="alert-error mt-4 flex items-start gap-2">
                  <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Link
                to="/login"
                className="mt-6 flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a iniciar sesión
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
