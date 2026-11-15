import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { associationService } from '../api/association.service';
import { clubRequestService } from '../api/clubRequest.service';
import { uploadService } from '../api/upload.service';

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
  const [representative, setRepresentative] = useState({ full_name: '', email: '' });
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [associationError, setAssociationError] = useState(null);
  const [statusToken, setStatusToken] = useState('');
  const [statusTokenInput, setStatusTokenInput] = useState('');
  const [requestStatus, setRequestStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    associationService
      .getAll()
      .then(res => {
        if (res.status === 'success') setAssociations(res.data);
      })
      .catch(() => setAssociationError('No se pudieron cargar las asociaciones. Recarga la página para intentarlo nuevamente.'));
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

      const response = await clubRequestService.register({
        ...club,
        club_name: club.club_name.trim(),
        stadium_name: club.stadium_name.trim(),
        stadium_capacity: Number(club.stadium_capacity),
        logo_url,
        personeria: club.personeria.trim() || null,
        run_code: club.run_code.trim() || null,
        contact_email: representative.email.trim(),
        contact_name: representative.full_name.trim(),
        privacy_consent: privacyConsent,
      });
      const trackingToken = response.data?.status_token || '';
      setStatusToken(trackingToken);
      setStatusTokenInput(trackingToken);
      setSubmitted(true);
      if (trackingToken) await lookupRequestStatus(trackingToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const lookupRequestStatus = async token => {
    setStatusError(null);
    setRequestStatus(null);
    setStatusLoading(true);
    try {
      const response = await clubRequestService.getStatus(token);
      setRequestStatus(response.data);
    } catch (err) {
      setStatusError(err.message);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleStatusLookup = async e => {
    e.preventDefault();
    const token = statusTokenInput.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setStatusError('Ingresa el código de seguimiento de 64 caracteres.');
      setRequestStatus(null);
      return;
    }
    await lookupRequestStatus(token);
  };

  const handleCopyStatusToken = async () => {
    try {
      await navigator.clipboard.writeText(statusToken);
      setCopyMessage('Código copiado.');
    } catch {
      setCopyMessage('No se pudo copiar; selecciónalo y cópialo manualmente.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="card p-8">
        <span className="eyebrow block text-center">Solicitud de incorporación</span>
        <h2 className="section-title text-3xl mt-2 text-center">Únete a Tribuna 360</h2>
        <p className="text-sm text-gray-400 text-center mt-2">
          Envía los datos de tu club para que el equipo de Tribuna 360 los revise.
        </p>

        {!submitted && (
          <div className="flex items-center justify-center gap-3 my-6 text-sm">
            <span className={`px-3 py-1 rounded-full ${step === 1 ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-emerald-400 border border-emerald-700'}`}>
              1. Datos del club
            </span>
            <span className="text-gray-500">→</span>
            <span className={`px-3 py-1 rounded-full ${step === 2 ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700'}`}>
              2. Representante
            </span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-4 text-center">
            <p className="alert-ok">El envío fue procesado. Las solicitudes nuevas quedan pendientes de revisión.</p>
            <p className="text-sm text-gray-300">
              Consulta el resultado con tu código privado. Enviar la solicitud no crea una cuenta ni otorga permisos de administración.
            </p>
            {statusToken && (
              <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4 text-left">
                <p className="text-sm font-semibold text-amber-200">Guarda tu código de seguimiento</p>
                <p className="text-xs text-gray-300 mt-1">Este código es privado y permite consultar el estado. No podremos recuperarlo si lo pierdes.</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <input aria-label="Código de seguimiento" readOnly value={statusToken} className={`${inputCls} min-w-0 flex-1 font-mono text-xs`} />
                  <button
                    type="button"
                    onClick={handleCopyStatusToken}
                    className="btn btn-outline px-4 py-2 text-sm"
                  >
                    Copiar código
                  </button>
                </div>
                {copyMessage && <p className="text-xs text-gray-400 mt-2">{copyMessage}</p>}
              </div>
            )}
          </div>
        ) : (
          <>
            {error && <p className="mb-4 alert-error">{error}</p>}
            {associationError && <p className="mb-4 alert-error">{associationError}</p>}
            {step === 1 && (
              <form onSubmit={goStep2} className="space-y-4">
            <input
              type="text"
              placeholder="Nombre del club"
              value={club.club_name}
              onChange={e => setClub({ ...club, club_name: e.target.value })}
              required
              maxLength={150}
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
              maxLength={150}
              className={inputCls}
            />
            <input
              type="number"
              placeholder="Capacidad del estadio"
              min="1"
              max="2147483647"
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
              maxLength={100}
              className={inputCls}
            />
            <p className="text-xs text-gray-400">
              Personería jurídica y código RUN son referencias opcionales para la verificación; no necesitas adjuntar documentos en esta etapa.
            </p>
            <input
              type="text"
              placeholder="Personería Jurídica de la Gobernación (opcional)"
              value={club.personeria}
              onChange={e => setClub({ ...club, personeria: e.target.value })}
              maxLength={100}
              className={inputCls}
            />
            <input
              type="text"
              placeholder="Código RUN del Viceministerio de Deportes (opcional)"
              value={club.run_code}
              onChange={e => setClub({ ...club, run_code: e.target.value })}
              maxLength={100}
              className={inputCls}
            />
            <button
              type="submit"
              className="btn btn-primary w-full"
            >
              Siguiente: representante
            </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-300 glass border border-emerald-700/40 rounded-xl p-3">
              Club: <span className="text-emerald-400 font-medium">{club.club_name}</span>. La información se revisará antes de crear el club o asignar permisos.
            </p>
            <input
              type="text"
              placeholder="Tu nombre completo"
              value={representative.full_name}
              onChange={e => setRepresentative({ ...representative, full_name: e.target.value })}
              required
              maxLength={150}
              className={inputCls}
            />
            <input
              type="email"
              placeholder="Correo de contacto"
              value={representative.email}
              onChange={e => setRepresentative({ ...representative, email: e.target.value })}
              required
              maxLength={254}
              className={inputCls}
            />
            <label className="flex items-start gap-3 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={e => setPrivacyConsent(e.target.checked)}
                required
                className="mt-1 accent-emerald-500"
              />
              <span>Acepto que Tribuna 360 use estos datos para evaluar y dar seguimiento a esta solicitud.</span>
            </label>
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
                {sending ? 'Enviando solicitud...' : 'Enviar solicitud'}
              </button>
            </div>
              </form>
            )}
          </>
        )}

        <section className="mt-8 border-t border-white/10 pt-6">
          <h3 className="text-lg font-semibold">Consultar estado de una solicitud</h3>
          <p className="text-sm text-gray-400 mt-1">Usa el código privado que recibiste al enviar el formulario.</p>
          <form onSubmit={handleStatusLookup} className="flex flex-wrap gap-3 mt-4">
            <input
              type="text"
              autoComplete="off"
              spellCheck="false"
              value={statusTokenInput}
              onChange={e => setStatusTokenInput(e.target.value)}
              placeholder="Código de seguimiento"
              maxLength={64}
              className={`${inputCls} min-w-0 flex-1 font-mono text-sm`}
            />
            <button type="submit" disabled={statusLoading} className="btn btn-primary px-5">
              {statusLoading ? 'Consultando...' : 'Consultar'}
            </button>
          </form>
          {statusError && <p className="alert-error mt-3">{statusError}</p>}
          {requestStatus && (
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 mt-3">
              <p className="font-semibold">
                Estado: {requestStatus.status === 'pending' ? 'Pendiente de revisión' : requestStatus.status === 'approved' ? 'Aprobada' : 'Rechazada'}
              </p>
              {requestStatus.reviewed_at && (
                <p className="text-xs text-gray-400 mt-1">Resuelta: {new Date(requestStatus.reviewed_at).toLocaleString('es-BO')}</p>
              )}
              {requestStatus.review_note && <p className="text-sm text-gray-300 mt-2">{requestStatus.review_note}</p>}
            </div>
          )}
        </section>

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
