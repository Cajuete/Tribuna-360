import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../context/auth-context';
import { userService } from '../api/user.service';

const CI_EXTENSIONS = ['LP', 'SC', 'CB', 'OR', 'PT', 'CH', 'TJ', 'BN', 'PD'];
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,14}$/;
const CI_RE = /^\d{6,10}$/;
const MAX_NAME_LENGTH = 100;
const PERSON_NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]*$/;

const PRESET_AVATARS = [
  { id: 'av1', bg: 'from-emerald-500 to-lime-500', label: 'Verde Tribuna' },
  { id: 'av2', bg: 'from-blue-600 to-cyan-500', label: 'Azul Pasión' },
  { id: 'av3', bg: 'from-purple-600 to-pink-600', label: 'Purpura Glitch' },
  { id: 'av4', bg: 'from-amber-500 to-red-600', label: 'Fuego Hincha' },
  { id: 'av5', bg: 'from-slate-700 to-slate-900', label: 'Clásico Oscuro' },
  { id: 'av6', bg: 'from-rose-500 to-orange-500', label: 'Atardecer Gol' },
];

export default function MyProfile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    first_name: '',
    paternal_last_name: '',
    maternal_last_name: '',
    phone: '',
    age: '',
    ci: '',
    ci_extension: '',
  });
  const [selectedAvatar, setSelectedAvatar] = useState('av1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    userService.getMe()
      .then(res => {
        if (res.status === 'success') {
          const u = res.data;
          setForm({
            first_name: u.first_name || '',
            paternal_last_name: u.paternal_last_name || '',
            maternal_last_name: u.maternal_last_name || '',
            phone: u.phone || '',
            age: u.age ? String(u.age) : '',
            ci: u.ci || '',
            ci_extension: u.ci_extension || '',
          });
          const savedAv = localStorage.getItem(`t360_avatar_${u.id}`) || 'av1';
          setSelectedAvatar(savedAv);
        } else {
          setError(res.message || 'No se pudo cargar tu perfil.');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (key) => (e) => {
    const value = key === 'ci' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value;
    setForm(current => ({ ...current, [key]: value }));
    setFieldErrors(current => ({ ...current, [key]: undefined }));
    setError(null);
    setSuccess(null);
  };

  const handleAvatarSelect = (avId) => {
    setSelectedAvatar(avId);
    if (user?.id) {
      localStorage.setItem(`t360_avatar_${user.id}`, avId);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const errors = {};
    for (const [field, label] of [
      ['first_name', 'Escribe tus nombres.'],
      ['paternal_last_name', 'Escribe tu apellido paterno.'],
      ['maternal_last_name', 'Escribe tu apellido materno.'],
    ]) {
      const value = form[field].trim();
      if (!value) errors[field] = label;
      else if (value.length > MAX_NAME_LENGTH) errors[field] = 'Usa hasta 100 caracteres.';
      else if (!PERSON_NAME_RE.test(value)) errors[field] = 'Solo puede incluir letras, espacios, apóstrofes o guiones.';
    }
    if (!PHONE_RE.test(form.phone.trim())) errors.phone = 'Teléfono no válido (ej: +591 71234567).';
    const age = Number(form.age);
    if (!form.age || !Number.isInteger(age) || age < 18 || age > 110) {
      errors.age = 'La edad debe ser un número entero entre 18 y 110.';
    }
    if (!CI_RE.test(form.ci.trim())) errors.ci = 'El C.I. debe tener entre 6 y 10 dígitos.';
    if (!CI_EXTENSIONS.includes(form.ci_extension)) errors.ci_extension = 'Selecciona la extensión del C.I.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      document.getElementById(Object.keys(errors)[0])?.focus();
      return;
    }
    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        paternal_last_name: form.paternal_last_name.trim(),
        maternal_last_name: form.maternal_last_name.trim(),
        phone: form.phone.trim(),
        age: form.age ? Number(form.age) : null,
        ci: form.ci.trim(),
        ci_extension: form.ci_extension || null,
      };
      const res = await userService.updateMe(payload);
      if (res.status === 'success') {
        setSuccess('Perfil actualizado correctamente.');
        if (setUser) setUser(res.data);
      } else {
        setError(res.message || 'No se pudo actualizar el perfil.');
      }
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-center text-gray-400 py-16">Cargando tu perfil...</p>;

  const currentAvObj = PRESET_AVATARS.find(a => a.id === selectedAvatar) || PRESET_AVATARS[0];
  const initials = [form.first_name?.[0], form.paternal_last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'U';

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-bold mb-2">Mi Perfil</h2>
      <p className="text-sm text-gray-400 mb-8">Personaliza tu avatar circular y actualiza tus datos de hincha.</p>

      {/* Avatar Circular Selector */}
      <div className="card p-6 mb-8 text-center border border-slate-700">
        <div className={`w-24 h-24 rounded-full mx-auto bg-gradient-to-tr ${currentAvObj.bg} flex items-center justify-center text-white text-3xl font-display font-extrabold shadow-xl border-4 border-slate-900 mb-4`}>
          {initials}
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Elige tu Avatar Circular</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {PRESET_AVATARS.map(av => (
            <button
              key={av.id}
              type="button"
              onClick={() => handleAvatarSelect(av.id)}
              className={`w-12 h-12 rounded-full bg-gradient-to-tr ${av.bg} flex items-center justify-center transition transform hover:scale-110 shadow-md relative ${
                selectedAvatar === av.id ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-slate-950 scale-105' : 'opacity-80 hover:opacity-100'
              }`}
              title={av.label}
            >
              {selectedAvatar === av.id && <Check className="w-5 h-5 text-white drop-shadow" />}
            </button>
          ))}
        </div>
      </div>

      {user && (
        <div className="mb-6 p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Correo Electrónico</p>
          <p className="font-bold text-white mt-0.5">{user.email}</p>
        </div>
      )}

      {error && <p className="mb-4 alert-error">{error}</p>}
      {success && <p className="mb-4 alert-ok">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="first_name" className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Nombres</label>
            <input id="first_name" name="first_name" type="text" autoComplete="given-name" maxLength={MAX_NAME_LENGTH} value={form.first_name} onChange={set('first_name')} className={`input ${fieldErrors.first_name ? 'border-rose-500/60' : ''}`} aria-invalid={Boolean(fieldErrors.first_name)} aria-describedby={fieldErrors.first_name ? 'first_name-error' : undefined} required />
            {fieldErrors.first_name && <p id="first_name-error" className="text-xs text-rose-400 mt-1">{fieldErrors.first_name}</p>}
          </div>
          <div>
            <label htmlFor="paternal_last_name" className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Apellido paterno</label>
            <input id="paternal_last_name" name="paternal_last_name" type="text" autoComplete="family-name" maxLength={MAX_NAME_LENGTH} value={form.paternal_last_name} onChange={set('paternal_last_name')} className={`input ${fieldErrors.paternal_last_name ? 'border-rose-500/60' : ''}`} aria-invalid={Boolean(fieldErrors.paternal_last_name)} aria-describedby={fieldErrors.paternal_last_name ? 'paternal_last_name-error' : undefined} required />
            {fieldErrors.paternal_last_name && <p id="paternal_last_name-error" className="text-xs text-rose-400 mt-1">{fieldErrors.paternal_last_name}</p>}
          </div>
          <div>
            <label htmlFor="maternal_last_name" className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Apellido materno</label>
            <input id="maternal_last_name" name="maternal_last_name" type="text" autoComplete="additional-name" maxLength={MAX_NAME_LENGTH} value={form.maternal_last_name} onChange={set('maternal_last_name')} className={`input ${fieldErrors.maternal_last_name ? 'border-rose-500/60' : ''}`} aria-invalid={Boolean(fieldErrors.maternal_last_name)} aria-describedby={fieldErrors.maternal_last_name ? 'maternal_last_name-error' : undefined} required />
            {fieldErrors.maternal_last_name && <p id="maternal_last_name-error" className="text-xs text-rose-400 mt-1">{fieldErrors.maternal_last_name}</p>}
          </div>
          <div>
            <label htmlFor="phone" className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Teléfono</label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={16} placeholder="+591 71234567" value={form.phone} onChange={set('phone')} className={`input ${fieldErrors.phone ? 'border-rose-500/60' : ''}`} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'phone-error' : undefined} required />
            {fieldErrors.phone && <p id="phone-error" className="text-xs text-rose-400 mt-1">{fieldErrors.phone}</p>}
          </div>
          <div>
            <label htmlFor="age" className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Edad</label>
            <input id="age" name="age" type="number" min="18" max="110" step="1" value={form.age} onChange={set('age')} className={`input ${fieldErrors.age ? 'border-rose-500/60' : ''}`} aria-invalid={Boolean(fieldErrors.age)} aria-describedby={fieldErrors.age ? 'age-error' : undefined} required />
            {fieldErrors.age && <p id="age-error" className="text-xs text-rose-400 mt-1">{fieldErrors.age}</p>}
          </div>
          <div>
            <label htmlFor="ci" className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Carnet (C.I.)</label>
            <input id="ci" name="ci" type="text" inputMode="numeric" maxLength={10} value={form.ci} onChange={set('ci')} className={`input ${fieldErrors.ci ? 'border-rose-500/60' : ''}`} aria-invalid={Boolean(fieldErrors.ci)} aria-describedby={fieldErrors.ci ? 'ci-error' : undefined} required />
            {fieldErrors.ci && <p id="ci-error" className="text-xs text-rose-400 mt-1">{fieldErrors.ci}</p>}
          </div>
          <div>
            <label htmlFor="ci_extension" className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Extensión</label>
            <select id="ci_extension" name="ci_extension" value={form.ci_extension} onChange={set('ci_extension')} className={`input ${fieldErrors.ci_extension ? 'border-rose-500/60' : ''}`} aria-invalid={Boolean(fieldErrors.ci_extension)} aria-describedby={fieldErrors.ci_extension ? 'ci_extension-error' : undefined} required>
              <option value="">Selecciona ext.</option>
              {CI_EXTENSIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {fieldErrors.ci_extension && <p id="ci_extension-error" className="text-xs text-rose-400 mt-1">{fieldErrors.ci_extension}</p>}
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn btn-primary w-full mt-4 py-3 font-bold">
          {saving ? 'Guardando...' : 'Guardar Cambios de Perfil'}
        </button>
      </form>

    </div>
  );
}
