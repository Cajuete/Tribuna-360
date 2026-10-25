import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Check } from 'lucide-react';
import { useAuth } from '../context/auth-context';
import { userService } from '../api/user.service';

const CI_EXTENSIONS = ['LP', 'SC', 'CB', 'OR', 'PT', 'CH', 'TJ', 'BN', 'PD'];

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
    setForm({ ...form, [key]: value });
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Nombres</label>
            <input type="text" value={form.first_name} onChange={set('first_name')} className="input" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Apellido paterno</label>
            <input type="text" value={form.paternal_last_name} onChange={set('paternal_last_name')} className="input" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Apellido materno</label>
            <input type="text" value={form.maternal_last_name} onChange={set('maternal_last_name')} className="input" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Teléfono</label>
            <input type="tel" value={form.phone} onChange={set('phone')} className="input" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Edad</label>
            <input type="number" min="18" max="110" value={form.age} onChange={set('age')} className="input" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Carnet (C.I.)</label>
            <input type="text" inputMode="numeric" value={form.ci} onChange={set('ci')} className="input" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Extensión</label>
            <select value={form.ci_extension} onChange={set('ci_extension')} className="input" required>
              <option value="">Selecciona ext.</option>
              {CI_EXTENSIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn btn-primary w-full mt-4 py-3 font-bold">
          {saving ? 'Guardando...' : 'Guardar Cambios de Perfil'}
        </button>
      </form>

    </div>
  );
}
