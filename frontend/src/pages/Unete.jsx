import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { associationService } from '../api/association.service';
import { clubRequestService } from '../api/clubRequest.service';
import { authService } from '../api/auth.service';
import { uploadService } from '../api/upload.service';
import { useAuth } from '../context/auth-context';

const inputCls = 'input';

export default function Unete() {
  const [step, setStep] = useState(1);
  const [associations, setAssociations] = useState([]);
  const [club, setClub] = useState({
    club_name: '',
    stadium_name: '',
    stadium_capacity: '',
    association_id: '',
    department: '',
    personeria: '',
    run_code: '',
  });
  const [account, setAccount] = useState({ full_name: '', email: '', password: '' });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    associationService
      .getAll()
      .then(res => {
        if (res.status === 'success') setAssociations(res.data);
      })
      .catch(() => {});
  }, []);

  const handleAssociation = id => {
    const a = associations.find(x => x.id === id);
    setClub({ ...club, association_id: id, department: a ? a.department : '' });
  };

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const handleLogo = e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setError(null);
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Formato no permitido. Sube una imagen PNG, JPG o WEBP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen supera el máximo de 2 MB.');
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const goStep2 = e => {
    e.preventDefault();
    setError(null);
    if (!club.club_name.trim() || !club.stadium_name.trim() ||
        !Number.isInteger(Number(club.stadium_capacity)) || Number(club.stadium_capacity) < 1 ||
        !club.association_id) {
      setError('Completa nombre del club, estadio, capacidad y asociación para continuar.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      let logo_url = null;
      if (logoFile) {
        const upload = await uploadService.clubLogo(logoFile);
        logo_url = upload.data.url;
      }

      await clubRequestService.register({
        ...club,
        club_name: club.club_name.trim(),
        stadium_name: club.stadium_name.trim(),
        stadium_capacity: Number(club.stadium_capacity),
        logo_url,
        personeria: club.personeria.trim() || null,
        run_code: club.run_code.trim() || null,
        contact_email: account.email.trim(),
        full_name: account.full_name.trim(),
        password: account.password,
      });
      const res = await authService.login(account.email.trim(), account.password);
      if (res.status === 'success') {
        login(res.data.user, res.data.token);
        navigate('/admin');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="card p-8">
        <span className="eyebrow block text-center">Alta de club</span>
        <h2 className="section-title text-3xl mt-2 text-center">Únete a Tribuna 360</h2>
        <p className="text-sm text-gray-400 text-center mt-2">
          Publica tu club, vende entradas, productos y socios en una sola plataforma.
        </p>

        <div className="flex items-center justify-center gap-3 my-6 text-sm">
          <span className={`px-3 py-1 rounded-full ${step === 1 ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-emerald-400 border border-emerald-700'}`}>
            1. Datos del club
          </span>
          <span className="text-gray-500">→</span>
          <span className={`px-3 py-1 rounded-full ${step === 2 ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700'}`}>
            2. Tu cuenta de administrador
          </span>
        </div>

        {error && <p className="mb-4 alert-error">{error}</p>}

        {step === 1 && (
          <form onSubmit={goStep2} className="space-y-4">
            <input
              type="text"
              placeholder="Nombre del club"
              value={club.club_name}
              onChange={e => setClub({ ...club, club_name: e.target.value })}
              required
              className={inputCls}
            />
            <div>
              <label className="block text-sm text-gray-300 mb-2">Escudo del club (opcional)</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl border border-white/15 bg-black/40 flex items-center justify-center overflow-hidden shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Vista previa del escudo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="text-2xl text-gray-500">+</span>
                  )}
                </div>
                <div className="flex-1">
                  <label className="btn btn-outline py-2 px-4 text-sm cursor-pointer inline-flex">
                    {logoFile ? 'Cambiar imagen' : 'Subir imagen'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogo}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">PNG, JPG o WEBP · máximo 2 MB</p>
                  {logoFile && (
                    <button
                      type="button"
                      onClick={clearLogo}
                      className="text-xs text-red-400 hover:text-red-300 underline mt-1"
                    >
                      Quitar imagen
                    </button>
                  )}
                </div>
              </div>
            </div>
            <input
              type="text"
              placeholder="Nombre del estadio"
              value={club.stadium_name}
              onChange={e => setClub({ ...club, stadium_name: e.target.value })}
              required
              className={inputCls}
            />
            <input
              type="number"
              placeholder="Capacidad del estadio"
              min="1"
              value={club.stadium_capacity}
              onChange={e => setClub({ ...club, stadium_capacity: e.target.value })}
              required
              className={inputCls}
            />
            <select
              value={club.association_id}
              onChange={e => handleAssociation(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">Selecciona tu asociación (Federación Boliviana de Fútbol)...</option>
              {associations.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Departamento"
              value={club.department}
              onChange={e => setClub({ ...club, department: e.target.value })}
              required
              className={inputCls}
            />
            <input
              type="text"
              placeholder="Personería Jurídica de la Gobernación (opcional)"
              value={club.personeria}
              onChange={e => setClub({ ...club, personeria: e.target.value })}
              className={inputCls}
            />
            <input
              type="text"
              placeholder="Código RUN del Viceministerio de Deportes (opcional)"
              value={club.run_code}
              onChange={e => setClub({ ...club, run_code: e.target.value })}
              className={inputCls}
            />
            <button
              type="submit"
              className="btn btn-primary w-full"
            >
              Siguiente: tu cuenta
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-300 glass border border-emerald-700/40 rounded-xl p-3">
              Club: <span className="text-emerald-400 font-medium">{club.club_name}</span> · esta cuenta quedará
              como <span className="text-emerald-400">administrador del club</span>.
            </p>
            <input
              type="text"
              placeholder="Tu nombre completo"
              value={account.full_name}
              onChange={e => setAccount({ ...account, full_name: e.target.value })}
              required
              className={inputCls}
            />
            <input
              type="email"
              placeholder="Correo de contacto"
              value={account.email}
              onChange={e => setAccount({ ...account, email: e.target.value })}
              required
              className={inputCls}
            />
            <input
              type="password"
              placeholder="Contraseña (mínimo 6 caracteres)"
              value={account.password}
              onChange={e => setAccount({ ...account, password: e.target.value })}
              required
              minLength={6}
              className={inputCls}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep(1); setError(null); }}
                className="btn btn-muted flex-1"
              >
                Atrás
              </button>
              <button
                type="submit"
                disabled={sending}
                className="btn btn-primary flex-1"
              >
                {sending ? 'Publicando club...' : 'Crear mi club'}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-400">
          ¿Solo quieres comprar entradas?{' '}
          <Link to="/registro" className="text-emerald-400 hover:text-emerald-300">
            Regístrate como hincha
          </Link>
        </p>
      </div>
    </div>
  );
}
