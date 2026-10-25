import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, CircleAlert, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { authService } from '../api/auth.service';
import { useAuth } from '../context/auth-context';
import Logo from '../components/Logo';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,14}$/;
const CI_RE = /^\d{6,10}$/;
const CI_EXTENSIONS = ['LP', 'SC', 'CB', 'OR', 'PT', 'CH', 'TJ', 'BN', 'PD'];

export default function Register() {
  const [form, setForm] = useState({
    first_name: '',
    paternal_last_name: '',
    maternal_last_name: '',
    email: '',
    password: '',
    confirm: '',
    phone: '',
    age: '',
    ci: '',
    ci_extension: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const set = (key) => (e) => {
    const value = key === 'ci' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value;
    setForm({ ...form, [key]: value });
  };

  const passRules = [
    { label: 'Mínimo 8 caracteres', ok: form.password.length >= 8 },
    { label: 'Una minúscula', ok: /[a-z]/.test(form.password) },
    { label: 'Una mayúscula', ok: /[A-Z]/.test(form.password) },
    { label: 'Un número', ok: /\d/.test(form.password) },
  ];
  const passScore = passRules.filter(r => r.ok).length;
  const strength = passScore <= 2
    ? { label: 'Débil', bar: 'bg-rose-500', text: 'text-rose-400' }
    : passScore === 3
      ? { label: 'Media', bar: 'bg-amber-400', text: 'text-amber-300' }
      : { label: 'Fuerte', bar: 'bg-emerald-500', text: 'text-emerald-400' };

  const validate = () => {
    const fe = {};
    if (!form.first_name.trim()) fe.first_name = 'Escribe tus nombres.';
    if (!form.paternal_last_name.trim()) fe.paternal_last_name = 'Escribe tu apellido paterno.';
    if (!form.maternal_last_name.trim()) fe.maternal_last_name = 'Escribe tu apellido materno.';
    if (!EMAIL_RE.test(form.email.trim())) fe.email = 'El email no es válido.';
    if (passScore < 4) fe.password = 'La contraseña no cumple los requisitos.';
    if (form.confirm !== form.password) fe.confirm = 'Las contraseñas no coinciden.';
    if (!PHONE_RE.test(form.phone.trim())) fe.phone = 'Teléfono no válido (ej: +591 71234567).';
    const age = Number(form.age);
    if (!Number.isInteger(age) || age < 18 || age > 110) fe.age = 'Debes ser mayor de 18 años.';
    if (!CI_RE.test(form.ci.trim())) fe.ci = 'El C.I. solo admite números (ej: 12345678).';
    if (!CI_EXTENSIONS.includes(form.ci_extension)) fe.ci_extension = 'Selecciona la extensión del C.I.';
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSending(true);
    try {
      await authService.register({ ...form, age: Number(form.age) });
      const res = await authService.login(form.email.trim(), form.password);
      if (res.status === 'success') {
        login(res.data.user, res.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(String(err?.message) || 'No se pudo crear la cuenta.');
    } finally {
      setSending(false);
    }
  };

  const inputClass = (key) => `input ${fieldErrors[key] ? 'border-rose-500/60' : ''}`;

  return (
    <div className="relative overflow-hidden">
      <img src="images/hero.png" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/95 via-gray-950/80 to-gray-950/95" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[280px] h-[280px] sm:w-[600px] sm:h-[600px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-lg mx-auto px-6 py-14">
        <div className="card p-8 border border-white/10">
          <div className="flex justify-center mb-5">
            <Logo />
          </div>
          <span className="eyebrow block text-center">Cuenta gratuita</span>
          <h2 className="section-title text-3xl mt-2 mb-2 text-center">Crear Cuenta</h2>
          <p className="text-sm text-gray-400 text-center mb-7">
            Registro como hincha. ¿Eres club?{' '}
            <Link to="/unete" className="text-lime-400 hover:text-lime-300 font-semibold">Únete a Tribuna 360</Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Nombre(s)</label>
              <input type="text" autoComplete="given-name" placeholder="Ej: Juan Carlos"
                value={form.first_name} onChange={set('first_name')} className={inputClass('first_name')} />
              {fieldErrors.first_name && <p className="text-xs text-rose-400 mt-1">{fieldErrors.first_name}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1.5">Apellido paterno</label>
                <input type="text" autoComplete="family-name" placeholder="Ej: Pérez"
                  value={form.paternal_last_name} onChange={set('paternal_last_name')} className={inputClass('paternal_last_name')} />
                {fieldErrors.paternal_last_name && <p className="text-xs text-rose-400 mt-1">{fieldErrors.paternal_last_name}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1.5">Apellido materno</label>
                <input type="text" autoComplete="additional-name" placeholder="Ej: Gómez"
                  value={form.maternal_last_name} onChange={set('maternal_last_name')} className={inputClass('maternal_last_name')} />
                {fieldErrors.maternal_last_name && <p className="text-xs text-rose-400 mt-1">{fieldErrors.maternal_last_name}</p>}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Email</label>
              <input type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com"
                value={form.email} onChange={set('email')} className={inputClass('email')} />
              {fieldErrors.email && <p className="text-xs text-rose-400 mt-1">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Contraseña</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                  placeholder="Crea una contraseña segura"
                  value={form.password} onChange={set('password')} className={`${inputClass('password')} pr-11`} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {form.password && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 grid grid-cols-4 gap-1">
                      {[0, 1, 2, 3].map(i => (
                        <span key={i} className={`h-1 rounded-full ${i < passScore ? strength.bar : 'bg-gray-700'}`} />
                      ))}
                    </div>
                    <span className={`text-xs font-semibold ${strength.text}`}>{strength.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {passRules.map(r => (
                      <span key={r.label} className={`flex items-center gap-1 text-[11px] ${r.ok ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {r.ok ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                        {r.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {fieldErrors.password && <p className="text-xs text-rose-400 mt-1">{fieldErrors.password}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Confirmar contraseña</label>
              <input type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                placeholder="Repite tu contraseña"
                value={form.confirm} onChange={set('confirm')} className={inputClass('confirm')} />
              {fieldErrors.confirm && <p className="text-xs text-rose-400 mt-1">{fieldErrors.confirm}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Teléfono</label>
              <input type="tel" autoComplete="tel" placeholder="+591 71234567"
                value={form.phone} onChange={set('phone')} className={inputClass('phone')} />
              {fieldErrors.phone && <p className="text-xs text-rose-400 mt-1">{fieldErrors.phone}</p>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1.5">Edad</label>
                <input type="number" min="18" max="110" placeholder="Ej: 25"
                  value={form.age} onChange={set('age')} className={inputClass('age')} />
                {fieldErrors.age && <p className="text-xs text-rose-400 mt-1">{fieldErrors.age}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1.5">Carnet (C.I.)</label>
                <input type="text" inputMode="numeric" placeholder="12345678"
                  value={form.ci} onChange={set('ci')} className={inputClass('ci')} />
                {fieldErrors.ci && <p className="text-xs text-rose-400 mt-1">{fieldErrors.ci}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1.5">Extensión</label>
                <select value={form.ci_extension} onChange={set('ci_extension')} className={inputClass('ci_extension')}>
                  <option value="">Ext.</option>
                  {CI_EXTENSIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {fieldErrors.ci_extension && <p className="text-xs text-rose-400 mt-1">{fieldErrors.ci_extension}</p>}
              </div>
            </div>

            <button type="submit" disabled={sending} className="btn btn-primary w-full mt-2">
              {sending && <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />}
              {sending ? 'Creando cuenta...' : 'Registrarme'}
            </button>
          </form>

          {error && (
            <div className="alert-error mt-4 flex items-start gap-2">
              <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-gray-400">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
