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
const MAX_NAME_LENGTH = 100;
const PERSON_NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]*$/;

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
  const [success, setSuccess] = useState(null);
  const [sending, setSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const set = (key) => (e) => {
    const value = key === 'ci' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value;
    setForm(current => ({ ...current, [key]: value }));
    setFieldErrors(current => ({
      ...current,
      [key]: undefined,
      ...(key === 'password' ? { confirm: undefined } : {}),
    }));
    setError(null);
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
    else if (form.first_name.trim().length > MAX_NAME_LENGTH) fe.first_name = 'Usa hasta 100 caracteres.';
    else if (!PERSON_NAME_RE.test(form.first_name.trim())) fe.first_name = 'El nombre solo puede incluir letras, espacios, apóstrofes o guiones.';
    if (!form.paternal_last_name.trim()) fe.paternal_last_name = 'Escribe tu apellido paterno.';
    else if (form.paternal_last_name.trim().length > MAX_NAME_LENGTH) fe.paternal_last_name = 'Usa hasta 100 caracteres.';
    else if (!PERSON_NAME_RE.test(form.paternal_last_name.trim())) fe.paternal_last_name = 'El apellido solo puede incluir letras, espacios, apóstrofes o guiones.';
    if (!form.maternal_last_name.trim()) fe.maternal_last_name = 'Escribe tu apellido materno.';
    else if (form.maternal_last_name.trim().length > MAX_NAME_LENGTH) fe.maternal_last_name = 'Usa hasta 100 caracteres.';
    else if (!PERSON_NAME_RE.test(form.maternal_last_name.trim())) fe.maternal_last_name = 'El apellido solo puede incluir letras, espacios, apóstrofes o guiones.';
    if (!EMAIL_RE.test(form.email.trim()) || form.email.trim().length > 254) fe.email = 'Escribe un email válido (máximo 254 caracteres).';
    if (form.password.length > 128) fe.password = 'La contraseña no puede superar 128 caracteres.';
    else if (passScore < 4) fe.password = 'La contraseña no cumple los requisitos.';
    if (form.confirm !== form.password) fe.confirm = 'Las contraseñas no coinciden.';
    if (!PHONE_RE.test(form.phone.trim())) fe.phone = 'Teléfono no válido (ej: +591 71234567).';
    const age = Number(form.age);
    if (!Number.isInteger(age) || age < 18 || age > 110) fe.age = 'Debes ser mayor de 18 años.';
    if (!CI_RE.test(form.ci.trim())) fe.ci = 'El C.I. solo admite números (ej: 12345678).';
    if (!CI_EXTENSIONS.includes(form.ci_extension)) fe.ci_extension = 'Selecciona la extensión del C.I.';
    setFieldErrors(fe);
    return fe;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      document.getElementById(Object.keys(validationErrors)[0])?.focus();
      return;
    }
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const regRes = await authService.register({
        ...form,
        first_name: form.first_name.trim(),
        paternal_last_name: form.paternal_last_name.trim(),
        maternal_last_name: form.maternal_last_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        age: Number(form.age),
        ci: form.ci.trim(),
        ci_extension: form.ci_extension.toUpperCase(),
      });
      const requiresVerification = regRes?.data?.requires_verification === true;

      if (requiresVerification) {
        const msg = 'Cuenta creada. Revisa tu correo para verificar tu cuenta antes de iniciar sesión.';
        setSuccess(msg);
        setTimeout(() => navigate('/login', { state: { message: msg }, replace: true }), 1800);
        return;
      }

      setSuccess('Cuenta creada exitosamente. Iniciando sesión...');
      try {
        const loginRes = await authService.login(form.email.trim().toLowerCase(), form.password);
        if (loginRes.status === 'success') {
          login(loginRes.data.user, loginRes.data.token);
          setTimeout(() => navigate('/', { replace: true }), 900);
          return;
        }
      } catch (error) {
        console.debug('[Register] El inicio automático falló; la cuenta quedó creada:', error);
      }

      const msg = 'Cuenta creada. Ya puedes iniciar sesión.';
      setSuccess(msg);
      setTimeout(() => navigate('/login', { state: { message: msg }, replace: true }), 1200);
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
              <label htmlFor="first_name" className="text-xs font-semibold text-gray-400 block mb-1.5">Nombre(s)</label>
              <input id="first_name" name="first_name" type="text" autoComplete="given-name" maxLength={MAX_NAME_LENGTH} required aria-invalid={Boolean(fieldErrors.first_name)} aria-describedby={fieldErrors.first_name ? 'first_name-error' : undefined} placeholder="Ej: Juan Carlos"
                value={form.first_name} onChange={set('first_name')} className={inputClass('first_name')} />
              {fieldErrors.first_name && <p id="first_name-error" className="text-xs text-rose-400 mt-1">{fieldErrors.first_name}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="paternal_last_name" className="text-xs font-semibold text-gray-400 block mb-1.5">Apellido paterno</label>
                <input id="paternal_last_name" name="paternal_last_name" type="text" autoComplete="family-name" maxLength={MAX_NAME_LENGTH} required aria-invalid={Boolean(fieldErrors.paternal_last_name)} aria-describedby={fieldErrors.paternal_last_name ? 'paternal_last_name-error' : undefined} placeholder="Ej: Pérez"
                  value={form.paternal_last_name} onChange={set('paternal_last_name')} className={inputClass('paternal_last_name')} />
                {fieldErrors.paternal_last_name && <p id="paternal_last_name-error" className="text-xs text-rose-400 mt-1">{fieldErrors.paternal_last_name}</p>}
              </div>
              <div>
                <label htmlFor="maternal_last_name" className="text-xs font-semibold text-gray-400 block mb-1.5">Apellido materno</label>
                <input id="maternal_last_name" name="maternal_last_name" type="text" autoComplete="additional-name" maxLength={MAX_NAME_LENGTH} required aria-invalid={Boolean(fieldErrors.maternal_last_name)} aria-describedby={fieldErrors.maternal_last_name ? 'maternal_last_name-error' : undefined} placeholder="Ej: Gómez"
                  value={form.maternal_last_name} onChange={set('maternal_last_name')} className={inputClass('maternal_last_name')} />
                {fieldErrors.maternal_last_name && <p id="maternal_last_name-error" className="text-xs text-rose-400 mt-1">{fieldErrors.maternal_last_name}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="text-xs font-semibold text-gray-400 block mb-1.5">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'email-error' : undefined} placeholder="tucorreo@ejemplo.com"
                value={form.email} onChange={set('email')} className={inputClass('email')} />
              {fieldErrors.email && <p id="email-error" className="text-xs text-rose-400 mt-1">{fieldErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="text-xs font-semibold text-gray-400 block mb-1.5">Contraseña</label>
              <div className="relative">
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" maxLength={128} required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'password-error' : undefined}
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
              {fieldErrors.password && <p id="password-error" className="text-xs text-rose-400 mt-1">{fieldErrors.password}</p>}
            </div>

            <div>
              <label htmlFor="confirm" className="text-xs font-semibold text-gray-400 block mb-1.5">Confirmar contraseña</label>
              <input id="confirm" name="confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" maxLength={128} required aria-invalid={Boolean(fieldErrors.confirm)} aria-describedby={fieldErrors.confirm ? 'confirm-error' : undefined}
                placeholder="Repite tu contraseña"
                value={form.confirm} onChange={set('confirm')} className={inputClass('confirm')} />
              {fieldErrors.confirm && <p id="confirm-error" className="text-xs text-rose-400 mt-1">{fieldErrors.confirm}</p>}
            </div>

            <div>
              <label htmlFor="phone" className="text-xs font-semibold text-gray-400 block mb-1.5">Teléfono</label>
              <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={16} required aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'phone-error' : undefined} placeholder="+591 71234567"
                value={form.phone} onChange={set('phone')} className={inputClass('phone')} />
              {fieldErrors.phone && <p id="phone-error" className="text-xs text-rose-400 mt-1">{fieldErrors.phone}</p>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="age" className="text-xs font-semibold text-gray-400 block mb-1.5">Edad</label>
                <input id="age" name="age" type="number" min="18" max="110" step="1" required aria-invalid={Boolean(fieldErrors.age)} aria-describedby={fieldErrors.age ? 'age-error' : undefined} placeholder="Ej: 25"
                  value={form.age} onChange={set('age')} className={inputClass('age')} />
                {fieldErrors.age && <p id="age-error" className="text-xs text-rose-400 mt-1">{fieldErrors.age}</p>}
              </div>
              <div>
                <label htmlFor="ci" className="text-xs font-semibold text-gray-400 block mb-1.5">Carnet (C.I.)</label>
                <input id="ci" name="ci" type="text" inputMode="numeric" maxLength={10} required aria-invalid={Boolean(fieldErrors.ci)} aria-describedby={fieldErrors.ci ? 'ci-error' : undefined} placeholder="12345678"
                  value={form.ci} onChange={set('ci')} className={inputClass('ci')} />
                {fieldErrors.ci && <p id="ci-error" className="text-xs text-rose-400 mt-1">{fieldErrors.ci}</p>}
              </div>
              <div>
                <label htmlFor="ci_extension" className="text-xs font-semibold text-gray-400 block mb-1.5">Extensión</label>
                <select id="ci_extension" name="ci_extension" value={form.ci_extension} onChange={set('ci_extension')} className={inputClass('ci_extension')} required aria-invalid={Boolean(fieldErrors.ci_extension)} aria-describedby={fieldErrors.ci_extension ? 'ci_extension-error' : undefined}>
                  <option value="">Ext.</option>
                  {CI_EXTENSIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {fieldErrors.ci_extension && <p id="ci_extension-error" className="text-xs text-rose-400 mt-1">{fieldErrors.ci_extension}</p>}
              </div>
            </div>

            <button type="submit" disabled={sending} className="btn btn-primary w-full mt-2">
              {sending && <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />}
              {sending ? 'Creando cuenta...' : 'Registrarme'}
            </button>
          </form>

          {success && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-900/40 p-3 text-sm text-emerald-300">
              <Check className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

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
