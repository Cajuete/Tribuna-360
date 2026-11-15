import { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { membershipService } from '../api/membership.service';
import { paymentService } from '../api/payment.service';

export default function MyMembership() {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const message = location.state?.message;

  const load = () => {
    membershipService.getMine()
      .then(res => {
        if (res.status === 'success') setMemberships(res.data);
        else setError(res.message || 'No se pudieron cargar las membresías.');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Enviar una solicitud de cancelación al club? La membresía seguirá activa hasta que el club la revise.')) return;
    setActionInProgress(id);
    setError(null);
    setActionMessage(null);
    try {
      const res = await membershipService.cancel(id);
      if (res.status === 'success') {
        setActionMessage(res.message);
        load();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRenew = async (id) => {
    if (!window.confirm('¿Quieres iniciar el pago QR de renovación? La vigencia cambiará después de que el club confirme el comprobante.')) return;
    setActionInProgress(id);
    setError(null);
    setActionMessage(null);
    try {
      const res = await paymentService.create('membership_renewal', { membership_id: id });
      if (res.success) navigate(`/pagar/${res.data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const formatDate = value => value ? new Date(value).toLocaleDateString('es-BO') : 'No disponible';

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-bold mb-6">Mi Membresía</h2>

      {message && <p className="mb-6 p-3 rounded text-center bg-emerald-900 text-emerald-300">{message}</p>}
      {actionMessage && <p className="mb-6 p-3 rounded text-center bg-emerald-900 text-emerald-300">{actionMessage}</p>}
      {loading && <p className="text-center text-gray-400 py-8">Cargando membresías...</p>}
      {error && <p className="p-3 rounded text-center bg-red-900 text-red-300">{error}</p>}
      <p className="text-xs text-gray-500 mb-5">La renovación se aplica cuando el club confirma el pago. Una cancelación solicitada requiere revisión del club.</p>

      {!loading && !error && memberships.length === 0 && (
        <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-2xl">
          <p className="text-gray-400 mb-4">Todavía no eres socio de ningún club.</p>
          <Link to="/socios" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg transition">
            Ver planes de socio
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {memberships.map(m => {
          const expired = m.status === 'active' && m.expires_at && new Date(m.expires_at) <= new Date();
          const effectiveStatus = m.status === 'cancelled' ? 'cancelled' : expired ? 'expired' : 'active';
          const cancellationRequest = m.cancellation_request;
          const cancellationPending = cancellationRequest?.status === 'pending';
          const canRenew = m.status === 'active' && !cancellationPending;
          const canRequestCancellation = effectiveStatus === 'active' && !cancellationPending;

          return (
          <div key={m.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500">{m.tenants?.name}</p>
              <h3 className="font-bold text-lg">{m.membership_plans?.name}</h3>
              <p className="text-sm text-gray-300 mt-1">{m.membership_plans?.benefits}</p>
              <p className="text-emerald-400 font-semibold mt-1">Bs {m.membership_plans?.price} / {m.membership_plans?.duration_days || 30} días</p>
              <p className="text-xs text-gray-400 mt-2">Inicio: {formatDate(m.started_at || m.created_at)}</p>
              <p className="text-xs text-gray-400">Vencimiento: {formatDate(m.expires_at)}</p>
              {cancellationRequest && (
                <p className="text-xs text-amber-300 mt-2">
                  Solicitud de cancelación: {cancellationPending ? 'pendiente de revisión' : cancellationRequest.status === 'approved' ? 'aprobada' : 'rechazada'}
                  {cancellationRequest.reviewed_at ? ` · resuelta ${formatDate(cancellationRequest.reviewed_at)}` : ''}
                  {cancellationRequest.review_note ? ` · ${cancellationRequest.review_note}` : ''}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`text-xs px-3 py-1 rounded-full uppercase font-semibold ${
                effectiveStatus === 'active' ? 'bg-emerald-900 text-emerald-300' : effectiveStatus === 'expired' ? 'bg-amber-900 text-amber-300' : 'bg-gray-700 text-gray-300'
              }`}>
                {effectiveStatus === 'active' ? 'Activa' : effectiveStatus === 'expired' ? 'Vencida' : 'Cancelada'}
              </span>
              {cancellationPending && <span className="text-xs text-amber-300">Cancelación en revisión</span>}
              {canRenew && (
                <button
                  type="button"
                  disabled={actionInProgress === m.id}
                  onClick={() => handleRenew(m.id)}
                  className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
                >
                  {actionInProgress === m.id ? 'Procesando...' : expired ? 'Renovar membresía' : 'Renovar manualmente'}
                </button>
              )}
              {canRequestCancellation && (
                <button
                  type="button"
                  disabled={actionInProgress === m.id}
                  onClick={() => handleCancel(m.id)}
                  className="bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
                >
                  {actionInProgress === m.id ? 'Enviando...' : 'Solicitar cancelación'}
                </button>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
